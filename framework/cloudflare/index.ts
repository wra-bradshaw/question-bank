// Cloudflare sync backend: one SQLite-backed Durable Object per bank
// namespace stores quizzes and question statuses. Import from
// "question-bank-framework/cloudflare" in your Worker entry (src/server.ts):
//
//   import handler from '@tanstack/react-start/server-entry';
//   import { handleQuestionBankRequest } from 'question-bank-framework/cloudflare';
//   export { QuestionBankStore } from 'question-bank-framework/cloudflare';
//   export default {
//     async fetch(request, env) {
//       return (await handleQuestionBankRequest(request, env)) ?? handler.fetch(request);
//     },
//   };
//
// and bind it in wrangler.jsonc (see template/wrangler.jsonc). Local dev with
// @cloudflare/vite-plugin runs the same code in workerd and persists to
// .wrangler/state. Framework-owned: eject with `qb reveal framework/cloudflare/index.ts`.
//
// No Workers type packages needed: the few runtime types used are declared
// structurally below.

interface SqlStorage {
  exec<T = Record<string, string | number | null>>(query: string, ...bindings: unknown[]): { toArray(): T[] };
}

interface DurableObjectState {
  storage: { sql: SqlStorage };
}

interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

interface DurableObjectNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStub;
}

const MAX_BODY_BYTES = 1_000_000;
const NAMESPACE_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
const statuses = new Set(['unanswered', 'revisit', 'complete']);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const error = (status: number, message: string) => json({ error: message }, status);

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isQuizAnswer = (value: unknown) =>
  typeof value === 'string' ||
  (Array.isArray(value) && value.every((item) => typeof item === 'string')) ||
  (isObject(value) && Object.values(value).every((item) => typeof item === 'string'));

interface StoredQuiz {
  id: string;
  title: string;
  questionIds: string[];
  answers: Record<string, unknown>;
  currentQuestion: number;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

function parseQuiz(id: string, body: unknown): StoredQuiz | null {
  if (!isObject(body)) return null;
  const { title, questionIds, answers, currentQuestion, completed, createdAt, updatedAt } = body;
  if (body.id !== id || typeof title !== 'string' || title.length > 500) return null;
  if (!Array.isArray(questionIds) || !questionIds.every((q) => typeof q === 'string')) return null;
  if (!isObject(answers) || !Object.values(answers).every(isQuizAnswer)) return null;
  if (!Number.isInteger(currentQuestion) || typeof completed !== 'boolean') return null;
  if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) return null;
  return {
    id,
    title,
    questionIds: questionIds as string[],
    answers,
    currentQuestion: currentQuestion as number,
    completed,
    createdAt: createdAt as number,
    updatedAt: updatedAt as number,
  };
}

async function readBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new Error('too large');
  return JSON.parse(text);
}

/** Durable Object holding one bank namespace. Export it from your Worker entry. */
export class QuestionBankStore {
  private sql: SqlStorage;

