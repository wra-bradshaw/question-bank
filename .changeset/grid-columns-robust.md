---
"question-bank-framework": patch
---

Grid columns can no longer collapse or paint over each other: the title and tags columns absorb wide-screen slack with table-min-width floors instead of leaving dead space or shrinking to zero, long IDs and field values wrap instead of overflowing into neighbours, and banks whose tags merely duplicate dedicated fields can set `hideTagsColumn`. Downstream stylesheets must add `@source '../node_modules/question-bank-framework'` (Tailwind v4 ignores `node_modules`, so without it the app renders unstyled) and import the shared theme tokens from `question-bank-framework/framework/styles/theme.css`; `qb init` now scaffolds a stylesheet that does both.
