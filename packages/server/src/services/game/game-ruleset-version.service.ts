// Moving a game onto a newer stored version of its imported ruleset.
//
// An imported ruleset keeps every version it was imported at, and a game reads the exact one it was
// created on (`resolveGameRuleset`), so an old save keeps its old rules after the ruleset is updated.
// This moves the pin forward when the player asks, from the Journal. Sheets stored on the older
// layout are migrated as they are read, as they are for a package update; the move only goes
// forward, because what the newer version writes an older one may not read.
import { rulesetRefSchema } from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { readMetadata } from "./game-inventory.service.js";
import { loadRulesetRegistry } from "./ruleset-registry.service.js";

export type GameRulesetVersionOutcome = { ok: true; version: number } | { ok: false; status: 404 | 409; error: string };

export async function moveGameRulesetVersion(
  db: DB,
  input: { chatId: string; version: number },
): Promise<GameRulesetVersionOutcome> {
  const chats = createChatsStorage(db);
  const chat = await chats.getById(input.chatId);
  if (!chat) return { ok: false, status: 404, error: "Chat not found" };
  if (chat.mode !== "game") return { ok: false, status: 409, error: "This chat is not a game" };
  const pin = rulesetRefSchema.safeParse(readMetadata(chat.metadata).gameRuleset);
  if (!pin.success) return { ok: false, status: 409, error: "This game plays by no ruleset" };
  const registered = (await loadRulesetRegistry(db)).get(pin.data.id);
  if (!registered || registered.packageId !== pin.data.packageId) {
    return { ok: false, status: 409, error: "This game's ruleset is not installed" };
  }
  // A package's ruleset already plays its newest installed version: only an import keeps others.
  if (!registered.versions) return { ok: false, status: 409, error: "This game already plays the installed version" };
  if (!registered.versions.has(input.version)) {
    return { ok: false, status: 409, error: "That version of the ruleset is not installed" };
  }
  if (input.version <= pin.data.version) {
    return { ok: false, status: 409, error: "A game only moves to a newer version of its ruleset" };
  }

  let outcome: GameRulesetVersionOutcome | null = null;
  await chats.patchMetadata(input.chatId, (current) => {
    // Read again inside the queue: another move, or anything else that changed the pin, wins.
    const now = rulesetRefSchema.safeParse(current.gameRuleset);
    if (!now.success || now.data.id !== pin.data.id || now.data.packageId !== pin.data.packageId) {
      outcome = { ok: false, status: 409, error: "This game's ruleset changed meanwhile" };
      return {};
    }
    if (now.data.version >= input.version) {
      outcome = { ok: true, version: now.data.version };
      return {};
    }
    outcome = { ok: true, version: input.version };
    return { gameRuleset: { ...(current.gameRuleset as Record<string, unknown>), version: input.version } };
  });
  return outcome ?? { ok: false, status: 409, error: "This game's ruleset changed meanwhile" };
}
