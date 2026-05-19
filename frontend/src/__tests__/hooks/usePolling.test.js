import { renderHook, act } from '@testing-library/react';
import { usePolling } from '../../hooks/usePolling';

describe('usePolling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('calls fetch immediately and on interval', () => {
    const fetchFn = jest.fn();

    renderHook(() => usePolling(fetchFn, 1000, true, []));

    expect(fetchFn).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it('does not start polling when disabled', () => {
    const fetchFn = jest.fn();

    const { result } = renderHook(() => usePolling(fetchFn, 1000, false, []));

    expect(fetchFn).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(fetchFn).not.toHaveBeenCalled();

    act(() => {
      result.current.start();
    });

    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('stops polling when enabled changes from true to false', () => {
    const fetchFn = jest.fn();

    const { rerender } = renderHook(
      ({ enabled }) => usePolling(fetchFn, 1000, enabled, []),
      { initialProps: { enabled: true } }
    );

    expect(fetchFn).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);

    rerender({ enabled: false });

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('stops polling when stop is called', () => {
    const fetchFn = jest.fn();

    const { result } = renderHook(() => usePolling(fetchFn, 1000, true, []));

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);

    act(() => {
      result.current.stop();
      jest.advanceTimersByTime(2000);
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('restarts polling when start is called after stop', () => {
    const fetchFn = jest.fn();

    const { result } = renderHook(() => usePolling(fetchFn, 1000, true, []));

    act(() => {
      result.current.stop();
    });

    act(() => {
      result.current.start();
      jest.advanceTimersByTime(1000);
    });

    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('cleans up interval on unmount', () => {
    const fetchFn = jest.fn();

    const { unmount } = renderHook(() => usePolling(fetchFn, 1000, true, []));

    unmount();

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('respects changed interval', () => {
    const fetchFn = jest.fn();

    const { rerender } = renderHook(
      ({ interval }) => usePolling(fetchFn, interval, true, []),
      { initialProps: { interval: 1000 } }
    );

    expect(fetchFn).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);

    rerender({ interval: 2000 });

    // Rerender with new interval triggers effect cleanup and new setup with initial fetch
    expect(fetchFn).toHaveBeenCalledTimes(3);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // No call yet since new interval is 2000ms
    expect(fetchFn).toHaveBeenCalledTimes(3);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Now 2000ms has passed since rerender
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it('does not attempt to start when already polling', () => {
    const fetchFn = jest.fn();

    const { result } = renderHook(() => usePolling(fetchFn, 1000, true, []));

    expect(fetchFn).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.start();
    });

    // start() doesn't call fetchFn again if already polling (intervalRef is set)
    expect(fetchFn).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('clears interval when stopped even if not set', () => {
    const fetchFn = jest.fn();

    const { result } = renderHook(() => usePolling(fetchFn, 1000, true, []));

    act(() => {
      result.current.stop();
      result.current.stop();
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('uses default parameters when called with only fetchFunction', () => {
    const fetchFn = jest.fn();

    // Call with only fetchFunction — uses defaults: interval=3000, enabled=true, dependencies=[]
    renderHook(() => usePolling(fetchFn));

    expect(fetchFn).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('clears existing interval when toggled from enabled to disabled with an active interval', () => {
    const fetchFn = jest.fn();

    const { rerender } = renderHook(
      ({ enabled }) => usePolling(fetchFn, 1000, enabled, []),
      { initialProps: { enabled: true } }
    );

    // interval is running — fetchFn called once on mount
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Advance partway through interval
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Disable polling — should clearInterval the existing one
    rerender({ enabled: false });

    // The cleanup in useEffect runs: if (intervalRef.current) clearInterval(...)
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // Should still be 1 — no more calls after disable
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
