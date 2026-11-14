// Per-question status (unanswered/revisit/complete). localStorage is the
// working copy; with `sync` set, changes are pushed to the server and merged
// back (newest `updatedAt` wins).
// Framework-owned: eject with `qb reveal framework/lib/question-status-storage.ts`.

import { questionStatuses, type QuestionStatus, type QuestionStatusMap } from '../../core/types.ts';
import { readLocal, syncEnabled, syncRequest, writeLocal, type StorageTarget } from './sync-client.ts';

type StoredQuestionStatus = {
  status: QuestionStatus;
  updatedAt: number;
  /** Not yet confirmed by the server. */
  pending: boolean;
};

type RemoteStatus = { status: QuestionStatus; updatedAt: number };

const keyFor = (namespace: string) => `${namespace}-question-bank-statuses`;

const isQuestionStatus = (value: unknown): value is QuestionStatus =>
  typeof value === 'string' && (questionStatuses as readonly string[]).includes(value);

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const readLocalStatuses = (namespace: string): Record<string, StoredQuestionStatus> => {
  const value = readLocal(keyFor(namespace), {}, isObject);
  return Object.fromEntries(
    Object.entries(value).flatMap(([questionId, entry]) => {
      if (!isObject(entry) || !isQuestionStatus(entry.status) || typeof entry.updatedAt !== 'number') return [];
      return [[questionId, { status: entry.status, updatedAt: entry.updatedAt, pending: entry.pending === true }]];
    }),
  );
};

const writeLocalStatuses = (namespace: string, statuses: Record<string, StoredQuestionStatus>) =>
  writeLocal(keyFor(namespace), statuses);

const toStatusMap = (statuses: Record<string, StoredQuestionStatus>): QuestionStatusMap =>
  Object.fromEntries(Object.entries(statuses).map(([questionId, entry]) => [questionId, entry.status]));

/** Push one status; on success mark it confirmed unless it changed meanwhile. */
async function pushStatus(target: StorageTarget, questionId: string, entry: StoredQuestionStatus): Promise<void> {
  const { data } = await syncRequest<RemoteStatus>(target, `/statuses/${encodeURIComponent(questionId)}`, {
    method: 'PUT',
    body: { status: entry.status, updatedAt: entry.updatedAt },
  });
  const latest = readLocalStatuses(target.namespace);
  const current = latest[questionId];
  if (current && current.updatedAt === entry.updatedAt) {
    latest[questionId] = { status: data.status, updatedAt: data.updatedAt, pending: false };
    writeLocalStatuses(target.namespace, latest);
  }
}

export async function getQuestionStatuses(target: StorageTarget): Promise<QuestionStatusMap> {
  const local = readLocalStatuses(target.namespace);
  if (!syncEnabled(target)) return toStatusMap(local);
  try {
    await Promise.all(
      Object.entries(local)
        .filter(([, entry]) => entry.pending)
        .map(([questionId, entry]) => pushStatus(target, questionId, entry)),
    );
    const { data } = await syncRequest<Record<string, RemoteStatus>>(target, '/statuses');
    const merged: Record<string, StoredQuestionStatus> = Object.fromEntries(
      Object.entries(data).map(([questionId, entry]) => [questionId, { ...entry, pending: false }]),
    );
    for (const [questionId, entry] of Object.entries(readLocalStatuses(target.namespace))) {
      const server = merged[questionId];
      if (!server || entry.updatedAt > server.updatedAt) merged[questionId] = { ...entry, pending: true };
    }
    writeLocalStatuses(target.namespace, merged);
    return toStatusMap(merged);
  } catch {
    return toStatusMap(readLocalStatuses(target.namespace));
  }
}

export async function setQuestionStatus(target: StorageTarget, questionId: string, status: QuestionStatus): Promise<void> {
  const statuses = readLocalStatuses(target.namespace);
  const entry: StoredQuestionStatus = { status, updatedAt: Date.now(), pending: true };
  statuses[questionId] = entry;
  writeLocalStatuses(target.namespace, statuses);
  if (!syncEnabled(target)) return;
  try {
    await pushStatus(target, questionId, entry);
  } catch {
    // Stays pending; retried on the next getQuestionStatuses.
  }
}
