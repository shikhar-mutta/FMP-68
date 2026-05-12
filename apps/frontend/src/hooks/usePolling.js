import { useEffect, useRef } from 'react';

/**
 * Custom hook for polling data at regular intervals
 * @param {Function} fetchFunction - Async function to call
 * @param {number} interval - Interval in milliseconds (default: 3000ms)
 * @param {boolean} enabled - Whether polling is enabled (default: true)
 * @param {Array} dependencies - Dependency array for refreshing the poll
 */
export const usePolling = (fetchFunction, interval = 3000, enabled = true, dependencies = []) => {
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    // Initial fetch
    fetchFunction();

    // Set up polling
    intervalRef.current = setInterval(() => {
      fetchFunction();
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, interval, fetchFunction, ...dependencies]);

  // Manual stop/start control
  const stop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const start = () => {
    if (!intervalRef.current && enabled) {
      fetchFunction();
      intervalRef.current = setInterval(() => {
        fetchFunction();
      }, interval);
    }
  };

  return { stop, start };
};
