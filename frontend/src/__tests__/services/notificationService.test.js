import apiClient from '../../services/api';
import {
  fetchMyNotifications,
  dismissNotification,
} from '../../services/notificationService';

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), delete: jest.fn() },
}));

describe('notificationService', () => {
  beforeEach(() => {
    apiClient.get.mockReset();
    apiClient.delete.mockReset();
  });

  describe('fetchMyNotifications', () => {
    it('returns the array payload from /notifications/mine', async () => {
      apiClient.get.mockResolvedValue({
        data: [{ id: 'n1' }, { id: 'n2' }],
      });
      await expect(fetchMyNotifications()).resolves.toEqual([
        { id: 'n1' },
        { id: 'n2' },
      ]);
      expect(apiClient.get).toHaveBeenCalledWith('/notifications/mine');
    });

    it('coerces a non-array payload into an empty array', async () => {
      apiClient.get.mockResolvedValue({ data: null });
      await expect(fetchMyNotifications()).resolves.toEqual([]);
    });

    it('coerces an object payload into an empty array', async () => {
      apiClient.get.mockResolvedValue({ data: { unexpected: true } });
      await expect(fetchMyNotifications()).resolves.toEqual([]);
    });
  });

  describe('dismissNotification', () => {
    it('issues DELETE /notifications/:id', async () => {
      apiClient.delete.mockResolvedValue({});
      await dismissNotification('n-42');
      expect(apiClient.delete).toHaveBeenCalledWith('/notifications/n-42');
    });
  });
});
