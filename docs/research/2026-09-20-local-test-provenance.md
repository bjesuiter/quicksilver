# Local test-result provenance for GitHub Actions

Date: 2026-09-20

## Decision

Do not treat a developer's local test command as equivalent to a CI test. The practical, low-complexity option is a *local-test declaration*: a small local command runs the suite and posts a successful commit status on the exact PR-head SHA. That lets the deploy workflow avoid re-running a deterministic, non-security-critical test only when the merge commit has the identical source tree.

This is useful as an honest-team speed optimization, but it is not strong provenance. A bearer of a token that can set statuses can claim success without running anything. Keep the trusted GitHub Actions build that creates the Pages artifact, and keep CI (or a protected GitHub App gate) for tests that protect production correctness or security.

If a mergeable, source-pinned trust signal is required, use a GitHub App instead of a personal token. Have the local client submit a signed report to the App's verifier; after enforcing its policy, the App creates the check run. This adds meaningful accountability and central policy, but cannot establish that an unconstrained laptop actually executed the tests.

## The GitHub primitives

### Commit statuses: simplest declaration

`POST /repos/{owner}/{repo}/statuses/{sha}` records a state for one commit SHA. A fine-grained PAT, GitHub App user token, or GitHub App installation token with **Commit statuses: write** can create one ([Create a commit status](https://docs.github.com/en/rest/commits/statuses)). A local command can therefore run the tests and post a `local-tests` status on the PR head:

```text
success  context=local-tests  sha=<PR-head-SHA>
```

This is deliberately a declaration, not evidence of execution: GitHub documents that anyone or any integration with repository write permission can set a status ([Status checks](https://docs.github.com/en/pull-requests/reference/status-checks)). A fine-grained PAT limits blast radius compared with a classic PAT, but it remains a transferable credential. Its status says that the token holder asserted success.

Required checks apply to the latest relevant commit SHA; a check on an earlier commit does not satisfy the rule ([Troubleshooting required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)). This means that a PR could require `local-tests`, but a status on the PR head cannot itself satisfy a requirement on a subsequently-created merge commit.

### Check runs: App-controlled source

Check runs provide richer output, but their write API is for GitHub Apps. The App needs **Checks: write**; authenticated users and OAuth apps cannot create them ([Checks REST API guide](https://docs.github.com/en/rest/guides/using-the-rest-api-to-interact-with-checks)). Branch protection can require a named context specifically from a selected GitHub App, rejecting a status from another person or integration ([protected-branch checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches), [required-status-check API](https://docs.github.com/en/rest/branches/branch-protection)).

That makes an App the appropriate boundary if this becomes a merge gate:

1. A local CLI checks out a clean PR head, runs the prescribed commands, and creates a report that binds repository ID, full commit SHA, Git tree SHA, command IDs, lockfile/toolchain digests, exit result, and timestamps.
2. The CLI signs the report and sends the report plus signature/bundle to a small verifier owned by the GitHub App.
3. The verifier checks the repository, exact SHA/tree, permitted signer identity, report freshness, command policy, and signature; it then creates a completed `local-tests` check run on that SHA.

The App prevents arbitrary repository writers from forging that *particular App's* result, and its immutable policy is easier to audit than every developer's shell configuration. It still proves only that an authorized identity signed an assertion. It cannot reliably prove that the stated tests ran on a normal developer-controlled machine, or that their environment was equivalent to Linux CI.

## Signed reports: useful evidence, not a trusted builder

Sigstore Cosign can sign an ordinary local JSON report with `cosign sign-blob <file> --bundle <bundle>`. The bundle contains the signature, signing certificate, and transparency-log inclusion proof ([Cosign blob signing](https://docs.sigstore.dev/cosign/signing/signing_with_blobs/)). Cosign also supports DSSE in-toto attestations and policy validation ([Cosign attestation verification](https://docs.sigstore.dev/cosign/verifying/attestation/)).

A CI job or the App verifier can verify the bundle and constrain the expected certificate identity and OIDC issuer. The signed payload should include the exact commit and tree, not just a branch name. It should also name the test command and committed inputs that determine it (`package-lock.json`, test configuration, relevant environment versions). A signature provides tamper evidence and signer attribution; it does not make a locally generated `"tests passed"` claim true. Key theft, a malicious developer, skipped commands, changed uncommitted files, and OS/browser differences remain in scope.

For this project, a signed report is worthwhile only if there is an explicit organizational need for attributable developer attestations. Otherwise, a fine-grained-PAT status is the simpler transparent policy: it is an optimization signal, not a security control.

## Why GitHub artifact attestations are not the local-run mechanism

GitHub artifact attestations establish provenance for artifacts produced in GitHub Actions. GitHub's documented generation path is `actions/attest`, with `id-token: write`, `contents: read`, and `attestations: write`; the claim includes the Actions workflow, repository, commit, and triggering event ([artifact-attestation generation](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations), [artifact-attestation concepts](https://docs.github.com/en/actions/concepts/security/artifact-attestations)).

`gh attestation` supplies `download`, `trusted-root`, and `verify` subcommands, not a command to create a local GitHub Actions attestation ([GitHub CLI manual](https://cli.github.com/manual/gh_attestation)). `gh attestation verify` verifies an artifact against an Actions-workflow identity and predicate; it is a consumer, not a local test-result publisher ([`gh attestation verify`](https://cli.github.com/manual/gh_attestation_verify)). The repository attestation API can store an attestation, but GitHub says it is meant to be used by the attest action ([repository attestations API](https://docs.github.com/en/rest/repos/attestations)). It does not turn a local test report into an Actions-backed check.

Use artifact attestations for the Pages build artifact that GitHub Actions actually creates and deploys, if supply-chain provenance becomes a goal. Do not use them to claim that a laptop ran tests.

## Safe deployment optimization for merge commits

For a `push` to `main`, the deploy workflow can consider a prior local declaration only as a narrow skip condition:

1. Resolve the PR associated with the merge commit through GitHub's API; do not infer PR identity solely from a commit message or assume a parent order.
2. Obtain the resolved PR head SHA and require a fresh successful `local-tests` status/check on that exact SHA. For an App-backed design, require the configured App source.
3. Compare the Git tree object of the merge commit with the PR-head tree. Skip only if the tree IDs are equal. A different tree means the test result was for different source content and CI must run.
4. Fail closed: missing PR association, squash/rebase merge, conflict-resolution change, source mismatch, stale report, untrusted source, or verification error all run CI normally.

Tree equality is stricter than equality of the PR diff. It only permits reuse when the merged snapshot is byte-for-byte the PR-head snapshot. A normal merge after `main` moved will often produce a different tree, which is the correct reason to re-run. This is an optimization for the rare same-tree merge, not a general substitute for integration testing.

Do not allow a local declaration to skip the `npm run build` that produces the deployed `dist` artifact. The trusted deployment must build (and, optionally, attest) the exact tree it deploys. GitHub Actions OIDC claims can be constrained to repository, workflow, ref, and reusable-workflow identity, which is the appropriate boundary for deploy credentials ([OIDC reference](https://docs.github.com/en/actions/reference/security/oidc)).

## Recommendation for this repository

Keep the current PR browser tests and the trusted build on the `main` push. First remove measurable duplication within the main workflow, if any. If timings still warrant this experiment:

1. Add an opt-in local `test:report` script that runs only a deterministic cheap suite and posts an exact-SHA `local-tests` commit status using a short-lived, repository-scoped fine-grained PAT. Make its UI/README wording explicit: **developer-declared result; not CI**.
2. In the main workflow, use the four fail-closed conditions above to skip only that same deterministic test. Continue to build from the merge commit and deploy the newly built artifact.
3. Do not make `local-tests` a required or security-sensitive check while it is PAT-posted. If it must become required, replace the direct status post with the signed-report verifier GitHub App and pin the required check source to that App.

This sequencing gives the speed benefit with the smallest new service/credential surface, while clearly preserving the integrity boundary at the GitHub-hosted deployment build.
