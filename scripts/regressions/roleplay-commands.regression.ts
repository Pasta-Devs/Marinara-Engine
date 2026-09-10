import assert from "node:assert/strict";
import { addAbortListener, getEventListeners } from "node:events";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { setImmediate as nextTurn } from "node:timers/promises";
import { runInNewContext } from "node:vm";
import {
  ROLEPLAY_COMMAND_KEYS,
  isRoleplayCommandEnabled,
  isRoleplayCommandAllowed,
  getRoleplayCommandActivity,
  getRoleplayDocuments,
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
import { prepareRoleplayRoll } from "../../packages/server/src/services/generation/roleplay-rolls.js";
import type { RPGStatsConfig } from "../../packages/shared/src/types/character.js";
import { buildCommittedTrackerContextBlock } from "../../packages/server/src/services/generation/committed-tracker-context.js";

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
const remember = (id: string, content = id, characterId = "alice") => ({
  role: "assistant",
  characterId,
  extra: { roleplayPrivateCommands: [{ type: "memory", id, content }] },
});
const threeReminders = [remember("oldest"), remember("second"), remember("third")];
assert.deepEqual(
  [...readRoleplayPersonalState(threeReminders).get("alice")!.reminders.keys()],
  ["oldest", "second", "third"],
);
const overflow = readRoleplayPersonalState([
  ...threeReminders,
  remember("oldest", "updated"),
  remember("fourth"),
  remember("bob-one", "Bob only", "bob"),
]);
assert.deepEqual(
  [...overflow.get("alice")!.reminders.keys()],
  ["second", "third", "fourth"],
  "updating an existing reminder preserves its creation order; the fourth evicts the oldest",
);
assert.equal(overflow.get("bob")!.reminders.size, 1, "the three-reminder cap belongs to each character");
assert.deepEqual(
  [
    ...readRoleplayPersonalState(Array.from({ length: 25 }, (_, index) => remember(String(index))))
      .get("alice")!
      .reminders.keys(),
  ],
  ["22", "23", "24"],
  "legacy history also resolves to the newest three active reminders",
);
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
  assert.equal(
    context("narrator").split("\n\n")[0],
    "Private character state, do not reveal those notes to the reader or treat them as knowledge other characters posses. You are the selected narrator. Use those intentions to create plausible opportunities, obstacles, and consequences. Do not guarantee success, control the players' choices, or expose secrets without in-world discovery. Only change your own notes and reminders.",
  );
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
  assert.doesNotMatch(reminder, /YOUR|LIES|DECEPTIONS|Maximum \d|\n\s*\n\s*-/u);
  assert.match(reminder, /keep it short/iu);
  assert.ok(
    reminder.includes(
      "only up to three reminders can exist at the same time; if you create more, the oldest one will be removed.",
    ),
  );
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
  const committed = buildCommittedTrackerContextBlock({
    chatEnableAgents: true,
    activeAgentIds: ["world-state"],
    latestGameState: { location: "TRACKER_LAB" },
    chatMetadata: {},
    wrapFormat: format,
  });
  assert.ok(committed);
  const separated = [
    { role: "user", content: tracker, contextKind: "history" },
    { role: "user", content: committed, contextKind: "injection" },
    { role: "system", content: "OUTPUT_FORMAT", contextKind: "injection" },
    { role: "user", content: "LATEST_INPUT", contextKind: "history" },
    { role: "assistant", content: "PREFILL", contextKind: "injection" },
  ];
  const privateState = context("narrator") + "\nLiteral $& and $' stay intact.";
  const publicTracker = { ...separated[1] };
  appendRoleplayPromptTail(separated, privateState, reminder, format);
  assert.equal(separated[0]!.content, tracker, "historical Context text must not receive private state");
  assert.ok(separated[1]!.content.includes(privateState), "private state joins the earlier tracker injection verbatim");
  assert.equal(publicTracker.content, committed, "a copied public agent prompt remains private-state free");
  assert.equal(separated[2]!.content, "OUTPUT_FORMAT");
  assert.equal(separated[4]!.content, "PREFILL");
  assert.ok(separated[3]!.content.includes(reminder));
  assert.doesNotMatch(separated[3]!.content, /ALICE_LIE|BOB_SECRET/);
  if (format === "xml") assert.equal(separated[1]!.content.match(/<context>/gu)?.length, 1);
  if (format === "markdown") {
    const customHeading = [
      { role: "user", content: "##Context\nTRACKER", contextKind: "injection" },
      { role: "user", content: "Latest" },
    ];
    appendRoleplayPromptTail(customHeading, privateState, "", format);
    assert.ok(customHeading[0]!.content.includes(privateState));
    assert.equal(customHeading[1]!.content, "Latest");
  }
}
const incompleteContext = "<context>".repeat(20_000);
const malformedMessages = [
  { role: "user", content: incompleteContext, contextKind: "injection" },
  { role: "user", content: "Latest", contextKind: "history" },
];
appendRoleplayPromptTail(malformedMessages, "PRIVATE", "", "xml");
assert.equal(malformedMessages[0]!.content, incompleteContext, "unterminated Context stays untouched");
assert.equal(malformedMessages[1]!.content, "Latest\n\n<context>\nPRIVATE\n</context>");
const surroundedContext = [{ role: "user", content: "</context>\n<context>\nTRACKER\n</context>\nSUFFIX" }];
appendRoleplayPromptTail(surroundedContext, "Literal $&", "", "xml");
assert.equal(surroundedContext[0]!.content, "</context>\n<context>\nTRACKER\nLiteral $&\n</context>\nSUFFIX");
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

