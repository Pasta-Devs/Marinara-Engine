// Character Tracker results: the characters present in the scene, saved on the message's game-state snapshot.
//
// Until #9508 only normal generation filled avatars, drew NPC portraits and wrote NPC encounters to the journal; the
// retry route was split out (4d191fcdfd, 2026-04-02) four days before those were added (74e8a26aad), and nothing in
// the history says a re-run should skip them. Each extra is its own step below, switched per route in
// CHARACTER_TRACKER_STEPS, so one can be turned off for re-runs again without unpicking the rest.
import {
  applyTrackerFieldLocksToGameStatePatch,
  isTrackerRowsUpdate,
  normalizeTextForMatch,
  type AgentResult,
  type GameNpc,
} from "@marinara-engine/shared";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../../../lib/logger.js";
import {
  applyTrackerCharacterCardIdentity,
  isManualTrackerCharacterId,
  parseGameStateRow,
  parseJsonField,
  preserveTrackerCharacterUiFields,
  resolveTrackerGroupUpdate,
} from "../../../routes/generate/generate-route-utils.js";
import { DATA_DIR } from "../../../utils/data-dir.js";
import { newId } from "../../../utils/id-generator.js";
import { addNpcEntry } from "../../game/journal.service.js";
import {
  findCharAvatarFuzzy,
  loadCharacterLibraryAvatarLookup,
  npcAvatarSlug,
  sanitizeGameNpcAvatarUrls,
} from "../../game/npc-avatar-utils.js";
import { createCharactersStorage } from "../../storage/characters.storage.js";
import { updateJournal } from "../game-journal-runtime.js";
import type { AgentResultEffectDeps, AgentResultEffectOrigin } from "./types.js";

type TrackedCharacter = Record<string, unknown>;

/**
 * What a Character Tracker result does besides saving the character list, per route. All on: a re-run of the tracker
 * should leave the scene the way a normal reply would. To stop one on re-runs, set it to false here and say why.
 * - `fillAvatars`: take avatars from the chat's cards, the character library and stored NPC portraits.
 * - `drawPortraits`: with the tracker's *Auto-generate avatars* on, draw missing NPC portraits (spends image credits).
 * - `journal`: write newly met NPCs to the game journal.
 */
export const CHARACTER_TRACKER_STEPS: Record<
  AgentResultEffectOrigin,
  { fillAvatars: boolean; drawPortraits: boolean; journal: boolean }
> = {
  generate: { fillAvatars: true, drawPortraits: true, journal: true },
  retry: { fillAvatars: true, drawPortraits: true, journal: true },
};

/** NPC portraits being drawn right now, per chat. A second re-run while one is still drawing skips that NPC. */
const portraitsInFlight = new Set<string>();

function portraitKey(chatId: string, character: TrackedCharacter): string {
  return `${chatId}\u0000${String(character.characterId ?? character.name ?? "")
    .trim()
    .toLowerCase()}`;
}

