// Framework-owned: eject with `qb reveal framework/components/quiz-page.tsx`.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { Check, ChevronLeft, Pencil, X } from 'lucide-react';
import { useBank } from '../../core/config.tsx';
import type { QuestionStatus, QuestionStatusMap, QuizAnswer, QuizSession } from '../../core/types.ts';
import {
  getCorrectIds,
  gradeAnswer,
  isAnswerCorrect,
  isAnswerProvided,
  isChoiceQuestion,
  isGradeableQuestion,
  isPairingQuestion,
  questionKind,
  questionKindLabels,
  scoreAnswers,
  shuffleQuestionOptions,
  toSelectedIds,
} from '../../core/types.ts';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { MarkdownContent } from './markdown-content';
import { formatNumericAnswer, NumericalResponse, optionLetter, PairingResponse } from './question-response';
import { setQuestionStatus, getQuestionStatuses } from '../lib/question-status-storage.ts';
import { questionStatusLabels } from '../lib/question-filter.ts';
import { getQuiz, saveQuizLocally, syncQuiz } from '../lib/quiz-storage.ts';
import { cn } from '../lib/utils.ts';

const questionStatusStyles: Record<QuestionStatus, string> = {
  unanswered: 'border-border bg-muted text-muted-foreground',
  revisit: 'border-warning/30 bg-warning/10 text-warning',
  complete: 'border-success/30 bg-success/10 text-success',
};

const questionStatusDotStyles: Record<QuestionStatus, string> = {
  unanswered: 'border-border bg-background text-muted-foreground hover:bg-muted',
  revisit: 'border-warning/30 bg-warning/10 text-warning hover:bg-warning/20',
  complete: 'border-success/30 bg-success/10 text-success hover:bg-success/20',
};

