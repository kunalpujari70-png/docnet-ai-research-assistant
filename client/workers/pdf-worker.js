// PDF Processing Web Worker
// Handles large PDF parsing in background threads with chunking and lazy loading
// Chrome-optimized version with reduced blocking operations

// PDF.js library for PDF parsing
importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Document processing state
let currentDocument = null;
let documentIndex = null;
let processingQueue = [];
let isProcessing = false;

// Chrome-specific performance optimizations
const CHROME_YIELD_INTERVAL = 5; // Reduced from 10ms for Chrome
const CHROME_CHUNK_SIZE = 3; // Smaller chunks for Chrome
const CHROME_MAX_PAGES_PER_BATCH = 2; // Process fewer pages at once

// Text indexing for faster searching
class TextIndexer {
  constructor() {
    this.index = new Map();
    this.pageContent = new Map();
    this.keywordMap = new Map();
    this.processingQueue = [];
  }

  // Index text content for fast searching with Chrome optimizations
  async indexText(pageNum, text) {
    // Use requestIdleCallback if available for Chrome
    if (typeof requestIdleCallback !== 'undefined') {
      return new Promise(resolve => {
        requestIdleCallback(() => {
          this._indexTextSync(pageNum, text);
          resolve();
        }, { timeout: 50 });
      });
    } else {
      // Fallback with micro-task yielding
      await new Promise(resolve => setTimeout(resolve, 0));
      this._indexTextSync(pageNum, text);
    }
  }

  _indexTextSync(pageNum, text) {
    const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const pageKey = `page_${pageNum}`;
    
    // Store page content
    this.pageContent.set(pageKey, text);
    
    // Index words with page references (optimized for Chrome)
    for (let i = 0; i < words.length; i += 100) { // Process in batches
      const batch = words.slice(i, i + 100);
      batch.forEach(word => {
        if (!this.keywordMap.has(word)) {
          this.keywordMap.set(word, new Set());
        }
        this.keywordMap.get(word).add(pageKey);
      });
      
      // Yield control for Chrome
      if (i % 500 === 0 && i > 0) {
        // Small delay to prevent blocking
        const start = performance.now();
        while (performance.now() - start < 1) {
          // Busy wait for 1ms to yield control
        }
      }
    }
    
    // Store page metadata
    this.index.set(pageKey, {
      pageNum,
      wordCount: words.length,
      textLength: text.length,
      words: new Set(words)
    });
  }

  // Search indexed content with Chrome optimizations
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

// Chrome-optimized PDF processing functions
async function processPDFChunk(file, startPage, endPage, chunkSize = CHROME_CHUNK_SIZE) {
  const indexer = new TextIndexer();
  const results = [];
  
  try {
    // Load PDF document with timeout
    const arrayBuffer = await Promise.race([
      file.arrayBuffer(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('PDF load timeout')), 30000))
    ]);
    
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const totalPages = Math.min(endPage, pdf.numPages);
    const pagesToProcess = Math.min(chunkSize, totalPages - startPage + 1);
    
    // Process pages in smaller batches for Chrome
    const batchSize = CHROME_MAX_PAGES_PER_BATCH;
    
    for (let i = 0; i < pagesToProcess; i += batchSize) {
      const batchEnd = Math.min(i + batchSize, pagesToProcess);
      
      // Process batch
      for (let j = i; j < batchEnd; j++) {
        const pageNum = startPage + j;
        
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const text = textContent.items.map(item => item.str).join(' ');
          
          // Index the text asynchronously
          await indexer.indexText(pageNum, text);
          
          // Report progress
          self.postMessage({
            type: 'pdfProgress',
            data: {
              pageNum,
              totalPages: pdf.numPages,
              processed: j + 1,
              total: pagesToProcess,
              percentage: Math.round(((j + 1) / pagesToProcess) * 100)
            }
          });
          
        } catch (error) {
          console.error(`Error processing page ${pageNum}:`, error);
          // Continue with next page
        }
      }
      
      // Yield control more frequently for Chrome
      await new Promise(resolve => setTimeout(resolve, CHROME_YIELD_INTERVAL));
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

// Chrome-optimized lazy loading for specific pages
async function loadSpecificPages(file, pageNumbers) {
  const results = [];
  
  try {
    const arrayBuffer = await Promise.race([
      file.arrayBuffer(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('PDF load timeout')), 15000))
    ]);
    
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    // Process pages in smaller batches for Chrome
    const batchSize = CHROME_MAX_PAGES_PER_BATCH;
    
    for (let i = 0; i < pageNumbers.length; i += batchSize) {
      const batch = pageNumbers.slice(i, i + batchSize);
      
      for (const pageNum of batch) {
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
      
      // Yield control for Chrome
      if (i + batchSize < pageNumbers.length) {
        await new Promise(resolve => setTimeout(resolve, CHROME_YIELD_INTERVAL));
      }
    }
    
    return results;
    
  } catch (error) {
    throw new Error(`Page loading failed: ${error.message}`);
  }
}

// Main worker message handler with Chrome optimizations
self.addEventListener('message', function(e) {
  const { type, data } = e.data;
  
  // Prevent multiple simultaneous operations
  if (isProcessing && type !== 'getStats') {
    self.postMessage({
      type: 'error',
      error: 'Another operation is in progress',
      success: false
    });
    return;
  }
  
  switch (type) {
    case 'processPDF':
      isProcessing = true;
      handlePDFProcessing(data);
      break;
      
    case 'loadPages':
      isProcessing = true;
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

// Handle PDF processing with Chrome optimizations
async function handlePDFProcessing(data) {
  try {
    const { file, startPage = 1, endPage = null, chunkSize = CHROME_CHUNK_SIZE } = data;
    
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
  } finally {
    isProcessing = false;
  }
}

// Handle page loading with Chrome optimizations
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
  } finally {
    isProcessing = false;
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

// Handle errors with Chrome-specific logging
self.addEventListener('error', function(e) {
  console.error('PDF Worker Error:', e.error);
  self.postMessage({
    type: 'error',
    error: e.message,
    success: false
  });
});

// Handle unhandled promise rejections
self.addEventListener('unhandledrejection', function(e) {
  console.error('PDF Worker Unhandled Rejection:', e.reason);
  self.postMessage({
    type: 'error',
    error: e.reason?.message || 'Unhandled promise rejection',
    success: false
  });
});
