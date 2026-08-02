import assert from "node:assert/strict";
import { resolveChatResourceDropAction } from "../../packages/client/src/lib/chat-resource-drop-capabilities.js";
import {
  beginChatResourceTouchDrag,
  clearActiveChatResourceDrag,
  getActiveChatResourceTouchDrag,
  parseChatResourceDragPayload,
  setPendingChatResourcePanelRestore,
  subscribeChatResourceTouchDrag,
  takePendingChatResourcePanelRestore,
} from "../../packages/client/src/lib/chat-resource-drag.js";
import { readCharacterGreetings } from "../../packages/client/src/lib/character-greetings.js";

const baseChat = {
  id: "chat-1",
  mode: "roleplay" as const,
  characterIds: ["character-1"],
  personaId: "persona-1",
  promptPresetId: "preset-1",
  connectionId: "connection-1",
  metadata: {
    activeLorebookIds: ["lorebook-1"],
    activeAgentIds: ["agent-1"],
    enableAgents: true,
    background: "current-background.png",
  },
};

assert.deepEqual(
  resolveChatResourceDropAction(
    { version: 1, kind: "character", ids: ["character-1", "character-2"], label: "Two characters" },
    baseChat,
  ),
  { type: "add-characters", ids: ["character-2"], label: "Two characters" },
);

assert.equal(
  resolveChatResourceDropAction(
    { version: 1, kind: "character", ids: ["deleted-character"], label: "Deleted character" },
    baseChat,
    new Set(["character-1", "character-2"]),
  ),
  null,
);

assert.deepEqual(
  resolveChatResourceDropAction(
    { version: 1, kind: "character", ids: ["character-1"], label: "Existing character" },
    baseChat,
  ),
  { type: "blocked", reason: "already-active", label: "Existing character" },
);
assert.deepEqual(
  resolveChatResourceDropAction(
    {
      version: 1,
      kind: "background",
      ids: ["/api/backgrounds/file/new-background.png"],
      label: "New background",
    },
    baseChat,
  ),
  {
    type: "set-background",
    id: "/api/backgrounds/file/new-background.png",
    label: "New background",
  },
);
assert.deepEqual(
  resolveChatResourceDropAction(
    {
      version: 1,
      kind: "background",
      ids: ["/api/backgrounds/file/current-background.png"],
      label: "Current background",
    },
    baseChat,
  ),
  { type: "blocked", reason: "already-active", label: "Current background" },
);

assert.deepEqual(
  resolveChatResourceDropAction(
    { version: 1, kind: "lorebook", ids: ["lorebook-2"], label: "New lorebook" },
    baseChat,
  ),
  { type: "add-lorebooks", ids: ["lorebook-2"], label: "New lorebook", inheritedFrom: [] },
);

assert.deepEqual(
  resolveChatResourceDropAction(
    { version: 1, kind: "lorebook", ids: ["lorebook-1"], label: "Existing lorebook" },
    baseChat,
  ),
  { type: "blocked", reason: "already-active", label: "Existing lorebook" },
);

// A book pulled in by the character or persona is not a no-op drop: pinning it to the chat keeps it
// after that character or persona is swapped out, so the drop reports the source instead of blocking.
const inheritedLorebooks = [
  { id: "lorebook-2", name: "Character lore", characterIds: ["character-1"], enabled: true },
  { id: "lorebook-3", name: "Persona lore", personaIds: ["persona-1"], enabled: true },
  { id: "lorebook-4", name: "Unrelated lore", characterIds: ["character-9"], enabled: true },
  { id: "lorebook-5", name: "Excluded lore", characterIds: ["character-1"], enabled: true },
  { id: "lorebook-6", name: "Global lore", isGlobal: true, enabled: true },
  { id: "lorebook-7", name: "Chat-scoped lore", chatId: "chat-1", enabled: true },
] as unknown as Parameters<typeof resolveChatResourceDropAction>[3];

assert.deepEqual(
  resolveChatResourceDropAction(
    { version: 1, kind: "lorebook", ids: ["lorebook-2", "lorebook-3"], label: "Two lorebooks" },
    baseChat,
    undefined,
    inheritedLorebooks,
  ),
  {
    type: "add-lorebooks",
    ids: ["lorebook-2", "lorebook-3"],
    label: "Two lorebooks",
    inheritedFrom: ["Character", "Persona"],
  },
);

