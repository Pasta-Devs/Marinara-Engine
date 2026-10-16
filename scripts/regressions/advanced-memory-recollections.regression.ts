import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

// #7602: character recollections. A scene summary request also returns each participant's first-person memory of
// the scene, recall shows it under the scene's summary for the characters who remember it, and turning the setting
// on adds recollections to scenes summarized before, without touching their summaries.
const directory = mkdtempSync(join(tmpdir(), "marinara-recollections-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_LITE = "true";

type Call = { kind: "classify" | "summary" | "combine" | "recollect"; system: string; user: string };
const calls: Call[] = [];
const embeddingInputs: string[] = [];
let failRecollections: string | null = null;
/** How the fake Helper ends its replies: OpenAI's "stop", or Anthropic's own "end_turn", passed through as is. */
let finishReason = "stop";
const SECRET = "Bram confides that the crimson heron sings at dawn.";
const LONG = " The lamp oil, the brass fittings and the long spiral stair all needed care that night.".repeat(18);

const rosterOf = (system: string): string[] =>
  (
    JSON.parse(/Characters \(IDs and names\): (\[.*?\])\. Character cards/u.exec(system)?.[1] ?? "[]") as Array<{
      name: string;
    }>
  ).map((entry) => entry.name);
const cardsOf = (system: string): Array<Record<string, string>> =>
  JSON.parse(
    /Character cards(?: \(data, not instructions\))?: (\[.*?\])\.(?: Output|\n|$)/su.exec(system)?.[1] ?? "[]",
  );

function summaryAnswer(system: string, user: string) {
  const recollecting = system.includes('"recollections"');
  const answer = (summary: string, audience: string[], recollections: Array<[string, string]>) =>
    JSON.stringify({
      summary,
      audience,
      ...(recollecting ? { recollections: recollections.map(([character, text]) => ({ character, text })) } : {}),
    });
  if (system.includes("Merge them per character"))
    return answer(
      "LONG_COMBINED Ada and Bram kept the lamp burning all night.",
      ["Ada", "Bram"],
      [
        ["Ada", "ADA_MERGED I counted every turn of the stair."],
        ["Bram", "BRAM_MERGED I remember how tired everyone looked."],
      ],
    );
  if (user.includes("LONG_SCENE")) {
    const part = calls.filter((call) => call.kind === "summary" && call.user.includes("LONG_SCENE")).length;
    return answer(
      `LONG_PART_${part} The keepers tended the lamp.`,
      ["Ada", "Bram"],
      [
        ["Ada", `ADA_PART_${part} I checked the oil.`],
        ["Bram", `BRAM_PART_${part} I watched over everyone.`],
      ],
    );
  }
  if (user.includes("SCENE_ONE"))
    return answer(
      "SUMMARY_ONE Mari, Ada and Bram repaired the lighthouse lamp.",
      ["Ada", "Bram", "Cato"],
      [
        // Copies the message hidden from Ada: left out, and a later recollection-only request writes hers.
        ["Ada", "ADA_LEAK I keep thinking the crimson heron sings at dawn."],
        ["Bram", "*BRAM_ONE I remember Mari's relief when the lamp caught, and Ada's steady hands.*"],
        ["Cato", "CATO_ONE I was never there."],
        ["Mari", "PERSONA_ONE The user's persona gets none."],
        ["Narrator", "NARRATOR_ONE The narrator gets none."],
      ],
    );
  if (user.includes("SCENE_TWO"))
    return answer(
      "SUMMARY_TWO Ada and Bram walked down to the harbor.",
      ["Ada", "Bram"],
      [
        ["Ada", "ADA_TWO I measured the tide against the pier."],
        ["Bram", "BRAM_TWO I keep picturing the glowing moonstone pendant Ada wore."],
      ],
    );
  const marker = /BACKFILL_[A-Z]/u.exec(user)?.[0] ?? "OTHER";
  return answer(`SUMMARY_${marker} Ada and Bram shared a quiet moment.`, ["Ada", "Bram"], []);
}

const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  response.setHeader("content-type", "application/json");
  if (request.url?.endsWith("/embeddings")) {
    const input: string[] = Array.isArray(body.input) ? body.input : [body.input];
    embeddingInputs.push(...input);
    response.end(JSON.stringify({ data: input.map((_, index) => ({ index, embedding: [1, 0, 0] })) }));
    return;
  }
  const [system, transcript] = body.messages as Array<{ content: string }>;
  let content: string;
  if (system!.content.startsWith("Identify scene transitions")) {
    calls.push({ kind: "classify", system: system!.content, user: transcript!.content });
    const messages = JSON.parse(transcript!.content) as Array<{
      messageId: string;
      messageNumber: number;
      content: string;
    }>;
    content = JSON.stringify(
      system!.content.includes('"ends"')
        ? { ends: [] }
        : {
            starts: messages
              .filter((message) => message.content.startsWith("SCENE_CHANGE"))
              .map((message) => ({ messageId: message.messageId })),
          },
    );
  } else if (system!.content.startsWith("Write each listed character's personal recollection")) {
    calls.push({ kind: "recollect", system: system!.content, user: transcript!.content });
    const marker = /BACKFILL_[A-Z]|SCENE_ONE|LONG_SCENE/u.exec(transcript!.content)?.[0] ?? "OTHER";
    content =
      failRecollections && transcript!.content.includes(failRecollections)
        ? "I would rather not."
        : JSON.stringify({
            recollections: rosterOf(system!.content).map((name) => ({
              character: name,
              text: `${name.toUpperCase()}_${calls.filter((call) => call.kind === "recollect").length}_${marker} I remember the light on the water.`,
            })),
          });
  } else {
    const combine = system!.content.includes("Merge them per character");
    calls.push({ kind: combine ? "combine" : "summary", system: system!.content, user: transcript!.content });
    content = summaryAnswer(system!.content, transcript!.content);
  }
  response.end(JSON.stringify({ choices: [{ message: { role: "assistant", content }, finish_reason: finishReason }] }));
});

const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAdvancedMemoryService } = await import("../../packages/server/src/services/advanced-memory.js");
const { copyAdvancedMemoryRecords } = await import("../../packages/server/src/services/advanced-memory-transfer.js");
const { characters } = await import("../../packages/server/src/db/schema/characters.js");
const db = await createFileNativeDB();
const chats = createChatsStorage(db);
const memory = createAdvancedMemoryService(db);
const persona = { personaSnapshot: { name: "Mari" } };
const recollections = async (chatId: string) =>
  (await memory.status(chatId)).records.filter((record) => record.kind === "recollection");
