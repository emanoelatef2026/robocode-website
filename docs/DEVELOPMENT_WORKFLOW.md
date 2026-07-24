# Development Workflow (Two-PC Setup)

This repo is worked on from two machines (work PC, home PC), both pushing to
the same `origin/main`. This doc exists because that pattern kept producing
merge commits, conflicts in `graphify-out/`, and a dirty working tree
immediately after `npm install` / `graphify` / `next build`. The root causes
are fixed (see "Why this happened" below) — this doc is the discipline that
keeps it fixed.

## Daily startup (on whichever PC you're sitting at)

```bash
git status                # confirm nothing uncommitted is sitting from last time
git pull                  # now rebases (pull.rebase=true) — see "Git config" below
npm install                # only if package.json/lockfile changed since last pull
```

If `git pull` reports local commits it needs to rebase, that's expected when
you committed on the other PC last — it will replay your commits on top of
origin's, cleanly, with no merge commit. If it stops for a real conflict
(same lines of actual source code changed on both machines), resolve it like
any rebase conflict: fix the file, `git add <file>`, `git rebase --continue`.

## Daily shutdown (before you walk away from a PC)

```bash
git status                 # anything you want to keep?
git add <files>            # stage what you intend to keep — never `git add -A` blindly
git commit -m "..."
git push
```

**Push before you switch machines.** The entire class of problem this doc
addresses comes from committing on PC A, then sitting down at PC B and
committing again *before* pulling A's work. Rebase makes the eventual pull
painless even if you forget, but pushing at the end of every session is what
actually prevents divergence in the first place.

## Safe pull strategy

`pull.rebase` is set to `true` in this repo's local git config (`.git/config`,
not versioned — see "Git config" below), so `git pull` = fetch + rebase. This
keeps history linear: no merge commits for the ordinary "I worked on both
machines" case. Real conflicts (you changed the same lines of actual product
code on both PCs) still require manual resolution — rebase doesn't remove
that, it just stops the noise of merge commits for the *non*-conflicting
divergences that used to trigger them.

**This setting lives in `.git/config`, which is per-clone and never pushed.**
Run this once on every machine that clones this repo (both the work PC and
the home PC need it set independently — pulling this repo does not carry it
over):

```bash
git config pull.rebase true
git config rerere.enabled true
git config push.autoSetupRemote true
```

`rerere.enabled` makes git remember how you resolved a conflict so it can
auto-apply the same resolution if the identical conflict recurs (useful if a
rebase ever needs re-running). `push.autoSetupRemote` just removes the need
for `-u origin <branch>` the first time you push a new branch.

## Safe push strategy

Plain `git push` is fine — `push.autoSetupRemote=true` means pushing a new
branch for the first time doesn't need `-u origin <branch>`. Don't force-push
`main`.

## Handling generated files

Never commit anything regenerable by running a command. That includes (all
gitignored):

- `node_modules/`, `.next/`, `/out/`, `/build/`, `*.tsbuildinfo`, `next-env.d.ts`
- `.vercel/`
- `/supabase/.temp`
- **`graphify-out/`** (see next section — this was the main offender)

If `git status` ever shows one of these as modified/untracked, it means
something is either missing from `.gitignore` or was tracked before the
ignore rule existed — `git rm -r --cached <path>` removes it from tracking
without touching the file on disk.

## Handling Graphify

`graphify-out/` is now fully gitignored and untracked (it was previously
committed — see "Why this happened"). It regenerates locally:

```bash
graphify update .
```

Run this after pulling if you want the local graph current before asking
`/graphify` questions — it's optional, not required for the build or tests.
Never commit anything under `graphify-out/`, including `GRAPH_REPORT.md` — if
you want a durable snapshot of a report for humans to read later, copy the
specific file into `docs/` under its own name; don't let the live
auto-regenerated one be tracked.

There is also a **local git post-commit hook**
(`.git/hooks/post-commit`, installed by `graphify hook install`) that
rebuilds the graph in the background after every commit on whichever machine
you're on. That hook is not itself versioned (git hooks never are), so it
only exists on machines where you've run `graphify hook install`. It's safe
to keep now that its output is gitignored — before this fix, it was the
direct cause of tracked-file drift between machines (it silently mutated
`graph.json`/`manifest.json`/the AST cache on every commit, independently on
each PC, producing unmergeable diffs the moment you pulled).

If you ever see the hook fire and don't want it: `GRAPHIFY_SKIP_HOOK=1 git commit ...`,
or remove the hook entirely with `graphify hook uninstall` (or delete
`.git/hooks/post-commit`).

## Handling Claude Code

