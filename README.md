# question-bank-framework

Framework-style question bank (generalised from the COMP20008 bank). Downstream
subjects bring their own `bank.config.ts` + `content/`; the framework ships the
grid, filter DSL, quizzes, and Convex bindings as an npm package.

Inspired by Vike's eject model: the stable core (`core/`) is never ejected;
everything under `framework/` can be ejected into your repo and owned.

## Use as a template

```sh
pnpm add question-bank-framework
qb init                 # scaffolds bank.config.ts + content/ + src/routes/
pnpm install
pnpm dev
```

Your app owns:

- `bank.config.ts` — `defineBank({ site, namespace, fields, questions, answers })`.
  `fields: BankFieldDef[]` **is** your question schema: each field declares
  `id/label/type/getValue/options/searchable/column`. Built-ins (`id/title/tags/status`) are automatic.
- `content/questions.json`, `content/answers.ts`, `content/figures/`
- Thin TanStack Start routes in `src/routes/` (see `template/src/routes/`)
  wrapping `<BankProvider bank={bank}>` + `<AppShell brand>` + framework pages.

## Reveal (eject) files

```sh
qb list                                  # ejectable files under framework/
qb reveal framework/components/quiz-page.tsx
qb reveal framework/components/quiz-page.tsx --to src/overrides --force
```

This copies the file into your repo (tracked in `.qb-manifest.json` with the
framework version). Add an alias so the override shadows the package:

```ts
// vite.config.ts + tsconfig paths
resolve: { alias: { 'question-bank-framework/framework': './src/overrides' } }
```

Eject is a last resort (same guidance as Vike): prefer `bank.config.ts`
fields/columns/searchable flags first; eject when you need custom UI.

## How Next.js / Vike do it (and what we copied)

- **Next.js:** no eject command. Framework code stays hidden; you customize via
  `next.config.js` + file conventions (`app/layout.tsx`, `error.tsx`,
  `loading.tsx` override built-in fallbacks just by existing). Deep eject
  (custom server/webpack fork) is possible but discouraged.
- **Vike:** tiny stable core + thin extensions (`vike-react`…) using the same
  public hooks as user code. Eject is first-class: remove the extension, copy
  `node_modules/vike-xxx/` → `ejected/vike-xxx/` (manually or via the `eject`
  package), then customize.

We follow Vike: `core/` (types, `defineBank`, `BankProvider`, `useBank`) is the
stable core; `framework/` (components/lib/routes/convex) is the ejectable
extension layer; `qb reveal` is the copy command.

## Layout

- `core/` — never ejected: `types.ts` (`BaseQuestion`, `BankFieldDef`,
  `defineBank`), `config.tsx` (`BankProvider`, `useBank`).
- `framework/` — ejectable: `components/` (grid, quiz, filter builder,
  shadcn `ui/`), `lib/` (generic filter DSL, namespaced quiz/status stores,
  `convex-api.ts`), `convex/` (quizzes + questionStatuses tables).
- `template/` — starter: `bank.config.ts` (COMP20008-like schema),
  `content/` example, `src/routes/` thin wrappers.
- `bin/qb.js` — `list` / `reveal` / `init`.

## Schema example

```ts
defineBank({
  site: { title: '…', brand: 'fieldnotes' },
  namespace: 'comp20008', // localStorage keys + Convex lookups
  fields: [
    { id: 'year', label: 'Year', type: 'select', getValue: (q) => String(q['year'] ?? '') },
    { id: 'marks', label: 'Marks', type: 'number', getValue: (q) => q['marks'] ?? null },
  ],
  questions, // BaseQuestion[]: { id, title, prompt, tags, ...custom }
  answers,   // Record<id, markdown>
});
```

## Dev

```sh
pnpm install
pnpm typecheck
```
