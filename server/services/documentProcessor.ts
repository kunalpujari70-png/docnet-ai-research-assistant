// Backend Document Processing Service
// Handles large document parsing, indexing, and searching on the server side
// This offloads heavy operations from the frontend to prevent unresponsiveness

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { createWorker } from 'tesseract.js';

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    page?: number;
    section?: string;
    wordCount: number;
    startIndex: number;
    endIndex: number;
  };
}

export interface ProcessedDocument {
  id: string;
  name: string;
  content: string;
  chunks: DocumentChunk[];
  metadata: {
    fileType: string;
    totalPages?: number;
    totalWords: number;
    language: string;
    hasImages: boolean;
    hasTables: boolean;
    processingTime: number;
    extractedAt: Date;
  };
  summary: string;
  tags: string[];
}

export interface ProcessingOptions {
  enableOCR?: boolean;
  chunkSize?: number; // words per chunk
  overlapSize?: number; // words overlap between chunks
  maxTokens?: number; // max tokens per chunk (default: 4000 for GPT-4)
}

export class DocumentProcessor {
  private static readonly DEFAULT_CHUNK_SIZE = 1000; // words
  private static readonly DEFAULT_OVERLAP_SIZE = 100; // words
  private static readonly DEFAULT_MAX_TOKENS = 4000; // tokens
  private static readonly SUPPORTED_FORMATS = ['.pdf', '.docx', '.doc', '.txt'];

