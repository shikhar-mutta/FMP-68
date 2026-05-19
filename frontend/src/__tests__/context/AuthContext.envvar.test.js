/**
 * Separate spec file so process.env.REACT_APP_API_URL is set BEFORE
 * AuthContext is required, covering the truthy branch of:
 *   const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';
 */
process.env.REACT_APP_API_URL = 'http://custom-auth:8080';

const React = require('react');
const { render, fireEvent, screen } = require('@testing-library/react');
jest.mock('axios');
const axios = require('axios');

const { AuthProvider, useAuth } = require('../../context/AuthContext');

describe('AuthContext — custom REACT_APP_API_URL', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    axios.get.mockResolvedValue({ data: {} });
  });

  it('signInWithGoogle redirects to the custom API base URL', () => {
    delete window.location;
    window.location = { href: '' };

    const T = () => {
      const { signInWithGoogle } = useAuth();
      return <button onClick={signInWithGoogle}>Sign In</button>;
    };

    render(
      React.createElement(AuthProvider, null, React.createElement(T))
    );

    fireEvent.click(screen.getByRole('button'));
    expect(window.location.href).toContain('http://custom-auth:8080');
  });
});
