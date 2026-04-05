import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPendingFollowRequests } from '../services/followRequestService';
import '../styles/RequestSummaryModal.css';

const RequestSummaryModalPanel = () => {
  const navigate = useNavigate();
  const [pendingRequests, setPendingRequests] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      const requests = await getPendingFollowRequests();
      
      // Group requests by path
      const grouped = {};
      requests.forEach((request) => {
        if (!grouped[request.pathId]) {
          grouped[request.pathId] = {
            pathTitle: request.pathTitle,
            count: 0,
            requests: [],
          };
        }
        grouped[request.pathId].count += 1;
        grouped[request.pathId].requests.push(request);
      });

      setPendingRequests(grouped);
      setError(null);
    } catch (err) {
      console.error('Error fetching pending requests:', err);
      setError('Failed to load pending requests');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="request-summary-modal"><div className="loading">Loading...</div></div>;
  }

  const requestCount = Object.values(pendingRequests).reduce(
    (sum, path) => sum + path.count,
    0
  );

  return (
    <div className="request-summary-modal">
      <div className="summary-header">
        <h2>📬 Follow Requests</h2>
        <span className="total-badge">{requestCount}</span>
      </div>

      {error && <div className="error-message">{error}</div>}

      {requestCount === 0 ? (
        <div className="no-requests">
          <p>No pending follow requests</p>
        </div>
      ) : (
        <div className="paths-grid">
          {Object.entries(pendingRequests).map(([pathId, pathData]) => (
            <div
              key={pathId}
              className="path-card-summary"
              onClick={() => navigate(`/path/${pathId}`)}
            >
              <div className="path-info">
                <h3>{pathData.pathTitle}</h3>
                <p className="request-count">{pathData.count} request{pathData.count !== 1 ? 's' : ''}</p>
              </div>
              <div className="count-badge">{pathData.count}</div>
            </div>
          ))}
        </div>
      )}

      <button onClick={fetchPendingRequests} className="refresh-button">
        🔄 Refresh
      </button>
    </div>
  );
};

export default RequestSummaryModalPanel;
