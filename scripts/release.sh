#!/usr/bin/env bash
# Tag-based release for git dependencies (no npm publish).
# Usage: pnpm release [patch|minor|major|<version>]  (default: patch)
set -euo pipefail

bump="${1:-patch}"

if [[ "$bump" == "-h" || "$bump" == "--help" ]]; then
  echo "Usage: pnpm release [patch|minor|major|<version>] (default: patch)" >&2
  exit 0
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "error: working tree is dirty — commit or stash first" >&2
  exit 1
fi

branch="$(git branch --show-current)"
if [[ "$branch" != "main" ]]; then
  echo "error: must release from main (on $branch)" >&2
  exit 1
fi

pnpm typecheck
pnpm version "$bump" --message "chore(release): %s"
git push --follow-tags
