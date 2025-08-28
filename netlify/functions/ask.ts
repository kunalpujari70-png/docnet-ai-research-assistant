import { Handler } from '@netlify/functions';
import OpenAI from 'openai';

interface AskRequest {
  query: string;
  userId: string;
  sessionId?: string;
  webSearch?: boolean;
  aiProvider?: 'openai' | 'gemini';
}

interface AskResponse {
  answer: string;
  sources: {
    documents: DocumentSource[];
    web: WebSource[];
  };
  evidenceType: 'documents' | 'web' | 'mixed';
  confidence: number;
  responseTime: number;
  noDocEvidence?: boolean;
}

interface DocumentSource {
  id: string;
  title: string;
  chunk: string;
  relevance: number;
  chunkId: string;
}

interface WebSource {
  title: string;
  snippet: string;
  url: string;
  source: string;
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

// Mock Supabase client for now (replace with real Supabase when configured)
class MockSupabaseClient {
  static async searchDocuments(query: string, userId: string, topK: number = 6): Promise<DocumentSource[]> {
    // Simulate vector search with mock data
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const mockDocuments = [
      {
        id: 'doc-1',
        title: 'Research Paper on AI',
        chunk: 'Artificial intelligence has revolutionized various industries including healthcare, finance, and transportation. Machine learning algorithms can now process vast amounts of data to identify patterns and make predictions.',
        relevance: 0.85,
        chunkId: 'chunk-1'
      },
      {
        id: 'doc-2', 
        title: 'Technology Trends Report',
        chunk: 'The latest trends in technology include cloud computing, edge computing, and the Internet of Things. These technologies are driving digital transformation across organizations.',
        relevance: 0.72,
        chunkId: 'chunk-2'
      }
    ];
    
    // Filter by relevance threshold (0.75)
    return mockDocuments.filter(doc => doc.relevance >= 0.75);
  }
  
