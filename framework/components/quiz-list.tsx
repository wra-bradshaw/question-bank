// Framework-owned: eject with `qb reveal framework/components/quiz-list.tsx`.

import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ListOrdered, Trash2 } from 'lucide-react';
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

  const saveQuestions = async (quiz: QuizSession, questionIds: string[]) => {
    const updated = await setQuizQuestions(bank.namespace, quiz, questionIds);
    setQuizzes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
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
              const questions = quiz.questionIds
                .map((id) => bank.questionById.get(id))
                .filter((question) => question !== undefined);
              const answeredCount = questions.filter((question) =>
                isAnswerProvided(question, quiz.answers[question.id]),
              ).length;
              const score = scoreAnswers(questions, quiz.answers);
              return (
                <div key={quiz.id} className="group relative">
                  <Link
                    to="/quiz/$quizId"
                    params={{ quizId: quiz.id }}
                    className="block rounded-xl border border-gray-200 bg-white p-5 transition-colors hover:border-gray-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500"
                  >
                    <h2 className="m-0 pr-16 text-lg font-semibold text-gray-900">{quiz.title}</h2>
                    <p className="mt-2 text-sm text-gray-700">
                      {quiz.questionIds.length} {quiz.questionIds.length === 1 ? 'question' : 'questions'}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {answeredCount} of {quiz.questionIds.length} answered
                      {score.gradeable > 0 && ` • ${score.correct}/${score.gradeable} correct`}
                    </p>
                  </Link>
                  <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-xs"
                      aria-label={`Reorder questions in ${quiz.title}`}
                      title="Reorder or remove questions"
                      onClick={() => setEditingQuiz(quiz)}
                      className="rounded-full bg-white shadow-sm"
                    >
                      <ListOrdered aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-xs"
                      aria-label={`Delete ${quiz.title}`}
                      title="Delete quiz"
                      disabled={deletingId === quiz.id}
                      onClick={() => removeQuiz(quiz)}
                      className="rounded-full border-red-200 bg-white text-red-600 shadow-sm hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
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
