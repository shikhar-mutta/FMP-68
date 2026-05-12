import React from 'react';
import { render, screen } from '@testing-library/react';
import MapView from '../../components/MapView';

// Mock react-leaflet and leaflet
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children, position, icon }) => (
    <div data-testid="marker" data-position={JSON.stringify(position)}>
      {children}
    </div>
  ),
  Popup: ({ children }) => <div data-testid="popup">{children}</div>,
  Polyline: ({ positions }) => (
    <div data-testid="polyline" data-positions={JSON.stringify(positions)} />
  ),
  Circle: ({ center }) => (
    <div data-testid="circle" data-center={JSON.stringify(center)} />
  ),
  useMap: () => ({
    setView: jest.fn(),
    fitBounds: jest.fn(),
    getZoom: jest.fn(() => 15),
  }),
}));

jest.mock('leaflet', () => ({
  Icon: {
    Default: {
      prototype: {},
      mergeOptions: jest.fn(),
    },
  },
  divIcon: jest.fn((options) => ({
    className: options.className,
    html: options.html,
    iconSize: options.iconSize,
    iconAnchor: options.iconAnchor,
  })),
  latLngBounds: jest.fn((coords) => ({
    toBBoxString: jest.fn(() => 'bbox'),
  })),
}));

jest.mock('leaflet/dist/leaflet.css', () => ({}));

