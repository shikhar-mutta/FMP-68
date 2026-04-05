import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { approveFollowRequest, rejectFollowRequest, getFollowRequestsForPath } from '../services/followRequestService';
import '../styles/PathDetail.css';

const PathDetailPage = () => {
  const { pathId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [path, setPath] = useState(null);
  const [followRequests, setFollowRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPathAndRequests = async () => {
      try {
        setLoading(true);
        
        // Fetch path details from backend
        const pathsRes = await fetch(`http://localhost:4000/paths/${pathId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('fmp68_token')}`,
          },
        });

        if (!pathsRes.ok) {
          throw new Error('Failed to fetch path details');
        }
        
        const pathData = await pathsRes.json();
        setPath(pathData);

        // Fetch follow requests for this path
        const requestsRes = await getFollowRequestsForPath(pathId);
        setFollowRequests(requestsRes);
      } catch (err) {
        console.error('Error fetching path details:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPathAndRequests();
  }, [pathId]);

  const handleApprove = async (userId) => {
    try {
      await approveFollowRequest(pathId, userId);
      // Remove from list and refresh
      setFollowRequests(followRequests.filter(req => req.followerId !== userId));
    } catch (err) {
      console.error('Error approving request:', err);
      setError('Failed to approve request');
    }
  };

  const handleReject = async (userId) => {
    try {
      await rejectFollowRequest(pathId, userId);
      // Remove from list
      setFollowRequests(followRequests.filter(req => req.followerId !== userId));
    } catch (err) {
      console.error('Error rejecting request:', err);
      setError('Failed to reject request');
    }
  };

  if (loading) {
    return <div className="path-detail-container"><div className="loading">Loading path details...</div></div>;
  }

  if (error) {
    return (
      <div className="path-detail-container">
        <div className="error-message">{error}</div>
        <button onClick={() => navigate(-1)} className="back-button">← Go Back</button>
      </div>
    );
  }

  if (!path) {
    return (
      <div className="path-detail-container">
        <div className="error-message">Path not found</div>
        <button onClick={() => navigate(-1)} className="back-button">← Go Back</button>
      </div>
    );
  }

  return (
    <div className="path-detail-container">
      <button onClick={() => navigate(-1)} className="back-button">← Back</button>

      <div className="path-header">
        <h1>{path.title}</h1>
        <div className="path-meta">
          <span className="publisher">By {path.publisher?.name || 'Unknown'}</span>
          <span className="followers-count">{path.followerIds?.length || 0} followers</span>
          <span className="date">{new Date(path.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {path.description && (
        <div className="path-description">
          <h2>Description</h2>
          <p>{path.description}</p>
        </div>
      )}

      <div className="requests-section">
        <h2>Follow Requests ({followRequests.length})</h2>
        
        {followRequests.length === 0 ? (
          <p className="no-requests">No pending follow requests</p>
        ) : (
          <div className="requests-list">
            {followRequests.map((request) => (
              <div key={request.followerId} className="request-item">
                <div className="requester-info">
                  {request.follower?.picture && (
                    <img 
                      src={request.follower.picture} 
                      alt={request.follower.name}
                      className="requester-avatar"
                    />
                  )}
                  <div className="requester-details">
                    <h3>{request.follower?.name}</h3>
                    <p>{request.follower?.email}</p>
                  </div>
                </div>
                
                {user?.id === path.publisherId && (
                  <div className="request-actions">
                    <button 
                      onClick={() => handleApprove(request.followerId)}
                      className="approve-button"
                    >
                      ✓ Approve
                    </button>
                    <button 
                      onClick={() => handleReject(request.followerId)}
                      className="reject-button"
                    >
                      ✗ Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PathDetailPage;
