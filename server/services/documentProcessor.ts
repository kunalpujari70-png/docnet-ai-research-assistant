// Backend Document Processing Service
// Handles large document parsing, indexing, and searching on the server side
// This offloads heavy operations from the frontend to prevent unresponsiveness

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DocumentChunk {
  id: string;
  content: string;
  pageNum?: number;
  wordCount: number;
  relevanceScore: number;
  matches: string[];
}

interface DocumentIndex {
  documentId: string;
  chunks: DocumentChunk[];
  totalWords: number;
  totalPages: number;
  indexedAt: Date;
}

interface SearchResult {
  documentId: string;
  chunks: DocumentChunk[];
  totalRelevanceScore: number;
  documentName: string;
}

class BackendDocumentProcessor {
  private documentIndexes = new Map<string, DocumentIndex>();
  private processingQueue = new Map<string, Promise<any>>();
  private readonly CHUNK_SIZE = 1000; // words per chunk
  private readonly MAX_CHUNKS_PER_DOCUMENT = 50; // prevent memory issues

  // Process and index a document
  async processDocument(filePath: string, documentId: string, documentName: string): Promise<DocumentIndex> {
    // Check if already processing
    if (this.processingQueue.has(documentId)) {
      return this.processingQueue.get(documentId)!;
    }

    const processingPromise = this.performDocumentProcessing(filePath, documentId, documentName);
    this.processingQueue.set(documentId, processingPromise);

    try {
      const result = await processingPromise;
      this.documentIndexes.set(documentId, result);
      return result;
    } finally {
      this.processingQueue.delete(documentId);
    }
  }

  private async performDocumentProcessing(filePath: string, documentId: string, documentName: string): Promise<DocumentIndex> {
    const fileExtension = path.extname(filePath).toLowerCase();
    let content = '';

    try {
      if (fileExtension === '.txt') {
        content = await this.readTextFile(filePath);
      } else if (fileExtension === '.pdf') {
        content = await this.extractPdfText(filePath);
      } else {
        content = `Document: ${documentName} - Format not supported for processing`;
      }

      // Split content into chunks
      const chunks = this.createChunks(content, documentId);
      
      // Limit chunks to prevent memory issues
      const limitedChunks = chunks.slice(0, this.MAX_CHUNKS_PER_DOCUMENT);

      const documentIndex: DocumentIndex = {
        documentId,
        chunks: limitedChunks,
        totalWords: content.split(/\s+/).length,
        totalPages: Math.ceil(limitedChunks.length / 5), // Estimate pages
        indexedAt: new Date()
      };

      return documentIndex;

    } catch (error) {
      console.error(`Error processing document ${documentName}:`, error);
      throw new Error(`Failed to process document: ${error.message}`);
    }
  }

  private async readTextFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf-8', (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  private async extractPdfText(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Use a separate process to extract PDF text to prevent blocking
      const extractorPath = path.join(__dirname, '../utils/extract-pdf.cjs');
      const result = spawn(process.execPath, [extractorPath, filePath], { 
        encoding: 'utf-8',
        timeout: 30000 // 30 second timeout
      });

      let output = '';
      let errorOutput = '';

      result.stdout.on('data', (data) => {
        output += data.toString();
      });

      result.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      result.on('close', (code) => {
        if (code === 0) {
          try {
            const parsed = JSON.parse(output || '{}');
            resolve(parsed.text || '');
          } catch (parseError) {
            reject(new Error(`Failed to parse PDF extractor output: ${parseError.message}`));
          }
        } else {
          reject(new Error(`PDF extraction failed (code ${code}): ${errorOutput}`));
        }
      });

