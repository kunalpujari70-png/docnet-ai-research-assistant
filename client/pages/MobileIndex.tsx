import React, { useState, useEffect } from 'react';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  sources?: string[];
  responseTime?: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  lastUpdated: Date;
}

export default function MobileIndex() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchWeb, setSearchWeb] = useState(true);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showChatHistory, setShowChatHistory] = useState(false);

  useEffect(() => {
    loadChatSessions();
  }, []);

  const loadChatSessions = () => {
    try {
      const saved = localStorage.getItem('chatSessions');
      if (saved) {
        const sessions = JSON.parse(saved);
        setChatSessions(sessions);
        if (sessions.length > 0) {
          setCurrentSessionId(sessions[0].id);
          setChatMessages(sessions[0].messages);
        }
      }
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    }
  };

  const saveChatSessions = (sessions: ChatSession[]) => {
    try {
      localStorage.setItem('chatSessions', JSON.stringify(sessions));
    } catch (error) {
      console.error('Error saving chat sessions:', error);
    }
  };

  const updateCurrentSession = (messages: ChatMessage[]) => {
    if (!currentSessionId) return;
    
    const updatedSessions = chatSessions.map(session => 
      session.id === currentSessionId 
        ? { ...session, messages, lastUpdated: new Date() }
        : session
    );
    setChatSessions(updatedSessions);
    saveChatSessions(updatedSessions);
    setHasUnsavedChanges(false);
  };

  const createNewSession = () => {
    if (currentSessionId && chatMessages.length > 0) {
      updateCurrentSession(chatMessages);
    }
    
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: 'New Healing Session',
      messages: [],
      createdAt: new Date(),
      lastUpdated: new Date()
    };
    
    const updatedSessions = [newSession, ...chatSessions];
    setChatSessions(updatedSessions);
    saveChatSessions(updatedSessions);
    setCurrentSessionId(newSession.id);
    setChatMessages([]);
    setHasUnsavedChanges(false);
  };

  const switchToSession = (sessionId: string) => {
    if (currentSessionId && chatMessages.length > 0) {
      updateCurrentSession(chatMessages);
    }
    
    const session = chatSessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      setChatMessages(session.messages);
      setHasUnsavedChanges(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);
    setHasUnsavedChanges(true);

    try {
      const requestBody = {
        prompt: inputMessage,
        searchWeb,
        chatHistory: chatMessages.map(msg => ({
          role: msg.type as 'user' | 'assistant',
          content: msg.content
        }))
      };

      const response = await fetch('/api/openai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const result = await response.json();
        
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          content: result.response,
          timestamp: new Date(),
          sources: result.sources,
          responseTime: result.responseTime,
        };

        setChatMessages(prev => [...prev, aiMessage]);
        updateCurrentSession([...chatMessages, userMessage, aiMessage]);
      } else {
        console.error('Chat request failed');
      }
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const healingPrompts = [
    {
      title: "Create Trauma Healing Curriculum",
      prompt: "I need a personalized trauma healing curriculum for a person who [describe their background, trauma type, cultural/religious beliefs]. Please design a comprehensive healing program that incorporates evidence-based practices while respecting their cultural and spiritual background.",
    },
    {
      title: "Cultural Healing Integration",
      prompt: "How can I integrate traditional healing practices from [specific culture/religion] with modern trauma therapy approaches for someone dealing with [specific trauma type]?",
    },
    {
      title: "Personalized Recovery Plan",
      prompt: "Design a personalized recovery plan for someone with [specific trauma background] who follows [religion/culture] and prefers [healing approach preferences]. Include daily practices, weekly goals, and long-term milestones.",
    },
    {
      title: "Family Healing Framework",
      prompt: "Create a family healing framework for a [cultural background] family dealing with intergenerational trauma. Include individual and collective healing practices that honor their traditions.",
    }
  ];

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #f0f8ff 0%, #ffffff 50%, #f8f0ff 100%)',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Mobile Header */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid #e5e7eb',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        padding: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '2rem',
              height: '2rem',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              borderRadius: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '1.25rem'
            }}>
              🧠
            </div>
            <div>
              <h1 style={{
                fontSize: '1.25rem',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                margin: 0
              }}>
                Trauma Healing AI
              </h1>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
                Mobile Portal
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setShowChatHistory(!showChatHistory)}
              style={{
                padding: '0.5rem',
                background: '#f3f4f6',
                border: '1px solid #e5e7eb',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              💬
            </button>
            <a href="/upload" style={{
              padding: '0.5rem',
              background: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: '0.375rem',
              textDecoration: 'none',
              fontSize: '0.875rem'
            }}>
              📚
            </a>

          </div>
        </div>
      </div>

      {/* Mobile Content */}
      <div style={{ padding: '1rem' }}>
        <div style={{ 
          background: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          height: 'calc(100vh - 120px)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Chat Header */}
          <div style={{
            background: 'linear-gradient(135deg, #f0f8ff, #f8f0ff)',
            padding: '1rem',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.125rem', fontWeight: '600', color: '#1f2937' }}>
              💬 Healing AI Assistant
            </h2>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
              Create personalized trauma healing curricula
            </p>
          </div>

          {/* Chat Messages */}
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            {chatMessages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <div style={{
                  width: '3rem',
                  height: '3rem',
                  background: 'linear-gradient(135deg, #f0f8ff, #f8f0ff)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  fontSize: '1.5rem'
                }}>
                  🧠
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937', margin: '0 0 0.5rem 0' }}>
                  Welcome to Your Healing Journey
                </h3>
                <p style={{ color: '#6b7280', margin: '0 0 1rem 0', fontSize: '0.875rem' }}>
                  I'm here to help you create personalized trauma healing curricula.
                </p>
                
                {/* Mobile Prompt Suggestions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {healingPrompts.slice(0, 2).map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => setInputMessage(prompt.prompt)}
                      style={{
                        padding: '0.75rem',
                        textAlign: 'left',
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                      }}
                    >
                      <div style={{ fontWeight: '500', color: '#1f2937', marginBottom: '0.25rem' }}>
                        {prompt.title}
                      </div>
                      <p style={{ color: '#6b7280', margin: 0, lineHeight: '1.4', fontSize: '0.75rem' }}>
                        {prompt.prompt.substring(0, 80)}...
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              chatMessages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    display: 'flex',
                    justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div
                    style={{
                      maxWidth: '85%',
                      padding: '0.75rem',
                      borderRadius: '1rem',
                      fontSize: '0.875rem',
                      ...(message.type === 'user' ? {
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        color: 'white'
                      } : {
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
                      })
                    }}
                  >
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                      {message.content}
                    </div>
                    {message.type === 'ai' && message.sources && message.sources.length > 0 && (
                      <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #f3f4f6' }}>
                        <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.25rem 0' }}>Sources:</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                          {message.sources.slice(0, 2).map((source, index) => (
                            <span
                              key={index}
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.25rem 0.5rem',
                                background: '#f3f4f6',
                                borderRadius: '0.25rem',
                                color: '#374151'
                              }}
                            >
                              {source}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {message.type === 'ai' && message.responseTime && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                        Generated in {(message.responseTime / 1000).toFixed(1)}s
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Loading Indicator */}
            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '1rem',
                  padding: '0.75rem',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: '1.5rem',
                      height: '1.5rem',
                      background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      color: 'white'
                    }}>
                      🧠
                    </div>
                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Creating your healing curriculum...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Input Area */}
          <div style={{
            borderTop: '1px solid #e5e7eb',
            background: '#f9fafb',
            padding: '1rem'
          }}>
            <form onSubmit={handleChatSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Describe the person's trauma, cultural background, spiritual beliefs..."
                  style={{
                    width: '100%',
                    minHeight: '50px',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    resize: 'none',
                    fontFamily: 'inherit',
                    fontSize: '0.875rem',
                    outline: 'none'
                  }}
                  disabled={isLoading}
                />
              </div>
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                style={{
                  padding: '0.75rem',
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  opacity: (!inputMessage.trim() || isLoading) ? 0.5 : 1,
                  transition: 'opacity 0.2s'
                }}
              >
                {isLoading ? '⏳' : '📤'}
              </button>
            </form>
            
            {/* Mobile Quick Actions */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              marginTop: '0.75rem' 
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={searchWeb}
                  onChange={(e) => setSearchWeb(e.target.checked)}
                  style={{ margin: 0 }}
                />
                <span style={{ color: '#6b7280' }}>Include web research</span>
              </label>
              <button
                onClick={createNewSession}
                style={{
                  padding: '0.5rem',
                  background: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                ➕ New
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Chat History Sidebar */}
      {showChatHistory && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '80%',
            height: '100%',
            background: 'white',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #f0f8ff, #f8f0ff)',
              padding: '1rem',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>
                💬 Healing Sessions
              </h3>
              <button
                onClick={() => setShowChatHistory(false)}
                style={{
                  padding: '0.5rem',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.25rem'
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
              {chatSessions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#6b7280' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💬</div>
                  <p style={{ margin: 0, fontSize: '0.875rem' }}>No healing sessions yet</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {chatSessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => {
                        switchToSession(session.id);
                        setShowChatHistory(false);
                      }}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        ...(currentSessionId === session.id
                          ? {
                              background: 'linear-gradient(135deg, #f0f8ff, #f8f0ff)',
                              border: '1px solid #3b82f6'
                            }
                          : {
                              background: '#f9fafb',
                              border: '1px solid transparent'
                            })
                      }}
                    >
                      <div style={{ fontSize: '0.875rem', fontWeight: '500', color: '#1f2937', marginBottom: '0.25rem' }}>
                        {session.title}
                        {session.id === currentSessionId && hasUnsavedChanges && (
                          <span style={{ marginLeft: '0.25rem', color: '#f59e0b' }}>●</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {session.messages.length} messages
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
