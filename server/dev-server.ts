import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Import routes
import { handleFileUpload, getUploadedFiles, handleProcessDocuments, getProcessedDocuments } from "./routes/file-upload";
import { handlePdfProcess } from "./routes/pdf-process";
import { handleWebSearch } from "./routes/web-search";
import { processDocument, searchDocuments, getDocumentStats, getMemoryStats, clearDocument, batchProcessDocuments } from "./routes/document-processing";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize database
console.log('Initializing development server...');

// Example API routes
app.get("/api/ping", (_req, res) => {
  const ping = process.env.PING_MESSAGE ?? "ping";
  res.json({ message: ping });
});

app.post("/api/pdf/process", handlePdfProcess);
app.post("/api/upload", handleFileUpload);
app.get("/api/files", getUploadedFiles);
app.get("/api/documents", getProcessedDocuments);
app.post("/api/process-documents", handleProcessDocuments);

// Web search routes
app.post("/api/web-search", handleWebSearch);

// Backend document processing routes
app.post("/api/documents/process", processDocument);
app.post("/api/documents/search", searchDocuments);
app.get("/api/documents/:documentId/stats", getDocumentStats);
app.get("/api/documents/memory-stats", getMemoryStats);
app.delete("/api/documents/:documentId", clearDocument);
app.post("/api/documents/batch-process", batchProcessDocuments);

app.listen(PORT, () => {
  console.log(`🚀 Development API Server running on http://localhost:${PORT}`);
  console.log(`📚 Available endpoints:`);
  console.log(`   GET  /api/ping`);
  console.log(`   POST /api/upload`);
  console.log(`   GET  /api/files`);
  console.log(`   GET  /api/documents`);
  console.log(`   POST /api/web-search`);
  console.log(`   POST /api/pdf/process`);
  console.log(`   POST /api/documents/process`);
  console.log(`   POST /api/documents/search`);
});
