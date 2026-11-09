/**
 * Pinning a ruleset to a Roleplay chat: who gets a sheet, and a removed sheet staying removed.
 *
 * What is pinned here:
 *   - Pinning gives every member of the chat a sheet, the persona's first.
 *   - A member the player removed (`roleplaySheetsDeclined`) is left out when the ruleset is pinned
 *     again, as Add missing sheets and a newer version both do, and the other sheets are kept.
 *   - Taking the removal back and pinning again gives that member a sheet once more.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rulesetBuilderStarter, rulesetFromBuilderDraft } from "../../packages/shared/src/index.js";

const directory = mkdtempSync(join(tmpdir(), "marinara-roleplay-pin-"));
process.env.DATA_DIR = directory;

try {
  const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
  const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
  const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
  const { createGameRulesetsStorage } =
    await import("../../packages/server/src/services/storage/game-rulesets.storage.js");
  const { setCustomAgentImportsEnabled } =
    await import("../../packages/server/src/services/agents/custom-agent-import-policy.service.js");
  const { pinRoleplayRuleset } = await import("../../packages/server/src/services/game/roleplay-ruleset.service.js");

  const db = await createFileNativeDB();
  await setCustomAgentImportsEnabled(db, true);
  const definition = rulesetFromBuilderDraft(rulesetBuilderStarter("diceless", "Pin Test"));
  await createGameRulesetsStorage(db).put({
    rulesetId: "local/pin-test",
    version: 1,
    sourceKind: "local",
    definition: JSON.stringify(definition),
  });

  const characters = createCharactersStorage(db);
  const card = (name: string) => ({
    name,
    description: "",
    personality: "",
    scenario: "",
    first_mes: "",
    mes_example: "",
  });
  const mira = await characters.create(card("Mira") as any);
  const narrator = await characters.create(card("The Narrator") as any);
  const chats = createChatsStorage(db);
  const chat = await chats.create({
    name: "Pin test",
    mode: "roleplay",
    characterIds: [mira!.id, narrator!.id],
    connectionId: null,
  } as any);

  const names = async () => {
    const metadata = JSON.parse(String((await chats.getById(chat!.id))!.metadata ?? "{}"));
    return (metadata.gameCharacterCards ?? []).map((entry: { name: string }) => entry.name).sort();
  };

  const pinned = await pinRoleplayRuleset(db, { chatId: chat!.id, rulesetId: "local/pin-test" });
  assert.ok(pinned.ok && pinned.added === 2, JSON.stringify(pinned));
  assert.deepEqual(await names(), ["Mira", "The Narrator"]);

  // The player removes the narrator's sheet, as the sheets window does.
  await chats.patchMetadata(chat!.id, (current: Record<string, unknown>) => ({
    gameCharacterCards: (current.gameCharacterCards as Array<{ name: string }>).filter(
      (entry) => entry.name !== "The Narrator",
    ),
    roleplaySheetsDeclined: ["the narrator"],
  }));
  const again = await pinRoleplayRuleset(db, { chatId: chat!.id, rulesetId: "local/pin-test" });
  assert.ok(again.ok && again.added === 0, "a removed sheet is not given back by pinning again");
  assert.deepEqual(await names(), ["Mira"]);

  await chats.patchMetadata(chat!.id, () => ({ roleplaySheetsDeclined: [] }));
  const back = await pinRoleplayRuleset(db, { chatId: chat!.id, rulesetId: "local/pin-test" });
  assert.ok(back.ok && back.added === 1, "taking the removal back gives the member a sheet again");
  assert.deepEqual(await names(), ["Mira", "The Narrator"]);

  console.log("roleplay-ruleset-pin regression passed");
} finally {
  rmSync(directory, { recursive: true, force: true });
}
