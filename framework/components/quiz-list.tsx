// Framework-owned: eject with `qb reveal framework/components/quiz-list.tsx`.

import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ListOrdered, Plus, Trash2 } from 'lucide-react';
import { useBank } from '../../core/config.tsx';
import type { QuizSession } from '../../core/types.ts';
import { isAnswerProvided, scoreAnswers } from '../../core/types.ts';
import { Button } from './ui/button';
import { QuizQuestionEditor } from './quiz-question-editor';
import { deleteQuiz, listQuizzes, setQuizQuestions } from '../lib/quiz-storage.ts';

export function QuizList() {
  const bank = useBank();
  const [quizzes, setQuizzes] = useState<QuizSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<QuizSession | null>(null);

  useEffect(() => {
    let active = true;
    listQuizzes(bank).then((items) => {
      if (active) setQuizzes(items);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [bank]);

  const removeQuiz = async (quiz: QuizSession) => {
    setDeletingId(quiz.id);
    setDeleteError(false);
    try {
      await deleteQuiz(bank, quiz.id);
      setQuizzes((current) => current.filter((item) => item.id !== quiz.id));
    } catch {
      setDeleteError(true);
    } finally {
      setDeletingId(null);
    }
  };

  const saveQuestions = async (quiz: QuizSession, questionIds: string[]) => {
    const updated = await setQuizQuestions(bank, quiz, questionIds);
    setQuizzes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  };

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">My quizzes</h1>
        <Button render={<Link to="/" />} nativeButton={false}>
          <Plus data-icon="inline-start" aria-hidden="true" />
          New quiz
        </Button>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Loading your quizzes…</p>
      ) : quizzes.length > 0 ? (
        <div className="grid gap-3">
          {deleteError && (
            <p role="alert" className="text-sm text-destructive">
              Could not delete that quiz. Please try again.
            </p>
          )}
          <ul className="grid gap-3 sm:grid-cols-2">
            {quizzes.map((quiz) => {
              const questions = quiz.questionIds
                .map((id) => bank.questionById.get(id))
                .filter((question) => question !== undefined);
              const answeredCount = questions.filter((question) =>
                isAnswerProvided(question, quiz.answers[question.id]),
              ).length;
              const score = scoreAnswers(questions, quiz.answers);
              const total = quiz.questionIds.length;
              const progress = total > 0 ? Math.round((answeredCount / total) * 100) : 0;
              return (
                <li key={quiz.id} className="group relative">
                  <Link
                    to="/quiz/$quizId"
                    params={{ quizId: quiz.id }}
                    className="flex h-full flex-col gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <div className="pr-16">
                      <h2 className="text-sm font-semibold break-words">{quiz.title}</h2>
                      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                        {total} {total === 1 ? 'question' : 'questions'}
                        {score.gradeable > 0 && ` · ${score.correct}/${score.gradeable} correct`}
                      </p>
                    </div>
                    <div className="mt-auto grid gap-1.5">
                      <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {answeredCount} of {total} answered
                      </p>
                    </div>
                  </Link>
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-within:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Reorder questions in ${quiz.title}`}
                      title="Reorder or remove questions"
                      onClick={() => setEditingQuiz(quiz)}
                    >
                      <ListOrdered aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${quiz.title}`}
                      title="Delete quiz"
                      disabled={deletingId === quiz.id}
                      onClick={() => removeQuiz(quiz)}
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">No quizzes yet</p>
          <Button render={<Link to="/" />} nativeButton={false} className="mt-4">
            Browse questions
          </Button>
        </div>
      )}

      <QuizQuestionEditor
        quiz={editingQuiz}
        onOpenChange={(open) => {
          if (!open) setEditingQuiz(null);
        }}
        onSave={saveQuestions}
      />
    </div>
  );
}
