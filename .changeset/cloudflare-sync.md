---
"question-bank-framework": minor
---

Replace Convex with a Cloudflare Durable Object sync store, and improve ordering.

- **Breaking:** Convex is removed (`convexApi`, `framework/convex/`, `VITE_CONVEX_URL`). Set `sync: { url: '/api/qb' }` in `defineBank` and serve `handleQuestionBankRequest` + `QuestionBankStore` from `question-bank-framework/cloudflare` in your Worker entry; `qb init` now scaffolds `wrangler.jsonc`, `src/server.ts` and `vite.config.ts`. localStorage stays as an offline cache, and local-only quizzes upload on first sync.
- **Breaking:** quiz/status storage functions take the bank (`{ namespace, sync }`) instead of a namespace string. `saveQuizProgress` is replaced by `saveQuiz`/`saveQuizLocally`/`syncQuiz`. New quizzes get plain UUID ids.
- Options can be `pinned: true` to keep their position while the rest shuffle.
- Text columns sort number-aware ("Q2" before "Q10"), and new quizzes (and additions to existing ones) follow the table's current sort order instead of bank order.
