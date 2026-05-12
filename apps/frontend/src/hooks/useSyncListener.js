import { useEffect } from 'react';

/**
 * Custom hook for handling follow request synchronization events
 * Allows components to listen for changes and refresh automatically
 */

const listeners = new Set();

export const useSyncListener = (callback) => {
  useEffect(() => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }, [callback]);
};

export const triggerSync = (eventType) => {
  listeners.forEach((callback) => {
    try {
      callback(eventType);
    } catch (error) {
      console.error('Error in sync listener:', error);
    }
  });
};

// Event types for follow request changes
export const SYNC_EVENTS = {
  REQUEST_CREATED: 'request_created',
  REQUEST_APPROVED: 'request_approved',
  REQUEST_REJECTED: 'request_rejected',
  REQUEST_CANCELLED: 'request_cancelled',
};
