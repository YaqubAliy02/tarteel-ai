/**
 * App state backed by the backend's Postgres persistence.
 *
 * The backend records every /analyze attempt; this store fetches progress,
 * mistakes, and stats, and re-fetches after each analysis. If the server is
 * unreachable the last-known data stays on screen (empty on first launch).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  getMistakes,
  getProgress,
  getStats,
  type ProgressResponse,
  type StatsResponse,
} from '@/lib/api';

export type MistakeEntry = {
  id: string;
  surah: number;
  ayah: number;
  expected: string;
  recited: string | null;
  note: string;
};

const NOTE_BY_VERDICT: Record<string, string> = {
  WRONG: 'Different word recited',
  MISSING: 'Word skipped',
  EXTRA: 'Extra word added',
};

type SessionStore = {
  mistakes: MistakeEntry[];
  stats: StatsResponse | null;
  progress: ProgressResponse | null;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionStore | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [mistakes, setMistakes] = useState<MistakeEntry[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);

  const refresh = useCallback(async () => {
    const [m, s, p] = await Promise.allSettled([getMistakes(), getStats(), getProgress()]);
    if (m.status === 'fulfilled') {
      setMistakes(
        m.value.mistakes
          .filter((row) => row.expected || row.recited)
          .map((row) => ({
            id: String(row.id),
            surah: row.surah,
            ayah: row.ayah,
            expected: row.expected ?? row.recited ?? '',
            recited: row.verdict === 'MISSING' ? null : row.recited,
            note: NOTE_BY_VERDICT[row.verdict] ?? row.verdict,
          })),
      );
    }
    if (s.status === 'fulfilled') setStats(s.value);
    if (p.status === 'fulfilled') setProgress(p.value);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<SessionStore>(
    () => ({ mistakes, stats, progress, refresh }),
    [mistakes, stats, progress, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionStore {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
