import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  approveFollowRequest,
  rejectFollowRequest,
  getFollowRequestsForPath,
} from '../services/followRequestService';
import {
  getFollowersForPath,
  removeFollowerFromPath,
} from '../services/followerService';
import apiClient from '../services/api';
import { POLLING_INTERVALS } from '../config/constants';
import Navbar from '../components/Navbar';
import FollowersList from '../components/FollowersList';
import '../styles/PathDetail.css';

const STATUS_LABELS = {
  idle: { label: '⚪ Not Started', cls: 'status-idle' },
  recording: { label: '🔴 Live', cls: 'status-recording' },
  paused: { label: '⏸️ Paused', cls: 'status-paused' },
  ended: { label: '🏁 Ended', cls: 'status-ended' },
};

const PathDetailPage = () => {
  const { pathId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [path, setPath] = useState(null);
  const [followRequests, setFollowRequests] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const pollingRef = useRef(null);

  const isPublisher = user?.id && path?.publisherId === user.id;
  const isFollower = path?.followerIds?.includes(user?.id);
  const canLiveTrack = isPublisher || isFollower;

  // Fetch path and requests
  const fetchPathAndRequests = async (skipLoading = false) => {
    try {
      if (!skipLoading) setLoading(true);
      const pathData = await apiClient.get(`/paths/${pathId}`);
      setPath(pathData.data);
      const requestsRes = await getFollowRequestsForPath(pathId);
      setFollowRequests(requestsRes);
      setError(null);
    } catch (err) {
      console.error('Error fetching path details:', err);
      if (!skipLoading) setError(err.message || 'Failed to load path');
    } finally {
      if (!skipLoading) setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchPathAndRequests();
  }, [pathId]);

  // Polling for publisher to get new follow requests
  useEffect(() => {
    if (user?.id && path?.publisherId === user.id) {
      pollingRef.current = setInterval(() => {
        getFollowRequestsForPath(pathId)
          .then((requests) => setFollowRequests(requests))
          .catch((err) => console.error('Polling error:', err));
      }, POLLING_INTERVALS.PATH_REQUESTS);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [pathId, user?.id, path?.publisherId]);

  const handleApprove = async (userId) => {
    setProcessingId(userId);
    try {
      await approveFollowRequest(pathId, userId);
      setFollowRequests(followRequests.filter((req) => req.followerId !== userId));
      if (window.showToast) window.showToast('✓ Follow request approved!', 'success');
    } catch (err) {
      console.error('Error approving request:', err);
      if (window.showToast) window.showToast('Failed to approve request', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (userId) => {
    setProcessingId(userId);
    try {
      await rejectFollowRequest(pathId, userId);
      setFollowRequests(followRequests.filter((req) => req.followerId !== userId));
      if (window.showToast) window.showToast('✕ Follow request rejected', 'warning');
    } catch (err) {
      console.error('Error rejecting request:', err);
      if (window.showToast) window.showToast('Failed to reject request', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // Fetch followers for publisher
  const fetchFollowers = async () => {
    try {
      setFollowersLoading(true);
      const followersRes = await getFollowersForPath(pathId);
      setFollowers(followersRes);
    } catch (err) {
      console.error('Error fetching followers:', err);
    } finally {
      setFollowersLoading(false);
    }
  };

  // Fetch followers when publisher opens the page
  useEffect(() => {
    if (isPublisher) {
      fetchFollowers();
    }
  }, [pathId, isPublisher]);

  // Handle remove follower
  const handleRemoveFollower = async (followerId) => {
    try {
      await removeFollowerFromPath(pathId, followerId);
      setFollowers(followers.filter((f) => f.id !== followerId));
      // Also update path followers count
      if (path) {
        setPath({
          ...path,
          followerIds: path.followerIds.filter((id) => id !== followerId),
        });
      }
    } catch (err) {
      console.error('Error removing follower:', err);
      throw err;
    }
  };

  // Loading state
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="path-detail-page">
          <div className="detail-loading">
            <div className="spinner" />
            <p>Loading path details...</p>
          </div>
        </div>
      </>
    );
  }

  // Error state
  if (error || !path) {
    return (
      <>
        <Navbar />
        <div className="path-detail-page">
          <div className="detail-error">
            <div className="error-icon">⚠️</div>
            <h2>{error || 'Path not found'}</h2>
            <button onClick={() => navigate(-1)} className="pd-btn-back">
              ← Go Back
            </button>
          </div>
        </div>
      </>
    );
  }

  const status = STATUS_LABELS[path.status] || STATUS_LABELS.idle;

  return (
    <>
      <Navbar />
      <div className="path-detail-page">
        <div className="path-detail-container">
          {/* Back button */}
          <button onClick={() => navigate(-1)} className="pd-btn-back">
            ← Back
          </button>

          {/* Path Header Card */}
          <div className="pd-header-card">
            <div className="pd-header-top">
              <div className="pd-title-group">
                <h1 className="pd-title">📍 {path.title}</h1>
                <div className="pd-badges">
                  <span className={`pd-status-badge ${status.cls}`}>{status.label}</span>
                  {isPublisher && <span className="pd-your-badge">Your Path</span>}
                  {isFollower && !isPublisher && (
                    <span className="pd-following-badge">✓ Following</span>
                  )}
                </div>
              </div>

              {canLiveTrack && (
                <button
                  className="pd-live-btn"
                  onClick={() => navigate(`/path/${path.id}/live`)}
                >
                  🗺️ Open Live Tracking
                </button>
              )}
            </div>

            <div className="pd-meta-row">
              <span className="pd-meta-item">
                👤 <strong>{path.publisher?.name || 'Unknown'}</strong>
              </span>
              <span className="pd-meta-sep">•</span>
              <span className="pd-meta-item pd-followers">
                👥 {path.followerIds?.length || 0} follower
                {(path.followerIds?.length || 0) !== 1 ? 's' : ''}
              </span>
              <span className="pd-meta-sep">•</span>
              <span className="pd-meta-item pd-date">
                🗓️ {new Date(path.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              {path.coordinates?.length > 0 && (
                <>
                  <span className="pd-meta-sep">•</span>
                  <span className="pd-meta-item">
                    📡 {path.coordinates.length} GPS points
                  </span>
                </>
              )}
            </div>

            {path.description && (
              <div className="pd-description">
                <p>{path.description}</p>
              </div>
            )}
          </div>

          {/* Follow Requests Section — only shown to publisher */}
          {isPublisher && (
            <div className="pd-requests-card">
              <div className="pd-section-header">
                <h2 className="pd-section-title">📬 Follow Requests</h2>
                <span className="pd-count-badge">{followRequests.length}</span>
                <button
                  className="pd-refresh-btn"
                  onClick={() => fetchPathAndRequests(true)}
                  title="Refresh requests"
                >
                  🔄
                </button>
              </div>

              {followRequests.length === 0 ? (
                <div className="pd-empty">
                  <div className="pd-empty-icon">📭</div>
                  <p>No pending follow requests</p>
                </div>
              ) : (
                <div className="pd-requests-list">
                  {followRequests.map((request) => (
                    <div key={request.followerId} className="pd-request-item">
                      <div className="pd-requester-info">
                        {request.follower?.picture ? (
                          <img
                            src={request.follower.picture}
                            alt={request.follower.name}
                            className="pd-requester-avatar"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="pd-requester-avatar pd-avatar-fallback">
                            {request.follower?.name?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div className="pd-requester-details">
                          <h3>{request.follower?.name || 'Unknown User'}</h3>
                          <p>{request.follower?.email}</p>
                        </div>
                      </div>

                      <div className="pd-request-actions">
                        <button
                          className="pd-btn-approve"
                          onClick={() => handleApprove(request.followerId)}
                          disabled={processingId === request.followerId}
                        >
                          {processingId === request.followerId ? '...' : '✓ Approve'}
                        </button>
                        <button
                          className="pd-btn-reject"
                          onClick={() => handleReject(request.followerId)}
                          disabled={processingId === request.followerId}
                        >
                          {processingId === request.followerId ? '...' : '✗ Reject'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Followers Section */}
          {path.followerIds && path.followerIds.length > 0 && (
            <div className="pd-followers-section">
              <div className="pd-section-header">
                <h2 className="pd-section-title">👥 Followers ({path.followerIds.length})</h2>
                {isPublisher && (
                  <button
                    className="pd-refresh-btn"
                    onClick={() => fetchFollowers()}
                    title="Refresh followers list"
                  >
                    🔄
                  </button>
                )}
              </div>
              <p className="pd-followers-note">
                {path.followerIds.length} user{path.followerIds.length !== 1 ? 's are' : ' is'} approved to follow this path and can join live tracking sessions.
              </p>
              <FollowersList
                followers={followers}
                isPublisher={isPublisher}
                onRemoveFollower={handleRemoveFollower}
                loading={followersLoading}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PathDetailPage;
