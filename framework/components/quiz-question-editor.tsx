// Framework-owned: eject with `qb reveal framework/components/quiz-question-editor.tsx`.

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Shuffle, Trash2 } from 'lucide-react';
import { useBank } from '../../core/config.tsx';
import type { QuizSession } from '../../core/types.ts';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from './ui/sheet';
import { cn } from '../lib/utils.ts';

const move = (ids: string[], from: number, to: number) => {
  const next = [...ids];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
};

export function QuizQuestionEditor({
  quiz,
  onOpenChange,
  onSave,
}: {
  quiz: QuizSession | null;
  onOpenChange: (open: boolean) => void;
  onSave: (quiz: QuizSession, questionIds: string[]) => Promise<void>;
}) {
  const bank = useBank();
  const [ids, setIds] = useState<string[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (!quiz) return;
    setIds(quiz.questionIds);
    setSaveError(false);
  }, [quiz]);

  const changed = quiz !== null && (ids.length !== quiz.questionIds.length || ids.some((id, index) => id !== quiz.questionIds[index]));

  const shuffle = () => {
    setIds((current) => {
      if (current.length < 2) return current;
      const next = [...current];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j] as string, next[i] as string];
      }
      return next;
    });
  };

  const save = async () => {
    if (!quiz) return;
    setSaving(true);
    setSaveError(false);
    try {
      await onSave(quiz, ids);
      onOpenChange(false);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={quiz !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Edit questions</SheetTitle>
          <SheetDescription>{quiz?.title}. Drag to reorder, or remove questions you no longer want.</SheetDescription>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              {ids.length} {ids.length === 1 ? 'question' : 'questions'}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={shuffle}
              disabled={ids.length < 2}
              aria-label="Shuffle question order"
              title="Shuffle question order"
            >
              <Shuffle aria-hidden="true" />
              Shuffle
            </Button>
          </div>
        </SheetHeader>
        <ol className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-2">
          {ids.map((id, index) => (
            <li
              key={id}
              draggable
              onDragStart={(event) => {
                setDragIndex(index);
                event.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (dragIndex === null || dragIndex === index) return;
                setIds((current) => move(current, dragIndex, index));
                setDragIndex(index);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={cn(
                'flex items-center gap-2 rounded-md border border-transparent px-2 py-2 hover:bg-muted',
                dragIndex === index && 'border-gray-300 bg-muted opacity-60',
              )}
            >
              <GripVertical aria-hidden="true" className="size-4 shrink-0 cursor-grab text-muted-foreground" />
              <span className="w-6 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{bank.questionById.get(id)?.title ?? id}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Move up"
                disabled={index === 0}
                onClick={() => setIds((current) => move(current, index, index - 1))}
              >
                <ArrowUp aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Move down"
                disabled={index === ids.length - 1}
                onClick={() => setIds((current) => move(current, index, index + 1))}
              >
                <ArrowDown aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Remove question"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => setIds((current) => current.filter((item) => item !== id))}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
          {ids.length === 0 && (
            <li className="px-2 py-8 text-center text-sm text-muted-foreground">
              No questions left. Delete the quiz instead if you no longer need it.
            </li>
          )}
        </ol>
        <SheetFooter className="border-t">
          {saveError && (
            <p role="alert" className="m-0 text-sm text-red-700">
              Could not save changes. Please try again.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={!changed || ids.length === 0 || saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
