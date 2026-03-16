import * as SecureStore from 'expo-secure-store';
import type { Job } from '../types/models';

const KEY_PREFIX = 'bluewhale_agent_saved_jobs_v1';

const scopedKey = (userId?: string | null) => {
  const normalized = (String(userId || '').trim() || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${KEY_PREFIX}_${normalized}`;
};

export async function getSavedJobs(userId?: string | null): Promise<Job[]> {
  const key = scopedKey(userId);
  const raw = await SecureStore.getItemAsync(key);
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
  await SecureStore.deleteItemAsync(scopedKey(userId));
}
