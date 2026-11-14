// Worker entry: serves the question bank sync API under /api/qb (matching
// `sync: { url: '/api/qb' }` in bank.config.ts) and everything else through
// TanStack Start.
//
// Before deploying publicly, gate the API: pass `authorize` (e.g. verify a
// Cloudflare Access JWT) or put the whole Worker behind Cloudflare Access.

import handler from '@tanstack/react-start/server-entry';
import { handleQuestionBankRequest } from 'question-bank-framework/cloudflare';

export { QuestionBankStore } from 'question-bank-framework/cloudflare';

export default {
  async fetch(request: Request, env: object) {
    return (await handleQuestionBankRequest(request, env)) ?? handler.fetch(request);
  },
};
