import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FileService } from '../services/supabase';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  responseTime?: number;
  sources?: {
    documents: DocumentSource[];
    web: WebSource[];
  };
  evidenceType?: 'documents' | 'web' | 'mixed';
  noDocEvidence?: boolean;
}

interface DocumentSource {
  id: string;
  title: string;
  chunk: string;
  relevance: number;
  chunkId: string;
}

interface WebSource {
  title: string;
  snippet: string;
  url: string;
  source: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [selectedAIProvider, setSelectedAIProvider] = useState('openai');
  const [searchWeb, setSearchWeb] = useState(true);
  const [showSources, setShowSources] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [userFiles, setUserFiles] = useState<any[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // AI Providers
  const aiProviders = [
    { id: 'openai', name: 'OpenAI GPT-4' },
    { id: 'gemini', name: 'Google Gemini' }
  ];

  // Load user files on component mount
  useEffect(() => {
    if (user) {
      loadUserFiles();
    }
  }, [user]);

  const loadUserFiles = async () => {
    if (user) {
      const files = await FileService.getUserFiles(user.id);
      setUserFiles(files);
    }
  };

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue, adjustTextareaHeight]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  }, []);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() && !isLoading && user) {
        handleSubmit();
      }
    }
  }, [inputValue, isLoading, user, handleSubmit]);

  // Call RAG API
  const callRAGAPI = async (query: string): Promise<any> => {
    try {
      const response = await fetch('/.netlify/functions/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          userId: user?.id || 'guest',
          webSearch: searchWeb,
          aiProvider: selectedAIProvider,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('RAG API call failed:', error);
      throw error;
    }
  };

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!inputValue.trim() || isLoading || !user) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Call RAG API
      const ragResponse = await callRAGAPI(userMessage.content);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: ragResponse.answer,
        timestamp: new Date(),
        responseTime: ragResponse.responseTime,
        sources: ragResponse.sources,
        evidenceType: ragResponse.evidenceType,
        noDocEvidence: ragResponse.noDocEvidence
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Save chat session
      if (currentSession) {
        const updatedSession = {
          ...currentSession,
          messages: [...currentSession.messages, userMessage, assistantMessage],
          updatedAt: new Date()
        };
        setCurrentSession(updatedSession);
        await FileService.saveChatSession(updatedSession, user.id);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your request. Please try again.',
        timestamp: new Date(),
        evidenceType: 'web'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, user, searchWeb, selectedAIProvider, currentSession]);

  // Handle message editing
  const editMessage = useCallback((messageId: string, newContent: string) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, content: newContent } : msg
    ));
    setEditingMessageId(null);
    setEditValue('');
  }, []);

  // Handle message deletion
  const deleteMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  }, []);

  // Start new chat
  const startNewChat = useCallback(() => {
    setMessages([]);
    setCurrentSession(null);
  }, []);

  // Render message
  const renderMessage = useCallback((message: Message) => {
    const isEditing = editingMessageId === message.id;

    return (
      <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-3xl px-4 py-3 rounded-2xl ${
          message.role === 'user' 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-100 text-gray-900'
        }`}>
          {isEditing ? (
            <div className="space-y-3">
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
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <div className="flex gap-2">
                <button 
                  onClick={() => editMessage(message.id, editValue)}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save
                </button>
                <button 
                  onClick={() => {
                    setEditingMessageId(null);
                    setEditValue('');
                  }}
                  className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="whitespace-pre-wrap">{message.content}</div>
              
              {message.evidenceType && (
                <div className="mt-2 text-xs opacity-75">
                  {message.evidenceType === 'documents' && '📄 Using your documents'}
                  {message.evidenceType === 'web' && '🌐 Web search'}
                  {message.evidenceType === 'mixed' && '📄🌐 Documents + Web'}
                </div>
              )}

              {message.noDocEvidence && (
                <div className="mt-2 text-xs text-orange-600">
                  ⚠️ No relevant document evidence found, using web sources
                </div>
              )}

              {message.sources && showSources && (
                <div className="mt-3 p-3 bg-white bg-opacity-10 rounded-lg">
                  <div className="text-xs font-medium mb-2">Sources:</div>
                  
                  {message.sources.documents && message.sources.documents.length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs font-medium text-blue-600">📄 Documents:</div>
                      <ul className="text-xs space-y-1">
                        {message.sources.documents.map((doc, index) => (
                          <li key={index} className="text-blue-500">
                            {doc.title} (relevance: {(doc.relevance * 100).toFixed(1)}%)
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {message.sources.web && message.sources.web.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-green-600">🌐 Web Sources:</div>
                      <ul className="text-xs space-y-1">
                        {message.sources.web.map((web, index) => (
                          <li key={index} className="text-green-500">
                            {web.title} - {web.source}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {message.responseTime && (
                <div className="mt-2 text-xs opacity-75">
                  Response time: {message.responseTime}ms
                </div>
              )}
            </>
          )}
        </div>

        {message.role === 'user' && !isEditing && (
          <div className="flex flex-col gap-1">
            <button
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              onClick={() => {
                setEditingMessageId(message.id);
                setEditValue(message.content);
              }}
              title="Edit message"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              onClick={() => deleteMessage(message.id)}
              title="Delete message"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

  // Memoized message list
  const memoizedMessages = useMemo(() => {
    return messages.map(renderMessage);
  }, [messages, renderMessage]);

  return (
    <div className="flex flex-col h-full">
      {/* Chat Controls */}
      <div className="border-b border-gray-200 p-4 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">AI Provider:</label>
              <select
                value={selectedAIProvider}
                onChange={(e) => setSelectedAIProvider(e.target.value)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {aiProviders.map(provider => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                📄 {userFiles.length} document(s) uploaded
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={searchWeb}
                onChange={(e) => setSearchWeb(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              Web Search
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showSources}
                onChange={(e) => setShowSources(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              Show Sources
            </label>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {memoizedMessages}

        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-3xl px-4 py-3 bg-gray-100 text-gray-900 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                <span className="text-sm">Searching documents and generating response...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              placeholder="Ask me anything about your documents or research topics..."
              disabled={isLoading}
              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              rows={1}
            />
          </div>
          
          <button
            onClick={handleSubmit}
            disabled={!inputValue.trim() || isLoading}
            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22,2 15,22 11,13 2,9 22,2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
