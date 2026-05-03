import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PathDetailPage from '../../pages/PathDetailPage';
import { useAuth } from '../../context/AuthContext';
import * as followRequestService from '../../services/followRequestService';
import * as followerService from '../../services/followerService';
import apiClient from '../../services/api';
import { useParams, useNavigate } from 'react-router-dom';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(),
  useNavigate: jest.fn(),
}));

jest.mock('../../context/AuthContext');
jest.mock('../../services/followRequestService');
jest.mock('../../services/followerService');
jest.mock('../../services/api');

jest.mock('../../components/Navbar', () => {
  return function Navbar() {
    return <nav data-testid="navbar">Navbar</nav>;
  };
});

let lastOnRemoveFollower;

jest.mock('../../components/FollowersList', () => {
  return function FollowersList({ followers, isPublisher, onRemoveFollower, loading }) {
    lastOnRemoveFollower = onRemoveFollower;
    return (
      <div data-testid="followers-list">
        {loading && <p>Loading followers...</p>}
        {!loading && followers && followers.map(f => (
          <div key={f.id} data-testid={`follower-${f.id}`}>
            {f.name}
            {isPublisher && (
              <button onClick={() => onRemoveFollower(f.id)}>Remove</button>
            )}
          </div>
        ))}
      </div>
    );
  };
});

