// Framework-owned: eject with `qb reveal framework/components/quiz-page.tsx`.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { Check, Pencil, X } from 'lucide-react';
import { useBank } from '../../core/config.tsx';
import type { QuestionStatus, QuizSession } from '../../core/types.ts';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { MarkdownContent } from './markdown-content';
import { setQuestionStatus } from '../lib/question-status-storage.ts';
import { getQuiz, saveQuizLocally, saveQuizProgress } from '../lib/quiz-storage.ts';

export function QuizPage() {
  const bank = useBank();
  const { quizId } = useParams({ from: '/quiz/$quizId' });
  const [session, setSession] = useState<QuizSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shownAnswerId, setShownAnswerId] = useState<string | null>(null);
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

  const updateAnswer = (value: string) => {
    if (!activeQuestion) return;
    setSession((current) =>
      current ? { ...current, completed: false, answers: { ...current.answers, [activeQuestion.id]: value } } : current,
    );
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

  const answer = session.answers[activeQuestion.id] ?? '';
  const suggestedAnswer = bank.answers[activeQuestion.id];
  const isSuggestedAnswerShown = shownAnswerId === activeQuestion.id;

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

      <p className="text-base font-semibold text-gray-900">
        Question {activeIndex + 1} of {quizQuestions.length}
      </p>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="m-0 text-xl font-semibold text-gray-900">{activeQuestion.title}</h2>
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

        <div className="mt-6">
          <label htmlFor="quiz-answer" className="text-sm font-semibold text-gray-900">
            Your answer
          </label>
          <textarea
            id="quiz-answer"
            value={answer}
            onChange={(event) => updateAnswer(event.target.value)}
            placeholder="Write your working or notes here..."
            className="mt-2 block min-h-40 w-full resize-y rounded-lg border border-gray-300 bg-white p-3 text-base leading-relaxed text-gray-900 outline-none placeholder:text-gray-400"
          />
        </div>

        {suggestedAnswer && (
          <div className="mt-5">
            <Button
              variant="outline"
              aria-expanded={isSuggestedAnswerShown}
              aria-controls="suggested-answer"
              onClick={() => setShownAnswerId(isSuggestedAnswerShown ? null : activeQuestion.id)}
            >
              {isSuggestedAnswerShown ? 'Hide answer' : 'Show answer'}
            </Button>
            {isSuggestedAnswerShown && (
              <section id="suggested-answer" className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h3 className="m-0 text-base font-semibold text-gray-900">Suggested answer</h3>
                <MarkdownContent content={suggestedAnswer} className="mt-3 text-sm leading-relaxed text-gray-800" />
              </section>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" onClick={() => goToQuestion(Math.max(activeIndex - 1, 0))} disabled={activeIndex === 0}>
            Previous
          </Button>
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
