/**
 * Classic Chat Summary in a merged group chat (#7252). A merged reply may voice anyone present, so a
 * section that depends on the character is checked for each present character and marked with who
 * knows it, as Advanced Memory does since #7239. Narrator-only sections stay out. Text outside every
 * condition keeps its usual reading, {{char}} included. A chosen responder does not pin a merged reply
 * to one speaker, so it still marks. Individual mode, impersonation and single-character chats read the
 * summary as on staging, except that a section for someone else leaves no empty line (Mari, 2026-10-14).
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-merged-summary-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { assemblePrompt, appendFallbackChatSummaryToSystemPrompt } =
  await import("../../packages/server/src/services/prompt/assembler.js");
const { buildPromptMacroContext, resolveCharacterMacroData } =
  await import("../../packages/server/src/services/prompt/macro-context.js");
const { characterDataSchema, resolveDeferredCharacterMacros } = await import("../../packages/shared/src/index.js");

const SUMMARY = [
  "{{user}} and {{char}} reached the harbor.",
  '{{#if char == "Maukie"}}{{char}} hid the compass.{{/if}}',
  '{{#if char == "Maukie" || char == "Pantalone"}}The travelers kept the compass promise.{{/if}}',
  '{{#if char == "Narrator"}}NARRATOR_ONLY The storm was planned.{{/if}}',
  '{{#if char == "Pantalone"}}Pantalone owes Cara a debt.{{else}}Nobody mentions the debt.{{/if}}',
  '{{#if char == "Pantalone" && getvar::ready == "yes"}}MIXED_SECRET{{/if}}',
].join("\n");
const MAIN = "<main>\n    Write the next reply.\n</main>\n\n";

const db = await getDB();
try {
  const characters = createCharactersStorage(db);
  // The narrator comes first in chat order, so staging read the whole summary as the narrator.
  const narrator = await characters.create(characterDataSchema.parse({ name: "Narrator" }));
  const maukie = await characters.create(characterDataSchema.parse({ name: "Maukie" }));
  const pantalone = await characters.create(characterDataSchema.parse({ name: "Pantalone" }));
  const all = [narrator.id, maukie.id, pantalone.id];
  const profiles = (await resolveCharacterMacroData(db, all)).profilesById;
  const section = (overrides: Record<string, unknown>) => ({
    presetId: "merged-summary",
    content: "",
    role: "system",
    enabled: "true",
    isMarker: "false",
    groupId: null,
    markerConfig: null,
    injectionPosition: "ordered",
    injectionDepth: 0,
    injectionOrder: 0,
    forbidOverrides: "false",
    skipWrap: "false",
    ...overrides,
  });
  // `marker` places the summary with a chat_summary marker; without one it is appended to the system block.
  const summaryBlock = async (characterIds: string[], marker: boolean, extra: Record<string, unknown> = {}) =>
    (
      await assemblePrompt({
        db,
        preset: {
          id: "merged-summary",
          name: "Merged Summary",
          sectionOrder: JSON.stringify(marker ? ["main", "summary", "history"] : ["main", "history"]),
          groupOrder: "[]",
          wrapFormat: "xml",
          parameters: "{}",
          variableGroups: "[]",
          variableValues: "{}",
        },
        sections: [
          section({ id: "main", identifier: "main", name: "Main", content: "Write the next reply." }),
          section({
            id: "summary",
            identifier: "chat_summary",
            name: "Chat Summary",
            isMarker: "true",
            markerConfig: JSON.stringify({ type: "chat_summary" }),
            injectionOrder: 1,
          }),
          section({
            id: "history",
            identifier: "chatHistory",
            name: "Chat History",
            isMarker: "true",
            markerConfig: JSON.stringify({ type: "chat_history" }),
            injectionOrder: 2,
          }),
        ],
        groups: [],
        choiceBlocks: [],
        chatChoices: {},
        chatId: "merged-summary",
        characterIds,
        groupCharacterIds: all,
        personaName: "Mari",
        personaDescription: "",
        localVariables: { ready: "yes" },
        chatMessages: [{ role: "user", content: "Where are we?" }],
        chatSummary: SUMMARY,
        enableAgents: false,
        ...extra,
      })
    ).messages[0]!.content;

  const readers = [profiles.get(maukie.id)!, profiles.get(pantalone.id)!];
  const merged =
    MAIN +
    "<chat_summary>\n" +
    "    Mari and Narrator reached the harbor.\n" +
    "    [Known only to Maukie: Maukie hid the compass.]\n" +
    "    The travelers kept the compass promise.\n" +
    "    [Known only to Pantalone: Pantalone owes Cara a debt.]\n" +
    "    [Known only to Maukie: Nobody mentions the debt.]\n" +
    "    [Known only to Pantalone: MIXED_SECRET]\n" +
    "</chat_summary>";
  for (const marker of [true, false]) {
    assert.equal(
      await summaryBlock(all, marker, { chatSummaryReaders: readers }),
      merged,
      `a merged summary marks who knows each private section and leaves out the narrator's (marker: ${marker})`,
    );
  }

  // A merged chat of the narrator and one character reads every section as that character, unmarked.
  assert.equal(
    await summaryBlock([narrator.id, maukie.id], true, { chatSummaryReaders: [profiles.get(maukie.id)!] }),
    MAIN +
      "<chat_summary>\n    Mari and Narrator reached the harbor.\n    Maukie hid the compass.\n" +
      "    The travelers kept the compass promise.\n    Nobody mentions the debt.\n</chat_summary>",
    "the narrator-and-Maukie summary is read as Maukie",
  );

  // Preset-less generation appends the summary through the same reading.
  const mergedCtx = await buildPromptMacroContext({
    db,
    characterIds: all,
    personaName: "Mari",
    localVariables: { ready: "yes" },
  });
  assert.equal(
    appendFallbackChatSummaryToSystemPrompt([], SUMMARY, "xml", mergedCtx, undefined, readers)[0]!.content,
    merged.slice(MAIN.length),
    "a preset-less merged prompt marks the same sections",
  );

  // ponytail ceiling: a summary with a group block keeps the single reading rather than splitting the block.
  const groupBlock = '[\n{{#if char == "Maukie"}}{{char}} waves.{{/if}}\n]';
  assert.equal(
    appendFallbackChatSummaryToSystemPrompt([], groupBlock, "xml", mergedCtx, undefined, readers)[0]!.content,
    appendFallbackChatSummaryToSystemPrompt([], groupBlock, "xml", mergedCtx)[0]!.content,
    "a group block in the summary is left to the usual per-character repeat",
  );

  // Exact output without readers: Individual mode (deferred, or one chosen speaker) and solo chats. Each
  // section that fills its own line takes the line break before it along, so a hidden one leaves no empty line.
  const individual =
    MAIN +
    "<chat_summary>\n    Mari and \u001eMARINARA_DEFERRED_CHARACTER_CHAR\u001f reached the harbor." +
    "\u001eMARINARA_DEFERRED_CHARACTER_IF:%7B%22branches%22%3A%5B%7B%22condition%22%3A%22char%20%3D%3D%20%5C%22Maukie%5C%22%22%2C%22content%22%3A%22%7B%7Bnoop%7D%7D%5Cn%7B%7Bchar%7D%7D%20hid%20the%20compass.%22%7D%5D%7D\u001f" +
    "\u001eMARINARA_DEFERRED_CHARACTER_IF:%7B%22branches%22%3A%5B%7B%22condition%22%3A%22char%20%3D%3D%20%5C%22Maukie%5C%22%20%7C%7C%20char%20%3D%3D%20%5C%22Pantalone%5C%22%22%2C%22content%22%3A%22%7B%7Bnoop%7D%7D%5CnThe%20travelers%20kept%20the%20compass%20promise.%22%7D%5D%7D\u001f" +
    "\u001eMARINARA_DEFERRED_CHARACTER_IF:%7B%22branches%22%3A%5B%7B%22condition%22%3A%22char%20%3D%3D%20%5C%22Narrator%5C%22%22%2C%22content%22%3A%22%7B%7Bnoop%7D%7D%5CnNARRATOR_ONLY%20The%20storm%20was%20planned.%22%7D%5D%7D\u001f" +
    "\u001eMARINARA_DEFERRED_CHARACTER_IF:%7B%22branches%22%3A%5B%7B%22condition%22%3A%22char%20%3D%3D%20%5C%22Pantalone%5C%22%22%2C%22content%22%3A%22%7B%7Bnoop%7D%7D%5CnPantalone%20owes%20Cara%20a%20debt.%22%7D%2C%7B%22condition%22%3Anull%2C%22content%22%3A%22%5CnNobody%20mentions%20the%20debt.%22%7D%5D%7D\u001f" +
    "\u001eMARINARA_DEFERRED_CHARACTER_IF:%7B%22branches%22%3A%5B%7B%22condition%22%3A%22char%20%3D%3D%20%5C%22Pantalone%5C%22%20%26%26%20getvar%3A%3Aready%20%3D%3D%20%5C%22yes%5C%22%22%2C%22content%22%3A%22%7B%7Bnoop%7D%7D%5CnMIXED_SECRET%22%7D%5D%7D\u001f\n" +
    "</chat_summary>";
  const pinned =
    MAIN +
    "<chat_summary>\n    Mari and Pantalone reached the harbor.\n    The travelers kept the compass promise.\n" +
    "    Pantalone owes Cara a debt.\n    MIXED_SECRET\n</chat_summary>";
  const single =
    "<chat_summary>\n    Mari and Maukie reached the harbor.\n    Maukie hid the compass.\n" +
    "    The travelers kept the compass promise.\n    Nobody mentions the debt.\n</chat_summary>";
  for (const marker of [true, false]) {
    assert.equal(await summaryBlock(all, marker, { deferCharacterMacros: true }), individual, "Individual mode");
    assert.equal(await summaryBlock([pantalone.id], marker), pinned, "an Individual-mode reply for one chosen speaker");
    assert.equal(await summaryBlock([maukie.id], marker, { groupCharacterIds: undefined }), MAIN + single, "solo");
  }
  // Filled in for each responder, Individual mode reads that responder's lines, a hidden last section included,
  // with no empty line. (Lines filled into the XML wrapper start at its margin.)
  const summaryLines = (prompt: string) =>
    prompt
      .slice(prompt.indexOf("<chat_summary>"))
      .split("\n")
      .map((line) => line.trim());
  for (const id of all)
    assert.deepEqual(
      summaryLines(resolveDeferredCharacterMacros(individual, profiles.get(id)!, mergedCtx)),
      summaryLines(await summaryBlock([id], true)),
      `Individual mode filled in for ${profiles.get(id)!.name}`,
    );
  const soloCtx = await buildPromptMacroContext({
    db,
    characterIds: [maukie.id],
    personaName: "Mari",
    localVariables: { ready: "yes" },
  });
  assert.equal(appendFallbackChatSummaryToSystemPrompt([], SUMMARY, "xml", soloCtx)[0]!.content, single);

  const { mergedChatSummaryReaders } =
    await import("../../packages/server/src/routes/generate/generate-route-utils.js");
  const base = {
    characterIds: all,
    individual: false,
    impersonate: false,
    narratorCharacterId: narrator.id,
    profilesById: profiles,
    unreadableIds: new Set<string>(),
  };
  assert.deepEqual(
    mergedChatSummaryReaders(base)?.map((profile) => profile.name),
    ["Maukie", "Pantalone"],
    "a merged group reads the summary for everyone present but the narrator",
  );
  assert.deepEqual(
    mergedChatSummaryReaders({ ...base, narratorCharacterId: null })?.map((profile) => profile.name),
    ["Narrator", "Maukie", "Pantalone"],
    "without a narrator setting every present character is a reader",
  );
  for (const [label, input] of [
    ["Individual mode", { ...base, individual: true }],
    ["impersonation", { ...base, impersonate: true }],
    ["a single-character chat", { ...base, characterIds: [maukie.id] }],
  ] as const) {
    assert.equal(mergedChatSummaryReaders(input), undefined, `${label} keeps the usual single reading`);
  }

  // A card whose data is not JSON still gets a reply profile, but no macro profile, so reading for the
  // rest would leave Maukie's sections unmarked and the unreadable character's out. Keep the single reading.
  const broken = await characters.create(characterDataSchema.parse({ name: "Broken" }));
  const { characters: characterTable } = await import("../../packages/server/src/db/schema/characters.js");
  const { eq } = await import("../../packages/server/src/db/file-query.js");
  await db.update(characterTable).set({ data: "{not json" }).where(eq(characterTable.id, broken.id));
  const brokenCast = [narrator.id, maukie.id, broken.id];
  const { loadCharacterPromptInfo } =
    await import("../../packages/server/src/services/generation/character-prompt-context.js");
  assert.ok(
    (await loadCharacterPromptInfo({ chars: characters, characterIds: brokenCast, chatMode: "roleplay" })).some(
      (info) => info.id === broken.id,
    ),
    "the unreadable card still takes part in the merged reply",
  );
  const brokenReaders = mergedChatSummaryReaders({
    ...base,
    characterIds: brokenCast,
    ...(await resolveCharacterMacroData(db, brokenCast)),
  });
  for (const marker of [true, false]) {
    const cast = { groupCharacterIds: brokenCast };
    assert.equal(
      await summaryBlock(brokenCast, marker, { ...cast, chatSummaryReaders: brokenReaders }),
      await summaryBlock(brokenCast, marker, cast),
      `an unreadable card leaves no partial marking (marker: ${marker})`,
    );
  }
  assert.equal(brokenReaders, undefined, "an unreadable card keeps the usual single reading");
  // An unreadable narrator is never a reader, so the rest are still marked.
  assert.deepEqual(
    mergedChatSummaryReaders({
      ...base,
      characterIds: [broken.id, maukie.id, pantalone.id],
      narratorCharacterId: broken.id,
      ...(await resolveCharacterMacroData(db, [broken.id, maukie.id, pantalone.id])),
    })?.map((profile) => profile.name),
    ["Maukie", "Pantalone"],
    "an unreadable narrator still leaves the readers",
  );

  // A deleted card's id can linger in an older chat (before #6084). It does not reply, so the rest are still marked.
  const staleCast = [...all, "deleted-card"];
  assert.deepEqual(
    (await loadCharacterPromptInfo({ chars: characters, characterIds: staleCast, chatMode: "roleplay" })).map(
      (info) => info.name,
    ),
    ["Narrator", "Maukie", "Pantalone"],
    "a deleted card's leftover id takes no part in the reply",
  );
  const staleReaders = mergedChatSummaryReaders({
    ...base,
    characterIds: staleCast,
    ...(await resolveCharacterMacroData(db, staleCast)),
  });
  for (const marker of [true, false]) {
    assert.equal(
      await summaryBlock(staleCast, marker, { chatSummaryReaders: staleReaders }),
      merged,
      `a deleted card's leftover id keeps the marking (marker: ${marker})`,
    );
  }

  // Generation and the prompt preview both hand the readers to every summary placement.
  const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  const generate = source("../../packages/server/src/routes/generate.routes.ts");
  const preview = source("../../packages/server/src/routes/generate/dry-run-route.ts");
  const peek = source("../../packages/server/src/routes/chats.routes.ts");
  for (const [name, text] of [
    ["generation", generate],
    ["preview", preview],
  ] as const) {
    assert.match(text, /const chatSummaryReaders = mergedChatSummaryReaders\(/u, `${name} computes the readers`);
    assert.match(text, /chatSummary: [^\n]+,\n\s+chatSummaryReaders,\n/u, `${name} passes them to the assembler`);
  }
  assert.match(
    generate,
    /appendFallbackChatSummaryToSystemPrompt\(\s*finalMessages,\s*activeChatSummary,[^)]*chatSummaryReaders,[^)]*\)/u,
    "preset-less generation passes them too",
  );
  // A chosen responder in a merged chat still voices the cast (mergedSpeaksOnlyTarget), as Advanced Memory reads it.
  assert.doesNotMatch(
    `${generate}\n${preview}`,
    /mergedChatSummaryReaders\(\{[^}]*targetCharacterId/u,
    "a chosen responder keeps the readers",
  );
  assert.match(
    peek,
    /chatSummary: activeChatSummary,\n[^\n]*\n\s+chatSummaryReaders: activeChatSummary\s+\? mergedChatSummaryReaders\(/u,
    "Peek Prompt's live preview reads the summary as generation does",
  );
} finally {
  closeDB?.();
  rmSync(dir, { recursive: true, force: true });
}

console.log("merged-chat-summary regression passed");
