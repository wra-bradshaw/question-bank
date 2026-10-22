import { createFileRoute } from '@tanstack/react-router';
import { QuestionBank } from 'question-bank-framework/framework';

export const Route = createFileRoute('/')({ component: QuestionBank });
