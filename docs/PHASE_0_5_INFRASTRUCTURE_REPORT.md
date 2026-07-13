# Phase 0.5 — Infrastructure Report

**Date:** 2026-07-13
**Scope:** Objective 1 — fix the `server-only` infrastructure gap to a
production-quality standard. No business logic touched.

---

## 1. Summary

`npx vitest run` was failing on 16 of 48 test files (5 of 166 executable
tests) with `Failed to resolve import "server-only"`. The root cause was fully
traced (not patched around): the `server-only` marker package is imported
directly in 83 source files, but was never actually installed as a real
dependency of this project — it exists only inside `next`'s own internal
`devDependencies`, invisible to consumers. Next.js's own webpack build
silently works around this with a built-in alias; Vite/Vitest has no
equivalent, so it failed outright wherever a test's import graph reached one
of those 83 files.

The fix applied mirrors the exact pattern Next.js's **own official** `next/jest`
preset uses for the same problem (`moduleNameMapper: {'^server-only$':
require.resolve('./__mocks__/empty.js')}`) — a `resolve.alias` entry in
`vitest.config.ts` pointing the bare specifier at a trivial local empty
module. This is a config-only change with no new runtime dependency, no
version-pinning risk, and no dependency on `next`'s internal file layout.

**Result: TypeScript ✅, ESLint ✅, Build ✅, Vitest ✅ (48/48 files, 348/348
tests). CI will inherit this automatically** — the fix lives entirely in
versioned repo files (`vitest.config.ts`, `tests/setup.ts`,
`tests/mocks/empty.ts`), so the next CI run needs no separate change.

---

## 2. Root cause — traced, not guessed

Confirmed via direct inspection, in order:

1. `server-only` is `import`ed as the first line in 83 files across
   `modules/`, `lib/`, matching the standard Next.js server-boundary-guard
   convention.
2. `grep '"server-only"' package.json` — no match, in either `dependencies` or
   `devDependencies`.
3. `grep server-only package-lock.json` — no match anywhere in the lockfile.
4. `npm ls server-only` — empty result; the package does not exist anywhere
   under `node_modules`.
5. `node_modules/next/package.json` **does** list `"server-only": "0.0.1"` —
   but under **Next's own `devDependencies`**, used to build Next.js itself,
   never installed into a consuming project's `node_modules`.
6. `node_modules/next/dist/build/create-compiler-aliases.js` —
   `createServerOnlyClientOnlyAliases()` shows Next's webpack config aliases
   the bare specifier directly to its own bundled copies
   (`next/dist/compiled/server-only/{empty,index}`), which is why `next build`
   and `next dev` have always worked despite the package never being
   installed — Next never actually needs it to exist on disk.
7. `node_modules/next/dist/build/jest/jest.js` — Next's own official Jest
   preset (`next/jest`) does the same thing for test runners:
   `'^server-only$': require.resolve('./__mocks__/empty.js')`. This confirms
   the alias-to-empty-stub approach is not a workaround invented for this
   project — it is literally how Next's own tooling solves this exact problem
   for every consumer.
8. `tests/setup.ts` already had a `vi.mock('server-only', () => ({}))` line —
   a prior, ineffective attempt at this fix. It didn't work because the
   failure happens at Vite's `import-analysis`/transform stage (resolving the
   bare specifier to a real file on disk), which runs **before** `vi.mock`'s
   runtime interception ever gets a chance — `vi.mock` can override what a
   module *exports* once it's loaded, but it cannot rescue a specifier that
   fails to resolve to any file at all. This dead code has been removed.
9. `.github/workflows/ci.yml` runs `npm ci` then `npx vitest run` — an
   identical install + identical failure, confirming this would have failed
   in CI too, independent of any branch, until fixed.

---

## 3. Fix applied

Three files changed, no new dependency added:

| File | Change |
|---|---|
| `tests/mocks/empty.ts` | **New.** Trivial empty module (`export {}`) — the alias target. |
| `vitest.config.ts` | Added `resolve.alias` entries: `'server-only'` and `'client-only'` (added proactively for symmetry with Next's own precedent, even though `client-only` is currently unused in this codebase — a 2-line addition that prevents the identical failure mode the first time someone does import it) both point at `tests/mocks/empty.ts`. |
| `tests/setup.ts` | Removed the dead, non-functional `vi.mock('server-only', () => ({}))` line — cleanup, not a behavior change (it never worked). |

### Why this option over the alternatives considered

- **Installing the real `server-only` npm package as a dependency** was
  considered and rejected. The real package's `package.json` has a `browser`
  field that resolves to a variant which *throws* ("This module cannot be
  imported from a Client Component module"), while its `main` field resolves
  to a no-op. Vite's default client-side module resolution prefers the
  `browser` field, and this project's `vitest.config.ts` runs tests under
  `environment: 'jsdom'` — there was a real risk that installing the actual
  package would resolve to the throwing variant instead of the no-op one,
  making things *worse* than the current failure, not better. The alias
  approach sidesteps this entirely by controlling exactly which file every
  test resolves to.
- **Aliasing directly to `next/dist/compiled/server-only/empty`** (Next's own
  bundled file) was considered and rejected in favor of a local stub, because
  it would silently couple this repo's test config to `next`'s internal,
  undocumented file layout — a minor version bump of `next` could move or
  rename that path with no changelog entry, breaking tests with no obvious
  cause. A one-line local stub file has no such fragility.

---

## 4. Verification — all four gates, re-run after the fix

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ Clean, 0 errors |
| `npx eslint .` | ✅ 0 errors, 2,215 warnings — identical count to before the fix (all pre-existing, all in test files, `no-explicit-any`/`no-unused-vars`) |
| `npm run build` (`next build`) | ✅ Compiled successfully, 0 errors, 0 warnings |
| `npx vitest run` | ✅ **48/48 test files passed, 348/348 tests passed** |

The jump from 166 total tests (161 passed / 5 failed) pre-fix to 348 total
tests (all passed) post-fix is not a new-tests-written artifact — it's because
16 entire test files previously failed to load at all (a resolution error
aborts the whole file, not just the affected test), so every test inside those
16 files was invisible to the previous run's totals. Fixing the resolution
error let all of them execute for the first time in this session, and all of
them pass.

**CI** (`.github/workflows/ci.yml`) runs the same four commands in the same
order against the same lockfile — no CI-specific change was needed or made;
the fix is portable by construction.

---

## 5. No hidden infrastructure debt remaining

- No new dependency was added, so there is nothing new to keep patched or
  version-aligned.
- The dead `vi.mock` line that never worked has been removed, not left behind
  as confusing dead code.
- `client-only` was aliased proactively alongside `server-only` even though
  unused today, closing off the identical failure mode in advance rather than
  waiting for it to surface later and require a second investigation.
- This fix required zero changes to any business-logic file, any migration,
  or any Server Action — confirmed by `git diff --stat` showing exactly 3
  files touched, all test/config infrastructure.
