import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MapView from '../components/MapView';
import Navbar from '../components/Navbar';
import apiClient from '../services/api';
import {
  getCurrentPosition,
  watchPosition,
  stopWatching,
  calculateTotalDistance,
  formatDistance,
  formatDuration,
} from '../services/gpsService';
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
  republishTrack,
  onLocationUpdate,
  onTrackingStarted,
  onTrackingPaused,
  onTrackingResumed,
  onTrackingEnded,
  onTrackingRepublished,
  onFollowerJoined,
} from '../services/socketService';
import '../styles/LiveTracking.css';

// ── Helpers ───────────────────────────────────────────────
/**
 * Calculate speed in km/h between two coords with timestamps.
 */
function calcSpeed(prev, curr) {
  if (!prev || !curr) return 0;
  const dt = (curr.timestamp - prev.timestamp) / 1000; // seconds
  if (dt <= 0) return 0;

  const R = 6371e3;
  const φ1 = (prev.lat * Math.PI) / 180;
  const φ2 = (curr.lat * Math.PI) / 180;
  const Δφ = ((curr.lat - prev.lat) * Math.PI) / 180;
  const Δλ = ((curr.lng - prev.lng) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const dist = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * R;

  return ((dist / dt) * 3.6).toFixed(1); // km/h
}

/**
 * Haversine distance in metres between two {lat,lng} points.
 */
function haversineMeters(a, b) {
  const R = 6371e3;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) * R;
}

/**
 * Compass bearing (0-360°) from point `from` to point `to`.
 */
