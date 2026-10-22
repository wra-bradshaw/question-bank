// Framework-owned: eject with `qb reveal framework/components/quiz-list.tsx`.

import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { useBank } from '../../core/config.tsx';
import type { QuizSession } from '../../core/types.ts';
import { Button } from './ui/button';
import { deleteQuiz, listQuizzes } from '../lib/quiz-storage.ts';

export function QuizList() {
  const bank = useBank();
  const [quizzes, setQuizzes] = useState<QuizSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState(false);

  useEffect(() => {
    let active = true;
    listQuizzes(bank.namespace).then((items) => {
      if (active) setQuizzes(items);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [bank.namespace]);

  const removeQuiz = async (quiz: QuizSession) => {
    setDeletingId(quiz.id);
    setDeleteError(false);
    try {
      await deleteQuiz(bank.namespace, quiz.id);
      setQuizzes((current) => current.filter((item) => item.id !== quiz.id));
    } catch {
      setDeleteError(true);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-3xl font-bold tracking-tight text-gray-900">My quizzes</h1>
          <p className="mt-2 text-base text-gray-600">Pick up where you left off. Your answers are saved as you go.</p>
        </div>
        <Button asChild>
          <Link to="/">Build a quiz</Link>
        </Button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-600">Loading your quizzes...</div>
      ) : quizzes.length > 0 ? (
        <div>
          {deleteError && (
            <p role="alert" className="mb-3 text-sm text-red-700">
              Could not delete that quiz. Please try again.
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {quizzes.map((quiz) => {
              const answeredCount = Object.values(quiz.answers).filter((answer) => answer.trim().length > 0).length;
              return (
                <div key={quiz.id} className="group relative">
                  <Link
                    to="/quiz/$quizId"
                    params={{ quizId: quiz.id }}
                    className="block rounded-xl border border-gray-200 bg-white p-5 transition-colors hover:border-gray-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500"
                  >
                    <h2 className="m-0 pr-10 text-lg font-semibold text-gray-900">{quiz.title}</h2>
                    <p className="mt-2 text-sm text-gray-700">
                      {quiz.questionIds.length} {quiz.questionIds.length === 1 ? 'question' : 'questions'}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {answeredCount} of {quiz.questionIds.length} answered
                    </p>
                  </Link>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    aria-label={`Delete ${quiz.title}`}
                    title="Delete quiz"
                    disabled={deletingId === quiz.id}
                    onClick={() => removeQuiz(quiz)}
                    className="absolute right-3 top-3 rounded-full border-red-200 bg-white text-red-600 opacity-0 shadow-sm transition-opacity hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-xl py-16 text-center">
          <h2 className="m-0 text-xl font-semibold text-gray-900">No quizzes yet</h2>
          <p className="mt-2 text-base text-gray-600">Choose questions from the bank and turn them into a quiz that remembers your progress.</p>
          <Button asChild className="mt-6">
            <Link to="/">Browse questions</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
