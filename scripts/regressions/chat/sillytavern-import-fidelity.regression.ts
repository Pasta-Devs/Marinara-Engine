// What a SillyTavern import used to lose: every message got the import time (ST's "March 1, 2025 12:00pm"
// send_date never parsed), the Author's Note and the persona were dropped, and a preset's samplers were thrown
// away. Single-file and folder imports go through the same code, so both are checked.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDB, getDB } from "../../../packages/server/src/db/connection.js";
import { parseTrustedTimestamp } from "../../../packages/server/src/services/import/import-timestamps.js";
import {
  importSTChat,
  stChatFileFingerprint,
  stChatNameFromFileName,
} from "../../../packages/server/src/services/import/st-chat.importer.js";
import {
  importSTPreset,
  readSTPresetParameters,
} from "../../../packages/server/src/services/import/st-prompt.importer.js";
import { runSTBulkImport } from "../../../packages/server/src/services/import/st-bulk.importer.js";
import { createChatsStorage } from "../../../packages/server/src/services/storage/chats.storage.js";
import { createCharactersStorage } from "../../../packages/server/src/services/storage/characters.storage.js";
import { createPromptsStorage } from "../../../packages/server/src/services/storage/prompts.storage.js";
import { importSTLorebook } from "../../../packages/server/src/services/import/st-lorebook.importer.js";
import { createLorebooksStorage } from "../../../packages/server/src/services/storage/lorebooks.storage.js";
import { createRegexScriptsStorage } from "../../../packages/server/src/services/storage/regex-scripts.storage.js";

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
assert.equal(parseTrustedTimestamp("March 1, 2025 1:99pm"), null, "no minute roll-over");
assert.equal(parseTrustedTimestamp("March 1, 2025 1:05:60pm"), null, "no second roll-over");
assert.equal(parseTrustedTimestamp("February 31, 2024 1:00 PM"), null, "not handed to new Date() either");
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

  // SillyTavern 1.16 writes "unused" in the header; the user's own messages name them.
  const unused = await importSTChat(jsonl({ user_name: "unused", character_name: "Alice" }, sampleMessages), db, {});
  assert.ok("chatId" in unused && unused.chatId);
  assert.equal((await chats.getById(unused.chatId!))?.personaId, sam!.id, '"unused" falls back to the messages');
  const lateUser = await importSTChat(
    jsonl({ user_name: "unused", character_name: "Alice" }, [
      ...Array.from({ length: 199 }, (_, index) => ({
        name: "Alice",
        is_user: false,
        send_date: "March 1, 2025 12:00pm",
        mes: `Line ${index}.`,
      })),
      { name: "Sam", is_user: true, send_date: "March 1, 2025 12:05pm", mes: "Finally." },
    ]),
    db,
    {},
  );
  assert.ok("chatId" in lateUser && lateUser.chatId);
  assert.equal((await chats.getById(lateUser.chatId!))?.personaId, sam!.id, "a late first user message still counts");
  assert.deepEqual(lateUser.importNotes, [{ kind: "persona", name: "Sam" }]);

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

  // ── Round 2: hidden messages stay hidden, and keep their speaker ──
  const hidden = await importSTChat(
    jsonl({ user_name: "Sam", character_name: "Alice" }, [
      { name: "Alice", is_user: false, mes: "Seen." },
      { name: "Alice", is_user: false, is_system: true, mes: "Hidden reply." },
      { name: "Sam", is_user: true, is_system: true, mes: "Hidden note." },
      // A Marinara export writes the role; is_system there is a real system message.
      { name: "System", is_user: false, is_system: true, role: "system", mes: "Exported system line." },
    ]),
    db,
    {},
  );
  assert.ok("chatId" in hidden && hidden.chatId);
  const hiddenMessages = await chats.listMessages(hidden.chatId!);
  const extraOf = (message: { extra?: unknown }) =>
    (typeof message.extra === "string" ? JSON.parse(message.extra) : (message.extra ?? {})) as Record<string, unknown>;
  assert.equal(hiddenMessages[1]!.role, "assistant", "a hidden AI reply stays the character's");
  assert.equal(extraOf(hiddenMessages[1]!).hiddenFromAI, true);
  assert.equal(hiddenMessages[2]!.role, "user", "a hidden user message stays the user's");
  assert.equal(extraOf(hiddenMessages[2]!).hiddenFromAI, true);
  assert.equal(hiddenMessages[3]!.role, "system", "an exported system message keeps its role");
  assert.notEqual(extraOf(hiddenMessages[3]!).hiddenFromAI, true);
  assert.ok(hidden.importNotes?.some((note) => note.kind === "hiddenMessages" && note.count === 2));

  // ── Round 2: the file's own mode wins; a plain log never becomes a game ──
  const asGame = await importSTChat(jsonl({ character_name: "Alice" }, sampleMessages), db, { modeFallback: "game" });
  assert.equal("mode" in asGame && asGame.mode, "roleplay", "the Game tab can't make a game of a plain log");
  const asConversation = await importSTChat(jsonl({ character_name: "Alice" }, sampleMessages), db, {
    modeFallback: "conversation",
  });
  assert.equal("mode" in asConversation && asConversation.mode, "conversation", "the picked type applies");
  const ownMode = await importSTChat(
    jsonl({ character_name: "Alice", chat_metadata: { mode: "conversation" } }, sampleMessages),
    db,
    { modeFallback: "roleplay" },
  );
  assert.equal("mode" in ownMode && ownMode.mode, "conversation", "a file that names its mode keeps it");

  // ── Round 2: a SillyTavern group answers one member at a time: Individual, in ST's order ──
  const group = await importSTChat(jsonl({ character_name: "Group" }, sampleMessages), db, {
    speakerMap: { Alice: "alice-id", Bob: "bob-id" },
    stGroupActivationStrategy: 1,
  });
  assert.ok("chatId" in group && group.chatId);
  const groupMeta = await metadataOf(group.chatId!);
  assert.equal(groupMeta.groupChatMode, "individual");
  assert.equal(groupMeta.groupResponseOrder, "sequential", "ST's list order goes in turn");
  assert.ok(group.importNotes?.some((note) => note.kind === "groupIndividual"));

  // ── Round 2: a SillyTavern preset keeps its shape and names what it can't keep ──
  const shaped = await importSTPreset(
    {
      name: "Shaped",
      assistant_prefill: "Sure,",
      squash_system_messages: false,
      impersonation_prompt: "[Write as {{user}}, tersely.]",
      new_chat_prompt: "[Start a new Chat]",
      names_behavior: 2,
      wi_format: "[World: {0}]",
      prompts: [
        { identifier: "chatHistory", name: "Chat History", marker: true },
        { identifier: "jailbreak", name: "Post-History Instructions", role: "system", content: "Stay in character." },
      ],
      prompt_order: [
        {
          character_id: 100001,
          order: [
            { identifier: "chatHistory", enabled: true },
            { identifier: "jailbreak", enabled: true },
          ],
        },
      ],
    },
    db,
  );
  assert.ok("presetId" in shaped && shaped.presetId);
  const shapedRow = await createPromptsStorage(db).getById(shaped.presetId!);
  assert.equal(shapedRow?.wrapFormat, "none", "SillyTavern sends plain text, no section tags");
  const shapedParameters = JSON.parse(String(shapedRow?.parameters ?? "{}")) as Record<string, unknown>;
  assert.equal(shapedParameters.assistantPrefill, "Sure,");
  assert.equal(shapedParameters.squashSystemMessages, false);
  assert.deepEqual(
    new Set(shaped.parametersLeftOut),
    new Set(["impersonationPrompt", "namesBehavior", "formatTemplates", "postHistoryRole"]),
    "a default new-chat prompt is not worth naming",
  );
  const shapedSections = await createPromptsStorage(db).listSections(shaped.presetId!);
  const postHistory = shapedSections.find((section) => section.identifier === "jailbreak");
  assert.equal(postHistory?.role, "system", "Post-History keeps the file's role");
  assert.equal(postHistory?.injectionPosition, "depth");

  // ── Round 2: World Info positions, recursion and tags ──
  const book = await importSTLorebook(
    {
      name: "Saltmarsh",
      entries: {
        0: {
          uid: 0,
          key: ["smuggler"],
          comment: "Smugglers",
          content: "x",
          position: 2,
          order: 100,
          depth: 1,
          role: 1,
        },
        1: { uid: 1, key: ["tide"], comment: "Tides", content: "x", position: 3, order: 100 },
        2: { uid: 2, key: ["example"], comment: "Example voice", content: "x", position: 5 },
        3: { uid: 3, key: ["Lighthouse"], comment: "Lighthouse", content: "An old house by the sea.", position: 0 },
        4: { uid: 4, key: ["guild"], comment: "Thieves' Guild", content: "x", position: 0, preventRecursion: true },
      },
    },
    db,
  );
  assert.deepEqual(book.notes, [
    { kind: "positionMoved", from: "authorsNote", count: 2 },
    { kind: "positionMoved", from: "exampleMessages", count: 1 },
  ]);
  const entries = (await createLorebooksStorage(db).listEntries(book.lorebookId)) as unknown as Array<
    Record<string, unknown>
  >;
  const entry = (name: string) => entries.find((candidate) => candidate.name === name)!;
  assert.equal(entry("Smugglers").position, 2, "Before Author's Note goes in at depth");
  assert.equal(entry("Smugglers").depth, 4, "at depth 4, where SillyTavern puts the note");
  assert.equal(entry("Smugglers").role, "system");
  assert.equal(entry("Tides").order, 101, "After Author's Note lands just behind Before");
  assert.equal(entry("Example voice").position, 1, "around the examples: after the character definitions");
  assert.equal(entry("Lighthouse").tag, "", "no faction guess from 'house' inside a word or the content");
  assert.equal(entry("Thieves' Guild").tag, "faction");
  assert.equal(Boolean(entry("Lighthouse").preventRecursion), false, "absent recursion stays off, as in ST");
  assert.equal(Boolean(entry("Thieves' Guild").preventRecursion), true);

  // ── Round 2: the folder brings global regex and names what has no counterpart ──
  const dataDir2 = join(scratch, "ST2", "data", "default-user");
  await mkdir(join(dataDir2, "QuickReplies"), { recursive: true });
  await mkdir(join(dataDir2, "instruct"), { recursive: true });
  await writeFile(join(dataDir2, "QuickReplies", "Set.json"), "{}");
  await writeFile(join(dataDir2, "instruct", "ChatML.json"), "{}");
  await mkdir(join(dataDir2, "characters"), { recursive: true });
  await writeFile(
    join(dataDir2, "settings.json"),
    JSON.stringify({
      extension_settings: {
        regex: [
          {
            scriptName: "Strip OOC",
            findRegex: "/\\(OOC:[^)]*\\)/g",
            replaceString: "",
            trimStrings: [" "],
            placement: [2],
          },
          { scriptName: "Lore only", findRegex: "/x/g", replaceString: "", placement: [5] },
        ],
      },
    }),
  );

  // ── Round 3: World Info (before) and (after) keep their own places ──
  const wiPrompts = [
    { identifier: "main", name: "Main Prompt", role: "system", content: "Main." },
    { identifier: "worldInfoBefore", name: "World Info (before)", marker: true },
    { identifier: "charDescription", name: "Char Description", marker: true },
    { identifier: "scenario", name: "Scenario", marker: true },
    { identifier: "worldInfoAfter", name: "World Info (after)", marker: true },
    { identifier: "chatHistory", name: "Chat History", marker: true },
  ];
  const wiOrder = (afterEnabled: boolean, ids = wiPrompts.map((prompt) => prompt.identifier)) => [
    {
      character_id: 100001,
      order: ids.map((identifier) => ({
        identifier,
        enabled: identifier === "worldInfoAfter" ? afterEnabled : true,
      })),
    },
  ];
  const sectionShape = async (presetId: string) =>
    (await createPromptsStorage(db).listSections(presetId)).map((section) => [
      section.name,
      section.markerConfig ? (JSON.parse(String(section.markerConfig)) as { type: string }).type : null,
      String(section.enabled) === "true",
    ]);
  const split = await importSTPreset({ name: "Split WI", prompts: wiPrompts, prompt_order: wiOrder(true) }, db);
  assert.ok("presetId" in split && split.presetId);
  assert.equal(split.worldInfo, "split");
  assert.deepEqual(await sectionShape(split.presetId!), [
    ["Main Prompt", null, true],
    ["World Info (before)", "world_info_before", true],
    ["Character Info", "character", true],
    ["World Info (after)", "world_info_after", true],
    ["Chat History", "chat_history", true],
  ]);
  const afterOff = await importSTPreset({ name: "After off", prompts: wiPrompts, prompt_order: wiOrder(false) }, db);
  assert.ok("presetId" in afterOff && afterOff.presetId);
  assert.equal(afterOff.worldInfo, "afterOff");
  assert.deepEqual((await sectionShape(afterOff.presetId!))[3], ["World Info (after)", "world_info_after", false]);
  // An older preset that lists only one World Info spot keeps one combined section, so no entries are lost.
  const combined = await importSTPreset(
    {
      name: "One WI",
      prompts: wiPrompts,
      prompt_order: wiOrder(true, ["main", "worldInfoBefore", "charDescription", "scenario", "chatHistory"]),
    },
    db,
  );
  assert.ok("presetId" in combined && combined.presetId);
  assert.equal(combined.worldInfo, "combined");
  const combinedShape = await sectionShape(combined.presetId!);
  assert.deepEqual(
    combinedShape.filter(([, type]) => type === "lorebook" || String(type).startsWith("world_info")),
    [["World Info", "lorebook", true]],
  );

  const folder2 = await runSTBulkImport(
    join(scratch, "ST2"),
    {
      characters: true,
      chats: true,
      groupChats: true,
      presets: true,
      lorebooks: true,
      backgrounds: true,
      personas: true,
      regexScripts: true,
    },
    db,
  );
  assert.equal(folder2.success, true, JSON.stringify(folder2));
  assert.equal(folder2.imported.regexScripts, 1);
  assert.equal(folder2.report?.regexSkipped, 1, "the World Info-only script is named, not dropped quietly");
  assert.deepEqual(folder2.report?.notBroughtOver, { quickReplies: 1, instruct: 1, context: 0, systemPrompts: 0 });
  const stripOoc = (await createRegexScriptsStorage(db).list()).find((script) => script.name === "Strip OOC");
  assert.equal(stripOoc?.trimScope, "match", "SillyTavern scripts trim only the matched text");

  // ── Round 3: a folder import after single imports doesn't copy what's already here ──
  const dir3 = join(scratch, "ST3", "data", "default-user");
  await mkdir(join(dir3, "chats", "Ilse Marrow"), { recursive: true });
  await mkdir(join(dir3, "User Avatars"), { recursive: true });
  await mkdir(join(dir3, "characters"), { recursive: true });
  await writeFile(join(dir3, "User Avatars", "user-sam.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  await writeFile(join(dir3, "User Avatars", "user-wren.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  await writeFile(
    join(dir3, "settings.json"),
    JSON.stringify({
      power_user: { personas: { "user-sam.png": "Sam", "user-wren.png": "Wren" }, persona_descriptions: {} },
    }),
  );
  const ilseHeader = { user_name: "Sam", character_name: "Ilse Marrow", chat_metadata: { persona: "user-sam.png" } };
  const ilseFile = "Ilse Marrow - 2025-3-1@12h00m00s.jsonl";
  const ilseText = jsonl(ilseHeader, sampleMessages);
  await writeFile(join(dir3, "chats", "Ilse Marrow", ilseFile), ilseText);
  await writeFile(
    join(dir3, "chats", "Ilse Marrow", "Ilse Marrow - Beach date.jsonl"),
    jsonl(ilseHeader, [{ name: "Ilse Marrow", is_user: false, mes: "The tide is out." }]),
  );
  await writeFile(
    join(dir3, "chats", "Ilse Marrow", "New Chat.jsonl"),
    jsonl(ilseHeader, [{ name: "Ilse Marrow", is_user: false, mes: "Hello again." }]),
  );
  // The single import (POST /import/st-chat) stores the file's fingerprint and names the chat after the file.
  assert.equal(stChatNameFromFileName(ilseFile), "Ilse Marrow - 2025-3-1@12h00m00s");
  const singleIlse = await importSTChat(ilseText.replace(/\n/g, "\r\n"), db, {
    chatName: stChatNameFromFileName(ilseFile),
    sourceFingerprint: stChatFileFingerprint(ilseText.replace(/\n/g, "\r\n")),
  });
  assert.ok("chatId" in singleIlse && singleIlse.chatId);
  const personasBefore = (await characters.listPersonas()).filter((persona) => persona.name === "Sam").length;
  const all3 = {
    characters: true,
    chats: true,
    groupChats: true,
    presets: true,
    lorebooks: true,
    backgrounds: true,
    personas: true,
  } as const;
  const folder3 = await runSTBulkImport(join(scratch, "ST3"), all3, db);
  assert.equal(folder3.success, true, JSON.stringify(folder3));
  assert.deepEqual(folder3.errors, []);
  assert.equal(folder3.skipped?.chats, 1, "the chat imported on its own (CRLF and all) is already here");
  assert.equal(folder3.skipped?.personas, 1);
  assert.deepEqual(folder3.report?.personasAlreadyHere, ["Sam"]);
  assert.equal(folder3.imported.personas, 1, "Wren is new");
  assert.equal(folder3.imported.chats, 2);
  assert.equal(
    (await characters.listPersonas()).filter((persona) => persona.name === "Sam").length,
    personasBefore,
    "no second Sam",
  );
  const chatNamed = async (name: string) => (await chats.list()).find((chat) => chat.name === name);
  const beach = await chatNamed("Ilse Marrow - Beach date");
  assert.ok(beach, "a folder chat is named after its SillyTavern file");
  assert.equal(beach!.personaId, sam!.id, "the persona lock links to the Sam already here");
  const placeholder = (await chats.list()).find(
    (chat) => JSON.parse(String(chat.metadata ?? "{}")).branchName === "New Chat",
  );
  assert.equal(placeholder?.name, "Ilse Marrow", "a placeholder file name falls back to the character's");
  // Running it again skips everything; with Skip off, everything comes in again.
  const again3 = await runSTBulkImport(join(scratch, "ST3"), all3, db);
  assert.equal(again3.skipped?.chats, 3);
  assert.equal(again3.skipped?.personas, 2);
  assert.equal(again3.imported.chats + again3.imported.personas, 0);
  const noSkip3 = await runSTBulkImport(join(scratch, "ST3"), { ...all3, skipAlreadyImported: false }, db);
  assert.equal(noSkip3.imported.chats, 3);
  assert.equal(noSkip3.imported.personas, 2);

  console.log("sillytavern import fidelity: OK");
} finally {
  await rm(scratch, { recursive: true, force: true });
  await closeDB();
}
