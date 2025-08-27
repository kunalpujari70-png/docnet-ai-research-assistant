import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { handleDemo } from "./routes/demo";
import openaiRouter from "./routes/openai";
import geminiRouter from "./routes/gemini";
import { handlePdfProcess } from "./routes/pdf-process";
import { handleFileUpload, getUploadedFiles, handleProcessDocuments } from "./routes/file-upload";
import { handleWebSearch, handleEnhancedSearch } from "./routes/web-search";
import { 
  processDocument, 
  searchDocuments, 
  getDocumentStats, 
  getMemoryStats, 
  clearDocument, 
  batchProcessDocuments 
} from "./routes/document-processing";

import { initializeDatabase } from "./database";

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createServer() {
  const app = express();

  // Initialize database
  initializeDatabase().catch(console.error);

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  app.use("/api/openai", openaiRouter);
  app.use("/api/gemini", geminiRouter);
  app.post("/api/pdf/process", handlePdfProcess);
  app.post("/api/upload", handleFileUpload);
  app.get("/api/files", getUploadedFiles);
  app.post("/api/process-documents", handleProcessDocuments);

  // Web search routes
  app.post("/api/web-search", handleWebSearch);
  app.post("/api/enhanced-search", handleEnhancedSearch);

  // Backend document processing routes
  app.post("/api/documents/process", processDocument);
  app.post("/api/documents/search", searchDocuments);
  app.get("/api/documents/:documentId/stats", getDocumentStats);
  app.get("/api/documents/memory-stats", getMemoryStats);
  app.delete("/api/documents/:documentId", clearDocument);
  app.post("/api/documents/batch-process", batchProcessDocuments);

  // Serve static files in production only
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../dist/spa');
    app.use(express.static(distPath));
    
    // Catch-all route for SPA in production
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api/")) {
        return res.status(404).json({ error: "API endpoint not found" });
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return app;
}
