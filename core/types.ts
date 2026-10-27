// Core question + bank types. Framework-owned, never ejected.
// Every question has the core fields below; subjects extend the interface
// with their own metadata (year, marks, …) and the bank stays generic over
// it — no index signatures, no `unknown`, no casts in subject code.

export const questionStatuses = ['unanswered', 'revisit', 'complete'] as const;

export type QuestionStatus = (typeof questionStatuses)[number];
export type QuestionStatusMap = Record<string, QuestionStatus>;

// ---------------------------------------------------------------------------
// Question kinds: written (free response) vs choice (auto-gradeable).
// ---------------------------------------------------------------------------

export type QuestionKind = 'written' | 'single' | 'multiple';

export const questionKinds: readonly QuestionKind[] = ['written', 'single', 'multiple'];

export const questionKindLabels: Record<QuestionKind, string> = {
  written: 'Written',
  single: 'Single choice',
  multiple: 'Multiple choice',
};

export interface QuestionOption {
  /** Stable within the question, e.g. "a", "b", "c". */
  id: string;
  /** Option body. Markdown supported. */
  text: string;
}

/** Written answers are free text; choice answers are selected option ids. */
export type QuizAnswer = string | string[];

export interface BaseQuestion {
  id: string;
  title: string;
  prompt: string;
  tags: string[];
  /** Defaults to 'written' when omitted. Choice kinds require options + correctIds. */
  kind?: QuestionKind;
  /** Choice options. Required for single/multiple, forbidden for written. */
  options?: QuestionOption[];
  /** Correct option ids. Single choice requires exactly one. */
  correctIds?: string[];
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

function validateQuestion(question: BaseQuestion): void {
  const kind: QuestionKind = question.kind ?? 'written';
  if (!questionKinds.includes(kind)) {
    throw new Error(`Question "${question.id}" has unknown kind "${question.kind}".`);
  }
  if (kind === 'written') {
    if (question.options !== undefined) {
      throw new Error(`Question "${question.id}" is written and must not define options.`);
    }
    if (question.correctIds !== undefined) {
      throw new Error(`Question "${question.id}" is written and must not define correctIds.`);
    }
    return;
  }
  const options = question.options ?? [];
  if (options.length < 2) {
    throw new Error(`Question "${question.id}" (${kind}) needs at least 2 options.`);
  }
  const seen = new Set<string>();
  for (const option of options) {
    if (!option.id || seen.has(option.id)) {
      throw new Error(`Question "${question.id}" has a duplicate or empty option id "${option.id}".`);
    }
    seen.add(option.id);
  }
  const correctIds = question.correctIds ?? [];
  if (kind === 'single' && correctIds.length !== 1) {
    throw new Error(`Question "${question.id}" (single) needs exactly one correctId.`);
  }
  if (kind === 'multiple' && correctIds.length < 1) {
    throw new Error(`Question "${question.id}" (multiple) needs at least one correctId.`);
  }
  for (const id of correctIds) {
    if (!seen.has(id)) {
      throw new Error(`Question "${question.id}" has unknown correctId "${id}".`);
    }
  }
}

// ---------------------------------------------------------------------------
// Choice helpers. All UI + scoring goes through these so option storage
// (ids) stays decoupled from presentation (letters, markdown).
// ---------------------------------------------------------------------------

/** Effective kind: questions without `kind` are written. */
export function questionKind(question: BaseQuestion): QuestionKind {
  return question.kind ?? 'written';
}

export function isChoiceQuestion(question: BaseQuestion): boolean {
  const kind = questionKind(question);
  return kind === 'single' || kind === 'multiple';
}

/** Correct option ids. Empty for written questions. */
export function getCorrectIds(question: BaseQuestion): string[] {
  return isChoiceQuestion(question) ? [...(question.correctIds ?? [])] : [];
}

/** Normalize a stored answer to selected option ids — tolerates legacy strings. */
export function toSelectedIds(question: BaseQuestion, answer: QuizAnswer | undefined): string[] {
  if (answer === undefined) return [];
  const ids =
    typeof answer === 'string' ? (answer === '' ? [] : [answer]) : answer.filter((id) => typeof id === 'string');
  if (!isChoiceQuestion(question)) return ids;
  const valid = new Set((question.options ?? []).map((o) => o.id));
  return ids.filter((id) => valid.has(id));
}

/** Whether the user has provided an answer (non-blank text, or ≥1 selection). */
export function isAnswerProvided(question: BaseQuestion, answer: QuizAnswer | undefined): boolean {
  if (answer === undefined) return false;
  if (typeof answer === 'string') return answer.trim().length > 0;
  if (!isChoiceQuestion(question)) return answer.some((id) => id.trim().length > 0);
  const valid = new Set((question.options ?? []).map((o) => o.id));
  return answer.some((id) => valid.has(id));
}

/**
 * Grade a choice answer. Returns null for written questions or when
 * unanswered. Single: exactly the correct id. Multiple: exact set match
 * (order-insensitive, no extras, no omissions).
 */
export function isAnswerCorrect(question: BaseQuestion, answer: QuizAnswer | undefined): boolean | null {
  if (!isChoiceQuestion(question)) return null;
  if (!isAnswerProvided(question, answer)) return null;
  const selected = new Set(toSelectedIds(question, answer));
  const correct = new Set(getCorrectIds(question));
  if (selected.size !== correct.size) return false;
  for (const id of selected) {
    if (!correct.has(id)) return false;
  }
  return true;
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
    if (!isChoiceQuestion(question)) continue;
    gradeable += 1;
    if (isAnswerCorrect(question, answers[question.id]) === true) correct += 1;
  }
  return { correct, gradeable, answered };
}
