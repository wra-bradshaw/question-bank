// Mock-exam clock: <ExamTimerBadge> shows the mock time in the header while an
// exam is running; <ExamTimerPage> (the /timer route) is the only place to start it.
// Framework-owned: eject with `qb reveal framework/components/exam-timer.tsx`.

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BookOpen, PenLine } from 'lucide-react';
import { useBank } from '../../core/config.tsx';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from './ui/toast';
import { examState, formatClock, MINUTE, setExamTimer, useExamNow, useExamTimer, type ExamTimer } from '../lib/exam-timer.ts';

/** Moments to announce, in minutes after Start. */
const milestones = ({ readingMinutes: reading, writingMinutes: writing }: ExamTimer) => {
  const end = reading + writing;
  return [
    ...(reading > 0 ? [{ at: reading, title: 'Reading time over' }] : []),
    ...(writing > 30 ? [{ at: end - 30, title: '30 minutes remaining' }] : []),
    ...(writing > 10 ? [{ at: end - 10, title: '10 minutes remaining' }] : []),
    { at: end, title: 'Exam over' },
  ];
};

export function ExamTimerBadge() {
  const { namespace } = useBank();
  const timer = useExamTimer(namespace);
  const now = useExamNow(timer);
  const state = timer ? examState(timer, now) : null;

  // Toast each milestone crossed since the last tick (not ones already past on load).
  const last = useRef<{ startedAt: number; elapsed: number } | null>(null);
  useEffect(() => {
    if (!timer || !state) return;
    const previous = last.current;
    if (previous?.startedAt === timer.startedAt) {
      for (const { at, title } of milestones(timer)) {
        if (previous.elapsed < at * MINUTE && at * MINUTE <= state.elapsed) toast.add({ title });
      }
    }
    last.current = { startedAt: timer.startedAt, elapsed: state.elapsed };
  }, [timer?.startedAt, state?.elapsed]);

  if (!state || state.phase === 'over') return null;
  const Icon = state.phase === 'reading' ? BookOpen : PenLine;
  return (
    <span
      className="flex items-center gap-1.5 text-sm font-medium tabular-nums text-gray-700"
      title={state.phase === 'reading' ? 'Reading time' : 'Writing time'}
    >
      <Icon aria-hidden="true" className="size-4" />
      <span className="sr-only">{state.phase === 'reading' ? 'Reading time' : 'Writing time'}, mock exam time </span>
      {state.clock}
    </span>
  );
}

const parseClock = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
};

export function ExamTimerPage({
  defaultStart = '08:30',
  defaultReadingMinutes = 15,
  defaultWritingMinutes = 180,
}: {
  defaultStart?: string;
  defaultReadingMinutes?: number;
  defaultWritingMinutes?: number;
}) {
  const { namespace } = useBank();
  const timer = useExamTimer(namespace);
  const now = useExamNow(timer);
  const running = timer !== null && examState(timer, now).phase !== 'over';
  const [start, setStart] = useState(defaultStart);
  const [reading, setReading] = useState(String(defaultReadingMinutes));
  const [writing, setWriting] = useState(String(defaultWritingMinutes));

  // Show the saved settings once they're read (after hydration, or when another tab changes them).
  useEffect(() => {
    if (!timer) return;
    setStart(formatClock(timer.startMinutes));
    setReading(String(timer.readingMinutes));
    setWriting(String(timer.writingMinutes));
  }, [timer?.startedAt]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setExamTimer(namespace, {
      startMinutes: parseClock(start),
      startedAt: Date.now(),
      readingMinutes: Math.max(0, Number(reading) || 0),
      writingMinutes: Math.max(0, Number(writing) || 0),
    });
  };

  const field = 'grid gap-1.5 text-sm font-medium text-gray-700';
  return (
    <div className="grid max-w-sm gap-6">
      <h1 className="m-0 text-3xl font-bold tracking-tight text-gray-900">Timer</h1>
      <form onSubmit={submit} className="grid gap-4">
        <label className={field}>
          Exam start time
          <Input type="time" required value={start} onChange={(event) => setStart(event.target.value)} />
        </label>
        <label className={field}>
          Reading minutes
          <Input type="number" min={0} required value={reading} onChange={(event) => setReading(event.target.value)} />
        </label>
        <label className={field}>
          Writing minutes
          <Input type="number" min={0} required value={writing} onChange={(event) => setWriting(event.target.value)} />
        </label>
        <div className="flex gap-2">
          <Button type="submit">{running ? 'Restart' : 'Start'}</Button>
          {running && (
            <Button type="button" variant="outline" onClick={() => setExamTimer(namespace, null)}>
              Stop
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