function getBearing(from, to) {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

// ─────────────────────────────────────────────────────────
export default function LiveTrackingPage() {
  const { pathId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Path data
  const [path, setPath] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tracking state
  const [trackingStatus, setTrackingStatus] = useState('idle');
  const [isPublisher, setIsPublisher] = useState(false);
  const [isFollower, setIsFollower] = useState(false);

  // Coordinates
  // Publisher always fills publisherCoords (their own GPS or received from socket)
  // Follower fills followerCoords (their own GPS); publisher fills followerCoords from socket
  const [publisherCoords, setPublisherCoords] = useState([]);
  const [followerCoords, setFollowerCoords] = useState([]);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [autoFollow, setAutoFollow] = useState(true);
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  // For publisher: track which follower's path to display (first one who sends data)
  const trackedFollowerRef = useRef(null);

  // Stats
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);

  // Pause points: coord recorded each time publisher/follower pauses
  const [pausePoints, setPausePoints] = useState([]);
  const [followerPausePoints, setFollowerPausePoints] = useState([]);

  // Button loading states
  const [isStarting, setIsStarting] = useState(false);
  const [isRepublishing, setIsRepublishing] = useState(false);
  const [followerActive, setFollowerActive] = useState(false);
  const [followerPaused, setFollowerPaused] = useState(false);
  const [sessionTerminated, setSessionTerminated] = useState(false);

  // Compass / device orientation
  const [deviceHeading, setDeviceHeading] = useState(null);
  const [needsCompassPerm, setNeedsCompassPerm] = useState(false);

  // Refs
  const stopWatchRef = useRef(null);
  const timerRef = useRef(null);
  const cleanupFnsRef = useRef([]);
  const lastCoordRef = useRef(null);

  // ── Lock body scroll so only sidebar scrolls on mobile ──
  useEffect(() => {
    const appWrapper = document.querySelector('.app-wrapper');
    const prevBodyOverflow = document.body.style.overflow;
    const prevWrapperOverflow = appWrapper ? appWrapper.style.overflow : '';
    const prevWrapperHeight = appWrapper ? appWrapper.style.height : '';
    document.body.style.overflow = 'hidden';
    if (appWrapper) {
      appWrapper.style.overflow = 'hidden';
      appWrapper.style.height = '100dvh';
    }
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      if (appWrapper) {
        appWrapper.style.overflow = prevWrapperOverflow;
        appWrapper.style.height = prevWrapperHeight;
      }
    };
  }, []);

  // ── Device orientation (compass heading) ────────────────
  useEffect(() => {
    if (typeof DeviceOrientationEvent === 'undefined') return;
    const handler = (e) => {
      let h = null;
      if (e.webkitCompassHeading != null) {
        h = e.webkitCompassHeading; // iOS: clockwise from North
      } else if (e.alpha != null) {
        // Android: alpha is CCW from North; convert to CW
        h = (360 - e.alpha + 360) % 360;
      }
      if (h != null) setDeviceHeading(Math.round(h));
    };
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      setNeedsCompassPerm(true); // iOS 13+ — need user gesture
    } else {
      window.addEventListener('deviceorientationabsolute', handler, true);
      window.addEventListener('deviceorientation', handler, true);
      return () => {
        window.removeEventListener('deviceorientationabsolute', handler, true);
        window.removeEventListener('deviceorientation', handler, true);
      };
    }
  }, []);

  const handleRecenter = useCallback(() => {
    setAutoFollow(true);
    setRecenterTrigger((v) => v + 1);
  }, []);

  const handleEnableCompass = useCallback(async () => {
    if (typeof DeviceOrientationEvent?.requestPermission !== 'function') return;
    try {
      const perm = await DeviceOrientationEvent.requestPermission();
      if (perm === 'granted') {
        setNeedsCompassPerm(false);
        const handler = (e) => {
          const h = e.webkitCompassHeading ?? null;
          if (h != null) setDeviceHeading(Math.round(h));
        };
        window.addEventListener('deviceorientation', handler, true);
      }
    } catch (_) {}
  }, []);

  // ── Fetch path data ──────────────────────────────────────
  useEffect(() => {
    const fetchPath = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get(`/paths/${pathId}`);
        const pathData = res.data;
        setPath(pathData);
        setIsPublisher(pathData.publisherId === user?.id);
        setIsFollower(pathData.followerIds?.includes(user?.id) || false);
        setTrackingStatus(pathData.status || 'idle');

        // Pre-load publisher's existing recorded coordinates
        if (pathData.coordinates?.length > 0) {
          setPublisherCoords(pathData.coordinates);
        }

        // Get initial GPS position (best-effort)
        try {
          const pos = await getCurrentPosition();
          setCurrentPosition(pos);
        } catch (_) {
          // GPS not available — OK, will prompt when tracking starts
        }

        setError(null);
      } catch (err) {
        console.error('Error fetching path:', err);
        setError('Failed to load path data');
      } finally {
        setLoading(false);
      }
    };
    fetchPath();
  }, [pathId, user?.id]);

  // ── Socket events ────────────────────────────────────────
  useEffect(() => {
    const socket = connectSocket();

    // Real-time location updates
    const unsubLocation = onLocationUpdate((data) => {
      if (data.pathId !== pathId) return;

      if (data.role === 'publisher') {
        // Append to the publisher's path for all viewers
        setPublisherCoords((prev) => [...prev, data.coordinate]);
        // ⚠️ Do NOT call setCurrentPosition here for followers.
        // Followers track their own GPS position via the GPS watch.
        // Overwriting currentPosition with the publisher's coords caused
        // the "both users at same location" bug.
      } else if (data.role === 'follower') {
        // Publisher sees the first follower's live green path
        // Followers receive their own echoed coords (skip — tracked locally)
        if (isPublisher) {
          // Track only the first follower who starts sending
          if (!trackedFollowerRef.current) {
            trackedFollowerRef.current = data.userId;
          }
          if (data.userId === trackedFollowerRef.current) {
            setFollowerCoords((prev) => [...prev, data.coordinate]);
          }
        }
      }
    });

    const unsubStarted = onTrackingStarted((data) => {
      if (data.pathId === pathId) {
        setTrackingStatus('recording');
        if (window.showToast) window.showToast('🔴 Live tracking started!', 'success');
      }
    });

    const unsubPaused = onTrackingPaused((data) => {
      if (data.pathId === pathId) {
        setTrackingStatus('paused');
        if (window.showToast) window.showToast('⏸️ Tracking paused', 'warning');
      }
    });

    const unsubResumed = onTrackingResumed((data) => {
      if (data.pathId === pathId) {
        setTrackingStatus('recording');
        if (window.showToast) window.showToast('▶️ Tracking resumed', 'success');
      }
    });

    const unsubEnded = onTrackingEnded((data) => {
      if (data.pathId === pathId) {
        setTrackingStatus('ended');
        stopWatching();
        if (window.showToast) window.showToast('🏁 Tracking ended', 'info');
      }
    });

    const unsubFollowerJoined = onFollowerJoined((data) => {
      if (data.pathId === pathId) {
        setFollowersCount((prev) => prev + 1);
        if (window.showToast) window.showToast('👤 A follower joined!', 'info');
      }
    });

    const unsubRepublished = onTrackingRepublished((data) => {
      if (data.pathId === pathId) {
        setTrackingStatus('idle');
        setPublisherCoords([]);
        setFollowerCoords([]);
        setPausePoints([]);
        setStartTime(null);
        setElapsedTime(null);
        setCurrentSpeed(0);
        trackedFollowerRef.current = null;
        lastCoordRef.current = null;
        if (window.showToast) window.showToast('🔄 Track republished — ready to start fresh!', 'success');
      }
    });

    cleanupFnsRef.current = [
      unsubLocation,
      unsubStarted,
      unsubPaused,
      unsubResumed,
      unsubEnded,
      unsubFollowerJoined,
      unsubRepublished,
    ];

    return () => {
      cleanupFnsRef.current.forEach((fn) => fn && fn());
      disconnectSocket();
    };
  }, [pathId, isPublisher]);

  // ── Elapsed-time timer ───────────────────────────────────
  useEffect(() => {
    const shouldRun = startTime && (
      (isPublisher && trackingStatus === 'recording') ||
      (!isPublisher && followerActive && !followerPaused)
    );
    if (shouldRun) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [trackingStatus, startTime, isPublisher, followerActive, followerPaused]);

  // ── GPS watch helper ─────────────────────────────────────
  const startGpsWatch = useCallback(
    (role) => {
      return watchPosition(
        (coord) => {
          // Compute speed
          if (lastCoordRef.current) {
            setCurrentSpeed(calcSpeed(lastCoordRef.current, coord));
          }
          lastCoordRef.current = coord;
          setCurrentPosition(coord);

          // Guard: only send location if user is authenticated
          if (!user?.id) return;

          if (role === 'publisher') {
            setPublisherCoords((prev) => [...prev, coord]);
            sendLocation(pathId, user?.id, coord, 'publisher');
          } else {
            setFollowerCoords((prev) => [...prev, coord]);
            sendLocation(pathId, user?.id, coord, 'follower');
          }
        },
        (err) => {
          console.error('GPS Error:', err);
          if (window.showToast)
            window.showToast('📍 GPS error: ' + err.message, 'error');
        },
        3000 // throttle: every 3 s
      );
    },
    [pathId, user?.id]
  );

  // ── Publisher: Start ─────────────────────────────────────
  const handleStartTracking = useCallback(async () => {
    if (!user?.id || isStarting) return;
    setIsStarting(true);
    try {
      await startTracking(pathId, user?.id);
      setTrackingStatus('recording');
      setStartTime(Date.now());
      setPublisherCoords([]);
      lastCoordRef.current = null;
      stopWatchRef.current = startGpsWatch('publisher');
      if (window.showToast) window.showToast('🔴 Path publishing started!', 'success');
    } catch (err) {
      console.error('Error starting tracking:', err);
      if (window.showToast) window.showToast('Failed to start tracking', 'error');
    } finally {
      setIsStarting(false);
    }
  }, [pathId, user?.id, startGpsWatch, isStarting]);

  // ── Publisher: Pause ─────────────────────────────────────
  const handlePauseTracking = useCallback(async () => {
    if (!user?.id) {
      if (window.showToast) window.showToast('Please log in first', 'error');
      return;
    }
    try {
      await pauseTracking(pathId, user?.id);
      setTrackingStatus('paused');
      setCurrentSpeed(0);
      if (lastCoordRef.current) {
        setPausePoints((prev) => [...prev, lastCoordRef.current]);
      }
      stopWatching();
    } catch (err) {
      console.error('Error pausing tracking:', err);
    }
  }, [pathId, user?.id]);

  // ── Publisher: Resume ────────────────────────────────────
  const handleResumeTracking = useCallback(async () => {
    if (!user?.id) {
      if (window.showToast) window.showToast('Please log in first', 'error');
      return;
    }
    try {
      await resumeTracking(pathId, user?.id);
      setTrackingStatus('recording');
      stopWatchRef.current = startGpsWatch('publisher');
    } catch (err) {
      console.error('Error resuming tracking:', err);
    }
  }, [pathId, user?.id, startGpsWatch]);

  // ── Publisher: End ───────────────────────────────────────
  const handleEndTracking = useCallback(async () => {
    if (!user?.id) {
      if (window.showToast) window.showToast('Please log in first', 'error');
      return;
    }
    try {
      await endTracking(pathId, user?.id);
      setTrackingStatus('ended');
      setCurrentSpeed(0);
      stopWatching();
      clearInterval(timerRef.current);
    } catch (err) {
      console.error('Error ending tracking:', err);
    }
  }, [pathId, user?.id]);

  // ── Publisher: Republish Track ───────────────────────────
  const handleRepublishTrack = useCallback(async () => {
    if (!user?.id || isRepublishing) return;
    setIsRepublishing(true);
    try {
      const result = await republishTrack(pathId, user?.id);
      if (!result.success) throw new Error(result.message);
      // UI reset is handled by the onTrackingRepublished socket event
      // so all connected clients (publisher + followers) reset together.
    } catch (err) {
      console.error('Error republishing track:', err);
      if (window.showToast) window.showToast('Failed to republish track', 'error');
    } finally {
      setIsRepublishing(false);
    }
  }, [pathId, user?.id, isRepublishing]);

  // ── Follower: Follow Ended Path (GPS-only, no socket needed) ───────────
  // When a path is ended the publisher's coordinates are already loaded from
  // the REST fetch, so we don't need to join a socket room — just start GPS.
  const handleFollowEndedPath = useCallback(() => {
    if (!user?.id) {
      if (window.showToast) window.showToast('Please log in first', 'error');
      return;
    }
    setStartTime(Date.now());
    setFollowerCoords([]);
    lastCoordRef.current = null;
    stopWatchRef.current = watchPosition(
      (coord) => {
        if (lastCoordRef.current) setCurrentSpeed(calcSpeed(lastCoordRef.current, coord));
        lastCoordRef.current = coord;
        setCurrentPosition(coord);
        setFollowerCoords((prev) => [...prev, coord]);
      },
      (err) => {
        console.error('GPS Error:', err);
        if (window.showToast) window.showToast('GPS error: ' + err.message, 'error');
      },
      3000,
    );
    setFollowerActive(true);
    setFollowerPaused(false);
    if (window.showToast) window.showToast('🟢 Following recorded path!', 'success');
  }, [user?.id]);

  // ── Follower: Join ───────────────────────────────────────
  const handleJoinTracking = useCallback(async () => {
    if (!user?.id) {
      if (window.showToast) window.showToast('Please log in first', 'error');
      return;
    }
    try {
      const result = await joinTracking(pathId, user?.id);
      if (result.success) {
        setTrackingStatus(result.pathStatus || 'recording');
        // Pre-load publisher's existing path
        if (result.publisherCoordinates?.length > 0) {
          setPublisherCoords(result.publisherCoordinates);
        }
        setStartTime(Date.now());
        setFollowerCoords([]);
        lastCoordRef.current = null;
        stopWatchRef.current = startGpsWatch('follower');
        setFollowerActive(true);
        setFollowerPaused(false);
        if (window.showToast) window.showToast('🟢 Now following path!', 'success');
      }
    } catch (err) {
      console.error('Error joining tracking:', err);
      if (window.showToast)
        window.showToast(err.message || 'Failed to join tracking', 'error');
    }
  }, [pathId, user?.id, startGpsWatch]);

  // ── Follower: Leave ──────────────────────────────────────
  const handleLeaveTracking = useCallback(async () => {
    if (!user?.id) {
      if (window.showToast) window.showToast('Please log in first', 'error');
      return;
    }
    try {
      // Leave the tracking session via WebSocket
      await leaveTracking(pathId, user?.id);
      
      // Unfollow the path via API
      await apiClient.post(`/paths/${pathId}/unfollow`);
      
      stopWatching();
      setCurrentSpeed(0);
      setFollowerActive(false);
      setFollowerPaused(false);
      setFollowerPausePoints([]);
      clearInterval(timerRef.current);
      if (window.showToast) window.showToast('✓ Session terminated', 'success');
      
      // Navigate back to dashboard
      navigate('/');
    } catch (err) {
      console.error('Error leaving tracking:', err);
      if (window.showToast) window.showToast('Error stopping follow: ' + err.message, 'error');
    }
  }, [pathId, user?.id, navigate]);

  // ── Follower: Pause own trip ────────────────────────────
  const handlePauseFollower = useCallback(() => {
    stopWatching();
    setFollowerPaused(true);
    setCurrentSpeed(0);
    if (lastCoordRef.current) {
      setFollowerPausePoints((prev) => [...prev, lastCoordRef.current]);
    }
    if (window.showToast) window.showToast('⏸️ Trip paused', 'warning');
  }, []);

  // ── Follower: Resume own trip ────────────────────────────
  const handleResumeFollower = useCallback(() => {
    setFollowerPaused(false);
    if (trackingStatus === 'ended') {
      stopWatchRef.current = watchPosition(
        (coord) => {
          if (lastCoordRef.current) setCurrentSpeed(calcSpeed(lastCoordRef.current, coord));
          lastCoordRef.current = coord;
          setCurrentPosition(coord);
          setFollowerCoords((prev) => [...prev, coord]);
        },
        (err) => {
          if (window.showToast) window.showToast('GPS error: ' + err.message, 'error');
        },
        3000,
      );
    } else {
      stopWatchRef.current = startGpsWatch('follower');
    }
    if (window.showToast) window.showToast('▶️ Trip resumed', 'success');
  }, [trackingStatus, startGpsWatch]);

  // ── Follower: Terminate session (no unfollow) ────────────
  const handleTerminateSession = useCallback(async () => {
    stopWatching();
    setCurrentSpeed(0);
    setFollowerActive(false);
    setFollowerPaused(false);
    clearInterval(timerRef.current);
    setSessionTerminated(true);
    try {
      await leaveTracking(pathId, user?.id);
    } catch (_) {}
    if (window.showToast) window.showToast('✓ Trip saved', 'success');
  }, [pathId, user?.id]);

  // ── Cleanup on unmount ───────────────────────────────────
  useEffect(() => {
    return () => {
      stopWatching();
      clearInterval(timerRef.current);
    };
  }, []);

  // ── Derived stats ────────────────────────────────────────
  const publisherDistance = calculateTotalDistance(publisherCoords);
  const followerDistance = calculateTotalDistance(followerCoords);
  const myDistance = isPublisher ? publisherDistance : followerDistance;
  const myCoords = isPublisher ? publisherCoords : followerCoords;
  const isTracking = isPublisher || (isFollower && followerCoords.length > 0);

  // ── Direction info for followers ────────────────────────
  // Computes bearing + distance to the next waypoint on the publisher's path.
  const directionInfo = useMemo(() => {
    if (!isFollower || isPublisher) return null;       // only for followers
    if (publisherCoords.length < 2) return null;       // need a path to follow
    if (!currentPosition) return null;                 // need our own GPS fix
    if (followerCoords.length === 0) return null;      // only while actively following

    // Find the closest publisher waypoint to the follower's current position
    let minDist = Infinity;
    let closestIdx = 0;
    for (let i = 0; i < publisherCoords.length; i++) {
      const d = haversineMeters(currentPosition, publisherCoords[i]);
      if (d < minDist) {
        minDist = d;
        closestIdx = i;
      }
    }

    const progressPct =
      Math.round((closestIdx / (publisherCoords.length - 1)) * 100);

    // Look 5 waypoints ahead from the closest one
    const LOOK_AHEAD = 5;
    const targetIdx = Math.min(
      closestIdx + LOOK_AHEAD,
      publisherCoords.length - 1,
    );

    if (targetIdx === closestIdx) {
      // Follower has reached (or passed) the end of the path
      return { completed: true, progressPct: 100 };
    }

    const target = publisherCoords[targetIdx];
    const bearing = getBearing(currentPosition, target);
    const distanceToTarget = haversineMeters(currentPosition, target);

    return { completed: false, bearing, distanceToTarget, progressPct };
  }, [isFollower, isPublisher, publisherCoords, currentPosition, followerCoords.length]);

  // ── Loading state ────────────────────────────────────────
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="live-tracking-page">
          <div className="tracking-loading">
            <div className="spinner" />
            <p>Loading path data...</p>
          </div>
        </div>
      </>
    );
  }

  // ── Error state ──────────────────────────────────────────
  if (error || !path) {
    return (
      <div className="live-tracking-shell">
        <Navbar />
        <div className="live-tracking-page">
          <div className="tracking-error">
            <h2>⚠️ {error || 'Path not found'}</h2>
            <button className="btn-back" onClick={() => navigate('/')}>
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────
  return (
    <div className="live-tracking-shell">
      <Navbar />
      <div className="live-tracking-page">
        {/* ── Header ── */}
        <div className="tracking-header">
          <button className="btn-back" onClick={() => navigate('/')}>
            ← Back
          </button>
          <div className="tracking-title-section">
            <h1 className="tracking-title">{path.title}</h1>
            <div className="tracking-meta">
              <span className="meta-publisher">
                By {path.publisher?.name || 'Unknown'}
              </span>
              <span className="meta-separator">•</span>
              {(() => {
                // Follower: show their own trip status
                if (isFollower && !isPublisher) {
                  if (sessionTerminated) return <span className="meta-status status-ended">🏁 Trip Ended</span>;
                  if (followerActive && !followerPaused) return <span className="meta-status status-recording"><span className="lt-status-dot lt-dot-live" />Following</span>;
                  if (followerActive && followerPaused) return <span className="meta-status status-paused"><span className="lt-status-dot lt-dot-paused" />Paused</span>;
                }
                // Publisher or follower not yet started: show publisher path status
                return (
                  <span className={`meta-status status-${trackingStatus}`}>
                    {trackingStatus === 'idle' && <span className="lt-status-dot lt-dot-idle" />}
                    {trackingStatus === 'recording' && <span className="lt-status-dot lt-dot-live" />}
                    {trackingStatus === 'paused' && <span className="lt-status-dot lt-dot-paused" />}
                    {trackingStatus === 'idle' && 'Not Started'}
                    {trackingStatus === 'recording' && 'Live'}
                    {trackingStatus === 'paused' && 'Paused'}
                    {trackingStatus === 'ended' && '🏁 Ended'}
                  </span>
                );
              })()}
              {followersCount > 0 && (
                <>
                  <span className="meta-separator">•</span>
                  <span className="meta-followers">
                    👥 {followersCount} watching
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="tracking-content">
          {/* Map */}
          <div className="tracking-map-wrapper">
            <MapView
              publisherCoordinates={publisherCoords}
              followerCoordinates={followerCoords}
              currentPosition={currentPosition}
              role={isPublisher ? 'publisher' : 'follower'}
              autoFollow={autoFollow}
              recenterTrigger={recenterTrigger}
              pathStatus={trackingStatus}
              publisherName={path.publisher?.name || 'Publisher'}
              followerName={user?.name || 'You'}
              directionInfo={directionInfo}
              pausePoints={pausePoints}
              followerPausePoints={followerPausePoints}
              deviceHeading={deviceHeading}
              needsCompassPerm={needsCompassPerm}
              onEnableCompass={handleEnableCompass}
              onRecenter={handleRecenter}
            />
            <button
              className="btn-auto-follow active"
              onClick={() => { setAutoFollow(true); setRecenterTrigger((v) => v + 1); }}
              title="Center on my location"
            >
              🎯
            </button>
          </div>

          {/* Sidebar */}
          <div className="tracking-sidebar">
            {/* Mobile-only legend (hidden on desktop via CSS) */}
            <div className="sidebar-legend">
              <div className="legend-item">
                <span className="legend-line legend-publisher" />
                <span>{path.publisher?.name || 'Publisher'}'s Path</span>
              </div>
              {followerCoords.length > 0 && (
                <div className="legend-item">
                  <span className="legend-line legend-follower" />
                  <span>{isFollower ? 'Your Path' : `${user?.name || 'Follower'}'s Path`}</span>
                </div>
              )}
              <div className="legend-item">
                <span className="legend-dot" style={{ background: '#fbbf24', border: '1px solid white' }} />
                <span>Publisher Start</span>
              </div>
              {publisherCoords.length > 1 && trackingStatus === 'ended' && (
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: '#3b82f6' }} />
                  <span>Publisher End</span>
                </div>
              )}
              {followerCoords.length > 0 && (
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: '#4ade80' }} />
                  <span>Follower Start</span>
                </div>
              )}
              {publisherCoords.length > 11 && (
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: '#f97316' }} />
                  <span>Publisher Waypoint</span>
                </div>
              )}
              {followerCoords.length > 11 && (
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: '#2dd4bf' }} />
                  <span>Follower Waypoint</span>
                </div>
              )}
              {pausePoints.length > 0 && (
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: '#a855f7' }} />
                  <span>Publisher Paused</span>
                </div>
              )}
              {followerPausePoints.length > 0 && (
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: '#f472b6' }} />
                  <span>Follower Paused</span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📏</div>
                <div className="stat-value">{formatDistance(myDistance)}</div>
                <div className="stat-label">Distance</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⏱️</div>
                <div className="stat-value">
                  {elapsedTime ? formatDuration(elapsedTime) : '--'}
                </div>
                <div className="stat-label">Duration</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⚡</div>
                <div className="stat-value">
                  {((isPublisher && trackingStatus === 'recording') ||
                    (!isPublisher && followerActive && !followerPaused))
                    ? `${currentSpeed} km/h`
                    : '--'}
                </div>
                <div className="stat-label">Speed</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📍</div>
                <div className="stat-value">{myCoords.length}</div>
                <div className="stat-label">GPS Points</div>
              </div>
            </div>

            {/* Distance Comparison (follower who has joined tracking) */}
            {isFollower &&
              !isPublisher &&
              publisherCoords.length > 0 &&
              followerCoords.length > 0 && (
                <div className="distance-comparison">
                  <h3>📊 Path Comparison</h3>
                  <div className="comparison-row">
                    <span className="comp-label">🔴 Publisher</span>
                    <span className="comp-value pub-color">
                      {formatDistance(publisherDistance)}
                    </span>
                  </div>
                  <div className="comparison-row">
                    <span className="comp-label">🟢 Your path</span>
                    <span className="comp-value follow-color">
                      {formatDistance(followerDistance)}
                    </span>
                  </div>
                  <div className="comparison-row">
                    <span className="comp-label">Δ Difference</span>
                    <span className="comp-value">
                      {formatDistance(
                        Math.abs(publisherDistance - followerDistance)
                      )}
                    </span>
                  </div>
                </div>
              )}

            {/* Location display */}
            {currentPosition && (
              <div className="gps-display">
                <div className="gps-row">
                  <span className="gps-label">📡 GPS</span>
                  <span className="gps-val">
                    {currentPosition.lat.toFixed(5)},{' '}
                    {currentPosition.lng.toFixed(5)}
                  </span>
                </div>
                {currentPosition.accuracy && (
                  <div className="gps-row">
                    <span className="gps-label">Accuracy</span>
                    <span className="gps-val">
                      ±{Math.round(currentPosition.accuracy)} m
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ── Controls ── */}
            <div className="tracking-controls">
              {/* Publisher controls */}
              {isPublisher && (
                <>
                  {trackingStatus === 'idle' && (
                    <button
                      className="btn-control btn-start"
                      onClick={handleStartTracking}
                      disabled={isStarting}
                      style={isStarting ? { opacity: 0.7, cursor: 'not-allowed' } : undefined}
                    >
                      <span className="btn-icon">{isStarting ? '⏳' : '▶️'}</span>
                      <span>{isStarting ? 'Starting…' : 'Start Publishing Path'}</span>
                    </button>
                  )}

                  {trackingStatus === 'recording' && (
                    <div className="control-group">
                      <button
                        className="btn-control btn-pause"
                        onClick={handlePauseTracking}
                      >
                        <span className="btn-icon">⏸️</span>
                        <span>Pause</span>
                      </button>
                      <button
                        className="btn-control btn-end"
                        onClick={handleEndTracking}
                      >
                        <span className="btn-icon">⏹️</span>
                        <span>End</span>
                      </button>
                    </div>
                  )}

                  {trackingStatus === 'paused' && (
                    <div className="control-group">
                      <button
                        className="btn-control btn-resume"
                        onClick={handleResumeTracking}
                      >
                        <span className="btn-icon">▶️</span>
                        <span>Resume</span>
                      </button>
                      <button
                        className="btn-control btn-end"
                        onClick={handleEndTracking}
                      >
                        <span className="btn-icon">⏹️</span>
                        <span>End</span>
                      </button>
                    </div>
                  )}

                  {trackingStatus === 'ended' && (
                    <div className="tracking-ended-info">
                      <div className="ended-icon">🏁</div>
                      <p>Tracking session ended</p>
                      <p className="ended-stats">
                        Total: {formatDistance(publisherDistance)}
                        {elapsedTime ? ` in ${formatDuration(elapsedTime)}` : ''}
                      </p>
                      <button
                        className="btn-control btn-republish"
                        onClick={handleRepublishTrack}
                        disabled={isRepublishing}
                      >
                        <span className="btn-icon">{isRepublishing ? '⏳' : '🔄'}</span>
                        <span>{isRepublishing ? 'Republishing…' : 'Republish Track'}</span>
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Follower controls */}
              {isFollower && !isPublisher && (
                <>
                  {/* ── Session terminated: show path summary + Go Home ── */}
                  {sessionTerminated ? (
                    <div className="session-terminated-summary">
                      <div className="terminated-icon">🏁</div>
                      <p className="terminated-title">Trip Complete</p>
                      <p className="terminated-sub">Your path is shown on the map</p>
                      <div className="terminated-stats">
                        <div className="terminated-stat">
                          <span className="tstat-label">Distance</span>
                          <span className="tstat-value">
                            {formatDistance(calculateTotalDistance(followerCoords))}
                          </span>
                        </div>
                        <div className="terminated-stat">
                          <span className="tstat-label">Duration</span>
                          <span className="tstat-value">
                            {elapsedTime ? formatDuration(elapsedTime) : '--'}
                          </span>
                        </div>
                        <div className="terminated-stat">
                          <span className="tstat-label">GPS Points</span>
                          <span className="tstat-value">{followerCoords.length}</span>
                        </div>
                      </div>
                      <div className="terminated-actions">
                        <button
                          className="btn-control btn-go-home"
                          onClick={() => navigate('/')}
                        >
                          <span className="btn-icon">🏠</span>
                          <span>Go Home</span>
                        </button>
                        <button
                          className="btn-control btn-refollow"
                          onClick={() => navigate(0)}
                        >
                          <span className="btn-icon">🔄</span>
                          <span>Re-follow Trip</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {(trackingStatus === 'recording' ||
                        trackingStatus === 'paused') && (
                        <div className="control-group">
                          {followerCoords.length === 0 ? (
                            <button
                              className="btn-control btn-follow"
                              onClick={handleJoinTracking}
                            >
                              <span className="btn-icon">🟢</span>
                              <span>Start Following Path</span>
                            </button>
                          ) : (
                            <>
                              {!followerPaused ? (
                                <button
                                  className="btn-control btn-pause"
                                  onClick={handlePauseFollower}
                                >
                                  <span className="btn-icon">⏸️</span>
                                  <span>Pause Trip</span>
                                </button>
                              ) : (
                                <button
                                  className="btn-control btn-resume"
                                  onClick={handleResumeFollower}
                                >
                                  <span className="btn-icon">▶️</span>
                                  <span>Resume Trip</span>
                                </button>
                              )}
                              <button
                                className="btn-control btn-end"
                                onClick={handleTerminateSession}
                              >
                                <span className="btn-icon">🛑</span>
                                <span>Terminate Session</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {trackingStatus === 'idle' && (
                        <div className="tracking-waiting">
                          <div className="waiting-icon">⏳</div>
                          <p>Waiting for publisher to start...</p>
                        </div>
                      )}

                      {trackingStatus === 'ended' && (
                        <div className="tracking-ended-follower">
                          <div className="ended-icon">🏁</div>
                          <p>Publisher completed this path</p>
                          <p className="ended-note">The recorded route is still available — you can walk it!</p>
                          {followerCoords.length === 0 ? (
                            <button
                              className="btn-control btn-follow"
                              onClick={handleFollowEndedPath}
                            >
                              <span className="btn-icon">🟢</span>
                              <span>Follow Recorded Path</span>
                            </button>
                          ) : (
                            <div className="control-group">
                              {!followerPaused ? (
                                <button
                                  className="btn-control btn-pause"
                                  onClick={handlePauseFollower}
                                >
                                  <span className="btn-icon">⏸️</span>
                                  <span>Pause Trip</span>
                                </button>
                              ) : (
                                <button
                                  className="btn-control btn-resume"
                                  onClick={handleResumeFollower}
                                >
                                  <span className="btn-icon">▶️</span>
                                  <span>Resume Trip</span>
                                </button>
                              )}
                              <button
                                className="btn-control btn-end"
                                onClick={handleTerminateSession}
                              >
                                <span className="btn-icon">🛑</span>
                                <span>Terminate Session</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Neither publisher nor follower */}
              {!isPublisher && !isFollower && (
                <div className="tracking-no-access">
                  <div className="no-access-icon">🔒</div>
                  <p>Follow this path to join live tracking</p>
                  <button
                    className="btn-control btn-back-dash"
                    onClick={() => navigate('/')}
                  >
                    Go to Dashboard
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
