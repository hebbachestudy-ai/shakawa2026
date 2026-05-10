import { set, get, del, keys } from 'idb-keyval';

const OFFLINE_REPORTS_KEY = 'offline_reports';

export interface OfflineReport {
  id: string;
  type: string;
  notes: string;
  location: { latitude: number; longitude: number } | null;
  photos: string[]; // Base64
  videos: string[]; // Base64
  createdAt: string;
}

export const saveOfflineReport = async (report: OfflineReport) => {
  const existing = await get<OfflineReport[]>(OFFLINE_REPORTS_KEY) || [];
  await set(OFFLINE_REPORTS_KEY, [...existing, report]);
};

export const getOfflineReports = async () => {
  return await get<OfflineReport[]>(OFFLINE_REPORTS_KEY) || [];
};

export const clearOfflineReports = async () => {
  await del(OFFLINE_REPORTS_KEY);
};

export const removeOfflineReport = async (id: string) => {
  const existing = await get<OfflineReport[]>(OFFLINE_REPORTS_KEY) || [];
  const filtered = existing.filter(r => r.id !== id);
  await set(OFFLINE_REPORTS_KEY, filtered);
};
