import assert from "node:assert/strict";
import {
  projectMultiplayerGame,
  gameNarrationForParticipant,
} from "../../packages/server/src/services/multiplayer/game-projection.js";
import { projectRoomSnapshot } from "../../packages/server/src/services/multiplayer/room-projection.js";
import {
  characterStatTrackerLockKey,
  multiplayerGameStateSchema,
  worldTrackerLockKey,
  type MultiplayerStoredRoom,
} from "../../packages/shared/src/index.js";
const room = {
  roomId: "room_fixture",
  participants: [
    { id: "host_fixture", displayName: "Mari", persona: { name: "Luna", description: "" }, isHost: true },
    { id: "guest_fixture", displayName: "Alex", persona: { name: "Rowan", description: "" }, isHost: false },
  ],
  characters: [
    { id: "character_fixture", name: "Guide", role: "character" },
    { id: "gm_fixture", name: "GM", role: "gm" },
  ],
} as MultiplayerStoredRoom;
const content =
  "[Narrator][main]A public harbor.\n[choices: Visit docks | Ask Guide]\n[Guide][whisper:Rowan]Private letter.\n[choices: SECRET OPTION | Another secret]\n[Guide][thought]SECRET THOUGHT\n[Narrator][main]The fog lifts.";
const audience = {
  roomId: room.roomId,
  participants: room.participants.map((p) => ({ id: p.id, name: p.persona.name })),
};
assert.ok(gameNarrationForParticipant(content, room, "guest_fixture", audience).includes("Private letter"));
assert.ok(!gameNarrationForParticipant(content, room, "host_fixture", audience).includes("Private letter"));
assert.ok(
  !gameNarrationForParticipant(content, room, "guest_fixture").includes("Private letter"),
  "unbound history hides private blocks",
);
assert.ok(
  !gameNarrationForParticipant(content, room, "guest_fixture", { ...audience, roomId: "other_room" }).includes(
    "Private letter",
  ),
);
assert.equal(gameNarrationForParticipant("[Guide][thought: truncated secret", room, "host_fixture"), "");

const renamedRoom = {
  ...room,
  revision: 3,
  status: "active",
  generation: "idle",
  generations: 1,
  maxGenerations: 10,
  automaticReplies: true,
  round: null,
  participants: [
    ...room.participants.map((p) => ({
      ...p,
      persona: p.id === "guest_fixture" ? { ...p.persona, name: "Ash" } : p.persona,
      lastSequence: 0,
      joinsNextRound: false,
    })),
    {
      id: "later_fixture",
      displayName: "Later",
      persona: { name: "Rowan", description: "" },
      isHost: false,
      lastSequence: 0,
      joinsNextRound: false,
    },
  ],
} as MultiplayerStoredRoom;
const historicalSnapshot = (selfId: string, bound: boolean) =>
  projectRoomSnapshot({
    room: renamedRoom,
    chat: { name: "Shared Game", mode: "game" },
    selfId,
    connected: new Set(),
    messages: [
      {
        id: "message_fixture",
        role: "assistant",
        characterId: "gm_fixture",
        content,
        extra: bound ? { multiplayerGameAudience: audience } : {},
        createdAt: "2026-09-29T12:00:00.000Z",
      },
    ],
  });
