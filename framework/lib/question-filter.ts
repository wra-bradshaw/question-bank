// Generic filter DSL. Ported from the COMP20008 bank; the hardcoded
// FilterFieldId union (title/id/tags/year/semester/marks/status) is replaced
// by config-defined `BankFieldDef[]` plus the three built-ins.
// Framework-owned: eject with `qb reveal framework/lib/question-filter.ts`.

import { questionStatuses, type BankFieldDef, type BankFilterOperatorId, type BaseQuestion, type QuestionStatus } from '../../core/types.ts';

export type FilterMatch = 'and' | 'or';

export type FilterFieldType = 'text' | 'number' | 'select' | 'multiselect';

export type FilterOperatorId = BankFilterOperatorId;

export type FilterOption = { value: string; label: string };

export type FilterField = {
  id: string;
  label: string;
  type: FilterFieldType;
  operators: readonly FilterOperatorId[];
  options?: readonly FilterOption[];
  placeholder?: string;
  searchable?: boolean;
};

export type FilterRule = {
  id: string;
  field: string;
  operator: FilterOperatorId;
  value: string[];
};

const textOperators: readonly FilterOperatorId[] = [
  'is',
  'isNot',
  'contains',
  'doesNotContain',
  'startsWith',
  'endsWith',
  'isEmpty',
  'isNotEmpty',
];

const numberOperators: readonly FilterOperatorId[] = [
  'eq',
  'neq',
  'gt',
  'lt',
  'gte',
  'lte',
  'between',
  'isEmpty',
  'isNotEmpty',
];

const selectOperators: readonly FilterOperatorId[] = ['is', 'isNot', 'isEmpty', 'isNotEmpty'];

const multiSelectOperators: readonly FilterOperatorId[] = ['contains', 'doesNotContain', 'isEmpty', 'isNotEmpty'];

export const defaultOperatorByType: Record<FilterFieldType, FilterOperatorId> = {
  text: 'contains',
  number: 'eq',
  select: 'is',
  multiselect: 'contains',
};

export const fieldTypeLabels: Record<FilterFieldType, string> = {
  text: 'Text',
  number: 'Number',
  select: 'Select',
  multiselect: 'Multi-select',
};

export const operatorLabels: Record<FilterOperatorId, string> = {
  is: 'Is',
  isNot: 'Is not',
  contains: 'Contains',
  doesNotContain: 'Does not contain',
  startsWith: 'Starts with',
  endsWith: 'Ends with',
  eq: '=',
  neq: '≠',
  gt: '>',
  lt: '<',
  gte: '≥',
  lte: '≤',
  between: 'Is between',
  isEmpty: 'Is empty',
  isNotEmpty: 'Is not empty',
};

export const questionStatusLabels: Record<QuestionStatus, string> = {
  unanswered: 'Unanswered',
  revisit: 'Revisit',
  complete: 'Complete',
};

/** Built-in fields present in every bank. */
function builtinFields(): FilterField[] {
  return [
    { id: 'title', label: 'Question', type: 'text', operators: textOperators, placeholder: 'Type a value…' },
    { id: 'id', label: 'ID', type: 'text', operators: textOperators, placeholder: 'Type a value…' },
    { id: 'tags', label: 'Tags', type: 'multiselect', operators: multiSelectOperators },
    {
      id: 'status',
      label: 'Status',
      type: 'select',
      operators: selectOperators,
      options: questionStatuses.map((status) => ({ value: status, label: questionStatusLabels[status] })),
    },
  ];
}

function distinctStrings(values: Array<string | number | null | readonly string[]>): string[] {
  const out = new Set<string>();
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) out.add(String(item));
    } else {
      out.add(String(value));
    }
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

/**
 * Build filter fields from bank config. Select/multiselect options default to
 * the distinct values across questions unless the field declares `options`.
 */
export function createFilterFields(questions: readonly BaseQuestion[], fieldDefs: readonly BankFieldDef[]): FilterField[] {
  const customs: FilterField[] = fieldDefs.map((def) => {
    let options: readonly FilterOption[] | undefined;
    if (def.options) {
      options = def.options;
    } else if (def.type === 'select' || def.type === 'multiselect') {
      const distinct = distinctStrings(questions.map((q) => def.getValue(q)));
      options = distinct.map((value) => ({ value, label: value }));
    }
    const defaultOperators =
      def.type === 'text'
        ? textOperators
        : def.type === 'number'
          ? numberOperators
          : def.type === 'select'
            ? selectOperators
            : multiSelectOperators;
    return {
      id: def.id,
      label: def.label,
      type: def.type,
      operators: def.operators ?? defaultOperators,
      options,
      placeholder: def.placeholder,
      searchable: def.searchable,
    };
  });

  const builtins = builtinFields();
  // Attach tag options derived from the bank (like the original).
  const tags = [...new Set(questions.flatMap((q) => q.tags))].sort((a, b) => a.localeCompare(b));
  const withTags = builtins.map((field) =>
    field.id === 'tags' ? { ...field, options: tags.map((tag) => ({ value: tag, label: tag })) } : field,
  );

  // Order: title, id, tags, ...customs, status (status last like the original).
  const status = withTags.find((f) => f.id === 'status')!;
  const head = withTags.filter((f) => f.id !== 'status');
  return [...head, ...customs, status];
}

export function filterFieldType(fields: readonly FilterField[], fieldId: string): FilterFieldType {
  return fields.find((f) => f.id === fieldId)?.type ?? 'text';
}

// ---------------------------------------------------------------------------
// Matching.
// ---------------------------------------------------------------------------

function parseNumber(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function toText(value: string | number | null | readonly string[]): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(' ');
  return String(value);
}

