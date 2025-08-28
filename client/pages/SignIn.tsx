import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import './SignIn.css';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const { signIn, user } = useAuth();
  
  // Get the page user was trying to access
  const from = location.state?.from?.pathname || '/';

  // If user is already authenticated, redirect them
  if (user) {
    navigate(from, { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setIsLoading(true);
    setError('');
    console.log('Attempting to sign in with:', { email, password });

    try {
      if (isSignUp) {
        // For now, just show a message since we don't have real signup
        setError('Sign up functionality is not yet implemented. Please use guest access or contact support.');
        setIsSignUp(false);
      } else {
        console.log('Calling signIn function...');
        await signIn(email, password);
        console.log('Sign in completed, navigating to:', from);
        navigate(from, { replace: true });
      }
    } catch (error) {
      console.error('Sign in error:', error);
      setError(error instanceof Error ? error.message : 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestAccess = () => {
    const guestSession = {
      email: 'guest@example.com',
      isAuthenticated: true,
      isGuest: true,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('userSession', JSON.stringify(guestSession));
    
    // Force a page reload to ensure the auth context picks up the new session
    window.location.href = from;
  };

  return (
    <div className="signin-container">
      <div className="signin-card">
        <div className="signin-header">
          <div className="logo-container">
            <div className="logo-icon">•</div>
            <h1 className="logo-title">AI Research Portal</h1>
          </div>
          <p className="signin-subtitle">
            {isSignUp ? 'Create your account' : 'Sign in to continue'}
          </p>
        </div>

        <form className="signin-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              placeholder="Enter your email"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              placeholder="Enter your password"
              required
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="submit-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="loading-spinner">
                <div className="spinner"></div>
                <span>Processing...</span>
              </div>
            ) : (
              <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
            )}
          </button>
        </form>

        <div className="signin-footer">
          <button
            type="button"
            className="toggle-mode-btn"
            onClick={() => setIsSignUp(!isSignUp)}
            disabled={isLoading}
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>

          <div className="divider">
            <span>or</span>
          </div>

          <button
            type="button"
            className="guest-btn"
            onClick={handleGuestAccess}
            disabled={isLoading}
          >
            Continue as Guest
          </button>
        </div>

        <div className="features-preview">
          <h3>What you'll get:</h3>
          <ul className="features-list">
            <li>AI-powered research assistance</li>
            <li>Document analysis and insights</li>
            <li>Advanced search capabilities</li>
            <li>Mobile-optimized experience</li>
            <li>Dark/Light theme support</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
