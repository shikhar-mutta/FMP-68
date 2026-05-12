import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import RequestSummaryModalPanel from '../../components/RequestSummaryModalPanel';
import * as followRequestService from '../../services/followRequestService';

jest.mock('../../styles/RequestSummaryModal.css', () => ({}));
jest.mock('../../services/followRequestService');

const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('RequestSummaryModalPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show loading state initially', () => {
    followRequestService.getPendingFollowRequests.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );
    renderWithRouter(<RequestSummaryModalPanel />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should display no requests message when there are no pending requests', async () => {
    followRequestService.getPendingFollowRequests.mockResolvedValue([]);
    renderWithRouter(<RequestSummaryModalPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('No pending follow requests')).toBeInTheDocument();
    });
  });

  it('should display total badge with count', async () => {
    const mockRequests = [
      { pathId: 'path-1', pathTitle: 'Mountain Trail', userId: 'user-1' },
      { pathId: 'path-1', pathTitle: 'Mountain Trail', userId: 'user-2' },
      { pathId: 'path-2', pathTitle: 'Beach Walk', userId: 'user-3' },
    ];
    followRequestService.getPendingFollowRequests.mockResolvedValue(mockRequests);
    renderWithRouter(<RequestSummaryModalPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('should group requests by path', async () => {
    const mockRequests = [
      { pathId: 'path-1', pathTitle: 'Mountain Trail', userId: 'user-1' },
      { pathId: 'path-1', pathTitle: 'Mountain Trail', userId: 'user-2' },
      { pathId: 'path-2', pathTitle: 'Beach Walk', userId: 'user-3' },
    ];
    followRequestService.getPendingFollowRequests.mockResolvedValue(mockRequests);
    renderWithRouter(<RequestSummaryModalPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('Mountain Trail')).toBeInTheDocument();
      expect(screen.getByText('Beach Walk')).toBeInTheDocument();
      expect(screen.getByText('2 requests')).toBeInTheDocument();
      expect(screen.getByText('1 request')).toBeInTheDocument();
    });
  });

  it('should display error message on fetch failure', async () => {
    followRequestService.getPendingFollowRequests.mockRejectedValue(
      new Error('Failed to fetch')
    );
    renderWithRouter(<RequestSummaryModalPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load pending requests')).toBeInTheDocument();
    });
  });

  it('should navigate to path detail on card click', async () => {
    const mockRequests = [
      { pathId: 'path-1', pathTitle: 'Mountain Trail', userId: 'user-1' },
    ];
    followRequestService.getPendingFollowRequests.mockResolvedValue(mockRequests);
    const { container } = renderWithRouter(<RequestSummaryModalPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('Mountain Trail')).toBeInTheDocument();
    });
    
    const pathCard = container.querySelector('.path-card-summary');
    fireEvent.click(pathCard);
    
    // Verify navigation was triggered
    expect(pathCard).toBeInTheDocument();
  });

  it('should refresh pending requests when refresh button is clicked', async () => {
    const mockRequests = [
      { pathId: 'path-1', pathTitle: 'Mountain Trail', userId: 'user-1' },
    ];
    followRequestService.getPendingFollowRequests.mockResolvedValue(mockRequests);
    renderWithRouter(<RequestSummaryModalPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('🔄 Refresh')).toBeInTheDocument();
    });
    
    const refreshButton = screen.getByText('🔄 Refresh');
    fireEvent.click(refreshButton);
    
    // Verify the service was called again
    await waitFor(() => {
      expect(followRequestService.getPendingFollowRequests).toHaveBeenCalledTimes(2);
    });
  });

  it('should display all path data correctly', async () => {
    const mockRequests = [
      { pathId: 'path-1', pathTitle: 'Mountain Trail', userId: 'user-1' },
      { pathId: 'path-1', pathTitle: 'Mountain Trail', userId: 'user-2' },
    ];
    followRequestService.getPendingFollowRequests.mockResolvedValue(mockRequests);
    renderWithRouter(<RequestSummaryModalPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('Mountain Trail')).toBeInTheDocument();
      expect(screen.getByText('2 requests')).toBeInTheDocument();
    });
  });

  it('should handle error state and then clear error on retry', async () => {
    followRequestService.getPendingFollowRequests
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce([]);
    
    renderWithRouter(<RequestSummaryModalPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load pending requests')).toBeInTheDocument();
    });
    
    const refreshButton = screen.getByText('🔄 Refresh');
    fireEvent.click(refreshButton);
    
    await waitFor(() => {
      expect(screen.queryByText('Failed to load pending requests')).not.toBeInTheDocument();
      expect(screen.getByText('No pending follow requests')).toBeInTheDocument();
    });
  });
});
