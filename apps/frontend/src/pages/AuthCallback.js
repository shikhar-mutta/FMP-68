import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * /auth/callback?token=xxx
 * This page is hit after Google OAuth redirect.
 * It grabs the JWT from the URL, stores it, then navigates to dashboard.
 */
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const { handleCallback } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      handleCallback(token)
        .then(() => navigate('/', { replace: true }))
        .catch(() => navigate('/login', { replace: true }));
    } else {
      navigate('/login', { replace: true });
    }
  }, [searchParams, handleCallback, navigate]);

  return (
    <div className="spinner-overlay">
      <div className="spinner" />
    </div>
  );
}
