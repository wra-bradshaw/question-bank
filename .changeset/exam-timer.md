---
"question-bank-framework": minor
---

Add a mock-exam timer. A new `/timer` route (`<ExamTimerPage />`) sets a start time plus reading and writing minutes, stored in localStorage so it persists across reloads and tabs. While active, `<AppShell>` shows minutes left in the top right of the header with a book (reading) or pen (writing) icon, and the header gains a "Timer" link. Apps need to add `src/routes/timer.tsx` (see the template).
