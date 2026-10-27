// Re-export the stable core: types + BankContext/useBank/defineBank.
// Framework code (ejectable) lives under framework/.

export {
  BankContext,
  BankProvider,
  useBank,
  defineBank,
  getCorrectIds,
  isAnswerCorrect,
  isAnswerProvided,
  isChoiceQuestion,
  questionKind,
  questionKindLabels,
  questionKinds,
  questionStatuses,
  scoreAnswers,
  toSelectedIds,
} from './config.tsx';
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
} from './config.tsx';
