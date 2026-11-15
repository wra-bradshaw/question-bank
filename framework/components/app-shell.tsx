// Framework-owned: eject with `qb reveal framework/components/app-shell.tsx`.
// Generic header: brand + nav come from the bank, not hardcoded "fieldnotes".

import { Link, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { cn } from '../lib/utils.ts';
import { ExamTimerBadge } from './exam-timer.tsx';
import { Toaster } from './ui/toast';

export function AppShell({
  children,
  brand,
  homeLabel = 'Question bank',
  quizzesLabel = 'My quizzes',
  timerLabel = 'Timer',
}: {
  children: ReactNode;
  brand: string;
  homeLabel?: string;
  quizzesLabel?: string;
  timerLabel?: string;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigation = [
    { label: homeLabel, to: '/' },
    { label: quizzesLabel, to: '/quizzes' },
    { label: timerLabel, to: '/timer' },
  ] as const;
  const isQuestionBank = pathname === '/';

  return (
    <Toaster>
      <div className={cn('flex flex-col bg-background', isQuestionBank ? 'h-dvh overflow-hidden' : 'min-h-dvh')}>
        <header className="sticky top-0 z-20 shrink-0 border-b bg-background/80 backdrop-blur-sm">
          <div className="flex h-14 items-center gap-6 px-6">
            <Link to="/" className="text-sm font-semibold text-foreground">
              {brand}
            </Link>
            <nav className="flex items-center gap-1" aria-label="Main navigation">
              {navigation.map(({ label, to }) => {
                const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                      active && 'bg-muted text-foreground',
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
            <div className="ml-auto">
              <ExamTimerBadge />
            </div>
          </div>
        </header>
        <main className={cn('w-full flex-1', isQuestionBank ? 'flex min-h-0 flex-col overflow-hidden' : 'mx-auto max-w-5xl px-6 py-10')}>
          {children}
        </main>
      </div>
    </Toaster>
  );
}
