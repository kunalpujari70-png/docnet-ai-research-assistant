import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthService, AuthUser } from '../services/supabase';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const refreshUser = async () => {
    try {
      setError(null);
      
      // Try real Supabase auth first
      const currentUser = await AuthService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        return;
      }
      
      // Fallback to mock user session for development
      const userSession = localStorage.getItem('userSession');
      if (userSession) {
        try {
          const session = JSON.parse(userSession);
          const sessionAge = Date.now() - new Date(session.timestamp).getTime();
          const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours
          
          if (session.isAuthenticated && sessionAge < maxSessionAge) {
            setUser({
              id: session.isGuest ? 'guest-user' : 'mock-user-id',
              email: session.email,
              isGuest: session.isGuest,
            });
            return;
          } else {
            // Session expired, clear it
            localStorage.removeItem('userSession');
          }
        } catch (parseError) {
          console.error('Error parsing user session:', parseError);
          localStorage.removeItem('userSession');
        }
      }
      
      setUser(null);
    } catch (error) {
      console.error('Error refreshing user:', error);
      setError('Failed to refresh authentication. Please sign in again.');
      setUser(null);
    }
  };

  const signOut = async () => {
    try {
      // Try real Supabase sign out first
      await AuthService.signOut();
    } catch (error) {
      console.log('Supabase sign out failed, using mock sign out');
    }
    
    // Always clear local session
    localStorage.removeItem('userSession');
    setUser(null);
    setError(null);
  };

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      
      // Try real Supabase sign in first
      const authUser = await AuthService.signIn(email, password);
      if (authUser) {
        setUser(authUser);
        return;
      }
      
      // Fallback to mock sign in for development
      const userSession = {
        email,
        isAuthenticated: true,
        isGuest: false,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('userSession', JSON.stringify(userSession));
      
      setUser({
        id: 'mock-user-id',
        email: email,
        isGuest: false,
      });
    } catch (error) {
      console.error('Error signing in:', error);
      setError('Failed to sign in. Please check your credentials and try again.');
      setUser(null);
    }
  };

  useEffect(() => {
    // Check for existing session on mount
    refreshUser().finally(() => setLoading(false));

    // Set up periodic session refresh (every 30 minutes)
    const refreshInterval = setInterval(() => {
      if (user) {
        refreshUser();
      }
    }, 30 * 60 * 1000);

    // Listen for auth state changes
    const { data: { subscription } } = AuthService.onAuthStateChange((authUser) => {
      setUser(authUser);
      setLoading(false);
      setError(null);
    });

    // Listen for storage changes (for multi-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'userSession') {
        refreshUser();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(refreshInterval);
      // Fix: Add null check before calling unsubscribe
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user]);

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signOut,
    refreshUser,
    error,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
