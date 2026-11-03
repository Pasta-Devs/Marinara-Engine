// Simple `mari ...` commands run in the server process, outside the shell sandbox, and --json-file, --file and
// --css-file read the file they name. Those paths follow the read tool's rule: inside the workspace, and never .env,
// the encryption key or Git internals. Ordinary workspace payload files keep working.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = realpathSync(mkdtempSync(join(tmpdir(), "marinara-mari-file-flags-")));
const workspace = join(root, "workspace");
const dataDir = join(root, "data");
const KEY = "cd".repeat(32);
const ENV_SECRET = "env-secret-mari-must-not-see";
const OUTSIDE_SECRET = "outside-secret-mari-must-not-see";
const originalEnv = { DATA_DIR: process.env.DATA_DIR, FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR };
mkdirSync(join(workspace, "packages", "server", "data"), { recursive: true });
mkdirSync(join(workspace, "payloads"), { recursive: true });
mkdirSync(join(dataDir, "storage"), { recursive: true });
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { createFileNativeDB } = await import("../../../packages/server/src/db/file-backed-store.js");
const { ProfessorMariWorkspaceService } =
  await import("../../../packages/server/src/services/professor-mari/workspace-agent.service.js");

const db = await createFileNativeDB();
try {
  writeFileSync(join(workspace, "packages", "server", "data", ".encryption-key"), `${KEY}\n`);
  writeFileSync(join(workspace, ".env"), `SECRET=${ENV_SECRET}\n`);
  const outsideCss = join(root, "outside.css");
  const outsideJson = join(root, "outside.json");
  writeFileSync(outsideCss, `body { --leak: "${OUTSIDE_SECRET}"; }\n`);
  writeFileSync(outsideJson, JSON.stringify({ name: OUTSIDE_SECRET }));
  writeFileSync(join(workspace, "payloads", "theme.css"), "body { color: rebeccapurple; }\n");

  const service = new ProfessorMariWorkspaceService({ db } as never);
  service.setEnabled(true, workspace);
  const runner = service as unknown as {
    executeWorkspaceCommand(
      command: { id: string; name: string; arguments: Record<string, unknown> },
      signal: AbortSignal,
      trace: unknown[],
      onEvent: () => void,
      roundCalls: unknown[],
    ): Promise<{ output: string; success: boolean }>;
  };
  let commandId = 0;
  const bash = (command: string) =>
    runner.executeWorkspaceCommand(
      { id: `file-flags-${commandId++}`, name: "bash", arguments: { command } },
      new AbortController().signal,
      [],
      () => undefined,
      [],
    );

  const refused: Array<[string, RegExp, string]> = [
    ["mari themes create --name t --css-file packages/server/data/.encryption-key", /cannot access secret files/u, KEY],
    ["mari themes create --name t --css-file=packages/server/data/.encryption-key", /cannot access secret files/u, KEY],
    ["mari db insert characters --file .env", /cannot access secret files/u, ENV_SECRET],
    [`mari themes create --name t --css-file=${outsideCss}`, /escapes the workspace/u, OUTSIDE_SECRET],
    [`mari presets create --json-file ${outsideJson}`, /escapes the workspace/u, OUTSIDE_SECRET],
  ];
  for (const [command, refusal, secret] of refused) {
    const result = await bash(command);
    assert.equal(result.success, false, `${command}\n${result.output}`);
    assert.match(result.output, refusal, command);
    assert.ok(!result.output.includes(secret), `${command} never shows the file:\n${result.output}`);
  }

  const allowed = await bash("mari themes create --name Purple --css-file payloads/theme.css");
  assert.equal(allowed.success, true, allowed.output);
  assert.match(allowed.output, /rebeccapurple/u, "a payload file inside the workspace is still read");
  console.log("Professor Mari direct mari file-flag regression passed.");
} finally {
  await db._fileStore.close();
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(root, { recursive: true, force: true });
}
