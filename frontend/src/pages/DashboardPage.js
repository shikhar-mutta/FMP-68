import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import UserCard from '../components/UserCard';
import PathPublishForm from '../components/PathPublishForm';
import PathCard from '../components/PathCard';

const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';
const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutes in ms

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [paths, setPaths] = useState([]);
  const [followedPathIds, setFollowedPathIds] = useState([]);
  const [loadingPaths, setLoadingPaths] = useState(true);
  const [activeTab, setActiveTab] = useState('paths'); // 'paths' or 'users'

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

  // ── Fetch all paths ──────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('fmp68_token');
    if (!token) return;

    axios
      .get(`${API}/paths`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setPaths(res.data || []);
        // Get followed paths for current user
        if (user?.id) {
          axios
            .get(`${API}/paths/followed/my-paths`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            .then((followRes) => {
              const followedIds = (followRes.data || []).map((p) => p.id);
              setFollowedPathIds(followedIds);
            })
            .catch((err) => console.error('Failed to fetch followed paths:', err));
        }
      })
      .catch((err) => console.error('Failed to fetch paths:', err))
      .finally(() => setLoadingPaths(false));
  }, [user]);

  // ── Handle path published ────────────────────────────────
  const handlePathPublished = (newPath) => {
    setPaths([newPath, ...paths]);
    setFollowedPathIds([...followedPathIds, newPath.id]);
  };

  // ── Handle follow/unfollow path ──────────────────────────
  const handleFollowChange = (pathId, isFollowing) => {
    if (isFollowing) {
      setFollowedPathIds([...followedPathIds, pathId]);
    } else {
      setFollowedPathIds(followedPathIds.filter((id) => id !== pathId));
    }
  };

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
              {paths.length} path{paths.length !== 1 ? 's' : ''}&nbsp;·&nbsp;
              {users.length} other user{users.length !== 1 ? 's' : ''}&nbsp;·&nbsp;
              <span style={{ color: 'var(--accent-green)' }}>
                {users.filter((u) => u.isOnline).length} online
              </span>
            </p>
          </header>

          {/* Tab Navigation */}
          <div className="dashboard-tabs">
            <button
              className={`tab-button ${activeTab === 'paths' ? 'active' : ''}`}
              onClick={() => setActiveTab('paths')}
            >
              📍 Paths ({paths.length})
            </button>
            <button
              className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              👥 Users ({users.length})
            </button>
          </div>

          {/* Paths Tab */}
          {activeTab === 'paths' && (
            <div className="tab-content">
              <PathPublishForm onPathPublished={handlePathPublished} />

              {loadingPaths ? (
                <div className="spinner-overlay">
                  <div className="spinner" />
                </div>
              ) : paths.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📍</div>
                  <p className="empty-title">No paths yet</p>
                  <p className="empty-subtitle">Be the first to publish a path!</p>
                </div>
              ) : (
                <div className="paths-grid">
                  {paths.map((path) => (
                    <PathCard
                      key={path.id}
                      path={path}
                      isFollowing={followedPathIds.includes(path.id)}
                      onFollowChange={handleFollowChange}
                      currentUserId={user?.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="tab-content">
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
          )}
        </div>
      </main>
    </>
  );
}
