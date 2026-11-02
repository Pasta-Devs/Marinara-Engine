// Debug mode "shows everything sent to and received from the AI in the server console". A multi-line prompt or
// reply must print there with real line breaks, not as one line of "\n":
// - the launchers run the server with NODE_ENV=production, which used to mean JSON lines even in a terminal;
// - provider request dumps (%j) and prompt dumps (JSON.stringify) escaped every line break inside the prompt.
// Production output that goes to a pipe, a file or Docker logs stays one JSON object per line for log tools.
// Each case runs a real generation with debug mode on, in its own process: the logger picks its output once.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const root = fileURLToPath(new URL("../..", import.meta.url));
const serverRequire = createRequire(join(root, "packages/server/package.json"));
const tsx = ["--import", pathToFileURL(serverRequire.resolve("tsx/esm")).href];
const source = (path: string) => JSON.stringify(pathToFileURL(join(root, "packages/server/src", path)).href);

const prompt = "You are Mari.\nRule one.\nRule two.";
// A literal backslash-n typed in a prompt is text, and must not turn into a line break.
const code = 'printf("hi\\n");';
const dir = mkdtempSync(join(tmpdir(), "debug-log-line-breaks-"));
const child = join(dir, "child.mts");
writeFileSync(
  child,
  `import { createServer } from "node:http";
import { logDebugOverride } from ${source("lib/logger.ts")};
import { AnthropicProvider } from ${source("services/llm/providers/anthropic.provider.ts")};
import { OpenAIProvider } from ${source("services/llm/providers/openai.provider.ts")};
const server = createServer(async (request, response) => {
  for await (const _chunk of request);
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(request.url.startsWith("/anthropic/")
    ? { content: [{ type: "text", text: "Hi." }], stop_reason: "end_turn", usage: {} }
    : { choices: [{ message: { content: "Hi." }, finish_reason: "stop" }] }));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = "http://127.0.0.1:" + server.address().port;
const messages = [{ role: "system", content: ${JSON.stringify(prompt)} }, { role: "user", content: ${JSON.stringify(code)} }];
await new AnthropicProvider(base + "/anthropic", "FIXTURE_SECRET_KEY")
  .chatComplete(messages, { model: "claude-sonnet-4-5", stream: false, debugMode: true });
await new OpenAIProvider(base + "/v1", "FIXTURE_SECRET_KEY", undefined, null, null, "custom")
  .chatComplete(messages, { model: "house-model", stream: false, debugMode: true });
logDebugOverride(true, "[debug] LLM response:\\n%s", ${JSON.stringify(prompt)});
server.close();
`,
);

function childEnv(nodeEnv: string, logFormat?: string) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: nodeEnv,
    LOG_LEVEL: "warn",
    LOG_PRESET: "default",
    DATA_DIR: dir,
    MARINARA_ENV_FILE: join(dir, ".env"),
  };
  delete env.LOG_FORMAT;
  delete env.DEBUG_AGENTS;
  if (logFormat) env.LOG_FORMAT = logFormat;
  return env;
}

async function run(env: NodeJS.ProcessEnv, command = process.execPath, args = [...tsx, child]) {
  const { stdout } = await promisify(execFile)(command, args, { cwd: root, env, timeout: 25_000, windowsHide: true });
  return stdout.replace(/\r\n/gu, "\n");
}
// A launcher's terminal (start.sh, start.bat, the Windows launcher window) runs production; a person reads it.
const inTerminal = (env: NodeJS.ProcessEnv) =>
  run(env, "python3", [
    "-c",
    [
      "import os, pty, sys",
      "pid, fd = pty.fork()",
      "if pid == 0:",
      "    os.execv(sys.argv[1], sys.argv[1:])",
      "out = b''",
      "while True:",
      "    try:",
      "        chunk = os.read(fd, 65536)",
      "    except OSError:",
      "        break",
      "    if not chunk:",
      "        break",
      "    out += chunk",
      "_, status = os.waitpid(pid, 0)",
      "sys.stdout.buffer.write(out)",
      "sys.exit(os.waitstatus_to_exitcode(status))",
    ].join("\n"),
    process.execPath,
    ...tsx,
    child,
  ]);

