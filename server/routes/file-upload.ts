import { RequestHandler } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { addDocument, getAllDocuments, updateDocumentContent } from "../database";
import { DocumentProcessor, ProcessedDocument } from "../services/documentProcessor";
import { semanticSearchService } from "../services/semanticSearch";

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 5 // Max 5 files at once
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.doc', '.txt'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${fileExtension}`));
    }
  }
});

interface FileUploadResponse {
  success: boolean;
  message: string;
  files?: string[];
  processedFiles?: Array<{
    name: string;
    content: string;
    summary: string;
    success: boolean;
    error?: string;
    metadata?: any;
    tags?: string[];
  }>;
  error?: string;
}

export const handleFileUpload: RequestHandler = async (req, res) => {
  try {
    upload.array('files', 5)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message
        } as FileUploadResponse);
      }

      if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
        return res.status(400).json({
          success: false,
          error: "No files uploaded"
        } as FileUploadResponse);
      }

      const files = req.files as Express.Multer.File[];
      const uploadedFiles: string[] = [];
      const processedFiles: Array<{
        name: string;
        content: string;
        summary: string;
        success: boolean;
        error?: string;
        metadata?: any;
        tags?: string[];
      }> = [];

      console.log(`Processing ${files.length} uploaded files`);

      for (const file of files) {
        try {
          console.log(`Processing file: ${file.originalname}`);
          
          // Process document with enhanced extraction
          const processedDocument = await DocumentProcessor.processDocument(
            file.path,
            file.originalname,
            {
              enableOCR: true, // Enable OCR for PDFs
              chunkSize: 1000, // 1000 words per chunk
              overlapSize: 100, // 100 words overlap
              maxTokens: 4000 // 4000 tokens max per chunk
            }
          );

          // Store in database
          const documentId = await addDocument({
            name: processedDocument.name,
            originalName: file.originalname,
            fileType: processedDocument.metadata.fileType,
            fileSize: file.size,
            content: processedDocument.content,
            summary: processedDocument.summary,
            tags: processedDocument.tags,
            metadata: processedDocument.metadata,
            chunks: processedDocument.chunks,
            processed: true,
            uploadDate: new Date(),
            userId: req.body.userId,
            sessionId: req.body.sessionId
          });

          // Index for semantic search
          try {
            await semanticSearchService.indexDocument(processedDocument);
            console.log(`Document ${file.originalname} indexed for semantic search`);
          } catch (searchError) {
            console.warn(`Failed to index document for semantic search: ${searchError}`);
            // Continue processing even if indexing fails
          }

          uploadedFiles.push(file.filename);
          processedFiles.push({
            name: file.originalname,
            content: processedDocument.content,
            summary: processedDocument.summary,
            success: true,
            metadata: processedDocument.metadata,
            tags: processedDocument.tags
          });

          console.log(`Successfully processed ${file.originalname}: ${processedDocument.metadata.totalWords} words, ${processedDocument.chunks.length} chunks`);

        } catch (error) {
          console.error(`Error processing file ${file.originalname}:`, error);
          
          processedFiles.push({
            name: file.originalname,
            content: '',
            summary: '',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Clean up uploaded files
      files.forEach(file => {
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (cleanupError) {
          console.warn(`Failed to cleanup file ${file.path}:`, cleanupError);
        }
      });

      const successCount = processedFiles.filter(f => f.success).length;
      console.log(`File upload completed: ${successCount}/${files.length} files processed successfully`);

      res.json({
        success: true,
        message: `Successfully processed ${successCount} out of ${files.length} files`,
        files: uploadedFiles,
        processedFiles
      } as FileUploadResponse);

    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    } as FileUploadResponse);
  }
};

export const getUploadedFiles: RequestHandler = async (req, res) => {
  try {
    const documents = await getAllDocuments();
    
    const fileList = documents.map(doc => ({
      id: doc.id,
      name: doc.name,
      originalName: doc.originalName,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      processed: doc.processed,
      uploadDate: doc.uploadDate,
      tags: doc.tags,
      metadata: doc.metadata
    }));

    res.json({
      success: true,
      files: fileList
    });
  } catch (error) {
    console.error('Error fetching uploaded files:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get processed documents with content for AI queries
export const getProcessedDocuments: RequestHandler = async (req, res) => {
  try {
    const documents = await getAllDocuments();
    const processedDocs = [];
    
    for (const doc of documents) {
      if (doc.processed) {
        processedDocs.push({
          id: doc.id,
          name: doc.name,
          content: doc.content,
          summary: doc.summary,
          fileType: doc.fileType,
          uploadDate: doc.uploadDate,
          tags: doc.tags,
          metadata: doc.metadata,
          chunks: doc.chunks
        });
      }
    }
    
    res.json({
      success: true,
      documents: processedDocs
    });
  } catch (error) {
    console.error('Error fetching processed documents:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Process existing documents (for documents uploaded before the new system)
export const handleProcessDocuments: RequestHandler = async (req, res) => {
  try {
    const documents = await getAllDocuments();
    const unprocessedDocs = documents.filter(doc => !doc.processed);
    
    console.log(`Processing ${unprocessedDocs.length} unprocessed documents`);

    const results = [];

    for (const doc of unprocessedDocs) {
      try {
        // Find the file in uploads directory
        const uploadDir = path.join(process.cwd(), 'uploads');
        const files = fs.readdirSync(uploadDir);
        const matchingFile = files.find(file => file.includes(doc.originalName));

        if (matchingFile) {
          const filePath = path.join(uploadDir, matchingFile);
          
          // Process the document
          const processedDocument = await DocumentProcessor.processDocument(
            filePath,
            doc.originalName,
            {
              enableOCR: true,
              chunkSize: 1000,
              overlapSize: 100,
              maxTokens: 4000
            }
          );

          // Update database
          await updateDocumentContent(
            doc.id,
            processedDocument.content,
            processedDocument.summary,
            processedDocument.chunks,
            processedDocument.metadata,
            processedDocument.tags
          );

          // Index for semantic search
          try {
            await semanticSearchService.indexDocument(processedDocument);
          } catch (searchError) {
            console.warn(`Failed to index document for semantic search: ${searchError}`);
          }

          results.push({
            id: doc.id,
            name: doc.originalName,
            success: true,
            message: 'Document processed successfully'
          });

          console.log(`Processed document: ${doc.originalName}`);
        } else {
          results.push({
            id: doc.id,
            name: doc.originalName,
            success: false,
            error: 'Original file not found'
          });
        }
      } catch (error) {
        console.error(`Error processing document ${doc.originalName}:`, error);
        results.push({
          id: doc.id,
          name: doc.originalName,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.json({
      success: true,
      message: `Processed ${results.filter(r => r.success).length} out of ${unprocessedDocs.length} documents`,
      results
    });

  } catch (error) {
    console.error('Error processing documents:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
