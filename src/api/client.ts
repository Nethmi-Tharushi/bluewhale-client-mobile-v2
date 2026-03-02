import axios from 'axios';
import { getToken } from '../utils/tokenStorage';
import { API_BASE_URL, API_BASE_URL_CANDIDATES } from '../config/api';

const baseUrlCandidates = API_BASE_URL_CANDIDATES;
let activeBaseUrl = API_BASE_URL;

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
  timeout: 10000,
});

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
    const networkError = !err?.response && err?.message === 'Network Error';
    const timedOut = err?.code === 'ECONNABORTED' || String(err?.message || '').toLowerCase().includes('timeout');
    const shouldFailOver = !err?.response && (networkError || timedOut);

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
    const responseDetails =
      typeof responseData === 'string'
        ? responseData
        : responseData && typeof responseData === 'object'
          ? JSON.stringify(responseData)
          : '';

    const message =
      (shouldFailOver &&
        `Network Error. Tried: ${baseUrlCandidates.join(' , ')}. Set EXPO_PUBLIC_API_URL to your backend URL (e.g. http://192.168.x.x:3001).`) ||
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      (err?.response?.status && responseDetails ? `HTTP ${err.response.status}: ${responseDetails}` : undefined) ||
      err?.message ||
      'Something went wrong';
    err.userMessage = message;
    return Promise.reject(err);
  }
);
