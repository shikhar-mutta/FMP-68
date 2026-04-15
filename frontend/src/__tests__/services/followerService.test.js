import apiClient from '../../services/api';
import {
  getFollowersForPath,
  removeFollowerFromPath,
} from '../../services/followerService';

jest.mock('../../services/api');

describe('followerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFollowersForPath', () => {
    it('should get followers for a path successfully', async () => {
      const mockFollowers = [
        { id: '1', name: 'Follower 1', email: 'follower1@example.com' },
        { id: '2', name: 'Follower 2', email: 'follower2@example.com' },
      ];
      apiClient.get.mockResolvedValue({ data: mockFollowers });

      const result = await getFollowersForPath('path-123');

      expect(apiClient.get).toHaveBeenCalledWith('/paths/path-123/followers');
      expect(result).toEqual(mockFollowers);
    });

    it('should return empty array when no followers', async () => {
      apiClient.get.mockResolvedValue({ data: [] });

      const result = await getFollowersForPath('path-456');

      expect(result).toEqual([]);
    });

    it('should throw error when pathId is missing', async () => {
      await expect(getFollowersForPath('')).rejects.toThrow('pathId is required');
    });

    it('should handle API error response', async () => {
      const errorResponse = { response: { data: { message: 'Path not found' } } };
      apiClient.get.mockRejectedValue(errorResponse);

      await expect(getFollowersForPath('path-123')).rejects.toThrow('Path not found');
    });

    it('should handle network error', async () => {
      apiClient.get.mockRejectedValue(new Error('Network timeout'));

      await expect(getFollowersForPath('path-123')).rejects.toThrow('Network timeout');
    });

    it('should use default error message for unknown errors', async () => {
      const errorResponse = { response: { data: {} } };
      apiClient.get.mockRejectedValue(errorResponse);

      await expect(getFollowersForPath('path-123')).rejects.toThrow('Failed to fetch followers');
    });
  });

  describe('removeFollowerFromPath', () => {
    it('should remove a follower from path successfully', async () => {
      const mockResponse = { message: 'Follower removed' };
      apiClient.delete.mockResolvedValue({ data: mockResponse });

      const result = await removeFollowerFromPath('path-123', 'user-456');

      expect(apiClient.delete).toHaveBeenCalledWith('/paths/path-123/followers/user-456');
      expect(result).toEqual(mockResponse);
    });

    it('should throw error when pathId is missing', async () => {
      await expect(removeFollowerFromPath('', 'user-456')).rejects.toThrow(
        'pathId and followerId are required'
      );
    });

    it('should throw error when followerId is missing', async () => {
      await expect(removeFollowerFromPath('path-123', '')).rejects.toThrow(
        'pathId and followerId are required'
      );
    });

    it('should handle API error response', async () => {
      const errorResponse = { response: { data: { message: 'Follower not found' } } };
      apiClient.delete.mockRejectedValue(errorResponse);

      await expect(removeFollowerFromPath('path-123', 'user-456')).rejects.toThrow(
        'Follower not found'
      );
    });

    it('should handle network error', async () => {
      apiClient.delete.mockRejectedValue(new Error('Connection failed'));

      await expect(removeFollowerFromPath('path-123', 'user-456')).rejects.toThrow(
        'Connection failed'
      );
    });

    it('should use default error message for unknown errors', async () => {
      apiClient.delete.mockRejectedValue({ response: { data: {} } });

      await expect(removeFollowerFromPath('path-123', 'user-456')).rejects.toThrow(
        'Failed to remove follower'
      );
    });
  });
});
