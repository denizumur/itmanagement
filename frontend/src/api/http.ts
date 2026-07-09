import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL } from "../lib/config";
import { getAccessToken, setAccessToken } from "../lib/authToken";

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

const authClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = authClient
      .post("/api/auth/cookie-refresh/")
      .then((response) => {
        const token = response.data.access as string;
        setAccessToken(token);
        return token;
      })
      .catch(() => {
        setAccessToken(null);
        window.dispatchEvent(new Event("auth:logout"));
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      const token = await refreshAccessToken();

      if (token) {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);

export async function loginRequest(username: string, password: string) {
  const response = await authClient.post("/api/auth/cookie-token/", {
    username,
    password,
  });

  return response.data;
}

export async function logoutRequest() {
  await authClient.post("/api/auth/logout/");
  setAccessToken(null);
}

export async function bootstrapAuthRequest() {
  const response = await authClient.post("/api/auth/cookie-refresh/");
  return response.data as { access: string };
}