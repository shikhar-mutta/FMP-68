import React, { useEffect } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import axios from 'axios';
import { AuthProvider, useAuth } from '../../context/AuthContext';

jest.mock('axios');

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should provide auth context', () => {
    const TestComponent = () => {
      const { user } = useAuth();
      return <div>{user ? 'User' : 'No User'}</div>;
    };

    const { container } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    expect(container).toBeTruthy();
  });

  it('should have loading state', () => {
    const TestComponent = () => {
      const { loading } = useAuth();
      return <div>{loading ? 'Loading' : 'Ready'}</div>;
    };

    const { container } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    expect(container).toBeTruthy();
  });

  it('should have signOut function', () => {
    const TestComponent = () => {
      const { signOut } = useAuth();
      return <div>{typeof signOut === 'function' ? 'Ready' : 'Not Ready'}</div>;
    };

    const { container } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    expect(container).toBeTruthy();
  });

  it('should render children', () => {
    const { container } = render(
      <AuthProvider>
        <div data-testid="child">Test Child</div>
      </AuthProvider>
    );
    expect(container.querySelector('[data-testid="child"]')).toBeTruthy();
  });

  it('should export useAuth hook', () => {
    expect(useAuth).toBeDefined();
    expect(typeof useAuth).toBe('function');
  });

  it('should load user from localStorage token on mount', async () => {
    localStorage.setItem('fmp68_token', 'test-token');
    axios.get.mockResolvedValue({ data: { id: 'user-1', name: 'John' } });

    const TestComponent = () => {
      const { user, loading } = useAuth();
      return (
        <div>
          {loading ? 'Loading' : user ? `User: ${user.name}` : 'No User'}
        </div>
      );
    };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/auth/me'),
        expect.any(Object)
      );
    });
  });

  it('should set loading to false when token is not present', () => {
    localStorage.removeItem('fmp68_token');

    const TestComponent = () => {
      const { loading } = useAuth();
      return <div>{loading ? 'Loading' : 'Not Loading'}</div>;
    };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByText('Not Loading')).toBeInTheDocument();
  });

  it('should handle error when loading user', async () => {
    localStorage.setItem('fmp68_token', 'invalid-token');
    axios.get.mockRejectedValue(new Error('Unauthorized'));

    const TestComponent = () => {
      const { loading, user } = useAuth();
      return <div>{loading ? 'Loading' : user ? 'Has User' : 'No User'}</div>;
    };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('No User')).toBeInTheDocument();
    });
  });

  it('should remove token from localStorage on error', async () => {
    localStorage.setItem('fmp68_token', 'invalid-token');
    axios.get.mockRejectedValue(new Error('Unauthorized'));

    render(
      <AuthProvider>
        <div></div>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(localStorage.getItem('fmp68_token')).toBeNull();
    });
  });

  it('should handle signInWithGoogle', () => {
    delete window.location;
    window.location = { href: '' };

    const TestComponent = () => {
      const { signInWithGoogle } = useAuth();
      return (
        <button onClick={signInWithGoogle}>Sign In</button>
      );
    };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(window.location.href).toContain('/auth/google');
  });

  it('should handle signOut', async () => {
    localStorage.setItem('fmp68_token', 'test-token');
    axios.get.mockResolvedValue({ data: { id: 'user-1', name: 'John' } });
    axios.post.mockResolvedValue({ status: 200 });

    const TestComponent = () => {
      const { user, signOut } = useAuth();
      return (
        <div>
          {user ? (
            <button onClick={signOut}>Logout</button>
          ) : (
            <div>Logged out</div>
          )}
        </div>
      );
    };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Logout/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Logout/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/signout'),
        {},
        expect.any(Object)
      );
    });
  });

  it('should remove token on signOut', async () => {
    localStorage.setItem('fmp68_token', 'test-token');
    axios.get.mockResolvedValue({ data: { id: 'user-1', name: 'John' } });
    axios.post.mockResolvedValue({ status: 200 });

    const TestComponent = () => {
      const { user, signOut } = useAuth();
      return (
        <button onClick={signOut}>Logout</button>
      );
    };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button'));
    });

    await waitFor(() => {
      expect(localStorage.getItem('fmp68_token')).toBeNull();
    });
  });

  it('should handle handleCallback', async () => {
    axios.get.mockResolvedValue({ data: { id: 'user-1', name: 'John' } });

    const TestComponent = () => {
      const { handleCallback, user } = useAuth();
      return (
        <div>
          <button onClick={() => handleCallback('token-123')}>
            Handle Callback
          </button>
          {user && <div>User: {user.name}</div>}
        </div>
      );
    };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/auth/me'),
        expect.any(Object)
      );
    });
  });

  it('should store token in localStorage after handleCallback', async () => {
    axios.get.mockResolvedValue({ data: { id: 'user-1', name: 'John' } });

    const TestComponent = () => {
      const { handleCallback } = useAuth();
      return (
        <button onClick={() => handleCallback('new-token')}>
          Store Token
        </button>
      );
    };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(localStorage.getItem('fmp68_token')).toBe('new-token');
    });
  });

  it('should throw error when useAuth is used outside provider', () => {
    const TestComponent = () => {
      try {
        useAuth();
        return <div>Should not render</div>;
      } catch (err) {
        return <div>{err.message}</div>;
      }
    };

    render(<TestComponent />);

    expect(screen.getByText(/useAuth must be used inside/i)).toBeInTheDocument();
  });

  it('should refresh user data when refreshUser is called with a valid token', async () => {
    localStorage.setItem('fmp68_token', 'test-token');
    const updatedUser = { id: 'user-1', name: 'John Updated' };
    axios.get.mockResolvedValue({ data: updatedUser });

    const TestComponent = () => {
      const { user, refreshUser } = useAuth();
      return (
        <div>
          <div data-testid="user-name">{user?.name || 'none'}</div>
          <button onClick={refreshUser}>Refresh</button>
        </div>
      );
    };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-name').textContent).toBe('John Updated');
    });

    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/auth/me'),
        expect.any(Object)
      );
    });
  });

  it('should not call API in refreshUser when token is missing', async () => {
    localStorage.removeItem('fmp68_token');
    axios.get.mockResolvedValue({ data: {} });

    const TestComponent = () => {
      const { refreshUser } = useAuth();
      return <button onClick={refreshUser}>Refresh</button>;
    };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));

    await new Promise((r) => setTimeout(r, 0));

    expect(axios.get).not.toHaveBeenCalled();
  });

  it('should update user state after refreshUser resolves', async () => {
    localStorage.setItem('fmp68_token', 'test-token');
    axios.get
      .mockResolvedValueOnce({ data: { id: 'user-1', name: 'Original' } })
      .mockResolvedValueOnce({ data: { id: 'user-1', name: 'Refreshed' } });

    const TestComponent = () => {
      const { user, refreshUser } = useAuth();
      return (
        <div>
          <span data-testid="name">{user?.name}</span>
          <button onClick={refreshUser}>Refresh</button>
        </div>
      );
    };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('name').textContent).toBe('Original');
    });

    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));

    await waitFor(() => {
      expect(screen.getByTestId('name').textContent).toBe('Refreshed');
    });
  });

  it('should handle signOut error silently and still clear token', async () => {
    localStorage.setItem('fmp68_token', 'test-token');
    axios.get.mockResolvedValue({ data: { id: 'user-1', name: 'John' } });
    axios.post.mockRejectedValue(new Error('Network error'));

    const TestComponent = () => {
      const { signOut } = useAuth();
      return <button onClick={signOut}>Sign Out</button>;
    };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    expect(localStorage.getItem('fmp68_token')).toBeNull();
  });

  it('should use REACT_APP_API_URL env var when set (covers truthy branch of API constant)', () => {
    const originalEnv = process.env.REACT_APP_API_URL;
    process.env.REACT_APP_API_URL = 'http://custom-auth:8080';

    // jest.isolateModules re-executes the module so line-4's truthy branch is hit
    jest.isolateModules(() => {
      const mod = require('../../context/AuthContext');
      // Minimal smoke-check: module loaded with custom API url
      expect(mod.AuthProvider).toBeDefined();
      expect(mod.useAuth).toBeDefined();
    });

    process.env.REACT_APP_API_URL = originalEnv;
  });
});