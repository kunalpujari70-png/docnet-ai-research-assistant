import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

export interface ExtractedDocument {
  content: string;
  summary: string;
  success: boolean;
  error?: string;
  metadata?: {
    pages?: number;
    wordCount?: number;
    language?: string;
  };
}

export class DocumentExtractor {
  
  /**
   * Extract content from a file based on its type
   */
  static async extractContent(filePath: string, originalName: string): Promise<ExtractedDocument> {
    const fileExtension = path.extname(originalName).toLowerCase();
    
    try {
      // Validate file exists
      if (!fs.existsSync(filePath)) {
        return {
          content: '',
          summary: '',
          success: false,
          error: `File not found: ${filePath}`
        };
      }

      // Get file stats for validation
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        return {
          content: '',
          summary: '',
          success: false,
          error: 'File is empty'
        };
      }

      // Extract content based on file type
      switch (fileExtension) {
        case '.txt':
          return await this.extractTextContent(filePath);
        case '.pdf':
          return await this.extractPdfContent(filePath);
        case '.docx':
          return await this.extractDocxContent(filePath);
        case '.doc':
          return await this.extractDocContent(filePath);
        default:
          return {
            content: '',
            summary: '',
            success: false,
            error: `Unsupported file type: ${fileExtension}`
          };
      }
    } catch (error) {
      console.error(`Error extracting content from ${originalName}:`, error);
      return {
        content: '',
        summary: '',
        success: false,
        error: `Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Extract content from text files
   */
  private static async extractTextContent(filePath: string): Promise<ExtractedDocument> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Validate content
      if (!content || content.trim().length === 0) {
        return {
          content: '',
          summary: '',
          success: false,
          error: 'Text file is empty or contains no readable content'
        };
      }

      const wordCount = content.split(/\s+/).length;
      const summary = this.generateSummary(content, 200);

      return {
        content: content.trim(),
        summary,
        success: true,
        metadata: {
          wordCount,
          language: this.detectLanguage(content)
        }
      };
    } catch (error) {
      return {
        content: '',
        summary: '',
        success: false,
        error: `Failed to read text file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Extract content from PDF files
   */
  private static async extractPdfContent(filePath: string): Promise<ExtractedDocument> {
    try {
      // Use the existing PDF extractor with improved error handling
      const extractorPath = path.join(process.cwd(), 'server', 'utils', 'extract-pdf.cjs');
      
      if (!fs.existsSync(extractorPath)) {
        return {
          content: '',
          summary: '',
          success: false,
          error: 'PDF extractor utility not found'
        };
      }

      const result = spawnSync(process.execPath, [extractorPath, filePath], { 
        encoding: 'utf-8',
        timeout: 30000 // 30 second timeout
      });

      if (result.status === 0 && result.stdout) {
        try {
          const parsed = JSON.parse(result.stdout);
          const content = parsed.text || '';
          
          // Validate extracted content
          if (!content || content.trim().length === 0) {
            return {
              content: '',
              summary: '',
              success: false,
              error: 'PDF extraction returned empty content'
            };
          }

          const wordCount = content.split(/\s+/).length;
          const summary = this.generateSummary(content, 300);
          const pages = this.estimatePdfPages(content);

          console.log(`Successfully extracted ${content.length} characters from PDF`);
          
          return {
            content: content.trim(),
            summary,
            success: true,
            metadata: {
              pages,
              wordCount,
              language: this.detectLanguage(content)
            }
          };
        } catch (parseError) {
          return {
            content: '',
            summary: '',
            success: false,
            error: `Failed to parse PDF extraction result: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
          };
        }
      } else {
        const errorMessage = result.stderr || result.error?.message || 'PDF extraction failed';
        return {
          content: '',
          summary: '',
          success: false,
          error: `PDF extractor failed (status ${result.status}): ${errorMessage}`
        };
      }
    } catch (error) {
      return {
        content: '',
        summary: '',
        success: false,
        error: `PDF extraction error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Extract content from DOCX files
   */
  private static async extractDocxContent(filePath: string): Promise<ExtractedDocument> {
    try {
      // Use mammoth for DOCX extraction
      const mammoth = require('mammoth');
      
      const result = await mammoth.extractRawText({ path: filePath });
      const content = result.value || '';
      
      // Validate extracted content
      if (!content || content.trim().length === 0) {
        return {
          content: '',
          summary: '',
          success: false,
          error: 'DOCX extraction returned empty content'
        };
      }

      const wordCount = content.split(/\s+/).length;
      const summary = this.generateSummary(content, 300);

      console.log(`Successfully extracted ${content.length} characters from DOCX`);
      
      return {
        content: content.trim(),
        summary,
        success: true,
        metadata: {
          wordCount,
          language: this.detectLanguage(content)
        }
      };
    } catch (error) {
      return {
        content: '',
        summary: '',
        success: false,
        error: `DOCX extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Extract content from DOC files (legacy Word format)
   */
  private static async extractDocContent(filePath: string): Promise<ExtractedDocument> {
    try {
      // For DOC files, we'll use a simple approach since they're legacy format
      // In production, you might want to use a more sophisticated library
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

      return {
        content: content.trim(),
        summary: `Legacy Word document: ${path.basename(filePath)} - Limited extraction available`,
        success: true,
        metadata: {
          wordCount: content.split(/\s+/).length
        }
      };
    } catch (error) {
      return {
        content: '',
        summary: '',
        success: false,
        error: `DOC extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Generate a summary from content
   */
  private static generateSummary(content: string, maxLength: number = 200): string {
    if (!content) return '';
    
    // Clean the content
    const cleanContent = content
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n+/g, ' ') // Replace multiple newlines with space
      .trim();
    
    if (cleanContent.length <= maxLength) {
      return cleanContent;
    }
    
    // Try to break at sentence boundaries
    const sentences = cleanContent.split(/[.!?]+/);
    let summary = '';
    
    for (const sentence of sentences) {
      const testSummary = summary + sentence + '. ';
      if (testSummary.length > maxLength) {
        break;
      }
      summary = testSummary;
    }
    
    // If we couldn't fit a complete sentence, just truncate
    if (!summary) {
      summary = cleanContent.substring(0, maxLength - 3) + '...';
    }
    
    return summary.trim();
  }

  /**
   * Estimate PDF pages based on content length
   */
  private static estimatePdfPages(content: string): number {
    // Rough estimation: ~500 words per page
    const wordCount = content.split(/\s+/).length;
    return Math.max(1, Math.ceil(wordCount / 500));
  }

  /**
   * Simple language detection
   */
  private static detectLanguage(content: string): string {
    // Simple heuristic based on common words
    const text = content.toLowerCase();
    
    // Check for common English words
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const englishCount = englishWords.filter(word => text.includes(word)).length;
    
    if (englishCount >= 5) {
      return 'en';
    }
    
    // Add more language detection logic as needed
    return 'unknown';
  }

  /**
   * Validate extracted content
   */
  static validateContent(content: string): { isValid: boolean; error?: string } {
    if (!content || typeof content !== 'string') {
      return { isValid: false, error: 'Content is empty or invalid' };
    }
    
    if (content.trim().length === 0) {
      return { isValid: false, error: 'Content is empty after trimming' };
    }
    
    if (content.length < 10) {
      return { isValid: false, error: 'Content is too short (less than 10 characters)' };
    }
    
    // Check for common extraction errors
    const errorPatterns = [
      /error/i,
      /failed/i,
      /not found/i,
      /cannot read/i,
      /permission denied/i
    ];
    
    for (const pattern of errorPatterns) {
      if (pattern.test(content)) {
        return { isValid: false, error: 'Content contains error indicators' };
      }
    }
    
    return { isValid: true };
  }
}
