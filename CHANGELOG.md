# question-bank-framework

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
