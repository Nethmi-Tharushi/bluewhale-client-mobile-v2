import { Platform } from 'react-native';
import Constants from 'expo-constants';

const API_PORT = 3001;
const DEFAULT_LAN_IP = process.env.EXPO_PUBLIC_LAN_IP?.trim() || '192.168.8.101';
const RENDER_FALLBACK_ORIGIN = 'https://bluewhale-backend.onrender.com';

const stripTrailingSlash = (v: string) => v.replace(/\/+$/, '');
const toOrigin = (v: string) => stripTrailingSlash(v).replace(/\/api$/i, '');
const deriveExpoHostOrigin = () => {
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoClient?.hostUri || '';
  const host = hostUri.split(':')[0]?.trim();
  if (!host) return '';
  return `http://${host}:${API_PORT}`;
};

const rawEnvUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || '';
const envOrigin = rawEnvUrl ? toOrigin(rawEnvUrl) : '';
const androidEmulatorOrigin = `http://10.0.2.2:${API_PORT}`;
const iosSimulatorOrigin = `http://localhost:${API_PORT}`;
const physicalFallbackOrigin = `http://${DEFAULT_LAN_IP}:${API_PORT}`;
const expoHostOrigin = deriveExpoHostOrigin();

const resolvedOrigin = (() => {
  // Always honor explicit env override first.
  if (envOrigin) return envOrigin;

  // Production APK/IPA should never default to LAN or emulator hosts.
  if (!__DEV__) return RENDER_FALLBACK_ORIGIN;

  // Expo Go should prefer the dev server host so physical devices do not hit localhost.
  if (Constants.executionEnvironment === 'storeClient' && expoHostOrigin) return expoHostOrigin;

  // Emulator/simulator defaults when no env is provided.
  if (Platform.OS === 'android') return androidEmulatorOrigin;
  if (Platform.OS === 'ios') return iosSimulatorOrigin;

  // Expo Go on physical device local-network fallback.
  if (Constants.executionEnvironment === 'storeClient') return physicalFallbackOrigin;

  return RENDER_FALLBACK_ORIGIN;
})();

export const SOCKET_URL = resolvedOrigin;
export const API_BASE_URL = `${resolvedOrigin}/api`;

// Optional fallback origins for resilient retries in axios.
// Release builds should only try production-safe hosts.
export const API_BASE_URL_CANDIDATES = !__DEV__
  ? Array.from(
      new Set(
        [
          API_BASE_URL,
          envOrigin ? `${envOrigin}/api` : '',
          `${RENDER_FALLBACK_ORIGIN}/api`,
        ].filter(Boolean)
      )
    )
  : Array.from(
      new Set(
        [
          API_BASE_URL,
          expoHostOrigin ? `${expoHostOrigin}/api` : '',
          `${androidEmulatorOrigin}/api`,
          `${iosSimulatorOrigin}/api`,
          `${physicalFallbackOrigin}/api`,
          `${RENDER_FALLBACK_ORIGIN}/api`,
          envOrigin ? `${envOrigin}/api` : '',
        ].filter(Boolean)
      )
    );

if (__DEV__) {
  console.log('[API Config] EXPO_PUBLIC_API_URL:', rawEnvUrl || '(not set)');
  console.log('[API Config] Expo host origin:', expoHostOrigin || '(not available)');
  console.log('[API Config] API_BASE_URL:', API_BASE_URL);
  console.log('[API Config] SOCKET_URL:', SOCKET_URL);
}
