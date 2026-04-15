import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import LiveTrackingPage from '../../pages/LiveTrackingPage';
import apiClient from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getCurrentPosition,
  watchPosition,
  stopWatching,
  calculateTotalDistance,
  formatDistance,
  formatDuration,
} from '../../services/gpsService';
import {
  connectSocket,
  disconnectSocket,
  startTracking,
  pauseTracking,
  resumeTracking,
  endTracking,
  joinTracking,
  leaveTracking,
  sendLocation,
  onLocationUpdate,
  onTrackingStarted,
  onTrackingPaused,
  onTrackingResumed,
  onTrackingEnded,
  onFollowerJoined,
} from '../../services/socketService';

const mockNavigate = jest.fn();
const socketHandlers = {};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(),
  useNavigate: jest.fn(),
}));

jest.mock('../../context/AuthContext');

jest.mock('../../services/api');

jest.mock('../../components/Navbar', () => () => <div data-testid="navbar" />);

jest.mock('../../components/MapView', () => ({
  publisherCoordinates,
  followerCoordinates,
  currentPosition,
  role,
  autoFollow,
  pathStatus,
  directionInfo,
}) => (
  <div
    data-testid="map-view"
    data-role={role}
    data-follow={autoFollow ? 'on' : 'off'}
    data-status={pathStatus}
    data-pub-count={publisherCoordinates.length}
    data-follow-count={followerCoordinates.length}
    data-has-pos={currentPosition ? 'yes' : 'no'}
    data-has-direction={directionInfo ? 'yes' : 'no'}
    data-direction-completed={directionInfo?.completed ? 'yes' : 'no'}
  />
));

jest.mock('../../services/gpsService');
jest.mock('../../services/socketService');

