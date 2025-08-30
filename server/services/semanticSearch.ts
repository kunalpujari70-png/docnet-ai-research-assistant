import OpenAI from 'openai';
import { DocumentChunk, ProcessedDocument } from './documentProcessor';

export interface VectorEmbedding {
  id: string;
  vector: number[];
  metadata: {
    documentId: string;
    chunkId: string;
    content: string;
    tags: string[];
  };
}

export interface SearchResult {
  documentId: string;
  chunkId: string;
  content: string;
  similarity: number;
  metadata: {
    documentName: string;
    tags: string[];
    wordCount: number;
  };
}

export interface SearchOptions {
  maxResults?: number;
  similarityThreshold?: number;
  includeMetadata?: boolean;
}

export class SemanticSearchService {
  private openai: OpenAI;
  private embeddings: Map<string, VectorEmbedding> = new Map();
  private documentIndex: Map<string, ProcessedDocument> = new Map();
  private readonly EMBEDDING_MODEL = 'text-embedding-3-small';
  private readonly DEFAULT_MAX_RESULTS = 10;
  private readonly DEFAULT_SIMILARITY_THRESHOLD = 0.7;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'sk-placeholder') {
      console.warn('⚠️  OpenAI API key not set. Semantic search will be disabled.');
      this.openai = null;
    } else {
      this.openai = new OpenAI({
        apiKey: apiKey,
      });
    }
  }

  /**
   * Index a processed document for semantic search
   */
  async indexDocument(document: ProcessedDocument): Promise<void> {
    try {
      console.log(`Indexing document: ${document.name} with ${document.chunks.length} chunks`);

      // Store document metadata
      this.documentIndex.set(document.id, document);

      // Generate embeddings for each chunk
      const embeddingPromises = document.chunks.map(async (chunk) => {
        const embedding = await this.generateEmbedding(chunk.content);
        
        const vectorEmbedding: VectorEmbedding = {
          id: `${document.id}_${chunk.id}`,
          vector: embedding,
          metadata: {
            documentId: document.id,
            chunkId: chunk.id,
            content: chunk.content,
            tags: document.tags
          }
        };

        this.embeddings.set(vectorEmbedding.id, vectorEmbedding);
      });

      await Promise.all(embeddingPromises);
      console.log(`Successfully indexed document: ${document.name}`);
    } catch (error) {
      console.error(`Error indexing document ${document.name}:`, error);
      throw new Error(`Failed to index document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for semantically similar content
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    try {
      const maxResults = options.maxResults || this.DEFAULT_MAX_RESULTS;
      const similarityThreshold = options.similarityThreshold || this.DEFAULT_SIMILARITY_THRESHOLD;

      console.log(`Performing semantic search for: "${query}"`);

      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);

      // Calculate similarities with all indexed embeddings
      const similarities: Array<{ embedding: VectorEmbedding; similarity: number }> = [];

      for (const embedding of this.embeddings.values()) {
        const similarity = this.calculateCosineSimilarity(queryEmbedding, embedding.vector);
        
        if (similarity >= similarityThreshold) {
          similarities.push({ embedding, similarity });
        }
      }

      // Sort by similarity score (highest first)
      similarities.sort((a, b) => b.similarity - a.similarity);

      // Convert to search results
      const results: SearchResult[] = similarities.slice(0, maxResults).map(({ embedding, similarity }) => {
        const document = this.documentIndex.get(embedding.metadata.documentId);
        
        return {
          documentId: embedding.metadata.documentId,
          chunkId: embedding.metadata.chunkId,
          content: embedding.metadata.content,
          similarity,
          metadata: {
            documentName: document?.name || 'Unknown Document',
            tags: embedding.metadata.tags,
            wordCount: embedding.metadata.content.split(/\s+/).length
          }
        };
      });

      console.log(`Found ${results.length} relevant results for query: "${query}"`);
      return results;
    } catch (error) {
      console.error('Semantic search error:', error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search within specific documents
   */
  async searchInDocuments(
    query: string, 
    documentIds: string[], 
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    try {
      const allResults = await this.search(query, options);
      
      // Filter results to only include specified documents
      const filteredResults = allResults.filter(result => 
        documentIds.includes(result.documentId)
      );

      console.log(`Found ${filteredResults.length} results in specified documents`);
      return filteredResults;
    } catch (error) {
      console.error('Document-specific search error:', error);
      throw new Error(`Document search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embedding for text using OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      // Return a mock embedding for development
      console.warn('⚠️  OpenAI not available, using mock embedding');
      return new Array(1536).fill(0).map(() => Math.random() - 0.5);
    }

    try {
      // Truncate text if it's too long (OpenAI has limits)
      const truncatedText = text.length > 8000 ? text.substring(0, 8000) : text;

      const response = await this.openai.embeddings.create({
        model: this.EMBEDDING_MODEL,
        input: truncatedText,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Remove document from index
   */
  removeDocument(documentId: string): void {
    // Remove document metadata
    this.documentIndex.delete(documentId);

    // Remove all embeddings for this document
    const embeddingsToRemove: string[] = [];
    for (const [id, embedding] of this.embeddings.entries()) {
      if (embedding.metadata.documentId === documentId) {
        embeddingsToRemove.push(id);
      }
    }

    embeddingsToRemove.forEach(id => this.embeddings.delete(id));
    console.log(`Removed document ${documentId} from semantic search index`);
  }

  /**
   * Get index statistics
   */
  getIndexStats(): {
    totalDocuments: number;
    totalEmbeddings: number;
    totalChunks: number;
  } {
    const totalDocuments = this.documentIndex.size;
    const totalEmbeddings = this.embeddings.size;
    const totalChunks = Array.from(this.documentIndex.values())
      .reduce((sum, doc) => sum + doc.chunks.length, 0);

    return {
      totalDocuments,
      totalEmbeddings,
      totalChunks
    };
  }

  /**
   * Clear entire index
   */
  clearIndex(): void {
    this.embeddings.clear();
    this.documentIndex.clear();
    console.log('Semantic search index cleared');
  }

  /**
   * Batch index multiple documents
   */
  async batchIndexDocuments(documents: ProcessedDocument[]): Promise<void> {
    console.log(`Batch indexing ${documents.length} documents`);
    
    for (const document of documents) {
      try {
        await this.indexDocument(document);
      } catch (error) {
        console.error(`Failed to index document ${document.name}:`, error);
        // Continue with other documents
      }
    }
    
    console.log('Batch indexing completed');
  }

  /**
   * Search with hybrid approach (semantic + keyword)
   */
  async hybridSearch(
    query: string, 
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    try {
      // Perform semantic search
      const semanticResults = await this.search(query, options);
      
      // Perform keyword search
      const keywordResults = this.keywordSearch(query, options);
      
      // Combine and rank results
      const combinedResults = this.combineSearchResults(semanticResults, keywordResults);
      
      return combinedResults.slice(0, options.maxResults || this.DEFAULT_MAX_RESULTS);
    } catch (error) {
      console.error('Hybrid search error:', error);
      // Fallback to semantic search only
      return await this.search(query, options);
    }
  }

  /**
   * Simple keyword-based search
   */
  private keywordSearch(query: string, options: SearchOptions = {}): SearchResult[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
    const results: SearchResult[] = [];

    for (const embedding of this.embeddings.values()) {
      const contentLower = embedding.metadata.content.toLowerCase();
      let score = 0;

      // Exact phrase match
      if (contentLower.includes(queryLower)) {
        score += 10;
      }

      // Individual word matches
      for (const word of queryWords) {
        if (contentLower.includes(word)) {
          score += 2;
        }
      }

      if (score > 0) {
        const document = this.documentIndex.get(embedding.metadata.documentId);
        
        results.push({
          documentId: embedding.metadata.documentId,
          chunkId: embedding.metadata.chunkId,
          content: embedding.metadata.content,
          similarity: score / 20, // Normalize to 0-1 range
          metadata: {
            documentName: document?.name || 'Unknown Document',
            tags: embedding.metadata.tags,
            wordCount: embedding.metadata.content.split(/\s+/).length
          }
        });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Combine semantic and keyword search results
   */
  private combineSearchResults(
    semanticResults: SearchResult[], 
    keywordResults: SearchResult[]
  ): SearchResult[] {
    const combined = new Map<string, SearchResult>();

    // Add semantic results with weight 0.7
    semanticResults.forEach(result => {
      const key = `${result.documentId}_${result.chunkId}`;
      combined.set(key, {
        ...result,
        similarity: result.similarity * 0.7
      });
    });

    // Add keyword results with weight 0.3
    keywordResults.forEach(result => {
      const key = `${result.documentId}_${result.chunkId}`;
      const existing = combined.get(key);
      
      if (existing) {
        // Combine scores
        existing.similarity = Math.max(existing.similarity, result.similarity * 0.3);
      } else {
        combined.set(key, {
          ...result,
          similarity: result.similarity * 0.3
        });
      }
    });

    return Array.from(combined.values()).sort((a, b) => b.similarity - a.similarity);
  }
}

// Export singleton instance
export const semanticSearchService = new SemanticSearchService();
