import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService, ChatRequest, ChatResponse } from '../services/api';
import Navigation from '../components/Navigation';
import './Index.css';

// Chrome-optimized debounce utility function
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  };
};

// Chrome-optimized throttle utility function for UI updates
const throttle = (func: Function, limit: number) => {
  let inThrottle: boolean;
  return (...args: any[]) => {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Chrome-specific performance utilities
const chromeUtils = {
  // Use requestAnimationFrame for smooth UI updates
  requestAnimationFrame: (callback: () => void) => {
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      return window.requestAnimationFrame(callback);
    } else {
      return setTimeout(callback, 16); // ~60fps fallback
    }
  },

  // Yield control to prevent blocking
  yield: () => new Promise(resolve => setTimeout(resolve, 0)),

  // Chrome-specific yielding with requestIdleCallback
  yieldIdle: () => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      return new Promise(resolve => {
        (window as any).requestIdleCallback(resolve, { timeout: 50 });
      });
    } else {
      return new Promise(resolve => setTimeout(resolve, 1));
    }
  },

  // Check if running in Chrome
  isChrome: () => {
    if (typeof window === 'undefined') return false;
    return /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent);
  }
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
  const [loadingStage, setLoadingStage] = useState<string>('');
  const [processingTime, setProcessingTime] = useState<number>(0);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [documentStats, setDocumentStats] = useState<any>(null);
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const processingRef = useRef<boolean>(false);

  const aiProviders: AIProvider[] = [
    { id: 'openai', name: 'OpenAI GPT-4', endpoint: '/api/openai/chat' },
    { id: 'gemini', name: 'Google Gemini', endpoint: '/api/gemini/chat' }
  ];

  // Chrome-optimized state updates using requestAnimationFrame
  const setStateOptimized = useCallback((setter: React.Dispatch<React.SetStateAction<any>>, value: any) => {
    chromeUtils.requestAnimationFrame(() => {
      setter(value);
    });
  }, []);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };

    checkMobile();
    window.addEventListener('resize', debounce(checkMobile, 250));
    return () => window.removeEventListener('resize', debounce(checkMobile, 250));
  }, []);

  // Chrome-optimized scroll to bottom
  const scrollToBottom = useCallback(() => {
    chromeUtils.requestAnimationFrame(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

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

  // Load documents from backend on component mount
  useEffect(() => {
    const loadDocumentsFromBackend = async () => {
      try {
        const documents = await apiService.getProcessedDocuments();
        const backendFiles: UploadedFile[] = documents.map(doc => ({
          id: doc.id.toString(),
          name: doc.name,
          size: 0, // Size not available from backend
          type: doc.fileType,
          content: doc.content,
          summary: doc.summary,
          processed: true,
          uploadedAt: new Date(doc.uploadDate)
        }));
        
        setUserFiles(backendFiles);
        console.log(`Loaded ${backendFiles.length} documents from backend`);
      } catch (error) {
        console.error('Failed to load documents from backend:', error);
      }
    };

    loadDocumentsFromBackend();
  }, []);

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



  // Fixed input change handler - directly update state
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value); // Direct state update
    
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  }, []);

  // Simplified chat submit handler
  const handleChatSubmit = useCallback(async () => {
    if (!inputValue.trim() || isLoading || isUploading) {
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue(''); // Clear input immediately
    setIsLoading(true);
    setLoadingStage('Processing your question...');

    try {
      // Prepare document context
      const documentContext = userFiles
        .filter(file => file.processed)
        .map(file => ({
          name: file.name,
          content: file.content || '',
          summary: file.summary || ''
        }));

      console.log(`Preparing chat request with ${documentContext.length} processed documents`);

      // Prepare chat history for context
      const chatHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Create chat request
      const chatRequest: ChatRequest = {
        message: userMessage.content,
        documents: documentContext,
        history: chatHistory,
        aiProvider: selectedAIProvider as 'openai' | 'gemini',
        searchWeb: searchWeb
      };

      console.log('Sending chat request:', chatRequest);
      
      const response = await apiService.sendChatMessage(chatRequest);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        responseTime: response.responseTime,
        sources: response.sources
      };

      setMessages(prev => [...prev, assistantMessage]);
      console.log('Chat response received successfully');

    } catch (error) {
      console.error('Chat submit error:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I apologize, but I encountered an error while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setLoadingStage('');
      setProcessingProgress(0);
    }
  }, [inputValue, isLoading, isUploading, userFiles, messages, selectedAIProvider, searchWeb]);

  // Fixed key press handler for Enter key
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() && !isLoading && !isUploading) {
        handleChatSubmit();
      }
    }
  }, [inputValue, isLoading, isUploading, handleChatSubmit]);

  // Chrome-optimized file upload with better error handling
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Prevent multiple simultaneous uploads
    if (processingRef.current) {
      alert('Please wait for the current upload to complete.');
      return;
    }

    processingRef.current = true;
    setIsUploading(true);
    const newFiles: UploadedFile[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileId = Date.now() + i;
        
        // Enhanced file size checking with different limits for different file types
        const maxSize = file.type === 'application/pdf' ? 50 * 1024 * 1024 : 10 * 1024 * 1024; // 50MB for PDFs, 10MB for others
        if (file.size > maxSize) {
          alert(`File ${file.name} is too large. Maximum size is ${Math.round(maxSize / (1024 * 1024))}MB.`);
          continue;
        }

        // Show processing status for large files
        if (file.size > 5 * 1024 * 1024) { // 5MB threshold
          setStateOptimized(setLoadingStage, `Processing large file: ${file.name}...`);
        }
        
        // Use the production API service with timeout for large files
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout for large files

        try {
          const result = await apiService.uploadFile(file);

          clearTimeout(timeoutId);

          if (result.success) {
            // Check if we have processed content from the backend
            if (result.processedFiles && result.processedFiles.length > 0) {
              const processedFile = result.processedFiles.find(pf => pf.name === file.name);
              if (processedFile && processedFile.success) {
                const uploadedFile: UploadedFile = {
                  id: fileId.toString(),
                  name: file.name,
                  size: file.size,
                  type: file.type,
                  processed: true,
                  uploadedAt: new Date(),
                  content: processedFile.content,
                  summary: processedFile.summary
                };
                newFiles.push(uploadedFile);
                console.log(`Successfully processed ${file.name} with ${processedFile.content.length} characters`);
              } else {
                console.error(`Failed to process ${file.name}:`, processedFile?.error);
                alert(`Failed to process ${file.name}: ${processedFile?.error || 'Unknown error'}`);
              }
            } else {
              // Fallback to old behavior if no processed content
              const uploadedFile: UploadedFile = {
                id: fileId.toString(),
                name: file.name,
                size: file.size,
                type: file.type,
                processed: true,
                uploadedAt: new Date(),
                content: `Content from ${file.name}`,
                summary: `Summary of ${file.name}`
              };
              newFiles.push(uploadedFile);
            }
          } else {
            console.error(`Failed to upload ${file.name}:`, result.error);
            alert(`Failed to upload ${file.name}: ${result.error}`);
          }
        } catch (error) {
          clearTimeout(timeoutId);
          console.error(`Error uploading ${file.name}:`, error);
          alert(`Error uploading ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      if (newFiles.length > 0) {
        setUserFiles(prev => [...prev, ...newFiles]);
        console.log(`Successfully uploaded ${newFiles.length} files`);
      }
    } finally {
      setIsUploading(false);
      processingRef.current = false;
      setLoadingStage('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [setStateOptimized]);

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



  // Chrome-optimized message rendering with React.memo
  const renderMessage = useCallback((message: Message) => {
    if (message.isDeleted) return null;

    const isEditing = editingMessageId === message.id;

    return (
      <div key={message.id} className={`message ${message.role}`}>
        <div className="message-content">
          {isEditing ? (
            <div className="edit-message">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    editMessage(message.id, editValue);
                  } else if (e.key === 'Escape') {
                    setEditingMessageId(null);
                    setEditValue('');
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
              <div className="message-text" dangerouslySetInnerHTML={{ __html: message.content.replace(/\n/g, '<br>') }} />
              {message.sources && message.sources.length > 0 && showSources && (
                <div className="message-sources">
                  <strong>Sources:</strong>
                  <ul>
                    {message.sources.map((source, index) => (
                      <li key={index}>{source}</li>
                    ))}
                  </ul>
                </div>
              )}
              {message.responseTime && (
                <div className="response-time">
                  Response time: {message.responseTime}ms
                </div>
              )}
            </>
          )}
        </div>
        {message.role === 'user' && !isEditing && (
          <div className="message-actions">
            <button
              className="edit-btn"
              onClick={() => {
                setEditingMessageId(message.id);
                setEditValue(message.content);
              }}
              title="Edit message"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              className="delete-btn"
              onClick={() => deleteMessage(message.id)}
              title="Delete message"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    );
  }, [editingMessageId, editValue, showSources, editMessage, deleteMessage]);

  // Chrome-optimized chat session rendering
  const renderChatSession = useCallback((session: ChatSession) => (
    <div
      key={session.id}
      className={`chat-session ${currentSessionId === session.id ? 'active' : ''}`}
      onClick={() => selectChatSession(session.id)}
    >
      <div className="session-info">
        <div className="session-title">{session.title}</div>
        <div className="session-meta">
          {session.documentCount} documents • {session.messages.length} messages
        </div>
      </div>
      <div className="session-actions">
        <button
          className="export-btn"
          onClick={(e) => {
            e.stopPropagation();
            exportChatSession(session.id);
          }}
          title="Export chat"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7,10 12,15 17,10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
        <button
          className="delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            deleteChatSession(session.id);
          }}
          title="Delete chat"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18"/>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  ), [currentSessionId, selectChatSession, exportChatSession, deleteChatSession]);

  // Memoized message list to prevent unnecessary re-renders
  const memoizedMessages = useMemo(() => {
    return messages.map(renderMessage);
  }, [messages, renderMessage]);

  // Memoized chat sessions to prevent unnecessary re-renders
  const memoizedChatSessions = useMemo(() => {
    return chatSessions.map(renderChatSession);
  }, [chatSessions, renderChatSession]);

  // Chrome-optimized submit handler
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    handleChatSubmit();
  }, [handleChatSubmit]);

  // Chrome-optimized mobile menu toggle
  const toggleMobileMenu = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  // Chrome-optimized AI provider change
  const handleAIProviderChange = useCallback((provider: string) => {
    setSelectedAIProvider(provider);
  }, []);

  // Chrome-optimized web search toggle
  const handleWebSearchToggle = useCallback(() => {
    setSearchWeb(prev => !prev);
  }, []);

  // Chrome-optimized sources toggle
  const handleSourcesToggle = useCallback(() => {
    setShowSources(prev => !prev);
  }, []);

  // Chrome-optimized file input click
  const handleFileInputClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Chrome-optimized clear files
  const handleClearFiles = useCallback(() => {
    setUserFiles([]);
    setDocumentStats(null);
  }, []);

  // Chrome-optimized sign out
  const handleSignOut = useCallback(() => {
    signOut();
  }, [signOut]);

  // Chrome-optimized performance indicator
  const renderPerformanceIndicator = useCallback(() => {
    if (processingTime > 0) {
      return (
        <div className="performance-indicator">
          <span>Processing time: {processingTime}ms</span>
          {chromeUtils.isChrome() && (
            <span className="chrome-optimized">Chrome Optimized</span>
          )}
        </div>
      );
    }
    return null;
  }, [processingTime]);

  return (
    <div className="chat-container">
      <Navigation />
      
      <div className="chat-main">
        <div className="chat-sidebar">
          <div className="sidebar-header">
            <h3>Chat History</h3>
            <button className="new-chat-btn" onClick={startNewChat}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New Chat
            </button>
          </div>
          
          <div className="chat-sessions">
            {memoizedChatSessions}
          </div>
        </div>
        
        <div className="chat-content">
          <div className="chat-header">
            <div className="chat-controls">
              <div className="ai-provider-selector">
                <label>AI Provider:</label>
                <select 
                  value={selectedAIProvider} 
                  onChange={(e) => handleAIProviderChange(e.target.value)}
                >
                  {aiProviders.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="search-options">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={searchWeb}
                    onChange={handleWebSearchToggle}
                  />
                  Web Search
                </label>
                
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={showSources}
                    onChange={handleSourcesToggle}
                  />
                  Show Sources
                </label>
              </div>
            </div>
            
            <div className="file-controls">
              <button className="upload-btn" onClick={handleFileInputClick}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17,8 12,3 7,8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Upload Files
              </button>
              
              {userFiles.length > 0 && (
                <button className="clear-btn" onClick={handleClearFiles}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18"/>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                  </svg>
                  Clear Files
                </button>
              )}
            </div>
          </div>
          
          <div className="chat-messages">
            {memoizedMessages}
            
            {isLoading && (
              <div className="loading-message">
                <div className="loading-indicator">
                  <div className="spinner"></div>
                  <div className="loading-text">
                    {loadingStage || 'Processing...'}
                    {processingProgress > 0 && (
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${processingProgress}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                </div>
                {renderPerformanceIndicator()}
              </div>
            )}
            
            {documentStats && (
              <div className="message assistant">
                <div className="message-content">
                  <div className="document-stats">
                    <h4>📊 Document Statistics</h4>
                    <div className="stats-grid">
                      <div className="stat-item">
                        <span className="stat-label">Total Pages:</span>
                        <span className="stat-value">{documentStats.totalPages}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Total Words:</span>
                        <span className="stat-value">{documentStats.totalWords.toLocaleString()}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Text Length:</span>
                        <span className="stat-value">{documentStats.totalTextLength.toLocaleString()}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Indexed Words:</span>
                        <span className="stat-value">{documentStats.indexedWords.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          
          <form className="chat-input-form" onSubmit={handleSubmit}>
            <div className="input-container">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyPress}
                placeholder="Ask me anything about your documents or research topics..."
                disabled={isLoading || isUploading}
                rows={1}
              />
              
              <button 
                type="submit" 
                disabled={!inputValue.trim() || isLoading || isUploading}
                className="send-btn"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22,2 15,22 11,13 2,9 22,2"/>
                </svg>
              </button>
            </div>
            
            {isUploading && (
              <div className="upload-status">
                <div className="upload-spinner"></div>
                <span>Uploading files...</span>
              </div>
            )}
          </form>
        </div>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.txt,.doc,.docx"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />
    </div>
  );
}
