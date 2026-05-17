import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PathDetailPage from './pages/PathDetailPage';
import LiveTrackingPage from './pages/LiveTrackingPage';
import AuthCallback from './pages/AuthCallback';
import Toast from './components/Toast';
import UsernameModal from './components/UsernameModal';

export function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="spinner-overlay">
        <div className="spinner" />
      </div>
    );
  }
  if (!user) {
    sessionStorage.setItem('fmp68_redirect_after_login', location.pathname + location.search);
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  const { user, loading } = useAuth();
  const { addToast } = useToast();

  // Store addToast globally for components that can't use hooks
  React.useEffect(() => {
    window.showToast = addToast;
  }, [addToast]);

  if (loading) {
    return (
      <div className="app-wrapper">
        <div className="spinner-overlay">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      <Toast />
      {user && !user.username && <UsernameModal />}
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route path="/oauth/callback" element={<AuthCallback />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/path/:pathId"
          element={
            <PrivateRoute>
              <PathDetailPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/path/:pathId/live"
          element={
            <PrivateRoute>
              <LiveTrackingPage />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

