import assert from "node:assert/strict";
import { addAbortListener, getEventListeners } from "node:events";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { setImmediate as nextTurn } from "node:timers/promises";
import { runInNewContext } from "node:vm";
import {
  ROLEPLAY_COMMAND_KEYS,
  isRoleplayCommandEnabled,
  roleplayCommandsEnabled,
} from "../../packages/shared/src/types/roleplay-command.js";
import {
  appendRoleplayPromptTail,
  buildRoleplayCommandsReminder,
  buildRoleplayPersonalContext,
  parseRoleplayCommands,
  readRoleplayPersonalState,
  RoleplayCommandStreamFilter,
} from "../../packages/server/src/services/generation/roleplay-commands.js";
import { collectPastReasoningMetadata } from "../../packages/server/src/services/generation/generation-parameters.js";
import { conversationPromptHistoryContent } from "../../packages/server/src/routes/generate/conversation-prompt-formatting.js";
import { generateRoleplaySoundEffect } from "../../packages/server/src/routes/tts.routes.js";

const cancelledSound = new AbortController();
cancelledSound.abort();
await assert.rejects(
  generateRoleplaySoundEffect(null as never, "Cancelled cue", null, false, cancelledSound.signal),
  { name: "AbortError" },
  "a cancelled sound command must not resolve a connection or start a provider request",
);

// Execute the production entry point with controlled configuration/provider I/O.
// This exercises shared locks and cancellation without a database or a paid audio call.
const soundSource = readFileSync(new URL("../../packages/server/src/routes/tts.routes.ts", import.meta.url), "utf8");
const soundEntry = soundSource.match(/^export async function generateRoleplaySoundEffect\([\s\S]*?^}/m)?.[0];
assert.ok(soundEntry);
type AudioResult = { tag: string; path: string; cached: boolean };
let finishAudio!: (value: AudioResult) => void;
let failAudio!: (error: Error) => void;
const deferredAudio = () =>
  new Promise<AudioResult>((resolve, reject) => {
    finishAudio = resolve;
    failAudio = reject;
  });
let upstreamAudio = deferredAudio();
const sharedAudio = new Map<string, Promise<AudioResult>>();
const audioRequests: unknown[][] = [];
const sound = runInNewContext(
  stripTypeScriptTypes(soundEntry.replace(/^export /, "")) + "\ngenerateRoleplaySoundEffect",
  {
    addAbortListener,
    Promise,
    Symbol,
    createAppSettingsStorage: () => ({}),
    createConnectionsStorage: () => ({}),
    resolveAudioConfig: async () => ({ source: "elevenlabs", elevenLabsGameSoundEffects: true, apiKey: "fixture-key" }),
    normalizeGameAudioPrompt: (prompt: string) => prompt.trim(),
    logDebugOverride: () => {},
    gameAudioGenerationLocks: sharedAudio,
    generateElevenLabsGameAudio: (...args: unknown[]) => {
      audioRequests.push(args);
      return upstreamAudio;
    },
  },
) as typeof generateRoleplaySoundEffect;
const firstSound = new AbortController();
const secondSound = new AbortController();
const firstWait = sound(null as never, "Shared cue", null, false, firstSound.signal);
const secondWait = sound(null as never, "Shared cue", null, false, secondSound.signal);
await nextTurn();
assert.equal(audioRequests.length, 1, "identical cues share a single generation");
assert.equal(audioRequests[0]?.length, 3, "the shared provider work must not receive a caller's signal");
const gameWait = sharedAudio.get("sfx\0shared cue");
assert.ok(gameWait, "Game audio joins the same pending generation");
const cancelledWait = assert.rejects(firstWait, { name: "AbortError" });
firstSound.abort();
await Promise.race([
  cancelledWait,
  nextTurn().then(() => {
    throw new Error("Cancellation must release the caller before audio generation finishes");
  }),
]);
assert.equal(getEventListeners(firstSound.signal, "abort").length, 0);
assert.equal(getEventListeners(secondSound.signal, "abort").length, 1, "the other caller is still waiting");
const audioResult = { tag: "sfx:generated:fixture", path: "sfx/generated/fixture.mp3", cached: false };
finishAudio(audioResult);
assert.deepEqual(await secondWait, audioResult);
assert.deepEqual(await gameWait, audioResult);
assert.equal(sharedAudio.size, 0);
assert.equal(getEventListeners(secondSound.signal, "abort").length, 0, "completed waits remove their abort listener");

upstreamAudio = deferredAudio();
const abandonedSound = new AbortController();
const abandonedWait = sound(null as never, "Abandoned cue", null, false, abandonedSound.signal);
await nextTurn();
const abandonedFailure = assert.rejects(abandonedWait, { name: "AbortError" });
abandonedSound.abort();
await abandonedFailure;
failAudio(new Error("Late provider failure"));
await nextTurn();
assert.equal(sharedAudio.size, 0, "a failure after cancellation clears the lock without an unhandled rejection");

