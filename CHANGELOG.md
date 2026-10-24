# question-bank-framework

## 0.2.0

### Minor Changes

- [`fbced65`](https://github.com/wra-bradshaw/question-bank/commit/fbced65ac7520aec00b4d75272f3e063d80b3e0a) Thanks [@wra-bradshaw](https://github.com/wra-bradshaw)! - Bank fields are statically typed: `BaseQuestion` lost its `[key: string]: unknown` index signature and `defineBank` infers the subject question type, so field accessors use plain property access. Subject configs using string-key access (`q['year']`) or the old template `str`/`num` helpers must switch to typed accessors. Stale filter rules (unknown field id) now match nothing.

## 0.1.1

### Patch Changes

- [`92eeb0c`](https://github.com/wra-bradshaw/question-bank/commit/92eeb0cfd041848dedd28577fdc32f1abf7717c4) Thanks [@wra-bradshaw](https://github.com/wra-bradshaw)! - Port the `qb` CLI to TypeScript (`bin/qb.ts`, compiled to `bin/qb.js` with `pnpm build:bin`). Installed CLI behavior is unchanged.
