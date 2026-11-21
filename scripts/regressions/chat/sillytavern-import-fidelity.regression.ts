// What a SillyTavern import used to lose: every message got the import time (ST's "March 1, 2025 12:00pm"
// send_date never parsed), the Author's Note and the persona were dropped, and a preset's samplers were thrown
// away. Single-file and folder imports go through the same code, so both are checked.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDB, getDB } from "../../../packages/server/src/db/connection.js";
import { parseTrustedTimestamp } from "../../../packages/server/src/services/import/import-timestamps.js";
import { importSTChat } from "../../../packages/server/src/services/import/st-chat.importer.js";
import {
  importSTPreset,
  readSTPresetParameters,
} from "../../../packages/server/src/services/import/st-prompt.importer.js";
import { runSTBulkImport } from "../../../packages/server/src/services/import/st-bulk.importer.js";
import { createChatsStorage } from "../../../packages/server/src/services/storage/chats.storage.js";
import { createCharactersStorage } from "../../../packages/server/src/services/storage/characters.storage.js";
import { createPromptsStorage } from "../../../packages/server/src/services/storage/prompts.storage.js";

// ── SillyTavern's dates, read in local time like SillyTavern wrote them ──
const local = (...parts: [number, number, number, number, number, number?]) =>
  new Date(parts[0], parts[1], parts[2], parts[3], parts[4], parts[5] ?? 0).toISOString();
assert.equal(parseTrustedTimestamp("March 1, 2025 12:00pm"), local(2025, 2, 1, 12, 0), "noon");
assert.equal(parseTrustedTimestamp("March 1, 2025 12:00am"), local(2025, 2, 1, 0, 0), "midnight");
assert.equal(parseTrustedTimestamp("March 1, 2025 1:05am"), local(2025, 2, 1, 1, 5));
assert.equal(parseTrustedTimestamp("December 31, 2024 11:59 PM"), local(2024, 11, 31, 23, 59));
assert.equal(parseTrustedTimestamp("Sept 3, 2024 4:07pm"), local(2024, 8, 3, 16, 7), "a short month name");
assert.equal(parseTrustedTimestamp("March 1, 2025 13:00"), local(2025, 2, 1, 13, 0), "a 24-hour clock");
assert.equal(parseTrustedTimestamp("2025-03-01@12h00m00s"), local(2025, 2, 1, 12, 0), "ST's create_date");
assert.equal(parseTrustedTimestamp("February 31, 2024 1:00pm"), null, "no roll-over into March");
assert.equal(parseTrustedTimestamp("March 1, 2025 13:00pm"), null, "13 pm is not a time");
assert.equal(parseTrustedTimestamp("2024-05-02T10:00:00.000Z"), "2024-05-02T10:00:00.000Z", "ISO still works");

// ── Preset samplers ──
const presetRead = readSTPresetParameters({
  temperature: 0.85,
  top_p: 0.95,
  top_k: 0,
  min_p: 0.05,
  frequency_penalty: 0.2,
  presence_penalty: 0,
  top_a: 0.1,
  repetition_penalty: 1.1,
  openai_max_tokens: 800,
  openai_max_context: 32000,
  reasoning_effort: "medium",
});
assert.deepEqual(
  presetRead.parameters,
  { temperature: 0.85, topP: 0.95, minP: 0.05, frequencyPenalty: 0.2, reasoningEffort: "medium" },
  "the samplers that differ from Marinara's defaults come in",
);
assert.deepEqual(new Set(presetRead.leftOut), new Set(["maxTokens", "maxContext", "topA", "repetitionPenalty"]));
assert.deepEqual(readSTPresetParameters({ temperature: 9 }).leftOut, ["outOfRange"], "out of range is reported");
assert.deepEqual(readSTPresetParameters({ reasoning_effort: "auto" }).parameters, {}, "auto leaves it to the provider");
assert.deepEqual(
  readSTPresetParameters({ temp: 0.7, rep_pen: 1.2, genamt: 300 }),
  { parameters: { temperature: 0.7 }, leftOut: ["maxTokens", "repetitionPenalty"] },
  "Text Completion preset names",
);

