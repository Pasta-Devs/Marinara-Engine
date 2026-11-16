// Server log redaction: credential fields are censored and key-shaped text is scrubbed from messages, from a bare
// logged Error's message, from %s substitutions and from error messages and stacks, while ordinary lines pass through unchanged.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { scrubSecretText } = await import("../../../packages/server/src/lib/log-redaction.js");

assert.equal(
  scrubSecretText("Incorrect API key provided: sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345"),
  "Incorrect API key provided: sk-[redacted]",
);
assert.equal(scrubSecretText("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def"), "Authorization: Bearer [redacted]");
assert.equal(
  scrubSecretText("GET https://x.example/v1?key=AIzaSyA1234567890abcdefghijklmnopqrstu"),
  "GET https://x.example/v1?key=[redacted]",
);
assert.equal(
  scrubSecretText("https://discord.com/api/webhooks/123/abcdefghijklmnopqrstuvwxyz123"),
  "https://discord.com/api/webhooks/123/[redacted]",
);
assert.equal(
  scrubSecretText("[themes] Updated starter theme dewglass to 1.4"),
  "[themes] Updated starter theme dewglass to 1.4",
);

// The real logger, in a child process with JSON output, so pino's own msg derivation and redact paths run.
const repoRoot = resolve(import.meta.dirname, "../../..");
const dir = mkdtempSync(join(tmpdir(), "marinara-log-redaction-"));
const script = join(dir, "log.mts");
writeFileSync(
  script,
  `const { logger } = await import(${JSON.stringify(pathToFileURL(join(repoRoot, "packages/server/src/lib/logger.ts")).href)});
logger.error(new Error("request failed sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345"));
logger.error({ err: new Error("bad key AIzaSyA1234567890abcdefghijklmnopqrstu") }, "context");
logger.warn({ "x-api-key": "root-secret-value", headers: { authorization: "Bearer abcdefghijklmnop" }, req: { headers: { "x-api-key": "nested-secret-value" } } }, "headers");
logger.warn({ "x-goog-api-key": "root-goog-value", req: { headers: { "x-goog-api-key": "nested-goog-value", "xi-api-key": "nested-xi-value" } } }, "provider headers");
logger.warn("request:\\n%s", { toString: () => '{"key":"sk-SUBSTITUTEDABCDEFGHIJKLMNOP0123"}' });
logger.warn("eleven %s", "sk_0123456789abcdef0123456789abcdef");
logger.warn("ordinary line %s", "value");
`,
);
const require = createRequire(join(repoRoot, "packages/server/package.json"));
const result = spawnSync(process.execPath, [require.resolve("tsx/cli"), script], {
  env: { ...process.env, LOG_FORMAT: "json", LOG_LEVEL: "info", NODE_ENV: "production", DATA_DIR: dir },
  encoding: "utf8",
});
assert.equal(result.status, 0, result.stderr);
const lines = result.stdout
  .split("\n")
  .filter((line) => line.startsWith("{"))
  .map((line) => JSON.parse(line) as Record<string, any>);
const output = result.stdout;
for (const secret of [
  "sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345",
  "AIzaSyA1234567890",
  "root-secret-value",
  "nested-secret-value",
  "abcdefghijklmnop",
  "root-goog-value",
  "nested-goog-value",
  "nested-xi-value",
  "sk-SUBSTITUTED",
  "sk_0123456789abcdef",
]) {
  assert.ok(!output.includes(secret), `log leaked ${secret}`);
}
const bare = lines.find((line) => typeof line.msg === "string" && line.msg.startsWith("request failed"));
assert.equal(bare?.msg, "request failed sk-[redacted]");
const context = lines.find((line) => line.msg === "context");
assert.match(String(context?.err?.message), /AIza\[redacted\]/u);
const headers = lines.find((line) => line.msg === "headers");
assert.equal(headers?.["x-api-key"], "[redacted]");
assert.equal(headers?.headers?.authorization, "[redacted]");
assert.equal(headers?.req?.headers?.["x-api-key"], "[redacted]");
const provider = lines.find((line) => line.msg === "provider headers");
assert.equal(provider?.["x-goog-api-key"], "[redacted]");
assert.equal(provider?.req?.headers?.["x-goog-api-key"], "[redacted]");
assert.equal(provider?.req?.headers?.["xi-api-key"], "[redacted]");
assert.ok(lines.some((line) => line.msg === 'request:\n{"key":"sk-[redacted]"}'));
assert.ok(lines.some((line) => line.msg === "eleven sk_[redacted]"));
assert.ok(lines.some((line) => line.msg === "ordinary line value"));

console.log("Log redaction regression passed.");
