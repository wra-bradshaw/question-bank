import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { BankProvider } from 'question-bank-framework';
import { AppShell } from 'question-bank-framework/framework';
import { bank } from '../../bank.config.ts';
import appCss from './styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: bank.site.title },
      { name: 'description', content: bank.site.description ?? '' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
});

function RootComponent() {
  return (
    <BankProvider bank={bank}>
      <AppShell brand={bank.site.brand}>
        <Outlet />
      </AppShell>
    </BankProvider>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="m-0 min-h-screen bg-[#f5f7f4] font-sans text-[#27392f] antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
