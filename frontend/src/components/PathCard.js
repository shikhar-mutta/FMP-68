import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendFollowRequest, getSentFollowRequests, getFollowRequestsForPath, cancelFollowRequest } from '../services/followRequestService';
import apiClient from '../services/api';
import { POLLING_INTERVALS, REQUEST_STATUSES } from '../config/constants';
import '../styles/PathCard.css';

export default function PathCard({ path, isFollowing, onFollowChange, currentUserId, onRequestSent }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [hasRequest, setHasRequest] = useState(false);
  const [requestLoading, setRequestLoading] = useState(true);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const pollingRef = useRef(null);
  const isPublisher = path.publisher?.id === currentUserId;

  // Fetch pending requests count for publishers
  useEffect(() => {
    if (!isPublisher) {
      return;
    }

    const fetchPendingCount = async () => {
      try {
        const requests = await getFollowRequestsForPath(path.id);
        setPendingRequestsCount(requests?.length || 0);
      } catch (err) {
        console.error('Error fetching pending requests:', err);
      }
    };

    fetchPendingCount();

    // Auto-poll for publishers to show real-time request count
    pollingRef.current = setInterval(() => {
      getFollowRequestsForPath(path.id)
        .then((requests) => setPendingRequestsCount(requests?.length || 0))
        .catch((err) => console.error('Polling error:', err));
    }, POLLING_INTERVALS.PATH_CARD_REQUESTS);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [path.id, isPublisher]);

  // Check if user has already sent a follow request (for non-publishers)
  useEffect(() => {
    if (!currentUserId || isPublisher || isFollowing) {
      setRequestLoading(false);
      return;
    }

    const checkRequest = async () => {
      try {
        const sentRequests = await getSentFollowRequests();
        const hasExisting = sentRequests.some((req) => req.pathId === path.id);
        setHasRequest(hasExisting);
      } catch (err) {
        console.error('Error checking follow request:', err);
      } finally {
        setRequestLoading(false);
      }
    };

    checkRequest();

    // Auto-poll to detect when request is approved
    pollingRef.current = setInterval(() => {
      getSentFollowRequests()
        .then((sentRequests) => {
          const request = sentRequests.find((req) => req.pathId === path.id);
          if (request && request.status === REQUEST_STATUSES.APPROVED) {
            // Request was approved, update UI
            setHasRequest(false);
            onFollowChange(path.id, true);
          } else {
            setHasRequest(!!request);
          }
        })
        .catch((err) => console.error('Polling error:', err));
    }, POLLING_INTERVALS.PATH_CARD_REQUESTS);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [path.id, currentUserId, isPublisher, isFollowing, onFollowChange]);

  const handleFollowToggle = async () => {
    setLoading(true);
    try {
      if (isFollowing) {
        await apiClient.post(`/paths/${path.id}/unfollow`);
        onFollowChange(path.id, false);
        if (window.showToast) {
          window.showToast('Unfollowed this path', 'info');
        }
      } else {
        // Send follow request instead of direct follow
        await sendFollowRequest(path.id, path.publisherId);
        setHasRequest(true);
        if (onRequestSent) {
          onRequestSent(path.id);
        }
        if (window.showToast) {
          window.showToast('Follow request sent! Waiting for approval...', 'success');
        }
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
      if (window.showToast) {
        window.showToast(err.message || 'Failed to send follow request', 'error');
      }
      alert(err.message || 'Failed to send follow request');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    setLoading(true);
    try {
      await cancelFollowRequest(path.id);
      setHasRequest(false);
      setShowCancelConfirm(false);
      if (window.showToast) {
        window.showToast('Follow request cancelled', 'warning');
      }
    } catch (err) {
      console.error('Error cancelling request:', err);
      if (window.showToast) {
        window.showToast(err.message || 'Failed to cancel request', 'error');
      }
      alert(err.message || 'Failed to cancel request');
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = () => {
    navigate(`/path/${path.id}`);
  };

  return (
    <div className="path-card" onClick={handleCardClick} style={{ cursor: 'pointer' }}>
      <div className="path-card-header">
        <div className="path-title-section">
          <h3 className="path-title">📍 {path.title}</h3>
          {isPublisher && <span className="path-badge">Your Path</span>}
          {isPublisher && pendingRequestsCount > 0 && (
            <span className="requests-badge">{pendingRequestsCount}</span>
          )}
        </div>
      </div>

      {path.description && (
        <p className="path-description">{path.description}</p>
      )}

      <div className="path-meta">
        <span className="path-publisher">
          By <strong>{path.publisher?.name}</strong>
        </span>
        <span className="path-followers">
          {path.followers?.length || path.followerIds?.length || 0} followers
        </span>
      </div>

      <div className="path-card-footer">
        <small className="path-date">
          {new Date(path.createdAt).toLocaleDateString()}
        </small>

        <div className="path-card-actions">
          {/* Live Track button — visible to publisher and approved followers */}
          {(isPublisher || isFollowing) && (
            <button
              className="live-track-btn"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/path/${path.id}/live`);
              }}
            >
              🗺️ Live Track
            </button>
          )}

          {!isPublisher && (
            <>
              {showCancelConfirm ? (
                <div className="cancel-confirmation">
                  <p>Cancel this follow request?</p>
                  <div className="confirmation-buttons">
                    <button
                      className="confirm-cancel-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelRequest();
                      }}
                      disabled={loading}
                    >
                      Yes, Remove
                    </button>
                    <button
                      className="confirm-keep-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCancelConfirm(false);
                      }}
                      disabled={loading}
                    >
                      Keep It
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className={`follow-button ${
                    isFollowing ? 'following' : hasRequest ? 'requested' : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasRequest) {
                      setShowCancelConfirm(true);
                    } else {
                      handleFollowToggle();
                    }
                  }}
                  disabled={loading || requestLoading}
                >
                  {isFollowing
                    ? '✓ Following'
                    : hasRequest
                    ? '⏳ Request Pending'
                    : '+ Request to Follow'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
