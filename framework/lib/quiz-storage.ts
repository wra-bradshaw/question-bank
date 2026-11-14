// Quiz persistence. localStorage is always the working copy; when the bank
// sets `sync`, every change is also pushed to the server and the two are
// reconciled (newest `updatedAt` wins, deletions are tombstoned server-side).
// Framework-owned: eject with `qb reveal framework/lib/quiz-storage.ts`.

import type { QuizSession } from '../../core/types.ts';
import { readLocal, syncEnabled, syncRequest, writeLocal, type StorageTarget } from './sync-client.ts';

const keyFor = (namespace: string) => `${namespace}-question-bank-quizzes`;
const pendingDeletesKeyFor = (namespace: string) => `${namespace}-question-bank-quiz-deletes`;

const isQuizList = (value: unknown): value is QuizSession[] => Array.isArray(value);
const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const readLocalQuizzes = (namespace: string): QuizSession[] => readLocal(keyFor(namespace), [], isQuizList);
const writeLocalQuizzes = (namespace: string, quizzes: QuizSession[]) => writeLocal(keyFor(namespace), sortQuizzes(quizzes));
const readPendingDeletes = (namespace: string): string[] => readLocal(pendingDeletesKeyFor(namespace), [], isStringList);
const writePendingDeletes = (namespace: string, ids: string[]) => writeLocal(pendingDeletesKeyFor(namespace), ids);

const versionOf = (quiz: QuizSession): number => quiz.updatedAt ?? quiz.createdAt;
const sortQuizzes = (quizzes: QuizSession[]) => [...quizzes].sort((a, b) => b.createdAt - a.createdAt);

function upsertLocal(namespace: string, session: QuizSession): void {
  writeLocalQuizzes(namespace, [session, ...readLocalQuizzes(namespace).filter((quiz) => quiz.id !== session.id)]);
}

function removeLocal(namespace: string, id: string): void {
  writeLocalQuizzes(namespace, readLocalQuizzes(namespace).filter((quiz) => quiz.id !== id));
}

/** Push one quiz. The server keeps the newer copy and returns what it stored (410 when deleted). */
async function pushQuiz(target: StorageTarget, session: QuizSession): Promise<void> {
  if (!syncEnabled(target)) return;
  const { status, data } = await syncRequest<QuizSession>(target, `/quizzes/${encodeURIComponent(session.id)}`, {
    method: 'PUT',
    body: { ...session, updatedAt: versionOf(session) },
  });
  if (status === 410) {
    removeLocal(target.namespace, session.id);
    return;
  }
  const local = readLocalQuizzes(target.namespace).find((quiz) => quiz.id === session.id);
  if (!local || versionOf(data) > versionOf(local)) upsertLocal(target.namespace, data);
}

/**
 * Two-way merge: retry pending deletes, adopt newer server copies, drop
 * server-deleted quizzes, and upload local quizzes the server lacks or has
 * an older copy of. Falls back to the local list when the server is unreachable.
 */
async function reconcile(target: StorageTarget): Promise<QuizSession[]> {
  const namespace = target.namespace;
  if (!syncEnabled(target)) return sortQuizzes(readLocalQuizzes(namespace));
  try {
    const pending = readPendingDeletes(namespace);
    for (const id of pending) {
      await syncRequest(target, `/quizzes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    }
    if (pending.length > 0) writePendingDeletes(namespace, []);

    const { data } = await syncRequest<{ quizzes: QuizSession[]; deleted: string[] }>(target, '/quizzes');
    const deleted = new Set(data.deleted);
    const remote = new Map(data.quizzes.map((quiz) => [quiz.id, quiz]));
    const merged = new Map<string, QuizSession>(remote);
    const uploads: QuizSession[] = [];
    for (const local of readLocalQuizzes(namespace)) {
      if (deleted.has(local.id)) continue;
      const server = remote.get(local.id);
      if (!server || versionOf(local) > versionOf(server)) {
        merged.set(local.id, local);
        uploads.push(local);
      }
    }
    writeLocalQuizzes(namespace, [...merged.values()]);
    await Promise.all(uploads.map((quiz) => pushQuiz(target, quiz)));
    return sortQuizzes(readLocalQuizzes(namespace));
  } catch {
    return sortQuizzes(readLocalQuizzes(namespace));
  }
}

export async function createQuiz(target: StorageTarget, title: string, questionIds: string[]): Promise<QuizSession> {
  const now = Date.now();
  const session: QuizSession = {
    id: crypto.randomUUID(),
    title,
    questionIds,
    answers: {},
    currentQuestion: 0,
    completed: false,
    createdAt: now,
    updatedAt: now,
  };
  upsertLocal(target.namespace, session);
  await pushQuiz(target, session).catch(() => {
    // Stays local; the next reconcile uploads it.
  });
  return session;
}

export async function getQuiz(target: StorageTarget, id: string): Promise<QuizSession | null> {
  const quizzes = await reconcile(target);
  return quizzes.find((quiz) => quiz.id === id) ?? null;
}

export async function listQuizzes(target: StorageTarget): Promise<QuizSession[]> {
  return reconcile(target);
}

/** Record a change locally (stamps `updatedAt`). Call `syncQuiz` afterwards to push it. */
export function saveQuizLocally(target: StorageTarget, session: QuizSession): QuizSession {
  const updated = { ...session, updatedAt: Math.max(Date.now(), versionOf(session) + 1) };
  upsertLocal(target.namespace, updated);
  return updated;
}

/** Push a locally saved quiz. A failed push stays local; the next reconcile uploads it. */
export async function syncQuiz(target: StorageTarget, session: QuizSession): Promise<void> {
  await pushQuiz(target, session).catch(() => {});
}

/** saveQuizLocally + syncQuiz. */
export async function saveQuiz(target: StorageTarget, session: QuizSession): Promise<QuizSession> {
  const updated = saveQuizLocally(target, session);
  await syncQuiz(target, updated);
  return updated;
}

export async function deleteQuiz(target: StorageTarget, id: string): Promise<void> {
  removeLocal(target.namespace, id);
  if (!syncEnabled(target)) return;
  try {
    await syncRequest(target, `/quizzes/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {
    writePendingDeletes(target.namespace, [...new Set([...readPendingDeletes(target.namespace), id])]);
  }
}

// Replaces a quiz's question list (reorder / remove / append). Answers for
// removed questions are dropped and the current position is kept on the same
// question where possible.
export async function setQuizQuestions(target: StorageTarget, session: QuizSession, questionIds: string[]): Promise<QuizSession> {
  const kept = new Set(questionIds);
  const answers = Object.fromEntries(Object.entries(session.answers).filter(([id]) => kept.has(id)));
  const currentId = session.questionIds[session.currentQuestion];
  const currentIndex = currentId === undefined ? -1 : questionIds.indexOf(currentId);
  const currentQuestion = currentIndex >= 0 ? currentIndex : Math.min(session.currentQuestion, Math.max(questionIds.length - 1, 0));
  return saveQuiz(target, { ...session, questionIds, answers, currentQuestion });
}
