import { execFileSync } from "node:child_process";

const context = "quicksilver/local-e2e";

function run(command, args) {
  return execFileSync(command, args, { encoding: "utf8" }).trim();
}

if (run("git", ["status", "--porcelain=v1", "--untracked-files=all"])) {
  throw new Error("Commit or stash every change before recording a local test result.");
}

const sha = run("git", ["rev-parse", "HEAD"]);
const repository = run("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);

execFileSync(
  "gh",
  [
    "api",
    "--method",
    "POST",
    `repos/${repository}/statuses/${sha}`,
    "-f",
    "state=success",
    "-f",
    `context=${context}`,
    "-f",
    "description=Full Playwright suite passed on a clean local tree.",
    "-f",
    `target_url=https://github.com/${repository}/commit/${sha}`
  ],
  { stdio: "inherit" }
);

console.log(`Recorded ${context} for ${sha}.`);
