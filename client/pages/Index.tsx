import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService, ChatRequest, ChatResponse } from '../services/api';
import Navigation from '../components/Navigation';
import './Index.css';

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
      }
    }
  }, []);

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

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  }, []);

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

      // Use the production API service
      const request: ChatRequest = {
        message: inputValue,
        documents: documentContext,
        history: chatHistory,
        aiProvider: selectedAIProvider as 'openai' | 'gemini',
        searchWeb
      };

      const response: ChatResponse = await apiService.sendChatMessage(request);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
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
      
      // Fallback response
      const fallbackResponse = `I apologize, but I encountered an error processing your request. Please try again, or if the problem persists, try refreshing the page.`;
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fallbackResponse,
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
              <h2>DocNet</h2>
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
                <button className="nav-btn logout-btn" onClick={handleLogout}>
                  🚪 Sign Out
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
              {user && (
                <div className="user-info">
                  <span>Welcome, {user.email}</span>
                  <button onClick={handleLogout}>
                    Sign Out
                  </button>
                </div>
              )}
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
                                className="action-btn"
                              >
                                ✏️
                              </button>
                              <button 
                                onClick={() => deleteMessage(message.id)}
                                className="action-btn delete"
                              >
                                🗑️
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
