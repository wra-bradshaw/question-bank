---
"question-bank-framework": patch
---

Wide question content no longer pushes the quiz page past the viewport: the quiz and quiz-list grids use `minmax(0, 1fr)` tracks so figures, code blocks and tables shrink or scroll inside the card, display math scrolls horizontally, long inline code/URLs and titles wrap, and long tag badges wrap on narrow screens.
