// Mock-exam timer: a start time plus reading and writing durations, kept in
// localStorage so it survives reloads and is shared by every open tab.
// Framework-owned: eject with `qb reveal framework/lib/exam-timer.ts`.

import { useEffect, useState, useSyncExternalStore } from 'react';

export type ExamTimer = {
  /** Start of reading time (epoch ms). */
  start: number;
  readingMinutes: number;
  writingMinutes: number;
};

export type ExamPhase =
  | { phase: 'before'; minutesLeft: number }
  | { phase: 'reading'; minutesLeft: number }
  | { phase: 'writing'; minutesLeft: number }
  | { phase: 'over' };

const MINUTE = 60_000;
const CHANGE_EVENT = 'qb-exam-timer-change';
const keyFor = (namespace: string) => `${namespace}-question-bank-exam-timer`;

const isTimer = (value: unknown): value is ExamTimer => {
  if (!value || typeof value !== 'object') return false;
  const { start, readingMinutes, writingMinutes } = value as Record<string, unknown>;
  return [start, readingMinutes, writingMinutes].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0);
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

/** Which phase `now` falls in, with whole minutes left (rounded up). */
export function examPhase(timer: ExamTimer, now: number): ExamPhase {
  const writingStart = timer.start + timer.readingMinutes * MINUTE;
  const end = writingStart + timer.writingMinutes * MINUTE;
  const left = (until: number) => Math.ceil((until - now) / MINUTE);
  if (now < timer.start) return { phase: 'before', minutesLeft: left(timer.start) };
  if (now < writingStart) return { phase: 'reading', minutesLeft: left(writingStart) };
  if (now < end) return { phase: 'writing', minutesLeft: left(end) };
  return { phase: 'over' };
}

/** Current time, re-read once a minute (on the minute) and when the tab becomes visible. */
export function useMinuteClock(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    let timeout: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      timeout = setTimeout(tick, MINUTE - (current % MINUTE) + 50);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(timeout);
        tick();
      }
    };
    tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);
  return now;
}

/** "47m" or "2h 05m". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}
