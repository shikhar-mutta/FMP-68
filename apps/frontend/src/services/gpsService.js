/**
 * GPS Tracking Service
 * Uses navigator.geolocation to watch the user's position
 */

let watchId = null;

/**
 * Check if Geolocation API is available
 */
export const isGeolocationAvailable = () => {
  return 'geolocation' in navigator;
};

/**
 * Get the current position (one-time)
 */
export const getCurrentPosition = () => {
  return new Promise((resolve, reject) => {
    if (!isGeolocationAvailable()) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now(),
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
};

/**
 * Start watching position continuously
 * @param {Function} onPosition - Callback with position data
 * @param {Function} onError - Callback with error
 * @param {number} interval - Minimum interval between updates (ms)
 * @returns {Function} stop function
 */
export const watchPosition = (onPosition, onError, interval = 3000) => {
  if (!isGeolocationAvailable()) {
    onError(new Error('Geolocation is not supported by this browser'));
    return () => {};
  }

  // Stop any existing watch
  stopWatching();

  let lastEmitTime = 0;

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const now = Date.now();
      // Throttle updates to the specified interval
      if (now - lastEmitTime < interval) return;
      lastEmitTime = now;

      const coord = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: now,
      };

      onPosition(coord);
    },
    (error) => {
      console.error('GPS Error:', error);
      if (onError) onError(error);
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    }
  );

  return () => stopWatching();
};

/**
 * Stop watching the position
 */
export const stopWatching = () => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
};

/**
 * Calculate distance between two coordinates in meters (Haversine formula)
 */
export const calculateDistance = (coord1, coord2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (coord1.lat * Math.PI) / 180;
  const φ2 = (coord2.lat * Math.PI) / 180;
  const Δφ = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const Δλ = ((coord2.lng - coord1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Calculate total distance of a path in meters
 */
export const calculateTotalDistance = (coordinates) => {
  let total = 0;
  for (let i = 1; i < coordinates.length; i++) {
    total += calculateDistance(coordinates[i - 1], coordinates[i]);
  }
  return total;
};

/**
 * Format distance for display
 */
export const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
};

/**
 * Format duration for display
 */
export const formatDuration = (ms) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};