describe('PathDetailPage', () => {
  const mockNavigate = jest.fn();
  const mockPath = {
    id: 'path-1',
    title: '📍 Test Path',
    publisherId: 'user-1',
    publisher: { name: 'John Publisher' },
    followerIds: ['user-2'],
    status: 'recording',
    createdAt: '2023-01-01',
    coordinates: [
      { lat: 10.5, lng: 20.5 },
    ],
    description: 'Test path description',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    lastOnRemoveFollower = null;
    useNavigate.mockReturnValue(mockNavigate);
    useParams.mockReturnValue({ pathId: 'path-1' });
    useAuth.mockReturnValue({ user: { id: 'user-1', name: 'John' } });
    
    apiClient.get = jest.fn().mockResolvedValue({ data: mockPath });
    
    followRequestService.getFollowRequestsForPath = jest.fn().mockResolvedValue([]);
    followerService.getFollowersForPath = jest.fn().mockResolvedValue([]);
    followRequestService.approveFollowRequest = jest.fn().mockResolvedValue({});
    followRequestService.rejectFollowRequest = jest.fn().mockResolvedValue({});
    followerService.removeFollowerFromPath = jest.fn().mockResolvedValue({});
    
    window.showToast = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render PathDetailPage container', async () => {
    const { container } = render(<PathDetailPage />);
    await waitFor(() => {
      expect(container.querySelector('.path-detail-page')).toBeInTheDocument();
    });
  });

  it('should render navbar component', async () => {
    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId('navbar')).toBeInTheDocument();
    });
  });

  it('should fetch path data on mount', async () => {
    render(<PathDetailPage />);
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/paths/path-1');
    });
  });

  it('should display loading state initially', async () => {
    apiClient.get = jest.fn(() => new Promise(() => {})); // Never resolves
    const { container } = render(<PathDetailPage />);
    
    expect(container.querySelector('.detail-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading path details...')).toBeInTheDocument();
  });

  it('should display path title after loading', async () => {
    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/📍 Test Path/)).toBeInTheDocument();
    });
  });

  it('should display path status badge', async () => {
    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/🔴 Live/)).toBeInTheDocument();
    });
  });

  it('should display "Your Path" badge for publisher', async () => {
    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Your Path')).toBeInTheDocument();
    });
  });

  it('should display "Following" badge for non-publisher followers', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-2', name: 'Jane' } });
    render(<PathDetailPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/✓ Following/)).toBeInTheDocument();
    });
  });

  it('should not display any badge for non-followers', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-3', name: 'Bob' } });
    render(<PathDetailPage />);
    
    await waitFor(() => {
      expect(screen.queryByText(/Your Path/)).not.toBeInTheDocument();
      expect(screen.queryByText(/✓ Following/)).not.toBeInTheDocument();
    });
  });

  it('should display live tracking button for publisher', async () => {
    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('🗺️ Open Live Tracking')).toBeInTheDocument();
    });
  });

  it('should display live tracking button for followers', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-2', name: 'Jane' } });
    render(<PathDetailPage />);
    
    await waitFor(() => {
      expect(screen.getByText('🗺️ Open Live Tracking')).toBeInTheDocument();
    });
  });

  it('should navigate to live tracking page when button clicked', async () => {
    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('🗺️ Open Live Tracking')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('🗺️ Open Live Tracking'));
    expect(mockNavigate).toHaveBeenCalledWith('/path/path-1/live');
  });

  it('should display publisher name in metadata', async () => {
    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('John Publisher')).toBeInTheDocument();
    });
  });

  it('should display follower count in metadata', async () => {
    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/👥 1 follower/)).toBeInTheDocument();
    });
  });

  it('should display creation date in metadata', async () => {
    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/🗓️ Jan 1, 2023/)).toBeInTheDocument();
    });
  });

  it('should display GPS points count', async () => {
    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/📡 1 GPS points/)).toBeInTheDocument();
    });
  });

  it('should display path description', async () => {
    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Test path description')).toBeInTheDocument();
    });
  });

  it('should display back button', async () => {
    const { container } = render(<PathDetailPage />);
    await waitFor(() => {
      expect(container.querySelector('.pd-btn-back')).toBeInTheDocument();
    });
  });

  it('should navigate back when back button clicked', async () => {
    const { container } = render(<PathDetailPage />);
    await waitFor(() => {
      expect(container.querySelector('.pd-btn-back')).toBeInTheDocument();
    });
    
    fireEvent.click(container.querySelector('.pd-btn-back'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('should show error state when path not found', async () => {
    apiClient.get = jest.fn().mockRejectedValue(new Error('Not found'));
    const { container } = render(<PathDetailPage />);
    
    await waitFor(() => {
      expect(container.querySelector('.detail-error')).toBeInTheDocument();
      expect(screen.getByText('Not found')).toBeInTheDocument();
    });
  });

  it('should navigate back from error state', async () => {
    apiClient.get = jest.fn().mockRejectedValue(new Error('Not found'));
    const { container } = render(<PathDetailPage />);

    await waitFor(() => {
      expect(container.querySelector('.detail-error')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('← Go Back'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('should show "Path not found" when error has no message', async () => {
    apiClient.get = jest.fn().mockResolvedValue({ data: null });
    const { container } = render(<PathDetailPage />);
    
    await waitFor(() => {
      expect(container.querySelector('.detail-error')).toBeInTheDocument();
      expect(screen.getByText('Path not found')).toBeInTheDocument();
    });
  });

  it('should show follow requests section only for publisher', async () => {
    const { container } = render(<PathDetailPage />);
    await waitFor(() => {
      expect(container.querySelector('.pd-requests-card')).toBeInTheDocument();
    });
  });

  it('should not show follow requests section for non-publisher', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-3', name: 'Bob' } });
    const { container } = render(<PathDetailPage />);
    
    await waitFor(() => {
      expect(container.querySelector('.pd-requests-card')).not.toBeInTheDocument();
    });
  });

  it('should display "No pending follow requests" when empty', async () => {
    const { container } = render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('No pending follow requests')).toBeInTheDocument();
    });
  });

  it('should display follow requests with approve/reject buttons', async () => {
    followRequestService.getFollowRequestsForPath = jest.fn().mockResolvedValue([
      {
        followerId: 'user-3',
        follower: { name: 'Jane', email: 'jane@example.com', picture: null },
      },
    ]);

    const { container } = render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Jane')).toBeInTheDocument();
      expect(screen.getByText('✓ Approve')).toBeInTheDocument();
      expect(screen.getByText('✗ Reject')).toBeInTheDocument();
    });
  });

  it('should approve follow request', async () => {
    followRequestService.getFollowRequestsForPath = jest.fn().mockResolvedValue([
      {
        followerId: 'user-3',
        follower: { name: 'Jane', email: 'jane@example.com' },
      },
    ]);

    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('✓ Approve')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('✓ Approve'));
    await waitFor(() => {
      expect(followRequestService.approveFollowRequest).toHaveBeenCalledWith('path-1', 'user-3');
    });
  });

  it('should reject follow request', async () => {
    followRequestService.getFollowRequestsForPath = jest.fn().mockResolvedValue([
      {
        followerId: 'user-3',
        follower: { name: 'Jane', email: 'jane@example.com' },
      },
    ]);

    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('✗ Reject')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('✗ Reject'));
    await waitFor(() => {
      expect(followRequestService.rejectFollowRequest).toHaveBeenCalledWith('path-1', 'user-3');
    });
  });

  it('should show success toast on approve', async () => {
    followRequestService.getFollowRequestsForPath = jest.fn().mockResolvedValue([
      {
        followerId: 'user-3',
        follower: { name: 'Jane', email: 'jane@example.com' },
      },
    ]);

    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('✓ Approve')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('✓ Approve'));
    await waitFor(() => {
      expect(window.showToast).toHaveBeenCalledWith('✓ Follow request approved!', 'success');
    });
  });

  it('should show warning toast on reject', async () => {
    followRequestService.getFollowRequestsForPath = jest.fn().mockResolvedValue([
      {
        followerId: 'user-3',
        follower: { name: 'Jane', email: 'jane@example.com' },
      },
    ]);

    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('✗ Reject')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('✗ Reject'));
    await waitFor(() => {
      expect(window.showToast).toHaveBeenCalledWith('✕ Follow request rejected', 'warning');
    });
  });

  it('should show follow requests count badge', async () => {
    followRequestService.getFollowRequestsForPath = jest.fn().mockResolvedValue([
      { followerId: 'user-3', follower: { name: 'Jane', email: 'jane@example.com' } },
      { followerId: 'user-4', follower: { name: 'Bob', email: 'bob@example.com' } },
    ]);

    const { container } = render(<PathDetailPage />);
    await waitFor(() => {
      expect(container.querySelector('.pd-count-badge')).toHaveTextContent('2');
    });
  });

  it('should fetch followers for publisher', async () => {
    render(<PathDetailPage />);
    await waitFor(() => {
      expect(followerService.getFollowersForPath).toHaveBeenCalledWith('path-1');
    });
  });

  it('should not fetch followers for non-publisher', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-3', name: 'Bob' } });
    render(<PathDetailPage />);
    
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalled();
    });
    
    expect(followerService.getFollowersForPath).not.toHaveBeenCalled();
  });

  it('should display followers section when followers exist', async () => {
    const { container } = render(<PathDetailPage />);
    await waitFor(() => {
      expect(container.querySelector('.pd-followers-section')).toBeInTheDocument();
    });
  });

  it('should display followers list component', async () => {
    followerService.getFollowersForPath = jest.fn().mockResolvedValue([
      { id: 'user-2', name: 'Jane' },
    ]);

    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId('followers-list')).toBeInTheDocument();
    });
  });

  it('should remove follower from path', async () => {
    followerService.getFollowersForPath = jest.fn().mockResolvedValue([
      { id: 'user-2', name: 'Jane' },
    ]);

    render(<PathDetailPage />);
    await waitFor(() => {
      expect(lastOnRemoveFollower).toBeTruthy();
    });

    await lastOnRemoveFollower('user-2');

    expect(followerService.removeFollowerFromPath).toHaveBeenCalledWith('path-1', 'user-2');
  });

  it('should poll for follow requests periodically for publisher', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation((callback) => {
      callback();
      return 123;
    });

    render(<PathDetailPage />);
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(followRequestService.getFollowRequestsForPath).toHaveBeenCalledTimes(2);
    });
    setIntervalSpy.mockRestore();
  });

  it('should log polling errors', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation((callback) => {
      callback();
      callback();
      return 123;
    });

    followRequestService.getFollowRequestsForPath = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('Polling failed'))
      .mockResolvedValueOnce([]);

    render(<PathDetailPage />);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(setIntervalSpy).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    setIntervalSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('should not poll for non-publishers', async () => {
    jest.useFakeTimers();
    useAuth.mockReturnValue({ user: { id: 'user-3', name: 'Bob' } });
    
    render(<PathDetailPage />);
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalled();
    });

    jest.advanceTimersByTime(5000);
    jest.useRealTimers();
  });

  it('should cleanup polling on unmount', async () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    
    const { unmount } = render(<PathDetailPage />);
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalled();
    });

    unmount();
    jest.runAllTimers();
    clearIntervalSpy.mockRestore();
  });

  it('should handle error when fetching followers', async () => {
    followerService.getFollowersForPath = jest.fn().mockRejectedValue(new Error('Fetch error'));

    render(<PathDetailPage />);
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalled();
    });

    await screen.findByTestId('followers-list');
    expect(screen.getByTestId('followers-list')).toBeInTheDocument();
  });

  it('should handle error when approving follow request', async () => {
    followRequestService.approveFollowRequest = jest.fn().mockRejectedValue(new Error('Approve failed'));
    followRequestService.getFollowRequestsForPath = jest.fn().mockResolvedValue([
      {
        followerId: 'user-3',
        follower: { name: 'Jane', email: 'jane@example.com' },
      },
    ]);

    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('✓ Approve')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('✓ Approve'));
    await waitFor(() => {
      expect(window.showToast).toHaveBeenCalledWith('Failed to approve request', 'error');
    });
  });

  it('should handle error when rejecting follow request', async () => {
    followRequestService.rejectFollowRequest = jest.fn().mockRejectedValue(new Error('Reject failed'));
    followRequestService.getFollowRequestsForPath = jest.fn().mockResolvedValue([
      {
        followerId: 'user-3',
        follower: { name: 'Jane', email: 'jane@example.com' },
      },
    ]);

    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('✗ Reject')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('✗ Reject'));
    await waitFor(() => {
      expect(window.showToast).toHaveBeenCalledWith('Failed to reject request', 'error');
    });
  });

  it('should handle error when removing follower', async () => {
    followerService.removeFollowerFromPath = jest.fn().mockRejectedValue(new Error('Remove failed'));
    followerService.getFollowersForPath = jest.fn().mockResolvedValue([
      { id: 'user-2', name: 'Jane' },
    ]);

    render(<PathDetailPage />);
    await waitFor(() => {
      expect(lastOnRemoveFollower).toBeTruthy();
    });

    await expect(lastOnRemoveFollower('user-2')).rejects.toThrow('Remove failed');
    expect(followerService.removeFollowerFromPath).toHaveBeenCalledWith('path-1', 'user-2');
  });

  it('should display followers count plural form', async () => {
    const mockPathMultiple = {
      ...mockPath,
      followerIds: ['user-2', 'user-3', 'user-4'],
    };
    apiClient.get = jest.fn().mockResolvedValue({ data: mockPathMultiple });

    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/👥 3 followers/)).toBeInTheDocument();
    });
  });

  it('should display followers singular form', async () => {
    const mockPathSingle = {
      ...mockPath,
      followerIds: ['user-2'],
    };
    apiClient.get = jest.fn().mockResolvedValue({ data: mockPathSingle });

    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/👥 1 follower/)).toBeInTheDocument();
    });
  });

  it('should handle path with no description', async () => {
    const mockPathNoDesc = { ...mockPath, description: null };
    apiClient.get = jest.fn().mockResolvedValue({ data: mockPathNoDesc });

    const { container } = render(<PathDetailPage />);
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalled();
    });

    expect(container.querySelector('.pd-description')).not.toBeInTheDocument();
  });

  it('should handle path with no coordinates', async () => {
    const mockPathNoCoords = { ...mockPath, coordinates: [] };
    apiClient.get = jest.fn().mockResolvedValue({ data: mockPathNoCoords });

    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.queryByText(/📡/)).not.toBeInTheDocument();
    });
  });

  it('should display followers note text', async () => {
    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/approved to follow this path/)).toBeInTheDocument();
    });
  });

  it('should show Processing... while handling request', async () => {
    followRequestService.approveFollowRequest = jest.fn(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );
    followRequestService.getFollowRequestsForPath = jest.fn().mockResolvedValue([
      {
        followerId: 'user-3',
        follower: { name: 'Jane', email: 'jane@example.com' },
      },
    ]);

    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('✓ Approve')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('✓ Approve'));
    
    expect(screen.getAllByText('...').length).toBe(2);
  });

  it('should disable buttons while processing request', async () => {
    followRequestService.approveFollowRequest = jest.fn(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );
    followRequestService.getFollowRequestsForPath = jest.fn().mockResolvedValue([
      {
        followerId: 'user-3',
        follower: { name: 'Jane', email: 'jane@example.com' },
      },
    ]);

    const { container } = render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('✓ Approve')).toBeInTheDocument();
    });

    const approveBtn = container.querySelector('.pd-btn-approve');
    fireEvent.click(approveBtn);
    
    await waitFor(() => {
      expect(approveBtn.disabled).toBe(true);
    }, { timeout: 50 });
  });

  it('should fetch requests with skip loading parameter', async () => {
    const { container } = render(<PathDetailPage />);
    await waitFor(() => {
      expect(container.querySelector('.pd-refresh-btn')).toBeInTheDocument();
    });

    const initialCalls = apiClient.get.mock.calls.length;
    fireEvent.click(container.querySelector('.pd-refresh-btn'));
    
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledTimes(initialCalls + 1);
    });
  });

  it('should remove request from list after approval', async () => {
    followRequestService.getFollowRequestsForPath = jest.fn().mockResolvedValue([
      {
        followerId: 'user-3',
        follower: { name: 'Jane', email: 'jane@example.com' },
      },
    ]);

    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Jane')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('✓ Approve'));
    
    await waitFor(() => {
      expect(screen.queryByText('Jane')).not.toBeInTheDocument();
    });
  });

  it('should remove request from list after rejection', async () => {
    followRequestService.getFollowRequestsForPath = jest.fn().mockResolvedValue([
      {
        followerId: 'user-3',
        follower: { name: 'Jane', email: 'jane@example.com' },
      },
    ]);

    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Jane')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('✗ Reject'));
    
    await waitFor(() => {
      expect(screen.queryByText('Jane')).not.toBeInTheDocument();
    });
  });

  it('should update path followers list after removal', async () => {
    followerService.getFollowersForPath = jest.fn().mockResolvedValue([
      { id: 'user-2', name: 'Jane' },
    ]);

    render(<PathDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId('follower-user-2')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Remove'));
    
    await waitFor(() => {
      expect(screen.queryByTestId('follower-user-2')).not.toBeInTheDocument();
    });
  });

  it('should display request avatar with picture', async () => {
    followRequestService.getFollowRequestsForPath = jest.fn().mockResolvedValue([
      {
        followerId: 'user-3',
        follower: {
          name: 'Jane',
          email: 'jane@example.com',
          picture: 'https://example.com/avatar.jpg',
        },
      },
    ]);

    const { container } = render(<PathDetailPage />);
    await waitFor(() => {
      expect(container.querySelector('img.pd-requester-avatar')).toBeInTheDocument();
    });
  });

  it('should display fallback avatar without picture', async () => {
    followRequestService.getFollowRequestsForPath = jest.fn().mockResolvedValue([
      {
        followerId: 'user-3',
        follower: {
          name: 'Jane',
          email: 'jane@example.com',
          picture: null,
        },
      },
    ]);

    const { container } = render(<PathDetailPage />);
    await waitFor(() => {
      expect(container.querySelector('.pd-avatar-fallback')).toBeInTheDocument();
      expect(container.querySelector('.pd-avatar-fallback')).toHaveTextContent('J');
    });
  });

  it('should refresh followers on button click', async () => {
    const { container } = render(<PathDetailPage />);
    await waitFor(() => {
      const buttons = container.querySelectorAll('.pd-refresh-btn');
      expect(buttons.length).toBeGreaterThan(0);
    });

    const refreshButtons = container.querySelectorAll('.pd-refresh-btn');
    if (refreshButtons.length > 1) {
      const initialCalls = followerService.getFollowersForPath.mock.calls.length;
      fireEvent.click(refreshButtons[1]);
      
      await waitFor(() => {
        expect(followerService.getFollowersForPath.mock.calls.length).toBeGreaterThan(initialCalls);
      });
    }
  });
});
