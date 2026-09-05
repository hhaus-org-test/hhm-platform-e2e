# HHM platform foundation acceptance

Independent, read-only acceptance tests for immutable production revisions in the
`hacker-house-medellin` organization.

The first source contract pins the public/client contract core:

- repository: `hacker-house-medellin/hhm-pub-lib-core`
- production revision: `c8040b52174b164e2a2544aaf8532fcd8e06eee2`

The runner creates an operating-system temporary directory, fetches only that 40-character
revision, and executes the source repository's contract, generated-drift, TypeScript, Rust, and
Dart gates. It never falls back to a branch name and never changes the source repository.

```sh
npm ci --ignore-scripts
npm test
```

The private `hacker-house-medellin/hhm-lambdas` repository is intentionally not fetched from this
public test organization. Its production SHA is validated by read-only CI inside the owning
organization until an explicit least-privilege cross-organization read credential is provisioned.

Independent exact-SHA acceptance tests for HHM platform foundations
