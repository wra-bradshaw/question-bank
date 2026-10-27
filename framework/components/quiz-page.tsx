// Framework-owned: eject with `qb reveal framework/components/quiz-page.tsx`.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { Check, Pencil, X } from 'lucide-react';
import { useBank } from '../../core/config.tsx';
import type { QuestionStatus, QuizAnswer, QuizSession } from '../../core/types.ts';
import {
  getCorrectIds,
  isAnswerCorrect,
  isAnswerProvided,
  isChoiceQuestion,
  questionKind,
  questionKindLabels,
  scoreAnswers,
  toSelectedIds,
} from '../../core/types.ts';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { MarkdownContent } from './markdown-content';
import { setQuestionStatus } from '../lib/question-status-storage.ts';
import { getQuiz, saveQuizLocally, saveQuizProgress } from '../lib/quiz-storage.ts';
import { cn } from '../lib/utils.ts';

const optionLetter = (index: number): string => String.fromCharCode(65 + index);

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
  const titleInputRef = useRef<HTMLInputElement>(null);
  const quizQuestions = useMemo(
    () =>
      session?.questionIds.map((id) => bank.questionById.get(id)).filter((question) => question !== undefined) ?? [],
    [session, bank],
  );
  const activeIndex = Math.min(session?.currentQuestion ?? 0, Math.max(quizQuestions.length - 1, 0));
  const activeQuestion = quizQuestions[activeIndex];

  useEffect(() => {
    let active = true;
    setShownAnswerId(null);
    setChecked({});
    getQuiz(bank.namespace, quizId).then((quiz) => {
      if (active) setSession(quiz);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [quizId, bank.namespace]);

  useEffect(() => {
    if (!session) return;
    saveQuizLocally(bank.namespace, session);
    if (session.id.startsWith('local_')) return;
    setSaving(true);
    const timeout = window.setTimeout(() => {
      saveQuizProgress(
        bank.namespace,
        session,
        { title: session.title, answers: session.answers, currentQuestion: session.currentQuestion, completed: session.completed },
      )
        .then(() => setSaving(false))
        .catch(() => setSaving(false));
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [session, bank.namespace]);

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

  const setChoiceAnswer = (questionId: string, value: string[]) => {
    setChecked((current) => (current[questionId] ? { ...current, [questionId]: false } : current));
    setSession((current) =>
      current ? { ...current, completed: false, answers: { ...current.answers, [questionId]: value } } : current,
    );
  };

  const toggleOption = (questionId: string, optionId: string, single: boolean) => {
    if (!activeQuestion) return;
    const current = toSelectedIds(activeQuestion, session?.answers[questionId]);
    if (single) {
      setChoiceAnswer(questionId, current[0] === optionId ? [] : [optionId]);
    } else {
      setChoiceAnswer(
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
    void setQuestionStatus(bank.namespace, activeQuestion.id, status);
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

  if (loading) return <div className="py-16 text-center text-sm text-gray-600">Opening your quiz...</div>;

  if (!session || !activeQuestion || quizQuestions.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Quiz not found</h1>
        <p className="mt-2 text-base text-gray-600">This practice set may have been removed from this browser.</p>
        <Button asChild className="mt-6">
          <Link to="/quizzes">Back to My quizzes</Link>
        </Button>
      </div>
    );
  }

  const answer: QuizAnswer | undefined = session.answers[activeQuestion.id];
  const suggestedAnswer = bank.answers[activeQuestion.id];
  const isSuggestedAnswerShown = shownAnswerId === activeQuestion.id;
  const choice = isChoiceQuestion(activeQuestion);
  const kind = questionKind(activeQuestion);
  const selectedIds = toSelectedIds(activeQuestion, answer);
  const hasSelection = isAnswerProvided(activeQuestion, answer);
  const isChecked = checked[activeQuestion.id] === true;
  const correctness = isChecked ? isAnswerCorrect(activeQuestion, answer) : null;
  const correctIds = getCorrectIds(activeQuestion);
  const score = scoreAnswers(quizQuestions, session.answers);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <Link to="/quizzes" className="text-sm font-semibold text-gray-600 hover:text-gray-900">
        Back to My quizzes
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
              className="h-auto min-w-0 border-gray-300 px-2 py-1 text-2xl font-bold tracking-tight md:text-3xl"
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
            <h1 className="m-0 text-3xl font-bold tracking-tight text-gray-900">{session.title}</h1>
            <Button type="button" variant="ghost" size="icon-xs" aria-label="Edit quiz title" title="Edit quiz title" onClick={startEditingTitle}>
              <Pencil aria-hidden="true" />
            </Button>
          </div>
        )}
        <span className="text-sm text-gray-600">{saving ? 'Saving...' : 'Saved'}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <p className="m-0 text-base font-semibold text-gray-900">
          Question {activeIndex + 1} of {quizQuestions.length}
        </p>
        {score.gradeable > 0 && (
          <Badge variant="secondary" aria-label={`Quiz score: ${score.correct} of ${score.gradeable} correct`}>
            {score.correct}/{score.gradeable} correct
          </Badge>
        )}
        {session.completed && (
          <Badge variant="outline" className="border-green-300 bg-green-50 text-green-800">
            Quiz complete
          </Badge>
        )}
      </div>

      {session.completed && score.gradeable > 0 && (
        <section aria-label="Quiz results" className="rounded-xl border border-gray-200 bg-gray-50 p-5">
          <h2 className="m-0 text-lg font-semibold text-gray-900">
            You scored {score.correct} of {score.gradeable}
          </h2>
          <ol className="mt-3 grid gap-1.5">
            {quizQuestions.map((question, index) => {
              const result = isAnswerCorrect(question, session.answers[question.id]);
              return (
                <li key={question.id}>
                  <button
                    type="button"
                    onClick={() => goToQuestion(index)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-gray-100"
                    aria-label={`Review question ${index + 1}: ${question.title} — ${result === null ? 'written' : result ? 'correct' : 'incorrect'}`}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                        result === true && 'bg-green-600 text-white',
                        result === false && 'bg-red-600 text-white',
                        result === null && 'bg-gray-200 text-gray-700',
                      )}
                    >
                      {result === true ? <Check className="size-3" /> : result === false ? <X className="size-3" /> : index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-gray-900">{question.title}</span>
                    <span className="shrink-0 text-xs text-gray-500">
                      {result === null ? 'Written' : result ? 'Correct' : 'Incorrect'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="m-0 flex-1 text-xl font-semibold text-gray-900">{activeQuestion.title}</h2>
          <Badge variant="outline">{questionKindLabels[kind]}</Badge>
        </div>
        <p className="mt-1 font-mono text-xs text-gray-500">{activeQuestion.id}</p>
        {activeQuestion.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {activeQuestion.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        <MarkdownContent content={activeQuestion.prompt} className="mt-4 text-base leading-relaxed text-gray-800" />

        {choice ? (
          <div className="mt-6">
            <p id="quiz-choices-label" className="text-sm font-semibold text-gray-900">
              {kind === 'single' ? 'Choose one answer' : 'Choose all that apply'}
            </p>
            <div role={kind === 'single' ? 'radiogroup' : 'group'} aria-labelledby="quiz-choices-label" className="mt-2 grid gap-2">
              {(activeQuestion.options ?? []).map((option, index) => {
                const selected = selectedIds.includes(option.id);
                const isCorrectOption = correctIds.includes(option.id);
                const showCorrectness = isChecked;
                return (
                  <label
                    key={option.id}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                      !showCorrectness && selected && 'border-gray-900 bg-gray-50',
                      !showCorrectness && !selected && 'border-gray-300 bg-white hover:border-gray-500',
                      showCorrectness && isCorrectOption && 'border-green-600 bg-green-50',
                      showCorrectness && !isCorrectOption && selected && 'border-red-600 bg-red-50',
                      showCorrectness && !isCorrectOption && !selected && 'border-gray-200 bg-white opacity-70',
                    )}
                  >
                    <input
                      type={kind === 'single' ? 'radio' : 'checkbox'}
                      name={`quiz-choice-${activeQuestion.id}`}
                      checked={selected}
                      onChange={() => toggleOption(activeQuestion.id, option.id, kind === 'single')}
                      className="mt-1 size-4 shrink-0 accent-gray-900"
                      aria-label={`Option ${optionLetter(index)}`}
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                        showCorrectness && isCorrectOption
                          ? 'border-green-600 bg-green-600 text-white'
                          : showCorrectness && selected
                            ? 'border-red-600 bg-red-600 text-white'
                            : selected
                              ? 'border-gray-900 bg-gray-900 text-white'
                              : 'border-gray-300 bg-white text-gray-600',
                      )}
                    >
                      {optionLetter(index)}
                    </span>
                    <MarkdownContent content={option.text} className="min-w-0 flex-1 text-base leading-7" />
                    {showCorrectness && isCorrectOption && (
                      <Badge variant="outline" className="shrink-0 border-green-600 bg-white text-green-800">
                        Correct
                      </Badge>
                    )}
                    {showCorrectness && !isCorrectOption && selected && (
                      <Badge variant="outline" className="shrink-0 border-red-600 bg-white text-red-800">
                        Yours
                      </Badge>
                    )}
                  </label>
                );
              })}
            </div>

            {isChecked && correctness !== null && (
              <div
                role="status"
                className={cn(
                  'mt-4 rounded-lg border p-4 text-sm font-medium',
                  correctness ? 'border-green-300 bg-green-50 text-green-900' : 'border-red-300 bg-red-50 text-red-900',
                )}
              >
                {correctness
                  ? 'Correct — nice work.'
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
        ) : (
          <div className="mt-6">
            <label htmlFor="quiz-answer" className="text-sm font-semibold text-gray-900">
              Your answer
            </label>
            <textarea
              id="quiz-answer"
              value={typeof answer === 'string' ? answer : ''}
              onChange={(event) => updateWrittenAnswer(event.target.value)}
              placeholder="Write your working or notes here..."
              className="mt-2 block min-h-40 w-full resize-y rounded-lg border border-gray-300 bg-white p-3 text-base leading-relaxed text-gray-900 outline-none placeholder:text-gray-400"
            />
          </div>
        )}

        {suggestedAnswer && (choice ? isSuggestedAnswerShown : true) && (
          <div className="mt-5">
            {!choice && (
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
              <section id="suggested-answer" className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h3 className="m-0 text-base font-semibold text-gray-900">
                  {choice ? 'Explanation' : 'Suggested answer'}
                </h3>
                <MarkdownContent content={suggestedAnswer} className="mt-3 text-sm leading-relaxed text-gray-800" />
              </section>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
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
            <Button onClick={() => updateQuestionStatus('revisit')} disabled={session.completed} className="bg-amber-400 text-gray-950 hover:bg-amber-500">
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
