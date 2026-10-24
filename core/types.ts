// Core question + bank types. Framework-owned, never ejected.
// Every question has the core fields below; subjects extend the interface
// with their own metadata (year, marks, …) and the bank stays generic over
// it — no index signatures, no `unknown`, no casts in subject code.

export const questionStatuses = ['unanswered', 'revisit', 'complete'] as const;

export type QuestionStatus = (typeof questionStatuses)[number];
export type QuestionStatusMap = Record<string, QuestionStatus>;

export interface BaseQuestion {
  id: string;
  title: string;
  prompt: string;
  tags: string[];
  // Subjects extend this interface with their own fields; see template/bank.config.ts.
}

export interface QuizSession {
  id: string;
  title: string;
  questionIds: string[];
  answers: Record<string, string>;
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
  return {
    ...input,
    answers: input.answers ?? {},
    questionById: new Map(input.questions.map((q) => [q.id, q])),
  };
}
