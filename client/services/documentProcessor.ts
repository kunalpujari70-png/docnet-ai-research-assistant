// Document processing service using Web Workers
class DocumentProcessor {
  private worker: Worker | null = null;
  private isInitialized = false;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    try {
      this.worker = new Worker('/client/workers/document-worker.js');
      this.isInitialized = true;
      
      // Handle worker errors
      this.worker.onerror = (error) => {
        console.error('Document worker error:', error);
        this.isInitialized = false;
      };
    } catch (error) {
      console.error('Failed to initialize document worker:', error);
      this.isInitialized = false;
    }
  }

  // Process documents using Web Worker
  async processDocuments(documents: any[], query: string, onProgress?: (progress: number) => void): Promise<any[]> {
    if (!this.isInitialized || !this.worker) {
      console.warn('Web Worker not available, falling back to synchronous processing');
      return this.processDocumentsSync(documents, query);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Document processing timeout'));
      }, 30000); // 30 second timeout

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
            this.worker?.removeEventListener('message', messageHandler);
            if (success) {
              resolve(data.results);
            } else {
              reject(new Error(error || 'Document processing failed'));
            }
            break;

          case 'error':
            clearTimeout(timeout);
            this.worker?.removeEventListener('message', messageHandler);
            reject(new Error(error || 'Document processing error'));
            break;
        }
      };

      this.worker.addEventListener('message', messageHandler);
      this.worker.postMessage({
        type: 'analyzeDocuments',
        data: { documents, query }
      });
    });
  }

  // Fallback synchronous processing
  private processDocumentsSync(documents: any[], query: string): any[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 1);
    
    const results = documents.map(doc => {
      const contentLower = doc.content.toLowerCase();
      let relevanceScore = 0;
      
      // Calculate relevance score
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

  // Process a single document
  async processDocument(content: string, query: string, onProgress?: (progress: number) => void): Promise<any[]> {
    if (!this.isInitialized || !this.worker) {
      return this.processDocumentSync(content, query);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Document processing timeout'));
      }, 15000); // 15 second timeout

      const messageHandler = (event: MessageEvent) => {
        const { type, data, success, error } = event.data;

        switch (type) {
          case 'progress':
            if (onProgress) {
              onProgress(data.percentage);
            }
            break;

          case 'documentProcessed':
            clearTimeout(timeout);
            this.worker?.removeEventListener('message', messageHandler);
            if (success) {
              resolve(data.results);
            } else {
              reject(new Error(error || 'Document processing failed'));
            }
            break;

          case 'error':
            clearTimeout(timeout);
            this.worker?.removeEventListener('message', messageHandler);
            reject(new Error(error || 'Document processing error'));
            break;
        }
      };

      this.worker.addEventListener('message', messageHandler);
      this.worker.postMessage({
        type: 'processDocument',
        data: { content, query }
      });
    });
  }

  // Fallback synchronous single document processing
  private processDocumentSync(content: string, query: string): any[] {
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    let relevanceScore = 0;
    
    if (contentLower.includes(queryLower)) {
      relevanceScore += 20;
    }
    
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 1);
    for (const word of queryWords) {
      if (contentLower.includes(word)) {
        relevanceScore += 3;
      }
    }
    
    return [{
      content,
      relevanceScore,
      isRelevant: relevanceScore >= 2
    }];
  }

  // Cleanup
  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isInitialized = false;
  }
}

export const documentProcessor = new DocumentProcessor();
