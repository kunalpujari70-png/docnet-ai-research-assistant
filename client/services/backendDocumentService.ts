// Backend Document Processing Service for Frontend
// Interfaces with the backend document processing API to offload heavy operations
// This prevents frontend unresponsiveness by moving document processing to the server

interface DocumentProcessingRequest {
  filePath: string;
  documentId: string;
  documentName: string;
}

interface DocumentSearchRequest {
  query: string;
  documentIds?: string[];
}

interface DocumentChunk {
  id: string;
  content: string;
  pageNum?: number;
  wordCount: number;
  relevanceScore: number;
  matches: string[];
}

interface SearchResult {
  documentId: string;
  documentName: string;
  totalRelevanceScore: number;
  chunks: DocumentChunk[];
}

interface DocumentStats {
  totalChunks: number;
  totalWords: number;
  totalPages: number;
  indexedAt: Date;
}

interface MemoryStats {
  totalDocuments: number;
  totalChunks: number;
  totalWords: number;
  processingQueueSize: number;
}

class BackendDocumentService {
  private baseUrl: string;
  private processingQueue = new Map<string, Promise<any>>();

  constructor() {
    // Use the same base URL as other API services
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://karmic-aiportal.netlify.app' 
      : 'http://localhost:3001';
  }

  // Process and index a document on the backend
  async processDocument(filePath: string, documentId: string, documentName: string): Promise<any> {
    // Check if already processing
    if (this.processingQueue.has(documentId)) {
      return this.processingQueue.get(documentId)!;
    }

    const processingPromise = this.performDocumentProcessing(filePath, documentId, documentName);
    this.processingQueue.set(documentId, processingPromise);

    try {
      const result = await processingPromise;
      return result;
    } finally {
      this.processingQueue.delete(documentId);
    }
  }

  private async performDocumentProcessing(filePath: string, documentId: string, documentName: string): Promise<any> {
    const request: DocumentProcessingRequest = {
      filePath,
      documentId,
      documentName
    };

    const response = await fetch(`${this.baseUrl}/api/documents/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Document processing failed');
    }

    const result = await response.json();
    return result.documentIndex;
  }

  // Search documents on the backend
  async searchDocuments(query: string, documentIds?: string[]): Promise<SearchResult[]> {
    const request: DocumentSearchRequest = {
      query,
      documentIds
    };

    const response = await fetch(`${this.baseUrl}/api/documents/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Document search failed');
    }

    const result = await response.json();
    return result.results;
  }

  // Get document statistics
  async getDocumentStats(documentId: string): Promise<DocumentStats | null> {
    const response = await fetch(`${this.baseUrl}/api/documents/${documentId}/stats`);

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Document not found
      }
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get document statistics');
    }

    const result = await response.json();
    return result.stats;
  }

  // Get memory usage statistics
  async getMemoryStats(): Promise<MemoryStats> {
    const response = await fetch(`${this.baseUrl}/api/documents/memory-stats`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get memory statistics');
    }

    const result = await response.json();
    return result.stats;
  }

  // Clear document from memory
  async clearDocument(documentId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/documents/${documentId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to clear document');
    }
  }

  // Batch process multiple documents
  async batchProcessDocuments(documents: DocumentProcessingRequest[]): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/documents/batch-process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documents })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Batch document processing failed');
    }

    const result = await response.json();
    return result;
  }

  // Enhanced document search with fallback to frontend processing
  async searchDocumentsWithFallback(query: string, documents: any[], documentIds?: string[]): Promise<any[]> {
    try {
      // Try backend search first
      const backendResults = await this.searchDocuments(query, documentIds);
      
      if (backendResults.length > 0) {
        console.log(`Backend search found ${backendResults.length} results`);
        return this.formatBackendResults(backendResults);
      }

      // Fallback to frontend processing if no backend results
      console.log('No backend results, falling back to frontend processing');
      return this.fallbackFrontendSearch(query, documents);

    } catch (error) {
      console.warn('Backend search failed, falling back to frontend processing:', error);
      return this.fallbackFrontendSearch(query, documents);
    }
  }

  private formatBackendResults(backendResults: SearchResult[]): any[] {
    return backendResults.map(result => ({
      name: result.documentName,
      content: result.chunks.map(chunk => chunk.content).join('\n\n'),
      summary: `Found ${result.chunks.length} relevant chunks with relevance score ${result.totalRelevanceScore}`,
      relevanceScore: result.totalRelevanceScore,
      isRelevant: result.totalRelevanceScore > 5,
      matchDetails: {
        chunks: result.chunks.length,
        totalScore: result.totalRelevanceScore,
        matches: result.chunks.flatMap(chunk => chunk.matches)
      }
    }));
  }

  private fallbackFrontendSearch(query: string, documents: any[]): any[] {
    // Simple frontend search as fallback
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 1);
    
    return documents.map(doc => {
      const contentLower = doc.content.toLowerCase();
      let relevanceScore = 0;
      
      if (contentLower.includes(queryLower)) {
        relevanceScore += 20;
      }
      
      for (const word of queryWords) {
        if (contentLower.includes(word)) {
          relevanceScore += 3;
        }
      }
      
      return {
        ...doc,
        relevanceScore,
        isRelevant: relevanceScore >= 2
      };
    }).filter(doc => doc.isRelevant)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 5);
  }

  // Check if backend service is available
  async isBackendAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ping`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      return response.ok;
    } catch (error) {
      console.warn('Backend service not available:', error);
      return false;
    }
  }

  // Get processing queue status
  getProcessingQueueStatus(): { size: number; documents: string[] } {
    return {
      size: this.processingQueue.size,
      documents: Array.from(this.processingQueue.keys())
    };
  }
}

export const backendDocumentService = new BackendDocumentService();
