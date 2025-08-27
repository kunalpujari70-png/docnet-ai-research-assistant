import { RequestHandler } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";
import { addDocument, getAllDocumentsForProcessing, updateDocumentContent, getAllDocuments } from "../database";

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
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

interface FileUploadResponse {
  success: boolean;
  message: string;
  files?: string[];
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

      // Process each file and add to database
      for (const file of files) {
        try {
          const documentId = await addDocument({
            filename: file.filename,
            originalName: file.originalname,
            filePath: file.path,
            fileType: path.extname(file.originalname).toLowerCase(),
            fileSize: file.size
          });
          
          uploadedFiles.push(file.originalname);
          console.log(`Document added to database with ID: ${documentId}`);
        } catch (dbError) {
          console.error(`Error adding file ${file.originalname} to database:`, dbError);
        }
      }
      
      res.json({
        success: true,
        message: `${uploadedFiles.length} file(s) uploaded and stored in database successfully`,
        files: uploadedFiles
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
