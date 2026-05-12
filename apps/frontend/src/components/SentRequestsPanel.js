import React, { useState, useEffect, useRef } from 'react';
import { getSentFollowRequests, cancelFollowRequest } from '../services/followRequestService';
import { POLLING_INTERVALS, REQUEST_STATUSES } from '../config/constants';
import '../styles/FollowRequests.css';

const SentRequestsPanel = ({ currentUserId, onRefresh }) => {
  const [sentRequests, setSentRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const pollingRef = useRef(null);

  // Fetch sent follow requests
  const fetchSentRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const requests = await getSentFollowRequests();
      setSentRequests(requests);
    } catch (err) {
      setError(err.toString());
      console.error('Error fetching sent requests:', err);
    } finally {
      setLoading(false);
    }
  };

  // Setup polling for real-time synchronization
  useEffect(() => {
    fetchSentRequests();

    // Auto-poll every 2 seconds to detect when requests are approved/rejected
    pollingRef.current = setInterval(() => {
      getSentFollowRequests()
        .then((requests) => setSentRequests(requests))
        .catch((err) => console.error('Polling error:', err));
    }, POLLING_INTERVALS.SENT_REQUESTS);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [onRefresh]);

  const handleCancel = async (pathId) => {
    setProcessingId(pathId);
    try {
      await cancelFollowRequest(pathId);
      // Remove from sent list
      setSentRequests(sentRequests.filter((req) => req.pathId !== pathId));
      // Show success toast
      if (window.showToast) {
        window.showToast('Request cancelled', 'success');
      }
    } catch (err) {
      setError(err.toString());
      if (window.showToast) {
        window.showToast('Failed to cancel request', 'error');
      }
      console.error('Error cancelling request:', err);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading && sentRequests.length === 0) {
    return <div className="sent-requests-panel">Loading your requests...</div>;
  }

  return (
    <div className="sent-requests-panel">
      <h3>📤 Your Follow Requests ({sentRequests.length})</h3>

      {error && <div className="error-message">{error}</div>}

      {sentRequests.length === 0 ? (
        <p className="no-requests">No sent follow requests</p>
      ) : (
        <div className="sent-requests-list">
          {sentRequests.map((request) => (
            <div key={request.pathId} className="sent-request-item">
              <div className="sent-request-info">
                <div>
                  <p className="request-path">
                    <strong>{request.pathTitle}</strong>
                  </p>
                  <small>by {request.publisher?.name}</small>
                </div>
              </div>

              <div className="sent-request-status">
                <div className={`status-badge status-${request.status?.toLowerCase() || REQUEST_STATUSES.PENDING.toLowerCase()}`}>
                  {request.status === REQUEST_STATUSES.APPROVED ? '✓ Approved' : '⏳ Pending'}
                </div>
                {request.status === REQUEST_STATUSES.PENDING && (
                  <button
                    className="btn-cancel"
                    onClick={() => handleCancel(request.pathId)}
                    disabled={processingId === request.pathId}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SentRequestsPanel;
