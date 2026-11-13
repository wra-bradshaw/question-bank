---
"question-bank-framework": minor
---

Three new auto-graded question kinds: `numerical` (`numeric: { value, tolerance?, unit? }`; typed answers like `1,756` or `1.2e3` are accepted), `matching` (shared `options` + `items: [{ id, text, correctId }]`), and `dropdown` (`blanks: [{ id, label?, options, correctId }]`, Canvas-style multiple dropdowns). Quizzes render a number input or one select per item/blank, check answers in place with per-item corrections, and the results list shows partial credit (e.g. `Incorrect · 3/5`). `defineBank` validates each kind's fields. Stored quiz answers may now be `Record<string, string>` for matching/dropdown, so the Convex `quizzes` validators were widened — redeploy your Convex functions. New exports: `gradeAnswer`, `isGradeableQuestion`, `isPairingQuestion`, `getPairingSlots`, `toPairings`, `parseNumericAnswer`, plus `NumericalResponse`/`PairingResponse` from `framework/`.
