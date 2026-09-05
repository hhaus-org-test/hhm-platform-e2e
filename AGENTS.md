# Repository agent instructions

Follow the organization-wide guidance in
[`ORESoftware/my-ai/AGENTS.md`](https://github.com/ORESoftware/my-ai/blob/main/AGENTS.md)
and its semantic Git procedures.

- This repository is the canonical external acceptance harness for HHM platform foundations.
- Treat source repositories as read-only. Fetch only immutable revisions declared in
  `contracts/source.json` into an operating-system temporary directory.
- Never replace an immutable revision with a branch, tag, release name, or latest-version lookup.
- Keep tests fail-closed: source identity, revision, expected generator revision, language gates,
  and clean post-test status must all match.
- Do not add cross-organization credentials to test private sources without explicit approval and
  a least-privilege design.
- Keep all npm versions exact and commit the resolver-generated `package-lock.json`.
- Pin GitHub Actions by full commit, disable persisted checkout credentials, use read-only
  permissions, and set explicit command timeouts.
- Never commit credentials, cookies, `.env` files, provider data, or production-derived PII.
- Use feature branches and PRs through `dev` to `main`; never force-push, rebase shared work,
  reset, stash, clean, or discard unfamiliar work.

## Repository-local Git worktrees

- Create or use a Git worktree only when the human operator explicitly authorizes it for the current task. Concurrency or a dirty checkout is not permission by itself.
- Put every authorized worktree at `<repository-root>/tmp/worktrees/<name>`; from the repository root, use `./tmp/worktrees/<name>`. Never place worktrees beside repositories or organization directories.
- Keep `tmp`, `temp`, `tmp/worktrees`, and `temp/worktrees` ignored in the repository-root `.gitignore`. Do not commit files from those directories.
- Relocate or remove a worktree only when the operator explicitly requests it. Before removal, preserve and publish intended changes, verify its commit is represented on the target branch, and confirm there are no tracked, untracked, ignored-sensitive, or in-use files that must survive. Remove it with `git worktree remove <path>` without `--force`; never delete a worktree directory with `rm`.
