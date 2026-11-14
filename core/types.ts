// Core question + bank types. Framework-owned, never ejected.
// Every question has the core fields below; subjects extend the interface
// with their own metadata (year, marks, …) and the bank stays generic over
// it — no index signatures, no `unknown`, no casts in subject code.

export const questionStatuses = ['unanswered', 'revisit', 'complete'] as const;

export type QuestionStatus = (typeof questionStatuses)[number];
export type QuestionStatusMap = Record<string, QuestionStatus>;

// ---------------------------------------------------------------------------
// Question kinds. `written` is free response; every other kind is
// auto-gradeable:
//   single / multiple — pick option(s) from `options`
//   numerical         — type a number, checked against `numeric`
//   matching          — pair each of `items` with one of the shared `options`
//   dropdown          — fill each of `blanks` from its own option list
// ---------------------------------------------------------------------------

export type QuestionKind = 'written' | 'single' | 'multiple' | 'numerical' | 'matching' | 'dropdown';

export const questionKinds: readonly QuestionKind[] = ['written', 'single', 'multiple', 'numerical', 'matching', 'dropdown'];

export const questionKindLabels: Record<QuestionKind, string> = {
  written: 'Written',
  single: 'Single choice',
  multiple: 'Multiple choice',
  numerical: 'Numerical',
  matching: 'Matching',
  dropdown: 'Dropdowns',
};

export interface QuestionOption {
  /** Stable within the question, e.g. "a", "b", "c". */
  id: string;
  /** Option body. Markdown supported. */
  text: string;
}

/** A left-hand row of a matching question, answered from the question's shared `options`. */
export interface MatchingItem {
  /** Stable within the question, e.g. "1", "2". */
  id: string;
  /** Row text. Markdown supported. */
  text: string;
  /** Id of the correct option in the question's `options`. */
  correctId: string;
}

/** One blank of a dropdown question, with its own option list. */
export interface DropdownBlank {
  /** Stable within the question, e.g. "1", "key". */
  id: string;
  /** Text shown before the dropdown, e.g. "A possible candidate key is:". Markdown supported. */
  label?: string;
  options: QuestionOption[];
  /** Id of the correct option in this blank's `options`. */
  correctId: string;
  /** Shuffle this blank's options in quizzes. Defaults to the question's `shuffle` (true). */
  shuffle?: boolean;
}

/** Expected answer of a numerical question. */
export interface NumericAnswer {
  value: number;
  /** Absolute tolerance: answers within ±tolerance of value are correct. Defaults to 0 (exact). */
  tolerance?: number;
  /** Unit shown next to the input, e.g. "I/Os" or "bytes". */
  unit?: string;
}

/**
 * Stored quiz answer:
 *   written / numerical — the typed text
 *   single / multiple   — selected option ids
 *   matching / dropdown — item/blank id → chosen option id
 */
export type QuizAnswer = string | string[] | Record<string, string>;

export interface BaseQuestion {
  id: string;
  title: string;
  prompt: string;
  tags: string[];
  /** Defaults to 'written' when omitted. Each other kind requires its own answer fields (see below). */
  kind?: QuestionKind;
  /** Choice options (single/multiple), or the shared option list of a matching question. */
  options?: QuestionOption[];
  /** Correct option ids (single/multiple). Single choice requires exactly one. */
  correctIds?: string[];
  /** Rows to match (matching). */
  items?: MatchingItem[];
  /** Blanks to fill (dropdown). */
  blanks?: DropdownBlank[];
  /** Expected number (numerical). */
  numeric?: NumericAnswer;
  /**
   * Shuffle option order in quizzes (single/multiple/matching options and
   * dropdown blank options). Defaults to true. Set false when option order is
   * meaningful, e.g. "All of the above" or options that reference each other.
   * The bank grid always shows authored order, so explanations should refer
   * to options by content, not by letter.
   */
  shuffle?: boolean;
  // Subjects extend this interface with their own fields; see template/bank.config.ts.
}

