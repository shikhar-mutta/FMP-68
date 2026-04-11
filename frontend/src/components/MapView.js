import React, { useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  Circle,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ── Custom marker factory ────────────────────────────────
const createDotIcon = (color, size = 20, glow = false) =>
  L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px; height:${size}px;
      background:${color};
      border:3px solid white;
      border-radius:50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4)${glow ? `,0 0 0 4px ${color}55` : ''};
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

const publisherCurrentIcon = createDotIcon('#ef4444', 22, true);
const followerCurrentIcon  = createDotIcon('#22c55e', 22, true);
const startIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:14px; height:14px;
    background:#fbbf24;
    border:2.5px solid white;
    border-radius:50%;
    box-shadow: 0 1px 6px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// ── Auto-pan to latest position ──────────────────────────
function MapAutoCenter({ position, follow }) {
  const map = useMap();
  useEffect(() => {
    if (position && follow) {
      map.setView([position.lat, position.lng], Math.max(map.getZoom(), 15), {
        animate: true,
        duration: 0.5,
      });
    }
  }, [position, follow, map]);
  return null;
}

// ── Fit bounds once on initial load ─────────────────────
function FitBounds({ coordinates }) {
  const map = useMap();
  const hasFit = useRef(false);

  useEffect(() => {
    if (coordinates.length > 1 && !hasFit.current) {
      const bounds = L.latLngBounds(coordinates.map((c) => [c.lat, c.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
      hasFit.current = true;
    }
  }, [coordinates, map]);

  return null;
}

// ── Direction Banner ─────────────────────────────────────
const COMPASS_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function DirectionBanner({ directionInfo }) {
  if (!directionInfo) return null;

  if (directionInfo.completed) {
    return (
      <div className="direction-banner direction-banner--complete">
        <span className="dir-icon">🏆</span>
        <div className="dir-text">
          <span className="dir-label">Route Complete!</span>
          <span className="dir-sub">You've followed the entire path</span>
        </div>
        <div className="dir-progress-wrap">
          <div className="dir-progress-bar" style={{ width: '100%' }} />
        </div>
      </div>
    );
  }

  const { bearing, distanceToTarget, progressPct } = directionInfo;
  const compassIdx = Math.round(bearing / 45) % 8;
  const compassLabel = COMPASS_LABELS[compassIdx];
  const distText =
    distanceToTarget < 1000
      ? `${Math.round(distanceToTarget)} m`
      : `${(distanceToTarget / 1000).toFixed(1)} km`;

  return (
    <div className="direction-banner">
      <div
        className="dir-arrow-wrap"
        title={`Bearing: ${Math.round(bearing)}°`}
      >
        <div
          className="dir-arrow"
          style={{ transform: `rotate(${bearing}deg)` }}
        >
          ↑
        </div>
      </div>

      <div className="dir-text">
        <span className="dir-label">
          Head <strong>{compassLabel}</strong>
          <span className="dir-degrees">&nbsp;{Math.round(bearing)}°</span>
        </span>
        <span className="dir-sub">{distText} to next waypoint</span>
      </div>

      <div className="dir-progress-section">
        <span className="dir-pct">{progressPct}%</span>
        <div className="dir-progress-wrap">
          <div
            className="dir-progress-bar"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── MapView ──────────────────────────────────────────────
const MapView = ({
  publisherCoordinates = [],
  followerCoordinates = [],
  currentPosition = null,
  role = 'publisher',
  autoFollow = true,
  pathStatus = 'idle',
  publisherName = 'Publisher',
  followerName = 'You',
  directionInfo = null,
}) => {
  const defaultCenter = currentPosition
    ? [currentPosition.lat, currentPosition.lng]
    : [20.5937, 78.9629]; // India

  const defaultZoom = currentPosition ? 16 : 5;

  const publisherPath = publisherCoordinates.map((c) => [c.lat, c.lng]);
  const followerPath = followerCoordinates.map((c) => [c.lat, c.lng]);

  const publisherLatest =
    publisherCoordinates.length > 0
      ? publisherCoordinates[publisherCoordinates.length - 1]
      : null;
  const followerLatest =
    followerCoordinates.length > 0
      ? followerCoordinates[followerCoordinates.length - 1]
      : null;

  const followPosition =
    role === 'publisher'
      ? publisherLatest
      : followerLatest || currentPosition;

  const isLive = pathStatus === 'recording';

  return (
    <div className="map-container" id="map-view">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%', borderRadius: '16px' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapAutoCenter position={followPosition} follow={autoFollow} />

        {/* Fit to publisher path on first load */}
        {publisherCoordinates.length > 1 && (
          <FitBounds coordinates={publisherCoordinates} />
        )}

        {/* ── Publisher path — RED ────────────────────── */}
        {publisherPath.length > 1 && (
          <Polyline
            positions={publisherPath}
            pathOptions={{
              color: '#ef4444',
              weight: 5,
              opacity: 0.9,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {/* ── Follower path — GREEN ───────────────────── */}
        {followerPath.length > 1 && (
          <Polyline
            positions={followerPath}
            pathOptions={{
              color: '#22c55e',
              weight: 5,
              opacity: 0.9,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {/* ── Start marker (yellow dot) ───────────────── */}
        {publisherCoordinates.length > 0 && (
          <Marker
            position={[
              publisherCoordinates[0].lat,
              publisherCoordinates[0].lng,
            ]}
            icon={startIcon}
          >
            <Popup>📍 Start Point</Popup>
          </Marker>
        )}

        {/* ── Publisher live position ─────────────────── */}
        {publisherLatest && (
          <>
            {/* Accuracy / live ring */}
            {isLive && (
              <Circle
                center={[publisherLatest.lat, publisherLatest.lng]}
                radius={15}
                pathOptions={{
                  color: '#ef4444',
                  fillColor: '#ef4444',
                  fillOpacity: 0.12,
                  weight: 2,
                  opacity: 0.5,
                }}
              />
            )}
            <Marker
              position={[publisherLatest.lat, publisherLatest.lng]}
              icon={publisherCurrentIcon}
            >
              <Popup>
                <strong>🔴 {publisherName}</strong>
                <br />
                {pathStatus === 'recording' && '📡 Live tracking'}
                {pathStatus === 'paused' && '⏸️ Paused'}
                {pathStatus === 'ended' && '🏁 Ended'}
              </Popup>
            </Marker>
          </>
        )}

        {/* ── Follower live position ──────────────────── */}
        {followerLatest && (
          <>
            {isLive && (
              <Circle
                center={[followerLatest.lat, followerLatest.lng]}
                radius={15}
                pathOptions={{
                  color: '#22c55e',
                  fillColor: '#22c55e',
                  fillOpacity: 0.12,
                  weight: 2,
                  opacity: 0.5,
                }}
              />
            )}
            <Marker
              position={[followerLatest.lat, followerLatest.lng]}
              icon={followerCurrentIcon}
            >
              <Popup>
                <strong>🟢 {followerName}</strong>
                <br />
                Following path
              </Popup>
            </Marker>
          </>
        )}
      </MapContainer>

      {/* ── Direction Banner (followers only) ──────────────── */}
      <DirectionBanner directionInfo={directionInfo} />

      {/* ── Legend ──────────────────────────────────── */}
      <div className="map-legend">
        <div className="legend-item">
          <span className="legend-line legend-publisher" />
          <span>{publisherName}'s Path</span>
        </div>
        {followerPath.length > 0 && (
          <div className="legend-item">
            <span className="legend-line legend-follower" />
            <span>
              {role === 'follower' ? 'Your Path' : `${followerName}'s Path`}
            </span>
          </div>
        )}
        <div className="legend-item">
          <span className="legend-dot legend-start" />
          <span>Start Point</span>
        </div>
      </div>
    </div>
  );
};

export default MapView;
