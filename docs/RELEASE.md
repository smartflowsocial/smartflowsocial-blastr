# Release process

Releases follow [semver](https://semver.org/). The current prerelease tag is `v1.0.0-rc.1`. Stable tags stay `v1.0.0`, `v1.1.0`, and so on. `v1.0.0-rc.1` is not stable `v1.0.0`.

Pushing a tag does not deploy the worker. Production deploy is the manual **Publish** workflow and requires `deploy-production`. Staging deploy is the manual **Publish Staging** workflow, uses `--env staging`, and requires `deploy-staging`. Staging uses `blastr-publish-jobs-staging` and `blastr-db-staging`. It does not use the production queue.

The changelog section `1.0.0 — 2025-03-12` is a historical baseline. It is not GitHub Release `v1.0.0`.

## Distribution and snapshots

Release artifacts or zip/tarball snapshots **must not include**: `node_modules/`, `coverage/`, `.git/`, `tsconfig.tsbuildinfo`, `.wrangler/`, `.dev.vars`, or any `target/` directory. To produce a clean tarball without those paths:

```bash
git archive --format=tar.gz --prefix=blastr/ HEAD -o blastr-snapshot.tar.gz
```

## Prerequisites

- CI is green (validate, unit, integration, security tests, coverage with thresholds).
- CHANGELOG.md has an **Unreleased** section with entries for user-facing or breaking changes; move those into a new version section before releasing.

## Steps

1. **Bump version** in `package.json` (e.g. `1.0.0` → `1.1.0`).
2. **Update CHANGELOG.md:** Replace the **Unreleased** heading with the new version and date (e.g. `## 1.1.0 — 2025-03-15`). Add an empty **Unreleased** section again for future entries.
3. **Commit:** e.g. `Release v1.1.0`.
4. **Tag:** `git tag -a v1.1.0 -m "v1.1.0"` and `git push origin v1.1.0`. Do not force-update an existing tag.
5. **Deploy:** Do this only as a separate manual action. Pushing the tag does not deploy. Use **Publish** with `deploy-production` or **Publish Staging** with `deploy-staging`. Do not run either one for the `v1.0.0-rc.1` source release.

## Optional: GitHub Actions release workflow

You can add a workflow (e.g. `.github/workflows/release.yml`) that:

- Triggers on `workflow_dispatch` with a version input.
- Runs the full CI suite.
- On success: checks out the tag or branch, runs `pnpm deploy` (or a deploy step), or triggers an external deploy.

Until then, releases are manual: bump version and CHANGELOG, tag, and deploy using your existing process.