for (const key of ROLEPLAY_COMMAND_KEYS) {
  assert.equal(isRoleplayCommandEnabled({}, key), false);
  assert.equal(isRoleplayCommandEnabled({ roleplayCommandsEnabled: true }, key), false);
  assert.equal(isRoleplayCommandEnabled({ roleplayCommandToggles: { [key]: true } }, key), false);
}
assert.equal(roleplayCommandsEnabled({ roleplayDmCommandsEnabled: true }), true);
assert.equal(isRoleplayCommandEnabled({ roleplayDmCommandsEnabled: true }, "dm"), true);
assert.equal(
  isRoleplayCommandEnabled({ roleplayDmCommandsEnabled: true, roleplayCommandsEnabled: false }, "dm"),
  false,
);
assert.equal(
  isRoleplayCommandEnabled({ roleplayDmCommandsEnabled: true, roleplayCommandToggles: { dm: false } }, "dm"),
  false,
);

const raw =
  'Before [notes: content="I lied about [the key]. Truth: I hid it.\\nMy cover story is \\"lost\\"."] after [memory: id="key", content="Retrieve it at dawn"] the note.';
const parsed = parseRoleplayCommands(raw);
assert.equal(parsed.content, "Before  after  the note.");
assert.equal(parsed.commands.length, 2);
assert.equal(parsed.invalid, 0);
assert.equal(parsed.commands[0]?.type, "notes");
if (parsed.commands[0]?.type === "notes") assert.match(parsed.commands[0].content, /\nMy cover story is "lost"\./u);
// Every possible two-chunk boundary, plus single-character streaming, must keep secrets hidden.
for (let split = 0; split <= raw.length; split++) {
  const filter = new RoleplayCommandStreamFilter();
  assert.equal(filter.push(raw.slice(0, split)) + filter.push(raw.slice(split)) + filter.flush(), parsed.content);
}
const tinyChunks = new RoleplayCommandStreamFilter();
assert.equal([...raw].map((char) => tinyChunks.push(char)).join("") + tinyChunks.flush(), parsed.content);
for (const unfinished of ['[notes: content="secret', "[notes", "[not", '[notes content="secret']) {
  assert.equal(parseRoleplayCommands(`Visible ${unfinished}`).content, "Visible ");
  const filter = new RoleplayCommandStreamFilter();
  assert.equal([...`Visible ${unfinished}`].map((char) => filter.push(char)).join("") + filter.flush(), "Visible ");
}
assert.equal(parseRoleplayCommands("A [normal aside] remains.").content, "A [normal aside] remains.");
assert.equal(parseRoleplayCommands('[notes: content="' + "x".repeat(8001) + '"]').invalid, 1);
assert.equal(
  parseRoleplayCommands('[document: kind="letter", title="Invitation", content="Come at dawn."]').commands[0]?.type,
  "document",
);
const rollText = 'I try the lock. [roll: notation="1d20+3", reason="Need 15"] A made-up outcome.';
const rollFilter = new RoleplayCommandStreamFilter(true);
assert.equal(rollFilter.push(rollText), "I try the lock. ");
assert.equal(rollFilter.rollRequested, true);
assert.equal(rollFilter.push("More invented outcomes"), "");
assert.equal(parseRoleplayCommands(rollText).roll?.command.notation, "1d20+3");

const history = [
  { role: "assistant", characterId: "alice", extra: { roleplayPrivateCommands: parsed.commands } },
  {
    role: "assistant",
    characterId: "bob",
    extra: JSON.stringify({ roleplayPrivateCommands: [{ type: "notes", content: "BOB_SECRET" }] }),
  },
  {
    role: "assistant",
    characterId: "alice",
    extra: {
      roleplayPrivateCommands: [
        { type: "notes", content: "ALICE_LIE: I claimed the door was locked; it was open." },
        { type: "memory", id: "key", content: "ALICE_REMINDER: retrieve the key tonight" },
      ],
    },
  },
];
const alice = readRoleplayPersonalState(history).get("alice")!;
const summarizedNote = { ...history[0], id: "summarized", extra: { ...history[0]!.extra, hiddenFromAI: true } };
assert.equal(readRoleplayPersonalState([summarizedNote], "alice").size, 0);
assert.equal(
  readRoleplayPersonalState([summarizedNote], "alice", new Set(["summarized"])).get("alice")?.reminders.size,
  1,
  "summary-owned hides preserve pending private state",
);
assert.match(alice.notes, /ALICE_LIE/u);
assert.doesNotMatch(alice.notes, /My cover story/u);
assert.equal(alice.reminders.size, 1);
assert.match(alice.reminders.get("key")!, /tonight/u);
const dismissed = readRoleplayPersonalState([
  ...history,
  {
    role: "assistant",
    characterId: "alice",
    extra: { roleplayPrivateCommands: [{ type: "dismiss_notes" }, { type: "dismiss_memory", id: "key" }] },
  },
]);
assert.equal(dismissed.get("alice")?.notes, "");
assert.equal(dismissed.get("alice")?.reminders.size, 0);
assert.equal(
  readRoleplayPersonalState(
    [...history, { role: "user", extra: { conversationStartForCharacterIds: ["alice"] } }],
    "alice",
  ).size,
  0,
);
assert.equal(
  readRoleplayPersonalState(
    [{ ...history[0], extra: { ...history[0]!.extra, hiddenFromAICharacterIds: ["narrator"] } }],
    "narrator",
  ).size,
  0,
);