export function QuizPage() {
  const bank = useBank();
  const { quizId } = useParams({ from: '/quiz/$quizId' });
  const [session, setSession] = useState<QuizSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shownAnswerId, setShownAnswerId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [statusMap, setStatusMap] = useState<QuestionStatusMap>({});
  const titleInputRef = useRef<HTMLInputElement>(null);
  // Options are shuffled per quiz (seeded by the quiz id), so order is stable
  // across reloads but differs between quizzes. Answers store option ids.
  const sessionId = session?.id;
  const questionIds = session?.questionIds;
  const quizQuestions = useMemo(
    () =>
      questionIds
        ?.map((id) => bank.questionById.get(id))
        .filter((question) => question !== undefined)
        .map((question) => shuffleQuestionOptions(question, sessionId ?? '')) ?? [],
    [questionIds, sessionId, bank],
  );
  const activeIndex = Math.min(session?.currentQuestion ?? 0, Math.max(quizQuestions.length - 1, 0));
  const activeQuestion = quizQuestions[activeIndex];

  // The session as loaded; not saved back, so merely opening a quiz never
  // bumps its updatedAt.
  const loadedSession = useRef<QuizSession | null>(null);

  useEffect(() => {
    let active = true;
    setShownAnswerId(null);
    setChecked({});
    getQuiz(bank, quizId).then((quiz) => {
      if (!active) return;
      loadedSession.current = quiz;
      setSession(quiz);
    }).finally(() => {
      if (active) setLoading(false);
    });
    getQuestionStatuses(bank).then((statuses) => {
      if (active) setStatusMap(statuses);
    });
    return () => {
      active = false;
    };
  }, [quizId, bank]);

  useEffect(() => {
    if (!session || session === loadedSession.current) return;
    // Local copy immediately; server push debounced.
    const saved = saveQuizLocally(bank, session);
    if (!bank.sync) return;
    setSaving(true);
    const timeout = window.setTimeout(() => {
      void syncQuiz(bank, saved).finally(() => setSaving(false));
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [session, bank]);

  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editingTitle]);

  const goToQuestion = (index: number) => {
    setShownAnswerId(null);
    setSession((current) => (current ? { ...current, currentQuestion: index, completed: false } : current));
  };

  const updateWrittenAnswer = (value: string) => {
    if (!activeQuestion) return;
    setSession((current) =>
      current ? { ...current, completed: false, answers: { ...current.answers, [activeQuestion.id]: value } } : current,
    );
  };

  const setGradedAnswer = (questionId: string, value: QuizAnswer) => {
    setChecked((current) => (current[questionId] ? { ...current, [questionId]: false } : current));
    setSession((current) =>
      current ? { ...current, completed: false, answers: { ...current.answers, [questionId]: value } } : current,
    );
  };

  const toggleOption = (questionId: string, optionId: string, single: boolean) => {
    if (!activeQuestion) return;
    const current = toSelectedIds(activeQuestion, session?.answers[questionId]);
    if (single) {
      setGradedAnswer(questionId, current[0] === optionId ? [] : [optionId]);
    } else {
      setGradedAnswer(
        questionId,
        current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId],
      );
    }
  };

  const checkAnswer = () => {
    if (!activeQuestion) return;
    setChecked((current) => ({ ...current, [activeQuestion.id]: true }));
    if (bank.answers[activeQuestion.id]) setShownAnswerId(activeQuestion.id);
  };

  const updateQuestionStatus = (status: QuestionStatus) => {
    if (!activeQuestion) return;
    void setQuestionStatus(bank, activeQuestion.id, status);
    setStatusMap((current) => ({ ...current, [activeQuestion.id]: status }));
    setShownAnswerId(null);
    setSession((current) =>
      current
        ? {
            ...current,
            currentQuestion: Math.min(activeIndex + 1, quizQuestions.length - 1),
            completed: activeIndex === quizQuestions.length - 1,
          }
        : current,
    );
  };

  const startEditingTitle = () => {
    if (!session) return;
    setTitleDraft(session.title);
    setEditingTitle(true);
  };

  const saveTitle = () => {
    const title = titleDraft.trim();
    if (!title) return;
    setSession((current) => (current ? { ...current, title } : current));
    setEditingTitle(false);
  };

  if (loading) return <div className="py-16 text-center text-sm text-muted-foreground">Opening your quiz...</div>;

  if (!session || !activeQuestion || quizQuestions.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center py-16 text-center">
        <h1 className="text-2xl font-semibold">Quiz not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">This practice set may have been removed from this browser.</p>
        <Button render={<Link to="/quizzes" />} nativeButton={false} className="mt-6">
          Back to my quizzes
        </Button>
      </div>
    );
  }

  const answer: QuizAnswer | undefined = session.answers[activeQuestion.id];
  const suggestedAnswer = bank.answers[activeQuestion.id];
  const isSuggestedAnswerShown = shownAnswerId === activeQuestion.id;
  const choice = isChoiceQuestion(activeQuestion);
  const gradeable = isGradeableQuestion(activeQuestion);
  const kind = questionKind(activeQuestion);
  const selectedIds = toSelectedIds(activeQuestion, answer);
  const hasSelection = isAnswerProvided(activeQuestion, answer);
  const isChecked = checked[activeQuestion.id] === true;
  const correctness = isChecked ? isAnswerCorrect(activeQuestion, answer) : null;
  const grade = isChecked ? gradeAnswer(activeQuestion, answer) : null;
  const correctIds = getCorrectIds(activeQuestion);
  const activeStatus: QuestionStatus = statusMap[activeQuestion.id] ?? 'unanswered';
  const score = scoreAnswers(quizQuestions, session.answers);

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-[minmax(0,1fr)] gap-6">
      <Link to="/quizzes" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft aria-hidden="true" className="size-4" />
        Back to my quizzes
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {editingTitle ? (
          <form
            className="flex min-w-0 flex-1 items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              saveTitle();
            }}
          >
            <Input
              ref={titleInputRef}
              aria-label="Quiz title"
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setEditingTitle(false);
              }}
              className="h-9 min-w-0 px-2 text-2xl font-semibold md:text-2xl"
            />
            <Button type="submit" size="icon-sm" aria-label="Save title" title="Save title" disabled={!titleDraft.trim()}>
              <Check aria-hidden="true" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Cancel title edit" title="Cancel" onClick={() => setEditingTitle(false)}>
              <X aria-hidden="true" />
            </Button>
          </form>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="m-0 min-w-0 break-words text-2xl font-semibold">{session.title}</h1>
            <Button type="button" variant="ghost" size="icon-xs" aria-label="Edit quiz title" title="Edit quiz title" onClick={startEditingTitle}>
              <Pencil aria-hidden="true" className="text-muted-foreground" />
            </Button>
          </div>
        )}
        <span className="text-xs text-muted-foreground">{saving ? 'Saving...' : 'Saved'}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <p className="m-0 text-sm font-medium tabular-nums">
          Question {activeIndex + 1} of {quizQuestions.length}
        </p>
        {score.gradeable > 0 && (
          <Badge variant="secondary" className="tabular-nums" aria-label={`Quiz score: ${score.correct} of ${score.gradeable} correct`}>
            {score.correct}/{score.gradeable} correct
          </Badge>
        )}
        {session.completed && (
          <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
            Quiz complete
          </Badge>
        )}
      </div>

      {quizQuestions.length > 1 && (
        <nav aria-label="Questions in this quiz">
          <ol className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {quizQuestions.map((question, index) => {
              const status = statusMap[question.id] ?? 'unanswered';
              const isActive = index === activeIndex;
              return (
                <li key={question.id}>
                  <button
                    type="button"
                    onClick={() => goToQuestion(index)}
                    aria-label={`Go to question ${index + 1}: ${question.title} — ${questionStatusLabels[status]}${isActive ? ' (current question)' : ''}`}
                    aria-current={isActive ? 'true' : undefined}
                    title={`${question.title} — ${questionStatusLabels[status]}`}
                    className={cn(
                      'flex size-8 items-center justify-center rounded-lg border text-xs font-medium tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                      questionStatusDotStyles[status],
                      isActive && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
                    )}
                  >
                    {index + 1}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      {session.completed && score.gradeable > 0 && (
        <section aria-label="Quiz results" className="rounded-xl border bg-card p-5">
          <h2 className="m-0 text-base font-semibold tabular-nums">
            You scored {score.correct} of {score.gradeable}
          </h2>
          <ol className="mt-3 grid gap-1.5">
            {quizQuestions.map((question, index) => {
              const result = isAnswerCorrect(question, session.answers[question.id]);
              const parts = isPairingQuestion(question) ? gradeAnswer(question, session.answers[question.id]) : null;
              const resultLabel =
                result === null
                  ? isGradeableQuestion(question)
                    ? 'Unanswered'
                    : 'Written'
                  : result
                    ? 'Correct'
                    : parts
                      ? `Incorrect · ${parts.earned}/${parts.possible}`
                      : 'Incorrect';
              return (
                <li key={question.id}>
                  <button
                    type="button"
                    onClick={() => goToQuestion(index)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted/50"
                    aria-label={`Review question ${index + 1}: ${question.title} — ${resultLabel.toLowerCase()}`}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium tabular-nums',
                        result === true && 'bg-success/10 text-success',
                        result === false && 'bg-destructive/10 text-destructive',
                        result === null && 'bg-muted text-muted-foreground',
                      )}
                    >
                      {result === true ? <Check className="size-3" /> : result === false ? <X className="size-3" /> : index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{question.title}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{resultLabel}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="min-w-0 rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="m-0 min-w-0 flex-1 break-words text-base font-semibold">{activeQuestion.title}</h2>
          <Badge variant="outline">{questionKindLabels[kind]}</Badge>
          <Badge variant="outline" className={questionStatusStyles[activeStatus]}>
            {questionStatusLabels[activeStatus]}
          </Badge>
        </div>
        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{activeQuestion.id}</p>
        {activeQuestion.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {activeQuestion.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="max-w-full shrink whitespace-normal break-words">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        <MarkdownContent content={activeQuestion.prompt} className="mt-4 text-[15px] leading-7" />

        {choice ? (
          <div className="mt-6">
            <p id="quiz-choices-label" className="text-sm font-medium">
              {kind === 'single' ? 'Choose one answer' : 'Choose all that apply'}
            </p>
            <div role={kind === 'single' ? 'radiogroup' : 'group'} aria-labelledby="quiz-choices-label" className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-2">
              {(activeQuestion.options ?? []).map((option, index) => {
                const selected = selectedIds.includes(option.id);
                const isCorrectOption = correctIds.includes(option.id);
                const showCorrectness = isChecked;
                return (
                  <label
                    key={option.id}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
                      !showCorrectness && selected && 'border-ring bg-muted',
                      !showCorrectness && !selected && 'hover:bg-muted/50',
                      showCorrectness && isCorrectOption && 'border-success/30 bg-success/10',
                      showCorrectness && !isCorrectOption && selected && 'border-destructive/30 bg-destructive/10',
                      showCorrectness && !isCorrectOption && !selected && 'opacity-60',
                    )}
                  >
                    <input
                      type={kind === 'single' ? 'radio' : 'checkbox'}
                      name={`quiz-choice-${activeQuestion.id}`}
                      checked={selected}
                      onChange={() => toggleOption(activeQuestion.id, option.id, kind === 'single')}
                      className="mt-1.5 size-4 shrink-0 accent-primary"
                      aria-label={`Option ${optionLetter(index)}`}
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                        showCorrectness && isCorrectOption
                          ? 'border-success/30 bg-success/10 text-success'
                          : showCorrectness && selected
                            ? 'border-destructive/30 bg-destructive/10 text-destructive'
                            : selected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'bg-background text-muted-foreground',
                      )}
                    >
                      {optionLetter(index)}
                    </span>
                    <MarkdownContent content={option.text} className="min-w-0 flex-1 overflow-x-auto text-[15px] leading-7" />
                    {showCorrectness && isCorrectOption && (
                      <Badge variant="outline" className="mt-1 shrink-0 border-success/30 bg-success/10 text-success">
                        Correct
                      </Badge>
                    )}
                    {showCorrectness && !isCorrectOption && selected && (
                      <Badge variant="outline" className="mt-1 shrink-0 border-destructive/30 bg-destructive/10 text-destructive">
                        Yours
                      </Badge>
                    )}
                  </label>
                );
              })}
            </div>

          </div>
        ) : kind === 'numerical' ? (
          <NumericalResponse
            question={activeQuestion}
            answer={answer}
            checked={isChecked}
            correct={correctness}
            onChange={(value) => setGradedAnswer(activeQuestion.id, value)}
          />
        ) : isPairingQuestion(activeQuestion) ? (
          <PairingResponse
            question={activeQuestion}
            answer={answer}
            checked={isChecked}
            onChange={(value) => setGradedAnswer(activeQuestion.id, value)}
          />
        ) : (
          <div className="mt-6">
            <label htmlFor="quiz-answer" className="text-sm font-medium">
              Your answer
            </label>
            <textarea
              id="quiz-answer"
              value={typeof answer === 'string' ? answer : ''}
              onChange={(event) => updateWrittenAnswer(event.target.value)}
              placeholder="Write your working or notes here..."
              className="mt-2 block min-h-40 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm leading-6 transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </div>
        )}

        {gradeable && (
          <div>
            {isChecked && correctness !== null && (
              <div
                role="status"
                className={cn(
                  'mt-4 rounded-lg border px-4 py-3 text-sm font-medium',
                  correctness ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive',
                )}
              >
                {correctness
                  ? 'Correct — nice work.'
                  : kind === 'numerical'
                    ? `Not quite. Expected ${formatNumericAnswer(activeQuestion)}.`
                    : isPairingQuestion(activeQuestion) && grade
                      ? `Not quite — ${grade.earned} of ${grade.possible} correct. Corrections are shown on each ${kind === 'matching' ? 'item' : 'blank'}.`
                      : `Not quite. Correct answer${correctIds.length > 1 ? 's' : ''}: ${correctIds
                          .map((id) => {
                            const index = (activeQuestion.options ?? []).findIndex((o) => o.id === id);
                            return index >= 0 ? optionLetter(index) : id;
                          })
                          .join(', ')}`}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={checkAnswer} disabled={!hasSelection} variant={isChecked ? 'outline' : 'default'}>
                {isChecked ? 'Checked' : 'Check answer'}
              </Button>
              {suggestedAnswer && (
                <Button
                  variant="outline"
                  aria-expanded={isSuggestedAnswerShown}
                  aria-controls="suggested-answer"
                  onClick={() => setShownAnswerId(isSuggestedAnswerShown ? null : activeQuestion.id)}
                >
                  {isSuggestedAnswerShown ? 'Hide explanation' : 'Show explanation'}
                </Button>
              )}
            </div>
          </div>
        )}

        {suggestedAnswer && (gradeable ? isSuggestedAnswerShown : true) && (
          <div className="mt-5">
            {!gradeable && (
              <Button
                variant="outline"
                aria-expanded={isSuggestedAnswerShown}
                aria-controls="suggested-answer"
                onClick={() => setShownAnswerId(isSuggestedAnswerShown ? null : activeQuestion.id)}
              >
                {isSuggestedAnswerShown ? 'Hide answer' : 'Show answer'}
              </Button>
            )}
            {isSuggestedAnswerShown && (
              <section id="suggested-answer" className="mt-4 rounded-lg border bg-muted/50 p-4">
                <h3 className="m-0 text-sm font-medium">
                  {gradeable ? 'Explanation' : 'Suggested answer'}
                </h3>
                <MarkdownContent content={suggestedAnswer} className="mt-2 text-sm leading-6" />
              </section>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => goToQuestion(Math.max(activeIndex - 1, 0))} disabled={activeIndex === 0}>
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => goToQuestion(Math.min(activeIndex + 1, quizQuestions.length - 1))}
              disabled={activeIndex === quizQuestions.length - 1}
            >
              Next
            </Button>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" onClick={() => updateQuestionStatus('unanswered')} disabled={session.completed}>
              Skip
            </Button>
            <Button onClick={() => updateQuestionStatus('revisit')} disabled={session.completed} variant="outline" className="border-warning/30 bg-warning/10 text-warning hover:bg-warning/20 hover:text-warning">
              Revisit
            </Button>
            <Button onClick={() => updateQuestionStatus('complete')} disabled={session.completed}>
              {session.completed ? 'Quiz complete' : 'Mark as complete'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
