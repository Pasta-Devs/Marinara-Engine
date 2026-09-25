import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileNativeDB } from "../../../packages/server/src/db/file-backed-store.js";
import { eq } from "../../../packages/server/src/db/file-query.js";
import {
  agentConfigs,
  agentMemory,
  gameStateSnapshots,
  chats,
  messages,
} from "../../../packages/server/src/db/schema/index.js";
import { MariDbService } from "../../../packages/server/src/services/mari-db/mari-db.service.js";

const previousDirectory = process.env.FILE_STORAGE_DIR;
const directory = mkdtempSync(join(tmpdir(), "marinara-validation-scope-"));
process.env.FILE_STORAGE_DIR = directory;
let db = await createFileNativeDB();
try {
  const stamp = new Date().toISOString();
  for (const id of ["active", "archived"]) {
    await db.insert(chats).values({ id, name: id, mode: "conversation", createdAt: stamp, updatedAt: stamp });
    await db.insert(messages).values({ id: `${id}-message`, chatId: id, role: "user", content: id, createdAt: stamp });
  }
  await db.insert(agentConfigs).values({
    id: "agent",
    type: "custom",
    name: "Fixture",
    phase: "post_processing",
    createdAt: stamp,
    updatedAt: stamp,
  });
  await db.insert(agentMemory).values({
    id: "memory",
    agentConfigId: "agent",
    chatId: "active",
    key: "note",
    value: "plain text memory",
    updatedAt: stamp,
  });
  await db
    .insert(gameStateSnapshots)
    .values({ id: "old-snapshot", chatId: "archived", messageId: "missing-message", createdAt: stamp });
  await db._fileStore.close();
  db = await createFileNativeDB();
  const mari = new MariDbService(db);
  const assertScoped = () => {
    assert.equal(
      db._fileStore.getResidentChatUnits().has("archived"),
      false,
      "an unrelated chat stays unloaded during edits and undo",
    );
    assert.equal(
      db._fileStore.getFullyResidentLazyTables().size,
      0,
      "small edits must not permanently load whole lazy tables",
    );
  };
  const created = await mari.executeAction({
    action: "character.create",
    characterId: "new-character",
    data: { name: "New character" },
    apply: true,
  });
  assert.equal(created.ok, true, JSON.stringify(created));
  assertScoped();
  await mari.restoreAppliedReview(created.approval!.id);
  assertScoped();

  const patch = (data: Record<string, unknown>) =>
    mari.executeCli({ argv: ["db", "patch", "messages", "active-message", "--apply", "--json", JSON.stringify(data)] });
  const invalidJson = await patch({ extra: "invalid JSON" });
  assert.equal(invalidJson.ok, false, "actual JSON columns remain validated");
  const dangling = await patch({ chatId: "missing-chat" });
  assert.equal(dangling.ok, false, "edits cannot introduce dangling references");
  assertScoped();
  const changed = await patch({ content: "edited" });
  assert.equal(changed.ok, true, JSON.stringify(changed));
  assertScoped();
  assert.equal((await db.select().from(messages).where(eq(messages.id, "active-message")))[0]?.content, "edited");
  await mari.restoreAppliedReview(changed.approval!.id);
  assertScoped();
  assert.equal((await db.select().from(messages).where(eq(messages.id, "active-message")))[0]?.content, "active");

  // Package/import paths historically accepted arbitrary settings. Unrelated edits and undo
  // must preserve that data, while changed activation fields still need to be valid.
  const legacySettings = {
    activationQuestion: "",
    activationKeywords: [42],
    activationThreshold: 1.2,
    activationScanDepth: 0,
    activationMaxSkip: 101,
    runInterval: 0,
    packageOption: { keep: true },
  };
  await db
    .update(agentConfigs)
    .set({ settings: JSON.stringify(legacySettings) })
    .where(eq(agentConfigs.id, "agent"));
  const readAgent = async () => (await db.select().from(agentConfigs).where(eq(agentConfigs.id, "agent")))[0]!;
  for (const edit of [
    () => mari.executeAction({ action: "agent.update", id: "agent", data: { name: "Renamed" }, apply: true }),
    () =>
      mari.executeCli({
        argv: [
          "db",
          "patch",
          "agent_configs",
          "agent",
          "--apply",
          "--json",
          JSON.stringify({ promptTemplate: "Edited" }),
        ],
      }),
    () =>
      mari.executeAction({ action: "agent.update", id: "agent", data: { settings: { unrelated: true } }, apply: true }),
  ]) {
    const edited = await edit();
    assert.equal(edited.ok, true, `legacy settings must not block unrelated edits: ${JSON.stringify(edited)}`);
    assert.equal(JSON.parse((await readAgent()).settings).activationThreshold, 1.2);
    await mari.restoreAppliedReview(edited.approval!.id);
    assert.deepEqual(JSON.parse((await readAgent()).settings), legacySettings, "undo preserves legacy settings");
    assertScoped();
  }
  for (const [key, value] of Object.entries({
    activationQuestion: " ",
    activationKeywords: [false],
    activationThreshold: 1.3,
    activationScanDepth: -1,
    activationMaxSkip: 102,
    runInterval: -1,
  })) {
    const invalid = await mari.executeCli({
      argv: [
        "db",
        "patch",
        "agent_configs",
        "agent",
        "--apply",
        "--json",
        JSON.stringify({ settings: { [key]: value } }),
      ],
    });
    assert.equal(invalid.ok, false, `a newly invalid ${key} must be rejected`);
    assert.deepEqual(JSON.parse((await readAgent()).settings), legacySettings, "invalid edits must not persist");
  }
  const repaired = await mari.executeAction({
    action: "agent.update",
    id: "agent",
    data: { settings: { activationThreshold: 0.7, activationQuestion: null } },
    apply: true,
  });
  assert.equal(repaired.ok, true, "one setting can be repaired without migrating every legacy setting");
  assert.deepEqual(JSON.parse((await readAgent()).settings), {
    ...Object.fromEntries(Object.entries(legacySettings).filter(([key]) => key !== "activationQuestion")),
    activationThreshold: 0.7,
  });
  await mari.restoreAppliedReview(repaired.approval!.id);
  assert.deepEqual(JSON.parse((await readAgent()).settings), legacySettings, "undo can restore original legacy values");
  assertScoped();
  const agentValidation = await mari.validate("agent_configs");
  for (const key of Object.keys(legacySettings).filter((key) => key !== "packageOption")) {
    assert.ok(
      agentValidation.errors.some((issue) => issue.id === "agent" && issue.message.includes(`settings.${key}`)),
      `explicit validation still reports legacy ${key}`,
    );
  }
  const memoryValidation = await mari.validate("agent_memory");
  assert.equal(
    memoryValidation.errors.some((issue) => issue.message.includes("not valid JSON")),
    false,
    "plain text is supported by the agent memory storage contract",
  );

  const fullValidation = await mari.validate();
  assert.ok(
    fullValidation.errors.some(
      (issue) =>
        issue.table === "game_state_snapshots" &&
        issue.id === "old-snapshot" &&
        issue.message.includes("missing-message"),
    ),
    "explicit full validation still reports existing orphaned data",
  );
  assert.equal(
    (await db.select().from(gameStateSnapshots).where(eq(gameStateSnapshots.id, "old-snapshot"))).length,
    1,
    "validation must not delete old data",
  );
} finally {
  await db._fileStore.close();
  if (previousDirectory === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousDirectory;
  rmSync(directory, { recursive: true, force: true });
}
console.log("Mari validation scope regressions passed.");
