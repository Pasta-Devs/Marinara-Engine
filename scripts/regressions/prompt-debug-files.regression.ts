import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// LOG_PROMPT_DEBUG_FILES (opt-in): prompt debug output goes to rotating files under DATA_DIR/logs/prompt-debug/
// instead of the console. Off, logDebugOverride behaves as before and writes no file.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-prompt-debug-"));
process.env.DATA_DIR = dataDir;
process.env.LOG_LEVEL = "warn";
delete process.env.LOG_PROMPT_DEBUG_FILES;

try {
  const { getPromptDebugLogDirectory, logDebugOverride, logger } =
    await import("../../packages/server/src/lib/logger.js");
  const { runWithRootLogContext } = await import("../../packages/server/src/lib/log-context.js");
  const directory = getPromptDebugLogDirectory();
  assert.equal(directory, join(dataDir, "logs", "prompt-debug"));

  // Off (the default): nothing is written to disk, whether or not debug mode is on.
  logDebugOverride(true, "[debug] prompt %s", "invented prompt text one");
  logDebugOverride(false, "[debug] prompt %s", "invented prompt text two");
  assert.equal(existsSync(directory), false, "no prompt debug files without the setting");

  process.env.LOG_PROMPT_DEBUG_FILES = "true";
  // Debug mode off and LOG_LEVEL above debug: nothing to show, nothing written.
  logDebugOverride(false, "[debug] hidden %s", "invented hidden text");
  assert.equal(existsSync(directory), false);

  // Debug mode on: the line goes to the prompt debug file, with the request context.
  runWithRootLogContext({ requestId: "req-regression" }, () => {
    logDebugOverride(true, "[debug] prompt for %s: %s", "Invented Character", "invented prompt text three");
  });
  // LOG_LEVEL=debug writes at debug level even without the chat's debug mode.
  logger.level = "debug";
  logDebugOverride(false, "[debug] reply %d chars", 42);
  logger.level = "warn";

  const files = readdirSync(directory);
  assert.equal(files.length, 1, files.join(", "));
  assert.match(files[0]!, /^prompt-debug-\d+-[a-z0-9]+\.log$/);
  const lines = readFileSync(join(directory, files[0]!), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  assert.equal(lines.length, 2);
  assert.equal(lines[0]!.msg, "[debug] prompt for Invented Character: invented prompt text three");
  assert.equal(lines[0]!.level, 40, "debug mode at LOG_LEVEL=warn keeps the warn level it had on the console");
  assert.equal(lines[0]!.requestId, "req-regression");
  assert.equal(lines[0]!.debugPrompt, true);
  assert.equal(lines[1]!.msg, "[debug] reply 42 chars");
  assert.equal(lines[1]!.level, 20);
  const text = readFileSync(join(directory, files[0]!), "utf8");
  assert.ok(!text.includes("invented prompt text one"), "lines logged while the setting was off never reach the file");
  assert.ok(!text.includes("invented hidden text"));
} finally {
  delete process.env.LOG_PROMPT_DEBUG_FILES;
  rmSync(dataDir, { recursive: true, force: true });
}
console.log("prompt-debug-files regression passed");
