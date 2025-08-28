import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import './Settings.css';

interface SettingsFeedback {
  message: string;
  type: 'success' | 'error';
  visible: boolean;
}

interface AISettings {
  defaultProvider: string;
  openaiApiKey: string;
  geminiApiKey: string;
  maxTokens: number;
  temperature: number;
  searchWeb: boolean;
}

// Debounce utility function
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  };
};

export default function Settings() {
  const { theme, setTheme } = useTheme();
  
  const [settings, setSettings] = useState({
    autoSave: true,
    notifications: true,
    language: 'en',
    fontSize: 'medium',
    compactMode: false,
    showSources: true,
    enableMessageEditing: true,
    enableChatExport: true,
    enableChatImport: true
  });

  const [aiSettings, setAiSettings] = useState<AISettings>({
    defaultProvider: 'openai',
    openaiApiKey: '',
    geminiApiKey: '',
    maxTokens: 2048,
    temperature: 0.7,
    searchWeb: true
  });

  const [feedback, setFeedback] = useState<SettingsFeedback>({
    message: '',
    type: 'success',
    visible: false
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Refs to prevent memory leaks
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fontSizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Memoized settings to prevent unnecessary re-renders
  const memoizedSettings = useMemo(() => settings, [settings]);
  const memoizedAISettings = useMemo(() => aiSettings, [aiSettings]);

  // Safe localStorage operations with error handling
  const safeLocalStorage = {
    getItem: (key: string): any => {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      } catch (error) {
        console.error(`Error reading from localStorage (${key}):`, error);
        return null;
      }
    },
    setItem: (key: string, value: any): boolean => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        console.error(`Error writing to localStorage (${key}):`, error);
        return false;
      }
    },
    removeItem: (key: string): boolean => {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.error(`Error removing from localStorage (${key}):`, error);
        return false;
      }
    }
  };

  // Load saved settings from localStorage on mount (async)
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        
        // Use Promise.all for concurrent loading
        const [savedSettings, savedAISettings] = await Promise.all([
          new Promise(resolve => {
            setTimeout(() => resolve(safeLocalStorage.getItem('appSettings')), 0);
          }),
          new Promise(resolve => {
            setTimeout(() => resolve(safeLocalStorage.getItem('aiSettings')), 0);
          })
        ]);

        if (savedSettings && typeof savedSettings === 'object') {
          setSettings(prev => ({ ...prev, ...savedSettings as any }));
        }

        if (savedAISettings && typeof savedAISettings === 'object') {
          setAiSettings(prev => ({ ...prev, ...savedAISettings as any }));
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        showFeedback('Error loading saved settings', 'error');
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };

    loadSettings();
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      if (fontSizeTimeoutRef.current) {
        clearTimeout(fontSizeTimeoutRef.current);
      }
    };
  }, []);

  const showFeedback = useCallback((message: string, type: 'success' | 'error') => {
    // Clear existing timeout
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }

    setFeedback({ message, type, visible: true });
    
    // Set new timeout
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(prev => ({ ...prev, visible: false }));
    }, 3000);
  }, []);

  // Debounced localStorage save
  const debouncedSaveSettings = useMemo(
    () => debounce((key: string, value: any) => {
      safeLocalStorage.setItem(key, value);
    }, 300),
    []
  );

  const handleSettingChange = useCallback((key: string, value: any) => {
    try {
      const newSettings = { ...memoizedSettings, [key]: value };
      setSettings(newSettings);
      
      // Debounced save to prevent blocking UI
      debouncedSaveSettings('appSettings', newSettings);
      
      // Show feedback based on setting type
      const feedbackMessages: Record<string, string> = {
        autoSave: `Auto-save ${value ? 'enabled' : 'disabled'}`,
        notifications: `Notifications ${value ? 'enabled' : 'disabled'}`,
        language: `Language changed to ${value}`,
        fontSize: `Font size changed to ${value}`,
        compactMode: `Compact mode ${value ? 'enabled' : 'disabled'}`,
        showSources: `Source display ${value ? 'enabled' : 'disabled'}`,
        enableMessageEditing: `Message editing ${value ? 'enabled' : 'disabled'}`,
        enableChatExport: `Chat export ${value ? 'enabled' : 'disabled'}`,
        enableChatImport: `Chat import ${value ? 'enabled' : 'disabled'}`
      };

      const message = feedbackMessages[key];
      if (message) {
        showFeedback(message, 'success');
      }
    } catch (error) {
      console.error('Error saving setting:', error);
      showFeedback('Error saving setting', 'error');
    }
  }, [memoizedSettings, debouncedSaveSettings, showFeedback]);

  const handleAISettingChange = useCallback((key: string, value: any) => {
    try {
      const newAISettings = { ...memoizedAISettings, [key]: value };
      setAiSettings(newAISettings);
      
      // Debounced save
      debouncedSaveSettings('aiSettings', newAISettings);
      
      showFeedback(`AI setting updated: ${key}`, 'success');
    } catch (error) {
      console.error('Error saving AI setting:', error);
      showFeedback('Error saving AI setting', 'error');
    }
  }, [memoizedAISettings, debouncedSaveSettings, showFeedback]);

  const handleThemeChange = useCallback((newTheme: 'light' | 'dark') => {
    try {
      setTheme(newTheme);
      showFeedback(`Theme changed to ${newTheme} mode`, 'success');
    } catch (error) {
      console.error('Error changing theme:', error);
      showFeedback('Error changing theme', 'error');
    }
  }, [setTheme, showFeedback]);

  const resetSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Simulate async operation to prevent UI blocking
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const defaultSettings = {
        autoSave: true,
        notifications: true,
        language: 'en',
        fontSize: 'medium',
        compactMode: false,
        showSources: true,
        enableMessageEditing: true,
        enableChatExport: true,
        enableChatImport: true
      };
      
      const defaultAISettings: AISettings = {
        defaultProvider: 'openai',
        openaiApiKey: '',
        geminiApiKey: '',
        maxTokens: 2048,
        temperature: 0.7,
        searchWeb: true
      };

      setSettings(defaultSettings);
      setAiSettings(defaultAISettings);
      
      // Save in background
      Promise.all([
        new Promise(resolve => {
          setTimeout(() => {
            safeLocalStorage.setItem('appSettings', defaultSettings);
            resolve(true);
          }, 0);
        }),
        new Promise(resolve => {
          setTimeout(() => {
            safeLocalStorage.setItem('aiSettings', defaultAISettings);
            resolve(true);
          }, 0);
        })
      ]);
      
      showFeedback('Settings reset to defaults', 'success');
    } catch (error) {
      console.error('Error resetting settings:', error);
      showFeedback('Error resetting settings', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showFeedback]);

  const exportSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const exportData = {
        settings: memoizedSettings,
        aiSettings: memoizedAISettings,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'docnet-settings.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Cleanup URL after a delay
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      
      showFeedback('Settings exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting settings:', error);
      showFeedback('Error exporting settings', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [memoizedSettings, memoizedAISettings, showFeedback]);

  const importSettings = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        setIsLoading(true);
        
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const importData = JSON.parse(e.target?.result as string);
        
        if (importData.settings) {
          setSettings(importData.settings);
          // Save in background
          setTimeout(() => {
            safeLocalStorage.setItem('appSettings', importData.settings);
          }, 0);
        }
        
        if (importData.aiSettings) {
          setAiSettings(importData.aiSettings);
          // Save in background
          setTimeout(() => {
            safeLocalStorage.setItem('aiSettings', importData.aiSettings);
          }, 0);
        }
        
        showFeedback('Settings imported successfully', 'success');
      } catch (error) {
        console.error('Error importing settings:', error);
        showFeedback('Failed to import settings. Please check the file format.', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    
    reader.readAsText(file);
    event.target.value = '';
  }, [showFeedback]);

  const clearChatHistory = useCallback(async () => {
    if (window.confirm('Are you sure you want to clear all chat history? This action cannot be undone.')) {
      try {
        setIsLoading(true);
        
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 100));
        
        safeLocalStorage.removeItem('chatSessions');
        showFeedback('Chat history cleared', 'success');
      } catch (error) {
        console.error('Error clearing chat history:', error);
        showFeedback('Error clearing chat history', 'error');
      } finally {
        setIsLoading(false);
      }
    }
  }, [showFeedback]);

  const clearUploadedFiles = useCallback(async () => {
    if (window.confirm('Are you sure you want to clear all uploaded files? This action cannot be undone.')) {
      try {
        setIsLoading(true);
        
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 100));
        
        safeLocalStorage.removeItem('uploadedFiles');
        showFeedback('Uploaded files cleared', 'success');
      } catch (error) {
        console.error('Error clearing uploaded files:', error);
        showFeedback('Error clearing uploaded files', 'error');
      } finally {
        setIsLoading(false);
      }
    }
  }, [showFeedback]);

  // Debounced font size application
  const debouncedApplyFontSize = useMemo(
    () => debounce((fontSize: string) => {
      try {
        const root = document.documentElement;
        const sizes = {
          small: '14px',
          medium: '16px',
          large: '18px'
        };
        
        if (sizes[fontSize as keyof typeof sizes]) {
          root.style.fontSize = sizes[fontSize as keyof typeof sizes];
        }
      } catch (error) {
        console.error('Error applying font size:', error);
      }
    }, 200),
    []
  );

  // Apply font size with debouncing
  useEffect(() => {
    if (isInitialized) {
      debouncedApplyFontSize(settings.fontSize);
    }
  }, [settings.fontSize, isInitialized, debouncedApplyFontSize]);

  // Don't render until initialized
  if (!isInitialized) {
    return (
      <div className="settings-page">
        <div className="settings-container">
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}
      
      <div className="settings-container">
        <div className="settings-header">
          <div className="header-content">
            <div className="header-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                <path d="M19.4 15A1.65 1.65 0 0 0 18 14.63C18 13.83 17.17 13 16.37 13C15.57 13 14.74 13.83 14.74 14.63C14.74 15.43 15.57 16.26 16.37 16.26C17.17 16.26 18 15.43 18 14.63" stroke="currentColor" strokeWidth="2"/>
                <path d="M2.21 10.6C2.21 9.8 3.04 8.97 3.84 8.97C4.64 8.97 5.47 9.8 5.47 10.6C5.47 11.4 4.64 12.23 3.84 12.23C3.04 12.23 2.21 11.4 2.21 10.6" stroke="currentColor" strokeWidth="2"/>
                <path d="M2.21 3.4C2.21 2.6 3.04 1.77 3.84 1.77C4.64 1.77 5.47 2.6 5.47 3.4C5.47 4.2 4.64 5.03 3.84 5.03C3.04 5.03 2.21 4.2 2.21 3.4" stroke="currentColor" strokeWidth="2"/>
                <path d="M10.6 2.21C10.6 1.41 11.43 0.58 12.23 0.58C13.03 0.58 13.86 1.41 13.86 2.21C13.86 3.01 13.03 3.84 12.23 3.84C11.43 3.84 10.6 3.01 10.6 2.21" stroke="currentColor" strokeWidth="2"/>
                <path d="M18.6 2.21C18.6 1.41 19.43 0.58 20.23 0.58C21.03 0.58 21.86 1.41 21.86 2.21C21.86 3.01 21.03 3.84 20.23 3.84C19.43 3.84 18.6 3.01 18.6 2.21" stroke="currentColor" strokeWidth="2"/>
                <path d="M21.79 10.6C21.79 9.8 20.96 8.97 20.16 8.97C19.36 8.97 18.53 9.8 18.53 10.6C18.53 11.4 19.36 12.23 20.16 12.23C20.96 12.23 21.79 11.4 21.79 10.6" stroke="currentColor" strokeWidth="2"/>
                <path d="M21.79 17.4C21.79 16.6 20.96 15.77 20.16 15.77C19.36 15.77 18.53 16.6 18.53 17.4C18.53 18.2 19.36 19.03 20.16 19.03C20.96 19.03 21.79 18.2 21.79 17.4" stroke="currentColor" strokeWidth="2"/>
                <path d="M10.6 21.79C10.6 20.99 11.43 20.16 12.23 20.16C13.03 20.16 13.86 20.99 13.86 21.79C13.86 22.59 13.03 23.42 12.23 23.42C11.43 23.42 10.6 22.59 10.6 21.79" stroke="currentColor" strokeWidth="2"/>
                <path d="M3.4 21.79C3.4 20.99 4.23 20.16 5.03 20.16C5.83 20.16 6.66 20.99 6.66 21.79C6.66 22.59 5.83 23.42 5.03 23.42C4.23 23.42 3.4 22.59 3.4 21.79" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <div className="header-text">
              <h1 className="page-title">Settings</h1>
              <p className="page-subtitle">Configure your DocNet experience</p>
            </div>
          </div>
        </div>

        {feedback.visible && (
          <div className={`feedback-message ${feedback.type}`}>
            {feedback.message}
          </div>
        )}

        <div className="settings-content">
          {/* General Settings */}
          <section className="settings-section">
            <h2 className="section-title">General Settings</h2>
            
            <div className="setting-group">
              <label className="setting-label">
                <span>Theme</span>
                <div className="theme-buttons">
                  <button
                    type="button"
                    className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => handleThemeChange('light')}
                    disabled={isLoading}
                  >
                    ☀️ Light
                  </button>
                  <button
                    type="button"
                    className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => handleThemeChange('dark')}
                    disabled={isLoading}
                  >
                    🌙 Dark
                  </button>
                </div>
              </label>
            </div>

            <div className="setting-group">
              <label className="setting-label">
                <span>Font Size</span>
                <select
                  value={settings.fontSize}
                  onChange={(e) => handleSettingChange('fontSize', e.target.value)}
                  className="setting-select"
                  disabled={isLoading}
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </label>
            </div>

            <div className="setting-group">
              <label className="setting-label">
                <span>Language</span>
                <select
                  value={settings.language}
                  onChange={(e) => handleSettingChange('language', e.target.value)}
                  className="setting-select"
                  disabled={isLoading}
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                </select>
              </label>
            </div>

            <div className="setting-group">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={settings.autoSave}
                  onChange={(e) => handleSettingChange('autoSave', e.target.checked)}
                  className="setting-checkbox"
                  disabled={isLoading}
                />
                <span>Auto-save chat sessions</span>
              </label>
            </div>

            <div className="setting-group">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={settings.notifications}
                  onChange={(e) => handleSettingChange('notifications', e.target.checked)}
                  className="setting-checkbox"
                  disabled={isLoading}
                />
                <span>Enable notifications</span>
              </label>
            </div>

            <div className="setting-group">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={settings.compactMode}
                  onChange={(e) => handleSettingChange('compactMode', e.target.checked)}
                  className="setting-checkbox"
                  disabled={isLoading}
                />
                <span>Compact mode</span>
              </label>
            </div>
          </section>

          {/* AI Settings */}
          <section className="settings-section">
            <h2 className="section-title">AI Configuration</h2>
            
            <div className="setting-group">
              <label className="setting-label">
                <span>Default AI Provider</span>
                <select
                  value={aiSettings.defaultProvider}
                  onChange={(e) => handleAISettingChange('defaultProvider', e.target.value)}
                  className="setting-select"
                  disabled={isLoading}
                >
                  <option value="openai">OpenAI GPT-4</option>
                  <option value="gemini">Google Gemini</option>
                </select>
              </label>
            </div>

            <div className="setting-group">
              <label className="setting-label">
                <span>OpenAI API Key</span>
                <input
                  type="password"
                  value={aiSettings.openaiApiKey}
                  onChange={(e) => handleAISettingChange('openaiApiKey', e.target.value)}
                  placeholder="sk-..."
                  className="setting-input"
                  disabled={isLoading}
                />
              </label>
            </div>

            <div className="setting-group">
              <label className="setting-label">
                <span>Gemini API Key</span>
                <input
                  type="password"
                  value={aiSettings.geminiApiKey}
                  onChange={(e) => handleAISettingChange('geminiApiKey', e.target.value)}
                  placeholder="AIza..."
                  className="setting-input"
                  disabled={isLoading}
                />
              </label>
            </div>

            <div className="setting-group">
              <label className="setting-label">
                <span>Max Tokens</span>
                <input
                  type="number"
                  value={aiSettings.maxTokens}
                  onChange={(e) => handleAISettingChange('maxTokens', parseInt(e.target.value))}
                  min="512"
                  max="4096"
                  step="512"
                  className="setting-input"
                  disabled={isLoading}
                />
              </label>
            </div>

            <div className="setting-group">
              <label className="setting-label">
                <span>Temperature</span>
                <input
                  type="range"
                  value={aiSettings.temperature}
                  onChange={(e) => handleAISettingChange('temperature', parseFloat(e.target.value))}
                  min="0"
                  max="1"
                  step="0.1"
                  className="setting-slider"
                  disabled={isLoading}
                />
                <span className="slider-value">{aiSettings.temperature}</span>
              </label>
            </div>

            <div className="setting-group">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={aiSettings.searchWeb}
                  onChange={(e) => handleAISettingChange('searchWeb', e.target.checked)}
                  className="setting-checkbox"
                  disabled={isLoading}
                />
                <span>Enable web search by default</span>
              </label>
            </div>
          </section>

          {/* Chat Features */}
          <section className="settings-section">
            <h2 className="section-title">Chat Features</h2>
            
            <div className="setting-group">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={settings.showSources}
                  onChange={(e) => handleSettingChange('showSources', e.target.checked)}
                  className="setting-checkbox"
                  disabled={isLoading}
                />
                <span>Show sources in responses</span>
              </label>
            </div>

            <div className="setting-group">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={settings.enableMessageEditing}
                  onChange={(e) => handleSettingChange('enableMessageEditing', e.target.checked)}
                  className="setting-checkbox"
                  disabled={isLoading}
                />
                <span>Enable message editing</span>
              </label>
            </div>

            <div className="setting-group">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={settings.enableChatExport}
                  onChange={(e) => handleSettingChange('enableChatExport', e.target.checked)}
                  className="setting-checkbox"
                  disabled={isLoading}
                />
                <span>Enable chat export</span>
              </label>
            </div>

            <div className="setting-group">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={settings.enableChatImport}
                  onChange={(e) => handleSettingChange('enableChatImport', e.target.checked)}
                  className="setting-checkbox"
                  disabled={isLoading}
                />
                <span>Enable chat import</span>
              </label>
            </div>
          </section>

          {/* Data Management */}
          <section className="settings-section">
            <h2 className="section-title">Data Management</h2>
            
            <div className="setting-group">
              <button 
                type="button"
                onClick={exportSettings} 
                className="action-btn"
                disabled={isLoading}
              >
                📤 Export Settings
              </button>
              <input
                type="file"
                accept=".json"
                onChange={importSettings}
                style={{ display: 'none' }}
                id="import-settings"
                disabled={isLoading}
              />
              <label htmlFor="import-settings" className={`action-btn ${isLoading ? 'disabled' : ''}`}>
                📥 Import Settings
              </label>
            </div>

            <div className="setting-group">
              <button 
                type="button"
                onClick={clearChatHistory} 
                className="action-btn danger"
                disabled={isLoading}
              >
                🗑️ Clear Chat History
              </button>
              <button 
                type="button"
                onClick={clearUploadedFiles} 
                className="action-btn danger"
                disabled={isLoading}
              >
                🗑️ Clear Uploaded Files
              </button>
            </div>

            <div className="setting-group">
              <button 
                type="button"
                onClick={resetSettings} 
                className="action-btn danger"
                disabled={isLoading}
              >
                🔄 Reset All Settings
              </button>
            </div>
          </section>

          {/* About */}
          <section className="settings-section">
            <h2 className="section-title">About DocNet</h2>
            <div className="about-content">
              <p><strong>Version:</strong> 1.0.0</p>
              <p><strong>Description:</strong> AI-powered research assistant with document analysis</p>
              <p><strong>Features:</strong></p>
              <ul>
                <li>Multi-AI provider support (OpenAI, Gemini)</li>
                <li>Document upload and analysis</li>
                <li>Web search integration</li>
                <li>Chat history management</li>
                <li>Export/import functionality</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}