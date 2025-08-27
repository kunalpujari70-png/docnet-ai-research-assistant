// Enhanced Supabase configuration and services
// This version uses real Netlify functions when available, with mock fallbacks

// Authentication services
export interface AuthUser {
  id: string;
  email: string;
  isGuest?: boolean;
}

export interface FileUploadResponse {
  success: boolean;
  fileUrl?: string;
  error?: string;
}

// Real API service for Netlify functions
class APIService {
  static async callAPI(endpoint: string, data?: any): Promise<any> {
    try {
      const response = await fetch(endpoint, {
        method: data ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API call to ${endpoint} failed:`, error);
      throw error;
    }
  }

  static async uploadFile(file: File): Promise<FileUploadResponse> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: result.success,
        fileUrl: result.fileUrl,
        error: result.error,
      };
    } catch (error) {
      console.error('Real upload failed, using mock:', error);
      // Fallback to mock upload
      return await MockFileService.uploadFile(file);
    }
  }

  static async processFile(fileId: string): Promise<{ success: boolean; error?: string; content?: string }> {
    try {
      const result = await this.callAPI('/api/process-files', { fileId });
      return {
        success: result.success,
        content: result.content,
        error: result.error,
      };
    } catch (error) {
      console.error('Real processing failed, using mock:', error);
      // Fallback to mock processing
      return await MockFileService.processFile(fileId);
    }
  }

  static async generateAIResponse(userQuestion: string, documentContext: any[], chatHistory: any[]): Promise<string> {
    try {
      const result = await this.callAPI('/api/openai/chat', {
        prompt: userQuestion, // Changed from userQuestion to prompt to match API expectation
        documentContext,
        chatHistory,
        hasDocuments: documentContext.length > 0,
      });

      return result.response || result.message || 'No response received';
    } catch (error) {
      console.error('Real AI response failed, using mock:', error);
      // Fallback to mock AI response
      return await MockAIAnalysisService.generateResponse(userQuestion, documentContext, chatHistory);
    }
  }
}

// Mock authentication service that works offline
export class AuthService {
  static async signIn(email: string, password: string): Promise<AuthUser> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock successful sign in
    const user = {
      id: 'mock-user-' + Date.now(),
      email: email,
    };
    
    // Store in localStorage for persistence
    localStorage.setItem('userSession', JSON.stringify({
      isAuthenticated: true,
      email: email,
      timestamp: new Date().toISOString(),
      isGuest: false
    }));
    
    return user;
  }

  static async signUp(email: string, password: string): Promise<AuthUser> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock successful sign up
    const user = {
      id: 'mock-user-' + Date.now(),
      email: email,
    };
    
    // Store in localStorage for persistence
    localStorage.setItem('userSession', JSON.stringify({
      isAuthenticated: true,
      email: email,
      timestamp: new Date().toISOString(),
      isGuest: false
    }));
    
    return user;
  }

  static async signOut(): Promise<void> {
    // Clear local storage
    localStorage.removeItem('userSession');
  }

  static async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const userSession = localStorage.getItem('userSession');
      if (userSession) {
        const session = JSON.parse(userSession);
        const sessionAge = Date.now() - new Date(session.timestamp).getTime();
        const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (session.isAuthenticated && sessionAge < maxSessionAge) {
          return {
            id: session.isGuest ? 'guest-user' : 'mock-user-id',
            email: session.email,
            isGuest: session.isGuest,
          };
        } else {
          // Session expired, clear it
          localStorage.removeItem('userSession');
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  static async getCurrentSession(): Promise<any | null> {
    try {
      const userSession = localStorage.getItem('userSession');
      return userSession ? JSON.parse(userSession) : null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  // Mock auth state change listener
  static onAuthStateChange(callback: (user: AuthUser | null) => void) {
    // Simulate auth state change
    setTimeout(() => {
      AuthService.getCurrentUser().then(callback);
    }, 100);
    
    return { data: { subscription: null } };
  }
}

// File management services
export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: string;
  userId: string;
  processed?: boolean;
  content?: string;
  summary?: string;
}

// Mock AI Analysis Service (fallback)
class MockAIAnalysisService {
  static async analyzeDocument(content: string, fileName: string): Promise<{ content: string; summary: string }> {
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
    
    // Extract key information from the document
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    const wordCount = content.split(/\s+/).length;
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Generate a smart summary
    const summary = this.generateSummary(content, fileName, wordCount, sentences.length);
    
    // Process and clean the content
    const processedContent = this.processContent(content);
    
    return {
      content: processedContent,
      summary: summary
    };
  }

  static generateSummary(content: string, fileName: string, wordCount: number, sentenceCount: number): string {
    const topics = this.extractTopics(content);
    const keyPoints = this.extractKeyPoints(content);
    
    return `Document Analysis: ${fileName}

📊 Overview:
- Word Count: ${wordCount}
- Sentences: ${sentenceCount}
- Main Topics: ${topics.join(', ')}

🔑 Key Points:
${keyPoints.map(point => `• ${point}`).join('\n')}

📝 Summary:
This document appears to be about ${topics[0] || 'various topics'}. It contains ${wordCount} words across ${sentenceCount} sentences, covering ${topics.length} main areas of discussion.`;
  }

  static extractTopics(content: string): string[] {
    const commonTopics = [
      'technology', 'business', 'science', 'health', 'education', 
      'finance', 'marketing', 'research', 'development', 'analysis',
      'strategy', 'management', 'innovation', 'data', 'research'
    ];
    
    const words = content.toLowerCase().split(/\s+/);
    const topicCounts: { [key: string]: number } = {};
    
    commonTopics.forEach(topic => {
      const count = words.filter(word => word.includes(topic)).length;
      if (count > 0) {
        topicCounts[topic] = count;
      }
    });
    
    return Object.keys(topicCounts)
      .sort((a, b) => topicCounts[b] - topicCounts[a])
      .slice(0, 5);
  }

  static extractKeyPoints(content: string): string[] {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const keySentences = sentences
      .filter(sentence => 
        sentence.includes('important') || 
        sentence.includes('key') || 
        sentence.includes('main') || 
        sentence.includes('primary') ||
        sentence.includes('significant') ||
        sentence.includes('critical')
      )
      .slice(0, 3);
    
    if (keySentences.length === 0) {
      return sentences.slice(0, 3).map(s => s.trim());
    }
    
    return keySentences.map(s => s.trim());
  }

  static processContent(content: string): string {
    // Clean and format the content
    return content
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  static async generateResponse(userQuestion: string, documentContext: any[], chatHistory: any[]): Promise<string> {
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    const hasDocuments = documentContext && documentContext.length > 0;
    const question = userQuestion.toLowerCase();
    
    if (!hasDocuments) {
      return this.generateGeneralResponse(question);
    }
    
    // Analyze the question and provide contextual response
    const relevantDocs = this.findRelevantDocuments(question, documentContext);
    
    if (relevantDocs.length === 0) {
      return this.generateGeneralResponse(question);
    }
    
    return this.generateContextualResponse(question, relevantDocs, documentContext);
  }

  static generateGeneralResponse(question: string): string {
    const responses = [
      `I understand you're asking about "${question}". I'm here to help you with your research! 

To provide more specific assistance, you can:
• Upload documents for me to analyze
• Ask specific questions about your research
• Request summaries or key insights
• Get help with data analysis

What would you like to focus on?`,

      `Great question! "${question}" is an interesting topic to explore.

I can help you with:
• Research analysis and insights
• Document summarization
• Key point extraction
• Comparative analysis
• Trend identification

Feel free to upload some documents and I'll provide detailed analysis based on your specific content.`,

      `Regarding "${question}", I'd be happy to help you dive deeper into this topic.

My capabilities include:
• Document analysis and insights
• Research synthesis
• Key finding identification
• Contextual understanding
• Cross-reference analysis

Upload your documents and I'll provide targeted insights based on your specific research materials.`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  static findRelevantDocuments(question: string, documents: any[]): any[] {
    const keywords = question.split(/\s+/).filter(word => word.length > 3);
    
    return documents.filter(doc => {
      const docText = (doc.content + ' ' + doc.summary + ' ' + doc.name).toLowerCase();
      return keywords.some(keyword => docText.includes(keyword));
    });
  }

  static generateContextualResponse(question: string, relevantDocs: any[], allDocs: any[]): string {
    const docNames = relevantDocs.map(doc => doc.name).join(', ');
    const totalDocs = allDocs.length;
    
    let response = `Based on your question about "${question}", I found relevant information in ${relevantDocs.length} of your ${totalDocs} uploaded document(s): ${docNames}.\n\n`;
    
    // Add specific insights based on the documents
    relevantDocs.forEach((doc, index) => {
      const keyInsights = this.extractKeyPoints(doc.content).slice(0, 2);
      response += `📄 **${doc.name}**:\n`;
      response += keyInsights.map(insight => `• ${insight}`).join('\n');
      response += '\n\n';
    });
    
    response += `Would you like me to:\n`;
    response += `• Provide a detailed analysis of specific aspects?\n`;
    response += `• Compare information across your documents?\n`;
    response += `• Generate a comprehensive summary?\n`;
    response += `• Answer specific questions about the content?`;
    
    return response;
  }
}

// Mock File Service (fallback)
class MockFileService {
  static async uploadFile(file: File): Promise<FileUploadResponse> {
    try {
      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create mock file URL
      const fileId = Date.now().toString();
      const mockUrl = `data:${file.type};base64,mock-file-data-${fileId}`;
      
      return {
        success: true,
        fileUrl: mockUrl,
      };
    } catch (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  static async processFile(fileId: string): Promise<{ success: boolean; error?: string; content?: string }> {
    try {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Generate mock content
      const mockContent = this.generateMockDocumentContent(`file-${fileId}`);
      
      // Use AI service to analyze the document
      const analysis = await MockAIAnalysisService.analyzeDocument(mockContent, `file-${fileId}`);
      
      return {
        success: true,
        content: analysis.content
      };
    } catch (error) {
      console.error('Error processing file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed'
      };
    }
  }

  static generateMockDocumentContent(fileName: string): string {
    const topics = [
      'artificial intelligence and machine learning applications in modern business',
      'sustainable development and environmental conservation strategies',
      'digital transformation and technological innovation in healthcare',
      'financial technology and blockchain implementation in banking',
      'cybersecurity and data protection in the digital age',
      'renewable energy and clean technology solutions',
      'supply chain optimization and logistics management',
      'customer experience and digital marketing strategies'
    ];
    
    const topic = topics[Math.floor(Math.random() * topics.length)];
    const sections = [
      `Executive Summary\n\nThis document provides a comprehensive analysis of ${topic}. The research conducted over the past year reveals significant insights into current trends and future implications for industry stakeholders.`,
      
      `Introduction\n\n${topic} represents one of the most critical areas of focus for organizations worldwide. This analysis examines key factors, challenges, and opportunities in this rapidly evolving field.`,
      
      `Key Findings\n\n• Market growth is projected at 15-20% annually over the next five years\n• Technology adoption rates vary significantly across different sectors\n• Regulatory frameworks are evolving to address emerging challenges\n• Investment in research and development has increased by 25%`,
      
      `Methodology\n\nOur research methodology involved extensive data collection from primary and secondary sources, including industry reports, expert interviews, and statistical analysis. The study encompassed over 500 organizations across multiple sectors.`,
      
      `Analysis and Results\n\nThe analysis reveals several important trends. First, there is a clear correlation between technological investment and organizational performance. Second, companies that prioritize innovation tend to outperform their competitors. Third, regulatory compliance remains a significant challenge for many organizations.`,
      
      `Recommendations\n\nBased on our findings, we recommend the following actions:\n1. Increase investment in technology infrastructure\n2. Develop comprehensive training programs for staff\n3. Establish clear governance frameworks\n4. Foster partnerships with technology providers`,
      
      `Conclusion\n\n${topic} continues to evolve rapidly, presenting both challenges and opportunities. Organizations that adapt quickly and invest strategically will be best positioned for long-term success.`
    ];
    
    return sections.join('\n\n');
  }
}

export class FileService {
  static async uploadFile(file: File, userId: string): Promise<FileUploadResponse> {
    try {
      // Try real API first
      const result = await APIService.uploadFile(file);
      
      if (result.success) {
        // Store file metadata in localStorage
        const files = JSON.parse(localStorage.getItem('userFiles') || '[]');
        const newFile = {
          id: Date.now().toString(),
          name: file.name,
          size: file.size,
          type: file.type,
          url: result.fileUrl || `data:${file.type};base64,mock-file-data-${Date.now()}`,
          uploadedAt: new Date().toISOString(),
          userId: userId,
          processed: false,
          content: '',
          summary: ''
        };
        
        files.push(newFile);
        localStorage.setItem('userFiles', JSON.stringify(files));
      }
      
      return result;
    } catch (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  static async getUserFiles(userId: string): Promise<FileMetadata[]> {
    try {
      const files = JSON.parse(localStorage.getItem('userFiles') || '[]');
      return files.filter((file: FileMetadata) => file.userId === userId);
    } catch (error) {
      console.error('Error fetching user files:', error);
      return [];
    }
  }

  static async deleteFile(fileId: string, userId: string): Promise<boolean> {
    try {
      const files = JSON.parse(localStorage.getItem('userFiles') || '[]');
      const updatedFiles = files.filter((file: FileMetadata) => !(file.id === fileId && file.userId === userId));
      localStorage.setItem('userFiles', JSON.stringify(updatedFiles));
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  static async getFileUrl(fileId: string): Promise<string | null> {
    try {
      const files = JSON.parse(localStorage.getItem('userFiles') || '[]');
      const file = files.find((f: FileMetadata) => f.id === fileId);
      return file?.url || null;
    } catch (error) {
      console.error('Error getting file URL:', error);
      return null;
    }
  }

  static async processFile(fileId: string): Promise<{ success: boolean; error?: string; content?: string }> {
    try {
      // Try real API first
      const result = await APIService.processFile(fileId);
      
      if (result.success) {
        // Update file in localStorage
        const files = JSON.parse(localStorage.getItem('userFiles') || '[]');
        const fileIndex = files.findIndex((f: FileMetadata) => f.id === fileId);
        
        if (fileIndex !== -1) {
          files[fileIndex] = {
            ...files[fileIndex],
            processed: true,
            content: result.content || files[fileIndex].content,
          };
          localStorage.setItem('userFiles', JSON.stringify(files));
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error processing file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed'
      };
    }
  }

  static async saveChatSession(session: any, userId: string): Promise<boolean> {
    try {
      const sessions = JSON.parse(localStorage.getItem(`chatSessions_${userId}`) || '[]');
      sessions.push(session);
      localStorage.setItem(`chatSessions_${userId}`, JSON.stringify(sessions));
      return true;
    } catch (error) {
      console.error('Error saving chat session:', error);
      return false;
    }
  }

  static async getChatSessions(userId: string): Promise<any[]> {
    try {
      const sessions = JSON.parse(localStorage.getItem(`chatSessions_${userId}`) || '[]');
      return sessions;
    } catch (error) {
      console.error('Error getting chat sessions:', error);
      return [];
    }
  }

  static async deleteChatSession(sessionId: string, userId: string): Promise<boolean> {
    try {
      const sessions = JSON.parse(localStorage.getItem(`chatSessions_${userId}`) || '[]');
      const updatedSessions = sessions.filter((session: any) => session.id !== sessionId);
      localStorage.setItem(`chatSessions_${userId}`, JSON.stringify(updatedSessions));
      return true;
    } catch (error) {
      console.error('Error deleting chat session:', error);
      return false;
    }
  }

  // Enhanced AI chat responses using real API
  static async generateAIResponse(userQuestion: string, documentContext: any[], chatHistory: any[]): Promise<string> {
    try {
      // Try real OpenAI API first
      return await APIService.generateAIResponse(userQuestion, documentContext, chatHistory);
    } catch (error) {
      console.error('Real AI service failed, using mock:', error);
      // Fallback to mock AI response
      return await MockAIAnalysisService.generateResponse(userQuestion, documentContext, chatHistory);
    }
  }
}

export class DatabaseService {
  static async insertFileMetadata(metadata: Omit<FileMetadata, 'id'>): Promise<string> {
    const id = Date.now().toString();
    const files = JSON.parse(localStorage.getItem('userFiles') || '[]');
    files.push({ ...metadata, id });
    localStorage.setItem('userFiles', JSON.stringify(files));
    return id;
  }

  static async updateFileMetadata(fileId: string, updates: Partial<FileMetadata>): Promise<void> {
    const files = JSON.parse(localStorage.getItem('userFiles') || '[]');
    const fileIndex = files.findIndex((f: FileMetadata) => f.id === fileId);
    if (fileIndex !== -1) {
      files[fileIndex] = { ...files[fileIndex], ...updates };
      localStorage.setItem('userFiles', JSON.stringify(files));
    }
  }
}

export const SUPABASE_CONFIG = {
  url: 'mock-supabase-url',
  anonKey: 'mock-anon-key',
  isConfigured: true,
};

export const supabase = {
  auth: {
    signIn: AuthService.signIn,
    signUp: AuthService.signUp,
    signOut: AuthService.signOut,
    getCurrentUser: AuthService.getCurrentUser,
    onAuthStateChange: AuthService.onAuthStateChange,
  },
  storage: {
    upload: FileService.uploadFile,
    download: FileService.getFileUrl,
  },
  from: () => ({
    select: () => ({
      eq: () => Promise.resolve({ data: [], error: null }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => Promise.resolve({ data: null, error: null }),
      delete: () => Promise.resolve({ data: null, error: null }),
    }),
  }),
};
