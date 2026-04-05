import React, { useState, useEffect } from 'react';
import {
  getPendingFollowRequests,
  approveFollowRequest,
  rejectFollowRequest,
} from '../services/followRequestService';
import '../styles/FollowRequests.css';

const FollowRequestsPanel = ({ currentUserId, onRefresh }) => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  // Fetch pending follow requests
  useEffect(() => {
    fetchPendingRequests();
  }, [onRefresh]);

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

  const handleApprove = async (pathId, userId) => {
    setProcessingId(`${pathId}-${userId}`);
    try {
      await approveFollowRequest(pathId, userId);
      // Remove from pending list
      setPendingRequests(
        pendingRequests.filter((req) => !(req.pathId === pathId && req.followerId === userId))
      );
    } catch (err) {
      setError(err.toString());
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
    } catch (err) {
      setError(err.toString());
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
