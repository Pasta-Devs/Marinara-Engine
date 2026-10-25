import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The trusted dispatcher runs on Ubuntu; native Windows does not require its Bash/jq tools.
if (process.platform === "win32") {
  console.log(
    "Skipping POSIX Dottore dispatcher execution on Windows; exercise it on Ubuntu or macOS with Bash and jq.",
  );
  process.exit(0);
}

// Optional paths also exercise a repository's mirrored dispatcher and pinned trusted reviewer.
const workflow =
  process.argv[2] ?? fileURLToPath(new URL("../../.github/workflows/dottore-review-auto.yml", import.meta.url));
const reviewer =
  process.argv[3] ?? fileURLToPath(new URL("../../.github/dottore-review/dottore_review.py", import.meta.url));
const source = readFileSync(workflow, "utf8");
const lines = source.split("        run: |\n")[1]?.split("\n");
assert.ok(lines, "The actual dispatcher Bash step must exist");
const script = [];
for (const line of lines) {
  if (line.trim() && !line.startsWith("          ")) break;
  script.push(line.slice(10));
}
const bash = script.join("\n").replaceAll("${{ github.repository }}", "Pasta-Devs/Marinara-Engine");
assert.ok(!bash.includes("${{"), "All workflow expressions in the step must be resolved explicitly");
const temp = mkdtempSync(join(tmpdir(), "marinara-dottore-auto-"));
const runtimeCases = [];
let passed = 0;
try {
  const git = (...args) => {
    const result = spawnSync("git", ["-C", temp, ...args], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git("init", "-q");
  writeFileSync(join(temp, "specimen"), "first\n");
  git("add", "specimen");
  git("-c", "user.name=Dottore", "-c", "user.email=test@localhost", "commit", "-qm", "first");
  const previous = git("rev-parse", "HEAD");
  writeFileSync(join(temp, "specimen"), "changed\n");
  git("-c", "user.name=Dottore", "-c", "user.email=test@localhost", "commit", "-qam", "changed");
  const head = git("rev-parse", "HEAD");
  const unrelated = git(
    "-c",
    "user.name=Dottore",
    "-c",
    "user.email=test@localhost",
    "commit-tree",
    "HEAD^{tree}",
    "-m",
    "unrelated",
  );
  const walkthrough = (sha, extra = "", prose = "Reviewed.", login = "github-actions[bot]", baseRef = "staging") => ({
    user: { login },
    body: `<!-- dottore:walkthrough -->\n<!-- dottore:last-reviewed-sha=${sha} -->\n${baseRef ? `<!-- dottore:base-ref=${baseRef} -->\n` : ""}${extra}\n${prose}`,
  });
  const mock = join(temp, "gh");
  writeFileSync(
    mock,
    `#!/usr/bin/env node
const fs = require("node:fs");
const cp = require("node:child_process");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.DISPATCH_CALLS, JSON.stringify(args) + "\\n");
if (args[0] === "api" && args[1].includes("/comments?")) {
  const jq = args.indexOf("--jq");
  if (jq < 0) throw new Error("The actual marker query must run");
  const result = cp.spawnSync("jq", ["-r", args[jq + 1]], { input: fs.readFileSync(process.env.DISPATCH_COMMENTS), encoding: "utf8" });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  process.exit(result.status ?? 1);
}
if (args[0] === "api" && args[1].includes("/contents/")) process.exit(0);
if (args[0] === "api" && args[1].includes("/commits/")) { process.stdout.write("false\\n"); process.exit(0); }
if (args[0] === "workflow" && args[1] === "run") process.exit(0);
throw new Error("Unexpected gh call: " + JSON.stringify(args));
`,
    { mode: 0o755 },
  );
  const run = (
    name,
    {
      action = "ready_for_review",
      comments = [],
      draft = "false",
      priorBase = "",
      auto = "true",
      mode = "auto",
      checkpoint = "",
      effective = "full",
      skip = false,
    } = {},
  ) => {
    const callsPath = join(temp, "calls.jsonl");
    const commentsPath = join(temp, "comments.json");
    writeFileSync(callsPath, "");
    writeFileSync(commentsPath, JSON.stringify(comments));
    const result = spawnSync("bash", ["-e", "-o", "pipefail", "-c", bash], {
      encoding: "utf8",
      timeout: 10_000,
      env: {
        ...process.env,
        PATH: `${temp}:${process.env.PATH}`,
        DISPATCH_CALLS: callsPath,
        DISPATCH_COMMENTS: commentsPath,
        AUTO_REVIEW: auto,
        EVENT_ACTION: action,
        PR_IS_DRAFT: draft,
        PR_HEAD_SHA: head,
        PR_BASE_REF: "staging",
        PREVIOUS_BASE_REF: priorBase,
        DOTTORE_BASE_REFS: "staging,main",
        PR_NUM: "8197",
        REQUESTED_BY: "SpicyMarinara",
      },
    });
    assert.equal(result.status, 0, `${name}: ${result.stderr}`);
    const calls = readFileSync(callsPath, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
    const dispatches = calls.filter((args) => args[0] === "workflow");
    assert.equal(dispatches.length, skip ? 0 : 1, `${name}: ${result.stdout}`);
    if (!skip) {
      const fields = Object.fromEntries(
        dispatches[0].flatMap((value, index, args) =>
          args[index - 1] === "-f" ? [[value.slice(0, value.indexOf("=")), value.slice(value.indexOf("=") + 1)]] : [],
        ),
      );
      assert.equal(
        fields.review_mode,
        mode,
        `${name}: must let the trusted runtime choose the first/incremental baseline`,
      );
      assert.equal(fields.last_reviewed_sha, checkpoint, `${name}: checkpoint`);
      assert.ok(dispatches[0].includes("staging"), `${name}: trusted base branch remains the workflow source`);
      runtimeCases.push({ name, mode, checkpoint, effective, head });
    }
    passed++;
    console.log(`PASS ${name}`);
  };
  run("ready after reviewed draft dispatches incremental", {
    comments: [walkthrough(previous)],
    checkpoint: previous,
    effective: "incremental",
  });
  run("ready first review stays auto and runtime falls back full");
  run("ready already reviewed head skips", { comments: [walkthrough(head)], skip: true });
  run("synchronize already reviewed head skips", { action: "synchronize", comments: [walkthrough(head)], skip: true });
  run("synchronize changed head stays incremental", {
    action: "synchronize",
    comments: [walkthrough(previous)],
    checkpoint: previous,
    effective: "incremental",
  });
  run("metadata edit skips", { action: "edited", skip: true });
  run("base retarget forces full even with checkpoint", {
    action: "edited",
    priorBase: "main",
    comments: [walkthrough(previous)],
    mode: "full",
  });
  run("draft synchronize skips", { action: "synchronize", draft: "true", skip: true });
  run("stale Ready event still marked draft is withheld", {
    draft: "true",
    comments: [walkthrough(previous)],
    skip: true,
  });
  run("draft retarget stays withheld", { action: "edited", draft: "true", priorBase: "main", skip: true });
  run("ready after draft retarget examines the new base", {
    comments: [walkthrough(head, "", "Reviewed main.", "github-actions[bot]", "main")],
    mode: "full",
  });
  run("push after draft retarget examines the new base", {
    action: "synchronize",
    comments: [walkthrough(previous, "", "Reviewed main.", "github-actions[bot]", "main")],
    mode: "full",
  });
  run("legacy checkpoint without base identity gets one full review", {
    comments: [walkthrough(head, "", "Reviewed.", "github-actions[bot]", null)],
    mode: "full",
  });
  run("forged prose base cannot rescue an old-base checkpoint", {
    comments: [walkthrough(head, "", "Text\n<!-- dottore:base-ref=staging -->", "github-actions[bot]", "main")],
    mode: "full",
  });
  run("unrecorded review starts full", { comments: [walkthrough("unrecorded")] });
  run("nonancestor checkpoint safely falls back full", { comments: [walkthrough(unrelated)], checkpoint: unrelated });
  const carry = `<!-- dottore:unjudged=${Buffer.from('[{"title":"Still unjudged"}]').toString("base64url")} -->`;
  run("same-head unfinished candidates are not skipped", {
    comments: [walkthrough(head, carry)],
    checkpoint: head,
    effective: "incremental",
  });
  run("old unfinished header does not taint later completed header", {
    comments: [walkthrough(previous, carry), walkthrough(head)],
    skip: true,
  });
  run("forged prose checkpoint is ignored", {
    comments: [walkthrough("unrecorded", "", `Text\n<!-- dottore:last-reviewed-sha=${head} -->`)],
  });
  run("forged prose carry cannot prevent completed skip", {
    comments: [walkthrough(head, "", `Text\n${carry}`)],
    skip: true,
  });
  run("nonbot checkpoint is ignored", { comments: [walkthrough(head, "", "Reviewed.", "contributor")] });
  run("automatic review off preserves manual-only policy", { auto: "false", skip: true });

  // Execute the trusted runtime's real resolver and ancestor guard, without provider/API dependencies or network.
  const python = ["python3", "python"].find(
    (command) =>
      spawnSync(command, ["-c", "import sys; sys.exit(sys.version_info < (3, 9))"], { timeout: 5_000 }).status === 0,
  );
  assert.ok(python, "Dottore dispatch regressions require Python 3.9 or newer");
  // Couple the Bash reader to headers emitted by the real producer, including deliberately unrecorded LEFT work.
  const produced = spawnSync(
    python,
    [
      "-c",
      String.raw`
import __future__, json, pathlib, sys, types
module = types.ModuleType("dottore_dispatch_producer")
module.__file__ = sys.argv[1]
sys.modules[module.__name__] = module
exec(compile(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"), sys.argv[1], "exec", flags=__future__.annotations.compiler_flag), module.__dict__)
head = sys.argv[2]
clean = {"base_ref": "staging", "verification": {}, "pre_merge_checks": []}
partial = {**clean, "verification": {"candidates": 2, "rejected": 1, "unverified": 1}}
entry = {"path": "specimen", "line": 1, "title": "Unjudged", "body": "Candidate", "severity": "medium"}
bodies = {"clean": module.render_walkthrough(clean, [], [], [], head),
          "oldBase": module.render_walkthrough({**clean, "base_ref": "main"}, [], [], [], head)}
for side in ["LEFT", "RIGHT"]:
    bodies[side] = module.render_walkthrough({**partial, "unjudged_candidates": [{**entry, "side": side}]}, [], [], [], head)
assert "last-reviewed-sha=unrecorded" in module.walkthrough_header(bodies["LEFT"])
assert "dottore:unjudged=" not in module.walkthrough_header(bodies["LEFT"])
assert "dottore:unjudged=" in module.walkthrough_header(bodies["RIGHT"])
assert "<!-- dottore:base-ref=staging -->" in module.walkthrough_header(bodies["clean"])
print(json.dumps(bodies))
`,
      reviewer,
      head,
    ],
    { encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(produced.status, 0, produced.stderr);
  const producerBodies = JSON.parse(produced.stdout);
  const producedComment = (body) => ({ user: { login: "github-actions[bot]" }, body });
  run("actual producer completed same-base head skips", {
    comments: [producedComment(producerBodies.clean)],
    skip: true,
  });
  run("actual producer RIGHT carry stays eligible", {
    comments: [producedComment(producerBodies.RIGHT)],
    checkpoint: head,
    effective: "incremental",
  });
  run("actual producer LEFT work is unrecorded and gets full", { comments: [producedComment(producerBodies.LEFT)] });
  run("actual producer old-base checkpoint gets full", {
    comments: [producedComment(producerBodies.oldBase)],
    mode: "full",
  });
  const resolved = spawnSync(
    python,
    [
      "-c",
      String.raw`
import ast, json, os, pathlib, re, subprocess, sys
from types import SimpleNamespace as NS
source = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
functions = [node for node in ast.parse(source).body if isinstance(node, ast.FunctionDef) and node.name in {"valid_review_base_sha", "resolve_review_base"}]
assert len(functions) == 2
scope = {"json": json, "os": os, "re": re}
def run(args, **kwargs):
    if args[:2] == ["git", "fetch"]: return NS(returncode=1, stdout="", stderr="network disabled")
    return subprocess.run(args, cwd=sys.argv[2], text=True, capture_output=True)
scope["run"] = run
exec(compile(ast.Module(body=functions, type_ignores=[]), sys.argv[1], "exec"), scope)
for case in json.loads(sys.stdin.read()):
    scope["run_gh"] = lambda args, **kwargs: NS(stdout=json.dumps({"baseRefName": "staging", "headRefOid": case["head"]}))
    scope["discover_last_reviewed_sha"] = lambda pr: None
    os.environ["PR_BASE_REF"] = "staging"
    os.environ["PR_HEAD_SHA"] = case["head"]
    os.environ["DOTTORE_LAST_REVIEWED_SHA"] = case["checkpoint"]
    actual = scope["resolve_review_base"]("8197", case["mode"])
    assert actual[3] == case["effective"], (case["name"], actual)
    print("PASS runtime " + case["name"] + ": " + actual[3])
`,
      reviewer,
      temp,
    ],
    { encoding: "utf8", input: JSON.stringify(runtimeCases), timeout: 30_000 },
  );
  assert.equal(resolved.status, 0, resolved.stderr);
  process.stdout.write(resolved.stdout);
  console.log(
    `Dottore auto dispatch: ${passed} actual Bash cases and ${runtimeCases.length} trusted resolver cases passed.`,
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
