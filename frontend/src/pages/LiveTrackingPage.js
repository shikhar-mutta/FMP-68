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
  onLocationUpdate,
  onTrackingStarted,
  onTrackingPaused,
  onTrackingResumed,
  onTrackingEnded,
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

  // For publisher: track which follower's path to display (first one who sends data)
  const trackedFollowerRef = useRef(null);

  // Ref mirror of isPublisher to avoid stale closures in socket handlers
  const isPublisherRef = useRef(false);

  // Stats
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);

  // Refs
  const stopWatchRef = useRef(null);
  const timerRef = useRef(null);
  const cleanupFnsRef = useRef([]);
  const lastCoordRef = useRef(null);

  // ── Fetch path data ──────────────────────────────────────
  useEffect(() => {
    const fetchPath = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get(`/paths/${pathId}`);
        const pathData = res.data;
        setPath(pathData);
        const publisherFlag = pathData.publisherId === user?.id;
        isPublisherRef.current = publisherFlag;
        setIsPublisher(publisherFlag);
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
        if (isPublisherRef.current) {
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

    cleanupFnsRef.current = [
      unsubLocation,
      unsubStarted,
      unsubPaused,
      unsubResumed,
      unsubEnded,
      unsubFollowerJoined,
    ];

    return () => {
      cleanupFnsRef.current.forEach((fn) => fn && fn());
      disconnectSocket();
    };
  }, [pathId]);

  // ── Elapsed-time timer ───────────────────────────────────
  useEffect(() => {
    if (trackingStatus === 'recording' && startTime) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [trackingStatus, startTime]);

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
    if (!user?.id) {
      if (window.showToast) window.showToast('Please log in first', 'error');
      return;
    }
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
    }
  }, [pathId, user?.id, startGpsWatch]);

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
      stopWatching();
      if (window.showToast) window.showToast('⏸️ Tracking paused', 'warning');
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
      if (window.showToast) window.showToast('▶️ Tracking resumed', 'success');
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
      if (window.showToast) window.showToast('🏁 Tracking ended!', 'success');
    } catch (err) {
      console.error('Error ending tracking:', err);
    }
  }, [pathId, user?.id]);

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
        if (window.showToast) window.showToast('🟢 Now following path!', 'success');
      }
    } catch (err) {
      console.error('Error joining tracking:', err);
      if (window.showToast) window.showToast('Failed to join tracking', 'error');
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
      clearInterval(timerRef.current);
      if (window.showToast) window.showToast('✓ Stopped following path', 'success');
      
      // Navigate back to dashboard
      navigate('/');
    } catch (err) {
      console.error('Error leaving tracking:', err);
      if (window.showToast) window.showToast('Error stopping follow: ' + err.message, 'error');
    }
  }, [pathId, user?.id, navigate]);

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
      <>
        <Navbar />
        <div className="live-tracking-page">
          <div className="tracking-error">
            <h2>⚠️ {error || 'Path not found'}</h2>
            <button className="btn-back" onClick={() => navigate('/')}>
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── Main render ──────────────────────────────────────────
  return (
    <>
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
              <span className={`meta-status status-${trackingStatus}`}>
                {trackingStatus === 'idle' && (
                  <span className="lt-status-dot lt-dot-idle" />
                )}
                {trackingStatus === 'recording' && (
                  <span className="lt-status-dot lt-dot-live" />
                )}
                {trackingStatus === 'paused' && (
                  <span className="lt-status-dot lt-dot-paused" />
                )}
                {trackingStatus === 'idle' && 'Not Started'}
                {trackingStatus === 'recording' && 'Live'}
                {trackingStatus === 'paused' && 'Paused'}
                {trackingStatus === 'ended' && '🏁 Ended'}
              </span>
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
              pathStatus={trackingStatus}
              publisherName={path.publisher?.name || 'Publisher'}
              followerName={user?.name || 'You'}
              directionInfo={directionInfo}
            />
            <button
              className={`btn-auto-follow ${autoFollow ? 'active' : ''}`}
              onClick={() => setAutoFollow((v) => !v)}
              title={autoFollow ? 'Disable auto-center' : 'Enable auto-center'}
            >
              🎯
            </button>
          </div>

          {/* Sidebar */}
          <div className="tracking-sidebar">
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
                  {isTracking && trackingStatus === 'recording'
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
                    >
                      <span className="btn-icon">▶️</span>
                      <span>Start Publishing Path</span>
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
                    </div>
                  )}
                </>
              )}

              {/* Follower controls */}
              {isFollower && !isPublisher && (
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
                        <button
                          className="btn-control btn-leave"
                          onClick={handleLeaveTracking}
                        >
                          <span className="btn-icon">🚪</span>
                          <span>Leave Tracking</span>
                        </button>
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
                          style={{ marginTop: '12px' }}
                          onClick={handleJoinTracking}
                        >
                          <span className="btn-icon">🟢</span>
                          <span>Follow Recorded Path</span>
                        </button>
                      ) : (
                        <>
                          <p className="ended-stats">
                            You covered: {formatDistance(followerDistance)}
                          </p>
                          <button
                            className="btn-control btn-leave"
                            style={{ marginTop: '12px' }}
                            onClick={handleLeaveTracking}
                          >
                            <span className="btn-icon">🚪</span>
                            <span>Stop Following</span>
                          </button>
                        </>
                      )}
                    </div>
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
    </>
  );
}
