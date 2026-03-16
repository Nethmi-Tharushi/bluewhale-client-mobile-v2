import * as SecureStore from 'expo-secure-store';
import type { Job } from '../types/models';

const KEY_PREFIX = 'bw_saved_jobs_v3';
const LEGACY_PREFIX = 'bw_saved_jobs_v2';
const LEGACY_KEY = 'bw_saved_jobs_v1';

const scopedKey = (userId?: string | null) => {
  const normalized = (String(userId || '').trim() || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${KEY_PREFIX}_${normalized}`;
};

const isGuestScope = (userId?: string | null) => {
  const normalized = String(userId || '').trim();
  return !normalized || normalized === 'guest';
};

export async function getSavedJobs(userId?: string | null): Promise<Job[]> {
  const key = scopedKey(userId);
  let raw = await SecureStore.getItemAsync(key);
  if (!raw && isGuestScope(userId)) {
    const legacyScopedRaw = await SecureStore.getItemAsync(`${LEGACY_PREFIX}_guest`);
    if (legacyScopedRaw) {
      raw = legacyScopedRaw;
      await SecureStore.setItemAsync(key, legacyScopedRaw);
    } else {
      const legacyRaw = await SecureStore.getItemAsync(LEGACY_KEY);
      if (legacyRaw) {
        raw = legacyRaw;
        await SecureStore.setItemAsync(key, legacyRaw);
      }
    }
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setSavedJobs(userId: string | null | undefined, jobs: Job[]): Promise<void> {
  await SecureStore.setItemAsync(scopedKey(userId), JSON.stringify(jobs));
}

export async function clearSavedJobs(userId?: string | null): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(scopedKey(userId)),
    SecureStore.deleteItemAsync(`${LEGACY_PREFIX}_${(String(userId || '').trim() || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_')}`),
  ]);
}
