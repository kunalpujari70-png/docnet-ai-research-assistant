import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Chat.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  responseTime?: number;
  sources?: string[];
  evidenceType?: 'documents' | 'web' | 'mixed';
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // AI Providers
  const aiProviders = [
    { id: 'openai', name: 'OpenAI GPT-4' },
    { id: 'gemini', name: 'Google Gemini' }
  ];

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
      handleSubmit();
    }
  }, []);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

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
      // TODO: Implement RAG pipeline here
      // 1. Vector search for relevant chunks
      // 2. Web search if enabled and no doc evidence
      // 3. Generate response with citations
      
      // Simulate API call for now
      await new Promise(resolve => setTimeout(resolve, 1000));

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I understand you're asking about "${userMessage.content}". This is a placeholder response while we implement the RAG pipeline.`,
        timestamp: new Date(),
        responseTime: 1000,
        evidenceType: 'web'
      };

      setMessages(prev => [...prev, assistantMessage]);
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
  }, [inputValue, isLoading]);

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
              
              {message.evidenceType && (
                <div className="evidence-badge">
                  {message.evidenceType === 'documents' && '📄 Using your documents'}
                  {message.evidenceType === 'web' && '🌐 Web search'}
                  {message.evidenceType === 'mixed' && '📄🌐 Documents + Web'}
                </div>
              )}
              
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
              className="action-btn edit-btn"
              onClick={() => {
                setEditingMessageId(message.id);
                setEditValue(message.content);
              }}
              title="Edit message"
              aria-label="Edit message"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              className="action-btn delete-btn"
              onClick={() => deleteMessage(message.id)}
              title="Delete message"
              aria-label="Delete message"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
    <div className="chat">
      {/* Chat Controls */}
      <div className="chat-controls">
        <div className="control-group">
          <label>AI Provider:</label>
          <select 
            value={selectedAIProvider} 
            onChange={(e) => setSelectedAIProvider(e.target.value)}
          >
            {aiProviders.map(provider => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="control-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={searchWeb}
              onChange={(e) => setSearchWeb(e.target.checked)}
            />
            Web Search
          </label>
          
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showSources}
              onChange={(e) => setShowSources(e.target.checked)}
            />
            Show Sources
          </label>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {memoizedMessages}
        
        {isLoading && (
          <div className="loading-message">
            <div className="loading-indicator">
              <div className="spinner"></div>
              <span>Processing...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="chat-input">
        <div className="input-container">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            placeholder="Ask me anything about your documents or research topics..."
            disabled={isLoading}
            rows={1}
          />
          
          <button 
            onClick={handleSubmit}
            disabled={!inputValue.trim() || isLoading}
            className="send-btn"
            aria-label="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22,2 15,22 11,13 2,9 22,2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
