import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /** Load user from stored JWT on first mount */
  useEffect(() => {
    const token = localStorage.getItem('fmp68_token');
    if (!token) {
      setLoading(false);
      return;
    }

    axios
      .get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem('fmp68_token'))
      .finally(() => setLoading(false));
  }, []);

  /** Redirect to backend Google OAuth endpoint */
  const signInWithGoogle = useCallback(() => {
    window.location.href = `${API}/auth/google`;
  }, []);

  /** Call backend signout + clear local state */
  const signOut = useCallback(async () => {
    const token = localStorage.getItem('fmp68_token');
    try {
      await axios.post(`${API}/auth/signout`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Ignore errors, still clear local state
    }
    localStorage.removeItem('fmp68_token');
    setUser(null);
  }, []);

  /** Store token after Google redirect callback */
  const handleCallback = useCallback(async (token) => {
    localStorage.setItem('fmp68_token', token);
    const res = await axios.get(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setUser(res.data);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, signInWithGoogle, signOut, handleCallback }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
