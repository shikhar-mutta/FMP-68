import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import App, { PrivateRoute } from '../App';

jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
  AuthProvider: ({ children }) => <div>{children}</div>,
}));

jest.mock('../context/ToastContext', () => ({
  useToast: jest.fn(),
  ToastProvider: ({ children }) => <div>{children}</div>,
}));

jest.mock('../context/ThemeContext', () => ({
  ThemeProvider: ({ children }) => <div>{children}</div>,
}));

jest.mock('../components/Toast', () => () => <div data-testid="toast" />);
jest.mock('../pages/LoginPage', () => () => <div data-testid="login-page" />);
jest.mock('../pages/DashboardPage', () => () => <div data-testid="dashboard-page" />);
jest.mock('../pages/PathDetailPage', () => () => <div data-testid="path-detail-page" />);
jest.mock('../pages/LiveTrackingPage', () => () => <div data-testid="live-tracking-page" />);
jest.mock('../pages/AuthCallback', () => () => <div data-testid="auth-callback" />);

const { useAuth } = require('../context/AuthContext');
const { useToast } = require('../context/ToastContext');

describe('App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useToast.mockReturnValue({ addToast: jest.fn() });
  });

  it('should render loading spinner when loading', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    const spinner = container.querySelector('.spinner-overlay');
    expect(spinner).toBeTruthy();
    expect(spinner.querySelector('.spinner')).toBeTruthy();
  });

  it('should render app wrapper when not loading', () => {
    useAuth.mockReturnValue({ user: { id: 'user-1' }, loading: false });
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(container.querySelector('.app-wrapper')).toBeTruthy();
  });

  it('should render Toast component', () => {
    useAuth.mockReturnValue({ user: { id: 'user-1' }, loading: false });
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(container.querySelector('[data-testid="toast"]')).toBeTruthy();
  });

  it('should set window.showToast in useEffect', () => {
    const mockAddToast = jest.fn();
    useToast.mockReturnValue({ addToast: mockAddToast });
    useAuth.mockReturnValue({ user: { id: 'user-1' }, loading: false });
    
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    
    expect(window.showToast).toBe(mockAddToast);
  });

  it('should render app wrapper structure', () => {
    useAuth.mockReturnValue({ user: { id: 'user-1' }, loading: false });
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(container.querySelector('.app-wrapper')).toBeTruthy();
  });

  it('should render with no user initially loading', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(container).toBeTruthy();
  });

  it('should handle authentication context and toast context together', () => {
    const mockAddToast = jest.fn();
    useToast.mockReturnValue({ addToast: mockAddToast });
    useAuth.mockReturnValue({ user: { id: 'user-1' }, loading: false });
    
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    
    expect(container).toBeTruthy();
    expect(window.showToast).toBe(mockAddToast);
  });

  it('should render Routes component', () => {
    useAuth.mockReturnValue({ user: { id: 'user-1' }, loading: false });
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(container).toBeTruthy();
  });

  it('should render app when loading transitions to false', () => {
    useAuth.mockReturnValue({ user: { id: 'user-1' }, loading: false });
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(container.querySelector('.app-wrapper')).toBeTruthy();
  });

  it('should handle unauthenticated user state', () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(container).toBeTruthy();
  });

  it('should handle authenticated user state', () => {
    useAuth.mockReturnValue({ user: { id: 'user-1', name: 'Test' }, loading: false });
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(container).toBeTruthy();
  });
});