function toNumber(value: string | number | null | readonly string[]): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    if (value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toSelect(value: string | number | null | readonly string[]): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(' ');
  return String(value);
}

function toMultiSelect(value: string | number | null | readonly string[]): readonly string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value === null || value === undefined || value === '') return [];
  return [String(value)];
}

function resolveFieldValue(
  def: BankFieldDef | undefined,
  ruleField: string,
  question: BaseQuestion,
): string | number | null | readonly string[] {
  if (!def) {
    if (ruleField === 'title') return question.title;
    if (ruleField === 'id') return question.id;
    if (ruleField === 'tags') return question.tags;
    return (question[ruleField] as string | number | null | readonly string[]) ?? null;
  }
  return def.getValue(question);
}

/**
 * A rule with an unfinished value (e.g. "Question contains" with an empty
 * input) is treated as inactive rather than matching nothing.
 */
export function isRuleActive(rule: FilterRule, fields: readonly FilterField[]): boolean {
  if (rule.operator === 'isEmpty' || rule.operator === 'isNotEmpty') return true;
  const type = filterFieldType(fields, rule.field);
  if (type === 'number') {
    if (rule.operator === 'between') {
      return parseNumber(rule.value[0]) !== null && parseNumber(rule.value[1]) !== null;
    }
    return parseNumber(rule.value[0]) !== null;
  }
  if (type === 'select' || type === 'multiselect') return rule.value.length > 0;
  return (rule.value[0] ?? '').trim().length > 0;
}

function matchText(subject: string, rule: FilterRule): boolean {
  const needle = (rule.value[0] ?? '').trim().toLowerCase();
  const haystack = subject.toLowerCase();
  switch (rule.operator) {
    case 'is':
      return haystack === needle;
    case 'isNot':
      return haystack !== needle;
    case 'contains':
      return haystack.includes(needle);
    case 'doesNotContain':
      return !haystack.includes(needle);
    case 'startsWith':
      return haystack.startsWith(needle);
    case 'endsWith':
      return haystack.endsWith(needle);
    case 'isEmpty':
      return haystack.length === 0;
    case 'isNotEmpty':
      return haystack.length > 0;
    default:
      return true;
  }
}

function matchNumber(subject: number | null, rule: FilterRule): boolean {
  if (rule.operator === 'isEmpty') return subject === null;
  if (rule.operator === 'isNotEmpty') return subject !== null;
  if (subject === null) return false;
  const first = parseNumber(rule.value[0]);
  const second = parseNumber(rule.value[1]);
  switch (rule.operator) {
    case 'eq':
      return first !== null && subject === first;
    case 'neq':
      return first !== null && subject !== first;
    case 'gt':
      return first !== null && subject > first;
    case 'lt':
      return first !== null && subject < first;
    case 'gte':
      return first !== null && subject >= first;
    case 'lte':
      return first !== null && subject <= first;
    case 'between':
      return first !== null && second !== null && subject >= Math.min(first, second) && subject <= Math.max(first, second);
    default:
      return true;
  }
}

function matchSelect(subject: string, rule: FilterRule): boolean {
  if (rule.operator === 'isEmpty') return subject.length === 0;
  if (rule.operator === 'isNotEmpty') return subject.length > 0;
  const selected = new Set(rule.value);
  if (rule.operator === 'is') return selected.has(subject);
  if (rule.operator === 'isNot') return !selected.has(subject);
  return true;
}

function matchMultiSelect(subject: readonly string[], rule: FilterRule): boolean {
  if (rule.operator === 'isEmpty') return subject.length === 0;
  if (rule.operator === 'isNotEmpty') return subject.length > 0;
  const selected = new Set(rule.value);
  const overlaps = subject.some((item) => selected.has(item));
  if (rule.operator === 'contains') return overlaps;
  if (rule.operator === 'doesNotContain') return !overlaps;
  return true;
}

export function matchesRule(
  rule: FilterRule,
  fields: readonly FilterField[],
  fieldDefs: readonly BankFieldDef[],
  question: BaseQuestion,
  status: QuestionStatus,
): boolean {
  const type = filterFieldType(fields, rule.field);
  if (rule.field === 'status') return matchSelect(status, rule);
  const def = fieldDefs.find((d) => d.id === rule.field);
  const raw = resolveFieldValue(def, rule.field, question);
  if (type === 'text') return matchText(toText(raw), rule);
  if (type === 'number') return matchNumber(toNumber(raw), rule);
  if (type === 'select') return matchSelect(toSelect(raw), rule);
  return matchMultiSelect(toMultiSelect(raw), rule);
}

export function matchesFilters(
  filters: readonly FilterRule[],
  match: FilterMatch,
  fields: readonly FilterField[],
  fieldDefs: readonly BankFieldDef[],
  question: BaseQuestion,
  status: QuestionStatus,
): boolean {
  const active = filters.filter((rule) => isRuleActive(rule, fields));
  if (active.length === 0) return true;
  return match === 'and'
    ? active.every((rule) => matchesRule(rule, fields, fieldDefs, question, status))
    : active.some((rule) => matchesRule(rule, fields, fieldDefs, question, status));
}

/** Free-text search across id/title/prompt/tags plus `searchable` custom fields. */
export function matchesSearch(
  question: BaseQuestion,
  query: string,
  fieldDefs: readonly BankFieldDef[],
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const parts = [question.id, question.title, question.prompt, question.tags.join(' ')];
  for (const def of fieldDefs) {
    if (!def.searchable) continue;
    const raw = def.getValue(question);
    parts.push(Array.isArray(raw) ? raw.join(' ') : String(raw ?? ''));
  }
  return parts.join(' ').toLowerCase().includes(q);
}