/** Character Tracker agent: merges the present characters into this message's snapshot. */
export async function applyCharacterTrackerResult(result: AgentResult, deps: AgentResultEffectDeps): Promise<void> {
  if (!deps.trackers.canEditTrackers(result)) return;
  const target = deps.trackers.characters;
  const steps = CHARACTER_TRACKER_STEPS[deps.origin];
  try {
    const data = result.data as Record<string, unknown>;
    if (
      !isTrackerRowsUpdate(data.presentCharacters) &&
      (!Array.isArray(data.presentCharacters) || data.presentCharacters.length === 0)
    ) {
      const resultKeys = Object.keys(data);
      // `{}` and an empty list are the prompt's no-change replies; any other shape is lost output (#7208).
      logger[resultKeys.length === 0 || Array.isArray(data.presentCharacters) ? "debug" : "warn"](
        "[agent-effects] character-tracker emitted no presentCharacters origin=%s (result keys: %s); keeping existing snapshot",
        deps.origin,
        resultKeys.join(", ") || "none",
      );
      return;
    }

    deps.signal?.throwIfAborted();
    const previousSnapshot = await target.loadBaseline();
    deps.signal?.throwIfAborted();
    // A damaged row can hold something other than a list; merge onto an empty one rather than fail the run.
    const storedCharacters = parseJsonField<unknown>(previousSnapshot?.presentCharacters, []);
    const previousCharacters = Array.isArray(storedCharacters) ? (storedCharacters as TrackedCharacter[]) : [];
    if (!Array.isArray(storedCharacters)) {
      logger.warn(
        "[agent-effects] character-tracker found a stored character list that is not a list; starting from an empty one origin=%s chatId=%s messageId=%s swipeIndex=%d",
        deps.origin,
        deps.chatId,
        deps.messageId,
        deps.swipeIndex,
      );
    }
    const lockState = previousSnapshot
      ? parseGameStateRow({ ...previousSnapshot, presentCharacters: previousCharacters })
      : null;
    let characters =
      resolveTrackerGroupUpdate(data.presentCharacters, previousCharacters, lockState, "presentCharacters") ??
      previousCharacters;
    const cardCharacterIds = applyTrackerCharacterCardIdentity(characters, target.cards, {
      previousCharacters: [...previousCharacters, ...target.history],
    });
    preserveTrackerCharacterUiFields(characters, previousCharacters);
    preserveTrackerCharacterUiFields(characters, target.history);
    const lockedPatch = applyTrackerFieldLocksToGameStatePatch({ presentCharacters: characters }, lockState);
    characters = Array.isArray(lockedPatch.presentCharacters) ? lockedPatch.presentCharacters : characters;

    if (steps.fillAvatars) await fillAvatars(characters, cardCharacterIds, deps);

    deps.signal?.throwIfAborted();
    await target.save(characters);
    deps.signal?.throwIfAborted();
    logger.info(
      "[agent-effects] character-tracker saved %d characters origin=%s messageId=%s swipeIndex=%d",
      characters.length,
      deps.origin,
      deps.messageId,
      deps.swipeIndex,
    );
    deps.trackers.emitGameStatePatch({ presentCharacters: characters });
    // Only after the save: the portrait task merges onto the saved row, and must not race the save that creates it.
    if (steps.drawPortraits) drawMissingPortraits(characters, deps);

    if (steps.journal) await journalNewNpcs(characters, previousCharacters, deps);
  } catch (err) {
    deps.signal?.throwIfAborted();
    logger.error(
      err,
      "[agent-effects] Failed to apply character-tracker update origin=%s chatId=%s messageId=%s swipeIndex=%d",
      deps.origin,
      deps.chatId,
      deps.messageId,
      deps.swipeIndex,
    );
  }
}

/** Avatar for each non-card character: chat card by name, then the character library, then a stored NPC portrait. */
async function fillAvatars(
  characters: TrackedCharacter[],
  cardCharacterIds: Set<string>,
  deps: AgentResultEffectDeps,
): Promise<void> {
  const target = deps.trackers.characters;
  const libraryAvatarByName = await loadCharacterLibraryAvatarLookup(
    () => createCharactersStorage(deps.trackers.db).list(),
    (error) => logger.warn(error, "[agent-effects] Failed to load library characters for avatar enrichment"),
  );
  deps.signal?.throwIfAborted();
  const storedNpcAvatarByName = new Map<string, string>();
  for (const npc of sanitizeGameNpcAvatarUrls(target.gameNpcs)) {
    const name = normalizeTextForMatch(npc.name);
    if (name && npc.avatarUrl) storedNpcAvatarByName.set(name, npc.avatarUrl);
  }
  const npcAvatarDir = join(DATA_DIR, "avatars", "npc");

  for (const character of characters) {
    if (isManualTrackerCharacterId(character.characterId)) continue;
    if (cardCharacterIds.has(String(character.characterId))) continue;
    const name = (character.name as string) ?? "";
    const matched = target.cards.find((card) => normalizeTextForMatch(card.name) === normalizeTextForMatch(name));
    if (!character.avatarCrop && matched?.avatarCrop) character.avatarCrop = matched.avatarCrop;
    if (character.avatarPath) continue;
    if (matched?.avatarPath) {
      character.avatarPath = matched.avatarPath;
      continue;
    }
    const libraryAvatar = findCharAvatarFuzzy(name, libraryAvatarByName);
    if (libraryAvatar) {
      character.avatarPath = libraryAvatar;
      continue;
    }
    const storedNpcAvatar = storedNpcAvatarByName.get(normalizeTextForMatch(name));
    if (storedNpcAvatar) {
      character.avatarPath = storedNpcAvatar;
      continue;
    }
    const safeName = npcAvatarSlug(name);
    if (safeName && existsSync(join(npcAvatarDir, deps.chatId, `${safeName}.png`))) {
      character.avatarPath = `/api/avatars/npc/${deps.chatId}/${safeName}.png`;
    }
  }
}

