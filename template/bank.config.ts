// Example bank config. Copy to `bank.config.ts` in your app and edit.
// This mirrors the COMP20008 bank: the schema (year/semester/marks/exam) is
// config-defined — the framework never hardcodes subject fields.

import { defineBank } from 'question-bank-framework';
import type { BaseQuestion } from 'question-bank-framework';
import questionsJson from './content/questions.json' with { type: 'json' };
import { answers } from './content/answers.ts';

/** Subject question shape. Declare every field your accessors touch. */
export interface Comp20008Question extends BaseQuestion {
  year: number;
  semester: string;
  number: number;
  marks: number | null;
  source: string;
}

const questions = questionsJson as Comp20008Question[];

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
      getValue: (q) => String(q.year),
      searchable: true,
    },
    {
      id: 'semester',
      label: 'Semester',
      type: 'select',
      getValue: (q) => q.semester,
      options: [
        { value: 'S1', label: 'Semester 1' },
        { value: 'S2', label: 'Semester 2' },
      ],
    },
    {
      id: 'exam',
      label: 'Exam',
      type: 'text',
      getValue: (q) => `${q.year} ${q.semester}`,
      searchable: true,
      column: { header: 'Exam', width: 108, sortable: false },
    },
    {
      id: 'marks',
      label: 'Marks',
      type: 'number',
      getValue: (q) => q.marks,
      placeholder: 'Value',
      column: { header: 'Marks', width: 78 },
    },
  ],
  questions,
  answers,
  defaultSorting: [{ id: 'exam', desc: true }],
});
