import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const logDir = mkdtempSync(join(tmpdir(), "marinara-diagnostic-foundation-"));
const previous = { ...process.env };
process.env.LOG_DIR = logDir;
process.env.LOG_LEVEL = "debug";
process.env.LOG_FILE_LEVEL = "info";
process.env.LOG_FILE_MAX_MB = "1";
process.env.LOG_FILE_KEEP = "2";
try {
  const captured: string[] = [];
  const originalWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string | Uint8Array) => {
    captured.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;
  const { logger } = await import("../../packages/server/src/lib/logger.js");
  const { createDiagnostic, formatDiagnosticError, getDiagnosticContext, withDiagnosticContext } =
    await import("../../packages/server/src/lib/diagnostics.js");
  const { reportDiagnosticError } = await import("../../packages/server/src/lib/diagnostic-operation.js");
  const cause = new Error('upstream failed {"apiKey":"secret"}', {
    cause: new Error("Authorization: Bearer bearer-secret"),
  });
  const reference = withDiagnosticContext(
    { requestId: "req-foundation", operation: "review", stage: "persist" },
    () => {
      assert.equal(getDiagnosticContext().requestId, "req-foundation");
      return createDiagnostic(cause);
    },
  );
  assert.equal(createDiagnostic(cause).errorId, reference.errorId);
  assert.equal(reportDiagnosticError(cause).errorId, reference.errorId);
  assert.equal(reference.stage, "persist");
  assert.match(formatDiagnosticError(cause, reference), /reference=/u);
  await Promise.all([
    withDiagnosticContext({ requestId: "parallel-a", stage: "a" }, async () =>
      logger.info({ tokens: 42 }, "parallel-a"),
    ),
    withDiagnosticContext({ requestId: "parallel-b", stage: "b" }, async () => logger.info("parallel-b")),
  ]);
  logger.debug("console debug only");
  logger.info("file info");
  logger.error({ err: cause }, "error object");
  logger.error(cause, "error first");
  logger.error(
    'quoted {"token":"quoted-secret","headers":{"authorization":"Bearer hdr"}} %s',
    "Bearer interpolated-secret",
  );
  const githubClassic = ["ghp_", "1234567890abcdefghijklmnop"].join("");
  const githubFineGrained = ["github_pat_", "1234567890abcdefghijklmnop"].join("");
  logger.error("provider tokens %s %s", githubClassic, githubFineGrained);
  await new Promise((resolve) => setImmediate(resolve));
  process.stderr.write = originalWrite;
  const files = readdirSync(logDir).filter((name) => name.endsWith(".log"));
  assert.equal(files.length, 1);
  const contents = readFileSync(join(logDir, files[0]), "utf8");
  assert.match(contents, /file info|parallel-a/u);
  assert.doesNotMatch(contents, /secret|bearer-secret|quoted-secret|interpolated-secret|hdr|ghp_|github_pat_/u);
  assert.match(contents, /"tokens":42/u);
  assert.match(captured.join(""), /console debug only/u);
  assert.doesNotMatch(contents, /console debug only/u);
  const tsx = fileURLToPath(new URL("../../packages/server/node_modules/tsx/dist/cli.mjs", import.meta.url));
  const childData = mkdtempSync(join(tmpdir(), "marinara-diagnostic-child-"));
  try {
    execFileSync(
      process.execPath,
      [
        tsx,
        "-e",
        'import { logger } from "./packages/server/src/lib/logger.ts"; logger.error(new Error("child durable")); process.exit(0);',
      ],
      {
        cwd: fileURLToPath(new URL("../..", import.meta.url)),
        env: { ...process.env, DATA_DIR: childData, LOG_DIR: "", LOG_LEVEL: "error", LOG_FILE_LEVEL: "info" },
        stdio: "ignore",
        windowsHide: true,
      },
    );
    const childLogs = readdirSync(join(childData, "logs")).filter((name) => name.endsWith(".log"));
    assert.ok(childLogs.length > 0);
    assert.match(readFileSync(join(childData, "logs", childLogs[0]), "utf8"), /child durable/u);
  } finally {
    rmSync(childData, { recursive: true, force: true });
  }
  process.stdout.write("Diagnostic foundation regression passed.\n");
} finally {
  for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
  Object.assign(process.env, previous);
  rmSync(logDir, { recursive: true, force: true });
}
