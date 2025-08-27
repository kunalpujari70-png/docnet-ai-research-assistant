import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, error, clearError } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        color: 'var(--text-primary)',
        background: 'var(--bg-primary)'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid var(--border-color)',
          borderTop: '3px solid var(--accent-color)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '1rem'
        }}></div>
        <p>Loading your session...</p>
      </div>
    );
  }

  // Show error message if authentication failed
  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        color: 'var(--text-primary)',
        background: 'var(--bg-primary)',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <div style={{
          color: '#ef4444',
          marginBottom: '1rem',
          fontSize: '1.5rem'
        }}>
          ⚠️ Authentication Error
        </div>
        <p style={{ marginBottom: '1rem' }}>{error}</p>
        <button
          onClick={() => {
            clearError();
            window.location.href = '/signin';
          }}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'var(--accent-color)',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Go to Sign In
        </button>
      </div>
    );
  }

  // Redirect to sign-in if not authenticated
  if (!user) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  // Render the protected content if authenticated
  return <>{children}</>;
}
