// Public framework surface. Import from "question-bank-framework/framework".
// Every file under framework/ is ejectable via `qb reveal <path>`.

export { QuestionBank } from './components/question-bank.tsx';
export { QuizPage } from './components/quiz-page.tsx';
export { QuizList } from './components/quiz-list.tsx';
export { AppShell } from './components/app-shell.tsx';
export { FilterBuilder } from './components/filter-builder.tsx';
export { MarkdownContent } from './components/markdown-content.tsx';
export { NumericalResponse, PairingResponse, formatNumericAnswer } from './components/question-response.tsx';

export {
  createFilterFields,
  matchesFilters,
  matchesSearch,
  questionStatusLabels,
  defaultOperatorByType,
  fieldTypeLabels,
  operatorLabels,
} from './lib/question-filter.ts';
export type { FilterField, FilterMatch, FilterOperatorId, FilterRule } from './lib/question-filter.ts';

export { createQuestionFilterStore, useQuestionFilterStore } from './lib/question-filter-store.ts';
export {
  createQuiz,
  deleteQuiz,
  getQuiz,
  listQuizzes,
  saveQuiz,
  saveQuizLocally,
  setQuizQuestions,
  syncQuiz,
} from './lib/quiz-storage.ts';
export { getQuestionStatuses, setQuestionStatus } from './lib/question-status-storage.ts';
export type { StorageTarget } from './lib/sync-client.ts';
export { cn } from './lib/utils.ts';
