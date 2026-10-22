import { createFileRoute } from '@tanstack/react-router';
import { QuizPage } from 'question-bank-framework/framework';

export const Route = createFileRoute('/quiz/$quizId')({ component: QuizPage });
