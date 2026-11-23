import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

// What Marinara asks of the Grok CLI and what it reads back: real token use from the headless JSON result, no tools,
// and none of the coding-agent setup in the home folder. A fake `grok` answers; no real CLI or model runs.
const directory = await mkdtemp(join(tmpdir(), "marinara-grok-usage-"));
process.env.DATA_DIR = directory;
process.env.MARINARA_ENV_FILE = join(directory, ".env");
process.env.LOG_LEVEL = "silent";
const { GrokSubscriptionProvider, parseGrokCliJsonResult } =
  await import("../../../packages/server/src/services/llm/providers/grok-subscription.provider.js");
const childProcess = createRequire(import.meta.url)("node:child_process") as typeof import("node:child_process");

// The JSON a real `grok -p --output-format json` printed for a 12.2k-token prompt whose start was cached.
const measured = {
  text: "Rule 9 names district 9.",
  stopReason: "end_turn",
  sessionId: "01a1faa5-337a-7d41-8bb0-cd91f137e741",
  usage: {
    input_tokens: 76,
    cache_read_input_tokens: 12160,
    cache_creation_input_tokens: 0,
    output_tokens: 125,
    reasoning_tokens: 117,
    total_tokens: 12361,
  },
};

const calls: Array<{ args: string[]; env: NodeJS.ProcessEnv }> = [];
let stdout = "";
childProcess.spawn = ((command: string, args: string[], options: { env: NodeJS.ProcessEnv }) => {
  assert.equal(command, "grok", "the regression must never launch a real provider");
  calls.push({ args, env: options.env });
  const child = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    kill: () => true,
  });
  setImmediate(() => {
    child.stdout.emit("data", Buffer.from(stdout));
    child.emit("close", 0, null);
  });
  return child;
}) as unknown as typeof childProcess.spawn;
syncBuiltinESMExports();
const provider = new GrokSubscriptionProvider("", "");
const generate = () =>
  provider.chatComplete([{ role: "user", content: "Which district does rule 9 name?" }], {
    model: "grok-4.7",
    stream: true,
  });

try {
  // The JSON result's buckets: the prompt count includes cache reads and writes, as on OpenAI-compatible routes.
  assert.deepEqual(parseGrokCliJsonResult(JSON.stringify(measured)), {
    text: "Rule 9 names district 9.",
    usage: {
      promptTokens: 12236,
      completionTokens: 125,
      totalTokens: 12361,
      cachedPromptTokens: 12160,
      cacheWritePromptTokens: 0,
      completionReasoningTokens: 117,
      finishReason: "stop",
    },
  });
  assert.equal(parseGrokCliJsonResult("A plain reply."), null, "plain text is not a JSON result");
  assert.deepEqual(parseGrokCliJsonResult('{"text":"No usage","stopReason":"end_turn","sessionId":"s"}'), {
    text: "No usage",
  });
  assert.equal(
    parseGrokCliJsonResult('Here is the object: {"text":"Hello","language":"en"}'),
    null,
    "a plain reply holding a JSON object with a text field is not the CLI's envelope",
  );

  stdout = JSON.stringify(measured);
  const result = await generate();
  assert.equal(result.content, "Rule 9 names district 9.");
  assert.equal(result.usage?.cachedPromptTokens, 12160, "cache reads reach the usage");
  assert.equal(result.usage?.promptTokens, 12236);

  const { args, env } = calls.at(-1)!;
  const value = (flag: string) => args[args.indexOf(flag) + 1];
  assert.equal(value("--output-format"), "json");
  assert.ok(args.includes("--verbatim"), "the prompt is sent as written");
  // Allowing one tool and removing it leaves none; the always-on MCP tools go too.
  assert.equal(value("--tools"), "read_file");
  assert.deepEqual(value("--disallowed-tools").split(","), [
    "read_file",
    "run_terminal_command",
    "search_tool",
    "use_tool",
  ]);
  for (const vendor of ["CLAUDE", "CURSOR"]) {
    for (const surface of ["SKILLS", "RULES", "AGENTS", "MCPS", "HOOKS"]) {
      assert.equal(env[`GROK_${vendor}_${surface}_ENABLED`], "false", `${vendor} ${surface} stay out of the request`);
    }
  }

  // A CLI that prints plain text still answers, with estimated usage.
  stdout = "A plain reply.";
  const plain = await generate();
  assert.equal(plain.content, "A plain reply.");
  assert.equal(plain.usage?.cachedPromptTokens, undefined);
  assert.ok((plain.usage?.promptTokens ?? 0) > 0);
} finally {
  await rm(directory, { recursive: true, force: true });
}

console.log("Grok CLI requests carry no tools or home setup, and their usage reports the CLI's cache reads.");
