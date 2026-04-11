import { io } from 'socket.io-client';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

let socket = null;

/**
 * Connect to the tracking WebSocket namespace
 */
export const connectSocket = () => {
  if (socket && socket.connected) {
    return socket;
  }

  socket = io(`${API_URL}/tracking`, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
    autoConnect: true,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('🔌 Socket connection error:', error.message);
  });

  return socket;
};

/**
 * Get the current socket instance
 */
export const getSocket = () => {
  if (!socket || !socket.connected) {
    return connectSocket();
  }
  return socket;
};

/**
 * Disconnect from the socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Start publishing a path (publisher action)
 */
export const startTracking = (pathId, userId) => {
  const s = getSocket();
  return new Promise((resolve) => {
    s.emit('start-tracking', { pathId, userId }, (response) => {
      resolve(response);
    });
  });
};

/**
 * Send a GPS coordinate
 */
export const sendLocation = (pathId, userId, coordinate, role) => {
  const s = getSocket();
  s.emit('send-location', { pathId, userId, coordinate, role });
};

/**
 * Pause tracking
 */
export const pauseTracking = (pathId, userId) => {
  const s = getSocket();
  return new Promise((resolve) => {
    s.emit('pause-tracking', { pathId, userId }, (response) => {
      resolve(response);
    });
  });
};

/**
 * Resume tracking
 */
export const resumeTracking = (pathId, userId) => {
  const s = getSocket();
  return new Promise((resolve) => {
    s.emit('resume-tracking', { pathId, userId }, (response) => {
      resolve(response);
    });
  });
};

/**
 * End tracking
 */
export const endTracking = (pathId, userId) => {
  const s = getSocket();
  return new Promise((resolve) => {
    s.emit('end-tracking', { pathId, userId }, (response) => {
      resolve(response);
    });
  });
};

/**
 * Join as a follower to watch a live path
 */
export const joinTracking = (pathId, userId) => {
  const s = getSocket();
  return new Promise((resolve) => {
    s.emit('join-tracking', { pathId, userId }, (response) => {
      resolve(response);
    });
  });
};

/**
 * Leave a tracking room
 */
export const leaveTracking = (pathId, userId) => {
  const s = getSocket();
  return new Promise((resolve) => {
    s.emit('leave-tracking', { pathId, userId }, (response) => {
      resolve(response);
    });
  });
};

/**
 * Listen for location updates from other users
 */
export const onLocationUpdate = (callback) => {
  const s = getSocket();
  s.on('location-update', callback);
  return () => s.off('location-update', callback);
};

/**
 * Listen for tracking lifecycle events
 */
export const onTrackingStarted = (callback) => {
  const s = getSocket();
  s.on('tracking-started', callback);
  return () => s.off('tracking-started', callback);
};

export const onTrackingPaused = (callback) => {
  const s = getSocket();
  s.on('tracking-paused', callback);
  return () => s.off('tracking-paused', callback);
};

export const onTrackingResumed = (callback) => {
  const s = getSocket();
  s.on('tracking-resumed', callback);
  return () => s.off('tracking-resumed', callback);
};

export const onTrackingEnded = (callback) => {
  const s = getSocket();
  s.on('tracking-ended', callback);
  return () => s.off('tracking-ended', callback);
};

export const onFollowerJoined = (callback) => {
  const s = getSocket();
  s.on('follower-joined', callback);
  return () => s.off('follower-joined', callback);
};

export const onFollowerLeft = (callback) => {
  const s = getSocket();
  s.on('follower-left', callback);
  return () => s.off('follower-left', callback);
};
