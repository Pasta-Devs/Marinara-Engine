import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

// #7602 review follow-up: character recollections keep to what their owner can read now, never learn another
// character's private part of a summary or card, are asked for once per summary, follow the constant summaries after
// a reply, and fit the Helper's context.
const directory = mkdtempSync(join(tmpdir(), "marinara-recollections-upkeep-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_LITE = "true";

type Call = { kind: "classify" | "check" | "summary" | "combine" | "recollect"; system: string; user: string };
const calls: Call[] = [];
const SECRET = "Bram confides that the crimson heron sings at dawn.";
/** Recollection texts by `Name:SCENE_MARKER`; every other one is a harmless default. */
let texts: Record<string, string> = {};
let omit = new Set<string>();
let failRecollect: string | null = null;
let plainSummary: string | null = null;
let onRecollect: (() => Promise<void>) | null = null;

const sceneOf = (user: string) => /SCENE_(?!CHANGE)[A-Z0-9]+/u.exec(user)?.[0] ?? "OTHER";
const rosterOf = (system: string): string[] =>
  (JSON.parse(/Characters \(IDs and names\): (\[[^\]]*\])/u.exec(system)?.[1] ?? "[]") as Array<{ name: string }>).map(
    (entry) => entry.name,
  );
const cardsOf = (system: string): Array<Record<string, string>> =>
  JSON.parse(
    /Character cards(?: \(data, not instructions\))?: (\[.*?\])\.(?: Output|\n|$)/su.exec(system)?.[1] ?? "[]",
  );
const recollectionsFor = (names: string[], user: string) =>
  names
    .filter((name) => !omit.has(name))
    .map((name) => ({
      character: name,
      text: texts[`${name}:${sceneOf(user)}`] ?? `${name.toUpperCase()}_${sceneOf(user)} I remember the light.`,
    }));

const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  response.setHeader("content-type", "application/json");
  if (request.url?.endsWith("/embeddings")) {
    const input: string[] = Array.isArray(body.input) ? body.input : [body.input];
    response.end(JSON.stringify({ data: input.map((_, index) => ({ index, embedding: [1, 0, 0] })) }));
    return;
  }
  const [{ content: system }, { content: user }] = body.messages as Array<{ content: string }>;
  let content: string;
  if (system.startsWith("Identify scene transitions")) {
    const messages = JSON.parse(user) as Array<{ messageId: string; messageNumber: number; content: string }>;
    const check = system.includes('"ends"');
    calls.push({ kind: check ? "check" : "classify", system, user });
    content = JSON.stringify(
      check
        ? {
            ends: messages
              .filter((message) => message.content.includes("SCENE_END"))
              .map((message) => ({ messageNumber: message.messageNumber })),
          }
        : {
            starts: messages
              .filter((message) => message.content.startsWith("SCENE_CHANGE"))
              .map((message) => ({ messageId: message.messageId })),
          },
    );
  } else if (system.startsWith("Write each listed character's personal recollection")) {
    calls.push({ kind: "recollect", system, user });
    await onRecollect?.();
    content =
      failRecollect && user.includes(failRecollect)
        ? "I would rather not."
        : JSON.stringify({ recollections: recollectionsFor(rosterOf(system), user) });
  } else {
    const combine = system.includes("Merge them per character");
    calls.push({ kind: combine ? "combine" : "summary", system, user });
    const roster = rosterOf(system);
    content =
      plainSummary && user.includes(plainSummary)
        ? `A plain recap. ${recollectionsFor(roster, user)
            .map((item) => item.text)
            .join(" ")}`
        : JSON.stringify({
            summary: `SUMMARY_${sceneOf(user)} The keepers tended the lamp.`,
            audience: roster,
            ...(system.includes('"recollections"') ? { recollections: recollectionsFor(roster, user) } : {}),
          });
  }
  response.end(JSON.stringify({ choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] }));
});

const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAdvancedMemoryService } = await import("../../packages/server/src/services/advanced-memory.js");
const { characters } = await import("../../packages/server/src/db/schema/characters.js");
const db = await createFileNativeDB();
const chats = createChatsStorage(db);
const memory = createAdvancedMemoryService(db);
const persona = { personaSnapshot: { name: "Mari", description: "a keeper of lamps" } };
const since = (start: number, kind?: Call["kind"]) => calls.slice(start).filter((call) => !kind || call.kind === kind);
const recollections = async (chatId: string) =>
  (await memory.status(chatId)).records.filter((record) => record.kind === "recollection");
