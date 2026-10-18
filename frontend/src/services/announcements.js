import { apiRequest } from "./api";
import { getAccessToken } from "./auth";

export function listAnnouncements(role, signal) {
  return apiRequest(`/api/announcements/${role}`, {
    token: getAccessToken(),
    signal,
  });
}

export function createAnnouncement(body) {
  return apiRequest("/api/announcements", {
    method: "POST",
    token: getAccessToken(),
    body,
  });
}

export function updateAnnouncement(id, body) {
  return apiRequest(`/api/announcements/${id}`, {
    method: "PUT",
    token: getAccessToken(),
    body,
  });
}

export function deleteAnnouncement(id) {
  return apiRequest(`/api/announcements/${id}`, {
    method: "DELETE",
    token: getAccessToken(),
  });
}