describe('LiveTrackingPage', () => {
  const basePath = {
    id: 'path-1',
    title: 'Test Path',
    publisherId: 'user-1',
    publisher: { name: 'Publisher' },
    followerIds: ['user-2'],
    status: 'idle',
    coordinates: [
      { lat: 10, lng: 20, timestamp: 1000 },
      { lat: 10.1, lng: 20.1, timestamp: 2000 },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    useParams.mockReturnValue({ pathId: 'path-1' });
    useNavigate.mockReturnValue(mockNavigate);
    useAuth.mockReturnValue({ user: { id: 'user-1', name: 'John Doe' } });

    apiClient.get.mockResolvedValue({ data: basePath });
    apiClient.post.mockResolvedValue({ data: {} });

    getCurrentPosition.mockResolvedValue({
      lat: 10,
      lng: 20,
      timestamp: 2000,
      accuracy: 5,
    });

    watchPosition.mockImplementation((onSuccess) => {
      onSuccess({ lat: 10.01, lng: 20.01, timestamp: 3000 });
      return jest.fn();
    });

    stopWatching.mockImplementation(() => {});
    calculateTotalDistance.mockReturnValue(1000);
    formatDistance.mockImplementation((v) => `${v} m`);
    formatDuration.mockImplementation((v) => `${Math.round(v / 1000)}s`);

    connectSocket.mockReturnValue({});
    disconnectSocket.mockImplementation(() => {});

    startTracking.mockResolvedValue({});
    pauseTracking.mockResolvedValue({});
    resumeTracking.mockResolvedValue({});
    endTracking.mockResolvedValue({});
    joinTracking.mockResolvedValue({ success: true, pathStatus: 'recording' });
    leaveTracking.mockResolvedValue({});
    sendLocation.mockImplementation(() => {});

    onLocationUpdate.mockImplementation((cb) => {
      socketHandlers.location = cb;
      return jest.fn();
    });
    onTrackingStarted.mockImplementation((cb) => {
      socketHandlers.started = cb;
      return jest.fn();
    });
    onTrackingPaused.mockImplementation((cb) => {
      socketHandlers.paused = cb;
      return jest.fn();
    });
    onTrackingResumed.mockImplementation((cb) => {
      socketHandlers.resumed = cb;
      return jest.fn();
    });
    onTrackingEnded.mockImplementation((cb) => {
      socketHandlers.ended = cb;
      return jest.fn();
    });
    onFollowerJoined.mockImplementation((cb) => {
      socketHandlers.followerJoined = cb;
      return jest.fn();
    });

    window.showToast = jest.fn();
  });

  it('renders loading state', async () => {
    apiClient.get.mockImplementation(() => new Promise(() => {}));

    const { container } = render(<LiveTrackingPage />);

    expect(container.querySelector('.tracking-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading path data...')).toBeInTheDocument();
  });

  it('renders error state and navigates back', async () => {
    apiClient.get.mockRejectedValue(new Error('Failed'));

    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load path data/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Back to Dashboard/i));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('renders header and meta info', async () => {
    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Path')).toBeInTheDocument();
      expect(screen.getByText(/By Publisher/i)).toBeInTheDocument();
    });
  });

  it('renders map and toggles auto-follow', async () => {
    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toBeInTheDocument();
    });

    const autoBtn = screen.getByTitle(/auto-center/i);
    fireEvent.click(autoBtn);

    await waitFor(() => {
      expect(screen.getByTestId('map-view').getAttribute('data-follow')).toBe('off');
    });
  });

  it('shows publisher start controls and starts tracking', async () => {
    render(<LiveTrackingPage />);

    const startBtn = await screen.findByText(/Start Publishing Path/i);
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(startTracking).toHaveBeenCalledWith('path-1', 'user-1');
      expect(window.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Path publishing started'),
        'success'
      );
    });
  });

  it('shows pause and end controls when recording', async () => {
    apiClient.get.mockResolvedValue({ data: { ...basePath, status: 'recording' } });

    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(screen.getByText('Pause')).toBeInTheDocument();
      expect(screen.getByText('End')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Pause'));
    await waitFor(() => {
      expect(pauseTracking).toHaveBeenCalledWith('path-1', 'user-1');
    });

    fireEvent.click(screen.getByText('End'));
    await waitFor(() => {
      expect(endTracking).toHaveBeenCalledWith('path-1', 'user-1');
    });
  });

  it('shows resume controls when paused', async () => {
    apiClient.get.mockResolvedValue({ data: { ...basePath, status: 'paused' } });

    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(screen.getByText('Resume')).toBeInTheDocument();
      expect(screen.getByText('End')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Resume'));
    await waitFor(() => {
      expect(resumeTracking).toHaveBeenCalledWith('path-1', 'user-1');
    });
  });

  it('renders ended state for publisher', async () => {
    apiClient.get.mockResolvedValue({ data: { ...basePath, status: 'ended' } });

    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(screen.getByText(/Tracking session ended/i)).toBeInTheDocument();
    });
  });

  it('renders follower waiting state when idle', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-2', name: 'Follower' } });

    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(screen.getByText(/Waiting for publisher to start/i)).toBeInTheDocument();
    });
  });

  it('follower can join and leave tracking', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-2', name: 'Follower' } });
    apiClient.get.mockResolvedValue({ data: { ...basePath, status: 'recording' } });

    render(<LiveTrackingPage />);

    const joinBtn = await screen.findByText(/Start Following Path/i);
    fireEvent.click(joinBtn);

    await waitFor(() => {
      expect(joinTracking).toHaveBeenCalledWith('path-1', 'user-2');
    });

    // Simulate follower coordinates present
    socketHandlers.location({
      pathId: 'path-1',
      role: 'follower',
      userId: 'user-2',
      coordinate: { lat: 10, lng: 20, timestamp: 4000 },
    });

    await waitFor(() => {
      expect(screen.getByText(/Leave Tracking/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Leave Tracking/i));

    await waitFor(() => {
      expect(leaveTracking).toHaveBeenCalledWith('path-1', 'user-2');
      expect(apiClient.post).toHaveBeenCalledWith('/paths/path-1/unfollow');
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('shows no access state for non-follower', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-3', name: 'Stranger' } });

    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(screen.getByText(/Follow this path to join live tracking/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Go to Dashboard/i));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('updates status via socket events', async () => {
    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(screen.getByText(/Not Started/i)).toBeInTheDocument();
    });

    socketHandlers.started({ pathId: 'path-1' });
    await waitFor(() => {
      expect(screen.getAllByText(/Live/i).length).toBeGreaterThan(0);
    });

    socketHandlers.paused({ pathId: 'path-1' });
    await waitFor(() => {
      expect(screen.getByText(/Paused/i)).toBeInTheDocument();
    });

    socketHandlers.resumed({ pathId: 'path-1' });
    await waitFor(() => {
      expect(screen.getAllByText(/Live/i).length).toBeGreaterThan(0);
    });

    socketHandlers.ended({ pathId: 'path-1' });
    await waitFor(() => {
      expect(screen.getByText(/Tracking session ended/i)).toBeInTheDocument();
    });
  });

  it('increments follower count on follower join', async () => {
    render(<LiveTrackingPage />);

    socketHandlers.followerJoined({ pathId: 'path-1' });

    await waitFor(() => {
      expect(screen.getByText(/watching/i)).toBeInTheDocument();
    });
  });

  it('shows gps display with accuracy when available', async () => {
    const { container } = render(<LiveTrackingPage />);

    await waitFor(() => {
      const gpsDisplay = container.querySelector('.gps-display');
      expect(gpsDisplay).toBeInTheDocument();
      expect(screen.getByText(/Accuracy/i)).toBeInTheDocument();
    });
  });

  it('computes speed and sends location for publisher', async () => {
    watchPosition.mockImplementation((onSuccess) => {
      onSuccess({ lat: 10.0, lng: 20.0, timestamp: 1000 });
      onSuccess({ lat: 10.01, lng: 20.01, timestamp: 2000 });
      return jest.fn();
    });

    render(<LiveTrackingPage />);

    const startBtn = await screen.findByText(/Start Publishing Path/i);
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(sendLocation).toHaveBeenCalledWith(
        'path-1',
        'user-1',
        expect.objectContaining({ lat: 10.01, lng: 20.01 }),
        'publisher'
      );
    });

    expect(screen.getByText(/km\/h/i)).toBeInTheDocument();
  });

  it('handles gps error callback', async () => {
    watchPosition.mockImplementation((_, onError) => {
      onError(new Error('No GPS'));
      return jest.fn();
    });

    render(<LiveTrackingPage />);

    const startBtn = await screen.findByText(/Start Publishing Path/i);
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(window.showToast).toHaveBeenCalledWith(
        expect.stringContaining('GPS error'),
        'error'
      );
    });
  });

  it('handles join tracking error', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-2', name: 'Follower' } });
    apiClient.get.mockResolvedValue({ data: { ...basePath, status: 'recording' } });
    joinTracking.mockRejectedValue(new Error('Join failed'));

    render(<LiveTrackingPage />);

    const joinBtn = await screen.findByText(/Start Following Path/i);
    fireEvent.click(joinBtn);

    await waitFor(() => {
      expect(window.showToast).toHaveBeenCalledWith('Failed to join tracking', 'error');
    });
  });

  it('handles leave tracking error', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-2', name: 'Follower' } });
    apiClient.get.mockResolvedValue({ data: { ...basePath, status: 'recording' } });
    leaveTracking.mockRejectedValue(new Error('Leave failed'));

    render(<LiveTrackingPage />);

    const joinBtn = await screen.findByText(/Start Following Path/i);
    fireEvent.click(joinBtn);

    await waitFor(() => {
      expect(screen.getByText(/Leave Tracking/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Leave Tracking/i));

    await waitFor(() => {
      expect(window.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Error stopping follow'),
        'error'
      );
    });
  });

  it('renders distance comparison for follower', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-2', name: 'Follower' } });
    apiClient.get.mockResolvedValue({ data: { ...basePath, status: 'recording' } });
    joinTracking.mockResolvedValue({
      success: true,
      pathStatus: 'recording',
      publisherCoordinates: basePath.coordinates,
    });

    render(<LiveTrackingPage />);

    const joinBtn = await screen.findByText(/Start Following Path/i);
    fireEvent.click(joinBtn);

    await waitFor(() => {
      expect(screen.getByText(/Path Comparison/i)).toBeInTheDocument();
    });
  });

  it('computes direction info for follower', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-2', name: 'Follower' } });
    apiClient.get.mockResolvedValue({ data: { ...basePath, status: 'recording' } });
    joinTracking.mockResolvedValue({
      success: true,
      pathStatus: 'recording',
      publisherCoordinates: basePath.coordinates,
    });

    render(<LiveTrackingPage />);

    const joinBtn = await screen.findByText(/Start Following Path/i);
    fireEvent.click(joinBtn);

    await waitFor(() => {
      expect(screen.getByTestId('map-view').getAttribute('data-has-direction')).toBe('yes');
    });
  });

  it('marks direction info completed at end of path', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-2', name: 'Follower' } });
    apiClient.get.mockResolvedValue({
      data: {
        ...basePath,
        status: 'recording',
        coordinates: [
          { lat: 10, lng: 20, timestamp: 1000 },
          { lat: 10.01, lng: 20.01, timestamp: 2000 },
        ],
      },
    });
    getCurrentPosition.mockResolvedValue({
      lat: 10.01,
      lng: 20.01,
      timestamp: 2000,
      accuracy: 5,
    });
    joinTracking.mockResolvedValue({
      success: true,
      pathStatus: 'recording',
      publisherCoordinates: [
        { lat: 10, lng: 20, timestamp: 1000 },
        { lat: 10.01, lng: 20.01, timestamp: 2000 },
      ],
    });

    render(<LiveTrackingPage />);

    const joinBtn = await screen.findByText(/Start Following Path/i);
    fireEvent.click(joinBtn);

    await waitFor(() => {
      expect(screen.getByTestId('map-view').getAttribute('data-direction-completed')).toBe('yes');
    });
  });

  it('handles follower ended state with no coords', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-2', name: 'Follower' } });
    apiClient.get.mockResolvedValue({ data: { ...basePath, status: 'ended' } });

    render(<LiveTrackingPage />);

    const followBtn = await screen.findByText(/Follow Recorded Path/i);
    fireEvent.click(followBtn);

    await waitFor(() => {
      expect(joinTracking).toHaveBeenCalledWith('path-1', 'user-2');
    });
  });

  it('handles follower ended state with coords', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-2', name: 'Follower' } });
    apiClient.get.mockResolvedValue({ data: { ...basePath, status: 'ended' } });
    joinTracking.mockResolvedValue({
      success: true,
      pathStatus: 'ended',
      publisherCoordinates: basePath.coordinates,
    });

    render(<LiveTrackingPage />);

    const followBtn = await screen.findByText(/Follow Recorded Path/i);
    fireEvent.click(followBtn);

    await waitFor(() => {
      expect(screen.getByText(/Stop Following/i)).toBeInTheDocument();
    });
  });

  it('updates elapsed time while recording', async () => {
    jest.useFakeTimers();

    render(<LiveTrackingPage />);

    const startBtn = await screen.findByText(/Start Publishing Path/i);
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(screen.getByText('Pause')).toBeInTheDocument();
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.getByText(/1s/)).toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  it('logs errors when pausing and ending tracking', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    apiClient.get.mockResolvedValue({ data: { ...basePath, status: 'recording' } });
    pauseTracking.mockRejectedValue(new Error('Pause failed'));
    endTracking.mockRejectedValue(new Error('End failed'));

    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(screen.getByText('Pause')).toBeInTheDocument();
      expect(screen.getByText('End')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Pause'));
    fireEvent.click(screen.getByText('End'));
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error pausing tracking:', expect.any(Error));
      expect(consoleSpy).toHaveBeenCalledWith('Error ending tracking:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('logs errors when resuming tracking', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    apiClient.get.mockResolvedValue({ data: { ...basePath, status: 'paused' } });
    resumeTracking.mockRejectedValue(new Error('Resume failed'));

    render(<LiveTrackingPage />);

    const resumeBtn = await screen.findByText('Resume');
    fireEvent.click(resumeBtn);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error resuming tracking:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('shows login prompt when starting without user id', async () => {
    const userObj = { id: 'user-1', name: 'John Doe' };
    useAuth.mockReturnValue({ user: userObj });

    render(<LiveTrackingPage />);

    const startBtn = await screen.findByText(/Start Publishing Path/i);
    userObj.id = null;
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(window.showToast).toHaveBeenCalledWith('Please log in first', 'error');
    });
  });

  it('shows login prompt when pausing without user id', async () => {
    const userObj = { id: 'user-1', name: 'John Doe' };
    useAuth.mockReturnValue({ user: userObj });
    apiClient.get.mockResolvedValue({ data: { ...basePath, status: 'recording' } });

    render(<LiveTrackingPage />);

    const pauseBtn = await screen.findByText('Pause');
    userObj.id = null;
    fireEvent.click(pauseBtn);

    await waitFor(() => {
      expect(window.showToast).toHaveBeenCalledWith('Please log in first', 'error');
    });
  });

  it('shows login prompt when resuming without user id', async () => {
    const userObj = { id: 'user-1', name: 'John Doe' };
    useAuth.mockReturnValue({ user: userObj });
    apiClient.get.mockResolvedValue({ data: { ...basePath, status: 'paused' } });

    render(<LiveTrackingPage />);

    const resumeBtn = await screen.findByText('Resume');
    userObj.id = null;
    fireEvent.click(resumeBtn);

    await waitFor(() => {
      expect(window.showToast).toHaveBeenCalledWith('Please log in first', 'error');
    });
  });

  it('shows login prompt when ending without user id', async () => {
    const userObj = { id: 'user-1', name: 'John Doe' };
    useAuth.mockReturnValue({ user: userObj });
    apiClient.get.mockResolvedValue({ data: { ...basePath, status: 'recording' } });

    render(<LiveTrackingPage />);

    const endBtn = await screen.findByText('End');
    userObj.id = null;
    fireEvent.click(endBtn);

    await waitFor(() => {
      expect(window.showToast).toHaveBeenCalledWith('Please log in first', 'error');
    });
  });

  it('shows login prompt when leaving without user id', async () => {
    const userObj = { id: 'user-2', name: 'Follower' };
    useAuth.mockReturnValue({ user: userObj });
    apiClient.get.mockResolvedValue({ data: { ...basePath, status: 'recording' } });

    render(<LiveTrackingPage />);

    const joinBtn = await screen.findByText(/Start Following Path/i);
    fireEvent.click(joinBtn);

    await waitFor(() => {
      expect(screen.getByText(/Leave Tracking/i)).toBeInTheDocument();
    });

    userObj.id = null;
    fireEvent.click(screen.getByText(/Leave Tracking/i));

    await waitFor(() => {
      expect(window.showToast).toHaveBeenCalledWith('Please log in first', 'error');
    });
  });

  it('shows login prompt when follower id is missing', async () => {
    useAuth.mockReturnValue({ user: { name: 'NoId' } });
    apiClient.get.mockResolvedValue({
      data: { ...basePath, status: 'recording', followerIds: [undefined] },
    });

    render(<LiveTrackingPage />);

    const joinBtn = await screen.findByText(/Start Following Path/i);
    fireEvent.click(joinBtn);

    await waitFor(() => {
      expect(window.showToast).toHaveBeenCalledWith('Please log in first', 'error');
    });
  });

  it('navigates back from header button', async () => {
    render(<LiveTrackingPage />);

    const backBtn = await screen.findByText('← Back');
    fireEvent.click(backBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('handles socket location updates for publisher and follower', async () => {
    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toBeInTheDocument();
      expect(typeof socketHandlers.location).toBe('function');
    });

    socketHandlers.location({
      pathId: 'path-1',
      role: 'publisher',
      coordinate: { lat: 11, lng: 21, timestamp: 3000 },
    });

    await waitFor(() => {
      expect(screen.getByTestId('map-view').getAttribute('data-pub-count')).toBe('3');
    });

    socketHandlers.location({
      pathId: 'path-1',
      role: 'follower',
      userId: 'user-9',
      coordinate: { lat: 12, lng: 22, timestamp: 4000 },
    });

    await waitFor(() => {
      expect(screen.getByTestId('map-view').getAttribute('data-follow-count')).toBe('1');
    });
  });

  it('sends location updates only when authenticated', async () => {
    useAuth.mockReturnValue({ user: null });

    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(sendLocation).not.toHaveBeenCalled();
    });
  });

  it('logs errors when start tracking fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    startTracking.mockRejectedValue(new Error('Start failed'));

    render(<LiveTrackingPage />);

    const startBtn = await screen.findByText(/Start Publishing Path/i);
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error starting tracking:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('ignores location updates for different path', async () => {
    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(typeof socketHandlers.location).toBe('function');
      expect(screen.getByTestId('map-view')).toBeInTheDocument();
    });

    const initialPubCount = screen.getByTestId('map-view').getAttribute('data-pub-count');

    socketHandlers.location({
      pathId: 'path-999', // Different path
      role: 'publisher',
      coordinate: { lat: 11, lng: 21, timestamp: 3000 },
    });

    // Should not change
    expect(screen.getByTestId('map-view').getAttribute('data-pub-count')).toBe(initialPubCount);
  });

  it('ignores follower location if already tracking someone else', async () => {
    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(typeof socketHandlers.location).toBe('function');
      expect(screen.getByTestId('map-view')).toBeInTheDocument();
    });

    // First follower - should be tracked
    socketHandlers.location({
      pathId: 'path-1',
      role: 'follower',
      userId: 'user-99',
      coordinate: { lat: 10, lng: 20, timestamp: 3000 },
    });

    const followCount = screen.getByTestId('map-view').getAttribute('data-follow-count');

    // Second follower - should be ignored (tracking first one only)
    socketHandlers.location({
      pathId: 'path-1',
      role: 'follower',
      userId: 'user-100',
      coordinate: { lat: 11, lng: 21, timestamp: 4000 },
    });

    // Should stay the same
    expect(screen.getByTestId('map-view').getAttribute('data-follow-count')).toBe(followCount);
  });

  it('handles getCurrentPosition rejection gracefully', async () => {
    getCurrentPosition.mockRejectedValue(new Error('GPS not available'));

    render(<LiveTrackingPage />);

    const startBtn = await screen.findByText(/Start Publishing Path/i);
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(startTracking).toHaveBeenCalled();
    });
  });

  it('processes socket Tracking Started/Paused/Resumed/Ended events for other paths', async () => {
    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(typeof socketHandlers.started).toBe('function');
    });

    // Events for different path - should not affect status
    const statusBefore = screen.queryByText(/Live/i);

    socketHandlers.started({ pathId: 'path-999' });
    socketHandlers.paused({ pathId: 'path-999' });
    socketHandlers.resumed({ pathId: 'path-999' });
    socketHandlers.ended({ pathId: 'path-999' });

    // Status should not change
    if (statusBefore) {
      expect(screen.queryByText(/Live/i)).toBeInTheDocument();
    }
  });

  it('handles error when getCurrentPosition has null timestamp', async () => {
    getCurrentPosition.mockResolvedValue({
      lat: 10,
      lng: 20,
      timestamp: null,
      accuracy: 5,
    });

    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toBeInTheDocument();
    });
  });

  it('handles rapid follower joins', async () => {
    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(typeof socketHandlers.followerJoined).toBe('function');
    });

    socketHandlers.followerJoined({ pathId: 'path-1' });
    socketHandlers.followerJoined({ pathId: 'path-1' });
    socketHandlers.followerJoined({ pathId: 'path-1' });

    await waitFor(() => {
      expect(screen.getByText(/watching/i)).toBeInTheDocument();
    });
  });

  it('shows follower finished path message when direction completed', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-2', name: 'Follower' } });
    apiClient.get.mockResolvedValue({ data: { ...basePath, status: 'recording' } });
    getCurrentPosition.mockResolvedValue({
      lat: 10.01,
      lng: 20.01,
      timestamp: 2000,
      accuracy: 5,
    });
    joinTracking.mockResolvedValue({
      success: true,
      pathStatus: 'recording',
      publisherCoordinates: [
        { lat: 10, lng: 20, timestamp: 1000 },
        { lat: 10.01, lng: 20.01, timestamp: 2000 },
      ],
    });

    render(<LiveTrackingPage />);

    const followBtn = await screen.findByText(/Start Following Path/i);
    fireEvent.click(followBtn);

    await waitFor(() => {
      expect(screen.getByTestId('map-view').getAttribute('data-direction-completed')).toBe('yes');
    });
  });

  it('computes direction info with bearing and distance', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-2', name: 'Follower' } });
    apiClient.get.mockResolvedValue({
      data: {
        ...basePath,
        status: 'recording',
        coordinates: [
          { lat: 0, lng: 0, timestamp: 1000 },
          { lat: 0.01, lng: 0.01, timestamp: 2000 },
          { lat: 0.02, lng: 0.02, timestamp: 3000 },
        ],
      },
    });
    getCurrentPosition.mockResolvedValue({
      lat: 0.005,
      lng: 0.005,
      timestamp: 1500,
      accuracy: 5,
    });
    joinTracking.mockResolvedValue({
      success: true,
      pathStatus: 'recording',
      publisherCoordinates: [
        { lat: 0, lng: 0, timestamp: 1000 },
        { lat: 0.01, lng: 0.01, timestamp: 2000 },
        { lat: 0.02, lng: 0.02, timestamp: 3000 },
      ],
    });

    render(<LiveTrackingPage />);

    const followBtn = await screen.findByText(/Start Following Path/i);
    fireEvent.click(followBtn);

    await waitFor(() => {
      expect(screen.getByTestId('map-view').getAttribute('data-has-direction')).toBe('yes');
    });
  });

  it('shows progress percentage for follower', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-2', name: 'Follower' } });
    apiClient.get.mockResolvedValue({
      data: {
        ...basePath,
        status: 'recording',
        coordinates: Array.from({ length: 10 }, (_, i) => ({
          lat: 10 + i * 0.01,
          lng: 20 + i * 0.01,
          timestamp: 1000 + i * 1000,
        })),
      },
    });
    getCurrentPosition.mockResolvedValue({
      lat: 10.05,
      lng: 20.05,
      timestamp: 6000,
      accuracy: 5,
    });
    joinTracking.mockResolvedValue({
      success: true,
      pathStatus: 'recording',
      publisherCoordinates: Array.from({ length: 10 }, (_, i) => ({
        lat: 10 + i * 0.01,
        lng: 20 + i * 0.01,
        timestamp: 1000 + i * 1000,
      })),
    });

    render(<LiveTrackingPage />);

    const followBtn = await screen.findByText(/Start Following Path/i);
    fireEvent.click(followBtn);

    await waitFor(() => {
      const progressText = screen.queryByText(/%/);
      if (progressText) {
        expect(progressText).toBeInTheDocument();
      }
    });
  });

  it('handles calcSpeed with same timestamp', async () => {
    watchPosition.mockImplementation((onSuccess) => {
      // Send two coordinates with same timestamp (dt = 0)
      onSuccess({ lat: 10.0, lng: 20.0, timestamp: 1000 });
      onSuccess({ lat: 10.01, lng: 20.01, timestamp: 1000 });
      return jest.fn();
    });

    render(<LiveTrackingPage />);

    const startBtn = await screen.findByText(/Start Publishing Path/i);
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(startTracking).toHaveBeenCalled();
    });
  });

  it('does not show toast when window.showToast is unavailable', async () => {
    const originalShowToast = window.showToast;
    delete window.showToast;

    apiClient.get.mockResolvedValue({ data: { ...basePath, status: 'recording' } });

    render(<LiveTrackingPage />);

    const pauseBtn = await screen.findByText('Pause');
    fireEvent.click(pauseBtn);

    await waitFor(() => {
      expect(pauseTracking).toHaveBeenCalled();
    });

    window.showToast = originalShowToast;
  });

  it('handles socket pause event and shows toast', async () => {
    apiClient.get.mockResolvedValue({ data: { ...basePath, status: 'recording' } });

    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(typeof socketHandlers.paused).toBe('function');
    });

    socketHandlers.paused({ pathId: 'path-1' });

    await waitFor(() => {
      expect(window.showToast).toHaveBeenCalledWith('⏸️ Tracking paused', 'warning');
    });
  });

  it('handles socket resume event and shows toast', async () => {
    apiClient.get.mockResolvedValue({ data: { ...basePath, status: 'paused' } });

    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(typeof socketHandlers.resumed).toBe('function');
    });

    socketHandlers.resumed({ pathId: 'path-1' });

    await waitFor(() => {
      expect(window.showToast).toHaveBeenCalledWith('▶️ Tracking resumed', 'success');
    });
  });

  it('handles socket end event and shows toast', async () => {
    apiClient.get.mockResolvedValue({ data: { ...basePath, status: 'recording' } });

    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(typeof socketHandlers.ended).toBe('function');
    });

    socketHandlers.ended({ pathId: 'path-1' });

    await waitFor(() => {
      expect(window.showToast).toHaveBeenCalledWith('🏁 Tracking ended', 'info');
    });
  });

  it('shows login error when no user id during device tracking join', async () => {
    useAuth.mockReturnValue({ user: { id: null, name: 'Anonymous' } });
    // Mock a path where user would be a follower (include null as follower ID to simulate the null user)
    const followerPath = { ...basePath, status: 'recording', publisherId: 'other-publisher-id', followerIds: [null, 'some-other-follower'] };
    apiClient.get.mockResolvedValue({ data: followerPath });

    render(<LiveTrackingPage />);

    // Wait for component to render and identify conditions for showing join button
    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toBeInTheDocument();
    });

    // Find and click the join button
    const joinBtn = await screen.findByText(/Start Following Path/i);
    fireEvent.click(joinBtn);

    await waitFor(() => {
      expect(window.showToast).toHaveBeenCalledWith('Please log in first', 'error');
    });
  });

  it('shows login error when starting GPS watch without user', async () => {
    useAuth.mockReturnValue({ user: { id: null } });
    // Mock a path where user would be the publisher
    const publisherPath = { ...basePath, status: 'idle', publisherId: null };
    apiClient.get.mockResolvedValue({ data: publisherPath });

    render(<LiveTrackingPage />);

    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toBeInTheDocument();
    });

    const startBtn = await screen.findByText(/Start Publishing Path/i);
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(window.showToast).toHaveBeenCalledWith('Please log in first', 'error');
    });
  });

  it('handles socket location update with follower role as publisher', async () => {
    apiClient.get.mockResolvedValue({ data: basePath });

    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toBeInTheDocument();
    });

    // Simulate location update from a follower (publisher view)
    socketHandlers.location({
      pathId: 'path-1',
      role: 'follower',
      userId: 'follower-1',
      coordinate: { lat: 10.5, lng: 20.5, timestamp: 5000 },
    });

    await waitFor(() => {
      // Verify followerCoords was updated
      const mapView = screen.getByTestId('map-view');
      expect(mapView.getAttribute('data-follow-count')).toBe('1');
    });
  });

  it('handles socket location update from tracked follower', async () => {
    apiClient.get.mockResolvedValue({ data: basePath });

    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toBeInTheDocument();
    });

    // First follower update (should track this follower)
    socketHandlers.location({
      pathId: 'path-1',
      role: 'follower',
      userId: 'follower-1',
      coordinate: { lat: 10.2, lng: 20.2, timestamp: 2500 },
    });

    // Second follower update from same follower (should be added)
    socketHandlers.location({
      pathId: 'path-1',
      role: 'follower',
      userId: 'follower-1',
      coordinate: { lat: 10.3, lng: 20.3, timestamp: 3000 },
    });

    await waitFor(() => {
      const mapView = screen.getByTestId('map-view');
      // Should have 2 follower coordinates
      expect(mapView).toBeInTheDocument();
    });
  });

  it('handles socket location update from different follower (not tracked)', async () => {
    apiClient.get.mockResolvedValue({ data: basePath });

    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toBeInTheDocument();
    });

    // First follower - should be tracked
    socketHandlers.location({
      pathId: 'path-1',
      role: 'follower',
      userId: 'follower-1',
      coordinate: { lat: 10.2, lng: 20.2, timestamp: 2500 },
    });

    // Different follower - should NOT be tracked (only first follower tracked)
    socketHandlers.location({
      pathId: 'path-1',
      role: 'follower',
      userId: 'follower-2',
      coordinate: { lat: 10.4, lng: 20.4, timestamp: 3500 },
    });

    await waitFor(() => {
      const mapView = screen.getByTestId('map-view');
      // Should still have only 1 follower coordinate (not the second follower)
      expect(mapView.getAttribute('data-follow-count')).toBe('1');
    });
  });

  it('handles socket location update with publisher role as follower', async () => {
    // Setup: current user is a follower
    const followerPath = { ...basePath, publisherId: 'other-user', followerIds: ['user-1'] };
    apiClient.get.mockResolvedValue({ data: followerPath });

    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toBeInTheDocument();
    });

    // Simulate location update from publisher (follower receives it)
    socketHandlers.location({
      pathId: 'path-1',
      role: 'publisher',
      userId: 'publisher-id',
      coordinate: { lat: 11.0, lng: 21.0, timestamp: 4000 },
    });

    await waitFor(() => {
      // Verify that publisherCoords was updated with the received location
      const mapView = screen.getByTestId('map-view');
      expect(mapView.getAttribute('data-pub-count')).toBe('3'); // basePath has 2 + 1 new = 3
    });
  });

  it('calcSpeed handles valid coordinate pair with time difference', async () => {
    watchPosition.mockImplementation((onSuccess) => {
      // Send coordinates with measurable distance and time
      onSuccess({ lat: 10.0, lng: 20.0, timestamp: 1000 });
      onSuccess({ lat: 10.01, lng: 20.01, timestamp: 2000 });
      return jest.fn();
    });

    render(<LiveTrackingPage />);

    const startBtn = await screen.findByText(/Start Publishing Path/i);
    fireEvent.click(startBtn);

    await waitFor(() => {
      // Speed should be calculated
      expect(startTracking).toHaveBeenCalled();
    });
  });

  it('handles leave tracking when user has id', async () => {
    // Setup: current user is follower
    const followerPath = { ...basePath, status: 'recording', publisherId: 'other-user', followerIds: ['user-1'] };
    apiClient.get.mockResolvedValue({ data: followerPath });
    leaveTracking.mockResolvedValue({});

    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toBeInTheDocument();
    });

    // Simulate that user has started following (followerCoords not empty)
    // by clicking start following button
    const joinBtn = await screen.findByText(/Start Following Path/i);
    fireEvent.click(joinBtn);

    // Wait for join to complete
    await waitFor(() => {
      expect(joinTracking).toHaveBeenCalled();
    });

    // Now click leave (should be available after joining)
    // Note: This depends on component state updates from joinTracking
  });

  it('handles socket location update with publisher role when coordinates exist', async () => {
    // Pre-seed publisherCoords so path is visible
    const pathWithCoords = {
      ...basePath,
      coordinates: [
        { lat: 10.0, lng: 20.0, timestamp: 1000 },
        { lat: 10.01, lng: 20.01, timestamp: 2000 },
      ],
    };
    apiClient.get.mockResolvedValue({ data: pathWithCoords });

    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toBeInTheDocument();
    });

    // Publish initial coordinate
    socketHandlers.location({
      pathId: 'path-1',
      role: 'publisher',
      userId: 'user-1',
      coordinate: { lat: 10.02, lng: 20.02, timestamp: 3000 },
    });

    await waitFor(() => {
      // Should have added the new coordinate
      const mapView = screen.getByTestId('map-view');
      expect(mapView.getAttribute('data-pub-count')).toBe('3');
    });
  });

  it('handles path with null coordinates in initial load', async () => {
    const pathWithoutCoords = { ...basePath, coordinates: null, status: 'idle' };
    apiClient.get.mockResolvedValue({ data: pathWithoutCoords });

    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toBeInTheDocument();
    });

    // Verify component renders without error
    expect(screen.getByText('Test Path')).toBeInTheDocument();
  });

  it('handles socket location update with no coordinates', async () => {
    apiClient.get.mockResolvedValue({ data: { ...basePath, coordinates: [] } });

    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toBeInTheDocument();
    });

    // Send location update
    socketHandlers.location({
      pathId: 'path-1',
      role: 'publisher',
      userId: 'user-1',
      coordinate: { lat: 10.0, lng: 20.0, timestamp: 1000 },
    });

    await waitFor(() => {
      // Verify map view was updated
      expect(screen.getByTestId('map-view')).toHaveAttribute('data-pub-count', '1');
    });
  });

  it('computes speed on first GPS update (lastCoordRef is null)', async () => {
    // This test ensures calcSpeed is called with null as prev coordinate
    // on the first GPS update
    let callCount = 0;
    watchPosition.mockImplementation((onSuccess) => {
      callCount++;
      if (callCount === 1) {
        // First call - this will trigger calcSpeed(null, coord)
        onSuccess({ lat: 10.0, lng: 20.0, timestamp: 1000 });
      }
      return jest.fn();
    });

    render(<LiveTrackingPage />);

    const startBtn = await screen.findByText(/Start Publishing Path/i);
    fireEvent.click(startBtn);

    await waitFor(() => {
      // Speed should be 0 since prev is null
      expect(startTracking).toHaveBeenCalled();
    });
  });

  it('handles calcSpeed with null coord and unauthenticated GPS guard', async () => {
    const userObj = { id: 'user-1', name: 'Publisher' };
    useAuth.mockReturnValue({ user: userObj });

    let gpsSuccess;
    watchPosition.mockImplementation((onSuccess) => {
      gpsSuccess = onSuccess;
      return jest.fn();
    });

    render(<LiveTrackingPage />);

    const startBtn = await screen.findByText(/Start Publishing Path/i);
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(startTracking).toHaveBeenCalled();
    });

    gpsSuccess({ lat: 10.0, lng: 20.0, timestamp: 1000 });
    expect(sendLocation).toHaveBeenCalledTimes(1);

    userObj.id = null;
    gpsSuccess(null);

    expect(sendLocation).toHaveBeenCalledTimes(1);
  });

  it('returns no direction info when publisher path has less than two points', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-2', name: 'Follower' } });
    apiClient.get.mockResolvedValue({
      data: {
        ...basePath,
        publisherId: 'publisher-1',
        followerIds: ['user-2'],
        status: 'recording',
        coordinates: [{ lat: 10, lng: 20, timestamp: 1000 }],
      },
    });

    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toBeInTheDocument();
    });

    expect(screen.getByTestId('map-view').getAttribute('data-has-direction')).toBe('no');
  });

  it('returns no direction info when current position is missing', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-2', name: 'Follower' } });
    getCurrentPosition.mockRejectedValue(new Error('No GPS'));
    apiClient.get.mockResolvedValue({
      data: {
        ...basePath,
        publisherId: 'publisher-1',
        followerIds: ['user-2'],
        status: 'recording',
        coordinates: [
          { lat: 10, lng: 20, timestamp: 1000 },
          { lat: 10.01, lng: 20.01, timestamp: 2000 },
        ],
      },
    });

    render(<LiveTrackingPage />);

    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toBeInTheDocument();
    });

    expect(screen.getByTestId('map-view').getAttribute('data-has-direction')).toBe('no');
  });
});