/**
 * Draws portraits for NPCs that still have none, in the background so the reply isn't held up, then saves them onto
 * the snapshot and sends the patch. It runs after the route has answered, so it never throws and never checks the
 * route's abort signal: a retry's signal fires when its connection closes, which would drop a portrait already paid for.
 */
function drawMissingPortraits(characters: TrackedCharacter[], deps: AgentResultEffectDeps): void {
  const target = deps.trackers.characters;
  const settings = target.settings ?? {};
  const connectionId = typeof settings.imageConnectionId === "string" ? settings.imageConnectionId : null;
  if (!settings.autoGenerateAvatars || !connectionId) return;
  const needingPortraits = characters.filter(
    (character) =>
      !character.avatarPath &&
      !isManualTrackerCharacterId(character.characterId) &&
      typeof character.name === "string" &&
      character.name &&
      character.appearance &&
      !portraitsInFlight.has(portraitKey(deps.chatId, character)),
  );
  if (needingPortraits.length === 0) return;
  const includeOutfit = settings.includeOutfitInAvatars !== false;
  const keys = needingPortraits.map((character) => portraitKey(deps.chatId, character));
  for (const key of keys) portraitsInFlight.add(key);

  void (async () => {
    try {
      const drawn = new Map<string, string>();
      for (const npc of needingPortraits) {
        try {
          const avatarPath = await target.drawPortrait(npc as { name: string }, { connectionId, includeOutfit });
          drawn.set(portraitKey(deps.chatId, npc), avatarPath);
          logger.info('[character-tracker] Generated avatar for NPC "%s" origin=%s', npc.name, deps.origin);
        } catch (err) {
          logger.warn(err, '[character-tracker] Failed to generate avatar for "%s"', npc.name);
        }
      }
      if (drawn.size === 0) return;

      // Merge onto the row as it is now: the user or a later run may have changed it meanwhile.
      const latest = await target.loadForBackgroundSave();
      const latestState = latest ? parseGameStateRow(latest) : null;
      const current = Array.isArray(latestState?.presentCharacters)
        ? (latestState.presentCharacters as unknown as TrackedCharacter[])
        : characters;
      const merged = current.map((character) => {
        const avatarPath = drawn.get(portraitKey(deps.chatId, character));
        // An avatar set meanwhile (by the user or another run) wins over the drawn one.
        return avatarPath && !character.avatarPath ? { ...character, avatarPath } : character;
      });
      const lockedPatch = applyTrackerFieldLocksToGameStatePatch({ presentCharacters: merged }, latestState);
      const presentCharacters = Array.isArray(lockedPatch.presentCharacters) ? lockedPatch.presentCharacters : merged;
      await target.saveInBackground(presentCharacters);
      logger.debug("[game_state_patch] character-tracker (avatar update): %d chars", presentCharacters.length);
      deps.trackers.emitGameStatePatch({ presentCharacters });
    } catch (err) {
      logger.warn(err, "[character-tracker] Avatar generation error origin=%s", deps.origin);
    } finally {
      for (const key of keys) portraitsInFlight.delete(key);
    }
  })();
}

/** Newly present NPCs (not chat cards) go into the journal; `addNpcEntry` skips an entry it already has. */
async function journalNewNpcs(
  characters: TrackedCharacter[],
  previousCharacters: TrackedCharacter[],
  deps: AgentResultEffectDeps,
): Promise<void> {
  const cards = deps.trackers.characters.cards;
  const previousNames = new Set(previousCharacters.map((character) => normalizeTextForMatch(character.name)));
  for (const character of characters) {
    const name = (character.name as string) ?? "";
    if (!name || previousNames.has(normalizeTextForMatch(name))) continue;
    if (cards.some((card) => normalizeTextForMatch(card.name) === normalizeTextForMatch(name))) continue;
    const mood = (character.mood as string) || "";
    const npc: GameNpc = {
      id: normalizeTextForMatch(name).replace(/[^\p{L}\p{N}]+/gu, "-") || newId(),
      name,
      emoji: "👤",
      description: (character.appearance as string) || "",
      location: "",
      reputation: 0,
      notes: [],
    };
    const interaction = mood ? `Encountered (${mood})` : "Encountered";
    deps.signal?.throwIfAborted();
    await updateJournal(deps.trackers.db, deps.chatId, (journal) => addNpcEntry(journal, npc, interaction));
  }
}
