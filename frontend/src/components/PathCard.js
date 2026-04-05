import React, { useState } from 'react';
import axios from 'axios';
import '../styles/PathCard.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';

export default function PathCard({ path, isFollowing, onFollowChange, currentUserId }) {
  const [loading, setLoading] = useState(false);
  const isPublisher = path.publisher?.id === currentUserId;

  const handleFollowToggle = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('fmp68_token');

      if (isFollowing) {
        await axios.post(`${API}/paths/${path.id}/unfollow`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post(`${API}/paths/${path.id}/follow`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      onFollowChange(path.id, !isFollowing);
    } catch (err) {
      console.error('Error toggling follow:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="path-card">
      <div className="path-card-header">
        <div className="path-title-section">
          <h3 className="path-title">📍 {path.title}</h3>
          {isPublisher && <span className="path-badge">Your Path</span>}
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
          {path.followers?.length || 0} following
        </span>
      </div>

      <div className="path-card-footer">
        <small className="path-date">
          {new Date(path.createdAt).toLocaleDateString()}
        </small>

        {!isPublisher && (
          <button
            className={`follow-button ${isFollowing ? 'following' : ''}`}
            onClick={handleFollowToggle}
            disabled={loading}
          >
            {isFollowing ? '✓ Following' : '+ Follow'}
          </button>
        )}
      </div>
    </div>
  );
}
