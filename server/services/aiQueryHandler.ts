import OpenAI from 'openai';
import { semanticSearchService, SearchResult } from './semanticSearch';
import { getAllDocuments, getDocumentsByTags, searchDocuments } from '../database';

export interface AIQueryRequest {
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
  useSemanticSearch?: boolean;
  maxResults?: number;
  sessionId?: string;
  userId?: string;
}

export interface AIQueryResponse {
  response: string;
  documentsUsed: string[];
  searchResults?: SearchResult[];
  confidence: number;
  responseTime: number;
  sources: string[];
  metadata: {
    totalDocuments: number;
    semanticSearchUsed: boolean;
    webSearchUsed: boolean;
    processingTime: number;
  };
}

export class AIQueryHandler {
  private openai: OpenAI;
  private readonly DEFAULT_MAX_RESULTS = 5;
  private readonly DEFAULT_CONFIDENCE_THRESHOLD = 0.7;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is required for AI query handling');
    }
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Process an AI query with document context
   */
  async processQuery(request: AIQueryRequest): Promise<AIQueryResponse> {
    const startTime = Date.now();
    
    try {
      console.log(`Processing AI query: "${request.message}"`);
      
      // Step 1: Gather relevant document content
      const documentContext = await this.gatherDocumentContext(request);
      
      // Step 2: Perform semantic search if enabled
      let semanticResults: SearchResult[] = [];
      if (request.useSemanticSearch !== false) {
        semanticResults = await this.performSemanticSearch(request.message, documentContext);
      }
      
      // Step 3: Generate AI response
      const aiResponse = await this.generateAIResponse(request, documentContext, semanticResults);
      
      const responseTime = Date.now() - startTime;
      
      return {
        response: aiResponse.response,
        documentsUsed: aiResponse.documentsUsed,
        searchResults: semanticResults,
        confidence: aiResponse.confidence,
        responseTime,
        sources: aiResponse.sources,
        metadata: {
          totalDocuments: documentContext.length,
          semanticSearchUsed: semanticResults.length > 0,
          webSearchUsed: request.searchWeb || false,
          processingTime: responseTime
        }
      };
      
    } catch (error) {
      console.error('AI query processing error:', error);
      throw new Error(`Query processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gather relevant document content for the query
   */
  private async gatherDocumentContext(request: AIQueryRequest): Promise<Array<{
    name: string;
    content: string;
    summary: string;
    tags: string[];
  }>> {
    const context: Array<{
      name: string;
      content: string;
      summary: string;
      tags: string[];
    }> = [];

    try {
      // Use provided documents if available
      if (request.documents && request.documents.length > 0) {
        console.log(`Using ${request.documents.length} provided documents`);
        request.documents.forEach(doc => {
          context.push({
            name: doc.name,
            content: doc.content,
            summary: doc.summary,
            tags: []
          });
        });
        return context;
      }

      // Otherwise, fetch from database
      console.log('Fetching documents from database');
      const allDocuments = await getAllDocuments();
      
      // Filter by session if provided
      let relevantDocuments = allDocuments;
      if (request.sessionId) {
        relevantDocuments = allDocuments.filter(doc => doc.sessionId === request.sessionId);
        console.log(`Filtered to ${relevantDocuments.length} documents for session ${request.sessionId}`);
      }

      // Convert to context format
      relevantDocuments.forEach(doc => {
        if (doc.processed && doc.content) {
          context.push({
            name: doc.name,
            content: doc.content,
            summary: doc.summary,
            tags: doc.tags || []
          });
        }
      });

      console.log(`Gathered ${context.length} documents for context`);
      return context;

    } catch (error) {
      console.error('Error gathering document context:', error);
      return context;
    }
  }

  /**
   * Perform semantic search on available documents
   */
  private async performSemanticSearch(
    query: string, 
    documentContext: Array<{ name: string; content: string; summary: string; tags: string[] }>
  ): Promise<SearchResult[]> {
    try {
      console.log('Performing semantic search');
      
      const searchResults = await semanticSearchService.search(query, {
        maxResults: this.DEFAULT_MAX_RESULTS,
        similarityThreshold: this.DEFAULT_CONFIDENCE_THRESHOLD
      });

      console.log(`Semantic search found ${searchResults.length} relevant results`);
      return searchResults;

    } catch (error) {
      console.error('Semantic search error:', error);
      return [];
    }
  }

  /**
   * Generate AI response using OpenAI
   */
  private async generateAIResponse(
    request: AIQueryRequest,
    documentContext: Array<{ name: string; content: string; summary: string; tags: string[] }>,
    semanticResults: SearchResult[]
  ): Promise<{
    response: string;
    documentsUsed: string[];
    confidence: number;
    sources: string[];
  }> {
    try {
      // Build system message with document context
      const systemMessage = this.buildSystemMessage(documentContext, semanticResults);
      
      // Build user message with query and history
      const userMessage = this.buildUserMessage(request);
      
      // Prepare messages for OpenAI
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemMessage }
      ];

      // Add chat history if available
      if (request.history && request.history.length > 0) {
        // Limit history to last 10 messages to avoid token limits
        const recentHistory = request.history.slice(-10);
        recentHistory.forEach(msg => {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        });
      }

      messages.push({ role: 'user', content: userMessage });

      console.log('Sending request to OpenAI');
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages,
        max_tokens: 2000,
        temperature: 0.7,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      });

      const response = completion.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';
      
      // Extract documents used from response
      const documentsUsed = this.extractDocumentsUsed(response, documentContext, semanticResults);
      
      // Calculate confidence based on document usage and semantic search results
      const confidence = this.calculateConfidence(documentContext, semanticResults, documentsUsed);
      
      // Extract sources
      const sources = this.extractSources(documentContext, semanticResults);

      return {
        response,
        documentsUsed,
        confidence,
        sources
      };

    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`AI response generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build system message with document context
   */
  private buildSystemMessage(
    documentContext: Array<{ name: string; content: string; summary: string; tags: string[] }>,
    semanticResults: SearchResult[]
  ): string {
    let systemMessage = `You are an intelligent research assistant that helps users understand and analyze documents. 

IMPORTANT INSTRUCTIONS:
1. Base your responses primarily on the provided document content
2. If the documents contain relevant information, use that as your primary source
3. Be specific and cite which documents you're referencing
4. If you're unsure about something, say so rather than making assumptions
5. Provide clear, well-structured responses
6. Use markdown formatting for better readability

`;

    // Add document context
    if (documentContext.length > 0) {
      systemMessage += `\nAVAILABLE DOCUMENTS (${documentContext.length} total):\n`;
      documentContext.forEach((doc, index) => {
        systemMessage += `\nDocument ${index + 1}: ${doc.name}\n`;
        systemMessage += `Summary: ${doc.summary}\n`;
        systemMessage += `Content Preview: ${doc.content.substring(0, 500)}...\n`;
        if (doc.tags.length > 0) {
          systemMessage += `Tags: ${doc.tags.join(', ')}\n`;
        }
      });
    }

    // Add semantic search results if available
    if (semanticResults.length > 0) {
      systemMessage += `\nSEMANTIC SEARCH RESULTS (most relevant content):\n`;
      semanticResults.forEach((result, index) => {
        systemMessage += `\nResult ${index + 1} (${result.metadata.documentName}):\n`;
        systemMessage += `Relevance: ${(result.similarity * 100).toFixed(1)}%\n`;
        systemMessage += `Content: ${result.content.substring(0, 300)}...\n`;
      });
    }

    systemMessage += `\nRESPONSE GUIDELINES:
- Always reference specific documents when possible
- Use the format "According to [Document Name]..." when citing sources
- If multiple documents contain relevant information, mention all of them
- If no documents contain relevant information, clearly state this
- Provide actionable insights and analysis when appropriate`;

    return systemMessage;
  }

  /**
   * Build user message with query
   */
  private buildUserMessage(request: AIQueryRequest): string {
    let userMessage = `User Question: ${request.message}\n\n`;
    
    if (request.searchWeb) {
      userMessage += `Note: You may also use web search results to supplement your response if the documents don't contain sufficient information.\n\n`;
    }
    
    userMessage += `Please provide a comprehensive answer based on the available documents and any other relevant information.`;
    
    return userMessage;
  }

  /**
   * Extract which documents were used in the response
   */
  private extractDocumentsUsed(
    response: string,
    documentContext: Array<{ name: string; content: string; summary: string; tags: string[] }>,
    semanticResults: SearchResult[]
  ): string[] {
    const documentsUsed: string[] = [];
    
    // Check for document references in the response
    documentContext.forEach(doc => {
      if (response.toLowerCase().includes(doc.name.toLowerCase()) ||
          response.toLowerCase().includes(doc.summary.toLowerCase().substring(0, 50))) {
        documentsUsed.push(doc.name);
      }
    });

    // Add documents from semantic search results
    semanticResults.forEach(result => {
      if (!documentsUsed.includes(result.metadata.documentName)) {
        documentsUsed.push(result.metadata.documentName);
      }
    });

    return documentsUsed;
  }

  /**
   * Calculate confidence score for the response
   */
  private calculateConfidence(
    documentContext: Array<{ name: string; content: string; summary: string; tags: string[] }>,
    semanticResults: SearchResult[],
    documentsUsed: string[]
  ): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence if documents are available
    if (documentContext.length > 0) {
      confidence += 0.2;
    }

    // Increase confidence if semantic search found relevant results
    if (semanticResults.length > 0) {
      const avgSimilarity = semanticResults.reduce((sum, result) => sum + result.similarity, 0) / semanticResults.length;
      confidence += avgSimilarity * 0.2;
    }

    // Increase confidence if documents were actually used
    if (documentsUsed.length > 0) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Extract sources for the response
   */
  private extractSources(
    documentContext: Array<{ name: string; content: string; summary: string; tags: string[] }>,
    semanticResults: SearchResult[]
  ): string[] {
    const sources: string[] = [];

    // Add document sources
    documentContext.forEach(doc => {
      sources.push(doc.name);
    });

    // Add semantic search sources
    semanticResults.forEach(result => {
      if (!sources.includes(result.metadata.documentName)) {
        sources.push(result.metadata.documentName);
      }
    });

    return sources;
  }

  /**
   * Search documents by tags
   */
  async searchByTags(tags: string[]): Promise<Array<{
    name: string;
    content: string;
    summary: string;
    tags: string[];
  }>> {
    try {
      const documents = await getDocumentsByTags(tags);
      
      return documents.map(doc => ({
        name: doc.name,
        content: doc.content,
        summary: doc.summary,
        tags: doc.tags || []
      }));
    } catch (error) {
      console.error('Error searching documents by tags:', error);
      return [];
    }
  }

  /**
   * Perform full-text search on documents
   */
  async searchDocuments(query: string): Promise<Array<{
    name: string;
    content: string;
    summary: string;
    tags: string[];
  }>> {
    try {
      const documents = await searchDocuments(query);
      
      return documents.map(doc => ({
        name: doc.name,
        content: doc.content,
        summary: doc.summary,
        tags: doc.tags || []
      }));
    } catch (error) {
      console.error('Error searching documents:', error);
      return [];
    }
  }

  /**
   * Get semantic search statistics
   */
  getSearchStats(): {
    totalDocuments: number;
    totalEmbeddings: number;
    totalChunks: number;
  } {
    return semanticSearchService.getIndexStats();
  }
}

// Export singleton instance
export const aiQueryHandler = new AIQueryHandler();
