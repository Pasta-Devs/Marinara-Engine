import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

process.env.LOG_LEVEL = "silent";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = mkdtempSync(join(tmpdir(), "marinara-server-hunt-b7-"));
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
const previousMarinaraFileStorageDir = process.env.MARINARA_FILE_STORAGE_DIR;
let app: {
  close(): Promise<void>;
  ready(): Promise<unknown>;
  inject(options: Record<string, unknown>): Promise<any>;
} | null = null;

try {
  const fileStorageDir = join(dataDir, "file-storage");
  process.env.DATA_DIR = dataDir;
  process.env.FILE_STORAGE_DIR = fileStorageDir;
  process.env.MARINARA_FILE_STORAGE_DIR = fileStorageDir;
  process.env.NODE_ENV = "test";
  process.env.MARINARA_LITE = "true";

  const [{ buildApp }, backup] = await Promise.all([
    import("../../packages/server/src/app.js"),
    import("../../packages/server/src/routes/backup.routes.js"),
  ]);

  // 1. Compatible profile export must not drop personas whose sanitized names collide.
  app = await buildApp();
  await app.ready();
  const personaNames = ["Alice", "Alice", "alice", "A/B", "A:B"];
  for (const name of personaNames) {
    const created = await app.inject({ method: "POST", url: "/api/characters/personas", payload: { name } });
    assert.equal(created.statusCode, 200, created.body);
  }
  const exported = await app.inject({ method: "GET", url: "/api/backup/export-profile?format=compatible" });
  assert.equal(exported.statusCode, 200, exported.body);
  const zip = new AdmZip(exported.rawPayload as Buffer);
  const personaEntries = zip
    .getEntries()
    .map((entry) => entry.entryName)
    .filter((name) => name.startsWith("personas/"));
  assert.equal(personaEntries.length, personaNames.length, `every persona must be exported: ${personaEntries}`);
  assert.equal(
    new Set(personaEntries.map((name) => name.toLowerCase())).size,
    personaEntries.length,
    "entry names must stay unique case-insensitively",
  );
  assert.ok(
    personaEntries.some((name) => / \(\d+\)\.json$/u.test(name)),
    `repeated names get a numbered suffix: ${personaEntries}`,
  );
  const exportedNames = personaEntries.map((name) => JSON.parse(zip.readAsText(name)).name).sort();
  assert.deepEqual(exportedNames, [...personaNames].sort());

  // 2. Unlimited (full backup) archives may exceed the 8 MiB central-directory cap and stay readable.
  const emptyFile = join(dataDir, "empty.bin");
  writeFileSync(emptyFile, "");
  // Long entry names reach the 8 MiB central-directory cap with few entries, keeping the test fast.
  const longSegment = "x".repeat(60_000);
  const entryCount = 160; // 160 * (46 + ~60k) bytes > 8 MiB of central directory
  const sources = Array.from({ length: entryCount }, (_, index) => ({
    entryName: `marinara-backup/gallery/${longSegment}-${index}.bin`,
    filePath: emptyFile,
    size: 0,
  }));
  const fullArchive = join(dataDir, "full.zip");
  await backup.writeStoredBackupArchiveForRegression(fullArchive, sources, { unlimitedArchiveSize: true });
  const inspected = await backup.inspectStoredBackupArchiveForRegression(fullArchive);
  assert.equal(inspected.entries.length, entryCount, "a large full backup must be written and read back");

  // Capped profile archives keep the 8 MiB central-directory limit.
  await assert.rejects(
    backup.writeStoredBackupArchiveForRegression(join(dataDir, "capped.zip"), sources),
    /central directory/i,
  );

  // 3. Package uninstall recomputes the agent cleanup patch inside the per-chat metadata queue.
  const capabilitySource = readFileSync(
    join(repositoryRoot, "packages/server/src/routes/capability-packages.routes.ts"),
    "utf8",
  );
  assert.match(
    capabilitySource,
    /chats\.patchMetadata\(\s*chat\.id,\s*\(current\)\s*=>\s*buildCapabilityAgentCleanupPatch\(current,\s*removed\.agentIds\)/u,
    "uninstall cleanup must derive its patch from the fresh metadata, not the list() snapshot",
  );
  const { buildCapabilityAgentCleanupPatch } = await import(
    "../../packages/server/src/routes/capability-packages.routes.js"
  );
  assert.equal(buildCapabilityAgentCleanupPatch({ activeAgentIds: ["keep"] }, ["gone"]), null);

  console.log("Server hunt batch 7 regression passed.");
} finally {
  await app?.close();
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  if (previousMarinaraFileStorageDir === undefined) delete process.env.MARINARA_FILE_STORAGE_DIR;
  else process.env.MARINARA_FILE_STORAGE_DIR = previousMarinaraFileStorageDir;
  rmSync(dataDir, { recursive: true, force: true });
}
