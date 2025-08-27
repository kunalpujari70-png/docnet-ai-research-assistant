import "./global.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import Index from "./pages/Index";
import FileUpload from "./pages/FileUpload";
import Settings from "./pages/Settings";
import SignIn from "./pages/SignIn";
import NotFound from "./pages/NotFound";
import SimpleTest from "./pages/SimpleTest";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});

// Simple fallback component
const SimpleFallback = () => (
  <div style={{
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#000000',
    color: '#ffffff',
    padding: '2rem',
    textAlign: 'center'
  }}>
    <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>🚀 DocNet</h1>
    <p style={{ fontSize: '1.1rem', marginBottom: '2rem', maxWidth: '500px' }}>
      AI-powered research assistant with document analysis and web search
    </p>
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
      <button 
        onClick={() => window.location.href = '/signin'}
        style={{
          padding: '0.75rem 1.5rem',
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          fontSize: '1rem'
        }}
      >
        Sign In
      </button>
      <button 
        onClick={() => {
          localStorage.setItem('userSession', JSON.stringify({
            email: 'guest@example.com',
            isAuthenticated: true,
            isGuest: true,
            timestamp: new Date().toISOString()
          }));
          window.location.href = '/';
        }}
        style={{
          padding: '0.75rem 1.5rem',
          background: '#404040',
          color: 'white',
          border: 'none',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          fontSize: '1rem'
        }}
      >
        Continue as Guest
      </button>
    </div>
  </div>
);

const App = () => {
  return (
    <ErrorBoundary fallback={<SimpleFallback />}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                } />
                <Route path="/signin" element={<SignIn />} />
                <Route path="/upload" element={
                  <ProtectedRoute>
                    <FileUpload />
                  </ProtectedRoute>
                } />
                <Route path="/settings" element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                } />
                <Route path="/simple" element={
                  <ProtectedRoute>
                    <SimpleTest />
                  </ProtectedRoute>
                } />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
