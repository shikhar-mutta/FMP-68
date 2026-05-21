import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import UserCard from '../components/UserCard';
import PathPublishForm from '../components/PathPublishForm';
import PathCard from '../components/PathCard';
import FollowRequestsPanel from '../components/FollowRequestsPanel';

const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';
const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutes in ms

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [paths, setPaths] = useState([]);
  const [followedPathIds, setFollowedPathIds] = useState([]);
  const [loadingPaths, setLoadingPaths] = useState(true);
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'paths');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  // Selecting a tab on mobile closes the drawer; on desktop it's a no-op.
  const selectTab = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  const myPaths = paths.filter((p) => p.publisher?.id === user?.id);
  const otherPaths = paths.filter((p) => p.publisher?.id !== user?.id);

  const tabLabels = {
    paths: `📍 Paths (${otherPaths.length})`,
    'my-paths': `🗂️ My Paths (${myPaths.length})`,
    users: `👥 Users (${users.length})`,
    requests: `📬 Requests`,
  };

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
        const sorted = (res.data || []).slice().sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setPaths(sorted);
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
    setActiveTab('my-paths');
  };

  // ── Handle follow/unfollow path ──────────────────────────
  const handleFollowChange = (pathId, isFollowing) => {
    if (isFollowing) {
      setFollowedPathIds([...followedPathIds, pathId]);
    } else {
      setFollowedPathIds(followedPathIds.filter((id) => id !== pathId));
    }
  };

  // ── Handle request sent ──────────────────────────────────
  const handleRequestSent = (pathId) => {
    console.log('Request sent for path:', pathId);
  };

  // ── Handle path updated (republish) ──────────────────────
  const handlePathUpdated = (updatedPath) => {
    setPaths((prev) => prev.map((p) => (p.id === updatedPath.id ? updatedPath : p)));
  };

  // ── Handle path deleted ───────────────────────────────────
  const handlePathDeleted = (pathId) => {
    setPaths((prev) => prev.filter((p) => p.id !== pathId));
    setFollowedPathIds((prev) => prev.filter((id) => id !== pathId));
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

  const onlineCount = users.filter((u) => u.isOnline).length + 1; // +1 for current user
  const totalCount = users.length + 1;

  return (
    <>
      <Navbar onMenuOpen={() => setSidebarOpen(true)} />
      <main className="dashboard">
        <div className="container">
          <header className="dashboard-header">
            <div className="dashboard-header-row">
              <div>
                <h1 className="dashboard-title">
                  Welcome back, {user?.name?.split(' ')[0]} 👋
                </h1>
                <p className="dashboard-desc">
                  {totalCount} user{totalCount !== 1 ? 's' : ''}&nbsp;·&nbsp;
                  <span style={{ color: 'var(--accent-green)' }}>
                    {onlineCount} online
                  </span>
                </p>
              </div>
              <button
                className="header-publish-btn"
                onClick={() => setPublishOpen(true)}
                title="Publish New Path"
              >
                📍<br />Publish
              </button>
            </div>
          </header>

          {/* Backdrop — only rendered while the drawer is open on mobile. */}
          {sidebarOpen && (
            <div
              className="dashboard-tabs-overlay"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
          )}

          {/* Tab Navigation — desktop: horizontal bar; mobile: slide-out drawer */}
          <aside className={`dashboard-tabs ${sidebarOpen ? 'open' : ''}`}>
            {/* Profile header — hidden on desktop via CSS */}
            <div className="ds-profile">
              {user?.picture && (
                <img
                  className="ds-profile-avatar"
                  src={user.picture}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="ds-profile-info">
                <div className="ds-profile-name">
                  {user?.name?.split(' ').slice(0, 2).join(' ')}
                </div>
                <div className="ds-profile-role">Member</div>
              </div>
              <button
                className="dashboard-tabs-close"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close menu"
              >
                ←
              </button>
            </div>
            <button
              className={`tab-button ${activeTab === 'paths' ? 'active' : ''}`}
              onClick={() => selectTab('paths')}
            >
              📍 Paths ({otherPaths.length})
            </button>
            <button
              className={`tab-button ${activeTab === 'my-paths' ? 'active' : ''}`}
              onClick={() => selectTab('my-paths')}
            >
              🗂️ My Paths ({myPaths.length})
            </button>
            <button
              className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => selectTab('users')}
            >
              👥 Users ({users.length})
            </button>
            <button
              className={`tab-button ${activeTab === 'requests' ? 'active' : ''}`}
              onClick={() => selectTab('requests')}
            >
              📬 Requests
            </button>
            {/* Sign out — pushed to bottom of drawer (margin-top: auto via CSS) */}
            <button
              className="ds-signout"
              onClick={() => {
                setSidebarOpen(false);
                signOut();
              }}
            >
              🚪 Log Out
            </button>
          </aside>

          {/* Paths Tab */}
          {activeTab === 'paths' && (
            <div className="tab-content">
              {loadingPaths ? (
                <div className="spinner-overlay">
                  <div className="spinner" />
                </div>
              ) : otherPaths.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📍</div>
                  <p className="empty-title">No paths from others yet</p>
                  <p className="empty-subtitle">Paths published by other users will appear here.</p>
                </div>
              ) : (
                <div className="paths-grid">
                  {otherPaths.map((path) => (
                    <PathCard
                      key={path.id}
                      path={path}
                      isFollowing={followedPathIds.includes(path.id)}
                      onFollowChange={handleFollowChange}
                      currentUserId={user?.id}
                      onRequestSent={handleRequestSent}
                      onPathUpdated={handlePathUpdated}
                      onPathDeleted={handlePathDeleted}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* My Paths Tab */}
          {activeTab === 'my-paths' && (
            <div className="tab-content">
              <PathPublishForm onPathPublished={handlePathPublished} />

              {loadingPaths ? (
                <div className="spinner-overlay">
                  <div className="spinner" />
                </div>
              ) : myPaths.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🗂️</div>
                  <p className="empty-title">No paths published yet</p>
                  <p className="empty-subtitle">Use the form above to publish your first path!</p>
                </div>
              ) : (
                <div className="paths-grid">
                  {myPaths.map((path) => (
                    <PathCard
                      key={path.id}
                      path={path}
                      isFollowing={followedPathIds.includes(path.id)}
                      onFollowChange={handleFollowChange}
                      currentUserId={user?.id}
                      onRequestSent={handleRequestSent}
                      onPathUpdated={handlePathUpdated}
                      onPathDeleted={handlePathDeleted}
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

          {/* Received Follow Requests Tab */}
          {activeTab === 'requests' && (
            <div className="tab-content">
              <FollowRequestsPanel currentUserId={user?.id} />
            </div>
          )}
        </div>
      </main>

      {publishOpen && (
        <div className="publish-modal-overlay" onClick={() => setPublishOpen(false)}>
          <div className="publish-modal" onClick={(e) => e.stopPropagation()}>
            <PathPublishForm
              modal
              onClose={() => setPublishOpen(false)}
              onPathPublished={(newPath) => {
                handlePathPublished(newPath);
                setPublishOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

