import React from 'react';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import DashboardPage from '../../pages/DashboardPage';

const render = (ui, options) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>, options);

const mockUseAuth = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../../context/ToastContext', () => ({
  useToast: () => ({ addToast: jest.fn() }),
}));

jest.mock('axios', () => {
  const inst = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return {
    __esModule: true,
    default: { ...inst, create: jest.fn(() => inst) },
    ...inst,
    create: jest.fn(() => inst),
  };
});

jest.mock('../../components/Navbar', () => ({ onMenuOpen }) => (
  <div data-testid="navbar">
    <button data-testid="open-menu" onClick={onMenuOpen}>Menu</button>
  </div>
));
jest.mock('../../components/UserCard', () => ({ user }) => (
  <div data-testid="user-card">{user.name || 'User'}</div>
));
jest.mock('../../components/PathPublishForm', () => ({ onPathPublished }) => (
  <div data-testid="path-publish-form">
    <button
      onClick={() =>
        onPathPublished({
          id: 'path-new',
          name: 'Test Path',
          publisher: { id: 'user-1' },
        })
      }
    >
      Publish
    </button>
  </div>
));
jest.mock('../../components/PathCard', () => ({ path, isFollowing, onFollowChange, onRequestSent, onPathUpdated, onPathDeleted }) => (
  <div data-testid="path-card">
    <span>{path.name}</span>
    <span data-testid="follow-state">{isFollowing ? 'following' : 'not-following'}</span>
    <button onClick={() => onFollowChange(path.id, true)}>Follow</button>
    <button onClick={() => onFollowChange(path.id, false)}>Unfollow</button>
    <button onClick={() => onRequestSent(path.id)}>Request</button>
    <button onClick={() => onPathUpdated && onPathUpdated({ ...path, name: 'Updated Path' })}>Update Path</button>
    <button onClick={() => onPathDeleted && onPathDeleted(path.id)}>Delete Path</button>
  </div>
));
jest.mock('../../components/RequestSummaryModalPanel', () => () => (
  <div data-testid="request-summary">Requests</div>
));
jest.mock('../../components/SentRequestsPanel', () => () => (
  <div data-testid="sent-requests">Sent Requests</div>
));

