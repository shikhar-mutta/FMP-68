import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import UserCard from '../components/UserCard';

const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';
const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutes in ms

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // ── Fetch other users ────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('fmp68_token');
    if (!token) return;

    axios
      .get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        // Exclude own profile from the list
        const others = res.data.filter((u) => u.id !== user?.id);
        setUsers(others);
      })
      .catch((err) => console.error('Failed to fetch users:', err))
      .finally(() => setLoadingUsers(false));
  }, [user]);

  // ── Auto sign-out after 30 min inactivity ────────────────
  useEffect(() => {
    let timer;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        console.warn('Auto sign-out: 30 minutes of inactivity.');
        signOut();
      }, INACTIVITY_LIMIT);
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll', 'click'];
    events.forEach((e) => window.addEventListener(e, resetTimer));

    // Start the timer immediately
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [signOut]);

  const onlineCount = users.filter((u) => u.isOnline).length;
  const offlineCount = users.filter((u) => !u.isOnline).length;

  return (
    <>
      <Navbar />
      <main className="dashboard">
        <div className="container">
          <header className="dashboard-header">
            <h1 className="dashboard-title">
              Welcome back, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="dashboard-desc">
              {users.length} other user{users.length !== 1 ? 's' : ''}&nbsp;·&nbsp;
              <span style={{ color: 'var(--accent-green)' }}>{onlineCount} online</span>
              &nbsp;·&nbsp;
              <span style={{ color: 'var(--text-muted)' }}>{offlineCount} offline</span>
            </p>
          </header>

          {loadingUsers ? (
            <div className="spinner-overlay">
              <div className="spinner" />
            </div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <p className="empty-title">No other users yet</p>
              <p className="empty-subtitle">Share this app so others can join!</p>
            </div>
          ) : (
            <div className="users-grid">
              {users.map((u, i) => (
                <UserCard key={u.id} user={u} index={i} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