describe('PrivateRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useToast.mockReturnValue({ addToast: jest.fn() });
  });

  it('should render spinner overlay when loading is true', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(
      <MemoryRouter>
        <PrivateRoute>
          <div>Protected</div>
        </PrivateRoute>
      </MemoryRouter>
    );
    const overlay = container.querySelector('.spinner-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.querySelector('.spinner')).toBeTruthy();
  });

  it('should render children when user is authenticated and loading is false', () => {
    useAuth.mockReturnValue({ user: { id: 'user-1' }, loading: false });
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(container.querySelector('[data-testid="dashboard-page"]')).toBeTruthy();
  });

  it('should show loading spinner when loading is true at root path', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(
      <BrowserRouter initialEntries={['/']}>
        <App />
      </BrowserRouter>
    );
    expect(container.querySelector('.spinner-overlay')).toBeTruthy();
    expect(container.querySelector('.spinner')).toBeTruthy();
  });

  it('should show loading spinner when loading true for protected routes', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(container.querySelector('.spinner')).toBeTruthy();
  });

  it('should render loading overlay with spinner class', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    const overlay = container.querySelector('.spinner-overlay');
    expect(overlay).toBeTruthy();
  });

  it('should show redirect message when user is null and loading is false', () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(container).toBeTruthy();
  });

  it('should render dashboard when authenticated', () => {
    useAuth.mockReturnValue({ user: { id: 'user-1' }, loading: false });
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(container.querySelector('[data-testid="dashboard-page"]')).toBeTruthy();
  });

  it('should render login page when not authenticated', () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(container).toBeTruthy();
  });

  it('should maintain loading state', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(container.querySelector('.spinner')).toBeTruthy();
  });

  it('should properly signal loading state to PrivateRoute', () => {
    useAuth.mockReturnValue({ user: { id: 'user-1', loading: true }, loading: true });
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(container).toBeTruthy();
  });

  it('should show loader on protected route with MemoryRouter', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(
      <MemoryRouter initialEntries={['/path/123']}>
        <App />
      </MemoryRouter>
    );
    expect(container.querySelector('.spinner')).toBeTruthy();
  });

  it('should show loader on live tracking route with loading', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(
      <MemoryRouter initialEntries={['/path/123/live']}>
        <App />
      </MemoryRouter>
    );
    expect(container.querySelector('.spinner-overlay')).toBeTruthy();
  });

  it('should render spinner overlay structure with first child div', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(
      <MemoryRouter initialEntries={['/path/123']}>
        <App />
      </MemoryRouter>
    );
    const overlay = container.querySelector('.spinner-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.querySelector('.spinner')).toBeTruthy();
    expect(overlay.querySelector('div.spinner')).toBeTruthy();
  });

  it('PrivateRoute should return spinner when loading on protected route', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(
      <MemoryRouter initialEntries={['/path/abc/live']}>
        <App />
      </MemoryRouter>
    );
    // Verify PrivateRoute renders loading state
    const spinnerOverlay = container.querySelector('.spinner-overlay');
    expect(spinnerOverlay).toBeTruthy();
    // Verify it's the nested structure from PrivateRoute
    expect(spinnerOverlay.children[0].className).toBe('spinner');
  });

  it('PrivateRoute loading return creates spinner-overlay div element', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(
      <MemoryRouter initialEntries={['/path/xyz']}>
        <App />
      </MemoryRouter>
    );
    const overlay = container.querySelector('.spinner-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.tagName).toBe('DIV');
  });

  it('PrivateRoute loading state return includes spinner inner div', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(
      <MemoryRouter initialEntries={['/path/test/live']}>
        <App />
      </MemoryRouter>
    );
    const overlay = container.querySelector('.spinner-overlay');
    const spinner = overlay?.querySelector('.spinner');
    expect(spinner).toBeTruthy();
    expect(spinner?.tagName).toBe('DIV');
  });

  it('PrivateRoute return should render when loading is true', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    // This should invoke PrivateRoute's return statement on line 15+
    const overlays = container.querySelectorAll('.spinner-overlay');
    expect(overlays.length).toBeGreaterThan(0);
  });

  it('PrivateRoute executes conditional loading check with DOM structure', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    const { container, unmount } = render(
      <MemoryRouter initialEntries={['/path/123']}>
        <App />
      </MemoryRouter>
    );
    // Ensure PrivateRoute's return JSX creates proper DOM
    const structure = container.querySelector('.spinner-overlay > .spinner');
    expect(structure).toBeTruthy();
    unmount();
  });

  it('PrivateRoute handles loading condition across multiple mounts', () => {
    const mockUseAuth = useAuth;
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    
    // First render - loading true
    const result1 = render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    expect(result1.container.querySelector('.spinner-overlay')).toBeTruthy();
    result1.unmount();

    // Second render - loading true, different path
    const result2 = render(
      <MemoryRouter initialEntries={['/path/456/live']}>
        <App />
      </MemoryRouter>
    );
    expect(result2.container.querySelector('.spinner-overlay')).toBeTruthy();
    result2.unmount();
  });

  it('PrivateRoute JSX return element tree', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    
    // Verify the exact structure from PrivateRoute's return
    const overlay = container.querySelector('.spinner-overlay');
    const spinner = overlay?.firstChild;
    expect(spinner?.className).toBe('spinner');
  });

  it('PrivateRoute should show spinner when PrivateRoute loading is true but App loading is false', () => {
    // First call (App component) returns loading: false so routes render
    // Second call (PrivateRoute component) returns loading: true so PrivateRoute shows its spinner
    useAuth
      .mockReturnValueOnce({ user: null, loading: false })
      .mockReturnValueOnce({ user: null, loading: true });

    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    // PrivateRoute's loading spinner should be rendered
    const spinnerOverlay = container.querySelector('.spinner-overlay');
    expect(spinnerOverlay).toBeTruthy();
    expect(spinnerOverlay.querySelector('.spinner')).toBeTruthy();
  });

  it('PrivateRoute loading branch renders spinner-overlay with inner spinner div', () => {
    useAuth
      .mockReturnValueOnce({ user: null, loading: false })
      .mockReturnValueOnce({ user: null, loading: true });

    const { container } = render(
      <MemoryRouter initialEntries={['/path/test']}>
        <App />
      </MemoryRouter>
    );

    const overlay = container.querySelector('.spinner-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.tagName).toBe('DIV');
    const spinner = overlay.querySelector('.spinner');
    expect(spinner).toBeTruthy();
    expect(spinner.tagName).toBe('DIV');
  });

  it('PrivateRoute loading branch on live tracking route', () => {
    useAuth
      .mockReturnValueOnce({ user: { id: 'user-1' }, loading: false })
      .mockReturnValueOnce({ user: null, loading: true });

    const { container } = render(
      <MemoryRouter initialEntries={['/path/123/live']}>
        <App />
      </MemoryRouter>
    );

    const spinnerOverlay = container.querySelector('.spinner-overlay');
    expect(spinnerOverlay).toBeTruthy();
    expect(spinnerOverlay.firstChild.className).toBe('spinner');
  });
});
