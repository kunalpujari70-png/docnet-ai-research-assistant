import { Handler } from '@netlify/functions';
import OpenAI from 'openai';

interface ChatRequest {
  message: string;
  documents?: Array<{
    name: string;
    content: string;
    summary: string;
  }>;
  history?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  aiProvider?: 'openai' | 'gemini';
  searchWeb?: boolean;
}

interface ChatResponse {
  response: string;
  documentsUsed?: string[];
  confidence?: number;
  responseTime?: number;
  sources?: string[];
}

// Initialize OpenAI client
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

// Web search function using DuckDuckGo
async function performWebSearch(query: string): Promise<any[]> {
  try {
    console.log(`Web search requested for: ${query}`);
    
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    const results: any[] = [];
    
    if (data.Abstract) {
      results.push({
        title: data.Heading || 'Instant Answer',
        snippet: data.Abstract,
        url: data.AbstractURL || '',
        source: 'DuckDuckGo Instant Answer'
      });
    }
    
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

// Enhanced document analysis function
function analyzeDocumentsForRelevance(query: string, documents: any[]): any[] {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
  
  return documents.map(doc => {
    const contentLower = doc.content.toLowerCase();
    const summaryLower = doc.summary.toLowerCase();
    const nameLower = doc.name.toLowerCase();
    
    // Calculate relevance score
    let relevanceScore = 0;
    
    // Check for exact matches
    queryWords.forEach(word => {
      if (contentLower.includes(word)) relevanceScore += 2;
      if (summaryLower.includes(word)) relevanceScore += 3;
      if (nameLower.includes(word)) relevanceScore += 1;
    });
    
    // Check for phrase matches
    if (contentLower.includes(queryLower)) relevanceScore += 5;
    if (summaryLower.includes(queryLower)) relevanceScore += 8;
    
    // Check for semantic similarity (simple keyword matching)
    const semanticKeywords = ['research', 'study', 'analysis', 'data', 'findings', 'conclusion', 'method', 'result'];
    semanticKeywords.forEach(keyword => {
      if (queryLower.includes(keyword) && (contentLower.includes(keyword) || summaryLower.includes(keyword))) {
        relevanceScore += 1;
      }
    });
    
    return {
      ...doc,
      relevanceScore,
      isRelevant: relevanceScore > 0
    };
  }).filter(doc => doc.isRelevant)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 3); // Limit to top 3 most relevant documents
}

// Call Gemini API
async function callGeminiAPI(prompt: string, context?: string): Promise<string> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const enhancedPrompt = context 
      ? `Context: ${context}\n\nUser Question: ${prompt}\n\nPlease provide a comprehensive answer based on the context provided.`
      : prompt;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: enhancedPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini API';
  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
}