const stripColors = (text: string) => text.replace(/\x1b\[[0-9;]*m/gu, "");

function assertReadable(output: string, label: string) {
  const text = stripColors(output);
  assert.ok(text.includes("[debug/anthropic] final request:"), `${label}: Claude's request is logged\n${text}`);
  assert.ok(text.includes("[debug/openai] chat request messages:"), `${label}: OpenAI's request is logged\n${text}`);
  // The reply, and the prompt inside both provider requests, keep their line breaks.
  assert.equal(text.split("\n").filter((line) => line === "Rule one.").length, 3, `${label}: line breaks\n${text}`);
  assert.equal(text.split('printf(\\"hi\\\\n\\");').length - 1, 2, `${label}: a typed backslash-n stays text\n${text}`);
  assert.ok(!text.includes("FIXTURE_SECRET_KEY"), `${label}: the key never reaches the debug lines`);
}

try {
  const [machine, termux, development, forcedJson, terminal] = await Promise.all([
    run(childEnv("production")),
    run(childEnv("production", "pretty")),
    run(childEnv("development")),
    run(childEnv("development", "json")),
    process.platform === "win32" ? null : inTerminal(childEnv("production")),
  ]);

  // Production output into a pipe (Docker logs, a log file, a supervisor): one JSON object per line, as before,
  // and a log tool that reads msg gets the prompt with its line breaks.
  for (const [output, label] of [
    [machine, "production pipe"],
    [forcedJson, "LOG_FORMAT=json"],
  ] as const) {
    const records = output
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { msg: string; bootId?: string });
    const requests = records.filter((record) => /^\[debug\/(anthropic|openai)\]/u.test(record.msg));
    assert.equal(requests.length, 2, `${label}\n${output}`);
    for (const record of requests) assert.ok(record.msg.includes(prompt), `${label}: ${record.msg}`);
    assert.ok(
      records.some((record) => record.msg === `[debug] LLM response:\n${prompt}`),
      label,
    );
    assert.ok(
      records.every((record) => record.bootId),
      `${label}: JSON lines keep bootId`,
    );
    assert.ok(!output.includes("FIXTURE_SECRET_KEY"), `${label}: the key never reaches the debug lines`);
  }

  // LOG_FORMAT=pretty asks for readable lines anywhere (the Termux launcher, Docker); colours stay out of the file.
  assertReadable(termux, "LOG_FORMAT=pretty");
  assert.ok(!termux.includes("\x1b["), "a pipe or log file gets no colour codes");

  // `pnpm dev` stays readable and coloured, and now its prompt dumps keep their line breaks too.
  assertReadable(development, "development");
  assert.ok(development.includes("\x1b["), "the dev console keeps its colours");

  // The launcher terminal case; Windows has no PTY here, and its console takes the same isatty branch.
  if (terminal !== null) {
    assertReadable(terminal, "production terminal");
    assert.ok(terminal.includes("\x1b["), "a terminal gets colours");
    assert.ok(!terminal.includes('"level":'), "a terminal gets no JSON lines");
  }

  // The Termux launcher reaches the terminal through tee, so it asks for readable lines unless .env says otherwise.
  const termuxLauncher = readFileSync(join(root, "start-termux.sh"), "utf8");
  assert.match(termuxLauncher, /for setting_name in [^\n]* LOG_FORMAT; do/u, "the launcher honours LOG_FORMAT in .env");
  const exported = termuxLauncher.indexOf("export LOG_FORMAT=${LOG_FORMAT:-pretty}");
  assert.ok(exported > 0 && exported < termuxLauncher.indexOf("scripts/run-server.mjs"), "set before the server");
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log("debug log line breaks regression passed");
