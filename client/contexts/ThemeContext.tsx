import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  backgroundSecondary: string;
  backgroundAccent: string;
  text: string;
  textSecondary: string;
  textAccent: string;
  border: string;
  borderSecondary: string;
  primary: string;
  primaryHover: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  glass: string;
  glassStrong: string;
}

const lightTheme: ThemeColors = {
  background: '#ffffff',
  backgroundSecondary: '#f8fafc',
  backgroundAccent: '#f1f5f9',
  text: '#0f172a',
  textSecondary: '#475569',
  textAccent: '#3b82f6',
  border: '#e2e8f0',
  borderSecondary: '#cbd5e1',
  primary: '#3b82f6',
  primaryHover: '#2563eb',
  secondary: '#64748b',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  glass: 'rgba(255, 255, 255, 0.8)',
  glassStrong: 'rgba(255, 255, 255, 0.95)'
};

const darkTheme: ThemeColors = {
  background: '#0f172a',
  backgroundSecondary: '#1e293b',
  backgroundAccent: '#334155',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  textAccent: '#60a5fa',
  border: '#334155',
  borderSecondary: '#475569',
  primary: '#3b82f6',
  primaryHover: '#2563eb',
  secondary: '#94a3b8',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  glass: 'rgba(15, 23, 42, 0.8)',
  glassStrong: 'rgba(15, 23, 42, 0.95)'
};

interface ThemeContextType {
  theme: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const savedTheme = localStorage.getItem('theme') as ThemeMode;
    return savedTheme || 'light';
  });

  const colors = theme === 'light' ? lightTheme : darkTheme;

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.remove('light-theme', 'dark-theme');
    document.documentElement.classList.add(`${theme}-theme`);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

