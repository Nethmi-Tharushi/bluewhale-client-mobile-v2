import axios from 'axios';
import { getToken } from '../utils/tokenStorage';
import { API_BASE_URL, API_BASE_URL_CANDIDATES } from '../config/api';

const baseUrlCandidates = API_BASE_URL_CANDIDATES;
let activeBaseUrl = API_BASE_URL;
let apiReadyPromise: Promise<void> | null = null;
let apiReadyAt = 0;
const API_READY_CACHE_MS = 2 * 60 * 1000;

const getNextBaseUrl = () => {
  const idx = baseUrlCandidates.indexOf(activeBaseUrl);
  if (idx >= 0 && idx < baseUrlCandidates.length - 1) {
    activeBaseUrl = baseUrlCandidates[idx + 1];
    return activeBaseUrl;
  }
  return null;
};

export const api = axios.create({
  baseURL: activeBaseUrl,
  timeout: 30000,
});

export const isRetryableRequestError = (err: any) => {
  const status = Number(err?.response?.status || 0);
  const message = String(err?.message || '').toLowerCase();
  const timedOut = err?.code === 'ECONNABORTED' || message.includes('timeout');
  const networkError =
    !err?.response &&
    (message === 'network error' ||
      message.includes('network request failed') ||
      message.includes('failed to fetch') ||
      message.includes('unable to resolve host') ||
      message.includes('failed to connect'));

  return networkError || timedOut || [502, 503, 504].includes(status);
};

export const ensureApiReady = async ({
  force = false,
  timeoutMs = 45000,
  background = false,
}: {
  force?: boolean;
  timeoutMs?: number;
  background?: boolean;
} = {}) => {
  if (!force && apiReadyAt && Date.now() - apiReadyAt < API_READY_CACHE_MS) return;
  if (apiReadyPromise) return apiReadyPromise;

  apiReadyPromise = (async () => {
    try {
      await api.get('/jobs', {
        params: { limit: 1 },
        timeout: timeoutMs,
      });
      apiReadyAt = Date.now();
    } catch (err) {
      if (!background) throw err;
    } finally {
      apiReadyPromise = null;
    }
  })();

  return apiReadyPromise;
};

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalConfig = err?.config;
    const shouldFailOver = !err?.response && isRetryableRequestError(err);

    if (shouldFailOver && originalConfig) {
      const retryCount = Number(originalConfig.__baseUrlRetryCount || 0);
      const nextBaseUrl = getNextBaseUrl();
      if (nextBaseUrl && retryCount < baseUrlCandidates.length - 1) {
        originalConfig.__baseUrlRetryCount = retryCount + 1;
        originalConfig.baseURL = nextBaseUrl;
        api.defaults.baseURL = nextBaseUrl;
        return api.request(originalConfig);
      }
    }

    const responseData = err?.response?.data;
    const responseText = typeof responseData === 'string' ? responseData.trim() : '';
    const responseLooksHtml = /^<!doctype html>|^<html/i.test(responseText);
    const responseDetails =
      typeof responseData === 'string'
        ? responseData
        : responseData && typeof responseData === 'object'
          ? JSON.stringify(responseData)
          : '';

    const message =
      (shouldFailOver &&
        `Network Error. Tried: ${baseUrlCandidates.join(' , ')}. Set EXPO_PUBLIC_API_URL to your backend URL (e.g. https://bluewhale-backend.onrender.com).`) ||
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      (err?.response?.status && responseLooksHtml ? `HTTP ${err.response.status}: Internal Server Error` : undefined) ||
      (err?.response?.status && responseDetails ? `HTTP ${err.response.status}: ${responseDetails}` : undefined) ||
      err?.message ||
      'Something went wrong';
    err.userMessage = message;
    return Promise.reject(err);
  }
);
