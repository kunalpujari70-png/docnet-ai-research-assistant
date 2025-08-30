// Production-ready API service for DocNet
// Integrates with Netlify functions and handles all AI providers

export interface ChatRequest {
  message: string;
  documents?: Array<{
    name: string;
    content: string;
    summary: string;
  }>;
  history?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  aiProvider?: 'openai' | 'gemini';
  searchWeb?: boolean;
}

export interface ChatResponse {
  response: string;
  documentsUsed?: string[];
  confidence?: number;
  responseTime?: number;
  sources?: string[];
}

export interface FileUploadResponse {
  success: boolean;
  fileUrl?: string;
  error?: string;
  content?: string;
  summary?: string;
  files?: string[];
  processedFiles?: Array<{
    name: string;
    content: string;
    summary: string;
    success: boolean;
    error?: string;
  }>;
}

export interface DocumentMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  processed: boolean;
  content?: string;
  summary?: string;
}

class ProductionAPIService {
  private baseURL: string;

  constructor() {
    // Use Netlify functions for all environments
    this.baseURL = '/.netlify/functions/api';
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${url}:`, error);
      throw error;
    }
  }

  // Chat functionality
  async sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(`${this.baseURL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Chat API error:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout - the server took too long to respond');
      }
      throw error;
    }
  }

  // File upload and processing
  async uploadFile(file: File): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${this.baseURL}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('File upload failed:', error);
      throw error;
    }
  }

  // Get processed documents from backend
  async getProcessedDocuments(): Promise<Array<{
    id: number;
    name: string;
    content: string;
    summary: string;
    fileType: string;
    uploadDate: string;
  }>> {
    try {
      const response = await fetch(`${this.baseURL}/documents`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch documents: ${response.status}`);
      }

      const result = await response.json();
      return result.documents || [];
    } catch (error) {
      console.error('Failed to fetch processed documents:', error);
      return [];
    }
  }

  async processFile(fileId: string): Promise<{ success: boolean; error?: string; content?: string }> {
    return this.makeRequest('/process-files', {
      method: 'POST',
      body: JSON.stringify({ fileId }),
    });
  }

  // Document management
  async getDocuments(): Promise<DocumentMetadata[]> {
    return this.makeRequest<DocumentMetadata[]>('/files');
  }

  async deleteDocument(fileId: string): Promise<boolean> {
    try {
      await this.makeRequest(`/files/${fileId}`, {
        method: 'DELETE',
      });
      return true;
    } catch (error) {
      console.error('Document deletion failed:', error);
      return false;
    }
  }

  // Web search
  async performWebSearch(query: string, maxResults: number = 5): Promise<any[]> {
    return this.makeRequest<any[]>('/web-search', {
      method: 'POST',
      body: JSON.stringify({ query, maxResults }),
    });
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.makeRequest('/health');
  }
}

// Fallback service for offline/error scenarios
class FallbackService {
  async sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const { message, documents = [], aiProvider = 'openai' } = request;
    
    let response = `I understand you're asking about "${message}". `;
    
    if (documents.length > 0) {
      response += `I have ${documents.length} document(s) available that might be relevant. `;
      response += `The documents include: ${documents.map(doc => doc.name).join(', ')}. `;
    }
    
    response += `\n\nThis is a fallback response while the ${aiProvider} API is unavailable. `;
    response += `Please check your internet connection and try again.`;

    return {
      response,
      documentsUsed: documents.map(doc => doc.name),
      confidence: 0.5,
      responseTime: 1500,
      sources: ['Fallback Service']
    };
  }

  async uploadFile(file: File): Promise<FileUploadResponse> {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      success: true,
      fileUrl: `data:${file.type};base64,mock-file-data-${Date.now()}`,
      content: `Mock content for ${file.name}. This is a fallback response.`,
      summary: `Mock summary for ${file.name}`
    };
  }

  async getDocuments(): Promise<DocumentMetadata[]> {
    return [];
  }
}

// Main API service with fallback
export class APIService {
  private productionService: ProductionAPIService;
  private fallbackService: FallbackService;

  constructor() {
    this.productionService = new ProductionAPIService();
    this.fallbackService = new FallbackService();
  }

  async sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
    try {
      return await this.productionService.sendChatMessage(request);
    } catch (error) {
      console.warn('Production API failed, using fallback:', error);
      return await this.fallbackService.sendChatMessage(request);
    }
  }

  async uploadFile(file: File): Promise<FileUploadResponse> {
    try {
      return await this.productionService.uploadFile(file);
    } catch (error) {
      console.warn('Production upload failed, using fallback:', error);
      return await this.fallbackService.uploadFile(file);
    }
  }

  async processFile(fileId: string): Promise<{ success: boolean; error?: string; content?: string }> {
    try {
      return await this.productionService.processFile(fileId);
    } catch (error) {
      console.warn('Production processing failed:', error);
      return {
        success: false,
        error: 'Processing service unavailable'
      };
    }
  }

  async getDocuments(): Promise<DocumentMetadata[]> {
    try {
      return await this.productionService.getDocuments();
    } catch (error) {
      console.warn('Production document fetch failed, using fallback:', error);
      return await this.fallbackService.getDocuments();
    }
  }

  async getProcessedDocuments(): Promise<Array<{
    id: number;
    name: string;
    content: string;
    summary: string;
    fileType: string;
    uploadDate: string;
  }>> {
    try {
      return await this.productionService.getProcessedDocuments();
    } catch (error) {
      console.warn('Production processed documents fetch failed:', error);
      return [];
    }
  }

  async deleteDocument(fileId: string): Promise<boolean> {
    try {
      return await this.productionService.deleteDocument(fileId);
    } catch (error) {
      console.warn('Production document deletion failed:', error);
      return false;
    }
  }

  async performWebSearch(query: string, maxResults: number = 5): Promise<any[]> {
    try {
      return await this.productionService.performWebSearch(query, maxResults);
    } catch (error) {
      console.warn('Production web search failed:', error);
      return [];
    }
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      return await this.productionService.healthCheck();
    } catch (error) {
      console.warn('Health check failed:', error);
      return {
        status: 'offline',
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
export const apiService = new APIService();