assert.deepEqual(
  resolveChatResourceDropAction(
    { version: 1, kind: "lorebook", ids: ["lorebook-4"], label: "Unrelated lore" },
    baseChat,
    undefined,
    inheritedLorebooks,
  ),
  { type: "add-lorebooks", ids: ["lorebook-4"], label: "Unrelated lore", inheritedFrom: [] },
);

// A book the user disabled for this chat is not actually in context, so it must not be reported.
assert.deepEqual(
  resolveChatResourceDropAction(
    { version: 1, kind: "lorebook", ids: ["lorebook-5"], label: "Excluded lore" },
    { ...baseChat, metadata: { ...baseChat.metadata, excludedLorebookIds: ["lorebook-5"] } },
    undefined,
    inheritedLorebooks,
  ),
  { type: "add-lorebooks", ids: ["lorebook-5"], label: "Excluded lore", inheritedFrom: [] },
);

assert.deepEqual(
  resolveChatResourceDropAction(
    { version: 1, kind: "lorebook", ids: ["lorebook-6"], label: "Global lore" },
    baseChat,
    undefined,
    inheritedLorebooks,
  ),
  { type: "add-lorebooks", ids: ["lorebook-6"], label: "Global lore", inheritedFrom: ["Global"] },
);

// A book owned by this chat but never pinned still counts as an inherited source.
assert.deepEqual(
  resolveChatResourceDropAction(
    { version: 1, kind: "lorebook", ids: ["lorebook-7"], label: "Chat-scoped lore" },
    baseChat,
    undefined,
    inheritedLorebooks,
  ),
  { type: "add-lorebooks", ids: ["lorebook-7"], label: "Chat-scoped lore", inheritedFrom: ["Chat"] },
);

// Sources report in the resolver's fixed order, not in the order the books happen to arrive.
assert.deepEqual(
  resolveChatResourceDropAction(
    {
      version: 1,
      kind: "lorebook",
      ids: ["lorebook-7", "lorebook-6", "lorebook-3", "lorebook-2"],
      label: "Every source",
    },
    baseChat,
    undefined,
    inheritedLorebooks,
  ),
  {
    type: "add-lorebooks",
    ids: ["lorebook-7", "lorebook-6", "lorebook-3", "lorebook-2"],
    label: "Every source",
    inheritedFrom: ["Character", "Persona", "Global", "Chat"],
  },
);

assert.deepEqual(
  resolveChatResourceDropAction(
    { version: 1, kind: "agent", ids: ["agent-2"], label: "New agent" },
    { ...baseChat, metadata: { ...baseChat.metadata, enableAgents: false } },
  ),
  { type: "add-agents", ids: ["agent-2"], label: "New agent", mustEnableAgents: true },
);

assert.deepEqual(
  resolveChatResourceDropAction(
    { version: 1, kind: "agent", ids: ["agent-1"], label: "Existing agent" },
    baseChat,
  ),
  { type: "blocked", reason: "already-active", label: "Existing agent" },
);

assert.deepEqual(
  parseChatResourceDragPayload({
    version: 1,
    kind: "character",
    ids: ["character-1", "character-1", "character-2"],
    label: "  Characters  ",
  }),
  { version: 1, kind: "character", ids: ["character-1", "character-2"], label: "Characters" },
);
assert.equal(parseChatResourceDragPayload({ version: 2, kind: "character", ids: ["character-1"], label: "A" }), null);
assert.equal(parseChatResourceDragPayload({ version: 1, kind: "unknown", ids: ["resource-1"], label: "A" }), null);
assert.equal(parseChatResourceDragPayload({ version: 1, kind: "agent", ids: [], label: "A" }), null);
assert.equal(
  parseChatResourceDragPayload({
    version: 1,
    kind: "character",
    ids: Array.from({ length: 101 }, (_value, index) => `character-${index}`),
    label: "Too many",
  }),
  null,
);
assert.equal(
  parseChatResourceDragPayload({ version: 1, kind: "character", ids: ["character-1"], label: "   " }),
  null,
);