      result.on('error', (error) => {
        reject(new Error(`PDF extraction process error: ${error.message}`));
      });
    });
  }

  private createChunks(content: string, documentId: string): DocumentChunk[] {
    const words = content.split(/\s+/);
    const chunks: DocumentChunk[] = [];

    for (let i = 0; i < words.length; i += this.CHUNK_SIZE) {
      const chunkWords = words.slice(i, i + this.CHUNK_SIZE);
      const chunkContent = chunkWords.join(' ');
      
      chunks.push({
        id: `${documentId}-chunk-${Math.floor(i / this.CHUNK_SIZE)}`,
        content: chunkContent,
        pageNum: Math.floor(i / this.CHUNK_SIZE) + 1,
        wordCount: chunkWords.length,
        relevanceScore: 0,
        matches: []
      });
    }

    return chunks;
  }

  // Search across all indexed documents
  async searchDocuments(query: string, documentIds?: string[]): Promise<SearchResult[]> {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
    const results: SearchResult[] = [];

    // Determine which documents to search
    const documentsToSearch = documentIds 
      ? documentIds.filter(id => this.documentIndexes.has(id))
      : Array.from(this.documentIndexes.keys());

    for (const documentId of documentsToSearch) {
      const documentIndex = this.documentIndexes.get(documentId);
      if (!documentIndex) continue;

      const relevantChunks = this.searchDocumentChunks(documentIndex.chunks, queryLower, queryWords);
      
      if (relevantChunks.length > 0) {
        const totalRelevanceScore = relevantChunks.reduce((sum, chunk) => sum + chunk.relevanceScore, 0);
        
        results.push({
          documentId,
          chunks: relevantChunks.slice(0, 5), // Limit to top 5 chunks
          totalRelevanceScore,
          documentName: documentId // You might want to store document names separately
        });
      }
    }

    // Sort by relevance score
    return results.sort((a, b) => b.totalRelevanceScore - a.totalRelevanceScore);
  }

  private searchDocumentChunks(chunks: DocumentChunk[], queryLower: string, queryWords: string[]): DocumentChunk[] {
    return chunks.map(chunk => {
      const contentLower = chunk.content.toLowerCase();
      let relevanceScore = 0;
      const matches: string[] = [];

      // Exact phrase match
      if (contentLower.includes(queryLower)) {
        relevanceScore += 20;
        matches.push(queryLower);
      }

      // Individual word matches
      for (const word of queryWords) {
        if (contentLower.includes(word)) {
          relevanceScore += 3;
          if (!matches.includes(word)) {
            matches.push(word);
          }
        }
      }

      // Semantic keyword matching (basic implementation)
      const semanticKeywords = this.getSemanticKeywords(queryLower);
      for (const keyword of semanticKeywords) {
        if (contentLower.includes(keyword)) {
          relevanceScore += 2;
          if (!matches.includes(keyword)) {
            matches.push(keyword);
          }
        }
      }

      return {
        ...chunk,
        relevanceScore,
        matches
      };
    }).filter(chunk => chunk.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private getSemanticKeywords(query: string): string[] {
    // Basic semantic keyword expansion
    const keywordMap: { [key: string]: string[] } = {
      'what': ['information', 'details', 'explanation', 'description'],
      'how': ['method', 'process', 'procedure', 'steps', 'way'],
      'why': ['reason', 'cause', 'purpose', 'explanation'],
      'when': ['time', 'date', 'period', 'schedule'],
      'where': ['location', 'place', 'area', 'site'],
      'who': ['person', 'individual', 'people', 'personnel'],
      'mount': ['mountain', 'peak', 'hill', 'summit'],
      'mandar': ['mandar', 'mandara', 'pandar', 'pandara']
    };

    const keywords: string[] = [];
    for (const [key, values] of Object.entries(keywordMap)) {
      if (query.includes(key)) {
        keywords.push(...values);
      }
    }

    return keywords;
  }

  // Get document statistics
  getDocumentStats(documentId: string): any {
    const documentIndex = this.documentIndexes.get(documentId);
    if (!documentIndex) {
      return null;
    }

    return {
      totalChunks: documentIndex.chunks.length,
      totalWords: documentIndex.totalWords,
      totalPages: documentIndex.totalPages,
      indexedAt: documentIndex.indexedAt
    };
  }

  // Clear document from memory
  clearDocument(documentId: string): void {
    this.documentIndexes.delete(documentId);
  }

  // Get memory usage statistics
  getMemoryStats(): any {
    const totalDocuments = this.documentIndexes.size;
    const totalChunks = Array.from(this.documentIndexes.values())
      .reduce((sum, doc) => sum + doc.chunks.length, 0);
    const totalWords = Array.from(this.documentIndexes.values())
      .reduce((sum, doc) => sum + doc.totalWords, 0);

    return {
      totalDocuments,
      totalChunks,
      totalWords,
      processingQueueSize: this.processingQueue.size
    };
  }
}

export const backendDocumentProcessor = new BackendDocumentProcessor();