- `.claude/settings.local.json` is gitignored (per-developer permission
  cache) — never share it, never expect it to be present on a fresh clone.
- `.claude/settings.json`, `.claude/CLAUDE.md`, and `.claude/skills/graphify/`
  **are** tracked — they're shared, hand-authored project configuration
  (hooks, the graphify skill), not per-machine state, so they should stay in
  sync between the two PCs via normal commits.
- `.agents/`, `skills-lock.json`, and everything else under
  `.claude/skills/` (e.g. `deploy-to-vercel`, `supabase`,
  `vercel-react-best-practices`) are **gitignored**. These are
  marketplace-installed skills restored from `skills-lock.json` by the skill
  installer — regenerable, per-machine, and not meant to be hand-edited or
  diffed. If you install a new marketplace skill, it will show as untracked
  right up until you run the install again on the other PC; that's expected
  and does not need a commit.
- If Claude Code (or any tool) ever proposes committing `graphify-out/`,
  `.next/`, `node_modules/`, `.agents/`, or a non-graphify `.claude/skills/*`
  folder, that's a bug in the ignore rules, not something to work around by
  committing anyway — fix `.gitignore` instead.

## How to avoid merge commits

1. Push at the end of every session (see "Daily shutdown").
2. Pull at the start of every session, before writing any code (see "Daily
   startup") — `pull.rebase=true` handles the rest.
3. Don't track generated/regenerable files (see above) — untracked churn in
   files like `graphify-out/graph.json` was, in practice, the single biggest
   source of conflicts in this repo, because two machines independently
   regenerating the same JSON blob produce content that has no sensible
   3-way merge.

## How to resolve conflicts if they ever happen

With `pull.rebase=true`, a conflict during `git pull` stops mid-rebase:

```bash
git status                  # shows the conflicting file(s)
# edit the file(s), resolve the <<<<<<< / ======= / >>>>>>> markers
git add <file>
git rebase --continue        # repeat if more commits in the rebase also conflict
# or, to bail out entirely and go back to how things were:
git rebase --abort
```

If a conflict shows up in a file under `graphify-out/`, something has
regressed (it should be gitignored) — fix `.gitignore`/untrack it rather than
hand-resolving the JSON.

## Best practices

- **Push before you walk away.** This single habit prevents nearly all
  divergence between the two PCs — see "Daily shutdown."
- **Pull before you start typing.** Do it before opening an editor, not after
  you've already made changes — see "Daily startup."
- **Never `git add -A` or `git add .` blindly.** Review `git status` first;
  it's the fastest way an ignored-but-not-yet-fixed generated file sneaks
  back into a commit.
- **Never commit a regenerable file.** If a command can produce it
  (`npm install`, `next build`, `graphify update .`), it doesn't belong in
  git. When in doubt, ask "does the other machine need this file, or can it
  just run the command that makes it?"
- **Treat a merge/rebase conflict inside `graphify-out/` as a bug report**,
  not a normal conflict to resolve — it means something regressed the
  `.gitignore` rule, not that you need to manually merge JSON.
- **Set the git config on both machines**, not just one — see the callout in
  "Safe pull strategy." It's local-only and does not travel with the repo.
- **Don't disable the graphify post-commit hook to "fix" this class of
  problem** — the hook itself was never the bug; tracking its output was.
  With `graphify-out/` gitignored, the hook running on every commit is
  harmless background work.

## Why this happened (root cause)

Before this doc, `graphify-out/` — including `graph.json`, `GRAPH_REPORT.md`,
`manifest.json`, dated snapshot folders (`graphify-out/2026-07-02/`, etc.),
and the AST cache (`graphify-out/cache/ast/...`) — was **committed to git**.
A local post-commit hook (installed per-machine via `graphify hook install`)
rebuilds this graph in the background after *every* commit. Because the
rebuild is independent on each machine (different file-touch timestamps,
different cache contents, non-deterministic dated snapshot folders), the two
PCs' regenerated JSON diverged from each other constantly. Since the files
were tracked, that divergence showed up as modified/untracked files right
after every commit, and as merge conflicts the moment you pulled the other
machine's independently-regenerated version. Combined with `pull.rebase`
being unset (defaulting to merge), any ordinary divergence between the two
PCs' commit histories also produced a merge commit instead of a clean
fast-forward.

The fix: `graphify-out/` is gitignored and untracked (this doc's companion
change), and `pull.rebase=true` is set locally so future divergence rebases
instead of merging. Neither the graph nor its cache needs to be shared
between machines — `graphify update .` regenerates it from source in
seconds, with no LLM/API cost for code-only extraction.
