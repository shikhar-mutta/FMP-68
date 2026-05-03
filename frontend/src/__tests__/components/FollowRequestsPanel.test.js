import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FollowRequestsPanel from '../../components/FollowRequestsPanel';
import * as followRequestService from '../../services/followRequestService';

jest.mock('../../styles/FollowRequests.css', () => ({}));
jest.mock('../../services/followRequestService');

describe('FollowRequestsPanel', () => {
  let consoleSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    delete window.showToast;
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should show loading state initially', async () => {
    followRequestService.getPendingFollowRequests.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );
    render(<FollowRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    expect(screen.getByText(/Loading follow requests/i)).toBeInTheDocument();
  });

  it('should display no pending follow requests message when empty', async () => {
    followRequestService.getPendingFollowRequests.mockResolvedValue([]);
    render(<FollowRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText('No pending follow requests')).toBeInTheDocument();
    });
  });

  it('should display pending follow requests', async () => {
    const mockRequests = [
      {
        pathId: 'path-1',
        followerId: 'user-2',
        pathTitle: 'Mountain Trail',
        follower: {
          name: 'John Doe',
          email: 'john@example.com',
          picture: 'https://example.com/john.jpg',
        },
      },
    ];
    followRequestService.getPendingFollowRequests.mockResolvedValue(mockRequests);
    render(<FollowRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('Mountain Trail')).toBeInTheDocument();
    });
  });

  it('should display correct request count in header', async () => {
    const mockRequests = [
      {
        pathId: 'path-1',
        followerId: 'user-2',
        pathTitle: 'Trail 1',
        follower: { name: 'User 2', email: 'user2@example.com' },
      },
      {
        pathId: 'path-2',
        followerId: 'user-3',
        pathTitle: 'Trail 2',
        follower: { name: 'User 3', email: 'user3@example.com' },
      },
    ];
    followRequestService.getPendingFollowRequests.mockResolvedValue(mockRequests);
    render(<FollowRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText('📬 Follow Requests (2)')).toBeInTheDocument();
    });
  });

  it('should display requester avatar when available', async () => {
    const mockRequests = [
      {
        pathId: 'path-1',
        followerId: 'user-2',
        pathTitle: 'Trail 1',
        follower: {
          name: 'John Doe',
          email: 'john@example.com',
          picture: 'https://example.com/john.jpg',
        },
      },
    ];
    followRequestService.getPendingFollowRequests.mockResolvedValue(mockRequests);
    render(<FollowRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      const avatar = screen.getByAltText('John Doe');
      expect(avatar).toBeInTheDocument();
      expect(avatar.src).toBe('https://example.com/john.jpg');
    });
  });

  it('should approve follow request', async () => {
    window.showToast = jest.fn();
    const mockRequests = [
      {
        pathId: 'path-1',
        followerId: 'user-2',
        pathTitle: 'Trail 1',
        follower: { name: 'User 2', email: 'user2@example.com' },
      },
    ];
    followRequestService.getPendingFollowRequests.mockResolvedValue(mockRequests);
    followRequestService.approveFollowRequest.mockResolvedValue({});
    
    render(<FollowRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText('✓ Approve')).toBeInTheDocument();
    });
    
    const approveButton = screen.getByText('✓ Approve');
    fireEvent.click(approveButton);
    
    await waitFor(() => {
      expect(followRequestService.approveFollowRequest).toHaveBeenCalledWith('path-1', 'user-2');
      expect(window.showToast).toHaveBeenCalledWith('✓ Follow request approved!', 'success');
    });
  });

  it('should reject follow request', async () => {
    window.showToast = jest.fn();
    const mockRequests = [
      {
        pathId: 'path-1',
        followerId: 'user-2',
        pathTitle: 'Trail 1',
        follower: { name: 'User 2', email: 'user2@example.com' },
      },
    ];
    followRequestService.getPendingFollowRequests.mockResolvedValue(mockRequests);
    followRequestService.rejectFollowRequest.mockResolvedValue({});
    
    render(<FollowRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText('✕ Reject')).toBeInTheDocument();
    });
    
    const rejectButton = screen.getByText('✕ Reject');
    fireEvent.click(rejectButton);
    
    await waitFor(() => {
      expect(followRequestService.rejectFollowRequest).toHaveBeenCalledWith('path-1', 'user-2');
      expect(window.showToast).toHaveBeenCalledWith('✕ Follow request rejected', 'warning');
    });
  });

  it('should handle approve error', async () => {
    window.showToast = jest.fn();
    const mockRequests = [
      {
        pathId: 'path-1',
        followerId: 'user-2',
        pathTitle: 'Trail 1',
        follower: { name: 'User 2', email: 'user2@example.com' },
      },
    ];
    followRequestService.getPendingFollowRequests.mockResolvedValue(mockRequests);
    followRequestService.approveFollowRequest.mockRejectedValue(new Error('Approval failed'));
    
    render(<FollowRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText('✓ Approve')).toBeInTheDocument();
    });
    
    const approveButton = screen.getByText('✓ Approve');
    fireEvent.click(approveButton);
    
    await waitFor(() => {
      expect(window.showToast).toHaveBeenCalledWith('Failed to approve request', 'error');
      expect(screen.getByText(/Error: Approval failed/)).toBeInTheDocument();
    });
  });

  it('should handle reject error', async () => {
    window.showToast = jest.fn();
    const mockRequests = [
      {
        pathId: 'path-1',
        followerId: 'user-2',
        pathTitle: 'Trail 1',
        follower: { name: 'User 2', email: 'user2@example.com' },
      },
    ];
    followRequestService.getPendingFollowRequests.mockResolvedValue(mockRequests);
    followRequestService.rejectFollowRequest.mockRejectedValue(new Error('Reject failed'));
    
    render(<FollowRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText('✕ Reject')).toBeInTheDocument();
    });
    
    const rejectButton = screen.getByText('✕ Reject');
    fireEvent.click(rejectButton);
    
    await waitFor(() => {
      expect(window.showToast).toHaveBeenCalledWith('Failed to reject request', 'error');
      expect(screen.getByText(/Error: Reject failed/)).toBeInTheDocument();
    });
  });

  it('should display error message on fetch failure', async () => {
    followRequestService.getPendingFollowRequests.mockRejectedValue(
      new Error('Failed to fetch')
    );
    render(<FollowRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Error: Failed to fetch/)).toBeInTheDocument();
    });
  });

  it('should disable buttons while processing', async () => {
    window.showToast = jest.fn();
    const mockRequests = [
      {
        pathId: 'path-1',
        followerId: 'user-2',
        pathTitle: 'Trail 1',
        follower: { name: 'User 2', email: 'user2@example.com' },
      },
    ];
    followRequestService.getPendingFollowRequests.mockResolvedValue(mockRequests);
    followRequestService.approveFollowRequest.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );
    
    render(<FollowRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText('✓ Approve')).toBeInTheDocument();
    });
    
    const approveButton = screen.getByText('✓ Approve');
    fireEvent.click(approveButton);
    
    await waitFor(() => {
      expect(approveButton).toBeDisabled();
    });
  });

  it('should setup polling interval on mount', async () => {
    jest.useFakeTimers();
    const mockRequests = [];
    followRequestService.getPendingFollowRequests.mockResolvedValue(mockRequests);
    
    render(<FollowRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(followRequestService.getPendingFollowRequests).toHaveBeenCalledTimes(1);
    });
    
    jest.advanceTimersByTime(2000);
    
    await waitFor(() => {
      expect(followRequestService.getPendingFollowRequests).toHaveBeenCalledTimes(2);
    });
    
    jest.useRealTimers();
  });

  it('should handle polling errors gracefully', async () => {
    jest.useFakeTimers();
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const mockRequests = [];
    
    followRequestService.getPendingFollowRequests
      .mockResolvedValueOnce(mockRequests)
      .mockRejectedValueOnce(new Error('Polling failed'));
    
    render(<FollowRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(followRequestService.getPendingFollowRequests).toHaveBeenCalledTimes(1);
    });
    
    jest.advanceTimersByTime(2000);
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Polling error:', expect.any(Error));
    });
    
    consoleSpy.mockRestore();
    jest.useRealTimers();
  });

  it('should clear polling interval on unmount', async () => {
    const mockRequests = [];
    followRequestService.getPendingFollowRequests.mockResolvedValue(mockRequests);
    
    const { unmount } = render(<FollowRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(followRequestService.getPendingFollowRequests).toHaveBeenCalled();
    });
    
    const initialCallCount = followRequestService.getPendingFollowRequests.mock.calls.length;
    
    unmount();
    
    expect(followRequestService.getPendingFollowRequests).toHaveBeenCalledTimes(initialCallCount);
  });

  it('should approve without showToast', async () => {
    // Don't set window.showToast
    const mockRequests = [
      {
        pathId: 'path-1',
        followerId: 'user-2',
        pathTitle: 'Trail 1',
        follower: { name: 'User 2', email: 'user2@example.com' },
      },
    ];
    followRequestService.getPendingFollowRequests.mockResolvedValue(mockRequests);
    followRequestService.approveFollowRequest.mockResolvedValue({});
    
    render(<FollowRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText('✓ Approve')).toBeInTheDocument();
    });
    
    const approveButton = screen.getByText('✓ Approve');
    fireEvent.click(approveButton);
    
    await waitFor(() => {
      expect(followRequestService.approveFollowRequest).toHaveBeenCalledWith('path-1', 'user-2');
    });
  });

  it('should reject without showToast', async () => {
    // Don't set window.showToast
    const mockRequests = [
      {
        pathId: 'path-1',
        followerId: 'user-2',
        pathTitle: 'Trail 1',
        follower: { name: 'User 2', email: 'user2@example.com' },
      },
    ];
    followRequestService.getPendingFollowRequests.mockResolvedValue(mockRequests);
    followRequestService.rejectFollowRequest.mockResolvedValue({});
    
    render(<FollowRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText('✕ Reject')).toBeInTheDocument();
    });
    
    const rejectButton = screen.getByText('✕ Reject');
    fireEvent.click(rejectButton);
    
    await waitFor(() => {
      expect(followRequestService.rejectFollowRequest).toHaveBeenCalledWith('path-1', 'user-2');
    });
  });

  it('should handle request without follower picture', async () => {
    const mockRequests = [
      {
        pathId: 'path-1',
        followerId: 'user-2',
        pathTitle: 'Trail 1',
        follower: {
          name: 'User 2',
          email: 'user2@example.com',
          picture: null,
        },
      },
    ];
    followRequestService.getPendingFollowRequests.mockResolvedValue(mockRequests);
    render(<FollowRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText('User 2')).toBeInTheDocument();
    });
  });
});