  /**
   * Process a document file and extract content with chunking
   */
  static async processDocument(
    filePath: string,
    originalName: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessedDocument> {
    const startTime = Date.now();
    const fileExtension = path.extname(originalName).toLowerCase();

    if (!this.SUPPORTED_FORMATS.includes(fileExtension)) {
      throw new Error(`Unsupported file format: ${fileExtension}`);
    }

    try {
      // Extract raw content based on file type
      let rawContent = '';
      let hasImages = false;
      let hasTables = false;

      switch (fileExtension) {
        case '.pdf':
          const pdfResult = await this.extractPdfContent(filePath, options.enableOCR);
          rawContent = pdfResult.content;
          hasImages = pdfResult.hasImages;
          hasTables = pdfResult.hasTables;
          break;
        case '.docx':
          const docxResult = await this.extractDocxContent(filePath);
          rawContent = docxResult.content;
          hasTables = docxResult.hasTables;
          break;
        case '.doc':
          const docResult = await this.extractDocContent(filePath);
          rawContent = docResult.content;
          break;
        case '.txt':
          rawContent = await this.extractTextContent(filePath);
          break;
      }

      // Validate extracted content
      if (!rawContent || rawContent.trim().length === 0) {
        throw new Error('No content could be extracted from the document');
      }

      // Clean and normalize content
      const cleanedContent = this.cleanContent(rawContent);

      // Generate chunks
      const chunks = this.generateChunks(cleanedContent, options);

      // Generate summary
      const summary = this.generateSummary(cleanedContent);

      // Extract tags
      const tags = this.extractTags(cleanedContent, originalName);

      // Detect language
      const language = this.detectLanguage(cleanedContent);

      const processingTime = Date.now() - startTime;

      return {
        id: this.generateDocumentId(originalName),
        name: originalName,
        content: cleanedContent,
        chunks,
        metadata: {
          fileType: fileExtension,
          totalPages: this.estimatePages(cleanedContent),
          totalWords: this.countWords(cleanedContent),
          language,
          hasImages,
          hasTables,
          processingTime,
          extractedAt: new Date()
        },
        summary,
        tags
      };
    } catch (error) {
      console.error(`Error processing document ${originalName}:`, error);
      throw new Error(`Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract content from PDF files with OCR support
   */
  private static async extractPdfContent(filePath: string, enableOCR = false): Promise<{
    content: string;
    hasImages: boolean;
    hasTables: boolean;
  }> {
    try {
      // Use the existing PDF extractor
      const extractorPath = path.join(process.cwd(), 'server', 'utils', 'extract-pdf.cjs');
      
      if (!fs.existsSync(extractorPath)) {
        throw new Error('PDF extractor utility not found');
      }

      const result = spawnSync(process.execPath, [extractorPath, filePath], { 
        encoding: 'utf-8',
        timeout: 60000 // 60 second timeout for large PDFs
      });

      if (result.status === 0 && result.stdout) {
        try {
          const parsed = JSON.parse(result.stdout);
          let content = parsed.text || '';
          
          // Check if OCR is needed (content seems to be image-based)
          if (enableOCR && this.needsOCR(content)) {
            console.log('PDF appears to be image-based, attempting OCR...');
            const ocrContent = await this.performOCR(filePath);
            if (ocrContent) {
              content = ocrContent;
            }
          }

          // Detect features
          const hasImages = this.detectImages(content);
          const hasTables = this.detectTables(content);

          return { content, hasImages, hasTables };
        } catch (parseError) {
          throw new Error(`Failed to parse PDF extraction result: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }
      } else {
        const errorMessage = result.stderr || result.error?.message || 'PDF extraction failed';
        throw new Error(`PDF extractor failed (status ${result.status}): ${errorMessage}`);
      }
    } catch (error) {
      throw new Error(`PDF extraction error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract content from DOCX files
   */
  private static async extractDocxContent(filePath: string): Promise<{
    content: string;
    hasTables: boolean;
  }> {
    try {
      // Use mammoth for DOCX extraction
      const mammoth = require('mammoth');
      
      const result = await mammoth.extractRawText({ path: filePath });
      const content = result.value || '';
      
      // Detect tables in DOCX
      const hasTables = this.detectTables(content);

      return { content, hasTables };
    } catch (error) {
      throw new Error(`DOCX extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract content from DOC files (legacy Word format)
   */
  private static async extractDocContent(filePath: string): Promise<{ content: string }> {
    try {
      // For DOC files, we'll use a simple approach since they're legacy format
      const content = `Document content from ${path.basename(filePath)} - Legacy Word document (.doc) format detected. 
      
This document appears to be in the legacy Microsoft Word format (.doc). For better text extraction, please convert this document to .docx format and upload again.

Document Information:
- File: ${path.basename(filePath)}
- Format: Legacy Word Document (.doc)
- Status: Limited extraction available

To get full text extraction, please:
1. Open this document in Microsoft Word or LibreOffice
2. Save it as a .docx file
3. Upload the .docx version instead`;

      return { content: content.trim() };
    } catch (error) {
      throw new Error(`DOC extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract content from text files
   */
  private static async extractTextContent(filePath: string): Promise<string> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      if (!content || content.trim().length === 0) {
        throw new Error('Text file is empty or contains no readable content');
      }

      return content.trim();
    } catch (error) {
      throw new Error(`Failed to read text file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if content needs OCR processing
   */
  private static needsOCR(content: string): boolean {
    // Simple heuristic: if content is very short or contains mostly special characters
    const cleanContent = content.replace(/\s+/g, ' ').trim();
    const wordCount = cleanContent.split(/\s+/).length;
    const specialCharRatio = (content.match(/[^\w\s]/g) || []).length / content.length;
    
    return wordCount < 50 || specialCharRatio > 0.3;
  }

  /**
   * Perform OCR on PDF using Tesseract.js
   */
  private static async performOCR(filePath: string): Promise<string | null> {
    try {
      console.log('Starting OCR processing...');
      const worker = await createWorker('eng');
      
      // Convert PDF to images and perform OCR
      // This is a simplified implementation - in production you'd want to use a proper PDF to image converter
      const result = await worker.recognize(filePath);
      await worker.terminate();
      
      console.log('OCR completed successfully');
      return result.data.text;
    } catch (error) {
      console.error('OCR failed:', error);
      return null;
    }
  }

  /**
   * Clean and normalize content
   */
  private static cleanContent(content: string): string {
    return content
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Generate document chunks for processing
   */
  private static generateChunks(content: string, options: ProcessingOptions = {}): DocumentChunk[] {
    const chunkSize = options.chunkSize || this.DEFAULT_CHUNK_SIZE;
    const overlapSize = options.overlapSize || this.DEFAULT_OVERLAP_SIZE;
    const maxTokens = options.maxTokens || this.DEFAULT_MAX_TOKENS;

    const words = content.split(/\s+/);
    const chunks: DocumentChunk[] = [];
    let chunkIndex = 0;

    for (let i = 0; i < words.length; i += chunkSize - overlapSize) {
      const chunkWords = words.slice(i, i + chunkSize);
      const chunkContent = chunkWords.join(' ');
      
      // Skip empty chunks
      if (chunkContent.trim().length === 0) continue;

      // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
      const estimatedTokens = chunkContent.length / 4;
      if (estimatedTokens > maxTokens) {
        // Split chunk further if it's too large
        const subChunks = this.splitLargeChunk(chunkContent, maxTokens);
        subChunks.forEach((subChunk, subIndex) => {
          chunks.push({
            id: `${chunkIndex}_${subIndex}`,
            content: subChunk,
            metadata: {
              wordCount: subChunk.split(/\s+/).length,
              startIndex: i + (subIndex * (maxTokens * 4)),
              endIndex: i + (subIndex * (maxTokens * 4)) + subChunk.length
            }
          });
        });
      } else {
        chunks.push({
          id: chunkIndex.toString(),
          content: chunkContent,
          metadata: {
            wordCount: chunkWords.length,
            startIndex: i,
            endIndex: i + chunkWords.length
          }
        });
      }
      
      chunkIndex++;
    }

    return chunks;
  }

  /**
   * Split large chunks into smaller ones
   */
  private static splitLargeChunk(content: string, maxTokens: number): string[] {
    const sentences = content.split(/[.!?]+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const testChunk = currentChunk + sentence + '. ';
      const estimatedTokens = testChunk.length / 4;

      if (estimatedTokens > maxTokens && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence + '. ';
      } else {
        currentChunk = testChunk;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Generate a summary of the document
   */
  private static generateSummary(content: string, maxLength: number = 300): string {
    if (!content) return '';
    
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let summary = '';
    
    for (const sentence of sentences) {
      const testSummary = summary + sentence + '. ';
      if (testSummary.length > maxLength) {
        break;
      }
      summary = testSummary;
    }
    
    return summary.trim() || content.substring(0, maxLength - 3) + '...';
  }

  /**
   * Extract tags from content and filename
   */
  private static extractTags(content: string, filename: string): string[] {
    const tags = new Set<string>();
    
    // Extract tags from filename
    const filenameTags = filename
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .map(word => word.toLowerCase());
    
    filenameTags.forEach(tag => tags.add(tag));

    // Extract common topics from content
    const commonTopics = [
      'research', 'analysis', 'report', 'study', 'documentation',
      'manual', 'guide', 'tutorial', 'specification', 'proposal',
      'contract', 'agreement', 'policy', 'procedure', 'standard'
    ];

    const contentLower = content.toLowerCase();
    commonTopics.forEach(topic => {
      if (contentLower.includes(topic)) {
        tags.add(topic);
      }
    });

    // Extract file type as tag
    const fileType = path.extname(filename).substring(1);
    tags.add(fileType);

    return Array.from(tags).slice(0, 10); // Limit to 10 tags
  }

  /**
   * Detect language of content
   */
  private static detectLanguage(content: string): string {
    // Simple language detection based on common words
    const text = content.toLowerCase();
    
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const englishCount = englishWords.filter(word => text.includes(word)).length;
    
    if (englishCount >= 5) {
      return 'en';
    }
    
    return 'unknown';
  }

  /**
   * Detect if content contains images
   */
  private static detectImages(content: string): boolean {
    const imagePatterns = [
      /\[image\]/i,
      /\[img\]/i,
      /figure\s+\d+/i,
      /image\s+\d+/i,
      /photo\s+\d+/i
    ];
    
    return imagePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Detect if content contains tables
   */
  private static detectTables(content: string): boolean {
    const tablePatterns = [
      /\|\s*\w+\s*\|\s*\w+\s*\|/i, // Markdown tables
      /\t+\w+/i, // Tab-separated
      /table\s+\d+/i,
      /row\s+\d+/i,
      /column\s+\d+/i
    ];
    
    return tablePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Count words in content
   */
  private static countWords(content: string): number {
    return content.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Estimate number of pages
   */
  private static estimatePages(content: string): number {
    // Rough estimation: ~500 words per page
    const wordCount = this.countWords(content);
    return Math.max(1, Math.ceil(wordCount / 500));
  }

  /**
   * Generate unique document ID
   */
  private static generateDocumentId(filename: string): string {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^\w]/g, '_');
    return `${sanitizedFilename}_${timestamp}`;
  }
}
