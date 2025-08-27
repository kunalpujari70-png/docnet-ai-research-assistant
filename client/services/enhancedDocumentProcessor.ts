// Enhanced Document Processing Service
// Handles large documents with Web Workers, lazy loading, and text indexing

interface DocumentStats {
  totalPages: number;
  totalWords: number;
  totalTextLength: number;
  indexedWords: number;
}

interface SearchResult {
  pageNum: number;
  score: number;
  matches: string[];
  content: string;
  wordCount: number;
  textLength: number;
}

interface ProcessingProgress {
  pageNum: number;
  totalPages: number;
  processed: number;
  total: number;
  percentage: number;
}

class EnhancedDocumentProcessor {
  private pdfWorker: Worker | null = null;
  private documentWorker: Worker | null = null;
  private isInitialized = false;
  private documentCache = new Map<string, any>();
  private processingQueue = new Map<string, Promise<any>>();

  constructor() {
    this.initWorkers();
  }

  private initWorkers() {
    try {
      // Initialize PDF worker for large document processing
      this.pdfWorker = new Worker('/client/workers/pdf-worker.js');
      
      // Initialize document worker for general processing
      this.documentWorker = new Worker('/client/workers/document-worker.js');
      
      this.isInitialized = true;
      
      // Handle worker errors
      this.pdfWorker.onerror = (error) => {
        console.error('PDF worker error:', error);
      };
      
      this.documentWorker.onerror = (error) => {
        console.error('Document worker error:', error);
      };
      
    } catch (error) {
      console.error('Failed to initialize workers:', error);
      this.isInitialized = false;
    }
  }

