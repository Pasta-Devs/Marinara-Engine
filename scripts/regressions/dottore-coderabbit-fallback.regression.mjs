import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The fallback step runs on Ubuntu; native Windows does not require its Bash tooling.
if (process.platform === "win32") {
  console.log("Skipping the POSIX Dottore CodeRabbit fallback on Windows; exercise it on Ubuntu or macOS with Bash.");
  process.exit(0);
}

const source = readFileSync(
  new URL("../../.github/workflows/dottore-coderabbit-fallback.yml", import.meta.url),
  "utf8",
);
assert.ok(
  source.includes(`    if: >
      github.event.check_run.app.slug == 'coderabbitai' &&
      github.event.check_run.name == 'CodeRabbit' &&
      github.event.check_run.conclusion == 'success'
    runs-on:`),
  "The job must run only for a successful CodeRabbit review, with every condition required",
);
const lines = source.split("        run: |\n")[1]?.split("\n");
assert.ok(lines, "The fallback Bash step must exist");
const script = [];
for (const line of lines) {
  if (line.trim() && !line.startsWith("          ")) break;
  script.push(line.slice(10));
}
const bash = script.join("\n");
assert.ok(!bash.includes("${{"), "The step must read the event through env, not workflow expressions");

const head = "a".repeat(40);
const temp = mkdtempSync(join(tmpdir(), "marinara-dottore-fallback-"));
try {
  // gh mock: serves the open PRs, the head's combined status and the PR's comments, records every call.
  writeFileSync(
    join(temp, "gh"),
    `#!/usr/bin/env node
const fs = require("node:fs");
const cp = require("node:child_process");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FALLBACK_CALLS, JSON.stringify(args) + "\\n");
const jq = (input) => {
  const result = cp.spawnSync("jq", ["-r", args[args.indexOf("--jq") + 1]], { input: JSON.stringify(input), encoding: "utf8" });
  process.stdout.write(result.stdout ?? "");
  process.exit(result.status ?? 1);
};
if (args[0] === "api" && args[1].includes("/pulls?")) jq(JSON.parse(process.env.FALLBACK_PULLS));
if (args[0] === "api" && args[1].includes("/status?")) jq({ statuses: JSON.parse(process.env.FALLBACK_STATUSES) });
if (args[0] === "api" && args[1].includes("/issues/9086/comments?")) jq(JSON.parse(process.env.FALLBACK_COMMENTS));
if (args[0] === "api" && args[1] === "--method" && args[3].includes("/statuses/")) process.exit(0);
throw new Error("Unexpected gh call: " + JSON.stringify(args));
`,
    { mode: 0o755 },
  );
  const run = ({ pulls, statuses, comments = [request()] }) => {
    const calls = join(temp, "calls.jsonl");
    writeFileSync(calls, "");
    const result = spawnSync("bash", ["-e", "-o", "pipefail", "-c", bash], {
      encoding: "utf8",
      timeout: 10_000,
      env: {
        ...process.env,
        PATH: `${temp}:${process.env.PATH}`,
        FALLBACK_CALLS: calls,
        FALLBACK_PULLS: JSON.stringify(pulls),
        FALLBACK_STATUSES: JSON.stringify(statuses),
        FALLBACK_COMMENTS: JSON.stringify(comments),
        GH_TOKEN: "test",
        REPO: "Pasta-Devs/Marinara-Engine",
        HEAD_SHA: head,
        CHECK_URL: "https://github.com/Pasta-Devs/Marinara-Engine/runs/1",
      },
    });
    assert.equal(result.status, 0, result.stderr);
    return readFileSync(calls, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((args) => args[1] === "--method");
  };
  const failedAt = "2026-11-12T10:00:00Z";
  function request(association = "MEMBER", createdAt = "2026-11-12T10:05:00Z", body = "@coderabbitai full review") {
    return { created_at: createdAt, author_association: association, body, user: { login: "Promansis" } };
  }
  const pr = [
    { number: 9000, head: { sha: "b".repeat(40) } },
    { number: 9086, head: { sha: head } },
  ];
  const dottore = (state) => [
    { context: "CodeQL", state: "success" },
    { context: "Dottore Review", state, updated_at: failedAt },
  ];

  const posts = run({ pulls: pr, statuses: dottore("failure") });
  assert.equal(posts.length, 1, "A failed Dottore review on the current head is replaced");
  assert.ok(posts[0][3].endsWith(`/statuses/${head}`));
  assert.ok(posts[0].includes("state=success") && posts[0].includes("context=Dottore Review"));
  const description = posts[0].find((arg) => arg.startsWith("description="));
  assert.ok(description.includes("asked by Promansis"), "The status names the member who asked for the stand-in");
  assert.ok(description.length - "description=".length + 39 - "Promansis".length <= 140, "Fits 140 characters");
  assert.equal(
    run({ pulls: pr, statuses: dottore("failure"), comments: [request("OWNER", failedAt, "@CodeRabbitAI review")] })
      .length,
    1,
    "An owner's request at the failure counts",
  );

  assert.equal(
    run({
      pulls: pr,
      statuses: dottore("failure"),
      comments: [request("COLLABORATOR"), request("CONTRIBUTOR"), request("NONE")],
    }).length,
    0,
    "Only a Pasta-Devs owner or member can ask for the stand-in",
  );
  assert.equal(
    run({ pulls: pr, statuses: dottore("failure"), comments: [request("MEMBER", "2026-11-12T09:59:59Z")] }).length,
    0,
    "A request from before Dottore failed does not count",
  );
  assert.equal(
    run({ pulls: pr, statuses: dottore("failure"), comments: [request("MEMBER", undefined, "@coderabbitai summary")] })
      .length,
    0,
    "Only a review request counts",
  );

  assert.equal(run({ pulls: pr, statuses: dottore("success") }).length, 0, "A Dottore pass is left alone");
  assert.equal(run({ pulls: pr, statuses: [] }).length, 0, "A head Dottore never tried is left alone");
  assert.equal(
    run({ pulls: [pr[0]], statuses: dottore("failure") }).length,
    0,
    "A SHA that is no open PR's current head is left alone",
  );
  console.log("Dottore CodeRabbit fallback regression passed (8 cases).");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
