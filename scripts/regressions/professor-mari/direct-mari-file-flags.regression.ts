// Simple `mari ...` commands run in the server process, outside the shell sandbox, and --json-file, --file and
// --css-file read the file they name, as does a `mari images` source given as a file. Those paths follow the read
// tool's rule: inside the workspace, and never .env, the encryption key or Git internals. Ordinary workspace payload
// files, and image sources given as an asset id, app URL or data URL, keep working. An asset id or app URL names a file
// in an app folder, and is read only while its real path stays inside that folder (no link out of it).
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";

const root = realpathSync(mkdtempSync(join(tmpdir(), "marinara-mari-file-flags-")));
const workspace = join(root, "workspace");
const dataDir = join(root, "data");
const KEY = "cd".repeat(32);
const ENV_SECRET = "env-secret-mari-must-not-see";
const OUTSIDE_SECRET = "outside-secret-mari-must-not-see";
const shellPath = (path: string) => path.split(sep).join("/");
const originalEnv = { DATA_DIR: process.env.DATA_DIR, FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR };
mkdirSync(join(workspace, "packages", "server", "data"), { recursive: true });
mkdirSync(join(workspace, "payloads"), { recursive: true });
mkdirSync(join(dataDir, "storage"), { recursive: true });
// DATA_DIR is reached through a link, as on a host where it sits behind one: real app images must still load.
symlinkSync(dataDir, join(root, "data-link"), "dir");
process.env.DATA_DIR = join(root, "data-link");
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
    // Her shell treats `\` as an escape, so Windows paths are written with `/` (which Windows accepts too).
    [`mari themes create --name t --css-file=${shellPath(outsideCss)}`, /escapes the workspace/u, OUTSIDE_SECRET],
    [`mari presets create --json-file ${shellPath(outsideJson)}`, /escapes the workspace/u, OUTSIDE_SECRET],
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

  // `mari images` --source, --source-image and --from take an asset id, an app URL, a data URL or a file. Only the
  // file form reads a path Mari names, so only it follows the same rule.
  const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  );
  const previewDir = join(dataDir, "gallery", "mari-images");
  mkdirSync(join(dataDir, "backgrounds"), { recursive: true });
  mkdirSync(previewDir, { recursive: true });
  writeFileSync(join(root, "outside.png"), PNG);
  writeFileSync(join(workspace, "payloads", "pixel.png"), PNG);
  writeFileSync(join(dataDir, "backgrounds", "dusk.png"), PNG);
  writeFileSync(join(previewDir, "preview-1.png"), PNG);
  // Links planted in the app folders: a file linked out of its folder, and an app subfolder that is itself a link.
  mkdirSync(join(root, "outside-sprites"));
  mkdirSync(join(dataDir, "sprites"), { recursive: true });
  writeFileSync(join(root, "outside-sprites", "smile.png"), PNG);
  symlinkSync(join(root, "outside.png"), join(dataDir, "backgrounds", "linked.png"), "file");
  symlinkSync(
    join(workspace, "packages", "server", "data", ".encryption-key"),
    join(dataDir, "backgrounds", "key.png"),
  );
  symlinkSync(join(root, "outside-sprites"), join(dataDir, "sprites", "linked-owner"), "dir");
  symlinkSync(join(root, "outside.png"), join(previewDir, "preview-linked.png"), "file");
  const previewAsset = (id: string) => ({
    id,
    filename: `${id}.png`,
    filePath: `mari-images/${id}.png`,
    url: `/api/gallery/file/mari-images/${id}.png`,
  });
  writeFileSync(
    join(previewDir, "manifest.json"),
    JSON.stringify([previewAsset("preview-1"), previewAsset("preview-linked")]),
  );
  const assign = "mari images assign --target background";
  const refusedImages: Array<[string, RegExp]> = [
    [`${assign} --source ${shellPath(join(root, "outside.png"))}`, /escapes the workspace/u],
    [`${assign} --source-image=../outside.png`, /escapes the workspace/u],
    [`${assign} --from .env`, /cannot access secret files/u],
    [`${assign} --source packages/server/data/.encryption-key`, /cannot access secret files/u],
    [`${assign} --source /api/backgrounds/file/linked.png`, /escapes the allowed directory/u],
    [`${assign} --source /api/backgrounds/file/key.png`, /escapes the allowed directory/u],
    [`${assign} --source /api/sprites/linked-owner/file/smile.png`, /escapes the allowed directory/u],
    [`${assign} --asset preview-linked`, /escapes the allowed directory/u],
  ];
  for (const [command, refusal] of refusedImages) {
    const result = await bash(command);
    assert.equal(result.success, false, `${command}\n${result.output}`);
    assert.match(result.output, refusal, command);
  }
  const allowedImages: Array<[string, string]> = [
    [`${assign} --source payloads/pixel.png`, '"source": "payloads/pixel.png"'],
    [`${assign} --source /api/backgrounds/file/dusk.png`, '"source": "background:dusk.png"'],
    [`${assign} --source data:image/png;base64,${PNG.toString("base64")}`, '"source": "data-url"'],
    [`${assign} --asset preview-1`, '"source": "asset:preview-1"'],
  ];
  for (const [command, source] of allowedImages) {
    const result = await bash(command);
    assert.equal(result.success, true, `${command}\n${result.output}`);
    assert.ok(result.output.includes(source), `${command} reads its image:\n${result.output}`);
  }
  console.log("Professor Mari direct mari file-flag regression passed.");
} finally {
  await db._fileStore.close();
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(root, { recursive: true, force: true });
}
