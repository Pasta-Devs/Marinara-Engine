import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  characterStatTrackerLockKey,
  characterTrackerLockPrefix,
  parseRulesetDefinition,
  defaultRulesetSheetBuild,
  resolveGameInventoryHolder,
  type MultiplayerStoredRoom,
} from "../../packages/shared/src/index.js";

const dir = mkdtempSync(join(tmpdir(), "marinara-room-persona-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.LOG_LEVEL = "silent";
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createChatsStorage, withChatMetadataPatchQueue } =
  await import("../../packages/server/src/services/storage/chats.storage.js");
const { createGameStateStorage } = await import("../../packages/server/src/services/storage/game-state.storage.js");
const {
  applyRoomPersonaChanges,
  validateRoomPersonaChange,
  validateNewRoomHumanGameName,
  ensureRoomHumanGameCards,
  RoomPersonaConflictError,
} = await import("../../packages/server/src/services/multiplayer/game-persona.js");
const { parseGameStateRow } = await import("../../packages/server/src/routes/generate/generate-route-utils.js");
const db = await getDB();
try {
  const chats = createChatsStorage(db);
  const chat = await chats.create({ name: "Persona boundary", mode: "game", characterIds: [] });
  assert.ok(chat);
  const participant = {
    id: "guest_fixture",
    persona: { name: "Rowan", description: "A traveller." },
    pendingPersona: { name: "Ash", description: "The same player's new persona." },
  };
  const room = { version: 1, role: "host", status: "active", participants: [participant] };
  const stacks = [
    { id: "host_potion", name: "Potion", quantity: 1 },
    { id: "guest_sword", name: "Sword", quantity: 1, holder: "Rowan", equipped: true },
    { id: "npc_bow", name: "Bow", quantity: 1, holder: "Companion" },
  ];
  const cards = [
    { name: "Rowan", rpgStats: { attributes: [{ name: "STR", value: 8 }] }, rulesetSheet: { proof: "preserved" } },
    { name: "Companion", rpgStats: { attributes: [{ name: "STR", value: 16 }] } },
  ];
  await chats.patchMetadata(chat.id, {
    multiplayer: room,
    gameCharacterCards: cards,
    gameInventory: stacks,
    gameInventoryTurn: { messageId: "prior", before: stacks, swipes: { "0": stacks } },
    gamePartyArcs: [{ name: "Rowan", arc: "Rowan searches for home." }],
  });
  const message = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "Rowan takes watch." });
  const human = {
    characterId: "",
    name: "Rowan",
    emoji: "",
    mood: "Calm",
    appearance: null,
    outfit: null,
    customFields: {},
    stats: [{ name: "HP", value: 7, max: 12, color: "red" }],
    thoughts: "Private thought.",
  };
  const oldHiddenKey = characterStatTrackerLockKey(human, 0, human.stats[0], "value", 0);
  const states = createGameStateStorage(db);
  await states.create({
    chatId: chat.id,
    messageId: message.id,
    swipeIndex: 0,
    date: null,
    time: null,
    location: null,
    weather: null,
    temperature: null,
    presentCharacters: [human],
    recentEvents: [],
    personaStats: null,
    playerStats: {
      stats: [],
      attributes: null,
      skills: {},
      activeQuests: [],
      status: "",
      inventory: [{ name: "Potion", description: "Host bag", quantity: 1, location: "on_person" }],
    } as never,
    fieldLocks: { [oldHiddenKey]: true },
    hiddenTrackerFields: { [oldHiddenKey]: true },
    rulesetLive: { rowan: { pools: { hp: { value: 7 } } }, companion: { pools: { hp: { value: 20 } } } },
  });
  const change = [{ participantId: participant.id, previousName: "Rowan", name: "Ash" }];
  const apply = (after?: () => void) =>
    withChatMetadataPatchQueue(chat.id, () =>
      db.transaction(async (tx) => {
        await applyRoomPersonaChanges(tx, chat.id, change);
        after?.();
      }),
    );
  const metadata = async () => JSON.parse((await chats.getById(chat.id))!.metadata);
  const beforeMetadata = await metadata();
  const beforeState = await states.getLatest(chat.id);
  await validateRoomPersonaChange(db, chat.id, change[0]!);
  await assert.rejects(
    validateRoomPersonaChange(db, chat.id, { ...change[0]!, name: "Companion" }),
    (error) => error instanceof RoomPersonaConflictError && error.code === "identity-conflict",
  );
  assert.deepEqual(await metadata(), beforeMetadata, "admission checks never mutate metadata");
  assert.deepEqual(await states.getLatest(chat.id), beforeState);
  await assert.rejects(
    apply(() => {
      throw new Error("coordinator failure");
    }),
  );
  assert.deepEqual(await metadata(), beforeMetadata, "a failed boundary rolls all metadata back");
  assert.deepEqual(await states.getLatest(chat.id), beforeState, "and rolls the snapshot back with it");
  await apply();
  const after = await metadata();
  assert.deepEqual(after.gameCharacterCards[0], { ...cards[0], name: "Ash", multiplayerParticipantId: participant.id });
  assert.deepEqual(after.gameCharacterCards[1], cards[1]);
  assert.equal(after.gameInventory[1].holder, "Ash");
  assert.equal(after.gameInventoryTurn.before[1].holder, "Ash");
  assert.equal(after.gameInventoryTurn.swipes["0"][1].holder, "Ash");
  assert.equal(after.gamePartyArcs[0].name, "Ash");
  assert.equal(after.gamePartyArcs[0].arc, "Rowan searches for home.", "story prose is not rewritten");
  const state = parseGameStateRow((await states.getLatest(chat.id))!);
  assert.deepEqual(state.rulesetLive, {
    ash: { pools: { hp: { value: 7 } } },
    companion: { pools: { hp: { value: 20 } } },
  });
  assert.deepEqual(state.presentCharacters[0], { ...human, name: "Ash", characterId: participant.id });
  const newHiddenKey = oldHiddenKey.replace(
    characterTrackerLockPrefix(human, 0),
    characterTrackerLockPrefix(state.presentCharacters[0], 0),
  );
  assert.deepEqual(state.hiddenTrackerFields, { [newHiddenKey]: true }, "persona rename cannot reveal hidden stats");
  assert.deepEqual(state.fieldLocks, { [newHiddenKey]: true });
  assert.equal(state.playerStats?.inventory[0]?.description, "Host bag");
  assert.equal((await chats.listMessages(chat.id))[0]?.content, "Rowan takes watch.");
  assert.deepEqual(
    await withChatMetadataPatchQueue(chat.id, () =>
      db.transaction((tx) => applyRoomPersonaChanges(tx, chat.id, [{ ...change[0]!, participantId: "someone_else" }])),
    ),
    { rejectedParticipantIds: ["someone_else"] },
    "one participant cannot rename another's state",
  );
  await chats.patchMetadata(chat.id, {
    multiplayer: {
      ...room,
      participants: [
        {
          ...participant,
          persona: { name: "Ash", description: "" },
          pendingPersona: { name: "Companion", description: "" },
        },
      ],
    },
  });
  const beforeConflict = await metadata();
  assert.deepEqual(
    await withChatMetadataPatchQueue(chat.id, () =>
      db.transaction((tx) =>
        applyRoomPersonaChanges(tx, chat.id, [{ ...change[0]!, previousName: "Ash", name: "Companion" }]),
      ),
    ),
    { rejectedParticipantIds: [participant.id] },
    "an existing NPC's sheet is never overwritten",
  );
  assert.deepEqual(await metadata(), beforeConflict);

  // A name can be free at admission and be used by a newly generated NPC before the round completes.
  const host = {
    id: "host_fixture",
    persona: { name: "Host", description: "" },
    pendingPersona: { name: "Captain", description: "" },
  };
  const nextGuest = {
    ...participant,
    persona: { name: "Ash", description: "" },
    pendingPersona: { name: "Briar", description: "" },
  };
  await chats.patchMetadata(chat.id, {
    multiplayer: { ...room, participants: [host, nextGuest] },
    gameCharacterCards: [
      ...after.gameCharacterCards,
      { name: "Host", rpgStats: { attributes: [{ name: "STR", value: 20 }] } },
    ],
  });
  const newChanges = [
    { participantId: participant.id, previousName: "Ash", name: "Briar" },
    { participantId: host.id, previousName: "Host", name: "Captain" },
  ];
  await validateRoomPersonaChange(db, chat.id, newChanges[0]!);
  await chats.patchMetadata(chat.id, { gameNpcs: [{ id: "new_npc", name: "Briar" }] });
  assert.deepEqual(
    await withChatMetadataPatchQueue(chat.id, () =>
      db.transaction((tx) => applyRoomPersonaChanges(tx, chat.id, newChanges)),
    ),
    { rejectedParticipantIds: [participant.id] },
    "a late NPC collision does not block the completed round",
  );
  const mixed = await metadata();
  assert.equal(mixed.gameCharacterCards[0].name, "Ash", "the rejected participant retains their old sheet");
  assert.equal(mixed.gameInventory[1].holder, "Ash");
  assert.equal(mixed.gameCharacterCards[2].name, "Captain", "other valid pending personas still migrate");
  assert.equal(mixed.gameCharacterCards[2].multiplayerParticipantId, host.id);
  assert.deepEqual(mixed.gameNpcs, [{ id: "new_npc", name: "Briar" }]);
  assert.deepEqual(parseGameStateRow((await states.getLatest(chat.id))!).rulesetLive, state.rulesetLive);

  const fresh = await chats.create({ name: "Missing and late human cards", mode: "game", characterIds: [] });
  assert.ok(fresh);
  const initialRoom = {
    ...room,
    round: null,
    participants: [
      { ...host, pendingPersona: undefined, joinsNextRound: false },
      { ...participant, pendingPersona: undefined, joinsNextRound: false },
    ],
  } as unknown as MultiplayerStoredRoom;
  const generatedHost = { name: "Host", rpgStats: { attributes: [{ name: "STR", value: 20 }] } };
  await chats.patchMetadata(fresh.id, { multiplayer: initialRoom, gameCharacterCards: [generatedHost] });
  await withChatMetadataPatchQueue(fresh.id, () =>
    db.transaction((tx) => ensureRoomHumanGameCards(tx, fresh.id, initialRoom)),
  );
  const initialCards = JSON.parse((await chats.getById(fresh.id))!.metadata).gameCharacterCards;
  assert.deepEqual(initialCards[0], { ...generatedHost, multiplayerParticipantId: host.id });
  assert.equal(initialCards[1].name, "Rowan");
  assert.equal(initialCards[1].multiplayerParticipantId, participant.id);
  assert.equal(initialCards[1].rpgStats, undefined, "a missing human card never borrows host HP or attributes");
  const lateRoom = {
    ...initialRoom,
    round: { id: "round_fixture" },
    participants: [
      ...initialRoom.participants,
      { id: "late_human", persona: { name: "Sorrel", description: "A ranger." }, joinsNextRound: true },
    ],
  } as MultiplayerStoredRoom;
  await withChatMetadataPatchQueue(fresh.id, () =>
    db.transaction((tx) => ensureRoomHumanGameCards(tx, fresh.id, lateRoom, true)),
  );
  const lateCards = JSON.parse((await chats.getById(fresh.id))!.metadata).gameCharacterCards;
  assert.equal(lateCards[2].name, "Sorrel", "admission reserves the passed roster's own card before the next round");
  assert.equal(lateRoom.participants[2]!.joinsNextRound, true, "reserving a sheet never activates a readiness slot");
  const ruleset = parseRulesetDefinition(
    JSON.parse(readFileSync(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url), "utf8")),
  );
  assert.ok(ruleset.ok);
  const { sheetCommandCards } = await import("../../packages/server/src/services/game/ruleset-sheet-turn.service.js");
  const sheets = sheetCommandCards(ruleset.definition, lateCards);
  assert.deepEqual(
    sheets.find((sheet) => sheet.name === "Sorrel")?.build,
    defaultRulesetSheetBuild(ruleset.definition),
  );
  assert.deepEqual(
    resolveGameInventoryHolder("Sorrel", {
      player: "Host",
      members: lateCards.map((card: { name: string }) => card.name),
    }),
    { ok: true, bag: { holder: "Sorrel" } },
    "late arrivals receive their own inventory holder",
  );
  await assert.rejects(validateNewRoomHumanGameName(db, fresh.id, "Sorrel"), RoomPersonaConflictError);
  await chats.patchMetadata(fresh.id, {
    gameNpcs: [{ name: "Briar" }],
    gameInventory: [{ id: "left_item", name: "Rope", quantity: 1, holder: "Former" }],
  });
  await assert.rejects(validateNewRoomHumanGameName(db, fresh.id, "Briar"), RoomPersonaConflictError);
  await assert.rejects(validateNewRoomHumanGameName(db, fresh.id, "Former"), RoomPersonaConflictError);
  await validateNewRoomHumanGameName(db, fresh.id, "New traveler");
} finally {
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
process.stdout.write("Multiplayer Game persona boundary regression passed.\n");
