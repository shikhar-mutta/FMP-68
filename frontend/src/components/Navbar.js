import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  getPendingFollowRequests,
  approveFollowRequest,
  rejectFollowRequest,
} from '../services/followRequestService';
import {
  fetchMyNotifications,
  dismissNotification,
} from '../services/notificationService';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [approvalNotifs, setApprovalNotifs] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const dropdownRef = useRef(null);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getPendingFollowRequests();
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      // silently ignore
    }
  }, [user]);

  const fetchApprovalNotifs = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchMyNotifications();
      setApprovalNotifs(data);
    } catch {
      // silently ignore
    }
  }, [user]);

  useEffect(() => {
    fetchRequests();
    const id = setInterval(fetchRequests, 30_000);
    return () => clearInterval(id);
  }, [fetchRequests]);

  useEffect(() => {
    fetchApprovalNotifs();
    const id = setInterval(fetchApprovalNotifs, 30_000);
    return () => clearInterval(id);
  }, [fetchApprovalNotifs]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const handleApprove = async (pathId, followerId) => {
    const key = `${pathId}-${followerId}`;
    setProcessingId(key);
    try {
      await approveFollowRequest(pathId, followerId);
      setRequests((prev) =>
        prev.filter((r) => !(r.pathId === pathId && r.followerId === followerId))
      );
      if (window.showToast) window.showToast('Follow request approved!', 'success');
    } catch {
      if (window.showToast) window.showToast('Failed to approve request', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (pathId, followerId) => {
    const key = `${pathId}-${followerId}`;
    setProcessingId(key);
    try {
      await rejectFollowRequest(pathId, followerId);
      setRequests((prev) =>
        prev.filter((r) => !(r.pathId === pathId && r.followerId === followerId))
      );
      if (window.showToast) window.showToast('Follow request rejected', 'warning');
    } catch {
      if (window.showToast) window.showToast('Failed to reject request', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleApprovalNotifClick = async (notif) => {
    setDropdownOpen(false);
    try {
      await dismissNotification(notif.id);
      setApprovalNotifs((prev) => prev.filter((n) => n.id !== notif.id));
    } catch {
      // dismiss silently; navigate anyway
    }
    navigate(`/path/${notif.pathId}`);
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">FMP-68</div>

      {user && (
        <div className="navbar-user">
          <button
            className="btn btn-theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* Bell with inline dropdown */}
          <div className="navbar-bell-wrap" ref={dropdownRef}>
            <button
              className="navbar-bell"
              onClick={() => setDropdownOpen((v) => !v)}
              title="Notifications"
              aria-label={`${requests.length + approvalNotifs.length} notifications`}
            >
              🔔
              {(requests.length + approvalNotifs.length) > 0 && (
                <span className="navbar-bell-badge">
                  {(requests.length + approvalNotifs.length) > 99 ? '99+' : (requests.length + approvalNotifs.length)}
                </span>
              )}
            </button>

            {dropdownOpen && (
              <div className="notif-dropdown">
                {approvalNotifs.length > 0 && (
                  <>
                    <div className="notif-dropdown-header">
                      <span>Approvals</span>
                      <span className="notif-count-pill">{approvalNotifs.length}</span>
                    </div>
                    <ul className="notif-list">
                      {approvalNotifs.map((notif) => (
                        <li
                          key={notif.id}
                          className="notif-item notif-item--approval"
                          onClick={() => handleApprovalNotifClick(notif)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && handleApprovalNotifClick(notif)}
                        >
                          <div className="notif-item-info">
                            <span className="notif-approval-icon">✅</span>
                            <div className="notif-item-text">
                              <span>Your follow request for</span>
                              <strong>{notif.pathTitle}</strong>
                              <span>was approved!</span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                <div className="notif-dropdown-header">
                  <span>Follow Requests</span>
                  {requests.length > 0 && (
                    <span className="notif-count-pill">{requests.length}</span>
                  )}
                </div>

                {requests.length === 0 ? (
                  <p className="notif-empty">No pending requests</p>
                ) : (
                  <ul className="notif-list">
                    {requests.map((req) => {
                      const key = `${req.pathId}-${req.followerId}`;
                      const busy = processingId === key;
                      return (
                        <li key={key} className="notif-item">
                          <div className="notif-item-info">
                            {req.follower?.picture ? (
                              <img
                                className="notif-avatar"
                                src={req.follower.picture}
                                alt={req.follower.name}
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span className="notif-avatar notif-avatar--initials">
                                {req.follower?.name?.charAt(0).toUpperCase()}
                              </span>
                            )}
                            <div className="notif-item-text">
                              <strong>{req.follower?.name}</strong>
                              <span>wants to follow <em>{req.pathTitle}</em></span>
                            </div>
                          </div>
                          <div className="notif-item-actions">
                            <button
                              className="notif-btn notif-btn--approve"
                              onClick={() => handleApprove(req.pathId, req.followerId)}
                              disabled={busy}
                            >
                              ✓
                            </button>
                            <button
                              className="notif-btn notif-btn--reject"
                              onClick={() => handleReject(req.pathId, req.followerId)}
                              disabled={busy}
                            >
                              ✕
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {approvalNotifs.length === 0 && requests.length === 0 && (
                  <p className="notif-empty">No notifications</p>
                )}
              </div>
            )}
          </div>

          <div className="navbar-avatar-wrap">
            {user.picture && (
              <img
                className="navbar-avatar"
                src={user.picture}
                alt={user.name}
                referrerPolicy="no-referrer"
              />
            )}
            <span className="navbar-online-dot" title="You are online" />
          </div>
          <span className="navbar-name">{user.name}</span>

          <button
            id="signout-btn"
            className="btn btn-signout"
            onClick={signOut}
          >
            Sign Out
          </button>
        </div>
      )}
    </nav>
  );
}
