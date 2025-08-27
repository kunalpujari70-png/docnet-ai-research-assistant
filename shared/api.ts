/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

/**
 * OpenAI AI API types
 */
export interface OpenAIRequest {
  prompt: string;
  context?: string;
  searchWeb?: boolean;
  templateId?: number;
  variables?: Record<string, string>;
  chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface OpenAIResponse {
  response: string;
  error?: string;
  sources?: string[];
  webResults?: WebSearchResult[];
  responseTime?: number;
}

/**
 * PDF Processing API types
 */
export interface PdfProcessRequest {
  pdfUrl: string;
  question?: string;
}

export interface PdfProcessResponse {
  content?: string;
  response?: string;
  error?: string;
}

/**
 * Web Search API types
 */
export interface WebSearchRequest {
  query: string;
  maxResults?: number;
  includeWeb?: boolean;
  includeAcademic?: boolean;
}

export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
  source: string;
}

export interface WebSearchResponse {
  results: WebSearchResult[];
  error?: string;
}



/**
 * Template API types
 */
export interface Template {
  id: number;
  name: string;
  description: string;
  outputType: string;
  promptTemplate: string;
  exampleInput: string;
  exampleOutput: string;
  category: string;
  isPublic: boolean;
  createdBy: string;
  createdAt: string;
}

export interface CreateTemplateRequest {
  name: string;
  description: string;
  outputType: string;
  promptTemplate: string;
  exampleInput?: string;
  exampleOutput?: string;
  category: string;
  isPublic?: boolean;
  createdBy?: string;
}

export interface TemplateResponse {
  templates: Template[];
  error?: string;
}