  constructor(state: DurableObjectState, _env: unknown) {
    this.sql = state.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0
    )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS statuses (
      question_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`);
  }

  async fetch(request: Request): Promise<Response> {
    const segments = new URL(request.url).pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const [collection, key] = segments;
    try {
      if (collection === 'quizzes' && segments.length === 1 && request.method === 'GET') return this.listQuizzes();
      if (collection === 'quizzes' && key && segments.length === 2) {
        if (request.method === 'PUT') return this.putQuiz(key, await readBody(request));
        if (request.method === 'DELETE') return this.deleteQuiz(key);
      }
      if (collection === 'statuses' && segments.length === 1 && request.method === 'GET') return this.listStatuses();
      if (collection === 'statuses' && key && segments.length === 2 && request.method === 'PUT') {
        return this.putStatus(key, await readBody(request));
      }
      return error(404, 'Not found');
    } catch {
      return error(400, 'Bad request');
    }
  }

  private listQuizzes(): Response {
    const rows = this.sql.exec<{ id: string; data: string; deleted: number }>(
      'SELECT id, data, deleted FROM quizzes ORDER BY created_at DESC',
    ).toArray();
    return json({
      quizzes: rows.filter((row) => !row.deleted).map((row) => JSON.parse(row.data) as StoredQuiz),
      deleted: rows.filter((row) => row.deleted).map((row) => row.id),
    });
  }

  /** Upsert, keeping whichever copy has the newer updatedAt. Returns the stored copy; 410 if deleted. */
  private putQuiz(id: string, body: unknown): Response {
    const quiz = parseQuiz(id, body);
    if (!quiz) return error(400, 'Invalid quiz');
    const [existing] = this.sql.exec<{ data: string; updated_at: number; deleted: number }>(
      'SELECT data, updated_at, deleted FROM quizzes WHERE id = ?',
      id,
    ).toArray();
    if (existing?.deleted) return json({ deleted: true }, 410);
    if (existing && existing.updated_at >= quiz.updatedAt) return json(JSON.parse(existing.data));
    this.sql.exec(
      `INSERT INTO quizzes (id, data, created_at, updated_at, deleted) VALUES (?, ?, ?, ?, 0)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      id,
      JSON.stringify(quiz),
      quiz.createdAt,
      quiz.updatedAt,
    );
    return json(quiz);
  }

  /** Tombstone, so stale browser caches can't resurrect the quiz. */
  private deleteQuiz(id: string): Response {
    const now = Date.now();
    this.sql.exec(
      `INSERT INTO quizzes (id, data, created_at, updated_at, deleted) VALUES (?, '{}', ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET data = '{}', updated_at = excluded.updated_at, deleted = 1`,
      id,
      now,
      now,
    );
    return json({ deleted: true });
  }

  private listStatuses(): Response {
    const rows = this.sql.exec<{ question_id: string; status: string; updated_at: number }>(
      'SELECT question_id, status, updated_at FROM statuses',
    ).toArray();
    return json(Object.fromEntries(rows.map((row) => [row.question_id, { status: row.status, updatedAt: row.updated_at }])));
  }

  private putStatus(questionId: string, body: unknown): Response {
    if (!isObject(body) || typeof body.status !== 'string' || !statuses.has(body.status) || !Number.isFinite(body.updatedAt)) {
      return error(400, 'Invalid status');
    }
    const updatedAt = body.updatedAt as number;
    this.sql.exec(
      `INSERT INTO statuses (question_id, status, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(question_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at
       WHERE excluded.updated_at > statuses.updated_at`,
      questionId,
      body.status,
      updatedAt,
    );
    const [row] = this.sql.exec<{ status: string; updated_at: number }>(
      'SELECT status, updated_at FROM statuses WHERE question_id = ?',
      questionId,
    ).toArray();
    return json({ status: row!.status, updatedAt: row!.updated_at });
  }
}

export interface QuestionBankHandlerOptions {
  /** URL prefix the API is served under; must match the bank's `sync.url`. Default "/api/qb". */
  prefix?: string;
  /** Name of the Durable Object binding in wrangler.jsonc. Default "QB_STORE". */
  binding?: string;
  /**
   * Gate every request, e.g. verify a Cloudflare Access JWT. Return false to
   * answer 401. Without it the API is open to anyone who can reach the Worker.
   */
  authorize?: (request: Request) => boolean | Promise<boolean>;
}

/**
 * Serve the sync API. Returns null for requests outside `prefix`, so the
 * caller can fall through to the app handler.
 */
export async function handleQuestionBankRequest(
  request: Request,
  env: object,
  options: QuestionBankHandlerOptions = {},
): Promise<Response | null> {
  const prefix = (options.prefix ?? '/api/qb').replace(/\/+$/, '');
  const url = new URL(request.url);
  if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return null;
  if (options.authorize && !(await options.authorize(request))) return error(401, 'Unauthorized');

  const [namespace, ...rest] = url.pathname.slice(prefix.length).split('/').filter(Boolean);
  const name = namespace ? decodeURIComponent(namespace) : '';
  if (!NAMESPACE_PATTERN.test(name)) return error(404, 'Not found');

  const binding = (env as Record<string, unknown>)[options.binding ?? 'QB_STORE'] as DurableObjectNamespace | undefined;
  if (!binding || typeof binding.idFromName !== 'function') {
    return error(500, `Durable Object binding "${options.binding ?? 'QB_STORE'}" is not configured.`);
  }
  const stub = binding.get(binding.idFromName(name));
  const inner = new URL(`https://qb.internal/${rest.join('/')}`);
  return stub.fetch(new Request(inner, request));
}
