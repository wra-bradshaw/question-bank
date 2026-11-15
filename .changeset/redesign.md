---
"question-bank-framework": minor
---

Redesign: minimal shadcn/ui neutral theme with Inter Variable (weight and optical-size axes, `font-optical-sizing: auto`), and every component restyled with Tailwind utilities and theme tokens only. UI primitives in `framework/components/ui/` are now shadcn base-nova on Base UI (`render` prop instead of `asChild`); added card, field, label, separator, tooltip and kbd. `theme.css` now registers the framework as a Tailwind source and imports tw-animate-css, so app stylesheets only need `@import 'tailwindcss'` and the theme. Drop the Google Fonts import and the `@source` line from existing apps.
