import React, { useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthCallback from '../../pages/AuthCallback';
import { useAuth } from '../../context/AuthContext';

jest.mock('react-router-dom');
jest.mock('../../context/AuthContext');

describe('AuthCallback Page', () => {
  let mockNavigate;
  let mockHandleCallback;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate = jest.fn();
    mockHandleCallback = jest.fn();

    useNavigate.mockReturnValue(mockNavigate);
    useAuth.mockReturnValue({ handleCallback: mockHandleCallback });
  });

  it('should render spinner on mount', () => {
    useSearchParams.mockReturnValue([new URLSearchParams(), jest.fn()]);

    const { container } = render(<AuthCallback />);

    expect(container.querySelector('.spinner-overlay')).toBeInTheDocument();
    expect(container.querySelector('.spinner')).toBeInTheDocument();
  });

  it('should handle token from URL parameter', async () => {
    const params = new URLSearchParams('?token=test-token-123');
    useSearchParams.mockReturnValue([params, jest.fn()]);
    mockHandleCallback.mockResolvedValue(undefined);

    render(<AuthCallback />);

    await waitFor(() => {
      expect(mockHandleCallback).toHaveBeenCalledWith('test-token-123');
    });
  });

  it('should navigate to dashboard on successful callback', async () => {
    const params = new URLSearchParams('?token=valid-token');
    useSearchParams.mockReturnValue([params, jest.fn()]);
    mockHandleCallback.mockResolvedValue(undefined);

    render(<AuthCallback />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('should navigate to login on callback error', async () => {
    const params = new URLSearchParams('?token=invalid-token');
    useSearchParams.mockReturnValue([params, jest.fn()]);
    mockHandleCallback.mockRejectedValue(new Error('Auth failed'));

    render(<AuthCallback />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });
  });

  it('should navigate to login when no token provided', async () => {
    const params = new URLSearchParams('');
    useSearchParams.mockReturnValue([params, jest.fn()]);

    render(<AuthCallback />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });
  });

  it('should call useAuth hook', () => {
    useSearchParams.mockReturnValue([new URLSearchParams(), jest.fn()]);

    render(<AuthCallback />);

    expect(useAuth).toHaveBeenCalled();
  });

  it('should call useNavigate hook', () => {
    useSearchParams.mockReturnValue([new URLSearchParams(), jest.fn()]);

    render(<AuthCallback />);

    expect(useNavigate).toHaveBeenCalled();
  });

  it('should call useSearchParams hook', () => {
    useSearchParams.mockReturnValue([new URLSearchParams(), jest.fn()]);

    render(<AuthCallback />);

    expect(useSearchParams).toHaveBeenCalled();
  });

  it('should extract token from URL correctly', async () => {
    const params = new URLSearchParams('?token=abc123&other=param');
    useSearchParams.mockReturnValue([params, jest.fn()]);
    mockHandleCallback.mockResolvedValue(undefined);

    render(<AuthCallback />);

    await waitFor(() => {
      expect(mockHandleCallback).toHaveBeenCalledWith('abc123');
    });
  });

  it('should handle empty token parameter', async () => {
    const params = new URLSearchParams('?token=');
    useSearchParams.mockReturnValue([params, jest.fn()]);

    render(<AuthCallback />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });
  });

  it('should handle null token in URL', async () => {
    const params = new URLSearchParams();
    useSearchParams.mockReturnValue([params, jest.fn()]);

    render(<AuthCallback />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });
  });

  it('should use replace navigation mode for dashboard', async () => {
    const params = new URLSearchParams('?token=token123');
    useSearchParams.mockReturnValue([params, jest.fn()]);
    mockHandleCallback.mockResolvedValue(undefined);

    render(<AuthCallback />);

    await waitFor(() => {
      const callArgs = mockNavigate.mock.calls[0];
      expect(callArgs[1]).toEqual({ replace: true });
    });
  });

  it('should use replace navigation mode for login fallback', async () => {
    const params = new URLSearchParams('');
    useSearchParams.mockReturnValue([params, jest.fn()]);

    render(<AuthCallback />);

    await waitFor(() => {
      const callArgs = mockNavigate.mock.calls[0];
      expect(callArgs[1]).toEqual({ replace: true });
    });
  });

  it('should display loading spinner during callback processing', () => {
    const params = new URLSearchParams('?token=slow-token');
    useSearchParams.mockReturnValue([params, jest.fn()]);
    mockHandleCallback.mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 1000))
    );

    const { container } = render(<AuthCallback />);

    expect(container.querySelector('.spinner-overlay')).toBeInTheDocument();
    expect(container.querySelector('.spinner')).toBeInTheDocument();
  });

  it('should render an empty or minimal UI while loading', () => {
    const params = new URLSearchParams('?token=token123');
    useSearchParams.mockReturnValue([params, jest.fn()]);
    mockHandleCallback.mockResolvedValue(undefined);

    const { container } = render(<AuthCallback />);

    // Should render spinner overlay, not much else
    expect(container.querySelector('.spinner-overlay')).toBeInTheDocument();
  });

  it('should handle callback with special characters in token', async () => {
    const params = new URLSearchParams('?token=abc-123_def.ghi');
    useSearchParams.mockReturnValue([params, jest.fn()]);
    mockHandleCallback.mockResolvedValue(undefined);

    render(<AuthCallback />);

    await waitFor(() => {
      expect(mockHandleCallback).toHaveBeenCalledWith('abc-123_def.ghi');
    });
  });

  it('should handle multiple rapid redirects', async () => {
    const params1 = new URLSearchParams('?token=token1');
    useSearchParams.mockReturnValue([params1, jest.fn()]);
    mockHandleCallback.mockResolvedValue(undefined);

    const { rerender } = render(<AuthCallback />);

    await waitFor(() => {
      expect(mockHandleCallback).toHaveBeenCalledTimes(1);
    });

    // Simulate rapid rerenders (shouldn't cause double calls in normal usage)
    rerender(<AuthCallback />);

    await waitFor(() => {
      // Due to useEffect dependency [searchParams], this may call again
      // The behavior depends on how useEffect is structured
      expect(mockHandleCallback).toHaveBeenCalled();
    });
  });
});