import { Router } from 'express';
import OpenAI from 'openai';
import { searchDocuments, getAllDocuments, getDocumentById } from "../database";
import { OpenAIRequest, OpenAIResponse } from "../../shared/api";

const router = Router();

// Initialize OpenAI client lazily
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}



// Web search function using DuckDuckGo Instant Answer API
async function performWebSearch(query: string): Promise<any[]> {
  try {
    console.log(`Web search requested for: ${query}`);
    
    // Use DuckDuckGo Instant Answer API
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    const results: any[] = [];
    
    // Add instant answer if available
    if (data.Abstract) {
      results.push({
        title: data.Heading || 'Instant Answer',
        snippet: data.Abstract,
        url: data.AbstractURL || '',
        source: 'DuckDuckGo Instant Answer'
      });
    }
    
    // Add related topics
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      data.RelatedTopics.slice(0, 3).forEach((topic: any) => {
        if (topic.Text) {
          results.push({
            title: topic.Text.split(' - ')[0] || 'Related Topic',
            snippet: topic.Text,
            url: topic.FirstURL || '',
            source: 'DuckDuckGo Related Topics'
          });
        }
      });
    }
    
    console.log(`Found ${results.length} web search results`);
    return results;
  } catch (error) {
    console.error('Web search error:', error);
    return [];
  }
}

// Rough token estimation (1 token ≈ 4 characters for English text)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Truncate text to fit within token limit
function truncateToTokenLimit(text: string, maxTokens: number): string {
  const estimatedTokens = estimateTokens(text);
  if (estimatedTokens <= maxTokens) {
    return text;
  }
  
  // Calculate how many characters we can keep
  const maxChars = maxTokens * 4;
  return text.substring(0, maxChars) + '...';
}