export interface QuizSession {
  id: string;
  title: string;
  questionIds: string[];
  answers: Record<string, QuizAnswer>;
  currentQuestion: number;
  completed: boolean;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Bank schema: config-defined fields.
// ---------------------------------------------------------------------------

export type BankFieldType = 'text' | 'number' | 'select' | 'multiselect';

export type BankFilterOperatorId =
  | 'is'
  | 'isNot'
  | 'contains'
  | 'doesNotContain'
  | 'startsWith'
  | 'endsWith'
  | 'eq'
  | 'neq'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'between'
  | 'isEmpty'
  | 'isNotEmpty';

export interface BankFieldOption {
  value: string;
  label: string;
}

export interface BankFieldDef<Q extends BaseQuestion = BaseQuestion> {
  /** Stable field id. Reserved: id, title, tags, status. */
  id: string;
  label: string;
  type: BankFieldType;
  /**
   * Extract the raw value from a question. Q is inferred from the bank's
   * questions. Method syntax (not a function property) keeps subject field
   * defs assignable to the stored bank with zero casts — standard
   * bivariant-method assignability, like Map/Set methods. Sound here
   * because fields are only ever called with their own bank's questions.
   */
  getValue(question: Q): string | number | null | readonly string[];
  /**
   * Fixed options for select/multiselect. When omitted, options are derived
   * from distinct values across the bank's questions (sorted).
   */
  options?: readonly BankFieldOption[];
  placeholder?: string;
  /** Include in the free-text search index. Defaults to false (id/title/prompt/tags always searched). */
  searchable?: boolean;
  /** Allowed operators. Defaults per type (same as Notion-style builder). */
  operators?: readonly BankFilterOperatorId[];
  /** Table column behaviour. `false` hides the field from the grid. */
  column?: false | { header?: string; width?: number; sortable?: boolean };
}

export interface BankSiteConfig {
  title: string;
  /** Header brand text. */
  brand: string;
  description?: string;
}

export interface DefineBankInput<Q extends BaseQuestion = BaseQuestion> {
  site: BankSiteConfig;
  /** Namespaces localStorage keys + Convex lookups. e.g. "comp20008". */
  namespace: string;
  /** Subject-specific schema. Built-ins (id/title/tags/status) are automatic. */
  fields: BankFieldDef<Q>[];
  questions: Q[];
  /** Suggested answers keyed by question id. Missing entries hide "Show answer". */
  answers?: Record<string, string>;
  /** Default sort for the grid, e.g. [{ id: "exam", desc: true }]. */
  defaultSorting?: Array<{ id: string; desc?: boolean }>;
  /**
   * Hide the built-in Tags column (and the Tags filter option). Useful when
   * tags merely duplicate dedicated fields — e.g. every tag equals a
   * topic/type value already shown in its own column. Tags still feed
   * free-text search. Defaults to false.
   */
  hideTagsColumn?: boolean;
  /** Extra per-question figures, resolved by prompt `![](/figures/…)` etc. */
  publicPath?: string;
}

export interface Bank extends DefineBankInput<BaseQuestion> {
  answers: Record<string, string>;
  questionById: Map<string, BaseQuestion>;
}

/**
 * Build a bank. Q is inferred from `questions`, so each field's getValue is
 * checked against the subject's question type — accessors use plain property
 * access, no casts or coercion helpers.
 */
export function defineBank<Q extends BaseQuestion>(input: DefineBankInput<Q>): Bank {
  for (const question of input.questions) {
    validateQuestion(question);
  }
  return {
    ...input,
    answers: input.answers ?? {},
    questionById: new Map(input.questions.map((q) => [q.id, q])),
  };
}

type KindField = 'options' | 'correctIds' | 'items' | 'blanks' | 'numeric';

const kindFields: Record<QuestionKind, readonly KindField[]> = {
  written: [],
  single: ['options', 'correctIds'],
  multiple: ['options', 'correctIds'],
  numerical: ['numeric'],
  matching: ['options', 'items'],
  dropdown: ['blanks'],
};

function validateOptionList(questionId: string, where: string, options: readonly QuestionOption[] | undefined): Set<string> {
  const list = options ?? [];
  if (list.length < 2) {
    throw new Error(`Question "${questionId}" ${where} needs at least 2 options.`);
  }
  const seen = new Set<string>();
  for (const option of list) {
    if (!option.id || seen.has(option.id)) {
      throw new Error(`Question "${questionId}" ${where} has a duplicate or empty option id "${option.id}".`);
    }
    seen.add(option.id);
  }
  return seen;
}

function validateQuestion(question: BaseQuestion): void {
  const kind: QuestionKind = question.kind ?? 'written';
  if (!questionKinds.includes(kind)) {
    throw new Error(`Question "${question.id}" has unknown kind "${question.kind}".`);
  }
  const allowed = kindFields[kind];
  for (const field of ['options', 'correctIds', 'items', 'blanks', 'numeric'] as const) {
    if (question[field] !== undefined && !allowed.includes(field)) {
      throw new Error(`Question "${question.id}" is ${kind} and must not define ${field}.`);
    }
  }
  if (question.shuffle !== undefined) {
    if (typeof question.shuffle !== 'boolean') {
      throw new Error(`Question "${question.id}" has a non-boolean shuffle.`);
    }
    if (kind === 'written' || kind === 'numerical') {
      throw new Error(`Question "${question.id}" is ${kind} and must not define shuffle.`);
    }
  }

  switch (kind) {
    case 'written':
      return;
    case 'single':
    case 'multiple': {
      const seen = validateOptionList(question.id, `(${kind})`, question.options);
      const correctIds = question.correctIds ?? [];
      if (kind === 'single' && correctIds.length !== 1) {
        throw new Error(`Question "${question.id}" (single) needs exactly one correctId.`);
      }
      if (kind === 'multiple' && correctIds.length < 1) {
        throw new Error(`Question "${question.id}" (multiple) needs at least one correctId.`);
      }
      for (const id of correctIds) {
        if (!seen.has(id)) throw new Error(`Question "${question.id}" has unknown correctId "${id}".`);
      }
      return;
    }
    case 'numerical': {
      const numeric = question.numeric;
      if (!numeric || typeof numeric.value !== 'number' || !Number.isFinite(numeric.value)) {
        throw new Error(`Question "${question.id}" (numerical) needs numeric.value as a finite number.`);
      }
      if (numeric.tolerance !== undefined && !(Number.isFinite(numeric.tolerance) && numeric.tolerance >= 0)) {
        throw new Error(`Question "${question.id}" (numerical) has an invalid tolerance.`);
      }
      return;
    }
    case 'matching': {
      const seen = validateOptionList(question.id, '(matching)', question.options);
      const items = question.items ?? [];
      if (items.length < 1) throw new Error(`Question "${question.id}" (matching) needs at least 1 item.`);
      const itemIds = new Set<string>();
      for (const item of items) {
        if (!item.id || itemIds.has(item.id)) {
          throw new Error(`Question "${question.id}" has a duplicate or empty item id "${item.id}".`);
        }
        itemIds.add(item.id);
        if (!seen.has(item.correctId)) {
          throw new Error(`Question "${question.id}" item "${item.id}" has unknown correctId "${item.correctId}".`);
        }
      }
      return;
    }
    case 'dropdown': {
      const blanks = question.blanks ?? [];
      if (blanks.length < 1) throw new Error(`Question "${question.id}" (dropdown) needs at least 1 blank.`);
      const blankIds = new Set<string>();
      for (const blank of blanks) {
        if (!blank.id || blankIds.has(blank.id)) {
          throw new Error(`Question "${question.id}" has a duplicate or empty blank id "${blank.id}".`);
        }
        blankIds.add(blank.id);
        const seen = validateOptionList(question.id, `blank "${blank.id}"`, blank.options);
        if (!seen.has(blank.correctId)) {
          throw new Error(`Question "${question.id}" blank "${blank.id}" has unknown correctId "${blank.correctId}".`);
        }
        if (blank.shuffle !== undefined && typeof blank.shuffle !== 'boolean') {
          throw new Error(`Question "${question.id}" blank "${blank.id}" has a non-boolean shuffle.`);
        }
      }
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Answer helpers. All UI + scoring goes through these so answer storage
// (ids, raw text) stays decoupled from presentation (letters, markdown).
// ---------------------------------------------------------------------------

/** Effective kind: questions without `kind` are written. */
export function questionKind(question: BaseQuestion): QuestionKind {
  return question.kind ?? 'written';
}

/** Single or multiple choice (pick from `options`). */
export function isChoiceQuestion(question: BaseQuestion): boolean {
  const kind = questionKind(question);
  return kind === 'single' || kind === 'multiple';
}

/** Matching or dropdown (each row/blank maps to one option id). */
export function isPairingQuestion(question: BaseQuestion): boolean {
  const kind = questionKind(question);
  return kind === 'matching' || kind === 'dropdown';
}

/** Every kind except written can be auto-graded. */
export function isGradeableQuestion(question: BaseQuestion): boolean {
  return questionKind(question) !== 'written';
}

/** Correct option ids. Empty unless single/multiple. */
export function getCorrectIds(question: BaseQuestion): string[] {
  return isChoiceQuestion(question) ? [...(question.correctIds ?? [])] : [];
}

export interface PairingSlot {
  id: string;
  /** Row text (matching) or blank label (dropdown). */
  label: string | undefined;
  options: readonly QuestionOption[];
  correctId: string;
}

/** Rows of a matching question or blanks of a dropdown question, uniformly. Empty otherwise. */
export function getPairingSlots(question: BaseQuestion): PairingSlot[] {
  const kind = questionKind(question);
  if (kind === 'matching') {
    const options = question.options ?? [];
    return (question.items ?? []).map((item) => ({ id: item.id, label: item.text, options, correctId: item.correctId }));
  }
  if (kind === 'dropdown') {
    return (question.blanks ?? []).map((blank) => ({
      id: blank.id,
      label: blank.label,
      options: blank.options,
      correctId: blank.correctId,
    }));
  }
  return [];
}

// FNV-1a string hash → 32-bit seed.
function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// mulberry32 PRNG: deterministic floats in [0, 1).
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(list: readonly T[], seed: string): T[] {
  const out = [...list];
  const random = seededRandom(hashSeed(seed));
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Presentation copy of a question with its options shuffled, deterministically
 * for `seed` (e.g. a quiz session id) so the order is stable across reloads
 * but differs between quizzes. Answers are stored as option ids, so grading is
 * unaffected. Questions with `shuffle: false` (and blanks with
 * `shuffle: false`) keep their authored order.
 */
export function shuffleQuestionOptions<Q extends BaseQuestion>(question: Q, seed: string): Q {
  const enabled = question.shuffle !== false;
  const base = `${seed}:${question.id}`;
  const kind = questionKind(question);
  if ((kind === 'single' || kind === 'multiple' || kind === 'matching') && enabled && question.options) {
    return { ...question, options: seededShuffle(question.options, `${base}:options`) };
  }
  if (kind === 'dropdown' && question.blanks) {
    return {
      ...question,
      blanks: question.blanks.map((blank) =>
        (blank.shuffle ?? enabled) ? { ...blank, options: seededShuffle(blank.options, `${base}:${blank.id}`) } : blank,
      ),
    };
  }
  return question;
}

const isRecordAnswer = (answer: QuizAnswer | undefined): answer is Record<string, string> =>
  typeof answer === 'object' && answer !== null && !Array.isArray(answer);

/** Normalize a stored answer to selected option ids — tolerates legacy strings. */
export function toSelectedIds(question: BaseQuestion, answer: QuizAnswer | undefined): string[] {
  if (answer === undefined || isRecordAnswer(answer)) return [];
  const ids =
    typeof answer === 'string' ? (answer === '' ? [] : [answer]) : answer.filter((id) => typeof id === 'string');
  if (!isChoiceQuestion(question)) return ids;
  const valid = new Set((question.options ?? []).map((o) => o.id));
  return ids.filter((id) => valid.has(id));
}

/** Normalize a stored answer to slot id → option id, dropping unknown slots/options. */
export function toPairings(question: BaseQuestion, answer: QuizAnswer | undefined): Record<string, string> {
  if (!isRecordAnswer(answer)) return {};
  const out: Record<string, string> = {};
  for (const slot of getPairingSlots(question)) {
    const chosen = answer[slot.id];
    if (typeof chosen === 'string' && slot.options.some((o) => o.id === chosen)) out[slot.id] = chosen;
  }
  return out;
}

/**
 * Parse a typed number. Accepts thousands separators ("1,756"), spaces,
 * a leading "+", scientific notation and a trailing "%" (kept as the
 * literal number). Returns null when the text is not a number.
 */
export function parseNumericAnswer(text: string): number | null {
  const cleaned = text.trim().replace(/[\s,_]/g, '').replace(/%$/, '').replace(/^\+/, '');
  if (cleaned === '' || !/^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Whether the user has provided an answer (non-blank text, ≥1 selection, or ≥1 pairing). */
export function isAnswerProvided(question: BaseQuestion, answer: QuizAnswer | undefined): boolean {
  if (answer === undefined) return false;
  if (isPairingQuestion(question)) return Object.keys(toPairings(question, answer)).length > 0;
  if (isRecordAnswer(answer)) return false;
  if (typeof answer === 'string') return answer.trim().length > 0;
  if (!isChoiceQuestion(question)) return answer.some((id) => id.trim().length > 0);
  const valid = new Set((question.options ?? []).map((o) => o.id));
  return answer.some((id) => valid.has(id));
}

/**
 * Per-part credit for an answer: { earned, possible }. null for written
 * questions or when unanswered. Matching/dropdown earn one part per correct
 * row/blank; every other gradeable kind is a single all-or-nothing part.
 */
export function gradeAnswer(
  question: BaseQuestion,
  answer: QuizAnswer | undefined,
): { earned: number; possible: number } | null {
  if (!isGradeableQuestion(question) || !isAnswerProvided(question, answer)) return null;
  const kind = questionKind(question);
  if (kind === 'numerical') {
    const value = typeof answer === 'string' ? parseNumericAnswer(answer) : null;
    const expected = question.numeric;
    if (value === null || !expected) return { earned: 0, possible: 1 };
    const tolerance = expected.tolerance ?? 0;
    // Small relative epsilon so 0.1 + 0.2 style float noise never fails an exact answer.
    const epsilon = Math.max(Math.abs(expected.value), 1) * 1e-9;
    return { earned: Math.abs(value - expected.value) <= tolerance + epsilon ? 1 : 0, possible: 1 };
  }
  if (kind === 'matching' || kind === 'dropdown') {
    const pairings = toPairings(question, answer);
    const slots = getPairingSlots(question);
    const earned = slots.filter((slot) => pairings[slot.id] === slot.correctId).length;
    return { earned, possible: slots.length };
  }
  const selected = new Set(toSelectedIds(question, answer));
  const correct = new Set(getCorrectIds(question));
  const exact = selected.size === correct.size && [...selected].every((id) => correct.has(id));
  return { earned: exact ? 1 : 0, possible: 1 };
}

/**
 * Grade an answer. Returns null for written questions or when unanswered.
 * Single: exactly the correct id. Multiple: exact set match. Numerical:
 * within tolerance. Matching/dropdown: every row/blank correct.
 */
export function isAnswerCorrect(question: BaseQuestion, answer: QuizAnswer | undefined): boolean | null {
  const grade = gradeAnswer(question, answer);
  return grade === null ? null : grade.earned === grade.possible;
}

/** Score a set of questions against answers: { correct, gradeable, answered }. */
export function scoreAnswers(
  questions: readonly BaseQuestion[],
  answers: Record<string, QuizAnswer>,
): { correct: number; gradeable: number; answered: number } {
  let correct = 0;
  let gradeable = 0;
  let answered = 0;
  for (const question of questions) {
    if (isAnswerProvided(question, answers[question.id])) answered += 1;
    if (!isGradeableQuestion(question)) continue;
    gradeable += 1;
    if (isAnswerCorrect(question, answers[question.id]) === true) correct += 1;
  }
  return { correct, gradeable, answered };
}
