// Per-question status (unanswered/revisit/complete), Convex + localStorage.
// Framework-owned: eject with `qb reveal framework/lib/question-status-storage.ts`.

import { ConvexHttpClient } from 'convex/browser';
import { convexApi } from './convex-api.ts';
import { questionStatuses, type QuestionStatus, type QuestionStatusMap } from '../../core/types.ts';

const convexUrl = import.meta.env?.VITE_CONVEX_URL || (import.meta.env?.CONVEX_URL as string | undefined);
const convexClient = convexUrl ? new ConvexHttpClient(convexUrl) : null;

type StoredQuestionStatus = {
  status: QuestionStatus;
  updatedAt: number;
  pending: boolean;
};

type QuestionStatusDocument = {
  questionId: string;
  status: QuestionStatus;
  updatedAt: number;
};

const keyFor = (namespace: string) => `${namespace}-question-bank-statuses`;

const isQuestionStatus = (value: unknown): value is QuestionStatus =>
  typeof value === 'string' && (questionStatuses as readonly string[]).includes(value);

const readLocalStatuses = (namespace: string): Record<string, StoredQuestionStatus> => {
  if (typeof window === 'undefined') return {};
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(keyFor(namespace)) ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).flatMap(([questionId, entry]) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
        const stored = entry as Partial<StoredQuestionStatus>;
        if (!isQuestionStatus(stored.status) || typeof stored.updatedAt !== 'number') return [];
        return [
          [
            questionId,
            { status: stored.status, updatedAt: stored.updatedAt, pending: stored.pending === true },
          ],
        ];
      }),
    );
  } catch {
    return {};
  }
};

const writeLocalStatuses = (namespace: string, statuses: Record<string, StoredQuestionStatus>) => {
  if (typeof window !== 'undefined') window.localStorage.setItem(keyFor(namespace), JSON.stringify(statuses));
};

const toStatusMap = (statuses: Record<string, StoredQuestionStatus>): QuestionStatusMap =>
  Object.fromEntries(Object.entries(statuses).map(([questionId, entry]) => [questionId, entry.status]));

async function syncPendingStatuses(namespace: string, statuses: Record<string, StoredQuestionStatus>) {
  if (!convexClient) return statuses;
  await Promise.all(
    Object.entries(statuses).map(async ([questionId, entry]) => {
      if (!entry.pending) return;
      try {
        const updatedAt = await convexClient.mutation(convexApi.questionStatuses.set, {
          questionId,
          status: entry.status,
        });
        const latest = readLocalStatuses(namespace);
        if (latest[questionId]?.pending && latest[questionId]?.updatedAt === entry.updatedAt) {
          latest[questionId] = { status: entry.status, updatedAt, pending: false };
          writeLocalStatuses(namespace, latest);
          statuses[questionId] = latest[questionId];
        }
      } catch {
        // Keep the local status pending so it can be retried later.
      }
    }),
  );
  return statuses;
}

export async function getQuestionStatuses(namespace: string): Promise<QuestionStatusMap> {
  const localStatuses = readLocalStatuses(namespace);
  if (!convexClient) return toStatusMap(localStatuses);
  await syncPendingStatuses(namespace, localStatuses);
  try {
    const documents = (await convexClient.query(convexApi.questionStatuses.list, {})) as QuestionStatusDocument[];
    const merged: Record<string, StoredQuestionStatus> = Object.fromEntries(
      documents.map((document) => [document.questionId, { status: document.status, updatedAt: document.updatedAt, pending: false }]),
    );
    for (const [questionId, localStatus] of Object.entries(localStatuses)) {
      if (localStatus.pending || !merged[questionId]) merged[questionId] = localStatus;
    }
    writeLocalStatuses(namespace, merged);
    return toStatusMap(merged);
  } catch {
    return toStatusMap(localStatuses);
  }
}

export async function setQuestionStatus(namespace: string, questionId: string, status: QuestionStatus): Promise<void> {
  const statuses = readLocalStatuses(namespace);
  const localStatus: StoredQuestionStatus = { status, updatedAt: Date.now(), pending: true };
  statuses[questionId] = localStatus;
  writeLocalStatuses(namespace, statuses);
  if (!convexClient) return;
  try {
    const updatedAt = await convexClient.mutation(convexApi.questionStatuses.set, { questionId, status });
    const latest = readLocalStatuses(namespace);
    if (latest[questionId]?.pending && latest[questionId]?.updatedAt === localStatus.updatedAt) {
      latest[questionId] = { status, updatedAt, pending: false };
      writeLocalStatuses(namespace, latest);
    }
  } catch {
    // The local copy remains available and will be retried on the next status read.
  }
}
