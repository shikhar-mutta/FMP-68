import React, { useEffect, useRef, useMemo } from 'react';
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

const publisherCurrentIcon = L.divIcon({ className: '', html: `<div style="width:16px;height:16px;background:#f59e0b;border:3px solid #ef4444;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });
const followerCurrentIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:22px; height:22px;
    background:#22c55e;
    border:3px solid #22c55e;
    border-radius:50%;
    box-shadow: 0 2px 10px rgba(0,0,0,0.45), 0 0 0 5px #22c55e33;
  "></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});
const publisherStartIcon = L.divIcon({
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
const followerStartIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:14px; height:14px;
    background:#4ade80;
    border:2.5px solid white;
    border-radius:50%;
    box-shadow: 0 1px 6px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});
const publisherIntermediateIcon = createDotIcon('#f97316', 10);  // orange
const followerIntermediateIcon  = createDotIcon('#2dd4bf', 10);  // teal
const publisherPauseIcon = createDotIcon('#a855f7', 13);          // purple
const followerPauseIcon  = createDotIcon('#f472b6', 13);          // pink
const publisherEndIcon = createDotIcon('#3b82f6', 14);            // blue
const followerEndIcon  = createDotIcon('#cc6600', 14);            // dark amber

// ── Invalidate Leaflet size when container resizes ───────
function MapInvalidateSize({ trigger }) {
  const map = useMap();
  useEffect(() => {
    // Wait one frame so the CSS flex layout settles before telling Leaflet
    const id = requestAnimationFrame(() => {
      map.invalidateSize({ animate: false });
    });
    return () => cancelAnimationFrame(id);
  }, [trigger, map]);
  return null;
}

// ── Auto-pan to latest position ──────────────────────────
function MapAutoCenter({ position, follow }) {
  const map = useMap();
  useEffect(() => {
    if (position && follow) {
      map.setView([position.lat, position.lng], Math.max(map.getZoom(), 16), {
        animate: true,
        duration: 0.5,
      });
    }
  }, [position, follow, map]);
  return null;
}

// ── One-shot recenter on button press ────────────────────
function MapRecenter({ position, trigger }) {
  const map = useMap();
  const lastTrigger = useRef(0);
  useEffect(() => {
    if (trigger > lastTrigger.current && position) {
      lastTrigger.current = trigger;
      map.setView([position.lat, position.lng], Math.max(map.getZoom(), 16), {
        animate: true,
        duration: 0.6,
      });
    }
  }, [trigger, position, map]);
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

// ── Compass Widget ───────────────────────────────────────
function CompassWidget({ heading, needsPerm, onEnable, onRecenter }) {
  // heading: degrees clockwise from North (null = unavailable)
  // Rotate compass body by -heading so N always points to real-world North
  const rotation = heading != null ? -heading : 0;
  const handleClick = () => {
    if (needsPerm) onEnable?.();
    else onRecenter?.();
  };
  return (
    <div
      className={`compass-widget${needsPerm ? ' compass-perm' : ''}`}
      onClick={handleClick}
      title={needsPerm ? 'Tap to enable compass' : 'Tap to re-center on your location'}
    >
      <div className="compass-body" style={{ transform: `rotate(${rotation}deg)` }}>
        <span className="compass-n">N</span>
        <div className="compass-needle">
          <div className="needle-north" />
          <div className="needle-south" />
        </div>
        <span className="compass-s">S</span>
      </div>
      {needsPerm && <span className="compass-perm-hint">tap</span>}
    </div>
  );
}

// ── Direction Banner ─────────────────────────────────────
const COMPASS_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function DirectionBanner({ directionInfo, deviceHeading }) {
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

  // Arrow points in the direction to walk, relative to where device is facing.
  // When deviceHeading is null (no sensor), fall back to absolute North-up bearing.
  const arrowAngle =
    deviceHeading != null ? (bearing - deviceHeading + 360) % 360 : bearing;

  return (
    <div className="direction-banner">
      <div
        className="dir-arrow-wrap"
        title={`Bearing: ${Math.round(bearing)}°`}
      >
        <div
          className="dir-arrow"
          style={{ transform: `rotate(${arrowAngle}deg)` }}
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
  recenterTrigger = 0,
  pathStatus = 'idle',
  publisherName = 'Publisher',
  followerName = 'You',
  directionInfo = null,
  pausePoints = [],
  followerPausePoints = [],
  deviceHeading = null,
  needsCompassPerm = false,
  onEnableCompass = null,
  onRecenter = null,
  invalidateSizeTrigger = false,
}) => {
  // Direction beam icon: SVG cone pointing toward deviceHeading, apex at current position
  const beamIcon = useMemo(() => {
    if (deviceHeading == null) return null;
    // Path: apex at (0,0), base at y=-60 (upward in SVG = North on map), rotated by heading
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" style="overflow:visible"><path d="M0,0 L-14,-62 L14,-62 Z" fill="rgba(34,197,94,0.2)" stroke="rgba(34,197,94,0.3)" stroke-width="0.5" transform="rotate(${deviceHeading},0,0)"/></svg>`;
    return L.divIcon({ className: '', html: svg, iconSize: [1, 1], iconAnchor: [0, 0] });
  }, [deviceHeading]);

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

        <MapInvalidateSize trigger={invalidateSizeTrigger} />
        <MapAutoCenter position={followPosition} follow={autoFollow} />
        <MapRecenter position={followPosition || currentPosition} trigger={recenterTrigger} />

        {/* ── Direction beam — rendered first so it's behind all dots ── */}
        {currentPosition && beamIcon && (
          <Marker
            position={[currentPosition.lat, currentPosition.lng]}
            icon={beamIcon}
            interactive={false}
            zIndexOffset={-500}
          />
        )}

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

        {/* ── Publisher: start dot (yellow) ───────────── */}
        {publisherCoordinates.length > 0 && (
          <Marker
            position={[publisherCoordinates[0].lat, publisherCoordinates[0].lng]}
            icon={publisherStartIcon}
          >
            <Popup>📍 Publisher Start</Popup>
          </Marker>
        )}

        {/* ── Publisher: end dot (blue) — only when ended ─ */}
        {publisherCoordinates.length > 1 && pathStatus === 'ended' && (
          <Marker
            position={[
              publisherCoordinates[publisherCoordinates.length - 1].lat,
              publisherCoordinates[publisherCoordinates.length - 1].lng,
            ]}
            icon={publisherEndIcon}
          >
            <Popup>🏁 End Point</Popup>
          </Marker>
        )}

        {/* ── Publisher: intermediate dots (orange) ────── */}
        {publisherCoordinates.length > 11 &&
          publisherCoordinates
            .slice(1, -1)
            .filter((_, i) => (i + 1) % 10 === 0)
            .map((coord, i) => (
              <Marker key={`pub-wp-${i}`} position={[coord.lat, coord.lng]} icon={publisherIntermediateIcon}>
                <Popup>🟠 Publisher Waypoint</Popup>
              </Marker>
            ))}

        {/* ── Publisher: pause dots (purple) ───────────── */}
        {pausePoints.map((coord, i) => (
          <Marker key={`pub-pause-${i}`} position={[coord.lat, coord.lng]} icon={publisherPauseIcon}>
            <Popup>⏸️ Publisher paused here</Popup>
          </Marker>
        ))}

        {/* ── Follower: start dot (light green) ────────── */}
        {followerCoordinates.length > 0 && (
          <Marker
            position={[followerCoordinates[0].lat, followerCoordinates[0].lng]}
            icon={followerStartIcon}
          >
            <Popup>📍 Follower Start</Popup>
          </Marker>
        )}

        {/* ── Follower: end dot (dark amber) — only when follower path exists ─ */}
        {followerCoordinates.length > 1 && pathStatus === 'ended' && (
          <Marker
            position={[
              followerCoordinates[followerCoordinates.length - 1].lat,
              followerCoordinates[followerCoordinates.length - 1].lng,
            ]}
            icon={followerEndIcon}
          >
            <Popup>🏁 Follower End Point</Popup>
          </Marker>
        )}

        {/* ── Follower: intermediate dots (teal) ───────── */}
        {followerCoordinates.length > 11 &&
          followerCoordinates
            .slice(1, -1)
            .filter((_, i) => (i + 1) % 10 === 0)
            .map((coord, i) => (
              <Marker key={`fol-wp-${i}`} position={[coord.lat, coord.lng]} icon={followerIntermediateIcon}>
                <Popup>🩵 Follower Waypoint</Popup>
              </Marker>
            ))}

        {/* ── Follower: pause dots (pink) ──────────────── */}
        {followerPausePoints.map((coord, i) => (
          <Marker key={`fol-pause-${i}`} position={[coord.lat, coord.lng]} icon={followerPauseIcon}>
            <Popup>⏸️ Follower paused here</Popup>
          </Marker>
        ))}

        {/* ── "You are here" green dot — before tracking starts ── */}
        {currentPosition && !followerLatest && (
          <>
            {currentPosition.accuracy && (
              <Circle
                center={[currentPosition.lat, currentPosition.lng]}
                radius={currentPosition.accuracy}
                pathOptions={{
                  color: '#22c55e',
                  fillColor: '#22c55e',
                  fillOpacity: 0.08,
                  weight: 1,
                  opacity: 0.4,
                }}
              />
            )}
            <Marker
              position={[currentPosition.lat, currentPosition.lng]}
              icon={followerCurrentIcon}
            >
              <Popup>📍 Your Location</Popup>
            </Marker>
          </>
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

      {/* ── Compass Widget ─────────────────────────────────── */}
      <CompassWidget heading={deviceHeading} needsPerm={needsCompassPerm} onEnable={onEnableCompass} onRecenter={onRecenter} />

      {/* ── Direction Banner (followers only) ──────────────── */}
      <DirectionBanner directionInfo={directionInfo} deviceHeading={deviceHeading} />

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
          <span>Publisher Start</span>
        </div>
        {publisherCoordinates.length > 1 && pathStatus === 'ended' && (
          <div className="legend-item">
            <span className="legend-dot" style={{ background: '#3b82f6' }} />
            <span>Publisher End</span>
          </div>
        )}
        {followerCoordinates.length > 0 && (
          <div className="legend-item">
            <span className="legend-dot" style={{ background: '#4ade80' }} />
            <span>Follower Start</span>
          </div>
        )}
        {publisherCoordinates.length > 11 && (
          <div className="legend-item">
            <span className="legend-dot" style={{ background: '#f97316' }} />
            <span>Publisher Waypoint</span>
          </div>
        )}
        {followerCoordinates.length > 11 && (
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
    </div>
  );
};

export default MapView;
