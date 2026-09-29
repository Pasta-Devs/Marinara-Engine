import {
  characterTrackerLockPrefix,
  normalizeCharacterLookupName,
  readGameInventoryTurn,
  type GameInventoryStack,
  type MultiplayerStoredRoom,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { parseGameStateRow } from "../../routes/generate/generate-route-utils.js";
import { applyGameInventoryChangeHeld } from "../game/game-inventory.service.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import { createGameStateStorage } from "../storage/game-state.storage.js";
import { record } from "./room-projection.js";

export interface RoomPersonaChange {
  participantId: string;
  previousName: string;
  name: string;
}

export class RoomPersonaConflictError extends Error {
  readonly code = "identity-conflict";
  constructor() {
    super("The shared Game persona name is already in use or its owner changed.");
  }
}

const records = (value: unknown) => (Array.isArray(value) ? value.map(record) : []);
const nameKey = (value: unknown) => (typeof value === "string" ? normalizeCharacterLookupName(value) : "");

async function readGamePersonaState(db: DB, chatId: string) {
  const chat = await createChatsStorage(db).getById(chatId);
  if (!chat || chat.mode !== "game") return null;
  const metadata = record(chat.metadata);
  const room = record(metadata.multiplayer);
  if (room.version !== 1 || room.role !== "host" || room.status === "ended")
    throw new Error("The shared Game no longer exists.");
  const latest = await createGameStateStorage(db).getLatest(chatId);
  return {
    metadata,
    room,
    participants: records(room.participants),
    cards: records(metadata.gameCharacterCards),
    state: latest ? parseGameStateRow(latest as Record<string, unknown>) : null,
  };
}

function assertPersonaChangeAvailable(
  current: NonNullable<Awaited<ReturnType<typeof readGamePersonaState>>>,
  change: RoomPersonaChange,
  pending = false,
) {
  const { metadata, room, participants, cards, state } = current;
  const participant = participants.find((candidate) => candidate.id === change.participantId);
  const oldKey = nameKey(change.previousName);
  const newKey = nameKey(change.name);
  const ownCard = (card: Record<string, unknown>) =>
    card.multiplayerParticipantId
      ? card.multiplayerParticipantId === change.participantId
      : nameKey(card.name) === oldKey;
  if (
    !participant ||
    record(participant.persona).name !== change.previousName ||
    !oldKey ||
    !newKey ||
    (pending && record(participant.pendingPersona).name !== change.name) ||
    participants.some(
      (other) =>
        other.id !== change.participantId &&
        [record(other.persona).name, record(other.pendingPersona).name].some((name) => nameKey(name) === newKey),
    ) ||
    records(room.characters).some((character) => nameKey(character.name) === newKey) ||
    cards.filter(ownCard).length > 1 ||
    cards.some((card) => nameKey(card.name) === oldKey && !ownCard(card)) ||
    cards.some((card) => nameKey(card.name) === newKey && !ownCard(card)) ||
    state?.presentCharacters.some(
      (row) =>
        (nameKey(row.name) === newKey && row.characterId !== change.participantId && nameKey(row.name) !== oldKey) ||
        (nameKey(row.name) === oldKey &&
          row.characterId !== change.participantId &&
          participants.some((owner) => owner.id === row.characterId)),
    ) ||
    (oldKey !== newKey &&
      (Object.hasOwn(state?.rulesetLive ?? {}, newKey) ||
        records(metadata.gameInventory).some((stack) => nameKey(stack.holder) === newKey) ||
        [...records(metadata.gameNpcs), ...records(metadata.gamePartyArcs)].some(
          (row) => nameKey(row.name) === newKey,
        )))
  )
    throw new RoomPersonaConflictError();
}

/** Read-only admission check; call before storing the pending persona under the room's metadata queue. */
export async function validateRoomPersonaChange(db: DB, chatId: string, change: RoomPersonaChange): Promise<void> {
  const current = await readGamePersonaState(db, chatId);
  if (current) assertPersonaChangeAvailable(current, change);
}

/** A newly admitted human must not take over a generated NPC's sheet, live state or possessions. */
export async function validateNewRoomHumanGameName(db: DB, chatId: string, name: string): Promise<void> {
  const current = await readGamePersonaState(db, chatId);
  if (!current) return;
  const { metadata, cards, state } = current;
  const key = nameKey(name);
  if (
    !key ||
    Object.hasOwn(state?.rulesetLive ?? {}, key) ||
    [
      ...cards,
      ...records(metadata.gameNpcs),
      ...records(metadata.gamePartyArcs),
      ...(state?.presentCharacters ?? []),
    ].some((row) => nameKey(row.name) === key) ||
    records(metadata.gameInventory).some((stack) => nameKey(stack.holder) === key)
  )
    throw new RoomPersonaConflictError();
}

/** Under the caller's metadata queue/transaction. The passed roster may include just-applied pending personas. */
export async function ensureRoomHumanGameCards(
  db: DB,
  chatId: string,
  room: MultiplayerStoredRoom,
  includePending = false,
): Promise<void> {
  const current = await readGamePersonaState(db, chatId);
  if (!current) return;
  const cards = [...current.cards];
  let changed = false;
  for (const participant of room.participants.filter((p) => includePending || !p.joinsNextRound)) {
    const key = nameKey(participant.persona.name);
    const matches = cards.filter(
      (card) => card.multiplayerParticipantId === participant.id || nameKey(card.name) === key,
    );
    if (
      matches.length > 1 ||
      (matches[0]?.multiplayerParticipantId && matches[0].multiplayerParticipantId !== participant.id)
    )
      throw new RoomPersonaConflictError();
    const existing = matches[0];
    if (existing) {
      // Initial setup generates cards by approved name. Once play starts, only an already bound
      // human card may be reused; a newly generated NPC is never silently adopted by a late arrival.
      if (!existing.multiplayerParticipantId && room.round) throw new RoomPersonaConflictError();
      if (existing.multiplayerParticipantId !== participant.id || existing.name !== participant.persona.name) {
        cards[cards.indexOf(existing)] = {
          ...existing,
          name: participant.persona.name,
          multiplayerParticipantId: participant.id,
        };
        changed = true;
      }
      continue;
    }
    cards.push({
      name: participant.persona.name,
      shortDescription: participant.persona.description,
      class: "",
      abilities: [],
      strengths: [],
      weaknesses: [],
      extra: {},
      multiplayerParticipantId: participant.id,
    });
    // No invented HP/attributes or library imports: existing sheet/dice helpers supply their
    // normal blank ruleset build or neutral legacy modifiers for a card without starting stats.
    changed = true;
  }
  if (changed)
    await createChatsStorage(db).patchMetadata(chatId, { gameCharacterCards: cards }, { metadataQueueHeld: true });
}

/** Called inside the coordinator's metadata queue and transaction, before it applies pending personas.
 * Clear pendingPersona for returned IDs before nextRound: a newly created NPC keeps its identity,
 * the participant keeps their previous persona, and the completed turn can still advance. */
export async function applyRoomPersonaChanges(db: DB, chatId: string, changes: readonly RoomPersonaChange[]) {
  const rejectedParticipantIds: string[] = [];
  const result = { rejectedParticipantIds };
  const renamed = changes.filter((change) => change.previousName !== change.name);
  if (!renamed.length) return result;
  const current = await readGamePersonaState(db, chatId);
  if (!current) return result;
  const { metadata, cards, state } = current;
  const byName = new Map<string, RoomPersonaChange>();
  const byId = new Map<string, RoomPersonaChange>();
  for (const change of renamed) {
    try {
      assertPersonaChangeAvailable(current, change, true);
      if (
        renamed.some(
          (other) =>
            other !== change &&
            (other.participantId === change.participantId || nameKey(other.name) === nameKey(change.name)),
        )
      )
        throw new RoomPersonaConflictError();
    } catch (error) {
      if (!(error instanceof RoomPersonaConflictError)) throw error;
      rejectedParticipantIds.push(change.participantId);
      continue;
    }
    byName.set(nameKey(change.previousName), change);
    byId.set(change.participantId, change);
  }
  if (!byId.size) return result;
  const match = (name: unknown) =>
    typeof name === "string" ? byName.get(normalizeCharacterLookupName(name)) : undefined;
  const renameStacks = (stacks: GameInventoryStack[]) =>
    stacks.map((stack) => {
      const change = match(stack.holder);
      return change ? { ...stack, holder: change.name } : stack;
    });
  const nextCards = cards.map((card) => {
    const change = card.multiplayerParticipantId ? byId.get(String(card.multiplayerParticipantId)) : match(card.name);
    if (!change) return card;
    return { ...card, name: change.name, multiplayerParticipantId: change.participantId };
  });
  const states = createGameStateStorage(db);
  const liveEntries = Object.entries(state?.rulesetLive ?? {}).map(
    ([key, value]) => [byName.has(key) ? normalizeCharacterLookupName(byName.get(key)!.name) : key, value] as const,
  );
  const prefixes = new Map<string, string>();
  const presentCharacters = state?.presentCharacters.map((character, index) => {
    const change = byId.get(character.characterId) ?? match(character.name);
    if (!change) return character;
    const next = { ...character, characterId: change.participantId, name: change.name };
    prefixes.set(characterTrackerLockPrefix(character, index), characterTrackerLockPrefix(next, index));
    return next;
  });
  const renameLocks = (locks: Record<string, boolean> | null | undefined) =>
    Object.fromEntries(
      Object.entries(locks ?? {}).map(([key, value]) => {
        const prefix = [...prefixes.keys()].find((candidate) => key === candidate || key.startsWith(`${candidate}.`));
        return [prefix ? `${prefixes.get(prefix)}${key.slice(prefix.length)}` : key, value];
      }),
    );
  const turn = readGameInventoryTurn(metadata.gameInventoryTurn);
  await applyGameInventoryChangeHeld(db, chatId, (stacks) => ({
    stacks: renameStacks(stacks),
    journal: [],
    metadata: {
      gameCharacterCards: nextCards,
      ...(Array.isArray(metadata.gamePartyArcs)
        ? {
            gamePartyArcs: metadata.gamePartyArcs.map((value) => {
              const arc = record(value);
              const change = match(arc.name);
              return change ? { ...arc, name: change.name } : arc;
            }),
          }
        : {}),
      ...(turn
        ? {
            gameInventoryTurn: {
              ...turn,
              before: renameStacks(turn.before),
              swipes: Object.fromEntries(
                Object.entries(turn.swipes).map(([key, stacks]) => [key, renameStacks(stacks)]),
              ),
            },
          }
        : {}),
    },
    value: undefined,
  }));
  if (state)
    await states.updateLatest(chatId, {
      presentCharacters,
      rulesetLive: state.rulesetLive ? Object.fromEntries(liveEntries) : null,
      fieldLocks: renameLocks(state.fieldLocks),
      hiddenTrackerFields: renameLocks(state.hiddenTrackerFields),
    });
  return result;
}
