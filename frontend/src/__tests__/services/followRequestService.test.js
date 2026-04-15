import apiClient from '../../services/api';
import {
  approveFollowRequest,
  cancelFollowRequest,
  getFollowRequestsForPath,
  getPendingFollowRequests,
  getSentFollowRequests,
  rejectFollowRequest,
  sendFollowRequest,
} from '../../services/followRequestService';

jest.mock('../../services/api');

describe('followRequestService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendFollowRequest', () => {
    it('posts follow request payload', async () => {
      apiClient.post.mockResolvedValue({ data: { ok: true } });

      const result = await sendFollowRequest('path-1', 'user-1');

      expect(apiClient.post).toHaveBeenCalledWith('/follow-requests', {
        pathId: 'path-1',
        publisherId: 'user-1',
      });
      expect(result).toEqual({ ok: true });
    });

    it('validates required parameters', async () => {
      await expect(sendFollowRequest('', 'user-1')).rejects.toThrow(
        'Invalid pathId or publisherId'
      );
      await expect(sendFollowRequest('path-1', '')).rejects.toThrow(
        'Invalid pathId or publisherId'
      );
    });

    it('uses API error message when available', async () => {
      apiClient.post.mockRejectedValue({
        response: { data: { message: 'Already requested' } },
      });

      await expect(sendFollowRequest('path-1', 'user-1')).rejects.toThrow(
        'Already requested'
      );
    });

    it('falls back to default message', async () => {
      apiClient.post.mockRejectedValue({ response: { data: {} } });

      await expect(sendFollowRequest('path-1', 'user-1')).rejects.toThrow(
        'Failed to send follow request'
      );
    });
  });

  describe('getPendingFollowRequests', () => {
    it('returns pending requests', async () => {
      apiClient.get.mockResolvedValue({ data: [{ id: 'r1' }] });

      const result = await getPendingFollowRequests();

      expect(apiClient.get).toHaveBeenCalledWith('/follow-requests/pending');
      expect(result).toEqual([{ id: 'r1' }]);
    });

    it('uses API error message when available', async () => {
      apiClient.get.mockRejectedValue({
        response: { data: { message: 'Not allowed' } },
      });

      await expect(getPendingFollowRequests()).rejects.toThrow('Not allowed');
    });

    it('falls back to default message', async () => {
      apiClient.get.mockRejectedValue({ response: { data: {} } });

      await expect(getPendingFollowRequests()).rejects.toThrow(
        'Failed to fetch pending requests'
      );
    });
  });

  describe('getSentFollowRequests', () => {
    it('returns sent requests', async () => {
      apiClient.get.mockResolvedValue({ data: [{ id: 'r2' }] });

      const result = await getSentFollowRequests();

      expect(apiClient.get).toHaveBeenCalledWith('/follow-requests/sent');
      expect(result).toEqual([{ id: 'r2' }]);
    });

    it('uses API error message when available', async () => {
      apiClient.get.mockRejectedValue({
        response: { data: { message: 'No access' } },
      });

      await expect(getSentFollowRequests()).rejects.toThrow('No access');
    });

    it('falls back to default message', async () => {
      apiClient.get.mockRejectedValue({ response: { data: {} } });

      await expect(getSentFollowRequests()).rejects.toThrow(
        'Failed to fetch sent requests'
      );
    });
  });

  describe('getFollowRequestsForPath', () => {
    it('returns requests for a path', async () => {
      apiClient.get.mockResolvedValue({ data: [{ id: 'r3' }] });

      const result = await getFollowRequestsForPath('path-9');

      expect(apiClient.get).toHaveBeenCalledWith('/follow-requests/path/path-9');
      expect(result).toEqual([{ id: 'r3' }]);
    });

    it('validates required parameters', async () => {
      await expect(getFollowRequestsForPath('')).rejects.toThrow(
        'pathId is required'
      );
    });

    it('uses API error message when available', async () => {
      apiClient.get.mockRejectedValue({
        response: { data: { message: 'Path missing' } },
      });

      await expect(getFollowRequestsForPath('path-9')).rejects.toThrow(
        'Path missing'
      );
    });

    it('falls back to default message', async () => {
      apiClient.get.mockRejectedValue({ response: { data: {} } });

      await expect(getFollowRequestsForPath('path-9')).rejects.toThrow(
        'Failed to fetch path requests'
      );
    });
  });

  describe('approveFollowRequest', () => {
    it('posts approval payload', async () => {
      apiClient.post.mockResolvedValue({ data: { ok: true } });

      const result = await approveFollowRequest('path-2', 'user-2');

      expect(apiClient.post).toHaveBeenCalledWith('/follow-requests/approve', {
        pathId: 'path-2',
        userId: 'user-2',
      });
      expect(result).toEqual({ ok: true });
    });

    it('validates required parameters', async () => {
      await expect(approveFollowRequest('', 'user-2')).rejects.toThrow(
        'Invalid pathId or userId'
      );
      await expect(approveFollowRequest('path-2', '')).rejects.toThrow(
        'Invalid pathId or userId'
      );
    });

    it('uses API error message when available', async () => {
      apiClient.post.mockRejectedValue({
        response: { data: { message: 'Already approved' } },
      });

      await expect(approveFollowRequest('path-2', 'user-2')).rejects.toThrow(
        'Already approved'
      );
    });

    it('falls back to default message', async () => {
      apiClient.post.mockRejectedValue({ response: { data: {} } });

      await expect(approveFollowRequest('path-2', 'user-2')).rejects.toThrow(
        'Failed to approve request'
      );
    });
  });

  describe('rejectFollowRequest', () => {
    it('posts rejection payload', async () => {
      apiClient.post.mockResolvedValue({ data: { ok: true } });

      const result = await rejectFollowRequest('path-3', 'user-3');

      expect(apiClient.post).toHaveBeenCalledWith('/follow-requests/reject', {
        pathId: 'path-3',
        userId: 'user-3',
      });
      expect(result).toEqual({ ok: true });
    });

    it('validates required parameters', async () => {
      await expect(rejectFollowRequest('', 'user-3')).rejects.toThrow(
        'Invalid pathId or userId'
      );
      await expect(rejectFollowRequest('path-3', '')).rejects.toThrow(
        'Invalid pathId or userId'
      );
    });

    it('uses API error message when available', async () => {
      apiClient.post.mockRejectedValue({
        response: { data: { message: 'Already rejected' } },
      });

      await expect(rejectFollowRequest('path-3', 'user-3')).rejects.toThrow(
        'Already rejected'
      );
    });

    it('falls back to default message', async () => {
      apiClient.post.mockRejectedValue({ response: { data: {} } });

      await expect(rejectFollowRequest('path-3', 'user-3')).rejects.toThrow(
        'Failed to reject request'
      );
    });
  });

  describe('cancelFollowRequest', () => {
    it('deletes sent request', async () => {
      apiClient.delete.mockResolvedValue({ data: { ok: true } });

      const result = await cancelFollowRequest('path-4');

      expect(apiClient.delete).toHaveBeenCalledWith('/follow-requests', {
        params: { pathId: 'path-4' },
      });
      expect(result).toEqual({ ok: true });
    });

    it('validates required parameters', async () => {
      await expect(cancelFollowRequest('')).rejects.toThrow('pathId is required');
    });

    it('uses API error message when available', async () => {
      apiClient.delete.mockRejectedValue({
        response: { data: { message: 'No request' } },
      });

      await expect(cancelFollowRequest('path-4')).rejects.toThrow('No request');
    });

    it('falls back to default message', async () => {
      apiClient.delete.mockRejectedValue({ response: { data: {} } });

      await expect(cancelFollowRequest('path-4')).rejects.toThrow(
        'Failed to cancel request'
      );
    });
  });
});
