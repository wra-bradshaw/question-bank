import { createFileRoute } from '@tanstack/react-router';
import { ExamTimerPage } from 'question-bank-framework/framework';

export const Route = createFileRoute('/timer')({ component: () => <ExamTimerPage /> });
