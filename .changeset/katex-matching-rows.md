---
"question-bank-framework": patch
---

Fix broken math and code-block rendering.

- Render math with the framework's own `katex` instead of `rehype-katex` (which pins katex 0.16). KaTeX 0.19 renamed its CSS classes, so 0.16 markup under 0.19 CSS lost its layout: subscripts wrapped, overlapped and MathML leaked through. `theme.css` now imports the matching KaTeX CSS; remove `@import 'katex/dist/katex.min.css'` from your app stylesheet.
- Fenced code blocks without a language no longer get inline-code highlighting on every line.
- Matching/dropdown rows wrap: wide items (long formulas) take the full row and the select drops below instead of being squeezed and clipped.
- Markdown renderers no longer leak `node="[object Object]"` attributes into the DOM.
