import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import Navbar from '../../components/Navbar';

const mockUseAuth = jest.fn();
const mockUseTheme = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));


describe('Navbar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null, signOut: jest.fn() });
    mockUseTheme.mockReturnValue({ theme: 'light', toggleTheme: jest.fn() });
  });

  it('should render navbar shell', () => {
    const { container } = render(<Navbar />);
    expect(container.querySelector('nav')).toBeTruthy();
    expect(container.querySelector('.navbar-brand')?.textContent).toBe('FMP-68');
  });

  it('should render user controls when user exists', () => {
    const signOut = jest.fn();
    const toggleTheme = jest.fn();
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', name: 'Test User', picture: null },
      signOut,
    });
    mockUseTheme.mockReturnValue({ theme: 'light', toggleTheme });

    const { container } = render(<Navbar />);
    expect(container.querySelector('.navbar-user')).toBeTruthy();
    expect(container.querySelector('.navbar-name')?.textContent).toBe('Test User');
    expect(container.querySelector('#signout-btn')).toBeTruthy();
    expect(container.querySelector('.navbar-online-dot')).toBeTruthy();
  });

  it('should call toggleTheme when clicking theme button', () => {
    const toggleTheme = jest.fn();
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', name: 'Test User', picture: null },
      signOut: jest.fn(),
    });
    mockUseTheme.mockReturnValue({ theme: 'light', toggleTheme });

    const { container } = render(<Navbar />);
    const button = container.querySelector('.btn-theme-toggle');
    expect(button).toBeTruthy();
    fireEvent.click(button);
    expect(toggleTheme).toHaveBeenCalledTimes(1);
  });

  it('should show correct theme button title when dark', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', name: 'Test User', picture: null },
      signOut: jest.fn(),
    });
    mockUseTheme.mockReturnValue({ theme: 'dark', toggleTheme: jest.fn() });

    const { container } = render(<Navbar />);
    const button = container.querySelector('.btn-theme-toggle');
    expect(button?.getAttribute('title')).toBe('Switch to light mode');
  });

  it('should call signOut when clicking sign out button', () => {
    const signOut = jest.fn();
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', name: 'Test User', picture: null },
      signOut,
    });
    mockUseTheme.mockReturnValue({ theme: 'light', toggleTheme: jest.fn() });

    const { container } = render(<Navbar />);
    const button = container.querySelector('#signout-btn');
    expect(button).toBeTruthy();
    fireEvent.click(button);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('should render user avatar when picture provided', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', name: 'Test User', picture: 'http://example.com/avatar.png' },
      signOut: jest.fn(),
    });
    mockUseTheme.mockReturnValue({ theme: 'light', toggleTheme: jest.fn() });

    const { container } = render(<Navbar />);
    const img = container.querySelector('.navbar-avatar');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('http://example.com/avatar.png');
    expect(img?.getAttribute('alt')).toBe('Test User');
  });
});
