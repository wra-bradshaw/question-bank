// Typed Convex function references. No value imports — safe to eject.
// Framework-owned: eject with `qb reveal framework/lib/convex-api.ts`.

import { makeFunctionReference } from 'convex/server';
import type { QuestionStatus, QuizSession } from '../../core/types.ts';

type CreateQuizArgs = { title: string; questionIds: string[] };
type ProgressArgs = {
  quizId: string;
  title: string;
  answers: Record<string, string>;
  currentQuestion: number;
  completed: boolean;
};
type QuizDocument = QuizSession & { _id: string; _creationTime: number };
type QuestionStatusDocument = {
  _id: string;
  _creationTime: number;
  questionId: string;
  status: QuestionStatus;
  updatedAt: number;
};

export const convexApi = {
  quizzes: {
    create: makeFunctionReference<'mutation', CreateQuizArgs, string>('quizzes:create'),
    get: makeFunctionReference<'query', { quizId: string }, QuizDocument | null>('quizzes:get'),
    list: makeFunctionReference<'query', Record<string, never>, QuizDocument[]>('quizzes:list'),
    remove: makeFunctionReference<'mutation', { quizId: string }, null>('quizzes:remove'),
    saveProgress: makeFunctionReference<'mutation', ProgressArgs, null>('quizzes:saveProgress'),
  },
  questionStatuses: {
    list: makeFunctionReference<'query', Record<string, never>, QuestionStatusDocument[]>('questionStatuses:list'),
    set: makeFunctionReference<'mutation', { questionId: string; status: QuestionStatus }, number>('questionStatuses:set'),
  },
};