assert.ok(
  historicalSnapshot("guest_fixture", true).messages[0]!.text.includes("Private letter"),
  "the original recipient retains their old whisper after switching persona",
);
assert.ok(
  !historicalSnapshot("later_fixture", true).messages[0]!.text.includes("Private letter"),
  "reusing an old persona name never grants old whispers",
);
assert.ok(
  !historicalSnapshot("guest_fixture", false).messages[0]!.text.includes("Private letter"),
  "missing historical audience remains private in reconnect snapshots",
);
const formerAiSnapshot = projectRoomSnapshot({
  room: { ...renamedRoom, characters: [] },
  chat: { name: "Shared Roleplay", mode: "roleplay" },
  selfId: "guest_fixture",
  connected: new Set(),
  messages: [
    {
      id: "old_character",
      role: "assistant",
      characterId: "character_fixture",
      content: "A prior reply.",
      extra: { multiplayerActor: { id: "character_fixture", name: "Original Guide", role: "character" } },
      createdAt: "2026-09-29T12:00:00.000Z",
    },
    {
      id: "old_gm_fixture",
      role: "assistant",
      characterId: "gm_fixture",
      content: "The scene opens.",
      extra: { multiplayerActor: { id: "gm_fixture", name: "Original Narrator", role: "gm" } },
      createdAt: "2026-09-29T12:00:01.000Z",
    },
  ],
});
assert.equal(formerAiSnapshot.messages[0]?.actorName, "Original Guide");
assert.equal(formerAiSnapshot.messages[0]?.actorId, "character_fixture");
assert.equal(formerAiSnapshot.messages[0]?.kind, "assistant");
assert.equal(formerAiSnapshot.messages[1]?.actorName, "Original Narrator");
assert.equal(formerAiSnapshot.messages[1]?.kind, "narrator", "a removed GM keeps their original speaking role");
const character = {
  characterId: "guest_fixture",
  name: "Rowan",
  stats: [{ name: "HP", value: 7, max: 10 }],
  thoughts: "PRIVATE THOUGHT",
  customFields: { secret: "PRIVATE CUSTOM" },
};
const base = {
  room,
  metadata: {
    gameActiveState: "dialogue",
    gameCharacterCards: [{ name: "Rowan", rpgStats: { hp: { value: 7, max: 10 } }, notes: "SECRET SHEET" }],
    gameWidgetState: [{ label: "SECRET WIDGET" }],
    gamePlotTwists: ["SECRET PLOT"],
  },
  state: {
    location: "Harbor",
    weather: "fog",
    time: "noon",
    presentCharacters: [
      character,
      { characterId: "private_card", name: "Secret stranger", stats: [{ name: "Secret stat", value: 99, max: 100 }] },
    ],
  },
  messages: [
    {
      role: "assistant",
      content,
      extra: { diceRollResults: [{ notation: "SECRET ROLL", total: 20 }], prompt: "SECRET PROMPT" },
    },
  ],
};
const projected = projectMultiplayerGame(base);
assert.deepEqual(projected.choices, ["Visit docks", "Ask Guide"]);
assert.deepEqual(projected.rolls, [], "untargeted dice from mixed private/public narration remain private");
assert.deepEqual(projected.trackers, [
  { ownerId: "guest_fixture", name: "Rowan", values: [{ label: "HP", value: "7 / 10" }] },
]);
assert.equal(projected.location, "Harbor");
assert.ok(!JSON.stringify(projected).includes("SECRET"));
assert.ok(!JSON.stringify(projected).includes("PRIVATE"));
const hidden = projectMultiplayerGame({
  ...base,
  state: {
    ...base.state,
    hiddenTrackerFields: {
      [worldTrackerLockKey("location")]: true,
      [characterStatTrackerLockKey(character, 0, { name: "HP" }, "value")]: true,
    },
  },
});
assert.equal(hidden.location, null);
assert.deepEqual(hidden.trackers, [], "a hidden authoritative stat never reappears from the initial card fallback");
const publicRoll = projectMultiplayerGame({
  ...base,
  messages: [
    { role: "assistant", content: "A public roll.", extra: { diceRollResults: [{ notation: "1d6", total: 4 }] } },
    { role: "assistant", content: "[choices: HIDDEN MESSAGE CHOICE]", extra: { hiddenFromUser: true } },
  ],
});
assert.deepEqual(publicRoll.rolls, [{ label: "1d6", total: 4 }]);
assert.deepEqual(publicRoll.choices, []);
assert.equal(multiplayerGameStateSchema.safeParse({ ...projected, rawMetadata: {} }).success, false);
assert.equal(
  multiplayerGameStateSchema.safeParse({ ...projected, rolls: [{ label: "roll", total: Infinity }] }).success,
  false,
);
process.stdout.write("Multiplayer Game projection regression passed.\n");
