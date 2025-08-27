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

// Web search function using DuckDuckGo with timeout protection
async function performWebSearch(query: string): Promise<any[]> {
  try {
    console.log(`Web search requested for: ${query}`);
    
    // Add timeout to web search to prevent hanging
    const timeoutPromise = new Promise<any[]>((_, reject) => {
      setTimeout(() => reject(new Error('Web search timeout')), 15000); // 15 second timeout
    });
    
    const searchPromise = (async () => {
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
    })();
    
    const results = await Promise.race([searchPromise, timeoutPromise]);
    return results;
  } catch (error) {
    console.error('Web search error:', error);
    if (error instanceof Error && error.message.includes('timeout')) {
      console.log('Web search timed out, returning empty results');
    }
    return [];
  }
}

// Ultra-optimized document analysis with micro-tasking and performance monitoring
async function analyzeDocumentsForRelevance(query: string, documents: any[]): Promise<any[]> {
  const startTime = performance.now();
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(word => word.length > 1);
  
  console.log(`Analyzing documents for query: "${query}"`);
  console.log(`Query words: ${queryWords.join(', ')}`);
  console.log(`Total documents to process: ${documents.length}`);
  
  // Early exit for empty documents
  if (documents.length === 0) {
    console.log('No documents to analyze');
    return [];
  }
  
  // Pre-compile semantic keywords for better performance
  const semanticKeywords = new Set([
    'research', 'study', 'analysis', 'data', 'findings', 'conclusion', 'method', 'result',
    'report', 'document', 'paper', 'article', 'summary', 'overview', 'details', 'information',
    'statistics', 'figures', 'numbers', 'percentages', 'trends', 'patterns', 'insights',
    'mount', 'mountain', 'hill', 'peak', 'summit', 'location', 'place', 'area', 'region',
    'history', 'historical', 'ancient', 'temple', 'religious', 'sacred', 'pilgrimage'
  ]);
  
  // Micro-task processing with smaller chunks and more frequent yields
  const microChunkSize = 1; // Process one document at a time
  const results = [];
  let processedCount = 0;
  
  for (let i = 0; i < documents.length; i += microChunkSize) {
    const chunk = documents.slice(i, i + microChunkSize);
    
    // Process each document individually with immediate yielding
    for (const doc of chunk) {
      // Yield control after every document to prevent blocking
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const contentLower = doc.content.toLowerCase();
      const summaryLower = doc.summary.toLowerCase();
      const nameLower = doc.name.toLowerCase();
      
      // Calculate relevance score with optimized logic
      let relevanceScore = 0;
      let matchDetails = {
        exactMatches: 0,
        summaryMatches: 0,
        contentMatches: 0,
        nameMatches: 0,
        partialMatches: 0
      };
      
      // Optimized word matching with early exit for high-scoring documents
      for (const word of queryWords) {
        if (contentLower.includes(word)) {
          relevanceScore += 3;
          matchDetails.contentMatches++;
        }
        if (summaryLower.includes(word)) {
          relevanceScore += 6;
          matchDetails.summaryMatches++;
        }
        if (nameLower.includes(word)) {
          relevanceScore += 5;
          matchDetails.nameMatches++;
        }
        
        // Early exit if document is already highly relevant
        if (relevanceScore >= 25) {
          break;
        }
      }
      
      // Check for exact phrase matches (highest priority)
      if (contentLower.includes(queryLower)) {
        relevanceScore += 20;
        matchDetails.exactMatches++;
      }
      if (summaryLower.includes(queryLower)) {
        relevanceScore += 25;
        matchDetails.exactMatches++;
      }
      
      // Optimized partial phrase matching
      const queryParts = queryLower.split(/\s+/);
      if (queryParts.length > 1) {
        const matchingParts = queryParts.filter(part => contentLower.includes(part));
        if (matchingParts.length >= Math.ceil(queryParts.length * 0.7)) {
          relevanceScore += 15;
          matchDetails.partialMatches++;
        }
      }
      
      // Optimized semantic keyword matching
      for (const keyword of semanticKeywords) {
        if (queryLower.includes(keyword) && (contentLower.includes(keyword) || summaryLower.includes(keyword))) {
          relevanceScore += 3;
        }
      }
      
      // Content quality bonuses
      if (contentLower.length > 500) relevanceScore += 2;
      if (summaryLower.length > 100) relevanceScore += 3;
      
      const result = {
        ...doc,
        relevanceScore,
        matchDetails,
        isRelevant: relevanceScore >= 2,
        confidence: relevanceScore >= 15 ? 'high' : relevanceScore >= 8 ? 'medium' : 'low'
      };
      
      results.push(result);
      processedCount++;
      
      // Log progress every 5 documents
      if (processedCount % 5 === 0) {
        console.log(`Processed ${processedCount}/${documents.length} documents...`);
      }
    }
  }
  
  const relevantDocs = results.filter(doc => doc.isRelevant)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 5);
  
  const endTime = performance.now();
  const processingTime = endTime - startTime;
  
  console.log(`Document analysis completed in ${processingTime.toFixed(2)}ms`);
  console.log(`Found ${relevantDocs.length} relevant documents out of ${documents.length} total`);
  console.log(`Processing rate: ${(documents.length / (processingTime / 1000)).toFixed(2)} documents/second`);
  
  return relevantDocs;
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
    const relevantDocuments = await analyzeDocumentsForRelevance(prompt, documents);
    
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
        systemMessage += `Full Content: ${doc.content}\n`; // Include full content instead of truncated
        systemMessage += `Relevance Score: ${doc.relevanceScore} (${doc.confidence} confidence)\n`;
        systemMessage += `Match Details: ${JSON.stringify(doc.matchDetails)}\n`;
      });
    } else if (documents.length > 0) {
      systemMessage += `\n\nYou have ${documents.length} uploaded document(s), but the relevance analysis didn't find direct matches. However, you should still check these documents manually for any relevant information:\n`;
      documents.forEach((doc, index) => {
        systemMessage += `\n**Document ${index + 1}: ${doc.name}**\n`;
        systemMessage += `Content: ${doc.content.substring(0, 500)}...\n`;
      });
      systemMessage += `\nIMPORTANT: Even if the relevance analysis didn't flag these documents, manually search through their content for any information related to the user's question.`;
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

    systemMessage += `\n\n**CRITICAL RESPONSE INSTRUCTIONS - DOCUMENT PRIORITY IS MANDATORY:**

**ABSOLUTE DOCUMENT PRIORITY RULES:**
1. **ALWAYS CHECK DOCUMENTS FIRST** - Before doing anything else, thoroughly search through ALL uploaded documents
2. **IF DOCUMENTS CONTAIN THE ANSWER** - Use ONLY document content, do NOT use web search
3. **ONLY USE WEB SEARCH** if documents are completely empty of relevant information
4. **NEVER SAY "I couldn't find information in documents"** if documents actually contain relevant content

**MANDATORY RESPONSE FORMAT:**
- **If documents contain relevant info**: Start with "📄 **Based on your uploaded documents:**" and provide answer from documents ONLY
- **If documents + web search needed**: Use "📄 **Based on your uploaded documents and web search:**" 
- **If ONLY web search (no relevant documents)**: Start with "🌐 **I couldn't find specific information in your uploaded documents. Here's what I found on the internet:**"
- **If insufficient context**: Ask "🤔 **I don't have enough context from the uploaded documents to answer your question fully. Could you provide more details?**"

**DOCUMENT SEARCH REQUIREMENTS:**
- Search through ALL document content, not just summaries
- Look for partial matches, synonyms, and related terms
- If the query mentions "Mount Mandar", search for "mandar", "mountain", "mount", "pandar", etc.
- If documents contain ANY relevant information, use it as your primary source

**DOCUMENT REFERENCING:**
- Always mention specific document names when using their content
- Quote relevant sections from documents when possible
- Explain how document content relates to the user's question
- Be specific about which document contains which information

**WEB SEARCH RESTRICTIONS:**
- ONLY use web search when documents are completely devoid of relevant information
- If documents contain ANY relevant content, prioritize that over web search
- Use web search to supplement document information, never replace it
- Clearly separate document-based information from web-based information

**CONTEXT HANDLING:**
- If the question is too vague, ask for clarification
- If documents exist but don't seem relevant, double-check for partial matches
- Provide partial answers based on available document information when possible
- Suggest uploading additional relevant documents if needed`;

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

    console.log(`Processing chat request: "${message}"`);
    console.log(`Documents available: ${documents.length}`);
    console.log(`Search web enabled: ${searchWeb}`);
    console.log(`AI Provider: ${aiProvider}`);

    // Step 1: Analyze documents for relevance
    const relevantDocuments = await analyzeDocumentsForRelevance(message, documents);
    console.log(`Found ${relevantDocuments.length} relevant documents`);

    // Step 2: Determine response strategy based on document availability
    let responseStrategy = 'web-only';
    let webResults: any[] = [];

    if (relevantDocuments.length > 0) {
      responseStrategy = 'documents-first';
      console.log('Using documents-first strategy');
      
      // Only search web if explicitly enabled and we have relevant documents
      if (searchWeb) {
        console.log('Searching web to supplement document information');
        webResults = await performWebSearch(message);
      }
    } else if (documents.length > 0) {
      // Documents exist but none are relevant
      responseStrategy = 'documents-irrelevant';
      console.log('Documents exist but none are relevant to the query');
      
      if (searchWeb) {
        console.log('Searching web as documents are not relevant');
        webResults = await performWebSearch(message);
      }
    } else {
      // No documents uploaded
      responseStrategy = 'no-documents';
      console.log('No documents uploaded, using web search only');
      
      if (searchWeb) {
        console.log('Searching web as no documents are available');
        webResults = await performWebSearch(message);
      }
    }

    // Step 3: Generate response based on strategy
    let aiResponse: string;
    let documentsUsed: string[] = [];
    let confidence: number = 0.5;

    try {
      if (aiProvider === 'gemini') {
        // For Gemini, combine all context into a single prompt
        const allContext = [
          ...relevantDocuments.map(doc => `Document: ${doc.name}\nContent: ${doc.content}\nSummary: ${doc.summary}`),
          ...webResults.map(result => `Web Result: ${result.title}\n${result.snippet}`)
        ].join('\n\n');
        
        aiResponse = await callGeminiAPI(message, allContext);
        documentsUsed = relevantDocuments.map(doc => doc.name);
      } else {
        // For OpenAI, use the enhanced function with document-first strategy
        aiResponse = await callOpenAIAPI(message, relevantDocuments, webResults, history);
        documentsUsed = relevantDocuments.map(doc => doc.name);
      }

      // Adjust confidence based on strategy
      switch (responseStrategy) {
        case 'documents-first':
          confidence = Math.min(0.9, 0.5 + (relevantDocuments.length * 0.1));
          break;
        case 'documents-irrelevant':
          confidence = 0.6;
          break;
        case 'no-documents':
          confidence = 0.7;
          break;
        default:
          confidence = 0.5;
      }

    } catch (aiError) {
      console.error(`AI API error (${aiProvider}):`, aiError);
      
      // Enhanced fallback response based on strategy
      aiResponse = `I apologize, but I encountered an error with the ${aiProvider} API. `;
      
      if (responseStrategy === 'documents-first') {
        aiResponse += `I found ${relevantDocuments.length} relevant document(s) that could answer your question: ${relevantDocuments.map(doc => doc.name).join(', ')}. `;
        aiResponse += `Please check your API key configuration and try again.`;
      } else if (responseStrategy === 'documents-irrelevant') {
        aiResponse += `You have ${documents.length} document(s) uploaded, but they don't seem directly relevant to your question. `;
        aiResponse += `Please try rephrasing your question or uploading more relevant documents.`;
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
      confidence,
      responseTime,
      sources: sources.length > 0 ? sources : undefined
    };

    console.log(`Response generated in ${responseTime}ms`);
    console.log(`Strategy used: ${responseStrategy}`);
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
