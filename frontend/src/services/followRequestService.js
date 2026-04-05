import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const getAuthHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('fmp68_token')}`,
});

// Create a follow request
export const sendFollowRequest = async (pathId, publisherId) => {
  try {
    const response = await axios.post(
      `${API}/follow-requests`,
      { pathId, publisherId },
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || 'Failed to send follow request';
  }
};

// Get pending follow requests for current user's paths
export const getPendingFollowRequests = async () => {
  try {
    const response = await axios.get(
      `${API}/follow-requests/pending`,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || 'Failed to fetch pending requests';
  }
};

// Get follow requests sent by current user
export const getSentFollowRequests = async () => {
  try {
    const response = await axios.get(
      `${API}/follow-requests/sent`,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || 'Failed to fetch sent requests';
  }
};

// Get follow requests for a specific path
export const getFollowRequestsForPath = async (pathId) => {
  try {
    const response = await axios.get(
      `${API}/follow-requests/path/${pathId}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || 'Failed to fetch path requests';
  }
};

// Approve a follow request
export const approveFollowRequest = async (pathId, userId) => {
  try {
    const response = await axios.post(
      `${API}/follow-requests/approve`,
      { pathId, userId },
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || 'Failed to approve request';
  }
};

// Reject a follow request
export const rejectFollowRequest = async (pathId, userId) => {
  try {
    const response = await axios.post(
      `${API}/follow-requests/reject`,
      { pathId, userId },
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || 'Failed to reject request';
  }
};

// Cancel a sent follow request
export const cancelFollowRequest = async (pathId) => {
  try {
    const response = await axios.delete(
      `${API}/follow-requests?pathId=${pathId}`,
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || 'Failed to cancel request';
  }
};