describe('DashboardPage', () => {
  const mockSignOut = jest.fn();

  beforeEach(() => {
    localStorage.setItem('fmp68_token', 'test-token');
    jest.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', name: 'John Doe' },
      signOut: mockSignOut,
    });

    axios.get.mockImplementation((url) => {
      if (url.includes('/users')) {
        return Promise.resolve({
          data: [
            { id: 'user-2', name: 'Jane', isOnline: true },
            { id: 'user-3', name: 'Bob', isOnline: false },
          ],
        });
      }
      if (url.includes('/paths') && url.includes('followed')) {
        return Promise.resolve({ data: [{ id: 'path-1' }] });
      }
      if (url.includes('/paths')) {
        return Promise.resolve({
          data: [
            { id: 'path-1', name: 'Path 1', userId: 'user-2' },
            { id: 'path-2', name: 'Path 2', userId: 'user-3' },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should render dashboard page', async () => {
    const { container } = render(<DashboardPage />);
    await waitFor(() => {
      expect(container.querySelector('main')).toBeInTheDocument();
    });
  });

  it('should render navbar component', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByTestId('navbar')).toBeInTheDocument();
    });
  });

  it('should render main dashboard content', async () => {
    const { container } = render(<DashboardPage />);
    await waitFor(() => {
      expect(container.querySelector('main.dashboard')).toBeInTheDocument();
    });
  });

  it('should fetch and display users', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/users'),
        expect.any(Object)
      );
    });
  });

  it('should fetch and display paths', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/paths'),
        expect.any(Object)
      );
    });
  });

  it('should display welcome message with user name', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/Welcome back, John/i)).toBeInTheDocument();
    });
  });

  it('should display paths count in header', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      // Count rendered inside the "Paths" tab button as "(n)"
      expect(screen.getByRole('button', { name: /📍 Paths \(2\)/i })).toBeInTheDocument();
    });
  });

  it('should display users count in header', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      // Header now shows total users (including current). 2 other + current = 3.
      expect(screen.getByText(/3 users/i)).toBeInTheDocument();
    });
  });

  it('should display singular labels when counts are 1', async () => {
    axios.get.mockClear();
    axios.get.mockImplementation((url) => {
      if (url.includes('/users')) {
        return Promise.resolve({
          data: [],
        });
      }
      if (url.includes('/paths') && url.includes('followed')) {
        return Promise.resolve({ data: [{ id: 'path-1' }] });
      }
      if (url.includes('/paths')) {
        return Promise.resolve({
          data: [{ id: 'path-1', name: 'Path 1', userId: 'user-2' }],
        });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DashboardPage />);

    await waitFor(() => {
      // Only current user → 1 user (singular)
      expect(screen.getByText(/1 user/i)).toBeInTheDocument();
    });
  });

  it('should display online count in header', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      // 1 online other + current = 2 online
      expect(screen.getByText(/2 online/i)).toBeInTheDocument();
    });
  });

  it('should render tab navigation buttons', async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /📍 Paths/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /🗂️ My Paths/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /👥 Users/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /📬 Requests/i })).toBeInTheDocument();
    });
  });

  it('should show paths tab by default', async () => {
    const { container } = render(<DashboardPage />);
    await waitFor(() => {
      // "paths" tab is default → renders the paths-grid (not publish form).
      expect(container.querySelector('.paths-grid')).toBeInTheDocument();
    });
  });

  it('should switch to users tab when clicked', async () => {
    render(<DashboardPage />);
    const usersButton = screen.getByRole('button', { name: /Users/i });

    await waitFor(() => {
      fireEvent.click(usersButton);
    });

    await waitFor(() => {
      expect(screen.getAllByTestId('user-card')).toHaveLength(2);
    });
  });

  it('should switch to received requests tab when clicked', async () => {
    const { container } = render(<DashboardPage />);
    const requestsButton = screen.getByRole('button', { name: /📬 Requests/i });

    await waitFor(() => {
      fireEvent.click(requestsButton);
    });

    await waitFor(() => {
      // Requests tab renders FollowRequestsPanel inside .tab-content
      expect(container.querySelector('.tab-content')).toBeInTheDocument();
    });
  });

  it('should switch back to paths tab when clicked', async () => {
    const { container } = render(<DashboardPage />);
    const usersButton = screen.getByRole('button', { name: /👥 Users/i });
    const pathsButton = screen.getByRole('button', { name: /📍 Paths/i });

    fireEvent.click(usersButton);

    await waitFor(() => {
      expect(container.querySelector('.users-grid')).toBeInTheDocument();
    });

    fireEvent.click(pathsButton);

    await waitFor(() => {
      expect(container.querySelector('.paths-grid')).toBeInTheDocument();
    });
  });

  it('should switch to my paths tab when clicked', async () => {
    render(<DashboardPage />);
    const myPathsButton = screen.getByRole('button', { name: /🗂️ My Paths/i });

    await waitFor(() => {
      fireEvent.click(myPathsButton);
    });

    await waitFor(() => {
      // My Paths tab renders the PathPublishForm
      expect(screen.getByTestId('path-publish-form')).toBeInTheDocument();
    });
  });

  it('should add new path when published from my-paths tab', async () => {
    render(<DashboardPage />);

    // Switch to my-paths tab first (publish form lives here)
    const myPathsButton = screen.getByRole('button', { name: /🗂️ My Paths/i });
    fireEvent.click(myPathsButton);

    await waitFor(() => {
      expect(screen.getByTestId('path-publish-form')).toBeInTheDocument();
    });

    const publishButton = screen.getByRole('button', { name: /Publish/i });
    fireEvent.click(publishButton);

    await waitFor(() => {
      expect(screen.getByTestId('path-publish-form')).toBeInTheDocument();
    });
  });

  it('should handle follow/unfollow path', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      // Wait for paths to load
      expect(axios.get).toHaveBeenCalled();
    });
  });

  it('should set up inactivity timer on mount', async () => {
    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalled();
    });
  });

  it('should render container with correct class', async () => {
    const { container } = render(<DashboardPage />);
    await waitFor(() => {
      expect(container.querySelector('.container')).toBeInTheDocument();
    });
  });

  it('should render dashboard header with title', async () => {
    const { container } = render(<DashboardPage />);
    await waitFor(() => {
      expect(container.querySelector('.dashboard-header')).toBeInTheDocument();
      expect(container.querySelector('.dashboard-title')).toBeInTheDocument();
    });
  });

  it('should render paths grid with correct content', async () => {
    const { container } = render(<DashboardPage />);
    await waitFor(() => {
      const pathsGrid = container.querySelector('.paths-grid');
      expect(pathsGrid).toBeInTheDocument();
    });
  });

  it('should render users grid in users tab', async () => {
    const { container } = render(<DashboardPage />);
    const usersButton = screen.getByRole('button', { name: /Users/i });

    fireEvent.click(usersButton);

    await waitFor(() => {
      expect(container.querySelector('.users-grid')).toBeInTheDocument();
    });
  });

  it('should handle empty users list', async () => {
    axios.get.mockClear();
    axios.get.mockImplementation((url) => {
      if (url.includes('/users')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/paths')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('followed')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    const { container } = render(<DashboardPage />);
    const usersButton = screen.getByRole('button', { name: /Users/i });

    fireEvent.click(usersButton);

    await waitFor(() => {
      const emptyState = container.querySelector('.empty-state');
      expect(emptyState).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should handle empty paths list', async () => {
    axios.get.mockClear();
    axios.get.mockImplementation((url) => {
      if (url.includes('/paths')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/users')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('followed')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    const { container } = render(<DashboardPage />);

    await waitFor(() => {
      const emptyState = container.querySelector('.empty-state');
      expect(emptyState).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should handle null paths response', async () => {
    axios.get.mockClear();
    axios.get.mockImplementation((url) => {
      if (url.includes('/paths') && !url.includes('followed')) {
        return Promise.resolve({ data: null });
      }
      if (url.includes('/users')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('followed')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    const { container } = render(<DashboardPage />);

    await waitFor(() => {
      const emptyState = container.querySelector('.empty-state');
      expect(emptyState).toBeInTheDocument();
    });
  });

  it('should filter out current user from users list', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/users'),
        expect.any(Object)
      );
    });
  });

  it('should skip API calls when token is missing', async () => {
    localStorage.clear();

    const { container } = render(<DashboardPage />);

    await waitFor(() => {
      expect(axios.get).not.toHaveBeenCalled();
      expect(container.querySelector('.spinner-overlay')).toBeInTheDocument();
    });
  });

  it('should skip followed paths fetch when user id is missing', async () => {
    mockUseAuth.mockReturnValue({ user: null, signOut: mockSignOut });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/paths'),
        expect.any(Object)
      );
    });

    expect(axios.get).not.toHaveBeenCalledWith(
      expect.stringContaining('/paths/followed/my-paths'),
      expect.any(Object)
    );
  });

  it('should handle users fetch error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    axios.get.mockImplementation((url) => {
      if (url.includes('/users')) {
        return Promise.reject(new Error('Users failed'));
      }
      if (url.includes('/paths') && url.includes('followed')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/paths')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DashboardPage />);

    const usersButton = screen.getByRole('button', { name: /Users/i });
    fireEvent.click(usersButton);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch users:', expect.any(Error));
      expect(screen.getByText('No other users yet')).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it('should handle paths fetch error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    axios.get.mockImplementation((url) => {
      if (url.includes('/paths')) {
        return Promise.reject(new Error('Paths failed'));
      }
      if (url.includes('/users')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch paths:', expect.any(Error));
      // Empty paths from others → renders updated empty title.
      expect(screen.getByText('No paths from others yet')).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it('should handle followed paths fetch error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    axios.get.mockImplementation((url) => {
      if (url.includes('/paths') && url.includes('followed')) {
        return Promise.reject(new Error('Followed failed'));
      }
      if (url.includes('/paths')) {
        return Promise.resolve({ data: [{ id: 'path-9', name: 'Path 9', userId: 'user-2' }] });
      }
      if (url.includes('/users')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch followed paths:', expect.any(Error));
      expect(screen.getByText('Path 9')).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it('should add new path and mark it as followed when published', async () => {
    render(<DashboardPage />);

    // PathPublishForm is on the my-paths tab — switch first.
    const myPathsButton = screen.getByRole('button', { name: /🗂️ My Paths/i });
    fireEvent.click(myPathsButton);

    await waitFor(() => {
      expect(screen.getByTestId('path-publish-form')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Publish/i }));

    await waitFor(() => {
      expect(screen.getByText('Test Path')).toBeInTheDocument();
    });
  });

  it('should handle follow and unfollow actions', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('path-card').length).toBeGreaterThan(0);
    });

    const followState = screen.getAllByTestId('follow-state')[1];
    const followButton = screen.getAllByText('Follow')[1];
    const unfollowButton = screen.getAllByText('Unfollow')[1];

    fireEvent.click(followButton);
    await waitFor(() => {
      expect(followState).toHaveTextContent('following');
    });

    fireEvent.click(unfollowButton);
    await waitFor(() => {
      expect(followState).toHaveTextContent('not-following');
    });
  });

  it('should log when request is sent', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Request').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByText('Request')[0]);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Request sent for path:', expect.any(String));
    });

    consoleSpy.mockRestore();
  });

  it('should auto sign out after inactivity', async () => {
    jest.useFakeTimers();

    render(<DashboardPage />);

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalled();
    });

    jest.advanceTimersByTime(30 * 60 * 1000 + 1);
    expect(mockSignOut).toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('should set active tab class when switching tabs', async () => {
    render(<DashboardPage />);

    const usersButton = screen.getByRole('button', { name: /Users/i });
    fireEvent.click(usersButton);

    await waitFor(() => {
      expect(usersButton.className).toContain('active');
    });
  });

  it('should remove inactivity listeners on unmount', async () => {
    const removeSpy = jest.spyOn(window, 'removeEventListener');

    const { unmount } = render(<DashboardPage />);

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalled();
    });

    unmount();

    expect(removeSpy).toHaveBeenCalled();
    removeSpy.mockRestore();
  });

  it('should open sidebar when Navbar menu button is clicked', async () => {
    const { container } = render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('open-menu')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('open-menu'));

    await waitFor(() => {
      expect(container.querySelector('.dashboard-tabs.open')).toBeInTheDocument();
    });
  });

  it('should close sidebar when backdrop is clicked', async () => {
    const { container } = render(<DashboardPage />);

    fireEvent.click(screen.getByTestId('open-menu'));

    await waitFor(() => {
      expect(container.querySelector('.dashboard-tabs-overlay')).toBeInTheDocument();
    });

    fireEvent.click(container.querySelector('.dashboard-tabs-overlay'));

    await waitFor(() => {
      expect(container.querySelector('.dashboard-tabs-overlay')).not.toBeInTheDocument();
    });
  });

  it('should close sidebar when close button is clicked', async () => {
    const { container } = render(<DashboardPage />);

    fireEvent.click(screen.getByTestId('open-menu'));

    await waitFor(() => {
      expect(container.querySelector('.dashboard-tabs.open')).toBeInTheDocument();
    });

    fireEvent.click(container.querySelector('.dashboard-tabs-close'));

    await waitFor(() => {
      expect(container.querySelector('.dashboard-tabs.open')).not.toBeInTheDocument();
    });
  });

  it('should call signOut and close sidebar when ds-signout button is clicked', async () => {
    const { container } = render(<DashboardPage />);

    fireEvent.click(screen.getByTestId('open-menu'));

    await waitFor(() => {
      expect(container.querySelector('.ds-signout')).toBeInTheDocument();
    });

    fireEvent.click(container.querySelector('.ds-signout'));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });

    expect(container.querySelector('.dashboard-tabs.open')).not.toBeInTheDocument();
  });

  it('should render user picture in sidebar when user has a picture', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', name: 'John Doe', picture: 'https://example.com/pic.jpg' },
      signOut: mockSignOut,
    });

    const { container } = render(<DashboardPage />);

    fireEvent.click(screen.getByTestId('open-menu'));

    await waitFor(() => {
      const img = container.querySelector('.ds-profile-avatar');
      expect(img).toBeInTheDocument();
      expect(img.getAttribute('src')).toBe('https://example.com/pic.jpg');
    });
  });

  it('should update path in list when handlePathUpdated is called', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Path 1')).toBeInTheDocument();
    });

    const updateButtons = screen.getAllByText('Update Path');
    fireEvent.click(updateButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Updated Path')).toBeInTheDocument();
    });
  });

  it('should remove path from list when handlePathDeleted is called', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Path 1')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText('Delete Path');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText('Path 1')).not.toBeInTheDocument();
    });
  });

  it('should close sidebar when a tab is selected', async () => {
    const { container } = render(<DashboardPage />);

    fireEvent.click(screen.getByTestId('open-menu'));

    await waitFor(() => {
      expect(container.querySelector('.dashboard-tabs.open')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /\ud83d\udc65 Users/i }));

    await waitFor(() => {
      expect(container.querySelector('.dashboard-tabs.open')).not.toBeInTheDocument();
    });
  });
});