import { apiRequest } from "./api";
import { getAccessToken } from "./auth";

export function getNotifications(signal) {
  return apiRequest("/api/notifications", {
    token: getAccessToken(),
    signal,
  });
}

export function markNotificationRead(notificationId) {
  return apiRequest(`/api/notifications/${notificationId}/read`, {
    method: "PATCH",
    token: getAccessToken(),
  });
}

export function markAllNotificationsRead() {
  return apiRequest("/api/notifications/read-all", {
    method: "PATCH",
    token: getAccessToken(),
  });
}