// Enhanced OpenAI API call with better document integration
async function callOpenAIAPI(prompt: string, documents: any[] = [], webResults: any[] = [], chatHistory: any[] = []): Promise<string> {
  try {
    const client = getOpenAIClient();
    
    // Analyze documents for relevance
    const relevantDocuments = analyzeDocumentsForRelevance(prompt, documents);
    
    // Build comprehensive system message
    let systemMessage = `You are **DocNet**, an intelligent research assistant that combines uploaded documents with web knowledge to provide comprehensive, accurate, and insightful responses.

## **Your Core Capabilities:**
- **Document Analysis**: Extract key insights from uploaded documents
- **Web Integration**: Combine document knowledge with current web information
- **Contextual Understanding**: Provide answers that reference specific document content
- **Research Synthesis**: Connect information across multiple sources

## **Response Guidelines:**
1. **ALWAYS prioritize uploaded documents** when they contain relevant information
2. **Clearly reference document content** when using it in your response
3. **Combine document insights with web knowledge** for comprehensive answers
4. **Ask for clarification** if the question is ambiguous or needs more context
5. **Provide specific examples** from documents when possible

## **Document Context:**`;

    if (relevantDocuments.length > 0) {
      systemMessage += `\n\nYou have access to ${relevantDocuments.length} relevant document(s):\n`;
      relevantDocuments.forEach((doc, index) => {
        systemMessage += `\n**Document ${index + 1}: ${doc.name}**\n`;
        systemMessage += `Summary: ${doc.summary}\n`;
        systemMessage += `Key Content: ${doc.content.substring(0, 1000)}...\n`;
      });
    } else if (documents.length > 0) {
      systemMessage += `\n\nYou have ${documents.length} uploaded document(s), but none seem directly relevant to this query. You can still reference general themes or topics from these documents if helpful.`;
    } else {
      systemMessage += `\n\nNo documents are currently uploaded. You can provide general knowledge and suggest uploading relevant documents for more specific analysis.`;
    }

    if (webResults.length > 0) {
      systemMessage += `\n\n**Web Search Results:**\n`;
      webResults.forEach((result, index) => {
        systemMessage += `\n${index + 1}. ${result.title}\n`;
        systemMessage += `   ${result.snippet}\n`;
        systemMessage += `   Source: ${result.source}\n`;
      });
    }

    systemMessage += `\n\n**Instructions for this response:**
- If documents contain relevant information, base your answer primarily on that content
- Reference specific document names and content when applicable
- Use web search results to supplement or add current context
- If no relevant documents found, use web search results and general knowledge
- Always be clear about your sources (documents vs. web vs. general knowledge)
- Ask follow-up questions if you need more context to provide a better answer`;

    const messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }> = [
      { role: 'system', content: systemMessage }
    ];
    
    // Add chat history for context
    chatHistory.forEach(msg => {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      });
    });
    
    // Add current user message
    messages.push({
      role: 'user',
      content: prompt
    });

    const completion = await client.chat.completions.create({
      model: 'gpt-4',
      messages,
      max_tokens: 2048,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || 'No response from OpenAI API';
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}

export const handler: Handler = async (event) => {
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const startTime = Date.now();

  try {
    const body: ChatRequest = JSON.parse(event.body || '{}');
    const { message, documents = [], history = [], aiProvider = 'openai', searchWeb = false } = body;

    if (!message) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Message is required' }),
      };
    }

    console.log(`Processing request with provider: ${aiProvider}, searchWeb: ${searchWeb}`);
    console.log(`Documents provided: ${documents.length}`);
    console.log(`Chat history length: ${history.length}`);

    // Perform web search if requested
    let webResults: any[] = [];
    if (searchWeb) {
      try {
        webResults = await performWebSearch(message);
        console.log(`Web search returned ${webResults.length} results`);
      } catch (error) {
        console.error('Web search failed:', error);
      }
    }

    // Call appropriate AI provider
    let aiResponse: string;
    let documentsUsed: string[] = [];
    
    try {
      if (aiProvider === 'gemini') {
        // For Gemini, combine all context into a single prompt
        const allContext = [
          ...documents.map(doc => `Document: ${doc.name}\nContent: ${doc.content}\nSummary: ${doc.summary}`),
          ...webResults.map(result => `Web Result: ${result.title}\n${result.snippet}`)
        ].join('\n\n');
        
        aiResponse = await callGeminiAPI(message, allContext);
        documentsUsed = documents.map(doc => doc.name);
      } else {
        // For OpenAI, use the enhanced function
        aiResponse = await callOpenAIAPI(message, documents, webResults, history);
        documentsUsed = documents.map(doc => doc.name);
      }
    } catch (aiError) {
      console.error(`AI API error (${aiProvider}):`, aiError);
      
      // Enhanced fallback response
      aiResponse = `I apologize, but I encountered an error with the ${aiProvider} API. Let me provide what I can based on your question: "${message}"\n\n`;
      
      if (documents.length > 0) {
        aiResponse += `I have ${documents.length} document(s) available that might be relevant to your question. `;
        aiResponse += `The documents include: ${documents.map(doc => doc.name).join(', ')}.\n\n`;
        aiResponse += `To get a more detailed analysis, please try:\n`;
        aiResponse += `• Rephrasing your question to be more specific\n`;
        aiResponse += `• Uploading additional relevant documents\n`;
        aiResponse += `• Checking your API key configuration\n`;
      } else {
        aiResponse += `This appears to be a research question that I can help you with. `;
        aiResponse += `To provide more specific assistance, you could upload relevant documents or try asking a more specific question.`;
      }
    }

    const responseTime = Date.now() - startTime;

    // Prepare sources
    const sources = [
      ...documentsUsed,
      ...webResults.map(result => result.source)
    ].filter(Boolean);

    const result: ChatResponse = {
      response: aiResponse,
      documentsUsed: documentsUsed.length > 0 ? documentsUsed : undefined,
      confidence: documents.length > 0 ? 0.9 : 0.7,
      responseTime,
      sources: sources.length > 0 ? sources : undefined
    };

    console.log(`Response generated in ${responseTime}ms`);
    console.log(`Documents used: ${documentsUsed.length}`);
    console.log(`Web results used: ${webResults.length}`);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error('API Error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        response: 'I apologize, but I encountered an error processing your request. Please try again, or if the problem persists, try refreshing the page.',
        responseTime: Date.now() - startTime
      }),
    };
  }
};
