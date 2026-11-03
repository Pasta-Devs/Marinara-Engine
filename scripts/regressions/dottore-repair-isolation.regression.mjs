import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Runs the fix job's real repair Bash on a head that brings its own Claude Code configuration. A stand-in `claude`
// records how it was started and what it could see; it is the only boundary the fixture replaces.
if (process.platform === "win32") {
  console.info("Dottore repair isolation regressions skipped on Windows.");
  process.exit(0);
}
const workflow = readFileSync(new URL("../../.github/workflows/dottore-review.yml", import.meta.url), "utf8");
const step = workflow.split(/^      - name: /mu).find((text) => text.startsWith("Repair the open findings\n"));
assert.ok(step, "The fix job has its repair step");
const lines = step.split("        run: |\n")[1].split("\n");
const end = lines.findIndex((line) => line.trim() && !line.startsWith("          "));
const directory = mkdtempSync(join(tmpdir(), "dottore-repair-isolation-"));
const script = lines
  .slice(0, end < 0 ? undefined : end)
  .map((line) => line.slice(10))
  .join("\n")
  .replaceAll("/tmp/dottore-", join(directory, "dottore-"));
const git = (args, cwd) => {
  const result = spawnSync("git", ["-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", ...args], {
    cwd,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
};
try {
  const head = join(directory, "head");
  const bin = join(directory, "bin");
  for (const path of [join(head, ".claude"), bin, join(directory, "dottore-autofix")])
    mkdirSync(path, { recursive: true });
  writeFileSync(join(head, "README.md"), "fixture\n");
  writeFileSync(join(head, ".claude/settings.json"), JSON.stringify({ hooks: {} }));
  writeFileSync(join(head, ".mcp.json"), JSON.stringify({ mcpServers: {} }));
  writeFileSync(join(directory, "dottore-autofix/prompt.md"), "fixture prompt");
  git(["init", "-q"], head);
  git(["add", "-A"], head);
  git(["commit", "-q", "-m", "fixture head"], head);
  const record = join(directory, "claude-record.json");
  writeFileSync(
    join(bin, "claude"),
    `#!/usr/bin/env node
const fs = require("node:fs");
fs.writeFileSync(${JSON.stringify(record)}, JSON.stringify({
  args: process.argv.slice(2),
  visible: [".claude", ".mcp.json"].filter((path) => fs.existsSync(path)),
}));
fs.appendFileSync("README.md", "repaired\\n");
process.stdout.write(JSON.stringify({ subtype: "success", num_turns: 1, duration_ms: 1, total_cost_usd: 0, result: "Repaired." }));
`,
    { mode: 0o755 },
  );
  const execution = spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", script], {
    cwd: head,
    encoding: "utf8",
    timeout: 10_000,
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      ANTHROPIC_API_KEY: "fixture-key",
      AUTOFIX_MODEL: "fixture-model",
      AUTOFIX_EFFORT: "",
    },
  });
  assert.equal(execution.status, 0, `${execution.error?.message ?? ""}\n${execution.stdout}${execution.stderr}`);

  const { args, visible } = JSON.parse(readFileSync(record, "utf8"));
  const value = (flag) => {
    const index = args.indexOf(flag);
    assert.notEqual(index, -1, `claude is started with ${flag}`);
    return args[index + 1];
  };
  assert.deepEqual(visible, [], "The head's agent configuration is gone before Claude Code starts");
  assert.equal(value("--setting-sources"), "user", "No project or local settings load");
  assert.ok(args.includes("--strict-mcp-config"), "No MCP servers from the checkout load");
  assert.equal(JSON.parse(value("--settings")).disableAllHooks, true, "No hooks run");
  assert.equal(value("--tools"), "Read,Edit,Write,Grep,Glob", "Only the file tools exist");

  const patch = readFileSync(join(directory, "dottore-fix/patch.diff"), "utf8");
  assert.match(patch, /^\+repaired$/mu, "The repair itself is in the patch");
  assert.doesNotMatch(
    patch,
    /\.claude|\.mcp\.json/u,
    "Removing the head's agent configuration is not part of the patch",
  );
  console.info("Dottore repair isolation regressions passed.");
} finally {
  rmSync(directory, { recursive: true, force: true });
}
