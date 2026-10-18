import { apiRequest } from "./api";
import { getAccessToken } from "./auth";

export function askAI(messages) {
  return apiRequest("/api/ai/chat", {
    method: "POST",
    token: getAccessToken(),
    body: { messages },
  });
}