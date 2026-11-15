---
"question-bank-framework": minor
---

Add a mock-exam clock. A new `/timer` route (`<ExamTimerPage />`) takes an exam start time (e.g. 08:30) plus reading and writing minutes; pressing Start makes "now" that start time. While it runs, `<AppShell>` shows the mock time in the top right of the header with a book icon during reading time and a pen during writing time, and toasts (shadcn Base UI toast) announce reading time over, 30 and 10 minutes remaining, and exam over. It's stored in localStorage, so it persists across reloads and is shared by all tabs. The header gains a "Timer" link; apps need to add `src/routes/timer.tsx` (see the template).