const db = await getDB();
const chats = createChatsStorage(db);
const characters = createCharactersStorage(db);
const scratch = await mkdtemp(join(tmpdir(), "st-import-fidelity-"));

const jsonl = (header: Record<string, unknown>, messages: Array<Record<string, unknown>>) =>
  [header, ...messages].map((line) => JSON.stringify(line)).join("\n");
const sampleMessages = [
  { name: "Alice", is_user: false, send_date: "March 1, 2025 12:00pm", mes: "Hello there." },
  { name: "Sam", is_user: true, send_date: "March 1, 2025 12:01pm", mes: "Hi!" },
  { name: "Alice", is_user: false, send_date: "March 1, 2025 12:01pm", mes: "Same minute." },
];
const metadataOf = async (chatId: string) => {
  const row = await chats.getById(chatId);
  return JSON.parse(String(row?.metadata ?? "{}")) as Record<string, unknown>;
};

try {
  const sam = await characters.createPersona("Sam", "The user.");
  assert.ok(sam);

  // ── One chat file: dates, Author's Note, persona ──
  const single = await importSTChat(
    jsonl(
      {
        user_name: "Sam",
        character_name: "Alice",
        chat_metadata: { note_prompt: "Keep it short.", note_depth: 2, note_interval: 1, note_position: 1 },
      },
      sampleMessages,
    ),
    db,
    {},
  );
  assert.ok("chatId" in single && single.chatId, JSON.stringify(single));
  const messages = await chats.listMessages(single.chatId!);
  assert.equal(messages[0]!.createdAt, local(2025, 2, 1, 12, 0), "the first message keeps ST's date");
  assert.equal(messages[1]!.createdAt, local(2025, 2, 1, 12, 1));
  assert.ok(messages[2]!.createdAt > messages[1]!.createdAt, "a shared minute still keeps file order");
  const singleChat = await chats.getById(single.chatId!);
  assert.equal(singleChat?.personaId, sam!.id, "the persona named like ST's user is attached");
  const singleMeta = await metadataOf(single.chatId!);
  assert.equal(singleMeta.authorNotes, "Keep it short.");
  assert.equal(singleMeta.authorNotesDepth, 2);
  assert.equal(singleMeta.sillyTavernAuthorsNote, undefined, "a default placement needs no note");
  assert.deepEqual(single.importNotes, [{ kind: "authorsNote" }, { kind: "persona", name: "Sam" }]);

  // A note placed differently comes in and says so; one SillyTavern turned off stays off.
  const placed = await importSTChat(
    jsonl(
      { user_name: "Nobody Here", character_name: "Alice", chat_metadata: { note_prompt: "Odd.", note_interval: 3 } },
      sampleMessages,
    ),
    db,
    {},
  );
  assert.ok("chatId" in placed && placed.chatId);
  const placedMeta = await metadataOf(placed.chatId!);
  assert.equal(placedMeta.authorNotes, "Odd.");
  assert.equal(placedMeta.authorNotesDepth, 4, "ST's default depth");
  assert.deepEqual(placedMeta.sillyTavernAuthorsNote, { prompt: "Odd.", depth: 4, interval: 3, position: 1, role: 0 });
  assert.equal((await chats.getById(placed.chatId!))?.personaId ?? null, null, "no persona of that name");
  assert.deepEqual(placed.importNotes, [
    { kind: "authorsNotePlacement" },
    { kind: "personaMissing", name: "Nobody Here" },
  ]);

  const off = await importSTChat(
    jsonl(
      { user_name: "User", character_name: "Alice", chat_metadata: { note_prompt: "Off.", note_interval: 0 } },
      sampleMessages,
    ),
    db,
    {},
  );
  assert.ok("chatId" in off && off.chatId);
  const offMeta = await metadataOf(off.chatId!);
  assert.equal(offMeta.authorNotes, undefined, "a note turned off in ST is not switched on");
  assert.deepEqual(off.importNotes, [{ kind: "authorsNoteOff" }], "the default 'User' name is not reported");

  // An explicit persona (a chat imported into an existing group) is kept, even when it is none.
  const explicit = await importSTChat(jsonl({ user_name: "Sam", character_name: "Alice" }, sampleMessages), db, {
    personaId: null,
  });
  assert.ok("chatId" in explicit && explicit.chatId);
  assert.equal((await chats.getById(explicit.chatId!))?.personaId ?? null, null);

  // ── One preset file ──
  const preset = await importSTPreset({ name: "Samplers", temperature: 0.6, top_p: 0.9, prompts: [] }, db);
  assert.ok("presetId" in preset && preset.presetId);
  assert.deepEqual(preset.parametersImported, ["temperature", "topP"]);
  const storedPreset = await createPromptsStorage(db).getById(preset.presetId!);
  const storedParameters = JSON.parse(String(storedPreset?.parameters ?? "{}")) as Record<string, unknown>;
  assert.equal(storedParameters.temperature, 0.6);
  assert.equal(storedParameters.topP, 0.9);

  // ── A SillyTavern folder: persona lock, dates, notes and preset settings in the report ──
  const dataDir = join(scratch, "SillyTavern", "data", "default-user");
  await mkdir(join(dataDir, "characters"), { recursive: true });
  await mkdir(join(dataDir, "chats", "Alice"), { recursive: true });
  await mkdir(join(dataDir, "User Avatars"), { recursive: true });
  await mkdir(join(dataDir, "OpenAI Settings"), { recursive: true });
  await writeFile(join(dataDir, "User Avatars", "user-robin.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  await writeFile(
    join(dataDir, "settings.json"),
    JSON.stringify({ power_user: { personas: { "user-robin.png": "Robin" }, persona_descriptions: {} } }),
  );
  // The header's user name is stale; the persona lock names the avatar file.
  await writeFile(
    join(dataDir, "chats", "Alice", "Alice - 2025-03-01@12h00m00s.jsonl"),
    jsonl(
      {
        user_name: "Old Name",
        character_name: "Alice",
        chat_metadata: { persona: "user-robin.png", note_prompt: "Folder note.", note_depth: 1 },
      },
      sampleMessages,
    ),
  );
  await writeFile(
    join(dataDir, "OpenAI Settings", "Mine.json"),
    JSON.stringify({ temperature: 0.7, top_a: 0.2, openai_max_tokens: 500, prompts: [] }),
  );
  const result = await runSTBulkImport(
    join(scratch, "SillyTavern"),
    {
      characters: true,
      chats: true,
      groupChats: true,
      presets: true,
      lorebooks: true,
      backgrounds: true,
      personas: true,
    },
    db,
  );
  assert.equal(result.success, true, JSON.stringify(result));
  assert.deepEqual(result.errors, []);
  assert.equal(result.imported.personas, 1);
  assert.equal(result.imported.chats, 1);
  assert.equal(result.report?.personasLinked, 1, JSON.stringify(result.report));
  assert.equal(result.report?.authorsNotes, 1);
  assert.equal(result.report?.presetsWithSettings, 1);
  assert.deepEqual(new Set(result.report?.presetSettingsLeftOut), new Set(["topA", "maxTokens"]));

  const robin = (await characters.listPersonas()).find((persona) => persona.name === "Robin");
  assert.ok(robin, "the persona came in before the chats");
  const folderChat = (await chats.list()).find(
    (chat) => JSON.parse(String(chat.metadata ?? "{}")).authorNotes === "Folder note.",
  );
  assert.ok(folderChat, "the folder chat kept its Author's Note");
  assert.equal(folderChat!.personaId, robin!.id, "linked through SillyTavern's persona lock");
  const folderMessages = await chats.listMessages(folderChat!.id);
  assert.equal(folderMessages[0]!.createdAt, local(2025, 2, 1, 12, 0), "folder imports keep ST's dates too");

  console.log("sillytavern import fidelity: OK");
} finally {
  await rm(scratch, { recursive: true, force: true });
  await closeDB();
}
