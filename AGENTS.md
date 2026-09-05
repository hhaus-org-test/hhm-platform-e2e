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

