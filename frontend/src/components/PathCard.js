import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendFollowRequest, getSentFollowRequests, getFollowRequestsForPath, cancelFollowRequest } from '../services/followRequestService';
import apiClient from '../services/api';
import { POLLING_INTERVALS, REQUEST_STATUSES } from '../config/constants';
import '../styles/PathCard.css';
import '../styles/PathPublish.css';

export default function PathCard({ path, isFollowing, onFollowChange, currentUserId, onRequestSent, onPathUpdated, onPathDeleted }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [hasRequest, setHasRequest] = useState(false);
  const [requestLoading, setRequestLoading] = useState(true);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showUnfollowConfirm, setShowUnfollowConfirm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editTitle, setEditTitle] = useState(path.title);
  const [editDescription, setEditDescription] = useState(path.description || '');
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
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
      // Becoming a follower invalidates any prior pending-request state. Without
      // this reset, the click handler below would still route into the cancel-
      // request branch and the backend would respond "Follow request not found".
      setHasRequest(false);
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
            setHasRequest(false);
            onFollowChange(path.id, true);
            if (window.showToast) {
              window.showToast(
                `Your follow request for "${path.title}" was approved!`,
                'success',
                8000,
                () => navigate(`/path/${path.id}`)
              );
            }
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

  const handleRepublish = async (e) => {
    e.preventDefault();
    if (!editTitle.trim()) return;
    setEditLoading(true);
    try {
      const res = await apiClient.put(`/paths/${path.id}`, {
        title: editTitle.trim(),
        description: editDescription.trim(),
      });
      setShowEditForm(false);
      if (onPathUpdated) onPathUpdated(res.data);
      if (window.showToast) window.showToast('Path updated successfully', 'success');
    } catch (err) {
      console.error('Error updating path:', err);
      if (window.showToast) window.showToast(err.response?.data?.message || 'Failed to update path', 'error');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await apiClient.delete(`/paths/${path.id}`);
      setShowDeleteConfirm(false);
      if (onPathDeleted) onPathDeleted(path.id);
      if (window.showToast) window.showToast('Path deleted', 'warning');
    } catch (err) {
      console.error('Error deleting path:', err);
      if (window.showToast) window.showToast(err.response?.data?.message || 'Failed to delete path', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCardClick = () => {
    navigate(`/path/${path.id}`);
  };

  if (showEditForm) {
    return (
      <div className="path-card path-card--editing" onClick={(e) => e.stopPropagation()}>
        <form className="path-edit-form" onSubmit={handleRepublish}>
          <div className="form-header">
            <h3>Republish Path</h3>
            <button
              type="button"
              className="close-button"
              onClick={() => {
                setEditTitle(path.title);
                setEditDescription(path.description || '');
                setShowEditForm(false);
              }}
              disabled={editLoading}
            >
              ✕
            </button>
          </div>
          <div className="form-group">
            <label htmlFor={`edit-title-${path.id}`}>Path Title *</label>
            <input
              id={`edit-title-${path.id}`}
              type="text"
              className="form-input"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              maxLength="100"
              required
              disabled={editLoading}
            />
          </div>
          <div className="form-group">
            <label htmlFor={`edit-desc-${path.id}`}>Description</label>
            <textarea
              id={`edit-desc-${path.id}`}
              className="form-textarea"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              maxLength="500"
              rows="3"
              disabled={editLoading}
            />
            <small className="char-count">{editDescription.length}/500</small>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={() => {
                setEditTitle(path.title);
                setEditDescription(path.description || '');
                setShowEditForm(false);
              }}
              disabled={editLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-button"
              disabled={editLoading || !editTitle.trim()}
            >
              {editLoading ? 'Saving...' : 'Republish'}
            </button>
          </div>
        </form>
      </div>
    );
  }

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

        {isPublisher && (
          <div className="publisher-actions" onClick={(e) => e.stopPropagation()}>
            <button
              className="publisher-action-btn edit-btn"
              title="Edit / Republish"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(false);
                setShowEditForm(true);
              }}
            >
              ✏️
            </button>
            <button
              className="publisher-action-btn delete-btn"
              title="Delete path"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm((v) => !v);
              }}
            >
              🗑️
            </button>
          </div>
        )}
      </div>

      {showDeleteConfirm && isPublisher && (
        <div className="delete-confirmation" onClick={(e) => e.stopPropagation()}>
          <p>Permanently delete this path?</p>
          <div className="confirmation-buttons">
            <button
              className="confirm-cancel-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting...' : 'Yes, Delete'}
            </button>
            <button
              className="confirm-keep-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(false);
              }}
              disabled={deleteLoading}
            >
              Keep It
            </button>
          </div>
        </div>
      )}

      {path.description && (
        <p className="path-description">{path.description}</p>
      )}

      <div className="path-meta">
        <span className="path-publisher">
          {path.publisher?.picture ? (
            <img
              className="publisher-avatar"
              src={path.publisher.picture}
              alt={path.publisher.name}
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="publisher-avatar publisher-avatar--initials">
              {path.publisher?.name?.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="publisher-name-wrap">
            <strong>{path.publisher?.name}</strong>
            {path.publisher?.username && (
              <span className="publisher-username">@{path.publisher.username}</span>
            )}
          </span>
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
              {showUnfollowConfirm ? (
                <div className="cancel-confirmation" onClick={(e) => e.stopPropagation()}>
                  <p>Unfollow this path?</p>
                  <div className="confirmation-buttons">
                    <button
                      className="confirm-cancel-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowUnfollowConfirm(false);
                        handleFollowToggle();
                      }}
                      disabled={loading}
                    >
                      {loading ? 'Unfollowing...' : 'Yes, Unfollow'}
                    </button>
                    <button
                      className="confirm-keep-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowUnfollowConfirm(false);
                      }}
                      disabled={loading}
                    >
                      Keep It
                    </button>
                  </div>
                </div>
              ) : showCancelConfirm ? (
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
                    // Match the label's priority: isFollowing wins over hasRequest.
                    // Guards against stale hasRequest=true after a pending request was approved.
                    if (isFollowing) {
                      setShowUnfollowConfirm(true);
                    } else if (hasRequest) {
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
