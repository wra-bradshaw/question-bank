---
"question-bank-framework": minor
---

Pause the mock-exam clock. `/timer` gains Pause/Resume buttons while an exam is running: pausing freezes the mock time (the header badge shows a pause icon and dims), and resuming carries on from the same time, so breaks don't eat into reading or writing time. Paused state is stored with the timer in localStorage, so it holds across reloads and tabs. Also exports `pauseExamTimer` and `resumeExamTimer`; `ExamTimer` gains an optional `pausedAt` and `ExamState` a `paused` flag.
