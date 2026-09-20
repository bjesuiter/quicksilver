# Reusing CI results after a pull request merges

Date: 2026-09-20

## Short answer

GitHub Actions has no first-party setting that notices a successful pull request run and suppresses a later `push` run for the same commit. A workflow trigger starts a new run. GitHub can reuse dependency downloads through its cache, and one workflow can download another workflow run's artifacts, but neither feature makes an earlier test result count as a new required check.

There is one narrow exception. Required checks belong to a commit SHA. If the already-tested pull request head is pushed unchanged to `main`, its successful checks remain on that SHA. GitHub documents that an up-to-date pull request with passing required checks may be merged locally and pushed to a protected branch without running checks on the merge commit. Normal GitHub merge methods usually create a different commit SHA, so this is not a dependable optimization for the release workflow ([troubleshooting required checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)).

## What GitHub supports

Required checks must pass on the latest relevant SHA. A successful check on an earlier commit does not satisfy the rule. A job only counts for a pull request ruleset when its workflow was triggered by `push`, `pull_request`, `pull_request_review`, `pull_request_target`, `deployment`, or `deployment_status`. A `workflow_run` job is therefore not a replacement required check ([troubleshooting required checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)).

`workflow_run` can start a downstream workflow after a named workflow finishes. The downstream workflow can test `github.event.workflow_run.conclusion` and download an artifact using the upstream run ID. This is a good way to hand a trusted build to a deployment job, not a way to make an earlier PR check satisfy a later SHA ([workflow_run event](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run)). A downstream `workflow_run` gets secrets and a write-capable token even when its predecessor did not. Treat PR artifacts as untrusted and never check out or execute their content in that privileged job ([secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)).

Artifacts are for build outputs and data passed between jobs or workflow runs. Caches are for dependencies and repeatable intermediate files. GitHub says they are not interchangeable ([workflow artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts), [dependency caching](https://docs.github.com/en/actions/concepts/workflows-and-actions/dependency-caching)). The existing `actions/setup-node` npm cache is useful, but it only avoids dependency downloads. It does not certify or replay a completed test suite.

An Actions cache also cannot bridge a pull request run into `main`: caches are branch/tag scoped, and a PR cache at `refs/pull/.../merge` can only be restored by runs of that pull request. Cache contents are untrusted input and must never include secrets ([cache scope and security](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching#restrictions-for-accessing-a-cache)).

GitHub exposes enough data to build a custom gate, including workflow runs, check suites and runs for a SHA, commit statuses, and artifacts. It does not document a native API or ruleset feature that transfers a successful Actions result to a different SHA or prevents the later trigger from running ([workflow runs API](https://docs.github.com/en/rest/actions/workflow-runs), [check suites API](https://docs.github.com/en/rest/checks/suites#list-check-suites-for-a-git-reference), [commit statuses API](https://docs.github.com/en/rest/commits/statuses), [artifacts API](https://docs.github.com/en/rest/actions/artifacts)).

## This repository's release path

`pages.yml` runs type checking and a production build on every PR and every push to `main`. Browser tests run only on pull requests. `release.yml` creates or updates a Changesets version PR after a main push. That version PR introduces its own version-bump commit, so it must be validated as a new commit. After it merges, the push to `main` runs type checking and building again before Pages deploys.

The browser suite already avoids the costly duplicate run. Keep it that way. Do not make the Pages deployment trust a pull request artifact by default. A fork can supply that artifact, and the deployment job has `pages: write` plus an OIDC token.

The recommended near-term design is:

1. Keep the version PR's required PR checks. They validate the precise Changesets-generated version commit.
2. Keep one trusted build on the `main` push that actually deploys. It provides the Pages artifact and protects the production boundary.
3. Remove duplicated work inside that push workflow before adding cross-run logic. In particular, `npm run build` already begins with `tsc -b`, so a prior standalone `npm run typecheck` may be redundant. Measure this before changing the check layout.
4. Pass the Pages artifact directly between jobs in the same run. Cross-run artifact handoff does not improve this version-PR path and brings a trust boundary to defend.

If future timings show that the main build is material, use a same-tree duplicate tool only for an unprivileged validation job. Do not use it to skip the trusted deployment build unless the artifact provenance and source-repository checks have been designed and reviewed.

## Third-party options

[`fkirc/skip-duplicate-actions`](https://github.com/marketplace/actions/skip-duplicate-actions) is the closest match for avoiding post-merge duplicate validation. It queries workflow runs for the same workflow and compares Git tree hashes, so it can skip a `push` run when a successful PR run checked the same content. It deliberately handles different commit SHAs with the same tree. That is broader than this request and means it is policy code in a required workflow, not a GitHub guarantee. Configure pull-request triggers as `do_not_skip` so every version PR is tested, and pin the action to a commit SHA if adopted. It can skip a job but cannot produce a fresh Pages artifact for deployment.

[Nx remote caching](https://nx.dev/docs/features/ci-features/remote-cache) is the best fit for the literal "reuse a local run" idea. Nx caches deterministic task results locally, then its remote cache shares them with developer machines and CI. On a hit, it restores logs and declared outputs without running the task. Nx warns that tests which depend on a changing backend should not be cached ([cache task results](https://nx.dev/docs/features/cache-task-results)). This project is a single-package Vite app with Playwright browser tests, so adopting Nx solely for one suite is probably more machinery than the current duplicated work justifies.

[Turborepo remote caching](https://github.com/vercel/turborepo/blob/main/apps/docs/content/docs/crafting-your-repository/caching.mdx) provides the same model for JavaScript projects. It fingerprints task inputs, shares cache entries between local machines and CI, and replays cached task logs and declared outputs. Turborepo requires deterministic tasks, and its own docs note that cache transfer can cost more than re-executing a fast task. It is worth considering only if the repository grows into a multi-package workspace or builds become consistently expensive.

Neither Nx nor Turborepo turns a local test run into a GitHub required status check. They avoid recomputing deterministic work after GitHub has started the check.
