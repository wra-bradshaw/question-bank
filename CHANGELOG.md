# question-bank-framework

## 0.7.0

### Minor Changes

- [`04319cb`](https://github.com/wra-bradshaw/question-bank/commit/04319cb72f41e6ce6c99cb2ed5f766e5e1acd806) Thanks [@wra-bradshaw](https://github.com/wra-bradshaw)! - Replace Convex with a Cloudflare Durable Object sync store, and improve ordering.
  
  - **Breaking:** Convex is removed (`convexApi`, `framework/convex/`, `VITE_CONVEX_URL`). Set `sync: { url: '/api/qb' }` in `defineBank` and serve `handleQuestionBankRequest` + `QuestionBankStore` from `question-bank-framework/cloudflare` in your Worker entry; `qb init` now scaffolds `wrangler.jsonc`, `src/server.ts` and `vite.config.ts`. localStorage stays as an offline cache, and local-only quizzes upload on first sync.
  - **Breaking:** quiz/status storage functions take the bank (`{ namespace, sync }`) instead of a namespace string. `saveQuizProgress` is replaced by `saveQuiz`/`saveQuizLocally`/`syncQuiz`. New quizzes get plain UUID ids.
  - Options can be `pinned: true` to keep their position while the rest shuffle.
  - Text columns sort number-aware ("Q2" before "Q10"), and new quizzes (and additions to existing ones) follow the table's current sort order instead of bank order.

## 0.6.0

### Minor Changes

- [`52b9149`](https://github.com/wra-bradshaw/question-bank/commit/52b91492f0339a57ef0211048546120873c8112c) Thanks [@wra-bradshaw](https://github.com/wra-bradshaw)! - Shuffle option order in quizzes for single, multiple, matching and dropdown questions, seeded by the quiz id so the order stays stable across reloads. Opt out per question (or per dropdown blank) with `shuffle: false`. Adds `shuffleQuestionOptions` to the core exports.

## 0.5.1

### Patch Changes

- [`0d72fb6`](https://github.com/wra-bradshaw/question-bank/commit/0d72fb60b461cb6ec237fad16320fe56ac33e5cf) Thanks [@wra-bradshaw](https://github.com/wra-bradshaw)! - Quiz answer widgets no longer overflow on narrow screens: choice options containing code blocks or tables, and matching/dropdown rows with long inline math (e.g. relational-algebra expressions), now shrink or scroll inside their own row instead of widening the page.

## 0.5.0

### Minor Changes

- [`1ddff61`](https://github.com/wra-bradshaw/question-bank/commit/1ddff61bbddd93c2395b34155f72ce4965729839) Thanks [@wra-bradshaw](https://github.com/wra-bradshaw)! - Three new auto-graded question kinds: `numerical` (`numeric: { value, tolerance?, unit? }`; typed answers like `1,756` or `1.2e3` are accepted), `matching` (shared `options` + `items: [{ id, text, correctId }]`), and `dropdown` (`blanks: [{ id, label?, options, correctId }]`, Canvas-style multiple dropdowns). Quizzes render a number input or one select per item/blank, check answers in place with per-item corrections, and the results list shows partial credit (e.g. `Incorrect · 3/5`). `defineBank` validates each kind's fields. Stored quiz answers may now be `Record<string, string>` for matching/dropdown, so the Convex `quizzes` validators were widened — redeploy your Convex functions. New exports: `gradeAnswer`, `isGradeableQuestion`, `isPairingQuestion`, `getPairingSlots`, `toPairings`, `parseNumericAnswer`, plus `NumericalResponse`/`PairingResponse` from `framework/`.

### Patch Changes

- [`1ddff61`](https://github.com/wra-bradshaw/question-bank/commit/1ddff61bbddd93c2395b34155f72ce4965729839) Thanks [@wra-bradshaw](https://github.com/wra-bradshaw)! - Wide question content no longer pushes the quiz page past the viewport: the quiz and quiz-list grids use `minmax(0, 1fr)` tracks so figures, code blocks and tables shrink or scroll inside the card, display math scrolls horizontally, long inline code/URLs and titles wrap, and long tag badges wrap on narrow screens.

## 0.4.0

### Minor Changes

- [`2c53853`](https://github.com/wra-bradshaw/question-bank/commit/2c53853a4d88c02163db36047c311a0b995de87f) Thanks [@wra-bradshaw](https://github.com/wra-bradshaw)! - The quiz page now shows each question's status: a numbered overview lets you jump to any question, colour-coded by unanswered/revisit/complete with the current question ringed, and the active question card carries its status badge next to the type badge.

## 0.3.0

### Minor Changes

- [`219c6ae`](https://github.com/wra-bradshaw/question-bank/commit/219c6ae2c74fbe5acc96fe03fc92d2c18d36cf28) Thanks [@wra-bradshaw](https://github.com/wra-bradshaw)! - Reorder, shuffle, or remove questions in an existing quiz from the quizzes page, and add selected questions to an existing quiz from the bank. Adds a `quizzes:setQuestions` Convex mutation — redeploy your Convex functions.

### Patch Changes

- [`219c6ae`](https://github.com/wra-bradshaw/question-bank/commit/219c6ae2c74fbe5acc96fe03fc92d2c18d36cf28) Thanks [@wra-bradshaw](https://github.com/wra-bradshaw)! - Grid columns can no longer collapse or paint over each other: the title and tags columns absorb wide-screen slack with table-min-width floors instead of leaving dead space or shrinking to zero, long IDs and field values wrap instead of overflowing into neighbours, and banks whose tags merely duplicate dedicated fields can set `hideTagsColumn`. Downstream stylesheets must add `@source '../node_modules/question-bank-framework'` (Tailwind v4 ignores `node_modules`, so without it the app renders unstyled) and import the shared theme tokens from `question-bank-framework/framework/styles/theme.css`; `qb init` now scaffolds a stylesheet that does both.

## 0.2.0

### Minor Changes

- [`fbced65`](https://github.com/wra-bradshaw/question-bank/commit/fbced65ac7520aec00b4d75272f3e063d80b3e0a) Thanks [@wra-bradshaw](https://github.com/wra-bradshaw)! - Bank fields are statically typed: `BaseQuestion` lost its `[key: string]: unknown` index signature and `defineBank` infers the subject question type, so field accessors use plain property access. Subject configs using string-key access (`q['year']`) or the old template `str`/`num` helpers must switch to typed accessors. Stale filter rules (unknown field id) now match nothing.

## 0.1.1

### Patch Changes

- [`92eeb0c`](https://github.com/wra-bradshaw/question-bank/commit/92eeb0cfd041848dedd28577fdc32f1abf7717c4) Thanks [@wra-bradshaw](https://github.com/wra-bradshaw)! - Port the `qb` CLI to TypeScript (`bin/qb.ts`, compiled to `bin/qb.js` with `pnpm build:bin`). Installed CLI behavior is unchanged.
