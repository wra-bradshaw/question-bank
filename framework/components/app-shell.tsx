// Framework-owned: eject with `qb reveal framework/components/app-shell.tsx`.
// Generic header: brand + nav come from the bank, not hardcoded "fieldnotes".

import { Link, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { cn } from '../lib/utils.ts';

export function AppShell({
  children,
  brand,
  homeLabel = 'Question bank',
  quizzesLabel = 'My quizzes',
}: {
  children: ReactNode;
  brand: string;
  homeLabel?: string;
  quizzesLabel?: string;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigation = [
    { label: homeLabel, to: '/' },
    { label: quizzesLabel, to: '/quizzes' },
  ] as const;
  const isQuestionBank = pathname === '/';

  return (
    <div className={cn('flex flex-col bg-white', isQuestionBank ? 'h-dvh overflow-hidden' : 'min-h-dvh')}>
      <header className="sticky top-0 z-20 shrink-0 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-8 px-4">
          <Link to="/" className="text-lg font-bold text-gray-900">
            {brand}
          </Link>
          <nav className="flex items-center gap-6" aria-label="Main navigation">
            {navigation.map(({ label, to }) => {
              const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn('text-sm font-semibold text-gray-600 hover:text-gray-900', active && 'text-gray-900 underline underline-offset-4')}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className={cn('w-full flex-1', isQuestionBank ? 'flex min-h-0 flex-col overflow-hidden' : 'mx-auto max-w-6xl px-4 py-8')}>
        {children}
      </main>
    </div>
  );
}
