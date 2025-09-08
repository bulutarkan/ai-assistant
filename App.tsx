
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { ChatInterface } from './components/chat/ChatInterface';
import { ChatProvider } from './hooks/useChat';
import { BlogAIChatProvider } from './hooks/useBlogAIChat';
import { FilesProvider } from './hooks/useFiles';
import { ProjectsProvider } from './hooks/useProjects';
import { LoginPage } from './components/auth/LoginPage';
import { SignupPage } from './components/auth/SignupPage';
import GoogleOAuthCallback from './components/auth/GoogleOAuthCallback';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  // Clear localStorage on mount to remove demo data
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Clear old demo data
      localStorage.removeItem('chat-user');
      localStorage.removeItem('chat-conversations');
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Public Route Component (redirect to chat if authenticated)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AppContent: React.FC = () => {
  return (
    <ChatProvider>
      <BlogAIChatProvider>
        <FilesProvider>
          <ProjectsProvider>
            <ChatInterface />
          </ProjectsProvider>
        </FilesProvider>
      </BlogAIChatProvider>
    </ChatProvider>
  );
};

const App: React.FC = () => {
  // Initialize theme
  useTheme();

  return (
    <BrowserRouter>
      <main className="min-h-screen bg-dark-bg">
        <Routes>
          {/* Protected routes - require authentication */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppContent key={Date.now()} />
              </ProtectedRoute>
            }
          />

          {/* Public routes - redirect if authenticated */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicRoute>
                <SignupPage />
              </PublicRoute>
            }
          />
          <Route
            path="/oauth2callback"
            element={<GoogleOAuthCallback />}
          />

          {/* Catch all - redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
};

export default App;
