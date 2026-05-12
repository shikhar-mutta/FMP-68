/**
 * Frontend Configuration Constants
 */

// Polling intervals (in milliseconds)
export const POLLING_INTERVALS = {
  PENDING_REQUESTS: 2000,     // 2 seconds - for pending follow requests
  SENT_REQUESTS: 2000,         // 2 seconds - for monitoring sent requests
  PATH_REQUESTS: 2000,         // 2 seconds - for path detail page
  PATH_CARD_REQUESTS: 3000,    // 3 seconds - for path cards on dashboard
};

// Inactivity timeout
export const SESSION_INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Toast notification duration
export const TOAST_DURATION = 3000; // 3 seconds

// API Response statuses
export const REQUEST_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

// Feature flags
export const FEATURES = {
  REQUIRE_FOLLOW_APPROVAL: true,
  ENABLE_POLLING: true,
};
