import apiClient from './api';

// Create a follow request
export const sendFollowRequest = async (pathId, publisherId) => {
  try {
    if (!pathId || !publisherId) {
      throw new Error('Invalid pathId or publisherId');
    }
    const response = await apiClient.post('/follow-requests', {
      pathId,
      publisherId,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Failed to send follow request';
    throw new Error(message);
  }
};

// Get pending follow requests for current user's paths
export const getPendingFollowRequests = async () => {
  try {
    const response = await apiClient.get('/follow-requests/pending');
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Failed to fetch pending requests';
    throw new Error(message);
  }
};

// Get follow requests sent by current user
export const getSentFollowRequests = async () => {
  try {
    const response = await apiClient.get('/follow-requests/sent');
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Failed to fetch sent requests';
    throw new Error(message);
  }
};

// Get follow requests for a specific path
export const getFollowRequestsForPath = async (pathId) => {
  try {
    if (!pathId) {
      throw new Error('pathId is required');
    }
    const response = await apiClient.get(`/follow-requests/path/${pathId}`);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Failed to fetch path requests';
    throw new Error(message);
  }
};

// Approve a follow request
export const approveFollowRequest = async (pathId, userId) => {
  try {
    if (!pathId || !userId) {
      throw new Error('Invalid pathId or userId');
    }
    const response = await apiClient.post('/follow-requests/approve', {
      pathId,
      userId,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Failed to approve request';
    throw new Error(message);
  }
};

// Reject a follow request
export const rejectFollowRequest = async (pathId, userId) => {
  try {
    if (!pathId || !userId) {
      throw new Error('Invalid pathId or userId');
    }
    const response = await apiClient.post('/follow-requests/reject', {
      pathId,
      userId,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Failed to reject request';
    throw new Error(message);
  }
};

// Cancel a sent follow request
export const cancelFollowRequest = async (pathId) => {
  try {
    if (!pathId) {
      throw new Error('pathId is required');
    }
    const response = await apiClient.delete('/follow-requests', {
      params: { pathId },
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Failed to cancel request';
    throw new Error(message);
  }
};
