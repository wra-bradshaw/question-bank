---
"question-bank-framework": minor
---

Bank fields are statically typed: `BaseQuestion` lost its `[key: string]: unknown` index signature and `defineBank` infers the subject question type, so field accessors use plain property access. Subject configs using string-key access (`q['year']`) or the old template `str`/`num` helpers must switch to typed accessors. Stale filter rules (unknown field id) now match nothing.
