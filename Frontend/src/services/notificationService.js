import { apiRequest } from "./api";

export const getNotifications = () => apiRequest("/api/notifications", { auth: true });

export const getUnreadNotificationCount = () =>
  apiRequest("/api/notifications/unread-count", { auth: true });

export const markNotificationRead = (notificationId) =>
  apiRequest(`/api/notifications/${notificationId}/read`, { method: "PUT", auth: true });

export const markAllNotificationsRead = () =>
  apiRequest("/api/notifications/read-all", { method: "PUT", auth: true });

export const deleteNotification = (notificationId) =>
  apiRequest(`/api/notifications/${notificationId}`, { method: "DELETE", auth: true });
