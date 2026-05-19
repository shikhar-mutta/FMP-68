import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '../../pages/LoginPage';
import { useAuth } from '../../context/AuthContext';

jest.mock('../../context/AuthContext');

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render login page container', () => {
    const mockSignIn = jest.fn();
    useAuth.mockReturnValue({ signInWithGoogle: mockSignIn });

    const { container } = render(<LoginPage />);

    expect(container.querySelector('.login-page')).toBeInTheDocument();
  });

  it('should render login card', () => {
    const mockSignIn = jest.fn();
    useAuth.mockReturnValue({ signInWithGoogle: mockSignIn });

    const { container } = render(<LoginPage />);

    expect(container.querySelector('.login-card')).toBeInTheDocument();
  });

  it('should display FMP-68 logo', () => {
    const mockSignIn = jest.fn();
    useAuth.mockReturnValue({ signInWithGoogle: mockSignIn });

    render(<LoginPage />);

    const logo = screen.getByText('FMP-68');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveClass('login-logo');
  });

  it('should display login subtitle', () => {
    const mockSignIn = jest.fn();
    useAuth.mockReturnValue({ signInWithGoogle: mockSignIn });

    render(<LoginPage />);

    const subtitle = screen.getByText(/Sign in to access your dashboard/i);
    expect(subtitle).toBeInTheDocument();
  });

  it('should render Google sign-in button', () => {
    const mockSignIn = jest.fn();
    useAuth.mockReturnValue({ signInWithGoogle: mockSignIn });

    render(<LoginPage />);

    const googleButton = screen.getByRole('button', { name: /Sign in with Google/i });
    expect(googleButton).toBeInTheDocument();
  });

  it('should have correct button ID', () => {
    const mockSignIn = jest.fn();
    useAuth.mockReturnValue({ signInWithGoogle: mockSignIn });

    render(<LoginPage />);

    const googleButton = screen.getByRole('button', { name: /Sign in with Google/i });
    expect(googleButton).toHaveAttribute('id', 'google-signin-btn');
  });

  it('should have btn-google class on button', () => {
    const mockSignIn = jest.fn();
    useAuth.mockReturnValue({ signInWithGoogle: mockSignIn });

    render(<LoginPage />);

    const googleButton = screen.getByRole('button', { name: /Sign in with Google/i });
    expect(googleButton).toHaveClass('btn-google');
  });

  it('should call signInWithGoogle when button is clicked', async () => {
    const user = userEvent.setup();
    const mockSignIn = jest.fn();
    useAuth.mockReturnValue({ signInWithGoogle: mockSignIn });

    render(<LoginPage />);

    const googleButton = screen.getByRole('button', { name: /Sign in with Google/i });
    await user.click(googleButton);

    expect(mockSignIn).toHaveBeenCalledTimes(1);
  });

  it('should render Google SVG icon', () => {
    const mockSignIn = jest.fn();
    useAuth.mockReturnValue({ signInWithGoogle: mockSignIn });

    const { container } = render(<LoginPage />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should render divider text', () => {
    const mockSignIn = jest.fn();
    useAuth.mockReturnValue({ signInWithGoogle: mockSignIn });

    render(<LoginPage />);

    const divider = screen.getByText('or continue with');
    expect(divider).toBeInTheDocument();
  });

  it('should render button text correctly', () => {
    const mockSignIn = jest.fn();
    useAuth.mockReturnValue({ signInWithGoogle: mockSignIn });

    render(<LoginPage />);

    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
  });

  it('should display subtitle with line break', () => {
    const mockSignIn = jest.fn();
    useAuth.mockReturnValue({ signInWithGoogle: mockSignIn });

    const { container } = render(<LoginPage />);

    const subtitle = container.querySelector('.login-subtitle');
    expect(subtitle.innerHTML).toContain('<br>');
  });

  it('should have proper structure for accessibility', () => {
    const mockSignIn = jest.fn();
    useAuth.mockReturnValue({ signInWithGoogle: mockSignIn });

    render(<LoginPage />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe('BUTTON');
  });

  it('should call useAuth hook', () => {
    const mockSignIn = jest.fn();
    useAuth.mockReturnValue({ signInWithGoogle: mockSignIn });

    render(<LoginPage />);

    expect(useAuth).toHaveBeenCalled();
  });

  it('should handle multiple button clicks', async () => {
    const user = userEvent.setup();
    const mockSignIn = jest.fn();
    useAuth.mockReturnValue({ signInWithGoogle: mockSignIn });

    render(<LoginPage />);

    const button = screen.getByRole('button', { name: /Sign in with Google/i });
    
    await user.click(button);
    await user.click(button);
    await user.click(button);

    expect(mockSignIn).toHaveBeenCalledTimes(3);
  });

  it('should render with proper class structure', () => {
    const mockSignIn = jest.fn();
    useAuth.mockReturnValue({ signInWithGoogle: mockSignIn });

    const { container } = render(<LoginPage />);

    expect(container.querySelector('.login-page')).toBeInTheDocument();
    expect(container.querySelector('.login-card')).toBeInTheDocument();
    expect(container.querySelector('.login-logo')).toBeInTheDocument();
    expect(container.querySelector('.login-subtitle')).toBeInTheDocument();
    expect(container.querySelector('.login-divider')).toBeInTheDocument();
    expect(container.querySelector('.btn-google')).toBeInTheDocument();
  });

  it('should render complete login flow UI', () => {
    const mockSignIn = jest.fn();
    useAuth.mockReturnValue({ signInWithGoogle: mockSignIn });

    render(<LoginPage />);

    expect(screen.getByText('FMP-68')).toBeInTheDocument();
    expect(screen.getByText(/Sign in to access your dashboard/i)).toBeInTheDocument();
    expect(screen.getByText('or continue with')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in with Google/i })).toBeInTheDocument();
  });
});