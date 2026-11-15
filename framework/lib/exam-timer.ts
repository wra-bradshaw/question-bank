// Mock-exam clock: pressing Start on /timer pretends it's the exam's start time
// (e.g. 08:30) right now, then the clock runs forward from there. Kept in
// localStorage so it survives reloads and is shared by every open tab. Pausing
// freezes the clock; resuming shifts `startedAt` forward by the paused time.
// Framework-owned: eject with `qb reveal framework/lib/exam-timer.ts`.

import { useEffect, useState, useSyncExternalStore } from 'react';

export type ExamTimer = {
  /** Exam start on the mock clock, in minutes after midnight (08:30 → 510). */
  startMinutes: number;
  /** When Start was pressed (epoch ms). */
  startedAt: number;
  readingMinutes: number;
  writingMinutes: number;
  /** Set while paused: when Pause was pressed (epoch ms). The clock is frozen at this moment. */
  pausedAt?: number;
};

export type ExamState = {
  phase: 'reading' | 'writing' | 'over';
  paused: boolean;
  /** Mock clock time, "HH:MM". */
  clock: string;
  /** Ms since Start was pressed. */
  elapsed: number;
};

export const MINUTE = 60_000;
const CHANGE_EVENT = 'qb-exam-timer-change';
const keyFor = (namespace: string) => `${namespace}-question-bank-exam-timer`;

const isTimer = (value: unknown): value is ExamTimer => {
  if (!value || typeof value !== 'object') return false;
  const { startMinutes, startedAt, readingMinutes, writingMinutes, pausedAt } = value as Record<string, unknown>;
  const isTime = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  return [startMinutes, startedAt, readingMinutes, writingMinutes].every(isTime) && (pausedAt === undefined || isTime(pausedAt));
};

const parse = (raw: string | null): ExamTimer | null => {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    return isTimer(value) ? value : null;
  } catch {
    return null;
  }
};

export function setExamTimer(namespace: string, timer: ExamTimer | null): void {
  if (typeof window === 'undefined') return;
  if (timer) window.localStorage.setItem(keyFor(namespace), JSON.stringify(timer));
  else window.localStorage.removeItem(keyFor(namespace));
  // `storage` only fires in other tabs; tell this one too.
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Freeze the clock at `now`. No-op if already paused. */
export function pauseExamTimer(namespace: string, timer: ExamTimer, now = Date.now()): void {
  if (timer.pausedAt !== undefined) return;
  setExamTimer(namespace, { ...timer, pausedAt: now });
}

/** Carry on from where it was paused, by shifting `startedAt` forward by the time spent paused. */
export function resumeExamTimer(namespace: string, timer: ExamTimer, now = Date.now()): void {
  if (timer.pausedAt === undefined) return;
  const { pausedAt, ...rest } = timer;
  setExamTimer(namespace, { ...rest, startedAt: rest.startedAt + Math.max(0, now - pausedAt) });
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** The saved timer, or null. Always null during SSR. */
export function useExamTimer(namespace: string): ExamTimer | null {
  const raw = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(keyFor(namespace)),
    () => null,
  );
  return parse(raw);
}

export const formatClock = (minutesAfterMidnight: number) => {
  const minutes = Math.floor(minutesAfterMidnight) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

export function examState(timer: ExamTimer, now: number): ExamState {
  const paused = timer.pausedAt !== undefined;
  const elapsed = Math.max(0, (timer.pausedAt ?? now) - timer.startedAt);
  const minutes = elapsed / MINUTE;
  const phase =
    minutes < timer.readingMinutes ? 'reading' : minutes < timer.readingMinutes + timer.writingMinutes ? 'writing' : 'over';
  return { phase, paused, clock: formatClock(timer.startMinutes + minutes), elapsed };
}

/**
 * Current time, re-read each time the mock clock ticks over a minute (and
 * when the tab becomes visible again). Never re-renders more than once a minute,
 * and doesn't tick at all while paused.
 */
export function useExamNow(timer: ExamTimer | null): number {
  const [now, setNow] = useState(() => Date.now());
  const startedAt = timer?.startedAt;
  const paused = timer?.pausedAt !== undefined;
  useEffect(() => {
    if (startedAt === undefined || paused) return;
    let timeout: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      const intoMinute = (((current - startedAt) % MINUTE) + MINUTE) % MINUTE;
      timeout = setTimeout(tick, MINUTE - intoMinute + 50);
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      clearTimeout(timeout);
      tick();
    };
    tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [startedAt, paused]);
  return now;
}
