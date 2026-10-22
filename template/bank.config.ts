// Example bank config. Copy to `bank.config.ts` in your app and edit.
// This mirrors the COMP20008 bank: the schema (year/semester/marks/exam) is
// config-defined — the framework never hardcodes subject fields.

import { defineBank } from 'question-bank-framework';
import questionsJson from './content/questions.json' with { type: 'json' };
import { answers } from './content/answers.ts';
import type { BaseQuestion } from 'question-bank-framework';

const questions = questionsJson as BaseQuestion[];

const str = (q: BaseQuestion, key: string): string => {
  const v = q[key];
  return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
};

const num = (q: BaseQuestion, key: string): number | null => {
  const v = q[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

export const bank = defineBank({
  site: {
    title: 'fieldnotes — COMP20008 question bank',
    brand: 'fieldnotes',
    description: 'A searchable, section-classified question bank built from COMP20008 past exams.',
  },
  namespace: 'comp20008',
  fields: [
    {
      id: 'year',
      label: 'Year',
      type: 'select',
      getValue: (q) => (typeof q['year'] === 'number' ? String(q['year']) : ''),
      searchable: true,
    },
    {
      id: 'semester',
      label: 'Semester',
      type: 'select',
      getValue: (q) => str(q, 'semester'),
      options: [
        { value: 'S1', label: 'Semester 1' },
        { value: 'S2', label: 'Semester 2' },
      ],
    },
    {
      id: 'exam',
      label: 'Exam',
      type: 'text',
      getValue: (q) => `${str(q, 'year')} ${str(q, 'semester')}`.trim(),
      searchable: true,
      column: { header: 'Exam', width: 108, sortable: false },
    },
    {
      id: 'marks',
      label: 'Marks',
      type: 'number',
      getValue: (q) => num(q, 'marks'),
      placeholder: 'Value',
      column: { header: 'Marks', width: 78 },
    },
  ],
  questions,
  answers,
  defaultSorting: [{ id: 'exam', desc: true }],
});