router.post('/chat', async (req, res) => {
  const startTime = Date.now();
  try {
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not configured');
      return res.status(500).json({ 
        error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to environment variables.' 
      });
    }

    const { prompt, context, searchWeb = false, variables = {}, chatHistory = [] }: OpenAIRequest = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log(`OpenAI request: "${prompt}"`);
    console.log(`Search web: ${searchWeb}`);

    // Get document context
    let databaseContext = '';
    const relevantDocuments = await searchDocuments(prompt);
    console.log(`Search query: "${prompt}"`);
    console.log(`Found ${relevantDocuments.length} relevant documents`);

    if (relevantDocuments.length > 0) {
      console.log(`Document names: ${relevantDocuments.map(doc => doc.originalName).join(', ')}`);
      
      // Smart content extraction - find relevant sections around the search terms
      const searchTerms = prompt.toLowerCase().split(/\s+/).filter(term => term.length > 2);
      const relevantSections = relevantDocuments.map(doc => {
        const content = doc.content;
        const sections: string[] = [];
        
        // Find sections containing search terms
        searchTerms.forEach(term => {
          const index = content.toLowerCase().indexOf(term);
          if (index !== -1) {
            // Extract 2000 characters around the term (1000 before, 1000 after)
            const start = Math.max(0, index - 1000);
            const end = Math.min(content.length, index + 1000);
            const section = content.substring(start, end);
            sections.push(section);
          }
        });
        
        // If no specific sections found, take the first 3000 characters
        if (sections.length === 0) {
          sections.push(content.substring(0, 3000));
        }
        
        // Limit to 3 most relevant sections per document
        return `=== DOCUMENT: ${doc.originalName} ===\n${sections.slice(0, 3).join('\n...\n')}\n`;
      });
      
      databaseContext = `\n\nPRIMARY SOURCE - RELEVANT DOCUMENT SECTIONS:\n${relevantSections.join('\n')}`;
    } else {
      console.log("No relevant documents found for query:", prompt);
      // Fallback: include first 2000 characters of each document
      const allDocuments = await getAllDocuments();
      const processedDocs = allDocuments.filter(doc => doc.processed);
      if (processedDocs.length > 0) {
        console.log("Including document summaries as fallback");
        const docSummaries = await Promise.all(processedDocs.map(async (doc) => {
          const fullDoc = await getDocumentById(doc.id);
          if (fullDoc) {
            // Take first 2000 characters as summary
            const summary = fullDoc.content.substring(0, 2000);
            return `=== DOCUMENT: ${fullDoc.originalName} ===\n${summary}...\n`;
          }
          return null;
        }));
        databaseContext = `\n\nFALLBACK - DOCUMENT SUMMARIES:\n${docSummaries.filter(doc => doc).join('\n')}`;
      }
    }

    // Get web search results if requested
    let webContext = '';
    let webResults: any[] = [];
    if (searchWeb) {
      webResults = await performWebSearch(prompt);
      if (webResults.length > 0) {
        webContext = `\n\nWEB SEARCH RESULTS:\n${webResults.map(result => 
          `- ${result.title}: ${result.snippet}`
        ).join('\n')}`;
      }
    }



    // Build the system message
    let systemMessage = `You are **Claude**, the intelligent research companion powering DocNet - where documents meet the internet for extraordinary research and content creation. You excel at combining uploaded documents with web knowledge to help users discover, analyze, and create amazing content.

## **Your Core Capabilities:**

### 📚 **Document Analysis & Research**
- Extract key insights and patterns from uploaded documents
- Provide detailed summaries with actionable takeaways
- Answer specific questions about document content
- Identify research gaps and opportunities

### 🔍 **Research Strategy & Methodology**
- Help formulate clear research questions and hypotheses
- Suggest appropriate research methodologies and approaches
- Guide users through systematic research processes
- Assist with literature reviews and academic writing

### 📊 **Data Analysis & Interpretation**
- Help interpret research findings and statistical data
- Provide insights on trends, correlations, and patterns
- Assist with data visualization recommendations
- Support evidence-based decision making

### 💡 **Creative Problem Solving**
- Brainstorm innovative solutions and approaches
- Explore alternative perspectives and methodologies
- Help overcome research challenges and roadblocks
- Suggest interdisciplinary connections and insights

## **Your Communication Style:**

### 🎯 **Professional & Engaging**
- Use clear, concise language while being thorough
- Maintain a warm, encouraging tone that builds confidence
- Structure responses with clear sections and bullet points
- Use emojis sparingly but effectively to enhance readability

### 🤝 **Interactive & Collaborative**
- Ask thoughtful clarifying questions when needed
- Provide multiple options and perspectives
- Encourage users to think critically and explore further
- Celebrate progress and achievements

### 📋 **Action-Oriented**
- Always provide actionable next steps
- Break complex tasks into manageable chunks
- Suggest specific tools, resources, or approaches
- Help users create research roadmaps and timelines

## **For New Users:**
Welcome them enthusiastically to DocNet! Explain how you combine documents with internet research to create something extraordinary. Subtly motivate them to:
- Upload documents to unlock DocNet's full potential
- Explore how their content can be transformed and enhanced
- Discover connections between their work and broader trends
- Create compelling content from their research materials
- Generate innovative ideas by combining their documents with current insights

## **Document Context:**
${relevantDocuments.length > 0 ? `You have access to ${relevantDocuments.length} uploaded document(s). Use this context to provide more relevant, specific, and insightful answers. Reference specific parts of the documents when appropriate.` : 'No documents are currently uploaded. You can work with general research questions or suggest uploading relevant documents for more targeted assistance.'}

## **Smart Source Attribution Guidelines:**

### 📋 **When Documents Are Available:**
- **ALWAYS check uploaded documents first** for relevant information
- **Combine document insights with web knowledge** when both are available
- **Clearly indicate** which parts come from documents vs. web sources
- **Use document content as primary source** when it directly answers the question

### 🌐 **When No Relevant Documents Found:**
- **Explicitly state** that no supporting data was found in uploaded documents
- **Clarify** that your response is based on general knowledge/web sources
- **Suggest** uploading relevant documents for more specific analysis
- **Example**: "I couldn't find specific information about this in your uploaded documents, so I'm providing general knowledge..."

### 🔍 **Smart Response Strategy:**
- **Analyze the query** - is it asking about specific uploaded content or general knowledge?
- **Prioritize documents** when the question relates to uploaded materials
- **Be transparent** about your sources in every response
- **Offer to help** users upload relevant documents when appropriate

## **DocNet Motivation Strategy:**
- **Subtly inspire** users to explore the power of combining documents with internet research
- **Highlight possibilities** - show how their research can become compelling content
- **Suggest creative applications** - articles, presentations, reports, insights
- **Demonstrate value** - show connections between their documents and broader knowledge
- **Encourage exploration** - motivate them to discover what's possible with DocNet
- **Never be pushy** - let the value speak for itself through helpful demonstrations

## **Response Guidelines:**
- Be thorough but avoid overwhelming users
- Use clear headings and structure for complex responses
- Provide examples and analogies when helpful
- Always end with a clear next step or question
- Maintain enthusiasm for the user's research journey
- **Always clarify your sources** - documents, web, or general knowledge
- **Subtly showcase DocNet's unique value** in every interaction

Remember: You're not just providing information—you're inspiring users to discover the extraordinary possibilities when documents meet the internet. Help them see how DocNet can transform their research into something amazing.`;

    // Build the user message
    let userMessage = `User Question: ${prompt}`;
    
    if (context) {
      userMessage += `\n\nManual Document Context: ${context}`;
    }
    
    if (databaseContext) {
      userMessage += databaseContext;
    }
    
    if (webContext) {
      userMessage += webContext;
    }



    // Prepare messages for OpenAI
    const messages: any[] = [
      { role: 'system', content: systemMessage }
    ];

    // Add chat history if provided
    if (chatHistory.length > 0) {
      messages.push(...chatHistory);
    }

    // Add current user message
    messages.push({ role: 'user', content: userMessage });

    // Check token limits and truncate if necessary
    const maxTokens = 120000; // Leave some buffer for response
    const totalContent = messages.map(m => m.content).join('');
    const estimatedTokens = estimateTokens(totalContent);
    
    console.log('Sending request to OpenAI...');
    console.log('System message length:', systemMessage.length);
    console.log('User message length:', userMessage.length);
    console.log('Estimated total tokens:', estimatedTokens);
    
    if (estimatedTokens > maxTokens) {
      console.log('Token limit exceeded, truncating content...');
      // Truncate the user message to fit within limits
      const availableTokens = maxTokens - estimateTokens(systemMessage);
      const maxUserMessageChars = availableTokens * 4;
      userMessage = userMessage.substring(0, maxUserMessageChars) + '...';
      messages[messages.length - 1] = { role: 'user', content: userMessage };
      console.log('Truncated user message length:', userMessage.length);
    }

    // Call OpenAI API
    const openaiClient = getOpenAIClient();
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: messages,
      max_tokens: 4000,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || 'No response generated';

    console.log('OpenAI response received successfully');
    console.log('Raw OpenAI response:', response);
    console.log('Response length:', response.length);
    console.log('Response type:', typeof response);

    const responseTime = Date.now() - startTime;
    
    const result: OpenAIResponse = {
      response,
      sources: relevantDocuments.map(doc => doc.originalName),
      webResults,
      responseTime
    };

    console.log(`Response generated in ${responseTime}ms`);
    console.log('Sending response:', JSON.stringify(result, null, 2));
    res.json(result);

  } catch (error) {
    console.error('OpenAI API error:', error);
    
    // Check for specific API key errors
    if (error instanceof Error) {
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        return res.status(401).json({ 
          error: 'Invalid API key. Please check your OpenAI API configuration.',
          details: 'The OpenAI API key is either missing, invalid, or expired.'
        });
      }
      if (error.message.includes('429') || error.message.includes('rate limit')) {
        return res.status(429).json({ 
          error: 'Rate limit exceeded. Please try again later.',
          details: 'Too many requests to OpenAI API.'
        });
      }
    }
    
    res.status(500).json({ 
      error: 'An error occurred while processing your request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