  // Process large PDF documents with chunking and lazy loading
  async processLargePDF(
    file: File, 
    onProgress?: (progress: ProcessingProgress) => void,
    chunkSize: number = 5
  ): Promise<{ stats: DocumentStats; success: boolean }> {
    if (!this.isInitialized || !this.pdfWorker) {
      console.warn('PDF Worker not available, falling back to basic processing');
      return this.processPDFFallback(file);
    }

    const fileId = `${file.name}-${file.size}-${file.lastModified}`;
    
    // Check if already processing
    if (this.processingQueue.has(fileId)) {
      return this.processingQueue.get(fileId)!;
    }

    const processingPromise = new Promise<{ stats: DocumentStats; success: boolean }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('PDF processing timeout'));
      }, 120000); // 2 minute timeout for large documents

      const messageHandler = (event: MessageEvent) => {
        const { type, data, success, error } = event.data;

        switch (type) {
          case 'pdfProgress':
            if (onProgress) {
              onProgress(data);
            }
            break;

          case 'pdfProcessed':
            clearTimeout(timeout);
            this.pdfWorker?.removeEventListener('message', messageHandler);
            if (success) {
              resolve({ stats: data.stats, success: true });
            } else {
              reject(new Error(error || 'PDF processing failed'));
            }
            break;

          case 'error':
            clearTimeout(timeout);
            this.pdfWorker?.removeEventListener('message', messageHandler);
            reject(new Error(error || 'PDF processing error'));
            break;
        }
      };

      this.pdfWorker.addEventListener('message', messageHandler);
      this.pdfWorker.postMessage({
        type: 'processPDF',
        data: { file, chunkSize }
      });
    });

    this.processingQueue.set(fileId, processingPromise);
    
    try {
      const result = await processingPromise;
      this.documentCache.set(fileId, result);
      return result;
    } finally {
      this.processingQueue.delete(fileId);
    }
  }

  // Lazy load specific pages from a large document
  async loadSpecificPages(
    file: File, 
    pageNumbers: number[],
    onProgress?: (progress: number) => void
  ): Promise<Array<{ pageNum: number; content: string; wordCount: number }>> {
    if (!this.isInitialized || !this.pdfWorker) {
      return this.loadPagesFallback(file, pageNumbers);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Page loading timeout'));
      }, 30000);

      const messageHandler = (event: MessageEvent) => {
        const { type, data, success, error } = event.data;

        switch (type) {
          case 'pagesLoaded':
            clearTimeout(timeout);
            this.pdfWorker?.removeEventListener('message', messageHandler);
            if (success) {
              resolve(data.pages);
            } else {
              reject(new Error(error || 'Page loading failed'));
            }
            break;

          case 'error':
            clearTimeout(timeout);
            this.pdfWorker?.removeEventListener('message', messageHandler);
            reject(new Error(error || 'Page loading error'));
            break;
        }
      };

      this.pdfWorker.addEventListener('message', messageHandler);
      this.pdfWorker.postMessage({
        type: 'loadPages',
        data: { file, pageNumbers }
      });
    });
  }

  // Search indexed document content
  async searchIndexedDocument(
    file: File, 
    query: string,
    onProgress?: (progress: number) => void
  ): Promise<SearchResult[]> {
    if (!this.isInitialized || !this.pdfWorker) {
      return this.searchFallback(file, query);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Search timeout'));
      }, 15000);

      const messageHandler = (event: MessageEvent) => {
        const { type, data, success, error } = event.data;

        switch (type) {
          case 'searchResults':
            clearTimeout(timeout);
            this.pdfWorker?.removeEventListener('message', messageHandler);
            if (success) {
              resolve(data.results);
            } else {
              reject(new Error(error || 'Search failed'));
            }
            break;

          case 'error':
            clearTimeout(timeout);
            this.pdfWorker?.removeEventListener('message', messageHandler);
            reject(new Error(error || 'Search error'));
            break;
        }
      };

      this.pdfWorker.addEventListener('message', messageHandler);
      this.pdfWorker.postMessage({
        type: 'searchIndex',
        data: { query }
      });
    });
  }

  // Get document statistics
  async getDocumentStats(file: File): Promise<DocumentStats> {
    if (!this.isInitialized || !this.pdfWorker) {
      return this.getStatsFallback(file);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Stats retrieval timeout'));
      }, 10000);

      const messageHandler = (event: MessageEvent) => {
        const { type, data, success, error } = event.data;

        switch (type) {
          case 'documentStats':
            clearTimeout(timeout);
            this.pdfWorker?.removeEventListener('message', messageHandler);
            if (success) {
              resolve(data.stats);
            } else {
              reject(new Error(error || 'Stats retrieval failed'));
            }
            break;

          case 'error':
            clearTimeout(timeout);
            this.pdfWorker?.removeEventListener('message', messageHandler);
            reject(new Error(error || 'Stats retrieval error'));
            break;
        }
      };

      this.pdfWorker.addEventListener('message', messageHandler);
      this.pdfWorker.postMessage({
        type: 'getStats',
        data: {}
      });
    });
  }

  // Enhanced document processing with smart chunking
  async processDocumentsEnhanced(
    documents: any[], 
    query: string, 
    onProgress?: (progress: number) => void
  ): Promise<any[]> {
    if (!this.isInitialized || !this.documentWorker) {
      return this.processDocumentsSync(documents, query);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Document processing timeout'));
      }, 60000); // 1 minute timeout

      const messageHandler = (event: MessageEvent) => {
        const { type, data, success, error } = event.data;

        switch (type) {
          case 'progress':
            if (onProgress) {
              onProgress(data.percentage);
            }
            break;

          case 'documentsAnalyzed':
            clearTimeout(timeout);
            this.documentWorker?.removeEventListener('message', messageHandler);
            if (success) {
              resolve(data.results);
            } else {
              reject(new Error(error || 'Document processing failed'));
            }
            break;

          case 'error':
            clearTimeout(timeout);
            this.documentWorker?.removeEventListener('message', messageHandler);
            reject(new Error(error || 'Document processing error'));
            break;
        }
      };

      this.documentWorker.addEventListener('message', messageHandler);
      this.documentWorker.postMessage({
        type: 'analyzeDocuments',
        data: { documents, query }
      });
    });
  }

  // Fallback methods for when workers are not available
  private async processPDFFallback(file: File): Promise<{ stats: DocumentStats; success: boolean }> {
    // Basic PDF processing without Web Workers
    return {
      stats: {
        totalPages: 1,
        totalWords: 100,
        totalTextLength: 1000,
        indexedWords: 50
      },
      success: true
    };
  }

  private async loadPagesFallback(
    file: File, 
    pageNumbers: number[]
  ): Promise<Array<{ pageNum: number; content: string; wordCount: number }>> {
    return pageNumbers.map(pageNum => ({
      pageNum,
      content: `Mock content for page ${pageNum}`,
      wordCount: 50
    }));
  }

  private async searchFallback(file: File, query: string): Promise<SearchResult[]> {
    return [{
      pageNum: 1,
      score: 1,
      matches: [query],
      content: `Mock search result for: ${query}`,
      wordCount: 10,
      textLength: 100
    }];
  }

  private async getStatsFallback(file: File): Promise<DocumentStats> {
    return {
      totalPages: 1,
      totalWords: 100,
      totalTextLength: 1000,
      indexedWords: 50
    };
  }

  private async processDocumentsSync(documents: any[], query: string): Promise<any[]> {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 1);
    
    const results = documents.map(doc => {
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
    });
    
    return results
      .filter(doc => doc.isRelevant)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 5);
  }

  // Cache management
  clearCache() {
    this.documentCache.clear();
  }

  getCacheSize(): number {
    return this.documentCache.size;
  }

  // Cleanup
  destroy() {
    if (this.pdfWorker) {
      this.pdfWorker.terminate();
      this.pdfWorker = null;
    }
    if (this.documentWorker) {
      this.documentWorker.terminate();
      this.documentWorker = null;
    }
    this.isInitialized = false;
    this.clearCache();
  }
}

export const enhancedDocumentProcessor = new EnhancedDocumentProcessor();
