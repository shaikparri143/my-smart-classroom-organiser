import { apiRequest } from "./api";
import { getAccessToken } from "./auth";

export function getCourseComponents(courseId, signal) {
  return apiRequest(`/api/marks/courses/${courseId}/components`, {
    token: getAccessToken(),
    signal,
  });
}

export function getCourseMarks(courseId, signal) {
  return apiRequest(`/api/marks/courses/${courseId}`, {
    token: getAccessToken(),
    signal,
  });
}

export function createCourseComponent(courseId, body, signal) {
  return apiRequest(`/api/marks/courses/${courseId}/components`, {
    method: "POST",
    token: getAccessToken(),
    signal,
    body,
  });
}

export function updateComponent(componentId, body, signal) {
  return apiRequest(`/api/marks/components/${componentId}`, {
    method: "PATCH",
    token: getAccessToken(),
    signal,
    body,
  });
}

export function getComponentStudents(componentId, signal) {
  return apiRequest(`/api/marks/components/${componentId}/students`, {
    token: getAccessToken(),
    signal,
  });
}

export function saveComponentMarks(componentId, records, signal) {
  return apiRequest(`/api/marks/components/${componentId}/marks`, {
    method: "PUT",
    token: getAccessToken(),
    signal,
    body: { records },
  });
}

export function getStudentMarks(signal) {
  return apiRequest("/api/marks/student", {
    token: getAccessToken(),
    signal,
  });
}
