import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SentRequestsPanel from '../../components/SentRequestsPanel';
import * as followRequestService from '../../services/followRequestService';
import { REQUEST_STATUSES } from '../../config/constants';

jest.mock('../../styles/FollowRequests.css', () => ({}));
jest.mock('../../services/followRequestService');

describe('SentRequestsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete window.showToast;
  });

  it('should show loading state initially', () => {
    followRequestService.getSentFollowRequests.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );
    render(<SentRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    expect(screen.getByText(/Loading your requests/i)).toBeInTheDocument();
  });

  it('should display no sent follow requests message when empty', async () => {
    followRequestService.getSentFollowRequests.mockResolvedValue([]);
    render(<SentRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText('No sent follow requests')).toBeInTheDocument();
    });
  });

  it('should display sent requests with correct data', async () => {
    const mockRequests = [
      {
        pathId: 'path-1',
        pathTitle: 'Mountain Trail',
        status: REQUEST_STATUSES.PENDING,
        publisher: { name: 'John Doe' },
      },
      {
        pathId: 'path-2',
        pathTitle: 'Beach Walk',
        status: REQUEST_STATUSES.APPROVED,
        publisher: { name: 'Jane Smith' },
      },
    ];
    followRequestService.getSentFollowRequests.mockResolvedValue(mockRequests);
    render(<SentRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText('Mountain Trail')).toBeInTheDocument();
      expect(screen.getByText('Beach Walk')).toBeInTheDocument();
      expect(screen.getByText('by John Doe')).toBeInTheDocument();
      expect(screen.getByText('by Jane Smith')).toBeInTheDocument();
    });
  });

  it('should display correct status badges', async () => {
    const mockRequests = [
      {
        pathId: 'path-1',
        pathTitle: 'Trail 1',
        status: REQUEST_STATUSES.PENDING,
        publisher: { name: 'Publisher 1' },
      },
      {
        pathId: 'path-2',
        pathTitle: 'Trail 2',
        status: REQUEST_STATUSES.APPROVED,
        publisher: { name: 'Publisher 2' },
      },
    ];
    followRequestService.getSentFollowRequests.mockResolvedValue(mockRequests);
    render(<SentRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText('⏳ Pending')).toBeInTheDocument();
      expect(screen.getByText('✓ Approved')).toBeInTheDocument();
    });
  });

  it('should show cancel button only for pending requests', async () => {
    const mockRequests = [
      {
        pathId: 'path-1',
        pathTitle: 'Trail 1',
        status: REQUEST_STATUSES.PENDING,
        publisher: { name: 'Publisher 1' },
      },
      {
        pathId: 'path-2',
        pathTitle: 'Trail 2',
        status: REQUEST_STATUSES.APPROVED,
        publisher: { name: 'Publisher 2' },
      },
    ];
    followRequestService.getSentFollowRequests.mockResolvedValue(mockRequests);
    render(<SentRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      const cancelButtons = screen.getAllByText('Cancel');
      expect(cancelButtons).toHaveLength(1);
    });
  });

  it('should cancel follow request and show success', async () => {
    window.showToast = jest.fn();
    const mockRequests = [
      {
        pathId: 'path-1',
        pathTitle: 'Trail 1',
        status: REQUEST_STATUSES.PENDING,
        publisher: { name: 'Publisher 1' },
      },
    ];
    followRequestService.getSentFollowRequests.mockResolvedValue(mockRequests);
    followRequestService.cancelFollowRequest.mockResolvedValue({});
    
    render(<SentRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    await waitFor(() => {
      expect(followRequestService.cancelFollowRequest).toHaveBeenCalledWith('path-1');
      expect(window.showToast).toHaveBeenCalledWith('Request cancelled', 'success');
    });
  });

  it('should handle cancel error gracefully', async () => {
    window.showToast = jest.fn();
    const mockRequests = [
      {
        pathId: 'path-1',
        pathTitle: 'Trail 1',
        status: REQUEST_STATUSES.PENDING,
        publisher: { name: 'Publisher 1' },
      },
    ];
    followRequestService.getSentFollowRequests.mockResolvedValue(mockRequests);
    followRequestService.cancelFollowRequest.mockRejectedValue(new Error('Cancel failed'));
    
    render(<SentRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    await waitFor(() => {
      expect(window.showToast).toHaveBeenCalledWith('Failed to cancel request', 'error');
      expect(screen.getByText(/Error: Cancel failed/)).toBeInTheDocument();
    });
  });

  it('should display error message on fetch failure', async () => {
    followRequestService.getSentFollowRequests.mockRejectedValue(
      new Error('Failed to fetch')
    );
    render(<SentRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Error: Failed to fetch/)).toBeInTheDocument();
    });
  });

  it('should display correct request count in header', async () => {
    const mockRequests = [
      {
        pathId: 'path-1',
        pathTitle: 'Trail 1',
        status: REQUEST_STATUSES.PENDING,
        publisher: { name: 'Publisher 1' },
      },
      {
        pathId: 'path-2',
        pathTitle: 'Trail 2',
        status: REQUEST_STATUSES.APPROVED,
        publisher: { name: 'Publisher 2' },
      },
    ];
    followRequestService.getSentFollowRequests.mockResolvedValue(mockRequests);
    render(<SentRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText('📤 Your Follow Requests (2)')).toBeInTheDocument();
    });
  });

  it('should disable cancel button while processing', async () => {
    window.showToast = jest.fn();
    const mockRequests = [
      {
        pathId: 'path-1',
        pathTitle: 'Trail 1',
        status: REQUEST_STATUSES.PENDING,
        publisher: { name: 'Publisher 1' },
      },
    ];
    followRequestService.getSentFollowRequests.mockResolvedValue(mockRequests);
    followRequestService.cancelFollowRequest.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );
    
    render(<SentRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    await waitFor(() => {
      expect(cancelButton).toBeDisabled();
    });
  });

  it('should setup polling interval on mount', async () => {
    jest.useFakeTimers();
    const mockRequests = [];
    followRequestService.getSentFollowRequests.mockResolvedValue(mockRequests);
    
    render(<SentRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(followRequestService.getSentFollowRequests).toHaveBeenCalledTimes(1);
    });
    
    jest.advanceTimersByTime(2000);
    
    await waitFor(() => {
      expect(followRequestService.getSentFollowRequests).toHaveBeenCalledTimes(2);
    });
    
    jest.useRealTimers();
  });

  it('should handle cancel successfully without showToast', async () => {
    // Don't set window.showToast
    const mockRequests = [
      {
        pathId: 'path-1',
        pathTitle: 'Trail 1',
        status: REQUEST_STATUSES.PENDING,
        publisher: { name: 'Publisher 1' },
      },
    ];
    followRequestService.getSentFollowRequests.mockResolvedValue(mockRequests);
    followRequestService.cancelFollowRequest.mockResolvedValue({});
    
    render(<SentRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    await waitFor(() => {
      expect(followRequestService.cancelFollowRequest).toHaveBeenCalledWith('path-1');
    });
  });

  it('should handle cancel error without showToast', async () => {
    // Don't set window.showToast
    const mockRequests = [
      {
        pathId: 'path-1',
        pathTitle: 'Trail 1',
        status: REQUEST_STATUSES.PENDING,
        publisher: { name: 'Publisher 1' },
      },
    ];
    followRequestService.getSentFollowRequests.mockResolvedValue(mockRequests);
    followRequestService.cancelFollowRequest.mockRejectedValue(new Error('Cancel failed'));
    
    render(<SentRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Error: Cancel failed/)).toBeInTheDocument();
    });
  });

  it('should display pending badge when status is undefined', async () => {
    const mockRequests = [
      {
        pathId: 'path-1',
        pathTitle: 'Trail 1',
        status: undefined,
        publisher: { name: 'Publisher 1' },
      },
    ];
    followRequestService.getSentFollowRequests.mockResolvedValue(mockRequests);
    render(<SentRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText('⏳ Pending')).toBeInTheDocument();
    });
  });

  it('should handle polling errors gracefully', async () => {
    jest.useFakeTimers();
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const mockRequests = [];
    
    followRequestService.getSentFollowRequests
      .mockResolvedValueOnce(mockRequests)
      .mockRejectedValueOnce(new Error('Polling failed'));
    
    render(<SentRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(followRequestService.getSentFollowRequests).toHaveBeenCalledTimes(1);
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
    followRequestService.getSentFollowRequests.mockResolvedValue(mockRequests);
    
    const { unmount } = render(<SentRequestsPanel currentUserId="user-1" onRefresh={jest.fn()} />);
    
    await waitFor(() => {
      expect(followRequestService.getSentFollowRequests).toHaveBeenCalled();
    });
    
    const initialCallCount = followRequestService.getSentFollowRequests.mock.calls.length;
    
    unmount();
    
    // Verify cleanup happened (no more calls after unmount)
    expect(followRequestService.getSentFollowRequests).toHaveBeenCalledTimes(initialCallCount);
  });
});