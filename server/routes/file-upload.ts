import { RequestHandler } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";
import { addDocument, getAllDocumentsForProcessing, updateDocumentContent, getAllDocuments, getDocumentContent } from "../database";
import { DocumentExtractor, ExtractedDocument } from "../services/documentExtractor";

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
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.txt', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, TXT, DOC, DOCX files are allowed.'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for large PDFs
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
    metadata?: {
      pages?: number;
      wordCount?: number;
      language?: string;
    };
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
        metadata?: {
          pages?: number;
          wordCount?: number;
          language?: string;
        };
      }> = [];

      // Process each file and add to database with content extraction
      for (const file of files) {
        try {
          console.log(`Processing file: ${file.originalname} (${file.size} bytes)`);
          
          // Extract content using the new DocumentExtractor
          const extractedDoc: ExtractedDocument = await DocumentExtractor.extractContent(file.path, file.originalname);
          
          // Validate the extracted content
          const validation = DocumentExtractor.validateContent(extractedDoc.content);
          if (!validation.isValid) {
            extractedDoc.success = false;
            extractedDoc.error = validation.error || 'Content validation failed';
          }

          // Add document to database with extracted content
          const documentId = await addDocument({
            filename: file.filename,
            originalName: file.originalname,
            filePath: file.path,
            fileType: path.extname(file.originalname).toLowerCase(),
            fileSize: file.size,
            content: extractedDoc.content,
            summary: extractedDoc.summary
          });
          
          uploadedFiles.push(file.originalname);
          processedFiles.push({
            name: file.originalname,
            content: extractedDoc.content,
            summary: extractedDoc.summary,
            success: extractedDoc.success,
            error: extractedDoc.error,
            metadata: extractedDoc.metadata
          });
          
          if (extractedDoc.success) {
            console.log(`✅ Successfully processed ${file.originalname}:`);
            console.log(`   - Content length: ${extractedDoc.content.length} characters`);
            console.log(`   - Word count: ${extractedDoc.metadata?.wordCount || 'unknown'}`);
            console.log(`   - Pages: ${extractedDoc.metadata?.pages || 'unknown'}`);
            console.log(`   - Language: ${extractedDoc.metadata?.language || 'unknown'}`);
            console.log(`   - Database ID: ${documentId}`);
          } else {
            console.error(`❌ Failed to process ${file.originalname}: ${extractedDoc.error}`);
          }
          
        } catch (dbError) {
          console.error(`Error adding file ${file.originalname} to database:`, dbError);
          processedFiles.push({
            name: file.originalname,
            content: "",
            summary: "",
            success: false,
            error: `Database error: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`
          });
        }
      }
      
      const successCount = processedFiles.filter(f => f.success).length;
      const totalCount = processedFiles.length;
      
      res.json({
        success: true,
        message: `Processed ${successCount}/${totalCount} files successfully`,
        files: uploadedFiles,
        processedFiles: processedFiles
      } as FileUploadResponse);
    });
  } catch (error) {
    console.error("File upload error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    } as FileUploadResponse);
  }
};

export const getUploadedFiles: RequestHandler = async (req, res) => {
  try {
    const documents = await getAllDocuments();
    res.json({ files: documents });
  } catch (error) {
    console.error("Error getting uploaded files:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Process uploaded documents (extract text, generate summaries)
export const handleProcessDocuments: RequestHandler = async (req, res) => {
  try {
    const documents = await getAllDocumentsForProcessing();
    const unprocessedDocs = documents.filter(doc => !doc.processed);
    
    if (unprocessedDocs.length === 0) {
      return res.json({ 
        success: true, 
        message: "All documents are already processed" 
      });
    }

    let processedCount = 0;
    
    for (const doc of unprocessedDocs) {
      try {
        // Extract text from the actual file
        const filePath = doc.filePath; // Use the full file path from database
        
        if (fs.existsSync(filePath)) {
          let content = "";
          let summary = "";
          
          if (doc.fileType === '.txt') {
            content = fs.readFileSync(filePath, 'utf-8');
            summary = content.substring(0, 200) + "...";
          } else if (doc.fileType === '.pdf') {
            try {
              // Use a separate CJS helper with pdf-parse to avoid bundler import issues
              const extractorPath = path.join(process.cwd(), 'server', 'utils', 'extract-pdf.cjs');
              const result = spawnSync(process.execPath, [extractorPath, filePath], { encoding: 'utf-8' });
              if (result.status === 0) {
                const parsed = JSON.parse(result.stdout || '{}');
                content = parsed.text || '';
                const firstLines = content.split('\n').slice(0, 10).join(' ').trim();
                summary = firstLines.substring(0, 300) + "...";
                console.log(`Extracted ${content.length} characters from PDF: ${doc.originalName}`);
              } else {
                console.error(`PDF extractor failed (status ${result.status}):`, result.stderr);
                content = `PDF document: ${doc.originalName} - Text extraction failed.`;
                summary = `PDF document: ${doc.originalName} - Text extraction failed`;
              }
            } catch (pdfError) {
              console.error(`Error extracting PDF content from ${doc.originalName}:`, pdfError);
              content = `PDF document: ${doc.originalName} - Text extraction failed.`;
              summary = `PDF document: ${doc.originalName} - Text extraction failed`;
            }
          } else if (doc.fileType === '.docx' || doc.fileType === '.doc') {
            content = `Document content from ${doc.originalName} - Word document processing not yet implemented`;
            summary = `Document: ${doc.originalName} - Word document`;
          } else {
            content = `Document content from ${doc.originalName}`;
            summary = `Document: ${doc.originalName}`;
          }
          
          await updateDocumentContent(doc.id, content, summary);
          processedCount++;
          console.log(`Successfully processed document: ${doc.originalName}`);
        } else {
          console.error(`File not found: ${filePath}`);
        }
      } catch (error) {
        console.error(`Error processing document ${doc.originalName}:`, error);
      }
    }
    
    res.json({
      success: true,
      message: `Processed ${processedCount} documents`,
      processedCount
    });
  } catch (error) {
    console.error("Error processing documents:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get processed documents with content for AI queries
export const getProcessedDocuments: RequestHandler = async (req, res) => {
  try {
    const documents = await getAllDocuments();
    const processedDocs = [];
    
    for (const doc of documents) {
      if (doc.processed) {
        const content = await getDocumentContent(doc.id);
        if (content) {
          processedDocs.push({
            id: doc.id,
            name: doc.originalName,
            content: content.content,
            summary: content.summary,
            fileType: doc.fileType,
            uploadDate: doc.uploadDate
          });
        }
      }
    }
    
    res.json({
      success: true,
      documents: processedDocs
    });
  } catch (error) {
    console.error("Error getting processed documents:", error);
    res.status(500).json({ 
      success: false,
      error: "Internal server error" 
    });
  }
};
