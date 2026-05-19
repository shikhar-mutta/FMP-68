import React from 'react';
import { act, fireEvent, render as rtlRender, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import * as followRequestService from '../../services/followRequestService';
import * as notificationService from '../../services/notificationService';

jest.mock('../../services/followRequestService', () => ({
  getPendingFollowRequests: jest.fn(),
  approveFollowRequest: jest.fn(),
  rejectFollowRequest: jest.fn(),
}));
jest.mock('../../services/notificationService', () => ({
  fetchMyNotifications: jest.fn(),
  dismissNotification: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const render = (ui, options) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>, options);

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
    followRequestService.getPendingFollowRequests.mockResolvedValue([]);
    notificationService.fetchMyNotifications.mockResolvedValue([]);
  });

  it('should render navbar shell', () => {
    const { container } = render(<Navbar />);
    expect(container.querySelector('nav')).toBeTruthy();
    expect(container.querySelector('.navbar-brand')?.textContent).toBe('FMP-69');
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
    // Sign-out moved into avatar dropdown — open it first.
    fireEvent.click(container.querySelector('.navbar-avatar-btn'));
    expect(container.querySelector('.avatar-dropdown-item--signout')).toBeTruthy();
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
    fireEvent.click(container.querySelector('.navbar-avatar-btn'));
    const button = container.querySelector('.avatar-dropdown-item--signout');
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

  it('renders hamburger button when onMenuOpen is supplied', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', name: 'X' },
      signOut: jest.fn(),
    });
    const onMenuOpen = jest.fn();
    const { container } = render(<Navbar onMenuOpen={onMenuOpen} />);
    const ham = container.querySelector('.navbar-hamburger');
    fireEvent.click(ham);
    expect(onMenuOpen).toHaveBeenCalledTimes(1);
  });

  describe('notifications & follow requests', () => {
    const user = { id: 'u1', name: 'Alice' };
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user, signOut: jest.fn() });
      window.showToast = jest.fn();
    });

    it('opens the bell dropdown and shows pending follow requests + badge', async () => {
      followRequestService.getPendingFollowRequests.mockResolvedValue([
        {
          pathId: 'p1',
          followerId: 'fu1',
          pathTitle: 'Trail A',
          follower: { name: 'Bob', picture: 'http://img/bob.png' },
        },
      ]);
      const { container } = render(<Navbar />);

      await waitFor(() => {
        expect(container.querySelector('.navbar-bell-badge').textContent).toBe('1');
      });

      fireEvent.click(container.querySelector('.navbar-bell'));
      expect(container.querySelector('.notif-dropdown')).toBeTruthy();
      expect(container.querySelector('.notif-item-text').textContent).toContain('Bob');
    });

    it('renders initials avatar fallback when follower has no picture', async () => {
      followRequestService.getPendingFollowRequests.mockResolvedValue([
        {
          pathId: 'p1',
          followerId: 'fu1',
          pathTitle: 'Trail A',
          follower: { name: 'charlie' },
        },
      ]);
      const { container } = render(<Navbar />);
      await waitFor(() =>
        expect(container.querySelector('.navbar-bell-badge').textContent).toBe('1'),
      );
      fireEvent.click(container.querySelector('.navbar-bell'));
      const initials = container.querySelector('.notif-avatar--initials');
      expect(initials.textContent).toBe('C');
    });

    it('caps the bell badge count at 99+', async () => {
      followRequestService.getPendingFollowRequests.mockResolvedValue(
        Array.from({ length: 120 }, (_, i) => ({
          pathId: `p${i}`,
          followerId: `f${i}`,
          pathTitle: 't',
          follower: { name: 'x' },
        })),
      );
      const { container } = render(<Navbar />);
      await waitFor(() =>
        expect(container.querySelector('.navbar-bell-badge').textContent).toBe('99+'),
      );
    });

    it('approves a follow request and removes it from the list', async () => {
      followRequestService.getPendingFollowRequests.mockResolvedValue([
        { pathId: 'p1', followerId: 'fu1', pathTitle: 't', follower: { name: 'B' } },
      ]);
      followRequestService.approveFollowRequest.mockResolvedValue({});
      const { container } = render(<Navbar />);
      await waitFor(() =>
        expect(container.querySelector('.navbar-bell-badge')).toBeTruthy(),
      );
      fireEvent.click(container.querySelector('.navbar-bell'));
      await act(async () => {
        fireEvent.click(container.querySelector('.notif-btn--approve'));
      });
      expect(followRequestService.approveFollowRequest).toHaveBeenCalledWith('p1', 'fu1');
      await waitFor(() => {
        expect(container.querySelector('.navbar-bell-badge')).toBeFalsy();
      });
      expect(window.showToast).toHaveBeenCalledWith('Follow request approved!', 'success');
    });

    it('surfaces an error toast when approve fails', async () => {
      followRequestService.getPendingFollowRequests.mockResolvedValue([
        { pathId: 'p1', followerId: 'fu1', pathTitle: 't', follower: { name: 'B' } },
      ]);
      followRequestService.approveFollowRequest.mockRejectedValue(new Error('nope'));
      const { container } = render(<Navbar />);
      await waitFor(() =>
        expect(container.querySelector('.navbar-bell-badge')).toBeTruthy(),
      );
      fireEvent.click(container.querySelector('.navbar-bell'));
      await act(async () => {
        fireEvent.click(container.querySelector('.notif-btn--approve'));
      });
      expect(window.showToast).toHaveBeenCalledWith('Failed to approve request', 'error');
    });

    it('rejects a follow request and removes it from the list', async () => {
      followRequestService.getPendingFollowRequests.mockResolvedValue([
        { pathId: 'p1', followerId: 'fu1', pathTitle: 't', follower: { name: 'B' } },
      ]);
      followRequestService.rejectFollowRequest.mockResolvedValue({});
      const { container } = render(<Navbar />);
      await waitFor(() =>
        expect(container.querySelector('.navbar-bell-badge')).toBeTruthy(),
      );
      fireEvent.click(container.querySelector('.navbar-bell'));
      await act(async () => {
        fireEvent.click(container.querySelector('.notif-btn--reject'));
      });
      expect(followRequestService.rejectFollowRequest).toHaveBeenCalledWith('p1', 'fu1');
      expect(window.showToast).toHaveBeenCalledWith('Follow request rejected', 'warning');
    });

    it('surfaces an error toast when reject fails', async () => {
      followRequestService.getPendingFollowRequests.mockResolvedValue([
        { pathId: 'p1', followerId: 'fu1', pathTitle: 't', follower: { name: 'B' } },
      ]);
      followRequestService.rejectFollowRequest.mockRejectedValue(new Error('x'));
      const { container } = render(<Navbar />);
      await waitFor(() =>
        expect(container.querySelector('.navbar-bell-badge')).toBeTruthy(),
      );
      fireEvent.click(container.querySelector('.navbar-bell'));
      await act(async () => {
        fireEvent.click(container.querySelector('.notif-btn--reject'));
      });
      expect(window.showToast).toHaveBeenCalledWith('Failed to reject request', 'error');
    });

    it('shows approval notifications and navigates on click, dismissing the notif', async () => {
      notificationService.fetchMyNotifications.mockResolvedValue([
        { id: 'n1', pathId: 'p9', pathTitle: 'Coastal Loop' },
      ]);
      notificationService.dismissNotification.mockResolvedValue({});
      const { container } = render(<Navbar />);
      await waitFor(() =>
        expect(container.querySelector('.navbar-bell-badge').textContent).toBe('1'),
      );
      fireEvent.click(container.querySelector('.navbar-bell'));
      const approvalItem = container.querySelector('.notif-item--approval');
      expect(approvalItem).toBeTruthy();
      await act(async () => {
        fireEvent.click(approvalItem);
      });
      expect(notificationService.dismissNotification).toHaveBeenCalledWith('n1');
      expect(mockNavigate).toHaveBeenCalledWith('/path/p9');
    });

    it('still navigates when dismissNotification rejects', async () => {
      notificationService.fetchMyNotifications.mockResolvedValue([
        { id: 'n1', pathId: 'p9', pathTitle: 'Coastal Loop' },
      ]);
      notificationService.dismissNotification.mockRejectedValue(new Error('boom'));
      const { container } = render(<Navbar />);
      await waitFor(() =>
        expect(container.querySelector('.navbar-bell-badge').textContent).toBe('1'),
      );
      fireEvent.click(container.querySelector('.navbar-bell'));
      await act(async () => {
        fireEvent.click(container.querySelector('.notif-item--approval'));
      });
      expect(mockNavigate).toHaveBeenCalledWith('/path/p9');
    });

    it('approval item is keyboard-actionable (Enter key triggers click handler)', async () => {
      notificationService.fetchMyNotifications.mockResolvedValue([
        { id: 'n1', pathId: 'p9', pathTitle: 'Coastal Loop' },
      ]);
      notificationService.dismissNotification.mockResolvedValue({});
      const { container } = render(<Navbar />);
      await waitFor(() =>
        expect(container.querySelector('.navbar-bell-badge')).toBeTruthy(),
      );
      fireEvent.click(container.querySelector('.navbar-bell'));
      await act(async () => {
        fireEvent.keyDown(container.querySelector('.notif-item--approval'), {
          key: 'Enter',
        });
      });
      expect(mockNavigate).toHaveBeenCalledWith('/path/p9');
    });

    it('shows "No pending requests" message when none', async () => {
      followRequestService.getPendingFollowRequests.mockResolvedValue([]);
      const { container } = render(<Navbar />);
      fireEvent.click(container.querySelector('.navbar-bell'));
      await waitFor(() => {
        expect(container.querySelector('.notif-empty').textContent).toBe(
          'No pending requests',
        );
      });
    });

    it('closes the bell dropdown when clicking outside', async () => {
      const { container } = render(<Navbar />);
      fireEvent.click(container.querySelector('.navbar-bell'));
      expect(container.querySelector('.notif-dropdown')).toBeTruthy();
      fireEvent.mouseDown(document.body);
      await waitFor(() => {
        expect(container.querySelector('.notif-dropdown')).toBeFalsy();
      });
    });

    it('closes the avatar menu when clicking outside', async () => {
      const { container } = render(<Navbar />);
      fireEvent.click(container.querySelector('.navbar-avatar-btn'));
      expect(container.querySelector('.avatar-dropdown')).toBeTruthy();
      fireEvent.mouseDown(document.body);
      await waitFor(() => {
        expect(container.querySelector('.avatar-dropdown')).toBeFalsy();
      });
    });

    it('silently ignores follow-request fetch errors', async () => {
      followRequestService.getPendingFollowRequests.mockRejectedValue(new Error('x'));
      notificationService.fetchMyNotifications.mockResolvedValue([]);
      const { container } = render(<Navbar />);
      await waitFor(() => expect(container.querySelector('nav')).toBeTruthy());
      // No badge means the catch ran without crashing.
      expect(container.querySelector('.navbar-bell-badge')).toBeFalsy();
    });

    it('silently ignores approval-notif fetch errors', async () => {
      notificationService.fetchMyNotifications.mockRejectedValue(new Error('y'));
      followRequestService.getPendingFollowRequests.mockResolvedValue([]);
      const { container } = render(<Navbar />);
      await waitFor(() => expect(container.querySelector('nav')).toBeTruthy());
      expect(container.querySelector('.navbar-bell-badge')).toBeFalsy();
    });

    it('shows username in avatar dropdown when user has username', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'u1', name: 'Alice', username: 'alice99' },
        signOut: jest.fn(),
      });
      const { container } = render(<Navbar />);
      fireEvent.click(container.querySelector('.navbar-avatar-btn'));
      const usernameEl = container.querySelector('.avatar-dropdown-username');
      expect(usernameEl).toBeTruthy();
      expect(usernameEl.textContent).toBe('@alice99');
    });
  });

  it('does not fetch requests when user is null (fetchRequests early return)', async () => {
    mockUseAuth.mockReturnValue({ user: null, signOut: jest.fn() });
    followRequestService.getPendingFollowRequests.mockResolvedValue([]);
    const { container } = render(<Navbar />);
    await waitFor(() => expect(container.querySelector('nav')).toBeTruthy());
    // No bell visible since user is null
    expect(container.querySelector('.navbar-bell')).toBeFalsy();
    // getPendingFollowRequests should NOT have been called
    expect(followRequestService.getPendingFollowRequests).not.toHaveBeenCalled();
  });

  it('handles non-array response from getPendingFollowRequests gracefully', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', name: 'Alice' },
      signOut: jest.fn(),
    });
    // Return a non-array response — covers the ternary false branch: Array.isArray(data) ? data : []
    followRequestService.getPendingFollowRequests.mockResolvedValue(null);
    notificationService.fetchMyNotifications.mockResolvedValue([]);

    const { container } = render(<Navbar />);

    await waitFor(() => expect(container.querySelector('nav')).toBeTruthy());
    // No badge since requests defaults to empty array
    expect(container.querySelector('.navbar-bell-badge')).toBeFalsy();
  });

  it('approves follow request without showing toast when window.showToast is undefined', async () => {
    delete window.showToast;
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', name: 'Alice' },
      signOut: jest.fn(),
    });
    followRequestService.getPendingFollowRequests.mockResolvedValue([
      { pathId: 'p1', followerId: 'fu1', pathTitle: 't', follower: { name: 'B' } },
    ]);
    followRequestService.approveFollowRequest.mockResolvedValue({});
    const { container } = render(<Navbar />);
    await waitFor(() =>
      expect(container.querySelector('.navbar-bell-badge')).toBeTruthy(),
    );
    fireEvent.click(container.querySelector('.navbar-bell'));
    await act(async () => {
      fireEvent.click(container.querySelector('.notif-btn--approve'));
    });
    expect(followRequestService.approveFollowRequest).toHaveBeenCalled();
    // window.showToast is undefined, so no toast call
    expect(window.showToast).toBeUndefined();
  });

  it('rejects follow request without showing toast when window.showToast is undefined', async () => {
    delete window.showToast;
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', name: 'Alice' },
      signOut: jest.fn(),
    });
    followRequestService.getPendingFollowRequests.mockResolvedValue([
      { pathId: 'p1', followerId: 'fu1', pathTitle: 't', follower: { name: 'B' } },
    ]);
    followRequestService.rejectFollowRequest.mockResolvedValue({});
    const { container } = render(<Navbar />);
    await waitFor(() =>
      expect(container.querySelector('.navbar-bell-badge')).toBeTruthy(),
    );
    fireEvent.click(container.querySelector('.navbar-bell'));
    await act(async () => {
      fireEvent.click(container.querySelector('.notif-btn--reject'));
    });
    expect(followRequestService.rejectFollowRequest).toHaveBeenCalled();
    expect(window.showToast).toBeUndefined();
  });

  it('approve failure without toast when window.showToast is undefined', async () => {
    delete window.showToast;
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', name: 'Alice' },
      signOut: jest.fn(),
    });
    followRequestService.getPendingFollowRequests.mockResolvedValue([
      { pathId: 'p1', followerId: 'fu1', pathTitle: 't', follower: { name: 'B' } },
    ]);
    followRequestService.approveFollowRequest.mockRejectedValue(new Error('fail'));
    const { container } = render(<Navbar />);
    await waitFor(() =>
      expect(container.querySelector('.navbar-bell-badge')).toBeTruthy(),
    );
    fireEvent.click(container.querySelector('.navbar-bell'));
    await act(async () => {
      fireEvent.click(container.querySelector('.notif-btn--approve'));
    });
    expect(window.showToast).toBeUndefined();
  });

  it('reject failure without toast when window.showToast is undefined', async () => {
    delete window.showToast;
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', name: 'Alice' },
      signOut: jest.fn(),
    });
    followRequestService.getPendingFollowRequests.mockResolvedValue([
      { pathId: 'p1', followerId: 'fu1', pathTitle: 't', follower: { name: 'B' } },
    ]);
    followRequestService.rejectFollowRequest.mockRejectedValue(new Error('fail'));
    const { container } = render(<Navbar />);
    await waitFor(() =>
      expect(container.querySelector('.navbar-bell-badge')).toBeTruthy(),
    );
    fireEvent.click(container.querySelector('.navbar-bell'));
    await act(async () => {
      fireEvent.click(container.querySelector('.notif-btn--reject'));
    });
    expect(window.showToast).toBeUndefined();
  });

  it('does NOT close bell dropdown when clicking INSIDE it', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', name: 'Alice' },
      signOut: jest.fn(),
    });
    const { container } = render(<Navbar />);
    fireEvent.click(container.querySelector('.navbar-bell'));
    expect(container.querySelector('.notif-dropdown')).toBeTruthy();
    // Click inside the dropdown — should NOT close it
    fireEvent.mouseDown(container.querySelector('.notif-dropdown'));
    expect(container.querySelector('.notif-dropdown')).toBeTruthy();
  });

  it('does NOT close avatar menu when clicking INSIDE it', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', name: 'Alice' },
      signOut: jest.fn(),
    });
    const { container } = render(<Navbar />);
    fireEvent.click(container.querySelector('.navbar-avatar-btn'));
    expect(container.querySelector('.avatar-dropdown')).toBeTruthy();
    // Click inside the avatar dropdown — should NOT close it
    fireEvent.mouseDown(container.querySelector('.avatar-dropdown'));
    expect(container.querySelector('.avatar-dropdown')).toBeTruthy();
  });
});
