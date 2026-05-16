import apiClient from './api';

export const fetchMyNotifications = async () => {
  const res = await apiClient.get('/notifications/mine');
  return Array.isArray(res.data) ? res.data : [];
};

export const dismissNotification = async (id) => {
  await apiClient.delete(`/notifications/${id}`);
};
