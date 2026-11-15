// Mock-exam timer: <ExamTimerBadge> sits in the header while a timer is
// active; <ExamTimerPage> (the /timer route) is the only place to set it.
// Framework-owned: eject with `qb reveal framework/components/exam-timer.tsx`.

import { useEffect, useState, type FormEvent } from 'react';
import { BookOpen, Clock, PenLine } from 'lucide-react';
import { useBank } from '../../core/config.tsx';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { examPhase, formatMinutes, setExamTimer, useExamTimer, useMinuteClock } from '../lib/exam-timer.ts';

const icons = { before: Clock, reading: BookOpen, writing: PenLine } as const;
const labels = { before: 'Starts in', reading: 'Reading time left', writing: 'Writing time left' } as const;

export function ExamTimerBadge() {
  const { namespace } = useBank();
  const timer = useExamTimer(namespace);
  const now = useMinuteClock(timer !== null);
  if (!timer) return null;
  const state = examPhase(timer, now);
  if (state.phase === 'over') return null;
  const Icon = icons[state.phase];
  const time = formatMinutes(state.minutesLeft);
  return (
    <span className="flex items-center gap-1.5 text-sm font-medium tabular-nums text-gray-700" title={`${labels[state.phase]}: ${time}`}>
      <Icon aria-hidden="true" className="size-4" />
      <span className="sr-only">{labels[state.phase]}: </span>
      {time}
    </span>
  );
}

const toTimeInput = (ms: number) => {
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

/** Today at hh:mm local time, or tomorrow if an exam starting today would already be over. */
const nextStart = (time: string, totalMinutes: number) => {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  if (date.getTime() + totalMinutes * 60_000 <= Date.now()) date.setDate(date.getDate() + 1);
  return date.getTime();
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
  const [start, setStart] = useState(() => (timer ? toTimeInput(timer.start) : defaultStart));
  const [reading, setReading] = useState(String(timer?.readingMinutes ?? defaultReadingMinutes));
  const [writing, setWriting] = useState(String(timer?.writingMinutes ?? defaultWritingMinutes));

  // Show the saved timer once it's read (after hydration, or when another tab changes it).
  useEffect(() => {
    if (!timer) return;
    setStart(toTimeInput(timer.start));
    setReading(String(timer.readingMinutes));
    setWriting(String(timer.writingMinutes));
  }, [timer?.start, timer?.readingMinutes, timer?.writingMinutes]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const readingMinutes = Math.max(0, Number(reading) || 0);
    const writingMinutes = Math.max(0, Number(writing) || 0);
    setExamTimer(namespace, { start: nextStart(start, readingMinutes + writingMinutes), readingMinutes, writingMinutes });
  };

  const field = 'grid gap-1.5 text-sm font-medium text-gray-700';
  return (
    <div className="grid max-w-sm gap-6">
      <h1 className="m-0 text-3xl font-bold tracking-tight text-gray-900">Timer</h1>
      <form onSubmit={submit} className="grid gap-4">
        <label className={field}>
          Start time
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
          <Button type="submit">{timer ? 'Update' : 'Start'}</Button>
          {timer && (
            <Button type="button" variant="outline" onClick={() => setExamTimer(namespace, null)}>
              Clear
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
