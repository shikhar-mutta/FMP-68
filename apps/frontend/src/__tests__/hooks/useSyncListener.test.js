import { renderHook, act } from '@testing-library/react';
import { useSyncListener, triggerSync, SYNC_EVENTS } from '../../hooks/useSyncListener';

describe('useSyncListener', () => {
  beforeEach(() => {
    // Clear listeners before each test
    jest.clearAllMocks();
  });

  it('registers callback and calls it on sync event', () => {
    const callback = jest.fn();

    renderHook(() => useSyncListener(callback));

    act(() => {
      triggerSync(SYNC_EVENTS.REQUEST_CREATED);
    });

    expect(callback).toHaveBeenCalledWith(SYNC_EVENTS.REQUEST_CREATED);
  });

  it('calls multiple registered listeners', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();

    renderHook(() => useSyncListener(callback1));
    renderHook(() => useSyncListener(callback2));

    act(() => {
      triggerSync(SYNC_EVENTS.REQUEST_APPROVED);
    });

    expect(callback1).toHaveBeenCalledWith(SYNC_EVENTS.REQUEST_APPROVED);
    expect(callback2).toHaveBeenCalledWith(SYNC_EVENTS.REQUEST_APPROVED);
  });

  it('removes listener on unmount', () => {
    const callback = jest.fn();

    const { unmount } = renderHook(() => useSyncListener(callback));

    unmount();

    act(() => {
      triggerSync(SYNC_EVENTS.REQUEST_CREATED);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('handles errors in listener callbacks gracefully', () => {
    const errorCallback = jest.fn(() => {
      throw new Error('Listener error');
    });
    const normalCallback = jest.fn();
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    renderHook(() => useSyncListener(errorCallback));
    renderHook(() => useSyncListener(normalCallback));

    act(() => {
      triggerSync(SYNC_EVENTS.REQUEST_REJECTED);
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Error in sync listener:',
      expect.any(Error)
    );
    expect(normalCallback).toHaveBeenCalledWith(SYNC_EVENTS.REQUEST_REJECTED);

    consoleSpy.mockRestore();
  });

  it('triggers different event types', () => {
    const callback = jest.fn();

    renderHook(() => useSyncListener(callback));

    act(() => {
      triggerSync(SYNC_EVENTS.REQUEST_CANCELLED);
    });

    expect(callback).toHaveBeenCalledWith(SYNC_EVENTS.REQUEST_CANCELLED);
  });

  it('exports SYNC_EVENTS constants', () => {
    expect(SYNC_EVENTS.REQUEST_CREATED).toBe('request_created');
    expect(SYNC_EVENTS.REQUEST_APPROVED).toBe('request_approved');
    expect(SYNC_EVENTS.REQUEST_REJECTED).toBe('request_rejected');
    expect(SYNC_EVENTS.REQUEST_CANCELLED).toBe('request_cancelled');
  });
});
