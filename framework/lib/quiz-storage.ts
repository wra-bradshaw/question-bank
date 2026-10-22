// Quiz persistence: Convex when VITE_CONVEX_URL is set, localStorage fallback.
// Namespaced per bank via `namespace` so multiple banks can coexist.
// Framework-owned: eject with `qb reveal framework/lib/quiz-storage.ts`.

import { ConvexHttpClient } from 'convex/browser';
import { convexApi } from './convex-api.ts';
import type { QuizSession } from '../../core/types.ts';

const convexUrl = import.meta.env?.VITE_CONVEX_URL || (import.meta.env?.CONVEX_URL as string | undefined);
const convexClient = convexUrl ? new ConvexHttpClient(convexUrl) : null;

type QuizDocument = QuizSession & { _id: string; _creationTime: number };

const keyFor = (namespace: string) => `${namespace}-question-bank-quizzes`;

const readLocalQuizzes = (namespace: string): QuizSession[] => {
  if (typeof window === 'undefined') return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(keyFor(namespace)) ?? '[]');
    return Array.isArray(value) ? (value as QuizSession[]) : [];
  } catch {
    return [];
  }
};

const writeLocalQuizzes = (namespace: string, quizzes: QuizSession[]) => {
  if (typeof window !== 'undefined') window.localStorage.setItem(keyFor(namespace), JSON.stringify(quizzes));
};

export function saveQuizLocally(namespace: string, session: QuizSession): void {
  writeLocalQuizzes(namespace, [session, ...readLocalQuizzes(namespace).filter((quiz) => quiz.id !== session.id)]);
}

export async function deleteQuiz(namespace: string, id: string): Promise<void> {
  if (convexClient && !id.startsWith('local_')) {
    await convexClient.mutation(convexApi.quizzes.remove, { quizId: id });
  }
  writeLocalQuizzes(
    namespace,
    readLocalQuizzes(namespace).filter((quiz) => quiz.id !== id),
  );
}

const fromDocument = (document: QuizDocument): QuizSession => ({
  id: document._id,
  title: document.title,
  questionIds: document.questionIds,
  answers: document.answers,
  currentQuestion: document.currentQuestion,
  completed: document.completed,
  createdAt: document.createdAt ?? document._creationTime,
});

export async function createQuiz(namespace: string, title: string, questionIds: string[]): Promise<QuizSession> {
  const localSession: QuizSession = {
    id: `local_${crypto.randomUUID()}`,
    title,
    questionIds,
    answers: {},
    currentQuestion: 0,
    completed: false,
    createdAt: Date.now(),
  };

  if (convexClient) {
    try {
      const id = await convexClient.mutation(convexApi.quizzes.create, { title, questionIds });
      return { ...localSession, id };
    } catch {
      writeLocalQuizzes(namespace, [localSession, ...readLocalQuizzes(namespace)]);
      return localSession;
    }
  }

  writeLocalQuizzes(namespace, [localSession, ...readLocalQuizzes(namespace)]);
  return localSession;
}

export async function getQuiz(namespace: string, id: string): Promise<QuizSession | null> {
  const localSession = readLocalQuizzes(namespace).find((quiz) => quiz.id === id);
  if (id.startsWith('local_') || !convexClient) return localSession ?? null;
  try {
    const document = await convexClient.query(convexApi.quizzes.get, { quizId: id });
    return document ? fromDocument(document) : (localSession ?? null);
  } catch {
    return localSession ?? null;
  }
}

export async function saveQuizProgress(
  namespace: string,
  session: QuizSession,
  progress: Pick<QuizSession, 'title' | 'answers' | 'currentQuestion' | 'completed'>,
): Promise<void> {
  const updated = { ...session, ...progress };
  saveQuizLocally(namespace, updated);
  if (!convexClient || updated.id.startsWith('local_')) return;
  await convexClient.mutation(convexApi.quizzes.saveProgress, {
    quizId: updated.id,
    title: updated.title,
    answers: updated.answers,
    currentQuestion: updated.currentQuestion,
    completed: updated.completed,
  });
}

export async function listQuizzes(namespace: string): Promise<QuizSession[]> {
  const localQuizzes = readLocalQuizzes(namespace);
  if (!convexClient) return localQuizzes;
  try {
    const documents = await convexClient.query(convexApi.quizzes.list, {});
    const remoteQuizzes = documents.map(fromDocument);
    const ids = new Set(remoteQuizzes.map((quiz) => quiz.id));
    return [...remoteQuizzes, ...localQuizzes.filter((quiz) => !ids.has(quiz.id))];
  } catch {
    return localQuizzes;
  }
}
