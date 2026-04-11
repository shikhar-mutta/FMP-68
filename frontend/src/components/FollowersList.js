import React, { useState } from 'react';
import '../styles/FollowersList.css';

const FollowersList = ({ followers, isPublisher, onRemoveFollower, loading }) => {
  const [removingId, setRemovingId] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(null);

  const handleRemoveClick = (followerId, followerName) => {
    setShowConfirmation({ followerId, followerName });
  };

  const confirmRemove = async () => {
    if (!showConfirmation) return;

    setRemovingId(showConfirmation.followerId);
    try {
      await onRemoveFollower(showConfirmation.followerId);
      setShowConfirmation(null);
      if (window.showToast) {
        window.showToast('✓ Follower removed successfully', 'success');
      }
    } catch (error) {
      console.error('Error removing follower:', error);
      if (window.showToast) {
        window.showToast(`Failed to remove follower: ${error.message}`, 'error');
      }
    } finally {
      setRemovingId(null);
    }
  };

  const cancelRemove = () => {
    setShowConfirmation(null);
  };

  if (loading) {
    return (
      <div className="followers-list-container">
        <div className="spinner-small" />
        Loading followers...
      </div>
    );
  }

  if (!followers || followers.length === 0) {
    return (
      <div className="followers-list-container">
        <div className="followers-empty">
          <div className="followers-empty-icon">👥</div>
          <p>No followers yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="followers-list-container">
      <div className="followers-list">
        {followers.map((follower) => (
          <div key={follower.id} className="follower-item">
            <div className="follower-info">
              {follower.picture ? (
                <img
                  src={follower.picture}
                  alt={follower.name}
                  className="follower-avatar"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="follower-avatar follower-avatar-fallback">
                  {follower.name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <div className="follower-details">
                <h4 className="follower-name">{follower.name || 'Unknown User'}</h4>
                <p className="follower-email">{follower.email}</p>
              </div>
            </div>

            {isPublisher && (
              <div className="follower-actions">
                <button
                  className="btn-remove-follower"
                  onClick={() => handleRemoveClick(follower.id, follower.name)}
                  disabled={removingId === follower.id}
                  title="Remove this user from following your path"
                >
                  {removingId === follower.id ? '...' : '✕ Remove'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="confirmation-modal-overlay" onClick={cancelRemove}>
          <div className="confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirmation-modal-header">
              <h3>Remove Follower?</h3>
            </div>
            <div className="confirmation-modal-body">
              <p>
                Are you sure you want to remove <strong>{showConfirmation.followerName}</strong> from following your path?
              </p>
              <p className="confirmation-note">They will not be able to track your live location anymore.</p>
            </div>
            <div className="confirmation-modal-footer">
              <button
                className="btn-cancel-confirm"
                onClick={cancelRemove}
              >
                Cancel
              </button>
              <button
                className="btn-confirm-remove"
                onClick={confirmRemove}
                disabled={removingId !== null}
              >
                {removingId ? '...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FollowersList;
