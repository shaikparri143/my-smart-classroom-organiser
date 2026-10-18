import { apiRequest } from "./api";
import { getAccessToken } from "./auth";

export function listDiscussionPosts(courseId, signal) {
  return apiRequest(`/api/discussions/courses/${courseId}`, {
    token: getAccessToken(),
    signal,
  });
}

export function createDiscussionPost(courseId, message) {
  return apiRequest(`/api/discussions/courses/${courseId}/posts`, {
    method: "POST",
    token: getAccessToken(),
    body: { message },
  });
}

export function createDiscussionReply(courseId, postId, message) {
  return apiRequest(
    `/api/discussions/courses/${courseId}/posts/${postId}/replies`,
    {
      method: "POST",
      token: getAccessToken(),
      body: { message },
    },
  );
}

export function updateDiscussionPost(courseId, postId, message) {
  return apiRequest(
    `/api/discussions/courses/${courseId}/posts/${postId}`,
    {
      method: "PUT",
      token: getAccessToken(),
      body: { message },
    },
  );
}

export function deleteDiscussionPost(courseId, postId) {
  return apiRequest(
    `/api/discussions/courses/${courseId}/posts/${postId}`,
    {
      method: "DELETE",
      token: getAccessToken(),
    },
  );
}