const scoped = {
  ...metadata,
  roleplayCommandToggles: { roll: true, combat: true, illustrate: true, document: true },
  roleplayRollAudience: "narrator",
  roleplayCombatAudience: "narrator",
  roleplayDocumentAudience: "narrator",
  activeAgentIds: ["combat", "illustrator"],
};
for (const key of ["roll", "combat", "document"] as const) {
  assert.equal(isRoleplayCommandAllowed(scoped, key, "narrator"), true);
  for (const caller of ["alice", "deleted", null]) assert.equal(isRoleplayCommandAllowed(scoped, key, caller), false);
  assert.equal(
    isRoleplayCommandAllowed(
      { ...scoped, roleplayRollAudience: "all", roleplayCombatAudience: "all", roleplayDocumentAudience: "all" },
      key,
      "alice",
    ),
    true,
  );
}
for (const key of ["illustrate", "combat"] as const) {
  assert.equal(isRoleplayCommandAllowed({ ...scoped, activeAgentIds: [] }, key, "narrator"), false);
}
for (const format of ["xml", "markdown", "none"] as const) {
  const prompt = (characterId: string | null, availableAgentIds = new Set(["illustrator", "combat"])) =>
    buildRoleplayCommandsReminder({
      metadata: scoped,
      characterId,
      privateAvailable: true,
      availableAgentIds,
      format,
      characterNames: ["Alice", "Narrator"],
    });
  assert.match(prompt("narrator"), /\[combat\]/u);
  assert.match(prompt("narrator"), /\[roll: character=/u);
  assert.match(prompt("narrator"), /\[document:/u);
  assert.match(prompt("alice"), /\[illustrate:.*characters=/u);
  assert.match(prompt("alice"), /surprise the user or capture an important moment/u);
  assert.doesNotMatch(prompt("alice"), /\[roll:|\[combat\]|\[document:/u);
  assert.doesNotMatch(prompt(null), /\[roll:|\[combat\]|\[document:/u);
  assert.doesNotMatch(prompt("narrator", new Set()), /\[illustrate:|\[combat\]/u);
  assert.doesNotMatch(prompt("narrator"), /\n\s*\n\s*-/u);
}
const soundtrack = {
  ...metadata,
  roleplayCommandToggles: { music: true },
  enableAgents: true,
  activeAgentIds: ["spotify"],
};
for (const [overrides, allowed] of [
  [{}, true],
  [{ enableAgents: false }, false],
  [{ enableAgents: undefined }, false],
  [{ activeAgentIds: [] }, false],
  [{ roleplayCommandsEnabled: false }, false],
] as const) {
  const selected = { ...soundtrack, ...overrides };
  assert.equal(isRoleplayCommandAllowed(selected, "music", "alice"), allowed);
  for (const installed of [true, false]) {
    const prompt = buildRoleplayCommandsReminder({
      metadata: selected,
      characterId: "alice",
      privateAvailable: true,
      availableAgentIds: new Set(installed ? ["spotify"] : []),
      format: "xml",
      characterNames: ["Alice"],
    });
    assert.equal(prompt.includes("[music:"), allowed && installed);
  }
}
const newSyntax =
  '[combat] [illustrate: subject="The duel" characters="Alice, Narrator"] [roll: character="Alice" notation="d20" attribute="STR" reason="Lift the gate"]';
const scanned = parseRoleplayCommands(newSyntax);
assert.deepEqual(scanned.commands, [
  { type: "combat" },
  { type: "illustrate", subject: "The duel", characters: ["Alice", "Narrator"] },
  { type: "roll", character: "Alice", notation: "d20", attribute: "STR", reason: "Lift the gate" },
]);
assert.equal(scanned.activity.map((item) => item.raw).join(" "), newSyntax);

const attached = parseRoleplayCommands(
  '[notes: content="OLDER_SECRET"] [memory: id="key" content="OLDER_REMINDER"]',
).activity;
const revised = parseRoleplayCommands(
  '[notes: content="NEW_SECRET"] [memory: id="key" content="NEW_REMINDER"] [document: title="Letter" content="DOCUMENT_TEXT"]',
).activity;
const edited = revised.map((item) =>
  item.command.type === "notes" ? { ...item, command: { ...item.command, content: "EDITED_SECRET" } } : item,
);
const currentHistory = (activity: typeof revised) => [
  { role: "assistant", characterId: "alice", extra: { roleplayCommandActivity: attached } },
  { role: "assistant", characterId: "alice", extra: { roleplayCommandActivity: activity } },
];
assert.equal(readRoleplayPersonalState(currentHistory(edited)).get("alice")?.notes, "EDITED_SECRET");
assert.equal(edited[0]?.raw, revised[0]?.raw, "editing context preserves the exact original command");
const removed = revised.map((item) => ({ ...item, deleted: true }));
assert.equal(readRoleplayPersonalState(currentHistory(removed)).get("alice")?.notes, "");
assert.equal(
  readRoleplayPersonalState(currentHistory(removed)).get("alice")?.reminders.size,
  0,
  "deletion must not resurrect previous reminders",
);
assert.deepEqual(getRoleplayDocuments({ roleplayCommandActivity: removed }), []);
const activityHistory = conversationPromptHistoryContent(
  { role: "assistant", content: "Visible story", extra: { roleplayCommandActivity: edited } },
  "roleplay",
);
assert.match(activityHistory, /DOCUMENT_TEXT/u);
assert.doesNotMatch(activityHistory, /NEW_SECRET|EDITED_SECRET|NEW_REMINDER|\[document:|used .* command/u);
assert.equal(
  getRoleplayCommandActivity({
    roleplayCommandActivity: [],
    roleplayPrivateCommands: [{ type: "notes", content: "LEGACY" }],
  }).length,
  0,
);

const diceCharacters: { id: string; name: string; rpgStats?: RPGStatsConfig }[] = [
  {
    id: "dottore",
    name: "Dottore",
    rpgStats: {
      enabled: true,
      hp: { value: 10, max: 10 },
      attributes: [
        { name: "STR", value: 12 },
        { name: "Dexterity", value: 8 },
        { name: "Luck", value: 14 },
      ],
    },
  },
  { id: "mari", name: "Mari" },
];
const dice = (args: Record<string, unknown>) =>
  prepareRoleplayRoll({ notation: "d20", character: "Dottore", ...args }, diceCharacters, "mari");
assert.equal(dice({ attribute: "Strength" }).notation, "d20+1");
assert.equal(dice({ attribute: "STR", notation: "d20+2" }).notation, "d20+3");
assert.equal(dice({ attribute: "DEX" }).notation, "d20-1");
assert.equal(dice({ attribute: "Luck" }).notation, "d20+2");
assert.equal(dice({ attribute: "Unknown" }).notation, "d20");
assert.equal(dice({ character: "Mari", attribute: "Strength" }).notation, "d20");
assert.equal(dice({ character: undefined, attribute: "Strength" }).character, "Mari");
assert.equal(
  prepareRoleplayRoll(
    { notation: "d20", attribute: "STR" },
    [{ ...diceCharacters[0]!, rpgStats: { ...diceCharacters[0]!.rpgStats!, enabled: false } }],
    "dottore",
  ).notation,
  "d20",
);
assert.throws(() => dice({ character: "Nobody", attribute: "Strength" }), /one chat participant/u);
assert.throws(
  () =>
    prepareRoleplayRoll(
      { character: "Dottore", notation: "d20" },
      [...diceCharacters, { id: "copy", name: "Dottore" }],
      "dottore",
    ),
  /one chat participant/u,
);
assert.throws(() => dice({ notation: "1d20+9007199254740971", attribute: "STR" }), /numeric range/u);
process.stdout.write("Roleplay commands regression passed.\n");
