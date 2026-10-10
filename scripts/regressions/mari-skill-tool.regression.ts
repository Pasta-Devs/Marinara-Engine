// The `skill` tool (PR 2) must pass the workspace-command validation gate and
// dispatch to commandSkill. A missing `skill` case in workspaceCommandValidationIssue
// made every skill call fail with "Unsupported workspace command: skill" before
// reaching the dispatcher. Models also misroute skill fetches through app_data
// (action "skill") and guess skill ids; both dead ends must self-correct.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ProfessorMariWorkspaceService } from "../../packages/server/src/services/professor-mari/workspace-agent.service.js";

const service = new ProfessorMariWorkspaceService({} as never);
const run = (args: Record<string, unknown>) =>
  (service as unknown as {
    executeWorkspaceCommand(
      command: { id: string; name: string; arguments: Record<string, unknown> },
      signal: AbortSignal,
      trace: unknown[],
      onEvent: () => void,
    ): Promise<{ output: string; success: boolean }>;
  }).executeWorkspaceCommand({ id: "cmd", name: "skill", arguments: args }, new AbortController().signal, [], () => undefined);

const builtIn = await run({ id: "read-docs" });
assert.equal(builtIn.success, true, `built-in skill fetch must dispatch, got: ${builtIn.output}`);
assert.match(builtIn.output, /^<skill id="read-docs" name="Read Docs" builtin="true">\n/);

const missingId = await run({});
assert.equal(missingId.success, false);
assert.match(missingId.output, /skill requires a non-empty id string/);

const unknown = await run({ id: "no-such-skill" });
assert.equal(unknown.success, true, "an unknown id still reaches commandSkill");
assert.match(unknown.output, /^Skill "no-such-skill" not found\./u);
assert.match(unknown.output, /<skill_library>/u, "a miss must point at the in-context index");

// ── app_data action routing: models sometimes call app_data {action: "skill"} ─
// The structured app-data runtime used to answer with the generic
// "Unsupported app_data action. Use character.* ..." dead end; it must instead
// point the model at the `skill` tool and the in-context <skill_library> index.
const skillStorageRoot = mkdtempSync(join(tmpdir(), "marinara-skill-route-"));
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = skillStorageRoot;
let closeDb: (() => Promise<void>) | null = null;
try {
  const { closeDB, getDB } = await import("../../packages/server/src/db/connection.js");
  closeDb = closeDB;
  const db = await getDB();
  const { MariDbService } = await import("../../packages/server/src/services/mari-db/mari-db.service.js");
  const mariDb = new MariDbService(db);
  const routed = await mariDb.executeAction({ action: "skill", id: "scenario-build" });
  assert.equal(routed.ok, false);
  assert.match(routed.error ?? "", /`skill` tool/, "the error must name the skill tool");
  assert.match(routed.error ?? "", /<skill_library>/, "the error must point at the in-context index");
  assert.doesNotMatch(routed.error ?? "", /Unsupported app_data action/u, "no generic dead end for skill");
  const dotted = await mariDb.executeAction({ action: "skill.get", id: "scenario-build" });
  assert.equal(dotted.ok, false);
  assert.match(dotted.error ?? "", /`skill` tool/);
} finally {
  await closeDb?.();
  process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}

// ── Tool description pin: the app_data description must say skills are not ────
// app_data, or models keep reaching for app_data for the skill library (source
// pin, same pattern as mari-permissions-mode's prompt-text pins).
const registrySource = readFileSync(
  join(resolve(dirname(fileURLToPath(import.meta.url)), "../.."), "packages/server/src/services/professor-mari/tool-registry.ts"),
  "utf8",
);
assert.match(registrySource, /Skills are not app_data actions/u, "app_data description must steer skill fetches to the skill tool");

console.log("mari-skill-tool regression passed");