assert.deepEqual(
  resolveChatResourceDropAction(
    { version: 1, kind: "persona", ids: ["persona-2"], label: "New persona" },
    baseChat,
  ),
  { type: "set-persona", id: "persona-2", label: "New persona", replacesId: "persona-1" },
);
assert.deepEqual(
  resolveChatResourceDropAction(
    { version: 1, kind: "persona", ids: ["persona-1"], label: "Current persona" },
    baseChat,
  ),
  { type: "blocked", reason: "already-active", label: "Current persona" },
);
assert.deepEqual(
  resolveChatResourceDropAction(
    { version: 1, kind: "preset", ids: ["preset-2"], label: "New preset" },
    baseChat,
  ),
  { type: "set-preset", id: "preset-2", label: "New preset", replacesId: "preset-1" },
);
assert.deepEqual(
  resolveChatResourceDropAction(
    { version: 1, kind: "preset", ids: ["preset-2"], label: "New preset" },
    { ...baseChat, mode: "conversation" },
  ),
  { type: "blocked", reason: "preset-unsupported-mode", label: "New preset" },
);
assert.deepEqual(
  resolveChatResourceDropAction(
    { version: 1, kind: "connection", ids: ["connection-2"], label: "New connection" },
    baseChat,
  ),
  { type: "set-connection", id: "connection-2", label: "New connection", replacesId: "connection-1" },
);
assert.deepEqual(
  resolveChatResourceDropAction(
    { version: 1, kind: "connection", ids: ["connection-1"], label: "Current connection" },
    baseChat,
  ),
  { type: "blocked", reason: "already-active", label: "Current connection" },
);

assert.deepEqual(
  resolveChatResourceDropAction(
    {
      version: 1,
      kind: "connection",
      ids: ["connection-image"],
      label: "Image connection",
      unsupported: "connection-kind",
    },
    baseChat,
  ),
  { type: "blocked", reason: "connection-kind", label: "Image connection" },
);
assert.deepEqual(
  parseChatResourceDragPayload({
    version: 1,
    kind: "connection",
    ids: ["connection-image"],
    label: "Image connection",
    unsupported: "connection-kind",
  }),
  {
    version: 1,
    kind: "connection",
    ids: ["connection-image"],
    label: "Image connection",
    unsupported: "connection-kind",
  },
);
assert.deepEqual(
  parseChatResourceDragPayload({
    version: 1,
    kind: "connection",
    ids: ["connection-1"],
    label: "Text connection",
    unsupported: "nonsense",
  }),
  { version: 1, kind: "connection", ids: ["connection-1"], label: "Text connection" },
);

// Character drop follow-up: greetings offered after a character lands in the chat.
assert.deepEqual(
  readCharacterGreetings(
    JSON.stringify({
      first_mes: " Hello there ",
      alternate_greetings: ["Hi again", "  ", 7],
      extensions: { dialogueColor: "#ff0000" },
    }),
  ),
  {
    greetings: [
      { text: "Hello there", alternateIndex: null },
      { text: "Hi again", alternateIndex: 1 },
    ],
    dialogueColor: "#ff0000",
  },
);
assert.deepEqual(readCharacterGreetings("not json"), { greetings: [] });
assert.deepEqual(readCharacterGreetings({ alternate_greetings: ["Only alt"] }), {
  greetings: [{ text: "Only alt", alternateIndex: 2 - 1 }],
  dialogueColor: undefined,
});

// The mobile drop dock renders off this state, so begin/clear must both notify subscribers.
{
  const touchPayload = { version: 1 as const, kind: "lorebook" as const, ids: ["lorebook-9"], label: "Lore" };
  let notifications = 0;
  const unsubscribe = subscribeChatResourceTouchDrag(() => {
    notifications += 1;
  });

  assert.equal(getActiveChatResourceTouchDrag(), null);
  beginChatResourceTouchDrag(touchPayload);
  assert.deepEqual(getActiveChatResourceTouchDrag(), touchPayload);
  assert.equal(notifications, 1);

  clearActiveChatResourceDrag();
  assert.equal(getActiveChatResourceTouchDrag(), null);
  assert.equal(notifications, 2);

  // Clearing again must stay quiet, otherwise every desktop drag end re-renders the dock.
  clearActiveChatResourceDrag();
  assert.equal(notifications, 2);

  unsubscribe();
  beginChatResourceTouchDrag(touchPayload);
  assert.equal(notifications, 2);
  clearActiveChatResourceDrag();
}

// The panel the dock closed is restored exactly once, so a later drop cannot reopen it again.
assert.equal(takePendingChatResourcePanelRestore(), null);
setPendingChatResourcePanelRestore("characters");
assert.equal(takePendingChatResourcePanelRestore(), "characters");
assert.equal(takePendingChatResourcePanelRestore(), null);

console.info("Chat resource drop regressions passed.");
