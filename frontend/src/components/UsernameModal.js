import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';

export default function UsernameModal() {
  const { refreshUser } = useAuth();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const clean = value.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
      setError('3–20 chars, letters / numbers / underscores only');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const token = localStorage.getItem('fmp68_token');
      await axios.patch(
        `${API}/users/me/username`,
        { username: clean },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      await refreshUser();
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="username-modal-overlay">
      <div className="username-modal">
        <h2 className="username-modal-title">Choose a username</h2>
        <p className="username-modal-desc">
          Pick a unique username for your account. You can change it later.
        </p>
        <form onSubmit={handleSubmit} className="username-modal-form">
          <div className="username-input-wrap">
            <span className="username-at">@</span>
            <input
              className="username-input"
              type="text"
              placeholder="your_username"
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(''); }}
              autoFocus
              maxLength={20}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          {error && <p className="username-error">{error}</p>}
          <p className="username-hint">3–20 characters · letters, numbers, underscores</p>
          <button
            className="btn username-modal-btn"
            type="submit"
            disabled={loading || value.trim().length < 3}
          >
            {loading ? 'Saving…' : 'Set Username'}
          </button>
        </form>
      </div>
    </div>
  );
}
