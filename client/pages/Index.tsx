import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService, ChatRequest, ChatResponse } from '../services/api';
import Navigation from '../components/Navigation';
import './Index.css';

// Debounce utility function
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  };
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  responseTime?: number;
  sources?: string[];
  isEditing?: boolean;
  isDeleted?: boolean;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content?: string;
  summary?: string;
  processed: boolean;
  uploadedAt: Date;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  documentCount: number;
  lastUpdated: Date;
}

interface AIProvider {
  id: string;
  name: string;
  endpoint: string;
}

export default function Index() {
  const { user, signOut } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userFiles, setUserFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedAIProvider, setSelectedAIProvider] = useState<string>('openai');
  const [searchWeb, setSearchWeb] = useState(true);
  const [showSources, setShowSources] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const aiProviders: AIProvider[] = [
    { id: 'openai', name: 'OpenAI GPT-4', endpoint: '/api/openai/chat' },
    { id: 'gemini', name: 'Google Gemini', endpoint: '/api/gemini/chat' }
  ];

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize chat session
  useEffect(() => {
    const sessionId = Date.now().toString();
    setCurrentSessionId(sessionId);
    
    const newSession: ChatSession = {
      id: sessionId,
      title: 'New Chat',
      messages: [],
      createdAt: new Date(),
      documentCount: 0,
      lastUpdated: new Date()
    };
    
    setChatSessions([newSession]);
  }, []);

  // Load chat sessions from localStorage
  useEffect(() => {
    const savedSessions = localStorage.getItem('chatSessions');
    if (savedSessions) {
      try {
        const sessions = JSON.parse(savedSessions);
        setChatSessions(sessions);
        if (sessions.length > 0) {
          setCurrentSessionId(sessions[0].id);
          setMessages(sessions[0].messages || []);
        }
      } catch (error) {
        console.error('Error loading chat sessions:', error);
        // Clear corrupted data
        localStorage.removeItem('chatSessions');
      }
    }
  }, []);

  // Auto-save chat sessions whenever they change
  useEffect(() => {
    if (chatSessions.length > 0) {
      try {
        localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
      } catch (error) {
        console.error('Error saving chat sessions:', error);
      }
    }
  }, [chatSessions]);

  // Save chat sessions to localStorage
  useEffect(() => {
    if (chatSessions.length > 0) {
      localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
    }
  }, [chatSessions]);

  const formatTime = useCallback((timestamp: Date) => {
    if (!timestamp || !(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  const formatDate = useCallback((timestamp: Date) => {
    if (!timestamp || !(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
      return new Date().toLocaleDateString();
    }
    return timestamp.toLocaleDateString();
  }, []);

  // Debounced input handler to prevent excessive processing
  const debouncedInputChange = useCallback(
    debounce((value: string) => {
      setInputValue(value);
    }, 100),
    []
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    // Update immediately for UI responsiveness
    e.target.value = value;
    // Debounce the actual state update
    debouncedInputChange(value);
  }, [debouncedInputChange]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit();
    }
  }, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newFiles: UploadedFile[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileId = Date.now() + i;
        
        // Use the production API service
        const result = await apiService.uploadFile(file);

        if (result.success) {
          const uploadedFile: UploadedFile = {
            id: fileId.toString(),
            name: file.name,
            size: file.size,
            type: file.type,
            processed: true,
            uploadedAt: new Date(),
            content: result.content || `Content from ${file.name}`,
            summary: result.summary || `Summary of ${file.name}`
          };

          newFiles.push(uploadedFile);
        } else {
          console.error(`Failed to upload ${file.name}:`, result.error);
        }
      }

      setUserFiles(prev => [...prev, ...newFiles]);
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
      // Clear the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, []);

  const startNewChat = useCallback(() => {
    const sessionId = Date.now().toString();
    setCurrentSessionId(sessionId);
    setMessages([]);
    
    const newSession: ChatSession = {
      id: sessionId,
      title: 'New Chat',
      messages: [],
      createdAt: new Date(),
      documentCount: userFiles.length,
      lastUpdated: new Date()
    };
    
    setChatSessions(prev => [newSession, ...prev]);
    
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [userFiles.length, isMobile]);

  const selectChatSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
    const session = chatSessions.find(s => s.id === sessionId);
    if (session) {
      setMessages(session.messages || []);
    } else {
      setMessages([]);
    }
    
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [chatSessions, isMobile]);

  const deleteChatSession = useCallback((sessionId: string) => {
    setChatSessions(prev => prev.filter(s => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      startNewChat();
    }
  }, [currentSessionId, startNewChat]);

  const editMessage = useCallback((messageId: string, newContent: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, content: newContent, isEditing: false }
        : msg
    ));
    setEditingMessageId(null);
    setEditValue('');
  }, []);

  const deleteMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, isDeleted: true }
        : msg
    ));
  }, []);

  const handleChatSubmit = useCallback(async () => {
    if (!inputValue.trim() || isLoading) {
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setIsLoading(true);

    // Add a small delay to prevent UI blocking and show loading state
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      // Prepare document context
      const documentContext = userFiles
        .filter(file => file.processed)
        .map(file => ({
          name: file.name,
          content: file.content || '',
          summary: file.summary || ''
        }));

      // Prepare chat history for context
      const chatHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Enhanced request with better context handling
      const request: ChatRequest = {
        message: inputValue,
        documents: documentContext,
        history: chatHistory,
        aiProvider: selectedAIProvider as 'openai' | 'gemini',
        searchWeb: searchWeb || documentContext.length === 0 // Always search web if no documents
      };

      // Add timeout to prevent hanging requests
      const timeoutPromise = new Promise<ChatResponse>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 30000); // 30 second timeout
      });

      const response: ChatResponse = await Promise.race([
        apiService.sendChatMessage(request),
        timeoutPromise
      ]);

      // Enhanced response handling with better context awareness
      let enhancedResponse = response.response;
      
      // Check if the AI already added context prefixes (from our enhanced backend)
      const hasContextPrefix = response.response.startsWith('📄') || 
                              response.response.startsWith('🌐') || 
                              response.response.startsWith('🤔');
      
      if (!hasContextPrefix) {
        // Add context information to the response if not already present
        if (documentContext.length > 0 && response.documentsUsed && response.documentsUsed.length > 0) {
          enhancedResponse = `📄 **Based on your uploaded documents and web search:**\n\n${response.response}`;
        } else if (documentContext.length > 0 && searchWeb) {
          enhancedResponse = `🌐 **I couldn't find specific information in your uploaded documents, but here's what I found on the internet:**\n\n${response.response}`;
        } else if (documentContext.length === 0 && searchWeb) {
          enhancedResponse = `🌐 **Based on web search:**\n\n${response.response}`;
        } else if (documentContext.length > 0 && !searchWeb) {
          enhancedResponse = `📄 **Based on your uploaded documents:**\n\n${response.response}`;
        }
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: enhancedResponse,
        timestamp: new Date(),
        responseTime: response.responseTime,
        sources: response.sources
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);

      // Update current session
      if (currentSessionId) {
        setChatSessions(prev => prev.map(session => 
          session.id === currentSessionId 
            ? { 
                ...session, 
                messages: finalMessages,
                title: finalMessages[0]?.content.substring(0, 50) + '...' || 'New Chat',
                documentCount: userFiles.length,
                lastUpdated: new Date()
              }
            : session
        ));
      }

          } catch (error) {
        console.error('Chat error:', error);
        
        let errorContent = 'I apologize, but I encountered an error processing your request. Please try again, or if the problem persists, try refreshing the page.';
        
        // Provide more specific error messages
        if (error instanceof Error) {
          if (error.message.includes('timeout')) {
            errorContent = '⏱️ **Request Timeout:** The request took too long to process. This might be due to large documents or high server load. Please try again with a simpler query or fewer documents.';
          } else if (error.message.includes('API key') || error.message.includes('authentication')) {
            errorContent = '⚠️ **Authentication Error:** Please check your API keys in Settings. The AI service requires valid API credentials to function.';
          } else if (error.message.includes('network') || error.message.includes('fetch')) {
            errorContent = '🌐 **Network Error:** Unable to connect to the AI service. Please check your internet connection and try again.';
          } else if (error.message.includes('rate limit')) {
            errorContent = '⏱️ **Rate Limit Exceeded:** Too many requests. Please wait a moment and try again.';
          } else if (error.message.includes('document') || error.message.includes('file')) {
            errorContent = '📄 **Document Processing Error:** There was an issue processing your uploaded documents. Please try re-uploading them.';
          } else if (error.message.includes('context') || error.message.includes('insufficient')) {
            errorContent = '🤔 **Insufficient Context:** I don\'t have enough information from your uploaded documents to answer this question fully. Could you provide more details or upload additional relevant documents?';
          } else if (error.message.includes('performance') || error.message.includes('blocking')) {
            errorContent = '⚡ **Performance Issue:** The request is taking longer than expected. This might be due to large documents. Please try with fewer documents or a simpler query.';
          }
        }
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
        responseTime: 0,
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);

      // Update current session with fallback
      if (currentSessionId) {
        setChatSessions(prev => prev.map(session => 
          session.id === currentSessionId 
            ? { 
                ...session, 
                messages: finalMessages,
                title: finalMessages[0]?.content.substring(0, 50) + '...' || 'New Chat',
                documentCount: userFiles.length,
                lastUpdated: new Date()
              }
            : session
        ));
      }
      
      // Save chat session after error
      try {
        const updatedSessions = chatSessions.map(session => 
          session.id === currentSessionId 
            ? { 
                ...session, 
                messages: finalMessages,
                title: finalMessages[0]?.content.substring(0, 50) + '...' || 'New Chat',
                documentCount: userFiles.length,
                lastUpdated: new Date()
              }
            : session
        );
        localStorage.setItem('chatSessions', JSON.stringify(updatedSessions));
      } catch (saveError) {
        console.error('Error saving chat session:', saveError);
      }
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, userFiles, messages, currentSessionId, selectedAIProvider, searchWeb]);

  const exportChatSession = useCallback((sessionId: string) => {
    const session = chatSessions.find(s => s.id === sessionId);
    if (!session) return;

    const exportData = {
      session,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-session-${sessionId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [chatSessions]);

  const importChatSession = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target?.result as string);
        if (importData.session) {
          const importedSession = {
            ...importData.session,
            id: Date.now().toString(), // Generate new ID
            createdAt: new Date(importData.session.createdAt),
            lastUpdated: new Date()
          };
          
          setChatSessions(prev => [importedSession, ...prev]);
          setCurrentSessionId(importedSession.id);
          setMessages(importedSession.messages || []);
        }
      } catch (error) {
        console.error('Error importing chat session:', error);
        alert('Failed to import chat session. Please check the file format.');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleLogout = useCallback(async () => {
    await signOut();
  }, [signOut]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-page">
      <Navigation currentPage="home" />
      
      <div className="chatbot-container">
        {/* Sidebar */}
        <aside className={`chatbot-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <div className="sidebar-header">
            <div className="sidebar-brand">
              <h2>Chat History</h2>
            </div>
            <button 
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          <button className="new-chat-btn" onClick={startNewChat}>
            ➕ New Chat
          </button>

          <div className="chat-history">
            {chatSessions.map((session) => (
              <div
                key={session.id}
                className={`chat-session ${session.id === currentSessionId ? 'active' : ''}`}
              >
                <div 
                  className="session-content"
                  onClick={() => selectChatSession(session.id)}
                >
                  <div className="session-title">{session.title}</div>
                  <div className="session-meta">
                    {session.messages.length} messages • {formatTime(session.lastUpdated)}
                    {session.documentCount > 0 && (
                      <span> • 📄 {session.documentCount}</span>
                    )}
                  </div>
                </div>
                <div className="session-actions">
                  <button 
                    className="session-action-btn"
                    onClick={() => exportChatSession(session.id)}
                    title="Export chat"
                  >
                    📤
                  </button>
                  <button 
                    className="session-action-btn delete"
                    onClick={() => deleteChatSession(session.id)}
                    title="Delete chat"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="sidebar-footer">
            {user && (
              <div className="user-section">
                <div className="user-info-sidebar">
                  <span>{user.email}</span>
                </div>
                <button className="nav-btn" onClick={() => window.location.href = '/upload'}>
                  📁 Upload Documents
                </button>
                <button className="nav-btn" onClick={() => window.location.href = '/settings'}>
                  ⚙️ Settings
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {isMobile && sidebarOpen && (
          <div 
            className="sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Chat Area */}
        <main className="chatbot-main">
          <div className="chat-header">
            <div className="header-left">
              {isMobile ? (
                <button 
                  className="mobile-menu-btn"
                  onClick={() => setSidebarOpen(true)}
                >
                  ☰
                </button>
              ) : !sidebarOpen && (
                <button 
                  className="sidebar-toggle-main"
                  onClick={() => setSidebarOpen(true)}
                  title="Open sidebar"
                >
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
              <div>
                <h1 className="header-title">DocNet</h1>
                <p className="header-subtitle">AI Research Assistant</p>
                {userFiles.length > 0 && (
                  <div className="document-indicator">
                    📄 {userFiles.length} document{userFiles.length !== 1 ? 's' : ''} loaded
                  </div>
                )}
              </div>
            </div>
            <div className="header-controls">
              <div className="ai-provider-selector">
                <select 
                  value={selectedAIProvider}
                  onChange={(e) => setSelectedAIProvider(e.target.value)}
                  className="provider-select"
                >
                  {aiProviders.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="search-web-toggle">
                <input
                  type="checkbox"
                  checked={searchWeb}
                  onChange={(e) => setSearchWeb(e.target.checked)}
                />
                <span>🌐 Web Search</span>
              </label>
            </div>
          </div>

          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="welcome-screen">
                <h2>Welcome to DocNet</h2>
                <p>Upload documents and start a conversation to get intelligent research insights!</p>
                
                <div className="upload-section">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="upload-btn"
                  >
                    {isUploading ? 'Uploading...' : '📁 Upload Documents'}
                  </button>
                </div>

                {userFiles.length > 0 && (
                  <div className="uploaded-files">
                    <h3>Uploaded Documents:</h3>
                    {userFiles.map(file => (
                      <div key={file.id} className="file-item">
                        📄 {file.name} ({Math.round(file.size / 1024)}KB)
                      </div>
                    ))}
                  </div>
                )}

                <div className="import-section">
                  <input
                    type="file"
                    accept=".json"
                    onChange={importChatSession}
                    style={{ display: 'none' }}
                    id="import-chat"
                  />
                  <label htmlFor="import-chat" className="import-btn">
                    📥 Import Chat Session
                  </label>
                </div>

                <button
                  onClick={() => setInputValue("Hello! How can you help me with research?")}
                  className="sample-btn"
                >
                  Try a sample question
                </button>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`message ${message.role} ${message.isDeleted ? 'deleted' : ''}`}>
                  <div className="message-content">
                    {message.isEditing ? (
                      <div className="edit-message">
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              editMessage(message.id, editValue);
                            }
                          }}
                          autoFocus
                        />
                        <div className="edit-actions">
                          <button onClick={() => editMessage(message.id, editValue)}>Save</button>
                          <button onClick={() => {
                            setEditingMessageId(null);
                            setEditValue('');
                          }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="message-text">{message.content}</div>
                        {message.sources && message.sources.length > 0 && showSources && (
                          <div className="message-sources">
                            <h4>Sources:</h4>
                            <ul>
                              {message.sources.map((source, index) => (
                                <li key={index}>{source}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="message-footer">
                          <div className="message-time">
                            {formatTime(message.timestamp)}
                            {message.responseTime && (
                              <span> • {message.responseTime}ms</span>
                            )}
                          </div>
                          {message.role === 'user' && !message.isDeleted && (
                            <div className="message-actions">
                              <button 
                                onClick={() => {
                                  setEditingMessageId(message.id);
                                  setEditValue(message.content);
                                }}
                                className="action-btn edit-btn"
                                title="Edit message"
                              >
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
                                  <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M18.5 2.50023C18.8978 2.10297 19.4374 1.87891 20 1.87891C20.5626 1.87891 21.1022 2.10297 21.5 2.50023C21.8978 2.89749 22.1218 3.43705 22.1218 3.99973C22.1218 4.56241 21.8978 5.10197 21.5 5.49923L12 15.0002L8 16.0002L9 12.0002L18.5 2.50023Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </button>
                              <button 
                                onClick={() => deleteMessage(message.id)}
                                className="action-btn delete-btn"
                                title="Delete message"
                              >
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
                                  <path d="M3 6H5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </button>
                            </div>
                          )}
                          {message.sources && message.sources.length > 0 && (
                            <button 
                              onClick={() => setShowSources(!showSources)}
                              className="sources-toggle"
                            >
                              {showSources ? 'Hide' : 'Show'} Sources
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
            
            {isLoading && (
              <div className="message assistant">
                <div className="message-content">
                  <div className="loading-indicator">
                    <span>AI is thinking</span>
                    <div className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <form 
            className="input-form" 
            onSubmit={(e) => {
              e.preventDefault();
              handleChatSubmit();
            }}
          >
            <div className="input-container">
              <textarea
                className="message-input"
                value={inputValue}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Type your message here..."
                disabled={isLoading}
                rows={1}
              />
              <button
                type="submit"
                className="send-btn"
                disabled={isLoading || !inputValue.trim()}
              >
                ➤
              </button>
            </div>
            
            {userFiles.length > 0 && (
              <div className="file-upload-section">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="upload-btn-small"
                >
                  {isUploading ? '📤 Uploading...' : '📁 Add Files'}
                </button>
              </div>
            )}
          </form>
        </main>
      </div>
    </div>
  );
}
