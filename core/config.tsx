// Bank runtime context. Framework components consume the active bank via
// `useBank()` instead of importing `@/data/questions` directly, so a
// downstream subject only owns `bank.config.ts` + `content/`.

import { createContext, useContext, type ReactNode } from 'react';
import type { Bank } from './types.ts';

export const BankContext = createContext<Bank | null>(null);

export function BankProvider({ bank, children }: { bank: Bank; children: ReactNode }) {
  return <BankContext.Provider value={bank}>{children}</BankContext.Provider>;
}

export function useBank(): Bank {
  const bank = useContext(BankContext);
  if (!bank) {
    throw new Error(
      'useBank() called outside <BankProvider>. Wrap your routes with <BankProvider bank={bank}>.',
    );
  }
  return bank;
}

export { defineBank } from './types.ts';
export type {
  Bank,
  BankFieldDef,
  BankFieldOption,
  BankFieldType,
  BankFilterOperatorId,
  BankSiteConfig,
  BaseQuestion,
  DefineBankInput,
  QuestionKind,
  QuestionOption,
  QuestionStatus,
  QuestionStatusMap,
  QuizAnswer,
  QuizSession,
} from './types.ts';
export {
  getCorrectIds,
  isAnswerCorrect,
  isAnswerProvided,
  isChoiceQuestion,
  questionKind,
  questionKindLabels,
  questionKinds,
  scoreAnswers,
  toSelectedIds,
} from './types.ts';
export { questionStatuses } from './types.ts';
