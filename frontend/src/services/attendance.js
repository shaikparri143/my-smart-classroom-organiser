import { apiRequest } from "./api";
import { getAccessToken } from "./auth";

export function getCourseAttendance(courseId, attendanceDate, signal) {
  return apiRequest(
    `/api/attendance/courses/${courseId}?date=${encodeURIComponent(attendanceDate)}`,
    { token: getAccessToken(), signal },
  );
}

export function saveCourseAttendance(courseId, attendanceDate, records, signal) {
  return apiRequest(`/api/attendance/courses/${courseId}`, {
    method: "PUT",
    token: getAccessToken(),
    signal,
    body: { attendance_date: attendanceDate, records },
  });
}

export function updateCourseAttendanceThreshold(courseId, attendanceThreshold, signal) {
  return apiRequest(`/api/attendance/courses/${courseId}/threshold`, {
    method: "PATCH",
    token: getAccessToken(),
    signal,
    body: { attendance_threshold: Number(attendanceThreshold) },
  });
}

export function getStudentAttendance(signal) {
  return apiRequest("/api/attendance/student", {
    token: getAccessToken(),
    signal,
  });
}