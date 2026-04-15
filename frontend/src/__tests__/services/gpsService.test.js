import {
  calculateDistance,
  calculateTotalDistance,
  formatDistance,
  formatDuration,
  getCurrentPosition,
  isGeolocationAvailable,
  stopWatching,
  watchPosition,
} from '../../services/gpsService';

describe('gpsService', () => {
  let geolocationMock;

  beforeEach(() => {
    geolocationMock = {
      getCurrentPosition: jest.fn(),
      watchPosition: jest.fn(),
      clearWatch: jest.fn(),
    };
    global.navigator.geolocation = geolocationMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('isGeolocationAvailable', () => {
    it('returns true when geolocation exists', () => {
      expect(isGeolocationAvailable()).toBe(true);
    });

    it('returns false when geolocation missing', () => {
      delete global.navigator.geolocation;
      expect(isGeolocationAvailable()).toBe(false);
    });
  });

  describe('getCurrentPosition', () => {
    it('resolves with mapped coordinates', async () => {
      const timestamp = 1000;
      jest.spyOn(Date, 'now').mockReturnValue(timestamp);

      geolocationMock.getCurrentPosition.mockImplementation((success) =>
        success({ coords: { latitude: 40, longitude: 50, accuracy: 10 } })
      );

      const result = await getCurrentPosition();

      expect(result).toEqual({
        lat: 40,
        lng: 50,
        accuracy: 10,
        timestamp,
      });
    });

    it('rejects when geolocation not supported', async () => {
      delete global.navigator.geolocation;

      await expect(getCurrentPosition()).rejects.toThrow(
        'Geolocation is not supported by this browser'
      );
    });

    it('rejects with geolocation error', async () => {
      const error = new Error('Location denied');
      geolocationMock.getCurrentPosition.mockImplementation((success, fail) =>
        fail(error)
      );

      await expect(getCurrentPosition()).rejects.toBe(error);
    });

    it('uses correct options for getCurrentPosition', async () => {
      geolocationMock.getCurrentPosition.mockImplementation((success) =>
        success({ coords: { latitude: 0, longitude: 0, accuracy: 0 } })
      );

      await getCurrentPosition();

      expect(geolocationMock.getCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  });

  describe('watchPosition', () => {
    it('sets up watch with correct options', () => {
      geolocationMock.watchPosition.mockReturnValue(42);

      watchPosition(jest.fn(), jest.fn());

      expect(geolocationMock.watchPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });

    it('calls onPosition with position data', () => {
      const onPosition = jest.fn();
      let successCallback;

      geolocationMock.watchPosition.mockImplementation((success) => {
        successCallback = success;
        return 1;
      });

      watchPosition(onPosition, jest.fn());

      successCallback({ coords: { latitude: 1, longitude: 2, accuracy: 3 } });

      expect(onPosition).toHaveBeenCalledWith({
        lat: 1,
        lng: 2,
        accuracy: 3,
        timestamp: expect.any(Number),
      });
    });

    it('throttles position updates by interval', () => {
      const onPosition = jest.fn();
      let successCallback;

      // Initialize mock to return a starting time
      jest.spyOn(Date, 'now').mockReturnValue(5000);
      geolocationMock.watchPosition.mockImplementation((success) => {
        successCallback = success;
        return 2;
      });

      const stop = watchPosition(onPosition, jest.fn(), 3000);

      // First update at 5000ms (lastEmitTime starts at 0, so 5000 - 0 = 5000 >= 3000, passes filter)
      successCallback({ coords: { latitude: 1, longitude: 2, accuracy: 3 } });
      expect(onPosition).toHaveBeenCalledTimes(1);

      // Update at 6500ms (6500 - 5000 = 1500 < 3000, blocked by throttle)
      jest.spyOn(Date, 'now').mockReturnValue(6500);
      successCallback({ coords: { latitude: 4, longitude: 5, accuracy: 6 } });
      expect(onPosition).toHaveBeenCalledTimes(1);

      // Update at 8500ms (8500 - 5000 = 3500 >= 3000, passes throttle)
      jest.spyOn(Date, 'now').mockReturnValue(8500);
      successCallback({ coords: { latitude: 7, longitude: 8, accuracy: 9 } });
      expect(onPosition).toHaveBeenCalledTimes(2);
      expect(onPosition).toHaveBeenLastCalledWith({
        lat: 7,
        lng: 8,
        accuracy: 9,
        timestamp: 8500,
      });

      stop();
    });

    it('calls onError handler on error', () => {
      const onError = jest.fn();
      let errorCallback;

      geolocationMock.watchPosition.mockImplementation((success, error) => {
        errorCallback = error;
        return 3;
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      watchPosition(jest.fn(), onError);

      const error = new Error('Permission denied');
      errorCallback(error);

      expect(consoleSpy).toHaveBeenCalledWith('GPS Error:', error);
      expect(onError).toHaveBeenCalledWith(error);
    });

    it('returns function that stops watching', () => {
      geolocationMock.watchPosition.mockReturnValue(99);

      const stop = watchPosition(jest.fn(), jest.fn());
      stop();

      expect(geolocationMock.clearWatch).toHaveBeenCalledWith(99);
    });

    it('returns no-op function when geolocation not available', () => {
      delete global.navigator.geolocation;
      const onError = jest.fn();

      const stop = watchPosition(jest.fn(), onError);
      stop();

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Geolocation is not supported by this browser',
        })
      );
      expect(typeof stop).toBe('function');
    });

    it('clears previous watch before starting new one', () => {
      geolocationMock.watchPosition.mockReturnValue(55);

      watchPosition(jest.fn(), jest.fn());
      expect(geolocationMock.clearWatch).not.toHaveBeenCalled();

      watchPosition(jest.fn(), jest.fn());
      expect(geolocationMock.clearWatch).toHaveBeenCalledWith(55);
    });
  });

  describe('stopWatching', () => {
    it('clears watch when one exists', () => {
      geolocationMock.watchPosition.mockReturnValue(77);

      watchPosition(jest.fn(), jest.fn());
      stopWatching();

      expect(geolocationMock.clearWatch).toHaveBeenCalledWith(77);
    });

    it('does nothing when no watch exists', () => {
      stopWatching();
      expect(geolocationMock.clearWatch).not.toHaveBeenCalled();
    });
  });

  describe('calculateDistance', () => {
    it('returns zero for same coordinates', () => {
      const coord = { lat: 40.7128, lng: -74.006 };
      expect(calculateDistance(coord, coord)).toBe(0);
    });

    it('calculates distance between two points', () => {
      const coord1 = { lat: 0, lng: 0 };
      const coord2 = { lat: 0, lng: 0.001 };
      const distance = calculateDistance(coord1, coord2);

      expect(distance).toBeGreaterThan(0);
      expect(typeof distance).toBe('number');
    });

    it('calculates distance symmetrically', () => {
      const coord1 = { lat: 10, lng: 20 };
      const coord2 = { lat: 15, lng: 25 };

      const dist1To2 = calculateDistance(coord1, coord2);
      const dist2To1 = calculateDistance(coord2, coord1);

      expect(dist1To2).toBeCloseTo(dist2To1);
    });
  });

  describe('calculateTotalDistance', () => {
    it('returns zero for empty or single point', () => {
      expect(calculateTotalDistance([])).toBe(0);
      expect(calculateTotalDistance([{ lat: 0, lng: 0 }])).toBe(0);
    });

    it('calculates sum of segment distances', () => {
      const coords = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 0.001 },
        { lat: 0, lng: 0.002 },
      ];

      const total = calculateTotalDistance(coords);
      const segment = calculateDistance(coords[0], coords[1]);

      expect(total).toBeCloseTo(segment * 2, 5);
    });
  });

  describe('formatDistance', () => {
    it('formats meters correctly', () => {
      expect(formatDistance(0)).toBe('0 m');
      expect(formatDistance(500)).toBe('500 m');
      expect(formatDistance(999)).toBe('999 m');
    });

    it('formats kilometers correctly', () => {
      expect(formatDistance(1000)).toBe('1.00 km');
      expect(formatDistance(1234)).toBe('1.23 km');
      expect(formatDistance(10000)).toBe('10.00 km');
    });
  });

  describe('formatDuration', () => {
    it('formats seconds only', () => {
      expect(formatDuration(0)).toBe('0s');
      expect(formatDuration(30 * 1000)).toBe('30s');
      expect(formatDuration(59 * 1000)).toBe('59s');
    });

    it('formats minutes and seconds', () => {
      expect(formatDuration(60 * 1000)).toBe('1m 0s');
      expect(formatDuration(90 * 1000)).toBe('1m 30s');
      expect(formatDuration(600 * 1000)).toBe('10m 0s');
    });

    it('formats hours, minutes and seconds', () => {
      expect(formatDuration(3600 * 1000)).toBe('1h 0m 0s');
      expect(formatDuration(3661 * 1000)).toBe('1h 1m 1s');
      expect(formatDuration(7323 * 1000)).toBe('2h 2m 3s');
    });
  });
});
