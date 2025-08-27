// Document processing Web Worker
// This worker handles document parsing and analysis in the background

// Document processing functions
function processDocumentChunk(text, query, chunkSize = 1000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  
  const results = [];
  let processedCount = 0;
  
  for (const chunk of chunks) {
    // Process each chunk
    const relevanceScore = calculateRelevance(chunk, query);
    results.push({
      chunk,
      relevanceScore,
      startIndex: processedCount * chunkSize
    });
    processedCount++;
    
    // Report progress
    self.postMessage({
      type: 'progress',
      processed: processedCount,
      total: chunks.length,
      percentage: Math.round((processedCount / chunks.length) * 100)
    });
  }
  
  return results;
}

function calculateRelevance(text, query) {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(word => word.length > 1);
  
  let score = 0;
  
  // Exact phrase match
  if (textLower.includes(queryLower)) {
    score += 20;
  }
  
  // Word matches
  for (const word of queryWords) {
    if (textLower.includes(word)) {
      score += 3;
    }
  }
  
  // Semantic keywords
  const semanticKeywords = [
    'research', 'study', 'analysis', 'data', 'findings', 'conclusion',
    'mount', 'mountain', 'hill', 'peak', 'summit', 'location', 'place',
    'history', 'historical', 'ancient', 'temple', 'religious', 'sacred'
  ];
  
  for (const keyword of semanticKeywords) {
    if (queryLower.includes(keyword) && textLower.includes(keyword)) {
      score += 2;
    }
  }
  
  return score;
}

// Main worker message handler
self.addEventListener('message', function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case 'processDocument':
      try {
        const { content, query } = data;
        
        // Process document in chunks
        const results = processDocumentChunk(content, query);
        
        // Sort by relevance
        results.sort((a, b) => b.relevanceScore - a.relevanceScore);
        
        // Return top results
        const topResults = results.slice(0, 5);
        
        self.postMessage({
          type: 'documentProcessed',
          results: topResults,
          success: true
        });
      } catch (error) {
        self.postMessage({
          type: 'error',
          error: error.message,
          success: false
        });
      }
      break;
      
    case 'analyzeDocuments':
      try {
        const { documents, query } = data;
        const results = [];
        
        for (let i = 0; i < documents.length; i++) {
          const doc = documents[i];
          const relevanceScore = calculateRelevance(doc.content, query);
          
          results.push({
            ...doc,
            relevanceScore,
            isRelevant: relevanceScore >= 2
          });
          
          // Report progress for each document
          self.postMessage({
            type: 'progress',
            processed: i + 1,
            total: documents.length,
            percentage: Math.round(((i + 1) / documents.length) * 100)
          });
        }
        
        // Sort by relevance and filter
        const relevantDocs = results
          .filter(doc => doc.isRelevant)
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .slice(0, 5);
        
        self.postMessage({
          type: 'documentsAnalyzed',
          results: relevantDocs,
          success: true
        });
      } catch (error) {
        self.postMessage({
          type: 'error',
          error: error.message,
          success: false
        });
      }
      break;
      
    default:
      self.postMessage({
        type: 'error',
        error: 'Unknown message type',
        success: false
      });
  }
});

// Handle errors
self.addEventListener('error', function(e) {
  self.postMessage({
    type: 'error',
    error: e.message,
    success: false
  });
});
