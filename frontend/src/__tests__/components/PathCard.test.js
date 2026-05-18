import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PathCard from '../../components/PathCard';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../services/followRequestService', () => ({
  sendFollowRequest: jest.fn(),
  getSentFollowRequests: jest.fn(),
  getFollowRequestsForPath: jest.fn(),
  cancelFollowRequest: jest.fn(),
}));

jest.mock('../../services/api', () => ({
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

jest.mock('../../config/constants', () => ({
  POLLING_INTERVALS: { PATH_CARD_REQUESTS: 1000 },
  REQUEST_STATUSES: { APPROVED: 'approved' },
}));

const {
  sendFollowRequest,
  getSentFollowRequests,
  getFollowRequestsForPath,
  cancelFollowRequest,
} = require('../../services/followRequestService');

const apiClient = require('../../services/api');

describe('PathCard', () => {
  let consoleErrorSpy;
  let clearIntervalSpy;
  const basePath = {
    id: 'path-1',
    title: 'Test Path',
    description: 'Path description',
    publisherId: 'pub-1',
    publisher: { id: 'pub-1', name: 'Publisher' },
    followerIds: [],
    followRequests: [],
    followers: [],
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    window.showToast = jest.fn();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    getSentFollowRequests.mockResolvedValue([]);
    getFollowRequestsForPath.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
    if (clearIntervalSpy) {
      clearIntervalSpy.mockRestore();
    }
    delete window.showToast;
    delete window.alert;
  });

  const renderCard = (props = {}) => {
    return render(
      <MemoryRouter>
        <PathCard
          path={{ ...basePath, ...props.path }}
          isFollowing={props.isFollowing}
          onFollowChange={props.onFollowChange || jest.fn()}
          currentUserId={props.currentUserId}
          onRequestSent={props.onRequestSent}
          onPathUpdated={props.onPathUpdated}
          onPathDeleted={props.onPathDeleted}
        />
      </MemoryRouter>
    );
  };

  it('renders base layout', () => {
    const { container } = renderCard();
    expect(container.querySelector('.path-card')).toBeTruthy();
    expect(container.querySelector('.path-title')?.textContent).toContain('Test Path');
  });

  it('shows publisher badge and pending requests count for publisher', async () => {
    getFollowRequestsForPath.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);
    const { container, findByText } = renderCard({ currentUserId: 'pub-1' });

    expect(container.querySelector('.path-badge')).toBeTruthy();
    await findByText('2');
  });

  it('checks sent requests for non-publisher', async () => {
    getSentFollowRequests.mockResolvedValue([{ pathId: 'path-1', status: 'pending' }]);
    const { container } = renderCard({ currentUserId: 'user-1' });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('.follow-button')?.textContent).toContain('Request Pending');
  });

  it('shows request to follow when no existing request', async () => {
    const { container } = renderCard({ currentUserId: 'user-1' });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('.follow-button')?.textContent).toContain('Request to Follow');
  });

  it('navigates to path detail on card click', () => {
    const { container } = renderCard();
    fireEvent.click(container.querySelector('.path-card'));
    expect(mockNavigate).toHaveBeenCalledWith('/path/path-1');
  });

  it('navigates to live track when live track button clicked', () => {
    const { container } = renderCard({ currentUserId: 'pub-1' });
    const liveBtn = container.querySelector('.live-track-btn');
    expect(liveBtn).toBeTruthy();
    fireEvent.click(liveBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/path/path-1/live');
  });

  it('sends follow request when not following', async () => {
    sendFollowRequest.mockResolvedValue({});
    const onRequestSent = jest.fn();
    const { container } = renderCard({ currentUserId: 'user-1', onRequestSent });

    await act(async () => {
      await Promise.resolve();
    });

    const button = container.querySelector('.follow-button');
    fireEvent.click(button);

    await act(async () => {
      await Promise.resolve();
    });

    expect(sendFollowRequest).toHaveBeenCalledWith('path-1', 'pub-1');
    expect(onRequestSent).toHaveBeenCalledWith('path-1');
    expect(window.showToast).toHaveBeenCalled();
  });

  it('unfollows when already following', async () => {
    apiClient.post.mockResolvedValue({});
    const onFollowChange = jest.fn();
    const { container } = renderCard({ currentUserId: 'user-1', isFollowing: true, onFollowChange });

    await act(async () => {
      await Promise.resolve();
    });

    const button = container.querySelector('.follow-button');
    fireEvent.click(button);

    await act(async () => {
      await Promise.resolve();
    });

    // Confirmation dialog shown — click "Yes, Unfollow"
    fireEvent.click(container.querySelector('.confirm-cancel-btn'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(apiClient.post).toHaveBeenCalledWith('/paths/path-1/unfollow');
    expect(onFollowChange).toHaveBeenCalledWith('path-1', false);
  });

  it('unfollows without toast when showToast is unset', async () => {
    apiClient.post.mockResolvedValue({});
    delete window.showToast;
    const onFollowChange = jest.fn();
    const { container } = renderCard({ currentUserId: 'user-1', isFollowing: true, onFollowChange });

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(container.querySelector('.follow-button'));

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(container.querySelector('.confirm-cancel-btn'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(apiClient.post).toHaveBeenCalledWith('/paths/path-1/unfollow');
    expect(onFollowChange).toHaveBeenCalledWith('path-1', false);
  });

  it('unfollows (does NOT show cancel-confirm) when isFollowing is true even with a stale pending request', async () => {
    // Regression: prior pending request was approved; parent flipped isFollowing → true.
    // Before the fix, the click handler routed to cancel-request and the backend
    // responded "Follow request not found".
    getSentFollowRequests.mockResolvedValue([{ pathId: 'path-1', status: 'pending' }]);
    apiClient.post.mockResolvedValue({});
    const onFollowChange = jest.fn();
    const { container } = renderCard({
      currentUserId: 'user-1',
      isFollowing: true,
      onFollowChange,
    });

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(container.querySelector('.follow-button'));

    await act(async () => {
      await Promise.resolve();
    });

    // Must show unfollow confirmation (not cancel-request confirmation) even when a stale pending request exists.
    expect(container.querySelector('.cancel-confirmation p').textContent).toMatch(/Unfollow/);

    fireEvent.click(container.querySelector('.confirm-cancel-btn'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(cancelFollowRequest).not.toHaveBeenCalled();
    expect(apiClient.post).toHaveBeenCalledWith('/paths/path-1/unfollow');
    expect(onFollowChange).toHaveBeenCalledWith('path-1', false);
  });

  it('shows cancel confirmation when request exists', async () => {
    getSentFollowRequests.mockResolvedValue([{ pathId: 'path-1', status: 'pending' }]);
    const { container } = renderCard({ currentUserId: 'user-1' });

    await act(async () => {
      await Promise.resolve();
    });

    const button = container.querySelector('.follow-button');
    fireEvent.click(button);
    expect(container.querySelector('.cancel-confirmation')).toBeTruthy();
  });

  it('keeps request when clicking keep button', async () => {
    getSentFollowRequests.mockResolvedValue([{ pathId: 'path-1', status: 'pending' }]);
    const { container } = renderCard({ currentUserId: 'user-1' });

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(container.querySelector('.follow-button'));
    const keepBtn = container.querySelector('.confirm-keep-btn');
    fireEvent.click(keepBtn);

    expect(container.querySelector('.cancel-confirmation')).toBeFalsy();
  });

  it('cancels follow request from confirmation', async () => {
    getSentFollowRequests.mockResolvedValue([{ pathId: 'path-1', status: 'pending' }]);
    cancelFollowRequest.mockResolvedValue({});
    const { container } = renderCard({ currentUserId: 'user-1' });

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(container.querySelector('.follow-button'));
    const confirmBtn = container.querySelector('.confirm-cancel-btn');
    fireEvent.click(confirmBtn);

    await act(async () => {
      await Promise.resolve();
    });

    expect(cancelFollowRequest).toHaveBeenCalledWith('path-1');
    expect(window.showToast).toHaveBeenCalled();
  });

  it('cancels follow request without showToast', async () => {
    getSentFollowRequests.mockResolvedValue([{ pathId: 'path-1', status: 'pending' }]);
    cancelFollowRequest.mockResolvedValue({});
    delete window.showToast;
    const { container } = renderCard({ currentUserId: 'user-1' });

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(container.querySelector('.follow-button'));
    fireEvent.click(container.querySelector('.confirm-cancel-btn'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(cancelFollowRequest).toHaveBeenCalledWith('path-1');
  });

  it('handles cancel request errors', async () => {
    getSentFollowRequests.mockResolvedValue([{ pathId: 'path-1', status: 'pending' }]);
    cancelFollowRequest.mockRejectedValue(new Error('cancel failed'));
    window.alert = jest.fn();
    const { container } = renderCard({ currentUserId: 'user-1' });

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(container.querySelector('.follow-button'));
    fireEvent.click(container.querySelector('.confirm-cancel-btn'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(window.alert).toHaveBeenCalled();
    expect(window.showToast).toHaveBeenCalled();
  });

  it('uses default message when cancel request error has no message', async () => {
    getSentFollowRequests.mockResolvedValue([{ pathId: 'path-1', status: 'pending' }]);
    cancelFollowRequest.mockRejectedValue(new Error(''));
    window.alert = jest.fn();
    const { container } = renderCard({ currentUserId: 'user-1' });

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(container.querySelector('.follow-button'));
    fireEvent.click(container.querySelector('.confirm-cancel-btn'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(window.showToast).toHaveBeenCalledWith('Failed to cancel request', 'error');
    expect(window.alert).toHaveBeenCalledWith('Failed to cancel request');
  });

  it('handles cancel request errors without showToast', async () => {
    getSentFollowRequests.mockResolvedValue([{ pathId: 'path-1', status: 'pending' }]);
    cancelFollowRequest.mockRejectedValue(new Error('cancel failed'));
    window.alert = jest.fn();
    delete window.showToast;
    const { container } = renderCard({ currentUserId: 'user-1' });

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(container.querySelector('.follow-button'));
    fireEvent.click(container.querySelector('.confirm-cancel-btn'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(window.alert).toHaveBeenCalled();
  });

  it('handles errors when follow request fails', async () => {
    sendFollowRequest.mockRejectedValue(new Error('fail'));
    window.alert = jest.fn();

    const { container } = renderCard({ currentUserId: 'user-1' });

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(container.querySelector('.follow-button'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(window.alert).toHaveBeenCalled();
    expect(window.showToast).toHaveBeenCalled();
  });

  it('uses default message when follow request error has no message', async () => {
    sendFollowRequest.mockRejectedValue(new Error(''));
    window.alert = jest.fn();

    const { container } = renderCard({ currentUserId: 'user-1' });

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(container.querySelector('.follow-button'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(window.showToast).toHaveBeenCalledWith('Failed to send follow request', 'error');
    expect(window.alert).toHaveBeenCalledWith('Failed to send follow request');
  });

  it('handles follow request errors without showToast', async () => {
    sendFollowRequest.mockRejectedValue(new Error('fail'));
    delete window.showToast;
    window.alert = jest.fn();

    const { container } = renderCard({ currentUserId: 'user-1' });

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(container.querySelector('.follow-button'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(window.alert).toHaveBeenCalled();
  });

  it('logs error when checking requests fails', async () => {
    getSentFollowRequests.mockRejectedValue(new Error('check failed'));
    await act(async () => {
      renderCard({ currentUserId: 'user-1' });
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('logs error when fetching pending count fails', async () => {
    getFollowRequestsForPath.mockRejectedValue(new Error('pending failed'));
    await act(async () => {
      renderCard({ currentUserId: 'pub-1' });
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('updates follow status when request approved in polling', async () => {
    const onFollowChange = jest.fn();
    getSentFollowRequests
      .mockResolvedValueOnce([{ pathId: 'path-1', status: 'pending' }])
      .mockResolvedValueOnce([{ pathId: 'path-1', status: 'approved' }]);

    renderCard({ currentUserId: 'user-1', onFollowChange });

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(onFollowChange).toHaveBeenCalledWith('path-1', true);
  });

  it('sends follow request without onRequestSent callback', async () => {
    sendFollowRequest.mockResolvedValue({});
    delete window.showToast;
    const { container } = renderCard({ currentUserId: 'user-1' });

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(container.querySelector('.follow-button'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(sendFollowRequest).toHaveBeenCalledWith('path-1', 'pub-1');
  });

  it('clears polling interval on unmount', () => {
    const { unmount } = renderCard({ currentUserId: 'pub-1' });
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('clears polling interval for non-publisher effect', async () => {
    const { unmount } = renderCard({ currentUserId: 'user-1' });

    await act(async () => {
      await Promise.resolve();
    });

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('does not clear interval when pollingRef is null for publisher effect', () => {
    const intervalSpy = jest.spyOn(global, 'setInterval').mockReturnValue(null);
    const { unmount } = renderCard({ currentUserId: 'pub-1' });
    unmount();
    expect(clearIntervalSpy).not.toHaveBeenCalled();
    intervalSpy.mockRestore();
  });

  it('does not clear interval when pollingRef is null for non-publisher effect', async () => {
    const intervalSpy = jest.spyOn(global, 'setInterval').mockReturnValue(null);
    const { unmount } = renderCard({ currentUserId: 'user-1' });

    await act(async () => {
      await Promise.resolve();
    });

    unmount();
    expect(clearIntervalSpy).not.toHaveBeenCalled();
    intervalSpy.mockRestore();
  });

  describe('publisher edit/delete actions', () => {
    it('opens the edit form when the publisher clicks the edit button', () => {
      const { container } = renderCard({ currentUserId: 'pub-1' });
      const editBtn = container.querySelector('.edit-btn');
      fireEvent.click(editBtn);
      expect(container.querySelector('.path-edit-form')).toBeTruthy();
    });

    it('closes the edit form when the close-form button is clicked', () => {
      const { container } = renderCard({ currentUserId: 'pub-1' });
      fireEvent.click(container.querySelector('.edit-btn'));
      fireEvent.click(container.querySelector('.close-button'));
      expect(container.querySelector('.path-edit-form')).toBeFalsy();
    });

    it('closes the edit form when the cancel button is clicked', () => {
      const { container } = renderCard({ currentUserId: 'pub-1' });
      fireEvent.click(container.querySelector('.edit-btn'));
      fireEvent.click(container.querySelector('.cancel-button'));
      expect(container.querySelector('.path-edit-form')).toBeFalsy();
    });

    it('updates title and description fields as the user types', () => {
      const { container } = renderCard({ currentUserId: 'pub-1' });
      fireEvent.click(container.querySelector('.edit-btn'));
      const titleInput = container.querySelector('input.form-input');
      const descTextarea = container.querySelector('textarea.form-textarea');
      fireEvent.change(titleInput, { target: { value: 'New Title' } });
      fireEvent.change(descTextarea, { target: { value: 'New desc' } });
      expect(titleInput.value).toBe('New Title');
      expect(descTextarea.value).toBe('New desc');
    });

    it('republishes with updated title/description and fires onPathUpdated', async () => {
      apiClient.put.mockResolvedValue({ data: { id: 'path-1', title: 'New' } });
      const onPathUpdated = jest.fn();
      const { container } = renderCard({
        currentUserId: 'pub-1',
        onPathUpdated,
      });

      fireEvent.click(container.querySelector('.edit-btn'));
      fireEvent.change(container.querySelector('input.form-input'), {
        target: { value: 'New' },
      });
      await act(async () => {
        fireEvent.click(container.querySelector('.submit-button'));
      });

      expect(apiClient.put).toHaveBeenCalledWith('/paths/path-1', {
        title: 'New',
        description: 'Path description',
      });
      expect(onPathUpdated).toHaveBeenCalledWith({ id: 'path-1', title: 'New' });
      expect(window.showToast).toHaveBeenCalledWith(
        'Path updated successfully',
        'success',
      );
    });

    it('republish rejects blank titles silently', async () => {
      apiClient.put.mockResolvedValue({});
      const { container } = renderCard({ currentUserId: 'pub-1' });
      fireEvent.click(container.querySelector('.edit-btn'));
      fireEvent.change(container.querySelector('input.form-input'), {
        target: { value: '   ' },
      });
      await act(async () => {
        fireEvent.submit(container.querySelector('.path-edit-form'));
      });
      expect(apiClient.put).not.toHaveBeenCalled();
    });

    it('surfaces a server error message on republish failure', async () => {
      apiClient.put.mockRejectedValue({
        response: { data: { message: 'Title taken' } },
      });
      const { container } = renderCard({ currentUserId: 'pub-1' });
      fireEvent.click(container.querySelector('.edit-btn'));
      fireEvent.change(container.querySelector('input.form-input'), {
        target: { value: 'Other' },
      });
      await act(async () => {
        fireEvent.click(container.querySelector('.submit-button'));
      });
      expect(window.showToast).toHaveBeenCalledWith('Title taken', 'error');
    });

    it('republish error falls back to default message when none provided', async () => {
      apiClient.put.mockRejectedValue({});
      const { container } = renderCard({ currentUserId: 'pub-1' });
      fireEvent.click(container.querySelector('.edit-btn'));
      fireEvent.change(container.querySelector('input.form-input'), {
        target: { value: 'Other' },
      });
      await act(async () => {
        fireEvent.click(container.querySelector('.submit-button'));
      });
      expect(window.showToast).toHaveBeenCalledWith('Failed to update path', 'error');
    });

    it('toggles the delete confirmation when the publisher clicks delete', () => {
      const { container } = renderCard({ currentUserId: 'pub-1' });
      fireEvent.click(container.querySelector('.delete-btn'));
      expect(container.querySelector('.delete-confirmation')).toBeTruthy();
      // Click delete-btn again to toggle off
      fireEvent.click(container.querySelector('.delete-btn'));
      expect(container.querySelector('.delete-confirmation')).toBeFalsy();
    });

    it('deletes a path and fires onPathDeleted', async () => {
      apiClient.delete.mockResolvedValue({});
      const onPathDeleted = jest.fn();
      const { container } = renderCard({
        currentUserId: 'pub-1',
        onPathDeleted,
      });
      fireEvent.click(container.querySelector('.delete-btn'));
      await act(async () => {
        fireEvent.click(container.querySelector('.confirm-cancel-btn'));
      });
      expect(apiClient.delete).toHaveBeenCalledWith('/paths/path-1');
      expect(onPathDeleted).toHaveBeenCalledWith('path-1');
      expect(window.showToast).toHaveBeenCalledWith('Path deleted', 'warning');
    });

    it('"Keep It" closes the delete confirmation without calling DELETE', () => {
      const { container } = renderCard({ currentUserId: 'pub-1' });
      fireEvent.click(container.querySelector('.delete-btn'));
      fireEvent.click(container.querySelector('.confirm-keep-btn'));
      expect(apiClient.delete).not.toHaveBeenCalled();
      expect(container.querySelector('.delete-confirmation')).toBeFalsy();
    });

    it('surfaces a server error message when delete fails', async () => {
      apiClient.delete.mockRejectedValue({
        response: { data: { message: 'You cannot delete this path' } },
      });
      const { container } = renderCard({ currentUserId: 'pub-1' });
      fireEvent.click(container.querySelector('.delete-btn'));
      await act(async () => {
        fireEvent.click(container.querySelector('.confirm-cancel-btn'));
      });
      expect(window.showToast).toHaveBeenCalledWith(
        'You cannot delete this path',
        'error',
      );
    });

    it('delete error falls back to default message when none provided', async () => {
      apiClient.delete.mockRejectedValue({});
      const { container } = renderCard({ currentUserId: 'pub-1' });
      fireEvent.click(container.querySelector('.delete-btn'));
      await act(async () => {
        fireEvent.click(container.querySelector('.confirm-cancel-btn'));
      });
      expect(window.showToast).toHaveBeenCalledWith('Failed to delete path', 'error');
    });
  });

  describe('publisher avatar + Keep It on unfollow confirm', () => {
    it('renders initials avatar fallback when publisher has no picture', () => {
      const { container } = renderCard({
        path: { publisher: { id: 'pub-1', name: 'alice' } },
      });
      const initials = container.querySelector('.publisher-avatar--initials');
      expect(initials.textContent).toBe('A');
    });

    it('"Keep It" closes the unfollow confirmation when the user backs out', async () => {
      const { container } = renderCard({
        currentUserId: 'user-1',
        isFollowing: true,
      });
      await act(async () => {
        await Promise.resolve();
      });
      fireEvent.click(container.querySelector('.follow-button'));
      expect(container.querySelector('.cancel-confirmation')).toBeTruthy();
      fireEvent.click(container.querySelector('.confirm-keep-btn'));
      expect(container.querySelector('.cancel-confirmation')).toBeFalsy();
    });
  });
});
