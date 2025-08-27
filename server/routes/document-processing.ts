// Backend Document Processing Routes
// Handles document processing, indexing, and searching on the server side
// This prevents frontend unresponsiveness by moving heavy operations to the backend

import { RequestHandler } from "express";
import { backendDocumentProcessor } from "../services/documentProcessor";
import path from "path";
import fs from "fs";

// Process and index a document
export const processDocument: RequestHandler = async (req, res) => {
  try {
    const { filePath, documentId, documentName } = req.body;

    if (!filePath || !documentId || !documentName) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters: filePath, documentId, documentName"
      });
    }

    // Validate file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: "File not found"
      });
    }

    console.log(`Processing document: ${documentName} (${documentId})`);

    const documentIndex = await backendDocumentProcessor.processDocument(filePath, documentId, documentName);

    res.json({
      success: true,
      documentIndex: {
        documentId: documentIndex.documentId,
        totalChunks: documentIndex.chunks.length,
        totalWords: documentIndex.totalWords,
        totalPages: documentIndex.totalPages,
        indexedAt: documentIndex.indexedAt
      }
    });

  } catch (error) {
    console.error("Document processing error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Document processing failed"
    });
  }
};

// Search documents
export const searchDocuments: RequestHandler = async (req, res) => {
  try {
    const { query, documentIds } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: "Query is required"
      });
    }

    console.log(`Searching documents for: "${query}"`);

    const searchResults = await backendDocumentProcessor.searchDocuments(query, documentIds);

    // Format results for frontend
    const formattedResults = searchResults.map(result => ({
      documentId: result.documentId,
      documentName: result.documentName,
      totalRelevanceScore: result.totalRelevanceScore,
      chunks: result.chunks.map(chunk => ({
        id: chunk.id,
        content: chunk.content.substring(0, 500) + '...', // Limit content length
        pageNum: chunk.pageNum,
        wordCount: chunk.wordCount,
        relevanceScore: chunk.relevanceScore,
        matches: chunk.matches
      }))
    }));

    res.json({
      success: true,
      results: formattedResults,
      totalResults: formattedResults.length
    });

  } catch (error) {
    console.error("Document search error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Document search failed"
    });
  }
};

// Get document statistics
export const getDocumentStats: RequestHandler = async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: "Document ID is required"
      });
    }

    const stats = backendDocumentProcessor.getDocumentStats(documentId);

    if (!stats) {
      return res.status(404).json({
        success: false,
        error: "Document not found or not indexed"
      });
    }

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error("Get document stats error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get document statistics"
    });
  }
};

// Get memory usage statistics
export const getMemoryStats: RequestHandler = async (req, res) => {
  try {
    const stats = backendDocumentProcessor.getMemoryStats();

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error("Get memory stats error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get memory statistics"
    });
  }
};

// Clear document from memory
export const clearDocument: RequestHandler = async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: "Document ID is required"
      });
    }

    backendDocumentProcessor.clearDocument(documentId);

    res.json({
      success: true,
      message: `Document ${documentId} cleared from memory`
    });

  } catch (error) {
    console.error("Clear document error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to clear document"
    });
  }
};

// Batch process multiple documents
export const batchProcessDocuments: RequestHandler = async (req, res) => {
  try {
    const { documents } = req.body;

    if (!documents || !Array.isArray(documents)) {
      return res.status(400).json({
        success: false,
        error: "Documents array is required"
      });
    }

    console.log(`Batch processing ${documents.length} documents`);

    const results = [];
    const errors = [];

    // Process documents in parallel with concurrency limit
    const concurrencyLimit = 3;
    const chunks = [];
    
    for (let i = 0; i < documents.length; i += concurrencyLimit) {
      chunks.push(documents.slice(i, i + concurrencyLimit));
    }

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (doc: any) => {
        try {
          const { filePath, documentId, documentName } = doc;
          
          if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
          }

          const documentIndex = await backendDocumentProcessor.processDocument(filePath, documentId, documentName);
          
          return {
            documentId,
            documentName,
            success: true,
            stats: {
              totalChunks: documentIndex.chunks.length,
              totalWords: documentIndex.totalWords,
              totalPages: documentIndex.totalPages
            }
          };
        } catch (error) {
          return {
            documentId: doc.documentId,
            documentName: doc.documentName,
            success: false,
            error: error.message
          };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      
      for (const result of chunkResults) {
        if (result.success) {
          results.push(result);
        } else {
          errors.push(result);
        }
      }

      // Small delay between chunks to prevent overwhelming the system
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    res.json({
      success: true,
      results,
      errors,
      summary: {
        total: documents.length,
        successful: results.length,
        failed: errors.length
      }
    });

  } catch (error) {
    console.error("Batch document processing error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Batch document processing failed"
    });
  }
};
