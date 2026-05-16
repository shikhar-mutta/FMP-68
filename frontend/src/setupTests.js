// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// ─────────────────────────────────────────────────────────────────────
// Silence expected noise during tests.
//
// console.error swallows:
//   • "not wrapped in act"  — residual warnings from background polling
//     intervals in FollowRequestsPanel / SentRequestsPanel / *Page that
//     can't be wrapped at the test level.
//   • "Error <verb>:" / "Error fetching ..."  — the app's own error-path
//     logs in services and pages. The tests deliberately trigger these
//     rejections and assert on the user-visible side-effect (toast,
//     error state); the log itself is incidental and clutters output.
//   • "Uncaught [Error: ..."  — React error-boundary logging surfaced
//     when a test deliberately renders a component outside its required
//     provider (verifying the throw).
//
// console.warn swallows:
//   • React Router v6 → v7 "Future Flag Warning" notices.
//   • "Auto sign-out:" — the app's own inactivity log.
//   • "A function to advance timers was called …" — jest internal hint
//     emitted when a test calls a timer helper without enabling fake
//     timers, harmless for assertions.
//
// All other output is forwarded untouched so real surprises still show.
// ─────────────────────────────────────────────────────────────────────
const ORIGINAL_CONSOLE_ERROR = console.error;
const ORIGINAL_CONSOLE_WARN = console.warn;

const ERROR_SILENCE_PATTERNS = [
  /not wrapped in act/,
  /^Error\s+\w+/,             // Error fetching ..., Error joining ..., etc.
  /^Polling error:/,          // PathCard polling rejections in tests
  /^GPS Error:/,              // LiveTrackingPage geolocation rejection path
  /^Uncaught\s+\[Error:/,
  /^The above error occurred in/, // React error-boundary follow-up log
  /useToast must be used within ToastProvider/,
  /Encountered two children with the same key/, // expected in Toast tests
];

const WARN_SILENCE_PATTERNS = [
  /React Router Future Flag Warning/,
  /^Auto sign-out:/,
  /timers API is not mocked with fake timers/,
];

const matchesAny = (patterns, first) => {
  if (typeof first !== 'string') return false;
  return patterns.some((re) => re.test(first));
};

console.error = (...args) => {
  if (matchesAny(ERROR_SILENCE_PATTERNS, args[0])) return;
  ORIGINAL_CONSOLE_ERROR(...args);
};

console.warn = (...args) => {
  if (matchesAny(WARN_SILENCE_PATTERNS, args[0])) return;
  ORIGINAL_CONSOLE_WARN(...args);
};
