## Agent skills

### Issue tracker

Issues and specs are tracked in this repository's GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default canonical triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Uses the single-context layout. See `docs/agents/domain.md`.

### Releases

For a production change, run `npm run changeset` and commit the generated `.changeset/*.md` file with the change. After it merges to `main`, let the **Prepare release** workflow create its version pull request; merge that pull request to deploy the release to GitHub Pages. For work that needs no release, run `npm run changeset -- --empty`.
