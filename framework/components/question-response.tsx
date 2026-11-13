// Response widgets for the auto-graded non-choice kinds: numerical,
// matching and dropdown. Framework-owned: eject with
// `qb reveal framework/components/question-response.tsx`.

import { Check, X } from 'lucide-react';
import type { BaseQuestion, QuestionOption, QuizAnswer } from '../../core/types.ts';
import { getPairingSlots, parseNumericAnswer, questionKind, toPairings } from '../../core/types.ts';
import { MarkdownContent } from './markdown-content';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from '../lib/utils.ts';

export const optionLetter = (index: number): string => String.fromCharCode(65 + index);

/** Format the expected value of a numerical question, e.g. "71.667 (± 0.01) I/Os". */
export function formatNumericAnswer(question: BaseQuestion): string {
  const numeric = question.numeric;
  if (!numeric) return '';
  const tolerance = numeric.tolerance ? ` (± ${numeric.tolerance})` : '';
  const unit = numeric.unit ? ` ${numeric.unit}` : '';
  return `${numeric.value.toLocaleString('en-US', { maximumFractionDigits: 10 })}${tolerance}${unit}`;
}

export function NumericalResponse({
  question,
  answer,
  checked,
  correct,
  onChange,
}: {
  question: BaseQuestion;
  answer: QuizAnswer | undefined;
  checked: boolean;
  correct: boolean | null;
  onChange: (value: string) => void;
}) {
  const text = typeof answer === 'string' ? answer : '';
  const invalid = text.trim() !== '' && parseNumericAnswer(text) === null;
  const inputId = `quiz-numeric-${question.id}`;
  return (
    <div className="mt-6">
      <label htmlFor={inputId} className="text-sm font-semibold text-gray-900">
        Your answer
      </label>
      <div className="mt-2 flex items-center gap-2">
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter a number"
          aria-invalid={invalid || (checked && correct === false) || undefined}
          aria-describedby={invalid ? `${inputId}-hint` : undefined}
          className={cn(
            'h-10 w-48 rounded-lg border bg-white px-3 font-mono text-base tabular-nums text-gray-900 outline-none placeholder:font-sans placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/20',
            checked && correct === true && 'border-green-600 bg-green-50',
            checked && correct === false && 'border-red-600 bg-red-50',
            !checked && 'border-gray-300',
          )}
        />
        {question.numeric?.unit && <span className="text-sm text-gray-600">{question.numeric.unit}</span>}
      </div>
      {invalid && (
        <p id={`${inputId}-hint`} className="mt-1.5 text-sm text-amber-800">
          That doesn't look like a number — it will be marked incorrect.
        </p>
      )}
    </div>
  );
}

function OptionSelect({
  id,
  options,
  value,
  lettered,
  onChange,
  ariaLabel,
  state,
}: {
  id: string;
  options: readonly QuestionOption[];
  value: string | undefined;
  lettered: boolean;
  onChange: (value: string) => void;
  ariaLabel: string;
  state: 'idle' | 'correct' | 'incorrect' | 'missing';
}) {
  return (
    <Select value={value ?? ''} onValueChange={onChange}>
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          'h-auto min-h-9 w-full min-w-48 whitespace-normal bg-white text-left sm:w-72',
          state === 'correct' && 'border-green-600 bg-green-50',
          (state === 'incorrect' || state === 'missing') && 'border-red-600 bg-red-50',
        )}
      >
        <SelectValue placeholder="Choose…" />
      </SelectTrigger>
      <SelectContent position="popper" className="max-w-[min(36rem,calc(100vw-2rem))]">
        {options.map((option, index) => (
          <SelectItem key={option.id} value={option.id} className="whitespace-normal">
            {lettered && <span className="font-semibold text-gray-500">{optionLetter(index)}.</span>}
            <MarkdownContent inline content={option.text} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Matching rows or dropdown blanks: one select per slot, graded per slot once checked. */
export function PairingResponse({
  question,
  answer,
  checked,
  onChange,
}: {
  question: BaseQuestion;
  answer: QuizAnswer | undefined;
  checked: boolean;
  onChange: (value: Record<string, string>) => void;
}) {
  const kind = questionKind(question);
  const matching = kind === 'matching';
  const slots = getPairingSlots(question);
  const pairings = toPairings(question, answer);
  const answeredCount = Object.keys(pairings).length;

  return (
    <div className="mt-6">
      <p id={`quiz-pairing-label-${question.id}`} className="text-sm font-semibold text-gray-900">
        {matching ? 'Match each item to an option' : 'Fill in each blank'}
        <span className="ml-2 font-normal text-gray-500">
          {answeredCount}/{slots.length} answered
        </span>
      </p>

      {matching && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-gray-500">Options</p>
          <ol className="m-0 mt-2 grid list-none gap-x-6 gap-y-1 p-0 sm:grid-cols-2">
            {(question.options ?? []).map((option, index) => (
              <li key={option.id} className="flex items-start gap-2 text-sm text-gray-800">
                <span className="w-5 shrink-0 font-semibold text-gray-500">{optionLetter(index)}.</span>
                <MarkdownContent inline content={option.text} className="min-w-0 flex-1" />
              </li>
            ))}
          </ol>
        </div>
      )}

      <ol aria-labelledby={`quiz-pairing-label-${question.id}`} className="m-0 mt-3 grid list-none gap-2 p-0">
        {slots.map((slot, index) => {
          const chosen = pairings[slot.id];
          const isCorrect = chosen === slot.correctId;
          const state = !checked ? 'idle' : chosen === undefined ? 'missing' : isCorrect ? 'correct' : 'incorrect';
          const correctIndex = slot.options.findIndex((o) => o.id === slot.correctId);
          const correctOption = slot.options[correctIndex];
          const selectId = `quiz-slot-${question.id}-${slot.id}`;
          const label = slot.label?.trim() ? slot.label : `Blank ${index + 1}`;
          return (
            <li
              key={slot.id}
              className={cn(
                'flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center',
                state === 'idle' && 'border-gray-200 bg-white',
                state === 'correct' && 'border-green-300 bg-green-50/50',
                (state === 'incorrect' || state === 'missing') && 'border-red-300 bg-red-50/50',
              )}
            >
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <span className="mt-0.5 w-6 shrink-0 text-sm font-semibold tabular-nums text-gray-500">{index + 1}.</span>
                <label htmlFor={selectId} className="min-w-0 flex-1 text-base leading-7 text-gray-900">
                  <MarkdownContent inline content={label} />
                </label>
              </div>
              <div className="flex shrink-0 flex-col gap-1 pl-8 sm:pl-0">
                <div className="flex items-center gap-2">
                  <OptionSelect
                    id={selectId}
                    options={slot.options}
                    value={chosen}
                    lettered={matching}
                    ariaLabel={`Answer for ${matching ? 'item' : 'blank'} ${index + 1}`}
                    state={state}
                    onChange={(value) => onChange({ ...pairings, [slot.id]: value })}
                  />
                  {state === 'correct' && <Check aria-label="Correct" className="size-5 shrink-0 text-green-700" />}
                  {(state === 'incorrect' || state === 'missing') && (
                    <X aria-label={state === 'missing' ? 'Not answered' : 'Incorrect'} className="size-5 shrink-0 text-red-700" />
                  )}
                </div>
                {(state === 'incorrect' || state === 'missing') && correctOption && (
                  <p className="m-0 flex items-baseline gap-1 text-sm text-red-900">
                    <span className="shrink-0">Correct:</span>
                    {matching && <span className="font-semibold">{optionLetter(correctIndex)}.</span>}
                    <MarkdownContent inline content={correctOption.text} />
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
