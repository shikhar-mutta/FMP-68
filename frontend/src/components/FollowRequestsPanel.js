import React, { useState, useEffect, useRef } from 'react';
import {
  getPendingFollowRequests,
  approveFollowRequest,
  rejectFollowRequest,
} from '../services/followRequestService';
import { POLLING_INTERVALS } from '../config/constants';
import '../styles/FollowRequests.css';

const FollowRequestsPanel = ({ currentUserId, onRefresh }) => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const pollingRef = useRef(null);

  // Fetch pending follow requests
  const fetchPendingRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const requests = await getPendingFollowRequests();
      setPendingRequests(requests);
    } catch (err) {
      setError(err.toString());
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  };

  // Setup polling for real-time synchronization
  useEffect(() => {
    fetchPendingRequests();

    // Auto-poll every 2 seconds for real-time sync
    pollingRef.current = setInterval(() => {
      getPendingFollowRequests()
        .then((requests) => setPendingRequests(requests))
        .catch((err) => console.error('Polling error:', err));
    }, POLLING_INTERVALS.PENDING_REQUESTS);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [onRefresh]);

  const handleApprove = async (pathId, userId) => {
    setProcessingId(`${pathId}-${userId}`);
    try {
      await approveFollowRequest(pathId, userId);
      // Remove from pending list
      setPendingRequests(
        pendingRequests.filter((req) => !(req.pathId === pathId && req.followerId === userId))
      );
      // Show success toast
      if (window.showToast) {
        window.showToast('✓ Follow request approved!', 'success');
      }
    } catch (err) {
      setError(err.toString());
      if (window.showToast) {
        window.showToast('Failed to approve request', 'error');
      }
      console.error('Error approving request:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (pathId, userId) => {
    setProcessingId(`${pathId}-${userId}`);
    try {
      await rejectFollowRequest(pathId, userId);
      // Remove from pending list
      setPendingRequests(
        pendingRequests.filter((req) => !(req.pathId === pathId && req.followerId === userId))
      );
      // Show success toast
      if (window.showToast) {
        window.showToast('✕ Follow request rejected', 'warning');
      }
    } catch (err) {
      setError(err.toString());
      if (window.showToast) {
        window.showToast('Failed to reject request', 'error');
      }
      console.error('Error rejecting request:', err);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading && pendingRequests.length === 0) {
    return <div className="requests-panel">Loading follow requests...</div>;
  }

  return (
    <div className="requests-panel">
      <h3>📬 Follow Requests ({pendingRequests.length})</h3>

      {error && <div className="error-message">{error}</div>}

      {pendingRequests.length === 0 ? (
        <p className="no-requests">No pending follow requests</p>
      ) : (
        <div className="requests-list">
          {pendingRequests.map((request) => (
            <div key={`${request.pathId}-${request.followerId}`} className="request-item">
              <div className="request-info">
                <div className="requester-info">
                  {request.follower?.picture && (
                    <img
                      src={request.follower.picture}
                      alt={request.follower.name}
                      className="requester-avatar"
                    />
                  )}
                  <div className="requester-details">
                    <strong>{request.follower?.name}</strong>
                    <small>{request.follower?.email}</small>
                    <p className="request-path">
                      wants to follow: <strong>{request.pathTitle}</strong>
                    </p>
                  </div>
                </div>
              </div>

              <div className="request-actions">
                <button
                  className="btn-approve"
                  onClick={() => handleApprove(request.pathId, request.followerId)}
                  disabled={processingId === `${request.pathId}-${request.followerId}`}
                >
                  ✓ Approve
                </button>
                <button
                  className="btn-reject"
                  onClick={() => handleReject(request.pathId, request.followerId)}
                  disabled={processingId === `${request.pathId}-${request.followerId}`}
                >
                  ✕ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FollowRequestsPanel;