  static async getDocumentChunks(documentId: string): Promise<string[]> {
    // Mock document chunks
    return [
      'This is the first chunk of the document containing key information.',
      'Second chunk with additional details and context.',
      'Final chunk with conclusions and recommendations.'
    ];
  }
}

// Web search function using DuckDuckGo
async function performWebSearch(query: string): Promise<WebSource[]> {
  try {
    console.log(`Performing web search for: ${query}`);
    
    const timeoutPromise = new Promise<WebSource[]>((_, reject) => {
      setTimeout(() => reject(new Error('Web search timeout')), 10000);
    });
    
    const searchPromise = (async () => {
      const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      
      const response = await fetch(searchUrl);
      const data = await response.json();
      
      const results: WebSource[] = [];
      
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
    
    return await Promise.race([searchPromise, timeoutPromise]);
  } catch (error) {
    console.error('Web search error:', error);
    return [];
  }
}

// Generate AI response with RAG pipeline
async function generateRAGResponse(
  query: string, 
  documentSources: DocumentSource[], 
  webSources: WebSource[],
  aiProvider: string = 'openai'
): Promise<{ answer: string; confidence: number }> {
  try {
    const client = getOpenAIClient();
    
    // Build context from documents and web sources
    let context = '';
    let evidenceType: 'documents' | 'web' | 'mixed' = 'web';
    
    if (documentSources.length > 0) {
      context += 'DOCUMENT EVIDENCE:\n';
      documentSources.forEach((doc, index) => {
        context += `[Document ${index + 1}: ${doc.title}]\n`;
        context += `${doc.chunk}\n\n`;
      });
      evidenceType = webSources.length > 0 ? 'mixed' : 'documents';
    }
    
    if (webSources.length > 0) {
      context += 'WEB SEARCH RESULTS:\n';
      webSources.forEach((web, index) => {
        context += `[Web Source ${index + 1}: ${web.title}]\n`;
        context += `${web.snippet}\n`;
        context += `URL: ${web.url}\n\n`;
      });
      if (documentSources.length === 0) {
        evidenceType = 'web';
      }
    }
    
    // Build the prompt based on available evidence
    let systemPrompt = '';
    if (documentSources.length > 0) {
      systemPrompt = `You are a helpful AI assistant. Answer the user's question based on the provided document evidence. If the documents contain relevant information, use it as your primary source. If web search results are also provided, you may use them to supplement your answer. Always cite your sources clearly.

CRITICAL INSTRUCTIONS:
- Prioritize information from the uploaded documents
- Cite specific documents when using their information
- If web sources are provided, mention them as additional context
- Be accurate and helpful in your response
- If you cannot answer based on the provided sources, say so clearly`;
    } else {
      systemPrompt = `You are a helpful AI assistant. Answer the user's question based on the provided web search results. Be accurate and helpful in your response. If you cannot answer based on the provided sources, say so clearly.`;
    }
    
    const userPrompt = `Question: ${query}

${context}

Please provide a comprehensive answer based on the available evidence. If using document sources, cite them clearly. If using web sources, mention them as additional context.`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const answer = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';
    
    // Calculate confidence based on evidence quality
    let confidence = 0.5;
    if (documentSources.length > 0) {
      confidence = Math.min(0.9, 0.6 + (documentSources.length * 0.1));
    }
    if (webSources.length > 0) {
      confidence = Math.min(0.9, confidence + 0.2);
    }
    
    return { answer, confidence };
  } catch (error) {
    console.error('AI response generation error:', error);
    throw error;
  }
}

export const handler: Handler = async (event) => {
  const startTime = Date.now();
  
  try {
    // Parse request
    if (!event.body) {
      throw new Error('Request body is required');
    }
    
    const request: AskRequest = JSON.parse(event.body);
    const { query, userId, webSearch = true, aiProvider = 'openai' } = request;
    
    if (!query || !userId) {
      throw new Error('Query and userId are required');
    }
    
    console.log(`RAG request received:`, { query, userId, webSearch, aiProvider });
    
    // Step 1: Search documents using vector similarity
    console.log('Step 1: Searching documents...');
    const documentSources = await MockSupabaseClient.searchDocuments(query, userId, 6);
    console.log(`Found ${documentSources.length} relevant document chunks`);
    
    // Step 2: Determine if we need web search
    let webSources: WebSource[] = [];
    let noDocEvidence = false;
    
    if (documentSources.length === 0) {
      noDocEvidence = true;
      console.log('No relevant documents found, marking noDocEvidence=true');
    }
    
    if (webSearch && (documentSources.length === 0 || documentSources.length < 3)) {
      console.log('Step 2: Performing web search...');
      webSources = await performWebSearch(query);
      console.log(`Found ${webSources.length} web search results`);
    }
    
    // Step 3: Generate AI response
    console.log('Step 3: Generating AI response...');
    const { answer, confidence } = await generateRAGResponse(query, documentSources, webSources, aiProvider);
    
    // Step 4: Determine evidence type
    let evidenceType: 'documents' | 'web' | 'mixed' = 'web';
    if (documentSources.length > 0 && webSources.length === 0) {
      evidenceType = 'documents';
    } else if (documentSources.length > 0 && webSources.length > 0) {
      evidenceType = 'mixed';
    }
    
    const responseTime = Date.now() - startTime;
    
    const result: AskResponse = {
      answer,
      sources: {
        documents: documentSources,
        web: webSources
      },
      evidenceType,
      confidence,
      responseTime,
      noDocEvidence
    };
    
    console.log(`RAG response generated in ${responseTime}ms`);
    console.log(`Evidence type: ${evidenceType}, Confidence: ${confidence}`);
    console.log(`Documents used: ${documentSources.length}, Web sources: ${webSources.length}`);
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result),
    };
    
  } catch (error) {
    console.error('RAG API Error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        answer: 'I apologize, but I encountered an error processing your request. Please try again.',
        responseTime: Date.now() - startTime
      }),
    };
  }
};
