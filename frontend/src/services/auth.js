import { apiRequest } from "./api";

const TOKEN_KEY = "classpilot_access_token";
const PUBLIC_ROLES = new Set(["student", "teacher"]);

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function hasToken() {
  return Boolean(getAccessToken());
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

async function authenticate(path, body) {
  const response = await apiRequest(path, { method: "POST", body });

  if (
    typeof response?.access_token !== "string" ||
    !response.access_token ||
    !response.user
  ) {
    throw new Error("The ClassPilot server returned an invalid authentication response.");
  }

  localStorage.setItem(TOKEN_KEY, response.access_token);
  return response;
}

export function login(email, password) {
  return authenticate("/api/auth/login", {
    email: email.trim().toLowerCase(),
    password,
  });
}

export function register(fullName, email, password, role) {
  if (!PUBLIC_ROLES.has(role)) {
    throw new Error("Public registration is only available for students and teachers.");
  }

  return authenticate("/api/auth/register", {
    full_name: fullName.trim(),
    email: email.trim().toLowerCase(),
    password,
    role,
  });
}

export function getCurrentUser({ signal } = {}) {
  const token = getAccessToken();

  if (!token) {
    throw new Error("No ClassPilot session is available.");
  }

  return apiRequest("/api/auth/me", { token, signal });
}