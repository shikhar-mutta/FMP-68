import React from 'react';

export default function UserCard({ user, index }) {
  const isOnline = user.isOnline;

  return (
    <div
      className="user-card"
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      <div className="user-avatar-wrap">
        <img
          className="user-avatar"
          src={
            user.picture ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=1a2035&color=f1f5f9&bold=true`
          }
          alt={user.name}
          referrerPolicy="no-referrer"
        />
        <span className={`user-status-dot ${isOnline ? 'online' : 'offline'}`} />
      </div>

      <div className="user-info">
        <div className="user-name">{user.name}</div>
        <div className="user-email">{user.email}</div>
      </div>

      <span className={`user-badge ${isOnline ? 'online' : 'offline'}`}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: isOnline ? 'var(--accent-green)' : 'var(--accent-red)',
            display: 'inline-block',
          }}
        />
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}
