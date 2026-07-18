/**
 * Client for the tarteel-ai FastAPI backend (backend/app/main.py).
 *
 * Base URL resolution:
 * - EXPO_PUBLIC_API_URL env var wins (set it to http://<LAN-IP>:8000 when
 *   testing on a physical device — the phone can't see the dev machine's
 *   localhost).
 * - Android emulator: 10.0.2.2 is the host loopback.
 * - iOS simulator / web: localhost works directly.
 */
import { Platform } from 'react-native';

export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000');

// PENDING appears only in partial (mid-recitation) reports: not reached yet.
export type Verdict = 'OK' | 'WRONG' | 'MISSING' | 'EXTRA' | 'PENDING';

export type ProgressResponse = {
  continue: { surah: number; ayah: number } | null;
  surahs: { surah: number; last_ayah: number; updated_at: string; completed: boolean }[];
};

export type ServerMistake = {
  id: number;
  surah: number;
  ayah: number;
  verdict: 'WRONG' | 'MISSING' | 'EXTRA';
  expected: string | null;
  recited: string | null;
  created_at: string;
};

export type StatsResponse = {
  accuracy: number | null;
  attempts: number;
  streak: number;
  activity: { day: string; count: number }[];
  surah_strength: { surah: number; pct: number }[];
};

async function getJson<T>(path: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const resp = await fetch(`${API_BASE}${path}`, { signal: ctrl.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return (await resp.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const getProgress = () => getJson<ProgressResponse>('/progress');
export const getMistakes = () => getJson<{ mistakes: ServerMistake[] }>('/mistakes');
export const getStats = () => getJson<StatsResponse>('/stats');

async function postForm(path: string, fields: Record<string, string>): Promise<void> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  await fetch(`${API_BASE}${path}`, { method: 'POST', body: form });
}

/** Track navigation so "continue where you left off" follows the user. */
export const postPosition = (surah: number, ayah: number) =>
  postForm('/progress/position', { surah: String(surah), ayah: String(ayah) });

export const postComplete = (surah: number, lastAyah: number) =>
  postForm('/progress/complete', { surah: String(surah), last_ayah: String(lastAyah) });

export type AnalyzeResponse = {
  expected_text: string;
  recited_raw: string;
  report: { verdict: Verdict; word: string; recited: string | null }[];
};

const MIME_BY_EXT: Record<string, string> = {
  m4a: 'audio/m4a',
  aac: 'audio/aac',
  wav: 'audio/wav',
  caf: 'audio/x-caf',
};

async function uploadForAnalysis(
  path: '/analyze' | '/analyze/partial',
  surah: number,
  ayah: number,
  audioUri: string,
): Promise<AnalyzeResponse> {
  // SDK 57's WinterCG fetch rejects RN's legacy {uri,name,type} FormData
  // parts ("Unsupported FormDataPart implementation"), so upload via
  // expo-file-system's multipart uploader instead.
  const { FileSystemUploadType, uploadAsync } = await import('expo-file-system/legacy');

  const ext = audioUri.split('.').pop()?.toLowerCase() ?? 'm4a';
  const result = await uploadAsync(`${API_BASE}${path}`, audioUri, {
    httpMethod: 'POST',
    uploadType: FileSystemUploadType.MULTIPART,
    fieldName: 'audio',
    mimeType: MIME_BY_EXT[ext] ?? 'audio/m4a',
    parameters: { surah: String(surah), ayah: String(ayah) },
  });

  let body: unknown = null;
  try {
    body = JSON.parse(result.body);
  } catch {
    // non-JSON error body; fall through to the status check
  }

  if (result.status < 200 || result.status >= 300) {
    const detail =
      body && typeof body === 'object' && 'detail' in body
        ? String((body as { detail: unknown }).detail)
        : `HTTP ${result.status}`;
    throw new Error(detail);
  }
  if (!body) throw new Error('Server returned an unreadable response.');
  return body as AnalyzeResponse;
}

/** Final analysis — persisted server-side. */
export const analyzeRecitation = (surah: number, ayah: number, audioUri: string) =>
  uploadForAnalysis('/analyze', surah, ayah, audioUri);

/** Mid-recitation follow-along poll — never persisted. */
export const analyzePartial = (surah: number, ayah: number, audioUri: string) =>
  uploadForAnalysis('/analyze/partial', surah, ayah, audioUri);
