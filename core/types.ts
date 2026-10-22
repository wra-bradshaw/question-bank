// Core question + bank types. Framework-owned, never ejected.
// A bank's question shape is config-defined: every question has the four
// core fields, plus arbitrary subject-specific metadata (year, marks, …).

export const questionStatuses = ['unanswered', 'revisit', 'complete'] as const;

export type QuestionStatus = (typeof questionStatuses)[number];
export type QuestionStatusMap = Record<string, QuestionStatus>;

export interface BaseQuestion {
  id: string;
  title: string;
  prompt: string;
  tags: string[];
  // Subject-specific fields (e.g. year, semester, marks, source).
  [key: string]: unknown;
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

export interface BankFieldDef {
  /** Stable field id. Reserved: id, title, tags, status. */
  id: string;
  label: string;
  type: BankFieldType;
  /** Extract the raw value from a question. */
  getValue: (question: BaseQuestion) => string | number | null | readonly string[];
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

export interface DefineBankInput {
  site: BankSiteConfig;
  /** Namespaces localStorage keys + Convex lookups. e.g. "comp20008". */
  namespace: string;
  /** Subject-specific schema. Built-ins (id/title/tags/status) are automatic. */
  fields: BankFieldDef[];
  questions: BaseQuestion[];
  /** Suggested answers keyed by question id. Missing entries hide "Show answer". */
  answers?: Record<string, string>;
  /** Default sort for the grid, e.g. [{ id: "exam", desc: true }]. */
  defaultSorting?: Array<{ id: string; desc?: boolean }>;
  /** Extra per-question figures, resolved by prompt `![](/figures/…)` etc. */
  publicPath?: string;
}

export interface Bank extends DefineBankInput {
  answers: Record<string, string>;
  questionById: Map<string, BaseQuestion>;
}

export function defineBank(input: DefineBankInput): Bank {
  return {
    ...input,
    answers: input.answers ?? {},
    questionById: new Map(input.questions.map((q) => [q.id, q])),
  };
}
