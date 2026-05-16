import React from 'react';
import { useAuth } from '../context/AuthContext';

/** Globe with red location pin centered on earth */
function AppIcon() {
  return (
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className="login-app-icon">
      <defs>
        <radialGradient id="lg-ocean" cx="38%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#4fb3e8"/>
          <stop offset="100%" stopColor="#0d52a0"/>
        </radialGradient>
        <radialGradient id="lg-pin" cx="35%" cy="28%" r="65%">
          <stop offset="0%" stopColor="#ff6b6b"/>
          <stop offset="100%" stopColor="#c0392b"/>
        </radialGradient>
        <clipPath id="lg-clip">
          <circle cx="16" cy="16" r="15.5"/>
        </clipPath>
      </defs>
      <circle cx="16" cy="16" r="15.5" fill="url(#lg-ocean)"/>
      <g clipPath="url(#lg-clip)">
        <path d="M2,12 Q6,7 10,10 Q13,13 11,18 Q8,20 3,17 Z" fill="#27ae60"/>
        <path d="M12,7 Q18,4 23,8 Q27,13 24,19 Q20,22 15,18 Z" fill="#2ecc71"/>
        <path d="M22,20 Q27,19 29,24 Q27,29 22,27 Z" fill="#27ae60"/>
        <path d="M4,20 Q7,19 10,22 Q9,27 4,25 Z" fill="#27ae60"/>
        <path d="M13,23 Q16,22 18,25 Q16,29 13,27 Z" fill="#2ecc71"/>
      </g>
      <g clipPath="url(#lg-clip)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" fill="none">
        <ellipse cx="16" cy="16" rx="15.5" ry="6"/>
        <ellipse cx="16" cy="16" rx="15.5" ry="12"/>
        <line x1="16" y1="0.5" x2="16" y2="31.5"/>
      </g>
      <ellipse cx="9" cy="9" rx="4" ry="3" fill="rgba(255,255,255,0.2)" transform="rotate(-30 9 9)"/>
      <circle cx="16" cy="16" r="15.5" fill="none" stroke="#0a3a70" strokeWidth="0.8"/>
      <path d="M16,25 C16,22 9.5,18 9.5,12 A6.5,6.5,0,0,1,22.5,12 C22.5,18 16,22 16,25 Z"
            fill="url(#lg-pin)"/>
      <circle cx="16" cy="12" r="2.6" fill="white" opacity="0.92"/>
      <circle cx="16" cy="12" r="1.5" fill="#c0392b"/>
      <ellipse cx="14" cy="10.5" rx="1.2" ry="1" fill="rgba(255,255,255,0.55)"/>
    </svg>
  );
}

/** Google "G" logo as inline SVG */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function LoginPage() {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="login-page">
      <div className="login-card">
        <AppIcon />
        <h1 className="login-logo">FMP-68</h1>
        <p className="login-subtitle">
          Sign in to access your dashboard and see<br />
          who's online in real-time.
        </p>

        <div className="login-divider">or continue with</div>

        <button
          id="google-signin-btn"
          className="btn btn-google"
          onClick={signInWithGoogle}
        >
          <GoogleIcon />
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
