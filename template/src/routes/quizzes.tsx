import { createFileRoute } from '@tanstack/react-router';
import { QuizList } from 'question-bank-framework/framework';

export const Route = createFileRoute('/quizzes')({ component: QuizList });