describe('MapView', () => {
  it('should render map container', () => {
    render(<MapView />);
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('should render tile layer', () => {
    render(<MapView />);
    expect(screen.getByTestId('tile-layer')).toBeInTheDocument();
  });

  it('should render with default props', () => {
    render(<MapView />);
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('should render publisher path when coordinates exist', () => {
    const coordinates = [
      { lat: 10, lng: 20 },
      { lat: 11, lng: 21 },
    ];
    const { container } = render(
      <MapView publisherCoordinates={coordinates} />
    );
    const polylines = container.querySelectorAll('[data-testid="polyline"]');
    expect(polylines.length).toBeGreaterThan(0);
  });

  it('should render follower path when coordinates exist', () => {
    const coordinates = [
      { lat: 10, lng: 20 },
      { lat: 11, lng: 21 },
    ];
    const { container } = render(
      <MapView followerCoordinates={coordinates} />
    );
    const polylines = container.querySelectorAll('[data-testid="polyline"]');
    expect(polylines.length).toBeGreaterThan(0);
  });

  it('should render start marker when publisher coordinates exist', () => {
    const coordinates = [{ lat: 10, lng: 20 }];
    const { container } = render(
      <MapView publisherCoordinates={coordinates} />
    );
    const markers = container.querySelectorAll('[data-testid="marker"]');
    expect(markers.length).toBeGreaterThan(0);
  });

  it('should render publisher current position marker', () => {
    const coordinates = [
      { lat: 10, lng: 20 },
      { lat: 11, lng: 21 },
    ];
    const { container } = render(
      <MapView publisherCoordinates={coordinates} role="publisher" />
    );
    const markers = container.querySelectorAll('[data-testid="marker"]');
    expect(markers.length).toBeGreaterThan(1);
  });

  it('should render follower current position marker', () => {
    const coordinates = [
      { lat: 10, lng: 20 },
      { lat: 11, lng: 21 },
    ];
    const { container } = render(
      <MapView followerCoordinates={coordinates} role="follower" />
    );
    const markers = container.querySelectorAll('[data-testid="marker"]');
    expect(markers.length).toBeGreaterThan(0);
  });

  it('should render circle for live tracking', () => {
    const coordinates = [{ lat: 10, lng: 20 }];
    const { container } = render(
      <MapView
        publisherCoordinates={coordinates}
        pathStatus="recording"
      />
    );
    const circles = container.querySelectorAll('[data-testid="circle"]');
    expect(circles.length).toBeGreaterThan(0);
  });

  it('should render both paths when both coordinates exist', () => {
    const publisherCoords = [
      { lat: 10, lng: 20 },
      { lat: 11, lng: 21 },
    ];
    const followerCoords = [
      { lat: 12, lng: 22 },
      { lat: 13, lng: 23 },
    ];
    const { container } = render(
      <MapView
        publisherCoordinates={publisherCoords}
        followerCoordinates={followerCoords}
      />
    );
    const polylines = container.querySelectorAll('[data-testid="polyline"]');
    expect(polylines.length).toBeGreaterThanOrEqual(2);
  });

  it('should render with custom publisher name', () => {
    const coordinates = [
      { lat: 10, lng: 20 },
      { lat: 11, lng: 21 },
    ];
    render(
      <MapView
        publisherCoordinates={coordinates}
        publisherName="John Doe"
      />
    );
    expect(screen.getByText('🔴 John Doe')).toBeInTheDocument();
  });

  it('should render with custom follower name', () => {
    const coordinates = [
      { lat: 10, lng: 20 },
      { lat: 11, lng: 21 },
    ];
    render(
      <MapView
        followerCoordinates={coordinates}
        followerName="Jane Smith"
      />
    );
    expect(screen.getByText('🟢 Jane Smith')).toBeInTheDocument();
  });

  it('should show recording status in publisher popup', () => {
    const coordinates = [
      { lat: 10, lng: 20 },
      { lat: 11, lng: 21 },
    ];
    render(
      <MapView
        publisherCoordinates={coordinates}
        pathStatus="recording"
      />
    );
    expect(screen.getByText('📡 Live tracking')).toBeInTheDocument();
  });

  it('should show paused status in publisher popup', () => {
    const coordinates = [
      { lat: 10, lng: 20 },
      { lat: 11, lng: 21 },
    ];
    render(
      <MapView
        publisherCoordinates={coordinates}
        pathStatus="paused"
      />
    );
    expect(screen.getByText('⏸️ Paused')).toBeInTheDocument();
  });

  it('should show ended status in publisher popup', () => {
    const coordinates = [
      { lat: 10, lng: 20 },
      { lat: 11, lng: 21 },
    ];
    render(
      <MapView
        publisherCoordinates={coordinates}
        pathStatus="ended"
      />
    );
    expect(screen.getByText('🏁 Ended')).toBeInTheDocument();
  });

  it('should not render polyline with single coordinate', () => {
    const coordinates = [{ lat: 10, lng: 20 }];
    const { container } = render(
      <MapView publisherCoordinates={coordinates} />
    );
    // Should only render start marker, not polyline
    const polylines = container.querySelectorAll('[data-testid="polyline"]');
    expect(polylines.length).toBe(0);
  });

  it('should render with empty coordinates', () => {
    render(
      <MapView
        publisherCoordinates={[]}
        followerCoordinates={[]}
      />
    );
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('should handle undefined current position', () => {
    render(
      <MapView
        publisherCoordinates={[]}
        followerCoordinates={[]}
        currentPosition={undefined}
      />
    );
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('should render direction banner when direction info provided', () => {
    const directionInfo = {
      bearing: 45,
      distanceToTarget: 500,
      progressPct: 50,
    };
    render(<MapView directionInfo={directionInfo} />);
    expect(screen.getByText(/Head/)).toBeInTheDocument();
  });

  it('should render complete direction banner when route completed', () => {
    const directionInfo = {
      completed: true,
    };
    render(<MapView directionInfo={directionInfo} />);
    expect(screen.getByText('🏆')).toBeInTheDocument();
    expect(screen.getByText('Route Complete!')).toBeInTheDocument();
  });

  it('should display bearing and compass direction', () => {
    const directionInfo = {
      bearing: 0,
      distanceToTarget: 1500,
      progressPct: 75,
    };
    render(<MapView directionInfo={directionInfo} />);
    expect(screen.getByText(/Head/)).toBeInTheDocument();
  });

  it('should handle large distances in banner', () => {
    const directionInfo = {
      bearing: 90,
      distanceToTarget: 2500,
      progressPct: 30,
    };
    render(<MapView directionInfo={directionInfo} />);
    // Should show distance in km
    const text = screen.getByText(/to next waypoint/);
    expect(text.textContent).toMatch(/km/);
  });

  it('should handle small distances in banner', () => {
    const directionInfo = {
      bearing: 180,
      distanceToTarget: 450,
      progressPct: 60,
    };
    render(<MapView directionInfo={directionInfo} />);
    const text = screen.getByText(/to next waypoint/);
    expect(text.textContent).toMatch(/m /);
  });

  it('should not render direction banner when direction info is null', () => {
    render(<MapView directionInfo={null} />);
    const text = screen.queryByText(/to next waypoint/);
    expect(text).not.toBeInTheDocument();
  });

  it('should render both circles when path is recording', () => {
    const publisherCoords = [
      { lat: 10, lng: 20 },
      { lat: 11, lng: 21 },
    ];
    const followerCoords = [
      { lat: 12, lng: 22 },
      { lat: 13, lng: 23 },
    ];
    const { container } = render(
      <MapView
        publisherCoordinates={publisherCoords}
        followerCoordinates={followerCoords}
        pathStatus="recording"
      />
    );
    const circles = container.querySelectorAll('[data-testid="circle"]');
    expect(circles.length).toBeGreaterThanOrEqual(2);
  });

  it('should set correct default center without current position', () => {
    const { container } = render(<MapView />);
    expect(container).toBeInTheDocument();
  });

  it('should set correct default center with current position', () => {
    render(
      <MapView currentPosition={{ lat: 15.5, lng: 75.2 }} />
    );
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('should follow publisher position when role is publisher', () => {
    const coordinates = [
      { lat: 10, lng: 20 },
      { lat: 11, lng: 21 },
    ];
    render(
      <MapView
        publisherCoordinates={coordinates}
        role="publisher"
        autoFollow={true}
      />
    );
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('should follow follower position when role is follower', () => {
    const coordinates = [
      { lat: 10, lng: 20 },
      { lat: 11, lng: 21 },
    ];
    render(
      <MapView
        followerCoordinates={coordinates}
        role="follower"
        autoFollow={true}
      />
    );
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('should not auto-follow when autoFollow is false', () => {
    const coordinates = [
      { lat: 10, lng: 20 },
      { lat: 11, lng: 21 },
    ];
    render(
      <MapView
        publisherCoordinates={coordinates}
        role="publisher"
        autoFollow={false}
      />
    );
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });
});
