import apiClient from './api';

// Get followers of a path with their details
export const getFollowersForPath = async (pathId) => {
  try {
    if (!pathId) {
      throw new Error('pathId is required');
    }
    const response = await apiClient.get(`/paths/${pathId}/followers`);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Failed to fetch followers';
    throw new Error(message);
  }
};

// Remove a follower from a path
export const removeFollowerFromPath = async (pathId, followerId) => {
  try {
    if (!pathId || !followerId) {
      throw new Error('pathId and followerId are required');
    }
    const response = await apiClient.delete(`/paths/${pathId}/followers/${followerId}`);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Failed to remove follower';
    throw new Error(message);
  }
};
