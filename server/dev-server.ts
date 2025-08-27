import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "./index";

const app = createServer();

const PORT = process.env.API_PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
  console.log(`📚 Available endpoints:`);
  console.log(`   GET  /api/ping`);
  console.log(`   GET  /api/demo`);
  console.log(`   POST /api/openai/chat`);
  console.log(`   POST /api/gemini/chat`);
  console.log(`   POST /api/upload`);
  console.log(`   GET  /api/files`);
  console.log(`   POST /api/web-search`);
  console.log(`   POST /api/pdf/process`);
});