const summaries = async (chatId: string) =>
  (await memory.status(chatId)).records
    .filter((record) => record.kind === "scene" && record.id !== record.sceneId && record.content)
    .sort((a, b) => a.startIndex - b.startIndex);
const owned = async (chatId: string, owner: string, scene: number) => {
  const summary = (await summaries(chatId))[scene]!;
  return (await recollections(chatId)).find(
    (record) => record.sceneId === summary.sceneId && record.audienceCharacterIds[0] === owner,
  );
};
const recall = async (chatId: string, audienceCharacterIds: string[]) =>
  (
    await memory.prepare({
      chatId,
      messages: await chats.listMessages(chatId),
      audienceCharacterIds,
      budgetTokens: 50_000,
      readOnly: true,
    })
  ).recalledScenes ?? "";
const hideFrom = async (chatId: string, content: string, ids: string[]) => {
  const message = (await chats.listMessages(chatId)).find((item) => item.content === content)!;
  await chats.updateMessageExtra(message.id, { hiddenFromAICharacterIds: ids });
};
async function settle(chatId: string) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const job = (await memory.status(chatId)).job;
    if (job.status !== "running") return job;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("The memory run did not finish");
}

try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert(address && typeof address === "object");
  const words = (count: number, word: string) => Array.from({ length: count }, () => word).join(" ");
  const card = (name: string, extra: Record<string, unknown> = {}) =>
    JSON.stringify({ name, description: `{{char}} keeps the lighthouse with {{user}}.`, ...extra });
  for (const [id, data] of [
    [
      "ada",
      card("Ada", { scenario: "{{char}} plays opposite {{persona}}.", creator_notes: "CREATOR_NOTES_NEVER_SENT" }),
    ],
    ["bram", card("Bram")],
    // Bram's own secret is in his card; Ada's prompt never holds it.
    ["bramx", card("Bram", { extensions: { backstory: `Only Bram knows ${SECRET.slice(15)}` } })],
    ["cato", card("Cato", { personality: words(2600, "restless") })],
    ["dora", card("Dora", { personality: words(500, "patient") })],
    ["eli", card("Eli", { personality: words(500, "curious") })],
    ["narr", JSON.stringify({ name: "Narrator", description: "The voice of the story." })],
  ] as const)
    await db.insert(characters).values({ id, data, createdAt: "2026-01-01", updatedAt: "2026-01-01" });
  const connections = createConnectionsStorage(db);
  const fixture = (name: string, maxContext: number) =>
    connections.create({
      name,
      provider: "custom",
      model: "fixture",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      apiKey: "fixture",
      maxContext,
      embeddingModel: "fixture",
    });
  const connection = await fixture("Fixture", 65_000);
  const settings = {
    enabled: true,
    characterRecollections: true,
    narratorCharacterId: "narr",
    knowledgeConfirmed: true,
    summaryBudgetTokens: 8000,
    retrieveMaxScenes: 5,
    retrieveMinMessages: 1,
    retrieveMaxMessages: 3,
  };
  async function lighthouse(name: string, bram = "bram", hidden: Record<number, string[]> = {}) {
    const chat = await chats.create({
      name,
      mode: "roleplay",
      characterIds: ["ada", bram, "narr"],
      connectionId: connection.id,
    });
    assert(chat);
    await chats.patchMetadata(chat.id, {
      groupChatMode: "individual",
      advancedMemory: { ...settings, knowledgeStarts: { ada: null, [bram]: null } },
    });
    const lines: Array<[string | null, string]> = [
      [null, "SCENE_ONE Mari, Ada and Bram climb up to repair the lighthouse lamp."],
      ["ada", "Ada calibrates the lens with careful fingers."],
      [bram, SECRET],
      [null, "The lamp finally shines again over the bay."],
      [null, "SCENE_CHANGE SCENE_TWO Ada and Bram walk down to the harbor."],
      [bram, "Bram shows Ada his silver compass by the pier."],
    ];
    await chats.createMessagesBatch(chat.id, [
      ...lines.map(([author, content], index) => ({
        role: author ? ("assistant" as const) : ("user" as const),
        content,
        ...(author ? { characterId: author } : {}),
        extra: { ...(author ? {} : persona), ...(hidden[index] ? { hiddenFromAICharacterIds: hidden[index] } : {}) },
      })),
      { role: "user", content: "SCENE_CHANGE The next morning.", extra: { ...persona, isConversationStart: true } },
    ]);
    return chat;
  }
  const line = (name: string, text: string) => `${name}'s personal recollections from this scene: *${text}*`;

  // ── 1. A recollection counts only while its owner can read what they could when it was written ──
  texts = { "Ada:SCENE_ONE": "ADA_ONE I keep thinking the crimson heron sings at dawn." };
  const access = await lighthouse("Access");
  await memory.initialize(access.id);
  assert((await recall(access.id, ["ada"])).includes(line("Ada", texts["Ada:SCENE_ONE"]!)), "Ada could read it then");
  const adaTwo = (await owned(access.id, "ada", 1))!;
  await memory.updateRecord(access.id, adaTwo.id, { content: "ADA_HAND Bram showed me his silver compass." });
  await hideFrom(access.id, SECRET, ["ada"]);
  await hideFrom(access.id, "Bram shows Ada his silver compass by the pier.", ["ada"]);
  assert.equal((await owned(access.id, "ada", 0))!.embeddingStatus, "stale", "the generated one is out of date");
  assert.equal((await owned(access.id, "ada", 1))!.embeddingStatus, "stale", "the hand-edited one needs a review");
  let mark = calls.length;
  await memory.maintain(access.id);
  // The redone summary keeps its text, and its copy of the secret for Ada is left out again: her old recollection
  // is replaced by an empty one, never shown again.
  assert.equal(since(mark, "summary").length, 2, "both scenes are summarized again for the new access");
  assert.deepEqual(
    since(mark, "recollect").map((call) => [sceneOf(call.user), rosterOf(call.system)]),
    [["SCENE_ONE", ["Ada"]]],
    "only Ada's left-out recollection is asked for again; her hand-edited one is never replaced",
  );
  assert.equal((await owned(access.id, "ada", 0))!.content, "", "nothing Ada can know was written for her");
  let forAda = await recall(access.id, ["ada"]);
  assert(forAda.includes("SUMMARY_SCENE_ONE") && !forAda.includes("crimson heron"), "the secret never reaches Ada");
  assert(!forAda.includes("ADA_HAND"), "a hand-edited recollection waits for its review");
  mark = calls.length;
  await memory.maintain(access.id);
  assert.equal(since(mark).length, 0, "the empty one is not asked for again while the summary stays");
  await memory.updateRecord(access.id, adaTwo.id, { content: "ADA_HAND Bram showed me his silver compass." });
  assert.notEqual((await owned(access.id, "ada", 1))!.embeddingStatus, "stale");
  forAda = await recall(access.id, ["ada"]);
  assert(forAda.includes(line("Ada", "ADA_HAND Bram showed me his silver compass.")), "saving it again reviews it");

  // ── 2. A part of a Chat Summary written for Bram never shapes Ada's; a corrected summary is followed ──
  texts = {
    "Ada:SCENE_ONE": "ADA I know Bram hid the brass key under the third stair.",
    "Bram:SCENE_ONE": "*BRAM I hid it well.* *Ada's steady hands.*",
  };
  const entries = await lighthouse("Entries");
  const scene = (await chats.listMessages(entries.id)).slice(0, 4).map((message) => message.id);
  await chats.patchMetadata(entries.id, {
    summaryEntries: [
      {
        id: "entry-key",
        kind: "summary",
        origin: "manual",
        title: "Lamp",
        content:
          'Ada and Bram fixed the lamp. {{#if char == "Bram"}}Bram hid the brass key under the third stair.{{/if}}',
        enabled: true,
        sourceMode: "range",
        messageIds: scene,
        tokenEstimate: 20,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    ],
  });
  mark = calls.length;
  await memory.initialize(entries.id);
  const summaryCall = since(mark, "summary").find((call) => call.user.includes("SCENE_ONE"))!;
  assert.match(
    summaryCall.system,
    /Text inside a \{\{#if char == …\}\} section is known only to the characters its condition names\./u,
  );
  assert.match(summaryCall.system, /no asterisks anywhere/u);
  assert.equal(
    cardsOf(summaryCall.system).find((item) => item.name === "Ada")!.scenario,
    "Ada plays opposite a keeper of lamps.",
    "card macros resolve as in a reply's prompt, the persona included",
  );
  // #8582: creator notes are never sent to a model, the summarizer included.
  assert.equal(cardsOf(summaryCall.system).find((item) => item.name === "Ada")!.creatorNotes, undefined);
  assert.equal(summaryCall.system.includes("CREATOR_NOTES_NEVER_SENT"), false);
  const refill = since(mark, "recollect");
  assert.equal(refill.length, 1, "Ada's left-out recollection is asked for once more");
  assert(refill[0]!.user.includes(`User-corrected summary (preserve every character condition):\nAda and Bram fixed`));
  assert.equal((await owned(entries.id, "ada", 0))!.content, "", "her copy of Bram's part is left out again");
  assert.equal(
    (await owned(entries.id, "bram", 0))!.content,
    "BRAM I hid it well. Ada's steady hands.",
    "no asterisks",
  );
  assert(!(await recall(entries.id, ["ada"])).includes("brass key"));
  texts = {};
  const entrySummary = (await summaries(entries.id))[0]!;
  await memory.updateRecord(entries.id, entrySummary.id, {
    content: "CORRECTED_SUMMARY Ada slipped on the ladder and broke her wrist.",
  });
  mark = calls.length;
  await memory.maintain(entries.id);
  const corrected = since(mark, "recollect");
  assert.equal(corrected.length, 1);
  assert.deepEqual(rosterOf(corrected[0]!.system), ["Ada", "Bram"], "a corrected summary asks for both again");
  assert(
    corrected[0]!.user.includes("User-corrected scene summary (honor its corrections):\nCORRECTED_SUMMARY"),
    "the request follows the corrected summary",
  );
  assert.match((await owned(entries.id, "ada", 0))!.content, /^ADA_SCENE_ONE /u);

  // ── 3. Only Ada's own card is hers: words in Bram's card don't make a copied secret hers ──
  texts = { "Ada:SCENE_ONE": "ADA I keep thinking the crimson heron sings at dawn." };
  const cards = await lighthouse("Cards", "bramx", { 2: ["ada"] });
  await memory.initialize(cards.id);
  assert.equal((await owned(cards.id, "ada", 0))!.content, "");
  assert(!(await recall(cards.id, ["ada"])).includes("crimson heron"));

  // ── 4. Everyday wording is no leak; a copied fact is ──
  texts = {
    "Ada:SCENE_ONE": "ADA I really want to forget how dark the stair was.",
    "Ada:SCENE_TWO": "ADA The cracked lens will fail by winter.",
  };
  const everyday = await chats.create({
    name: "Everyday",
    mode: "roleplay",
    characterIds: ["ada", "bram", "narr"],
    connectionId: connection.id,
  });
  assert(everyday);
  await chats.patchMetadata(everyday.id, {
    groupChatMode: "individual",
    advancedMemory: { ...settings, knowledgeStarts: { ada: null, bram: null } },
  });
  await chats.createMessagesBatch(everyday.id, [
    { role: "user", content: "SCENE_ONE I want the lamp lit; I really need to hurry.", extra: persona },
    { role: "assistant", characterId: "ada", content: "Really? I want to check the oil first." },
    { role: "user", content: "I really think you want to rest, but we have to go.", extra: persona },
    {
      role: "assistant",
      characterId: "bram",
      content: "I really want to tell Mari about the lens.",
      extra: { hiddenFromAICharacterIds: ["ada"] },
    },
    { role: "user", content: "SCENE_CHANGE SCENE_TWO Back on the gallery.", extra: persona },
    {
      role: "assistant",
      characterId: "bram",
      content: "The cracked lens will fail by winter, I fear.",
      extra: { hiddenFromAICharacterIds: ["ada"] },
    },
    { role: "user", content: "SCENE_CHANGE The next morning.", extra: { ...persona, isConversationStart: true } },
  ]);
  await memory.initialize(everyday.id);
  assert.equal(
    (await owned(everyday.id, "ada", 0))!.content,
    texts["Ada:SCENE_ONE"],
    "words Ada read in several messages are hers, even in a phrase only Bram said",
  );
  assert.equal((await owned(everyday.id, "ada", 1))!.content, "", "a fact only Bram said is not");

  // ── 5. Asked once per summary; upkeep follows the constants, newest first; a failure waits for Resume ──
  texts = {};
  omit = new Set(["Bram"]);
  const upkeep = await chats.create({
    name: "Upkeep",
    mode: "roleplay",
    characterIds: ["ada", "bram"],
    connectionId: connection.id,
  });
  assert(upkeep);
  await chats.patchMetadata(upkeep.id, {
    groupChatMode: "merged",
    advancedMemory: { ...settings, narratorCharacterId: null, knowledgeStarts: {} },
  });
  const sceneLines = (tag: string, first = false) => [
    { role: "user" as const, content: `${first ? "" : "SCENE_CHANGE "}${tag} Ada and Bram meet.`, extra: persona },
    { role: "assistant" as const, characterId: "ada", content: `Ada talks in ${tag}.` },
    { role: "assistant" as const, characterId: "bram", content: `Bram answers in ${tag}.` },
  ];
  await chats.createMessagesBatch(upkeep.id, [
    ...sceneLines("SCENE_S1", true),
    ...sceneLines("SCENE_S2"),
    ...sceneLines("SCENE_S3"),
    ...sceneLines("SCENE_S4"),
    { role: "user", content: "SCENE_CHANGE SCENE_OPEN The next day.", extra: persona },
  ]);
  mark = calls.length;
  await memory.initialize(upkeep.id);
  assert.deepEqual(
    since(mark, "recollect").map((call) => [sceneOf(call.user), rosterOf(call.system)]),
    ["SCENE_S1", "SCENE_S2", "SCENE_S3", "SCENE_S4"].map((tag) => [tag, ["Bram"]]),
    "the Helper left Bram out of each summary; each scene is asked once more",
  );
  const bramEmpty = (await recollections(upkeep.id)).filter((record) => record.audienceCharacterIds[0] === "bram");
  assert.equal(bramEmpty.length, 4);
  assert(bramEmpty.every((record) => !record.content && record.embeddingStatus !== "stale"));
  assert.equal((await memory.status(upkeep.id)).job.status, "ready");
  mark = calls.length;
  await memory.maintain(upkeep.id);
  await memory.initialize(upkeep.id);
  assert.equal(since(mark, "recollect").length, 0, "no run asks for Bram again while the summaries stay");
  omit = new Set();
  for (const summary of await summaries(upkeep.id))
    await memory.updateRecord(upkeep.id, summary.id, { content: `CORRECTED ${summary.content}` });
  // A new start makes every scene a constant summary in the same run as the recollections.
  await chats.createMessagesBatch(upkeep.id, [
    { role: "user", content: "A fresh start far away.", extra: { ...persona, isConversationStart: true } },
  ]);
  const constantsFirst: boolean[] = [];
  onRecollect = async () => {
    const metadata = (await chats.getById(upkeep.id))!.metadata;
    const saved = (typeof metadata === "string" ? JSON.parse(metadata) : metadata).summaryEntries ?? [];
    constantsFirst.push(saved.some((entry: { content: string }) => entry.content.includes("CORRECTED SUMMARY_S")));
  };
  mark = calls.length;
  await memory.checkScenesAfterGeneration(upkeep.id, {});
  await settle(upkeep.id);
  onRecollect = null;
  assert.deepEqual(
    since(mark, "recollect").map((call) => sceneOf(call.user)),
    ["SCENE_S4", "SCENE_S3", "SCENE_S2"],
    "after a reply, three scenes are brought up to date, the newest first",
  );
  assert.deepEqual(constantsFirst, [true, true, true], "the constant summaries are written before them");
  assert.equal((await memory.status(upkeep.id)).job.status, "ready");
  failRecollect = "SCENE_S1";
  mark = calls.length;
  await memory.checkScenesAfterGeneration(upkeep.id, {});
  await settle(upkeep.id);
  assert.deepEqual(
    since(mark, "recollect").map((call) => sceneOf(call.user)),
    ["SCENE_S1"],
  );
  assert.equal((await memory.status(upkeep.id)).job.status, "ready", "a failure after a reply stops nothing");
  mark = calls.length;
  await memory.checkScenesAfterGeneration(upkeep.id, {});
  await settle(upkeep.id);
  assert.equal(since(mark, "recollect").length, 0, "and later replies don't pay for it again");
  mark = calls.length;
  await memory.initialize(upkeep.id);
  let job = await settle(upkeep.id);
  assert.equal(since(mark, "recollect").length, 1, "Prepare and Resume try the failed scene again");
  assert.equal(job.status, "error");
  assert.match(job.error ?? "", /^Character recollections could not be written for 1 scene: /u);
  failRecollect = null;
  await memory.updateSettings(upkeep.id, { characterRecollections: false });
  mark = calls.length;
  await memory.updateSettings(upkeep.id, { characterRecollections: true });
  job = await settle(upkeep.id);
  assert.equal(since(mark, "recollect").length, 1, "turning the setting on again resumes a stopped recollection run");
  assert.equal(job.status, "ready");
  assert(
    (await recollections(upkeep.id)).every((record) => record.content && record.embeddingStatus !== "stale"),
    "every scene now has both recollections",
  );

  // ── 6. Cards that would split a scene stay out of its summary; a card too long for the Helper gets none ──
  const small = await fixture("Small window", 14_000);
  const sized = await chats.create({
    name: "Sized",
    mode: "roleplay",
    characterIds: ["dora", "eli", "cato"],
    connectionId: small.id,
  });
  assert(sized);
  await chats.patchMetadata(sized.id, {
    groupChatMode: "merged",
    advancedMemory: { ...settings, narratorCharacterId: null, knowledgeStarts: {} },
  });
  const talk = " The tide, the lamp and the long stair kept everyone busy until late.".repeat(12);
  await chats.createMessagesBatch(sized.id, [
    { role: "user", content: `SCENE_SIZED Dora, Eli and Cato keep watch.${talk}`, extra: persona },
    { role: "assistant", characterId: "dora", content: `Dora keeps count.${talk}` },
    { role: "assistant", characterId: "eli", content: `Eli asks questions.${talk}` },
    { role: "assistant", characterId: "cato", content: "Cato paces." },
    { role: "user", content: "SCENE_CHANGE The next morning.", extra: { ...persona, isConversationStart: true } },
  ]);
  mark = calls.length;
  await memory.initialize(sized.id);
  assert.equal((await settle(sized.id)).status, "ready", "a card too long for the Helper stops nothing");
  const sizedSummary = since(mark, "summary");
  assert.equal(sizedSummary.length, 1, "the scene is summarized in one request");
  assert(!sizedSummary[0]!.system.includes("Character cards"), "without the cards that would have split it");
  assert.deepEqual(
    since(mark, "recollect").map((call) => cardsOf(call.system).map((item) => item.name)),
    [["Dora"], ["Eli"]],
    "the recollections follow one character at a time, and Cato's card is never sent",
  );
  const sizedSaved = await recollections(sized.id);
  assert.deepEqual(sizedSaved.map((record) => [record.audienceCharacterIds[0], !!record.content]).sort(), [
    ["cato", false],
    ["dora", true],
    ["eli", true],
  ]);
  mark = calls.length;
  await memory.initialize(sized.id);
  assert.equal(since(mark, "recollect").length, 0, "Cato's is not asked for again");

  // ── 7. A reply that isn't the asked-for JSON never becomes a summary holding everyone's recollections ──
  plainSummary = "SCENE_ONE";
  const plain = await lighthouse("Plain");
  await assert.rejects(memory.initialize(plain.id), /did not return the JSON it was asked for/u);
  assert(!(await summaries(plain.id)).some((record) => record.content.includes("A plain recap")));
  plainSummary = null;
  console.log("advanced-memory-recollections-upkeep regression passed");
} finally {
  provider.close();
  rmSync(directory, { recursive: true, force: true });
}
