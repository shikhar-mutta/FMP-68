import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PathDetailPage from './pages/PathDetailPage';
import LiveTrackingPage from './pages/LiveTrackingPage';
import AuthCallback from './pages/AuthCallback';
import Toast from './components/Toast';

export function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="spinner-overlay">
        <div className="spinner" />
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
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
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route path="/auth/callback" element={<AuthCallback />} />
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

