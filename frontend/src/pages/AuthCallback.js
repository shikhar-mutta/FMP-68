import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * /oauth/callback?token=xxx
 * This page is hit after Google OAuth redirect (auth-service does the
 * final hop here; the path lives outside /auth/* so the frontend nginx
 * proxy and cluster ingress don't grab it).
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
        .then(() => {
          const redirectTo = sessionStorage.getItem('fmp68_redirect_after_login') || '/';
          sessionStorage.removeItem('fmp68_redirect_after_login');
          navigate(redirectTo, { replace: true });
        })
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
