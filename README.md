# question-bank-framework

Framework-style question bank (generalised from the COMP20008 bank). Downstream
subjects bring their own `bank.config.ts` + `content/`; the framework ships the
grid, filter DSL, quizzes, and Convex bindings as an npm package.

Inspired by Vike's eject model: the stable core (`core/`) is never ejected;
everything under `framework/` can be ejected into your repo and owned.

## Use as a template

```sh
pnpm add question-bank-framework
pnpm exec qb init                 # scaffolds bank.config.ts + content/ + src/routes/
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
- `src/routes/styles.css` (scaffolded by `qb init`, imported as `?url` from
  `__root.tsx`). It must list the framework as a Tailwind source — v4 ignores
  `node_modules` by default, so without this none of the grid/badge/filter
  utilities are generated and the app renders unstyled:

```css
@import 'tailwindcss';
@import 'question-bank-framework/framework/styles/theme.css';
@source '../node_modules/question-bank-framework'; /* relative to this file */
```

Pass `hideTagsColumn: true` to `defineBank` when tags merely duplicate
dedicated fields (every tag equals a topic/type value already in its own
column). Tags still feed free-text search.

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
- `bin/qb.ts` (source; compiled to `bin/qb.js` with `pnpm build:bin`) — `list` / `reveal` / `init`.

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

## Question kinds

Every question has `id/title/prompt/tags`; `kind` (default `written`) picks the
response UI and grading. All kinds except `written` are auto-graded in quizzes
(Check answer → per-question feedback, the bank's answer shown as the explanation).

| kind | extra fields | answer UI |
|---|---|---|
| `written` | — | free-text box; "Show answer" reveals `answers[id]` |
| `single` | `options`, `correctIds` (exactly one) | radio list |
| `multiple` | `options`, `correctIds` (≥ 1, exact-set match) | checkbox list |
| `numerical` | `numeric: { value, tolerance?, unit? }` | number input; correct within ±`tolerance` (default exact). Accepts `1,756`, `1.2e3`. |
| `matching` | shared `options`, `items: [{ id, text, correctId }]` | one dropdown per item, options lettered A, B, … |
| `dropdown` | `blanks: [{ id, label?, options, correctId }]` | one dropdown per blank, each with its own options |

```json
{ "id": "q7", "kind": "matching", "title": "…", "prompt": "Match each join to its cost.", "tags": [],
  "options": [{ "id": "a", "text": "Hash join" }, { "id": "b", "text": "Sort-merge join" }],
  "items": [{ "id": "1", "text": "`3(M + N)`", "correctId": "a" }] }
```

Matching and dropdown questions earn partial credit per item/blank in the
review (`gradeAnswer`), but only count as correct in the quiz score when every
item is right. `defineBank` validates each question's fields against its kind
and throws on mismatches (e.g. a `correctId` that isn't one of the options).
Don't repeat the option list or answer table in `prompt`; the UI renders them.

Quizzes shuffle option order (choice options, the shared matching options and
each dropdown blank's options), seeded by the quiz id so the order is stable
across reloads but differs between quizzes. The bank grid keeps authored
order, so explanations should name options by content, not by letter. Opt out
with `shuffle: false` on the question, or on a single dropdown blank, when
order matters ("All of the above", ordered scales, options that reference
each other).

## Dev

```sh
pnpm install
pnpm typecheck
```

## Release (npm + changesets)

```sh
pnpm changeset        # describe your change as patch/minor/major, then push
```

Pushing to `main` runs the release workflow: it opens a "Version Packages"
PR (bump + CHANGELOG). Merge that PR and the workflow publishes to npm with
OIDC trusted publishing and provenance attestations — no npm token needed.

One-time setup: on npmjs.com, add this repo as a trusted publisher for the
`question-bank-framework` package (no tokens or secrets to manage).
