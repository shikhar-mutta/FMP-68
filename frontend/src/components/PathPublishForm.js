import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/PathPublish.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';

export default function PathPublishForm({ onPathPublished, modal = false, onClose }) {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);

  const close = () => {
    setShowForm(false);
    onClose?.();
  };
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePublish = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('fmp68_token');
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await axios.post(
        `${API}/paths`,
        { title, description },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      setTitle('');
      setDescription('');
      setShowForm(false);
      onPathPublished(response.data);
      navigate(`/path/${response.data.id}`);
    } catch (err) {
      const errorMsg = err.response?.data?.message 
        || err.response?.data?.error
        || 'Failed to publish path';
      setError(errorMsg);
      console.error('Error publishing path:', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (modal) {
    return (
      <form className="path-publish-form" onSubmit={handlePublish}>
        <div className="form-header">
          <h3>Publish a New Path</h3>
          <button type="button" className="close-button" onClick={close}>✕</button>
        </div>
        {error && <div className="error-message">{error}</div>}
        <div className="form-group">
          <label htmlFor="modal-title">Path Title *</label>
          <input id="modal-title" type="text" placeholder="Enter path title" value={title}
            onChange={(e) => setTitle(e.target.value)} required disabled={loading} maxLength="100" className="form-input" />
        </div>
        <div className="form-group">
          <label htmlFor="modal-desc">Description</label>
          <textarea id="modal-desc" placeholder="Enter path description (optional)" value={description}
            onChange={(e) => setDescription(e.target.value)} disabled={loading} maxLength="500" rows="4" className="form-textarea" />
          <small className="char-count">{description.length}/500</small>
        </div>
        <div className="form-actions">
          <button type="button" className="cancel-button" onClick={close} disabled={loading}>Cancel</button>
          <button type="submit" className="submit-button" disabled={loading || !title.trim()}>
            {loading ? 'Publishing...' : 'Publish Path'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="path-publish-container">
      {!showForm ? (
        <button
          className="path-publish-button"
          onClick={() => setShowForm(true)}
        >
          📍 Publish New Path
        </button>
      ) : (
        <form className="path-publish-form" onSubmit={handlePublish}>
          <div className="form-header">
            <h3>Publish a New Path</h3>
            <button
              type="button"
              className="close-button"
              onClick={() => setShowForm(false)}
            >
              ✕
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="title">Path Title *</label>
            <input
              id="title"
              type="text"
              placeholder="Enter path title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={loading}
              maxLength="100"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              placeholder="Enter path description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              maxLength="500"
              rows="4"
              className="form-textarea"
            />
            <small className="char-count">{description.length}/500</small>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={() => setShowForm(false)}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-button"
              disabled={loading || !title.trim()}
            >
              {loading ? 'Publishing...' : 'Publish Path'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
