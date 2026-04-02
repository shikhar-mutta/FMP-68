import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, signOut } = useAuth();

  return (
    <nav className="navbar">
      <div className="navbar-brand">FMP-68</div>

      {user && (
        <div className="navbar-user">
          <div className="navbar-avatar-wrap">
            {user.picture && (
              <img
                className="navbar-avatar"
                src={user.picture}
                alt={user.name}
                referrerPolicy="no-referrer"
              />
            )}
            {/* Green online dot for own profile */}
            <span className="navbar-online-dot" title="You are online" />
          </div>
          <span className="navbar-name">{user.name}</span>
          <button
            id="signout-btn"
            className="btn btn-signout"
            onClick={signOut}
          >
            Sign Out
          </button>
        </div>
      )}
    </nav>
  );
}
