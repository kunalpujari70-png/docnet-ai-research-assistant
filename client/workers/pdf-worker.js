// PDF Processing Web Worker
// Handles large PDF parsing in background threads with chunking and lazy loading

// PDF.js library for PDF parsing
importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Document processing state
let currentDocument = null;
let documentIndex = null;
let processingQueue = [];

// Text indexing for faster searching
class TextIndexer {
  constructor() {
    this.index = new Map();
    this.pageContent = new Map();
    this.keywordMap = new Map();
  }

  // Index text content for fast searching
  indexText(pageNum, text) {
    const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const pageKey = `page_${pageNum}`;
    
    // Store page content
    this.pageContent.set(pageKey, text);
    
    // Index words with page references
    words.forEach(word => {
      if (!this.keywordMap.has(word)) {
        this.keywordMap.set(word, new Set());
      }
      this.keywordMap.get(word).add(pageKey);
    });
    
    // Store page metadata
    this.index.set(pageKey, {
      pageNum,
      wordCount: words.length,
      textLength: text.length,
      words: new Set(words)
    });
  }

  // Search indexed content
  search(query) {
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const results = [];
    
    // Find pages containing query words
    const relevantPages = new Map();
    
    queryWords.forEach(word => {
      const pages = this.keywordMap.get(word);
      if (pages) {
        pages.forEach(pageKey => {
          if (!relevantPages.has(pageKey)) {
            relevantPages.set(pageKey, { score: 0, matches: [] });
          }
          relevantPages.get(pageKey).score += 1;
          relevantPages.get(pageKey).matches.push(word);
        });
      }
    });
    
    // Convert to results array and sort by relevance
    relevantPages.forEach((data, pageKey) => {
      const pageData = this.index.get(pageKey);
      const content = this.pageContent.get(pageKey);
      
      results.push({
        pageNum: pageData.pageNum,
        score: data.score,
        matches: data.matches,
        content: content.substring(0, 500) + '...',
        wordCount: pageData.wordCount,
        textLength: pageData.textLength
      });
    });
    
    return results.sort((a, b) => b.score - a.score);
  }

  // Get full page content
  getPageContent(pageNum) {
    return this.pageContent.get(`page_${pageNum}`) || '';
  }

  // Get document statistics
  getStats() {
    return {
      totalPages: this.pageContent.size,
      totalWords: Array.from(this.index.values()).reduce((sum, page) => sum + page.wordCount, 0),
      totalTextLength: Array.from(this.index.values()).reduce((sum, page) => sum + page.textLength, 0),
      indexedWords: this.keywordMap.size
    };
  }
}

// PDF processing functions
async function processPDFChunk(file, startPage, endPage, chunkSize = 5) {
  const indexer = new TextIndexer();
  const results = [];
  
  try {
    // Load PDF document
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const totalPages = Math.min(endPage, pdf.numPages);
    const pagesToProcess = Math.min(chunkSize, totalPages - startPage + 1);
    
    // Process pages in chunks
    for (let i = 0; i < pagesToProcess; i++) {
      const pageNum = startPage + i;
      
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const text = textContent.items.map(item => item.str).join(' ');
        
        // Index the text
        indexer.indexText(pageNum, text);
        
        // Report progress
        self.postMessage({
          type: 'pdfProgress',
          data: {
            pageNum,
            totalPages: pdf.numPages,
            processed: i + 1,
            total: pagesToProcess,
            percentage: Math.round(((i + 1) / pagesToProcess) * 100)
          }
        });
        
        // Yield control to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 10));
        
      } catch (error) {
        console.error(`Error processing page ${pageNum}:`, error);
        // Continue with next page
      }
    }
    
    return {
      indexer,
      processedPages: pagesToProcess,
      totalPages: pdf.numPages
    };
    
  } catch (error) {
    throw new Error(`PDF processing failed: ${error.message}`);
  }
}

// Lazy loading for specific pages
async function loadSpecificPages(file, pageNumbers) {
  const results = [];
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    for (const pageNum of pageNumbers) {
      if (pageNum <= pdf.numPages) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const text = textContent.items.map(item => item.str).join(' ');
        
        results.push({
          pageNum,
          content: text,
          wordCount: text.split(/\s+/).length
        });
      }
    }
    
    return results;
    
  } catch (error) {
    throw new Error(`Page loading failed: ${error.message}`);
  }
}

// Main worker message handler
self.addEventListener('message', function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case 'processPDF':
      handlePDFProcessing(data);
      break;
      
    case 'loadPages':
      handlePageLoading(data);
      break;
      
    case 'searchIndex':
      handleIndexSearch(data);
      break;
      
    case 'getStats':
      handleGetStats(data);
      break;
      
    default:
      self.postMessage({
        type: 'error',
        error: 'Unknown message type',
        success: false
      });
  }
});

// Handle PDF processing
async function handlePDFProcessing(data) {
  try {
    const { file, startPage = 1, endPage = null, chunkSize = 5 } = data;
    
    const result = await processPDFChunk(file, startPage, endPage, chunkSize);
    
    self.postMessage({
      type: 'pdfProcessed',
      data: {
        stats: result.indexer.getStats(),
        processedPages: result.processedPages,
        totalPages: result.totalPages,
        success: true
      }
    });
    
    // Store indexer for future searches
    currentDocument = result.indexer;
    
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error.message,
      success: false
    });
  }
}

// Handle page loading
async function handlePageLoading(data) {
  try {
    const { file, pageNumbers } = data;
    
    const results = await loadSpecificPages(file, pageNumbers);
    
    self.postMessage({
      type: 'pagesLoaded',
      data: {
        pages: results,
        success: true
      }
    });
    
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error.message,
      success: false
    });
  }
}

// Handle index search
async function handleIndexSearch(data) {
  try {
    const { query } = data;
    
    if (!currentDocument) {
      throw new Error('No document indexed for search');
    }
    
    const results = currentDocument.search(query);
    
    self.postMessage({
      type: 'searchResults',
      data: {
        results,
        query,
        success: true
      }
    });
    
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error.message,
      success: false
    });
  }
}

// Handle get stats
async function handleGetStats(data) {
  try {
    if (!currentDocument) {
      throw new Error('No document indexed');
    }
    
    const stats = currentDocument.getStats();
    
    self.postMessage({
      type: 'documentStats',
      data: {
        stats,
        success: true
      }
    });
    
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error.message,
      success: false
    });
  }
}

// Handle errors
self.addEventListener('error', function(e) {
  self.postMessage({
    type: 'error',
    error: e.message,
    success: false
  });
});