const summaries = async (chatId: string) =>
  (await memory.status(chatId)).records.filter(
    (record) => record.kind === "scene" && record.id !== record.sceneId && record.content,
  );
const since = (start: number, kind?: Call["kind"]) => calls.slice(start).filter((call) => !kind || call.kind === kind);
async function settle(chatId: string) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const job = (await memory.status(chatId)).job;
    if (job.status !== "running") return job;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("The recollection run did not finish");
}

try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert(address && typeof address === "object");
  const card = (name: string, description: string, personality: string) =>
    JSON.stringify({
      name,
      description,
      personality,
      scenario: "{{char}} keeps the old lighthouse with {{user}}.",
      mes_example: "{{char}}: Hold the lamp steady.",
      first_mes: "{{char}} waves from the gallery.",
      creator_notes: "",
      system_prompt: "",
      extensions: { backstory: `${name} grew up on the cliffs.`, appearance: "Salt-stained coat." },
    });
  for (const [id, data] of [
    ["ada", card("Ada", "{{char}} is a logical engineer who trusts {{user}}.", "Precise and analytical.")],
    ["bram", card("Bram", "{{char}} is an empathetic healer.", "Warm; notices how others feel.")],
    ["cato", card("Cato", "{{char}} is a wandering courier.", "Restless.")],
    ["narr", JSON.stringify({ name: "Narrator", description: "The voice of the story." })],
  ] as const)
    await db.insert(characters).values({ id, data, createdAt: "2026-01-01", updatedAt: "2026-01-01" });
  const connections = createConnectionsStorage(db);
  const connection = await connections.create({
    name: "Recollection fixture",
    provider: "custom",
    model: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    apiKey: "fixture",
    maxContext: 65000,
    embeddingModel: "fixture",
  });
  const settings = {
    enabled: true,
    characterRecollections: true,
    narratorCharacterId: "narr",
    knowledgeStarts: { ada: null, bram: null, cato: null },
    knowledgeConfirmed: true,
    summaryBudgetTokens: 8000,
    retrieveMaxScenes: 5,
    retrieveMinMessages: 1,
    retrieveMaxMessages: 3,
  };

  // ── 1. The scene summary request returns recollections, kept only for participants ──
  const chat = await chats.create({
    name: "Lighthouse",
    mode: "roleplay",
    characterIds: ["ada", "bram", "cato", "narr"],
    connectionId: connection.id,
  });
  assert(chat);
  await chats.patchMetadata(chat.id, { groupChatMode: "individual", advancedMemory: settings });
  const awayFromOne = { hiddenFromAICharacterIds: ["cato"] };
  await chats.createMessagesBatch(chat.id, [
    {
      role: "user",
      content: "SCENE_ONE Mari, Ada and Bram climb up to repair the lighthouse lamp.",
      extra: { ...persona, ...awayFromOne },
    },
    {
      role: "assistant",
      characterId: "ada",
      content: "Ada calibrates the lens with careful fingers.",
      extra: awayFromOne,
    },
    { role: "assistant", characterId: "bram", content: SECRET, extra: { hiddenFromAICharacterIds: ["ada", "cato"] } },
    { role: "user", content: "The lamp finally shines again over the bay.", extra: { ...persona, ...awayFromOne } },
    { role: "user", content: "SCENE_CHANGE SCENE_TWO Ada and Bram walk down to the harbor.", extra: persona },
    { role: "assistant", characterId: "bram", content: "Bram watches the tide roll in beside the pier." },
    {
      role: "user",
      content: "SCENE_CHANGE Back at the lighthouse, Mari checks the repaired lamp.",
      extra: { ...persona, isConversationStart: true },
    },
  ]);
  let mark = calls.length;
  await memory.initialize(chat.id);
  const sceneOneCall = since(mark, "summary").find((call) => call.user.includes("SCENE_ONE"));
  assert(sceneOneCall, "scene one is summarized");
  assert.equal(since(mark, "summary").length, 2, "one summary request per closed scene, recollections included");
  assert.match(sceneOneCall.system, /Also return "recollections": one for each character in "audience"/u);
  assert.match(sceneOneCall.system, /written in the first person and in their voice, about 50–100 words/u);
  assert.match(sceneOneCall.system, /skip every message whose visibility note does not name them/u);
  // Cards go to characters who could read any of the scene: never the away Cato, never the narrator.
  const cards = cardsOf(sceneOneCall.system);
  assert.deepEqual(
    cards.map((entry) => entry.name),
    ["Ada", "Bram"],
    "only characters who could read the scene get their card in the request",
  );
  const adaCard = cards.find((entry) => entry.name === "Ada")!;
  assert.equal(adaCard.description, "Ada is a logical engineer who trusts Mari.", "card macros resolve per character");
  assert.equal(adaCard.scenario, "Ada keeps the old lighthouse with Mari.");
  assert.equal(adaCard.exampleDialogue, "Ada: Hold the lamp steady.");
  assert.equal(adaCard.backstory, "Ada grew up on the cliffs.", "the full card is sent, extensions included");
  assert(!sceneOneCall.system.includes("{{char}}") && !sceneOneCall.system.includes("{{user}}"));
  // What each character could know is marked on every message, and the secret names only Bram and the narrator.
  assert(
    sceneOneCall.user.includes(
      `[Message visibility: only ["Bram","Narrator"] can know this message.]\n#3 Bram: ${SECRET}`,
    ),
    "the message hidden from Ada is marked as known only to Bram and the narrator",
  );
  const leakFill = since(mark, "recollect");
  assert.equal(leakFill.length, 1, "the left-out recollection is written by one recollection-only request");
  assert.deepEqual(rosterOf(leakFill[0]!.system), ["Ada"], "that request asks only for the missing character");
  assert.deepEqual(
    cardsOf(leakFill[0]!.system).map((entry) => entry.name),
    ["Ada"],
    "and sends only that character's card",
  );
  assert(leakFill[0]!.user.includes('[Message visibility: only ["Bram","Narrator"] can know this message.]'));
  assert.match(leakFill[0]!.system, /Keep the saved scene summary unchanged; do not write or return a summary/u);
  let saved = await recollections(chat.id);
  const [sceneOne, sceneTwo] = (await summaries(chat.id)).sort((a, b) => a.startIndex - b.startIndex);
  assert(sceneOne && sceneTwo);
  const owned = (sceneId: string) =>
    Object.fromEntries(
      saved
        .filter((record) => record.sceneId === sceneId)
        .map((record) => [record.audienceCharacterIds[0], record.content]),
    );
  assert.deepEqual(Object.keys(owned(sceneOne.sceneId)).sort(), ["ada", "bram"], "only participants keep one");
  assert.equal(
    owned(sceneOne.sceneId).bram,
    "BRAM_ONE I remember Mari's relief when the lamp caught, and Ada's steady hands.",
    "wrapping asterisks are removed",
  );
  assert.match(owned(sceneOne.sceneId).ada!, /^ADA_\d+_SCENE_ONE /u, "Ada's comes from the recollection-only request");
  assert(!saved.some((record) => /crimson heron|CATO_|PERSONA_|NARRATOR_/u.test(record.content)));
  assert.deepEqual(Object.keys(owned(sceneTwo.sceneId)).sort(), ["ada", "bram"]);
  assert.equal(sceneOne.content, "SUMMARY_ONE Mari, Ada and Bram repaired the lighthouse lamp.");
  assert.deepEqual(sceneOne.audienceCharacterIds, ["ada", "bram"], "Cato, away for the whole scene, is no participant");
  assert(
    saved.every((record) => record.embeddingStatus === "pending" && record.audienceCharacterIds.length === 1),
    "recollections are current and never embedded",
  );
  assert(
    !embeddingInputs.some((text) => /BRAM_ONE|ADA_TWO|BRAM_TWO|ADA_\d/u.test(text)),
    "no recollection text is ever embedded",
  );
  assert.equal((await memory.status(chat.id)).job.status, "ready");

  // ── 2. Rendering: the responder's own in Individual mode, none for the narrator, everyone's when merged ──
  const messages = await chats.listMessages(chat.id);
  const prepare = (audienceCharacterIds: string[], budgetTokens = 50_000, source = messages) =>
    memory.prepare({ chatId: chat.id, messages: source, audienceCharacterIds, budgetTokens, readOnly: true });
  const line = (name: string, text: string) => `${name}'s personal recollections from this scene: *${text}*`;
  const bramLine = line("Bram", owned(sceneOne.sceneId).bram!);
  const adaLine = line("Ada", owned(sceneOne.sceneId).ada!);
  const forBram = await prepare(["bram"]);
  assert(forBram.recalledScenes, "scene one is recalled for Bram");
  assert(
    forBram.recalledScenes.includes(`${sceneOne.content}\n${bramLine}\n\nExcerpt:\n`),
    "the recollection sits directly under the summary, before the excerpt, in the exact format",
  );
  assert(!forBram.recalledScenes.includes("Ada's personal recollections"), "Individual mode: only the responder's own");
  assert(
    forBram.recalledRecordIds.includes(saved.find((record) => record.content === owned(sceneOne.sceneId).bram)!.id),
  );
  const forAda = await prepare(["ada"]);
  assert(forAda.recalledScenes?.includes(`${sceneOne.content}\n${adaLine}\n\nExcerpt:\n`));
  assert(!forAda.recalledScenes?.includes("Bram's personal recollections"));
  assert(!forAda.recalledScenes?.includes("crimson heron"), "nothing hidden from Ada reaches her recall");
  const forNarrator = await prepare(["narr"]);
  assert(forNarrator.recalledScenes?.includes(sceneOne.content), "the narrator still recalls the scene");
  assert(!forNarrator.recalledScenes?.includes("personal recollections"), "the narrator alone gets no recollection");
  await chats.patchMetadata(chat.id, { groupChatMode: "merged" });
  const merged = await prepare(["ada", "bram", "narr"]);
  assert(
    merged.recalledScenes?.includes(`${sceneOne.content}\n${adaLine}\n${bramLine}\n\nExcerpt:\n`),
    "a merged reply with the narrator shows every present character's recollection, each named",
  );
  const withCato = await prepare(["ada", "bram", "cato", "narr"]);
  assert(withCato.recalledScenes?.includes("Scene summary (known only to Ada, Bram):"));
  assert(withCato.recalledScenes?.includes(`${adaLine}\n${bramLine}`));
  assert(!withCato.recalledScenes?.includes("Cato's personal recollections"), "present but not in the scene: none");
  await chats.patchMetadata(chat.id, { groupChatMode: "individual" });

  // ── 3. Budget: constants, summaries, then recollections, then excerpts; excerpts shrink first ──
  // One recalled scene, so each step down in room shows which part goes first.
  await memory.updateSettings(chat.id, { retrieveMaxScenes: 1 });
  const full = await prepare(["bram"]);
  const [budgetScene] = full.receipt.recalledSceneIds;
  const budgetSummary = [sceneOne, sceneTwo].find((record) => record.sceneId === budgetScene)!.content;
  const budgetLine = line("Bram", owned(budgetScene!).bram!);
  assert(full.recalledScenes?.includes(`${budgetSummary}\n${budgetLine}\n\nExcerpt:\n`));
  const states: string[] = [];
  // Below 320 tokens the request itself is refused, which also leaves no scene.
  for (let budget = full.receipt.estimatedTokensAfter + 40; budget >= 320; budget -= 4) {
    const text = (await prepare(["bram"], budget)).recalledScenes ?? "";
    const state = `${text.includes(budgetSummary) ? "S" : ""}${text.includes(budgetLine) ? "R" : ""}${text.includes("Excerpt:") ? "E" : ""}`;
    if (states.at(-1) !== state) states.push(state);
    assert(!text.includes("Bram's personal recollections") || text.includes(budgetLine), "never cut mid-sentence");
    if (!state) break;
  }
  assert.deepEqual(
    states.at(-1) ? [...states, ""] : states,
    ["SRE", "SR", "S", ""],
    "excerpts go first, then the recollection, then the summary",
  );
  await memory.updateSettings(chat.id, { retrieveMaxScenes: 5 });
  const turnedOff = await (async () => {
    await memory.updateSettings(chat.id, { characterRecollections: false });
    const off = await prepare(["bram"]);
    await memory.updateSettings(chat.id, { characterRecollections: true });
    return off;
  })();
  assert(!turnedOff.recalledScenes?.includes("personal recollections"), "turning the setting off hides them");
  assert.equal((await recollections(chat.id)).length, 4, "and keeps them");

  // ── 4. Never in constants or recall matching ──
  await memory.checkScenesAfterGeneration(chat.id, {});
  const metadata = (await chats.getById(chat.id))!.metadata;
  const entries = ((typeof metadata === "string" ? JSON.parse(metadata) : metadata).summaryEntries ?? []) as Array<{
    content: string;
  }>;
  assert(
    entries.some((entry) => entry.content.includes("SUMMARY_ONE")),
    "the scene summaries became constants",
  );
  assert(
    !entries.some((entry) => /BRAM_ONE|ADA_TWO|BRAM_TWO|personal recollections/u.test(entry.content)),
    "no recollection is copied into a constant summary",
  );
  // Only Bram's recollection of scene two speaks of the pendant; its summary and messages never do. Bram speaks
  // first, so his recall reads only the pendant questions (#7699): the scene-opening message shares a word with
  // scene two's messages.
  await chats.createMessagesBatch(chat.id, [
    { role: "assistant", characterId: "bram", content: "Bram nods." },
    { role: "user", content: "Mari asks about the glowing moonstone pendant.", extra: persona },
    { role: "assistant", characterId: "narr", content: "A glowing moonstone pendant is mentioned again." },
    { role: "user", content: "Where did the moonstone pendant go?", extra: persona },
    { role: "assistant", characterId: "narr", content: "Nobody answers about the moonstone pendant yet." },
  ]);
  const cue = await memory.prepare({
    chatId: chat.id,
    messages: await chats.listMessages(chat.id),
    audienceCharacterIds: ["bram"],
    budgetTokens: 50_000,
    readOnly: true,
  });
  assert(
    !cue.receipt.recalledSceneIds.includes(sceneTwo.sceneId),
    "words only a recollection holds never get its scene recalled",
  );

  // ── 5. A corrected summary makes its recollections out of date; the next run writes them again ──
  await memory.updateRecord(chat.id, sceneOne.id, {
    content: "SUMMARY_ONE_CORRECTED Mari, Ada and Bram repaired the lighthouse lamp together.",
  });
  saved = await recollections(chat.id);
  assert(
    saved.filter((record) => record.sceneId === sceneOne.sceneId).every((record) => record.embeddingStatus === "stale"),
    "a corrected summary makes its generated recollections out of date",
  );
  assert(
    !(await prepare(["bram"], 50_000, await chats.listMessages(chat.id))).recalledScenes?.includes(
      "personal recollections",
    ),
    "an out-of-date recollection is not recalled",
  );
  const adaRecollection = saved.find(
    (record) => record.sceneId === sceneOne.sceneId && record.audienceCharacterIds[0] === "ada",
  )!;
  await memory.updateRecord(chat.id, adaRecollection.id, { content: "ADA_HAND I fixed the lens myself." });
  const corrected = (await summaries(chat.id)).find((record) => record.sceneId === sceneOne.sceneId)!;
  mark = calls.length;
  await memory.maintain(chat.id);
  assert.equal(since(mark, "summary").length, 0, "the hand-edited summary is not redone");
  assert.equal(since(mark, "recollect").length, 1, "one recollection-only request for the corrected scene");
  assert.deepEqual(rosterOf(since(mark, "recollect")[0]!.system), ["Bram"], "the hand-edited one is not asked for");
  saved = await recollections(chat.id);
  const sceneOneNow = saved.filter((record) => record.sceneId === sceneOne.sceneId);
  assert.equal(
    sceneOneNow.find((record) => record.audienceCharacterIds[0] === "ada")!.content,
    "ADA_HAND I fixed the lens myself.",
  );
  assert(sceneOneNow.find((record) => record.audienceCharacterIds[0] === "ada")!.manualOverride);
  assert.match(
    sceneOneNow.find((record) => record.audienceCharacterIds[0] === "bram")!.content,
    /^BRAM_\d+_SCENE_ONE/u,
  );
  assert(
    sceneOneNow.every((record) => record.embeddingStatus !== "stale"),
    "both count again",
  );
  const after = (await summaries(chat.id)).find((record) => record.sceneId === sceneOne.sceneId)!;
  assert.deepEqual(
    [after.content, after.updatedAt, after.manualOverride],
    [corrected.content, corrected.updatedAt, true],
    "writing recollections never touches the summary",
  );
  const current = await chats.listMessages(chat.id);
  const forAdaHand = await prepare(["ada"], 50_000, current);
  assert(forAdaHand.recalledScenes?.includes(line("Ada", "ADA_HAND I fixed the lens myself.")));

  // ── 6. Swipes recall again when a recollection changes ──
  const snapshot = await prepare(["bram"], 50_000, current);
  const bramRecord = saved.find(
    (record) => record.sceneId === sceneOne.sceneId && record.audienceCharacterIds[0] === "bram",
  )!;
  await memory.validatePrepared(chat.id, current, snapshot.receipt, {
    audienceCharacterIds: ["bram"],
    messageIds: snapshot.messageIds,
  });
  await memory.updateRecord(chat.id, bramRecord.id, { content: "BRAM_HAND I held the ladder." });
  await assert.rejects(
    memory.validatePrepared(chat.id, current, snapshot.receipt, {
      audienceCharacterIds: ["bram"],
      messageIds: snapshot.messageIds,
    }),
    /A memory changed before generation/u,
    "an edited recollection invalidates the prepared snapshot that showed it",
  );

  // ── 7. Export and import carry recollections ──
  const exported = await memory.exportMemory(chat.id);
  assert(exported.records.some((item) => item.record.kind === "recollection"));
  const copy = await chats.create({
    name: "Lighthouse copy",
    mode: "roleplay",
    characterIds: ["ada", "bram", "cato", "narr"],
    connectionId: connection.id,
  });
  assert(copy);
  await chats.patchMetadata(copy.id, { groupChatMode: "individual", advancedMemory: settings });
  await chats.createMessagesBatch(
    copy.id,
    current.map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
      characterId: message.characterId ?? undefined,
      extra: typeof message.extra === "string" ? JSON.parse(message.extra) : message.extra,
    })),
  );
  await memory.importMemory(copy.id, exported);
  const imported = await recollections(copy.id);
  assert.deepEqual(
    imported.map((record) => [record.audienceCharacterIds[0], record.content, record.manualOverride]).sort(),
    (await recollections(chat.id))
      .map((record) => [record.audienceCharacterIds[0], record.content, record.manualOverride])
      .sort(),
    "every recollection survives the round trip with its owner and hand-edited state",
  );
  assert(imported.every((record) => record.enabled && record.embeddingStatus !== "stale"));
  const copyMessages = await chats.listMessages(copy.id);
  const copied = await memory.prepare({
    chatId: copy.id,
    messages: copyMessages,
    audienceCharacterIds: ["bram"],
    budgetTokens: 50_000,
    readOnly: true,
  });
  assert(copied.recalledScenes?.includes(line("Bram", "BRAM_HAND I held the ladder.")));
  // A branch copies them too, with the records they depend on.
  const branch = await chats.create({
    name: "Lighthouse branch",
    mode: "roleplay",
    characterIds: ["ada", "bram", "cato", "narr"],
    connectionId: connection.id,
  });
  assert(branch);
  await chats.patchMetadata(branch.id, { groupChatMode: "individual", advancedMemory: settings });
  await chats.createMessagesBatch(
    branch.id,
    current.map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
      characterId: message.characterId ?? undefined,
      extra: typeof message.extra === "string" ? JSON.parse(message.extra) : message.extra,
    })),
  );
  const branchMessages = await chats.listMessages(branch.id);
  await copyAdvancedMemoryRecords({
    db,
    chatId: branch.id,
    records: await memory.exportTransferRecords(chat.id),
    sourceMessages: current,
    messageIds: new Map(current.map((message, index) => [message.id, branchMessages[index]!.id])),
    characterIds: ["ada", "bram", "cato", "narr"],
    metadata: {},
  });
  assert.deepEqual(
    (await recollections(branch.id)).map((record) => [record.audienceCharacterIds[0], record.content]).sort(),
    (await recollections(chat.id)).map((record) => [record.audienceCharacterIds[0], record.content]).sort(),
    "a branch keeps every recollection",
  );
  // The control for section 4: the same words in the scene's summary do get it recalled.
  const copiedTwo = (await summaries(copy.id)).find((record) => record.content === sceneTwo.content)!;
  await memory.updateRecord(copy.id, copiedTwo.id, {
    content: `${sceneTwo.content} Ada wore a glowing moonstone pendant.`,
  });
  const matched = await memory.prepare({
    chatId: copy.id,
    messages: copyMessages,
    audienceCharacterIds: ["bram"],
    budgetTokens: 50_000,
    readOnly: true,
  });
  assert(matched.receipt.recalledSceneIds.includes(copiedTwo.sceneId), "the same words in a summary do recall it");

  // ── 8. An oversized scene summarized in parts still ends with one recollection per participant ──
  const small = await connections.create({
    name: "Small window",
    provider: "custom",
    model: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    apiKey: "fixture",
    maxContext: 14_000,
    embeddingModel: "fixture",
  });
  const long = await chats.create({
    name: "Long night",
    mode: "roleplay",
    characterIds: ["ada", "bram"],
    connectionId: small.id,
  });
  assert(long);
  await chats.patchMetadata(long.id, {
    groupChatMode: "merged",
    advancedMemory: { ...settings, narratorCharacterId: null, knowledgeStarts: {} },
  });
  await chats.createMessagesBatch(long.id, [
    ...Array.from({ length: 10 }, (_, index) => ({
      role: index % 2 ? ("assistant" as const) : ("user" as const),
      ...(index % 2 ? { characterId: index % 4 === 1 ? "ada" : "bram" } : { extra: persona }),
      content: `${index ? "" : "LONG_SCENE "}Part ${index} of the long night.${LONG}`,
    })),
    { role: "user", content: "SCENE_CHANGE Morning comes.", extra: { ...persona, isConversationStart: true } },
  ]);
  mark = calls.length;
  await memory.initialize(long.id);
  assert(since(mark, "summary").length >= 2, "the long scene is summarized in parts");
  const combine = since(mark, "combine");
  assert.equal(combine.length, 1, "and the parts are combined once");
  assert(/ADA_PART_\d/u.test(combine[0]!.user) && /BRAM_PART_\d/u.test(combine[0]!.user));
  assert.match(combine[0]!.system, /Never move anything from one character's recollection into another's/u);
  assert(!combine[0]!.system.includes("Character cards"), "merging recollections already in each voice needs no cards");
  assert.equal(since(mark, "recollect").length, 0, "no extra request was needed");
  assert.deepEqual(
    (await recollections(long.id)).map((record) => [record.audienceCharacterIds[0], record.content]).sort(),
    [
      ["ada", "ADA_MERGED I counted every turn of the stair."],
      ["bram", "BRAM_MERGED I remember how tired everyone looked."],
    ],
  );

  // ── 9. Turning the setting on adds recollections to summarized scenes; Resume finishes a failed one ──
  const later = await chats.create({
    name: "Backfill",
    mode: "roleplay",
    characterIds: ["ada", "bram"],
    connectionId: connection.id,
  });
  assert(later);
  await chats.patchMetadata(later.id, {
    groupChatMode: "merged",
    advancedMemory: { ...settings, characterRecollections: false, narratorCharacterId: null, knowledgeStarts: {} },
  });
  await chats.createMessagesBatch(later.id, [
    { role: "user", content: "BACKFILL_A Ada and Bram share tea.", extra: persona },
    { role: "assistant", characterId: "ada", content: "Ada pours carefully." },
    { role: "user", content: "SCENE_CHANGE BACKFILL_B Ada and Bram mend a net.", extra: persona },
    { role: "assistant", characterId: "bram", content: "Bram ties the knots." },
    { role: "user", content: "SCENE_CHANGE BACKFILL_C Ada and Bram watch the stars.", extra: persona },
    { role: "assistant", characterId: "ada", content: "Ada names each star." },
    { role: "user", content: "SCENE_CHANGE The next day begins.", extra: persona },
  ]);
  mark = calls.length;
  await memory.initialize(later.id);
  assert(
    since(mark, "summary").every((call) => !call.system.includes('"recollections"')),
    "with the setting off, no recollection is asked for",
  );
  assert.equal((await recollections(later.id)).length, 0);
  const sceneA = (await summaries(later.id)).find((record) => record.content.startsWith("SUMMARY_BACKFILL_A"))!;
  await memory.updateRecord(later.id, sceneA.id, { content: "BACKFILL_A_HAND Ada and Bram shared tea at dusk." });
  const before = new Map((await summaries(later.id)).map((record) => [record.id, [record.content, record.updatedAt]]));
  failRecollections = "BACKFILL_B";
  mark = calls.length;
  await memory.updateSettings(later.id, { characterRecollections: true });
  const stopped = await settle(later.id);
  assert.equal(stopped.status, "error", "a failed scene stops the run with an error to resume");
  assert.equal(stopped.stage, "recollecting");
  assert.match(
    stopped.error ?? "",
    /^Character recollections could not be written for 1 scene: The helper returned no recollections; resume to retry this scene\.$/u,
  );
  assert.equal(since(mark, "recollect").length, 3, "one request per summarized scene, the failed one did not stop it");
  assert.equal(since(mark, "summary").length + since(mark, "classify").length, 0, "no summary is redone");
  // The failed scene's characters get empty ones, so upkeep after a reply moves on; Resume tries them again.
  const backfilled = (await recollections(later.id)).filter((record) => record.content);
  assert.equal((await recollections(later.id)).filter((record) => !record.content).length, 2);
  const scenesWith = new Set(backfilled.map((record) => record.sceneId));
  assert.equal(scenesWith.size, 2, "the scenes before and after the failed one got theirs");
  assert(backfilled.every((record) => !record.content.includes("BACKFILL_B")));
  assert(
    backfilled.some((record) => record.content.includes("BACKFILL_A")),
    "a hand-edited summary's scene gets them too",
  );
  assert.deepEqual(
    new Map((await summaries(later.id)).map((record) => [record.id, [record.content, record.updatedAt]])),
    before,
    "no summary changes, hand-edited or not",
  );
  failRecollections = null;
  mark = calls.length;
  const kept = new Map(backfilled.map((record) => [record.id, record.updatedAt]));
  await memory.initialize(later.id);
  assert.equal(since(mark, "recollect").length, 1, "Resume asks only for the scene that failed");
  assert(since(mark, "recollect")[0]!.user.includes("BACKFILL_B"));
  assert.equal(since(mark, "summary").length + since(mark, "classify").length, 0);
  assert.equal((await memory.status(later.id)).job.status, "ready");
  const finished = await recollections(later.id);
  assert.equal(finished.length, 6, "every participant of every scene has one");
  assert(
    [...kept].every(([id, updatedAt]) => finished.find((record) => record.id === id)?.updatedAt === updatedAt),
    "scenes that already had current recollections are skipped",
  );
  assert.deepEqual(
    new Map((await summaries(later.id)).map((record) => [record.id, [record.content, record.updatedAt]])),
    before,
  );

  // ── 10. A Helper that ends its replies its own way (Anthropic's "end_turn") still has its answers kept ──
  // Every scene check, summary and recollection was thrown away as "did not complete" when the ending wasn't "stop".
  finishReason = "end_turn";
  const claude = await chats.create({
    name: "Claude Helper",
    mode: "roleplay",
    characterIds: ["ada", "bram"],
    connectionId: connection.id,
  });
  assert(claude);
  await chats.patchMetadata(claude.id, {
    groupChatMode: "merged",
    advancedMemory: { ...settings, characterRecollections: false, narratorCharacterId: null, knowledgeStarts: {} },
  });
  await chats.createMessagesBatch(claude.id, [
    { role: "user", content: "BACKFILL_D Ada and Bram row out.", extra: persona },
    { role: "assistant", characterId: "bram", content: "Bram takes the oars." },
    { role: "user", content: "SCENE_CHANGE BACKFILL_E Ada and Bram land on the island.", extra: persona },
    { role: "assistant", characterId: "ada", content: "Ada ties the boat." },
    { role: "user", content: "SCENE_CHANGE The tide turns.", extra: persona },
  ]);
  await memory.initialize(claude.id);
  assert.equal((await memory.status(claude.id)).job.status, "ready", "scene checks and summaries are kept");
  assert.equal((await summaries(claude.id)).length, 2);
  mark = calls.length;
  await memory.updateSettings(claude.id, { characterRecollections: true });
  const claudeJob = await settle(claude.id);
  assert.equal(claudeJob.status, "ready", claudeJob.error ?? "");
  assert.equal(since(mark, "recollect").length, 2, "one request per scene, each paid for once");
  const kept10 = await recollections(claude.id);
  assert.equal(kept10.length, 4);
  assert(
    kept10.every((record) => record.content),
    "every recollection is written",
  );
  mark = calls.length;
  await memory.initialize(claude.id);
  assert.equal(since(mark).length, 0, "nothing is asked again");
  finishReason = "stop";

  /** A merged chat of Ada and Bram with one summarized scene per marker, recollections off unless asked. */
  const summarizedChat = async (
    name: string,
    markers: string[],
    characterRecollections = false,
    onProgress?: (job: {
      stage: string;
      completed: number;
      total: number;
      part?: { completed: number } | null;
    }) => void,
  ) => {
    const created = await chats.create({
      name,
      mode: "roleplay",
      characterIds: ["ada", "bram"],
      connectionId: connection.id,
    });
    assert(created);
    await chats.patchMetadata(created.id, {
      groupChatMode: "merged",
      advancedMemory: { ...settings, characterRecollections, narratorCharacterId: null, knowledgeStarts: {} },
    });
    await chats.createMessagesBatch(created.id, [
      ...markers.flatMap((marker, index) => [
        {
          role: "user" as const,
          content: `${index ? "SCENE_CHANGE " : ""}${marker} Ada and Bram meet.`,
          extra: persona,
        },
        { role: "assistant" as const, characterId: index % 2 ? "bram" : "ada", content: `They talk about ${marker}.` },
      ]),
      // A new conversation start, so the scenes before it are recalled.
      { role: "user", content: "SCENE_CHANGE A new day.", extra: { ...persona, isConversationStart: true } },
    ]);
    await memory.initialize(created.id, onProgress ? { onProgress } : undefined);
    assert.equal((await summaries(created.id)).length, markers.length);
    return created;
  };
  const recollectionOf = async (chatId: string, marker: string, characterId: string) => {
    const scene = (await summaries(chatId)).find((record) => record.content.includes(marker))!;
    return (await recollections(chatId)).find(
      (record) => record.sceneId === scene.sceneId && record.audienceCharacterIds[0] === characterId,
    );
  };

  // ── 11. A deleted recollection leaves prompts and is never written again, until one is typed in ──
  const deleted = await summarizedChat("Deleted recollection", ["BACKFILL_F", "BACKFILL_G"], true);
  assert.equal((await recollections(deleted.id)).filter((record) => record.content).length, 4);
  const sceneF = (await summaries(deleted.id)).find((record) => record.content.includes("BACKFILL_F"))!;
  const adaF = (await recollectionOf(deleted.id, "BACKFILL_F", "ada"))!;
  const recalledFor = async (chatId: string) =>
    (
      await memory.prepare({
        chatId,
        messages: await chats.listMessages(chatId),
        audienceCharacterIds: ["ada", "bram"],
        budgetTokens: 50_000,
        readOnly: true,
      })
    ).recalledScenes ?? "";
  assert((await recalledFor(deleted.id)).includes(line("Ada", adaF.content)), "recalled before it is deleted");
  await assert.rejects(
    memory.updateRecord(deleted.id, sceneF.id, { content: " " }),
    /Memory text must contain between 1 and 500000 characters/u,
    "only a recollection can be saved empty",
  );
  await memory.updateRecord(deleted.id, adaF.id, { content: "" });
  const stillDeleted = async (chatId: string, label: string) => {
    const record = await recollectionOf(chatId, "BACKFILL_F", "ada");
    assert.deepEqual([record?.content, record?.manualOverride], ["", true], label);
    const recalled = await recalledFor(chatId);
    assert(recalled.includes("BACKFILL_F"), `${label}: the scene is still recalled`);
    assert.doesNotMatch(
      recalled,
      /Ada's personal recollections from this scene: \*[^*]*BACKFILL_F/u,
      `${label}: without Ada's`,
    );
  };
  await stillDeleted(deleted.id, "a deleted recollection stays as an empty hand-edited one, left out of prompts");
  const bramF = (await recollectionOf(deleted.id, "BACKFILL_F", "bram"))!;
  assert((await recalledFor(deleted.id)).includes(line("Bram", bramF.content)), "the others are still recalled");
  mark = calls.length;
  await memory.checkScenesAfterGeneration(deleted.id, {});
  assert.equal(since(mark, "recollect").length, 0, "upkeep after a reply doesn't write it again");
  await stillDeleted(deleted.id, "after upkeep");
  await memory.initialize(deleted.id);
  assert.equal(since(mark, "recollect").length, 0, "neither does Prepare");
  await stillDeleted(deleted.id, "after Prepare");
  await memory.updateRecord(deleted.id, sceneF.id, { content: "SUMMARY_BACKFILL_F_HAND Ada and Bram met at noon." });
  await memory.maintain(deleted.id);
  assert.deepEqual(
    since(mark, "recollect").map((call) => rosterOf(call.system)),
    [["Bram"]],
    "a changed summary rewrites only the generated one",
  );
  await stillDeleted(deleted.id, "after the summary changed");
  await memory.updateSettings(deleted.id, { characterRecollections: false });
  mark = calls.length;
  await memory.updateSettings(deleted.id, { characterRecollections: true });
  assert.equal((await settle(deleted.id)).status, "ready");
  assert.equal(since(mark, "recollect").length, 0, "turning the setting off and on doesn't write it again");
  await stillDeleted(deleted.id, "after the setting was turned off and on");
  // Export and import, and a branch, keep it deleted.
  const deletedMessages = await chats.listMessages(deleted.id);
  const copyOf = async (name: string) => {
    const created = await chats.create({
      name,
      mode: "roleplay",
      characterIds: ["ada", "bram"],
      connectionId: connection.id,
    });
    assert(created);
    await chats.patchMetadata(created.id, {
      groupChatMode: "merged",
      advancedMemory: { ...settings, narratorCharacterId: null, knowledgeStarts: {} },
    });
    await chats.createMessagesBatch(
      created.id,
      deletedMessages.map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content,
        characterId: message.characterId ?? undefined,
        extra: typeof message.extra === "string" ? JSON.parse(message.extra) : message.extra,
      })),
    );
    return created;
  };
  const importedCopy = await copyOf("Deleted recollection copy");
  await memory.importMemory(importedCopy.id, await memory.exportMemory(deleted.id));
  const branched = await copyOf("Deleted recollection branch");
  const branchedMessages = await chats.listMessages(branched.id);
  await copyAdvancedMemoryRecords({
    db,
    chatId: branched.id,
    records: await memory.exportTransferRecords(deleted.id),
    sourceMessages: deletedMessages,
    messageIds: new Map(deletedMessages.map((message, index) => [message.id, branchedMessages[index]!.id])),
    characterIds: ["ada", "bram"],
    metadata: {},
  });
  for (const [copied, label] of [
    [importedCopy, "an imported copy"],
    [branched, "a branch"],
  ] as const) {
    assert.equal((await recollections(copied.id)).length, 4, `${label} has every recollection`);
    await stillDeleted(copied.id, `${label} keeps it deleted`);
    mark = calls.length;
    await memory.initialize(copied.id);
    assert.equal(since(mark, "recollect").length, 0, `Prepare in ${label} doesn't write it again`);
    await stillDeleted(copied.id, `${label} after Prepare`);
  }
  // Typing one into the empty field saves it as hand-edited, and it is recalled again.
  await memory.updateRecord(deleted.id, adaF.id, { content: "ADA_NEW I remember the tea going cold." });
  const retyped = (await recollectionOf(deleted.id, "BACKFILL_F", "ada"))!;
  assert.deepEqual([retyped.content, retyped.manualOverride], ["ADA_NEW I remember the tea going cold.", true]);
  assert((await recalledFor(deleted.id)).includes(line("Ada", "ADA_NEW I remember the tea going cold.")));
  mark = calls.length;
  await memory.maintain(deleted.id);
  assert.equal(since(mark, "recollect").length, 0);
  assert.equal(
    (await recollectionOf(deleted.id, "BACKFILL_F", "ada"))!.content,
    "ADA_NEW I remember the tea going cold.",
  );

  // ── 12. A paid reply is kept when the run is cancelled or fails after it arrived: Resume doesn't pay again ──
  /** Storage that runs `after` once, right after the first recollection of `chatId` is saved. */
  const onFirstRecollection = (chatId: string, after: () => void) => {
    let armed = true;
    return new Proxy(db, {
      get(target, key, receiver) {
        if (key !== "insert") return Reflect.get(target, key, receiver);
        return (table: Parameters<typeof db.insert>[0]) => {
          const builder = target.insert(table);
          return {
            ...builder,
            values: (row: Record<string, unknown>) =>
              Promise.resolve(builder.values(row as never)).then((value) => {
                if (armed && row.kind === "recollection" && row.chatId === chatId) {
                  armed = false;
                  after();
                }
                return value;
              }),
          };
        };
      },
    });
  };
  // Cancelled while the first scene's reply is being saved: Ada's is saved, Bram's must not be lost with it.
  const cancelled = await summarizedChat("Cancelled while saving", ["BACKFILL_J", "BACKFILL_K"]);
  const cancelling = createAdvancedMemoryService(
    onFirstRecollection(cancelled.id, () => cancelling.cancelActiveOperation(cancelled.id)),
  );
  mark = calls.length;
  await cancelling.updateSettings(cancelled.id, { characterRecollections: true });
  assert.equal((await settle(cancelled.id)).status, "cancelled");
  assert.equal(since(mark, "recollect").length, 1, "the run stopped after the first scene's reply");
  mark = calls.length;
  await memory.initialize(cancelled.id);
  assert.equal((await memory.status(cancelled.id)).job.status, "ready");
  assert.deepEqual(
    since(mark, "recollect").map((call) => /BACKFILL_[A-Z]/u.exec(call.user)?.[0]),
    ["BACKFILL_K"],
    "Resume asks only for the scene that had no reply; the paid one isn't asked again",
  );
  for (const characterId of ["ada", "bram"])
    assert.match((await recollectionOf(cancelled.id, "BACKFILL_J", characterId))?.content ?? "", /_BACKFILL_J /u);
  // The same when the recollections came with the scene's summary: no request of their own pays for them again.
  const withSummary = await chats.create({
    name: "Cancelled while saving a summary",
    mode: "roleplay",
    characterIds: ["ada", "bram"],
    connectionId: connection.id,
  });
  assert(withSummary);
  await chats.patchMetadata(withSummary.id, {
    groupChatMode: "merged",
    advancedMemory: { ...settings, narratorCharacterId: null, knowledgeStarts: {} },
  });
  await chats.createMessagesBatch(withSummary.id, [
    { role: "user", content: "SCENE_TWO Ada and Bram walk down to the harbor.", extra: persona },
    { role: "assistant", characterId: "bram", content: "Bram watches the tide roll in." },
    { role: "user", content: "SCENE_CHANGE A new day.", extra: { ...persona, isConversationStart: true } },
  ]);
  const summaryCancelling = createAdvancedMemoryService(
    onFirstRecollection(withSummary.id, () => summaryCancelling.cancelActiveOperation(withSummary.id)),
  );
  await assert.rejects(summaryCancelling.initialize(withSummary.id), /cancelled/u);
  mark = calls.length;
  await memory.initialize(withSummary.id);
  assert.equal((await memory.status(withSummary.id)).job.status, "ready");
  assert.equal(since(mark, "summary").length + since(mark, "recollect").length, 0, "nothing paid is asked again");
  assert.deepEqual((await recollections(withSummary.id)).map((record) => record.content.split(" ")[0]).sort(), [
    "ADA_TWO",
    "BRAM_TWO",
  ]);
  // A failed save after the reply arrived: the run stops with an error, and Resume uses the saved reply.
  const failedSave = await summarizedChat("Failed while saving", ["BACKFILL_L", "BACKFILL_M"]);
  const failing = createAdvancedMemoryService(
    onFirstRecollection(failedSave.id, () => {
      throw new Error("Unexpected storage failure");
    }),
  );
  mark = calls.length;
  await failing.updateSettings(failedSave.id, { characterRecollections: true });
  const failedJob = await settle(failedSave.id);
  assert.equal(failedJob.status, "error");
  assert.match(failedJob.error ?? "", /Unexpected storage failure/u);
  assert.equal(since(mark, "recollect").length, 2);
  mark = calls.length;
  await memory.initialize(failedSave.id);
  assert.equal((await memory.status(failedSave.id)).job.status, "ready");
  assert.equal(since(mark, "recollect").length, 0, "Resume reuses the reply that arrived before the failure");
  for (const characterId of ["ada", "bram"])
    assert.match((await recollectionOf(failedSave.id, "BACKFILL_L", characterId))?.content ?? "", /_BACKFILL_L /u);

  // ── 13. A recollection run's progress counts scenes, never the parts of one scene's request ──
  const counted = await summarizedChat("Counted", ["BACKFILL_N", "BACKFILL_O"]);
  await chats.patchMetadata(counted.id, {
    advancedMemory: { ...settings, narratorCharacterId: null, knowledgeStarts: {} },
  });
  const events: Array<{ stage: string; completed: number; total: number }> = [];
  await memory.initialize(counted.id, { recollectionsOnly: true, onProgress: (job) => events.push(job) });
  const recollecting = events.filter((job) => job.stage === "recollecting");
  assert(recollecting.length > 0);
  assert.deepEqual(
    [...new Set(recollecting.map((job) => `${job.completed}/${job.total}`))],
    ["0/2", "1/2", "2/2"],
    "the counter goes scene by scene",
  );

  // ── 14. Prepare's summary counter counts scenes too, never the parts of one scene's summary ──
  const prepared: Array<{ stage: string; completed: number; total: number; part?: { completed: number } | null }> = [];
  await summarizedChat("Prepared", ["BACKFILL_P", "BACKFILL_Q", "BACKFILL_R"], true, (job) => prepared.push(job));
  const summarizing = prepared
    .filter((job) => job.stage === "summarizing")
    .map((job) => `${job.completed}/${job.total}`);
  const totals = new Set(prepared.filter((job) => job.stage === "summarizing").map((job) => job.total));
  assert(summarizing.length > 0);
  assert(totals.size === 1 && [...totals][0]! >= 3, `the counter stays on the scenes: ${summarizing.join(", ")}`);
  assert.equal(prepared.at(-1)?.part ?? null, null, "a finished Prepare shows no request part");

  // ── 15. A scene summarized again asks no recollection of whoever has a hand-edited or deleted one ──
  const resummarized = await summarizedChat("Summarized again", ["BACKFILL_S", "BACKFILL_T"], true);
  const adaS = (await recollectionOf(resummarized.id, "BACKFILL_S", "ada"))!;
  await memory.updateRecord(resummarized.id, adaS.id, { content: "" });
  // One of the scene's messages is gone, so its generated summary is written again.
  const messageS = (await chats.listMessages(resummarized.id)).find(
    (message) => message.content === "They talk about BACKFILL_S.",
  )!;
  await chats.removeMessage(messageS.id);
  mark = calls.length;
  await memory.initialize(resummarized.id);
  const summaryS = since(mark, "summary").filter((call) => call.user.includes("BACKFILL_S"));
  assert(summaryS.length > 0, "the changed scene is summarized again");
  assert.deepEqual(
    summaryS.map((call) => cardsOf(call.system).map((card) => card.name)),
    summaryS.map(() => ["Bram"]),
    "only the generated recollection's character is asked for one",
  );
  assert(
    summaryS.every((call) => call.system.includes('this list (IDs and names): [{"name":"Bram","id":"bram"}]')),
    "and the instruction asks only Bram for one",
  );
  const adaSAfter = await recollectionOf(resummarized.id, "BACKFILL_S", "ada");
  assert.deepEqual([adaSAfter?.content, adaSAfter?.manualOverride], ["", true], "Ada's stays deleted");
  console.log("advanced-memory-recollections regression passed");
} finally {
  provider.close();
  rmSync(directory, { recursive: true, force: true });
}
