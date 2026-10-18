const API_BASE_URL = (() => {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (typeof window === "undefined") {
    return "http://localhost:8000";
  }

  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    return "http://localhost:8000";
  }

  return window.location.origin.replace(/\/+$/, "");
})();

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function notifySessionExpired(token, status) {
  if (status === 401 && token && typeof window !== "undefined") {
    window.dispatchEvent(new Event("classpilot:session-expired"));
  }
}

function getErrorMessage(payload, fallback) {
  const detail = payload?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item.msg)
      .filter(Boolean)
      .join(" ");
  }

  return fallback;
}

function decodeResponse(responseText) {
  if (!responseText) {
    return null;
  }
  try {
    return JSON.parse(responseText);
  } catch {
    return { detail: responseText };
  }
}

function assertResponseOk(payload, status) {
  if (status < 200 || status >= 300) {
    throw new ApiError(
      getErrorMessage(payload, `Request failed (${status}).`),
      status,
    );
  }
}

function getHeaders(token, body) {
  const headers = new Headers();
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isFormData) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

export async function apiRequest(
  path,
  { method = "GET", body, token, signal, onUploadProgress } = {},
) {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = getHeaders(token, body);

  if (isFormData && onUploadProgress) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      const abort = () => request.abort();
      request.open(method, `${API_BASE_URL}${path}`);
      headers.forEach((value, key) => request.setRequestHeader(key, value));
      request.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          onUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      });
      request.addEventListener("load", () => {
        try {
          const payload = decodeResponse(request.responseText);
          notifySessionExpired(token, request.status);
          assertResponseOk(payload, request.status);
          resolve(payload);
        } catch (error) {
          reject(error);
        }
      });
      request.addEventListener("error", () => {
        reject(
          new Error(
            "Unable to connect to ClassPilot. Check that the backend is running and try again.",
          ),
        );
      });
      request.addEventListener("abort", () => {
        const error = new Error("The request was cancelled.");
        error.name = "AbortError";
        reject(error);
      });
      signal?.addEventListener("abort", abort, { once: true });
      request.addEventListener("loadend", () =>
        signal?.removeEventListener("abort", abort),
      );
      if (signal?.aborted) {
        abort();
      } else {
        request.send(body);
      }
    });
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : isFormData
            ? body
            : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }
    throw new Error(
      "Unable to connect to ClassPilot. Check that the backend is running and try again.",
    );
  }

  const responseText = await response.text();
  const payload = decodeResponse(responseText);
  notifySessionExpired(token, response.status);
  assertResponseOk(payload, response.status);
  if (payload === null) {
    return null;
  }
  return payload;
}

export async function apiDownload(path, { token, signal } = {}) {
  const headers = getHeaders(token);
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { headers, signal });
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }
    throw new Error(
      "Unable to connect to ClassPilot. Check that the backend is running and try again.",
    );
  }
  if (!response.ok) {
    const payload = decodeResponse(await response.text());
    assertResponseOk(payload, response.status);
  }
  return response.blob();
}
