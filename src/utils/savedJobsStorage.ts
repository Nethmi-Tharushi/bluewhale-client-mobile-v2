import * as SecureStore from 'expo-secure-store';
import type { Job } from '../types/models';

const KEY = 'bw_saved_jobs_v1';

export async function getSavedJobs(userId?: string | null): Promise<Job[]> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setSavedJobs(userId: string | null | undefined, jobs: Job[]): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(jobs));
}

export async function clearSavedJobs(userId?: string | null): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
