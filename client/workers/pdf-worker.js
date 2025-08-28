// PDF Worker for handling large PDF files
// This worker runs in a separate thread to prevent UI blocking

// Simple PDF text extraction fallback (no external dependencies)
class SimplePDFProcessor {
  static async extractText(arrayBuffer) {
    try {
      // For now, return a placeholder since we can't use external PDF.js
      // In a real implementation, you would either:
      // 1. Bundle PDF.js locally
      // 2. Use a server-side PDF processing service
      // 3. Use a different PDF library
      
      return {
        success: false,
        error: 'PDF processing requires local PDF.js library. Please upload text files or contact support.',
        text: '',
        pages: 0
      };
    } catch (error) {
      return {
        success: false,
        error: `PDF processing failed: ${error.message}`,
        text: '',
        pages: 0
      };
    }
  }
}

// Text indexing for search
class TextIndexer {
  constructor() {
    this.index = new Map();
    this.documents = [];
  }

  addDocument(id, title, content) {
    const words = this.tokenize(content);
    const doc = { id, title, content, wordCount: words.length };
    
    words.forEach((word, position) => {
      if (!this.index.has(word)) {
        this.index.set(word, []);
      }
      this.index.get(word).push({ docId: id, position });
    });
    
    this.documents.push(doc);
  }

  tokenize(text) {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  search(query, limit = 10) {
    const queryWords = this.tokenize(query);
    const scores = new Map();
    
    queryWords.forEach(word => {
      const matches = this.index.get(word) || [];
      matches.forEach(match => {
        const currentScore = scores.get(match.docId) || 0;
        scores.set(match.docId, currentScore + 1);
      });
    });
    
    return Array.from(scores.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([docId, score]) => {
        const doc = this.documents.find(d => d.id === docId);
        return {
          id: docId,
          title: doc.title,
          content: doc.content,
          score: score / queryWords.length
        };
      });
  }
}

// Worker message handling
const textIndexer = new TextIndexer();

self.onmessage = async function(e) {
  const { type, data } = e.data;
  
  try {
    switch (type) {
      case 'processPDF':
        const result = await SimplePDFProcessor.extractText(data.arrayBuffer);
        self.postMessage({
          type: 'pdfProcessed',
          data: result
        });
        break;
        
      case 'indexText':
        textIndexer.addDocument(data.id, data.title, data.content);
        self.postMessage({
          type: 'textIndexed',
          data: { id: data.id, wordCount: textIndexer.documents.length }
        });
        break;
        
      case 'searchText':
        const searchResults = textIndexer.search(data.query, data.limit || 10);
        self.postMessage({
          type: 'searchResults',
          data: searchResults
        });
        break;
        
      case 'getStats':
        self.postMessage({
          type: 'stats',
          data: {
            documentsCount: textIndexer.documents.length,
            indexSize: textIndexer.index.size,
            totalWords: textIndexer.documents.reduce((sum, doc) => sum + doc.wordCount, 0)
          }
        });
        break;
        
      default:
        self.postMessage({
          type: 'error',
          data: { error: `Unknown message type: ${type}` }
        });
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      data: { error: error.message }
    });
  }
};