const metadata = {
  roleplayCommandsEnabled: true,
  roleplayCommandToggles: { notes: true, memory: true, roll: true, illustrate: true, document: true },
  roleplayCommandNarratorId: "narrator",
};
const characters = [
  { id: "alice", name: "Alice" },
  { id: "bob", name: "Bob" },
  { id: "narrator", name: "Narrator" },
];
for (const format of ["xml", "markdown", "none"] as const) {
  const context = (characterId: string, overrides = {}) =>
    buildRoleplayPersonalContext({
      messages: history,
      metadata: { ...metadata, ...overrides },
      characters,
      characterId,
      individual: true,
      format,
    });
  assert.match(context("alice"), /ALICE_LIE/u);
  assert.match(context("alice"), /ALICE_REMINDER/u);
  assert.doesNotMatch(context("alice"), /BOB_SECRET/u);
  assert.match(context("narrator"), /BOB_SECRET/u);
  assert.match(context("narrator"), /ALICE_LIE/u);
  assert.doesNotMatch(context("bob"), /ALICE_LIE/u);
  assert.equal(context("narrator", { roleplayCommandNarratorId: "deleted-character" }), "");
  assert.equal(context("alice", { roleplayCommandsEnabled: false }), "");
  const reminder = buildRoleplayCommandsReminder({
    metadata,
    privateAvailable: true,
    availableAgentIds: new Set(),
    format,
    characterNames: ["Alice"],
  });
  assert.doesNotMatch(reminder, /\[illustrate:/u, "an unavailable image agent must not be offered");
  assert.match(reminder, /LIES, DECEPTIONS/u);
  const section = format === "xml" ? "<commands>" : format === "markdown" ? "## Commands" : "Commands:";
  assert.ok(reminder.startsWith(section));
  const tracker =
    format === "xml"
      ? "<context>\nTRACKER\n</context>"
      : format === "markdown"
        ? "# Context\nTRACKER"
        : "Context:\nTRACKER";
  const messages = [
    { role: "user", content: "Old turn" },
    { role: "assistant", content: "Old response" },
    { role: "user", content: "Latest\n" + tracker },
    { role: "assistant", content: "Prefill" },
  ];
  appendRoleplayPromptTail(messages, context("alice"), reminder, format);
  assert.equal(messages[0]?.content, "Old turn");
  assert.equal(messages[3]?.content, "Prefill");
  assert.ok(messages[2]!.content.indexOf("ALICE_LIE") > messages[2]!.content.indexOf("TRACKER"));
  assert.ok(messages[2]!.content.indexOf(section) > messages[2]!.content.indexOf("ALICE_LIE"));
  if (format === "xml") assert.equal(messages[2]!.content.match(/<context>/gu)?.length, 1);
  if (format === "markdown") assert.match(messages[2]!.content, /### Alice's Personal Notes/u);
}
assert.equal(
  buildRoleplayPersonalContext({
    messages: history,
    metadata,
    characters,
    characterId: "alice",
    individual: false,
    format: "xml",
  }),
  "",
);
const publicMessage = { id: "public", role: "assistant", extra: { thinking: "Public reasoning" } };
const privateMessage = {
  id: "private",
  role: "assistant",
  extra: { thinking: "ALICE_LIE", roleplayPrivateContext: true, encryptedReasoning: ["opaque-secret"] },
};
const reasoning = collectPastReasoningMetadata(
  [publicMessage, privateMessage],
  { excludePastReasoning: false, pastReasoningLimit: 0 },
  "custom",
  "fixture",
);
assert.equal(reasoning.has("public"), true);
assert.equal(reasoning.has("private"), false);
const visibleHistory = conversationPromptHistoryContent(
  {
    role: "assistant",
    content: "She hands you a letter.",
    extra: {
      roleplayDocuments: [{ title: "Letter", content: "Meet at dawn." }],
      roleplayPrivateCommands: [{ type: "notes", content: "ALICE_LIE" }],
    },
  },
  "roleplay",
);
assert.match(visibleHistory, /Meet at dawn/u);
assert.doesNotMatch(visibleHistory, /ALICE_LIE/u);
process.stdout.write("Roleplay commands regression passed.\n");
