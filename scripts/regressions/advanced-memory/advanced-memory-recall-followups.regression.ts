import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

// #7184: scene participants survive name differences, receipts say why nothing was recalled,
// older scenes get their participants checked after a reply, and swipes see newly saved scenes.
const directory = mkdtempSync(join(tmpdir(), "marinara-recall-followups-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_LITE = "true";

const FILLER = " They talked for a long while about small things, the weather and the road home.".repeat(6);
const participantChecks: string[] = [];
let failNextParticipantCheck = false;
let matrixAudience: unknown;
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  response.setHeader("content-type", "application/json");
  if (request.url?.endsWith("/embeddings")) {
    response.end(
      JSON.stringify({ data: body.input.map((_: string, index: number) => ({ index, embedding: [1, 0, 0] })) }),
    );
    return;
  }
  const [system, transcript] = body.messages;
  const text: string = transcript.content;
  let content: string;
  if (system.content.startsWith("Identify scene transitions")) {
    const messages = JSON.parse(text) as Array<{ messageId: string; messageNumber: number; content: string }>;
    content = JSON.stringify(
      system.content.includes('"ends"')
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
  } else {
    const checkOnly = system.content.startsWith("Identify the participants");
    if (checkOnly) participantChecks.push(text);
    // The helper answers with a first name, no audience, null, a stranger, or "all".
    const audience = text.includes("AUD_MATRIX")
      ? { audience: matrixAudience }
      : text.includes("AUD_FIRSTNAME")
        ? { audience: ["Kaito"] }
        : text.includes("AUD_MISSING")
          ? {}
          : text.includes("AUD_NULL")
            ? { audience: null }
            : text.includes("AUD_STRANGER")
              ? { audience: ["A stranger"] }
              : { audience: "all" };
    const summary = text.includes("AUD_FIRSTNAME")
      ? "HARBOR: Mari and Kaito talked about the lighthouse key at the harbor."
      : text.includes("AUD_MISSING")
        ? "CURRY: Mari and Kaito cooked curry."
        : text.includes("AUD_STRANGER")
          ? "STRANGER: A stranger passed the shop."
          : text.includes("FESTIVAL")
            ? "FESTIVAL: Mari and Kaito released paper lanterns at the festival."
            : "EVENING: Mari and Kaito said good night.";
    content =
      checkOnly && failNextParticipantCheck
        ? "I cannot tell who was there."
        : JSON.stringify({ summary: `${summary}${FILLER}`, ...audience });
    if (checkOnly) failNextParticipantCheck = false;
  }
  response.end(JSON.stringify({ choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] }));
});

const { createFileNativeDB } = await import("../../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../../packages/server/src/services/storage/connections.storage.js");
const { createAdvancedMemoryService } = await import("../../../packages/server/src/services/advanced-memory.js");
const { prepareAdvancedMemoryContext } =
  await import("../../../packages/server/src/services/generation/advanced-memory-context.js");
const { advancedMemoryRecords } = await import("../../../packages/server/src/db/schema/advanced-memory.js");
const { characters } = await import("../../../packages/server/src/db/schema/characters.js");
const { eq } = await import("../../../packages/server/src/db/file-query.js");
const { estimateChatSummaryTokens } = await import("../../../packages/shared/src/index.js");
const db = await createFileNativeDB();
const chats = createChatsStorage(db);
const memory = createAdvancedMemoryService(db);
try {
  await db.insert(characters).values({
    id: "kaito",
    data: JSON.stringify({ name: "Kaito Nakamura" }),
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  });
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Follow-up fixture",
    provider: "custom",
    model: "fixture",
    apiKey: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    maxContext: 65000,
    embeddingModel: "fixture",
  });
  const settings = {
    enabled: true,
    knowledgeStarts: { kaito: null },
    knowledgeConfirmed: true,
    retrieveMaxScenes: 5,
    retrieveMinMessages: 1,
    retrieveMaxMessages: 2,
  };

  // (1) With nothing saved yet, the receipt must not claim that relevance was judged.
  const fresh = await chats.create({
    name: "Fresh",
    mode: "roleplay",
    characterIds: ["kaito"],
    connectionId: connection.id,
  });
  assert(fresh);
  await memory.updateSettings(fresh.id, settings);
  await chats.createMessagesBatch(fresh.id, [
    { role: "user", content: "Kaito, do you remember the lighthouse key?" },
    { role: "assistant", characterId: "kaito", content: "I do." },
  ]);
  const empty = await memory.prepare({
    chatId: fresh.id,
    messages: await chats.listMessages(fresh.id),
    audienceCharacterIds: ["kaito"],
    budgetTokens: 50000,
    readOnly: true,
  });
  assert(empty.receipt.reasons.includes("no-recall-candidates"), JSON.stringify(empty.receipt.reasons));
  assert(!empty.receipt.reasons.includes("no-relevant-recall"), "no candidates is not a relevance judgement");

  // (2) A null audience is a format slip too, not "nobody".
  const nulled = await chats.create({
    name: "Null",
    mode: "roleplay",
    characterIds: ["kaito"],
    connectionId: connection.id,
  });
  assert(nulled);
  await memory.updateSettings(nulled.id, settings);
  await chats.createMessagesBatch(nulled.id, [
    { role: "user", content: "SCENE_CHANGE AUD_NULL Mari and Kaito fix the roof." },
    { role: "assistant", characterId: "kaito", content: "Kaito hammers the last nail." },
    { role: "user", content: "SCENE_CHANGE Later that week.", extra: { isConversationStart: true } },
  ]);
  await memory.initialize(nulled.id);
  const roof = (await memory.status(nulled.id)).records.find((record) => record.kind === "scene" && record.content)!;
  assert.deepEqual(roof.audienceCharacterIds, ["kaito"], "a null audience keeps the only character");

  const chat = await chats.create({
    name: "Harbor",
    mode: "roleplay",
    characterIds: ["kaito"],
    connectionId: connection.id,
  });
  assert(chat);
  await memory.updateSettings(chat.id, settings);
  await chats.createMessagesBatch(chat.id, [
    { role: "user", content: "SCENE_CHANGE AUD_FIRSTNAME Mari and Kaito walk along the harbor." },
    { role: "assistant", characterId: "kaito", content: "Kaito turns the lighthouse key over in his hand." },
    { role: "user", content: "SCENE_CHANGE AUD_MISSING Mari and Kaito cook dinner." },
    { role: "assistant", characterId: "kaito", content: "Kaito stirs the curry." },
    { role: "user", content: "SCENE_CHANGE AUD_STRANGER A stranger walks past the shop." },
    { role: "assistant", characterId: "kaito", content: "Kaito watches the stranger leave." },
    { role: "user", content: "SCENE_CHANGE FESTIVAL Mari and Kaito go to the summer festival." },
    { role: "assistant", characterId: "kaito", content: "Kaito lets a paper lantern drift away." },
    {
      role: "user",
      content: "SCENE_CHANGE Kaito, do you remember the lantern festival and the lighthouse key?",
      extra: { isConversationStart: true },
    },
    // Live history must be large enough to leave a measurable remainder for memories.
    {
      role: "assistant",
      characterId: "kaito",
      content: `Kaito pours tea.${" The kettle hums on the stove.".repeat(40)}`,
    },
  ]);
  await memory.initialize(chat.id);
  const scenes = async () =>
    (await memory.status(chat.id)).records.filter((record) => record.kind === "scene" && record.content);
  const scene = async (label: string) => (await scenes()).find((record) => record.content.startsWith(label))!;

  // (2) "Kaito" is Kaito Nakamura, and a 1:1 chat's missing audience is not "nobody".
  assert.deepEqual((await scene("HARBOR")).audienceCharacterIds, ["kaito"], "a unique first name matches the card");
  assert.deepEqual(
    (await scene("CURRY")).audienceCharacterIds,
    ["kaito"],
    "a missing audience keeps the only character",
  );
  assert.deepEqual((await scene("STRANGER")).audienceCharacterIds, [], "an unknown name grants no access");
  assert.deepEqual((await scene("FESTIVAL")).audienceCharacterIds, ["kaito"]);
  assert(
    (await memory.status(chat.id)).warnings.includes("scene-audience-unmatched"),
    "an unmatched participant is flagged instead of silently dropped",
  );
  const source = await chats.listMessages(chat.id);
  const harborId = (await scene("HARBOR")).sceneId;
  const festivalId = (await scene("FESTIVAL")).sceneId;
  const recall = (budgetTokens: number) =>
    memory.prepare({
      chatId: chat.id,
      messages: source,
      audienceCharacterIds: ["kaito"],
      budgetTokens,
      readOnly: true,
    });
  const full = await recall(50000);
  assert(
    [harborId, festivalId].every((id) => full.receipt.recalledSceneIds.includes(id)),
    "the harbor scene is recalled for Kaito",
  );

  // (1) Without room for memories, the receipt says so rather than "nothing relevant".
  const used = full.receipt.estimatedTokensAfter - 192 - estimateChatSummaryTokens(full.recalledScenes ?? "");
  for (const room of [32, 100]) {
    const tight = await recall(used + 192 + room);
    assert.equal(tight.recalledScenes, null);
    assert(tight.receipt.reasons.includes("no-recall-budget"), `${room}: ${JSON.stringify(tight.receipt.reasons)}`);
    assert(!tight.receipt.reasons.includes("no-relevant-recall"), "relevant scenes that do not fit are not irrelevant");
  }

  // (4) A swipe recalls again when a scene was saved after the reply it would reuse.
  const memorySettings = (await memory.status(chat.id)).settings;
  const reply = (cachedSnapshots?: unknown[]) =>
    prepareAdvancedMemoryContext({
      service: memory,
      chatId: chat.id,
      settings: memorySettings,
      sourceMessages: source,
      messages: [{ role: "user", content: "Continue the story." }],
      placements: [],
      audienceCharacterIds: ["kaito"],
      cachedSnapshots,
      toProviderMessages: (messages) => messages,
    });
  const festivalRows = (await db.select().from(advancedMemoryRecords)).filter((row) => row.sceneId === festivalId);
  for (const row of festivalRows) await db.delete(advancedMemoryRecords).where(eq(advancedMemoryRecords.id, row.id));
  const first = await reply();
  assert(!first.receipt.recalledSceneIds.includes(festivalId), "the festival scene is not saved yet");
  await memory.initialize(chat.id, { detectScenes: false });
  const swiped = await reply([first.snapshot]);
  assert(!swiped.receipt.reasons.includes("reused-swipe-memory"), "a newly saved scene invalidates the old snapshot");
  assert(swiped.receipt.recalledSceneIds.includes(festivalId), "the swipe recalls the newly saved scene");
  const unchanged = await reply([swiped.snapshot]);
  assert(unchanged.receipt.reasons.includes("reused-swipe-memory"), "an unchanged archive still reuses the snapshot");
  assert.deepEqual(unchanged.receipt.recalledSceneIds, swiped.receipt.recalledSceneIds);

  // (3) Summaries from before the participant check are repaired by after-reply maintenance, a few per run.
  for (const record of await scenes())
    await db
      .update(advancedMemoryRecords)
      .set({ dependencies: "[]", audienceCharacterIds: '["kaito"]' })
      .where(eq(advancedMemoryRecords.id, record.id));
  assert(
    (await scenes()).every((record) => !record.audienceCharacterIds.length),
    "older summaries start narrator-only",
  );
  await memory.updateSettings(chat.id, { sceneCheckInterval: 1 });
  const endScene = async (content: string) => {
    await chats.createMessage({ chatId: chat.id, role: "assistant", characterId: "kaito", content });
    await memory.checkScenesAfterGeneration(chat.id);
  };
  failNextParticipantCheck = true;
  await endScene("SCENE_END Kaito says good night.");
  const firstRun = await memory.status(chat.id);
  assert.equal(firstRun.job.status, "ready", "a failed participant check does not fail the new scene's archive");
  assert.equal(participantChecks.length, 3, "one run checks at most three older scenes");
  assert(
    (await scenes()).some((record) => record.content.startsWith("EVENING")),
    "the scene that just ended is saved",
  );
  assert.deepEqual((await scene("HARBOR")).audienceCharacterIds, [], "the failed check grants nothing");
  assert.deepEqual((await scene("CURRY")).audienceCharacterIds, ["kaito"]);
  assert.deepEqual((await scene("FESTIVAL")).audienceCharacterIds, [], "the fourth older scene waits its turn");
  await endScene("SCENE_END Kaito turns off the light.");
  assert.equal(participantChecks.length, 4, "the next run moves on instead of retrying the failed scene");
  assert.deepEqual((await scene("FESTIVAL")).audienceCharacterIds, ["kaito"]);
  assert.deepEqual((await scene("HARBOR")).audienceCharacterIds, []);
  await memory.initialize(chat.id, { detectScenes: false });
  assert.equal(participantChecks.length, 5, "Prepare existing history retries the failed scene");
  assert.deepEqual((await scene("HARBOR")).audienceCharacterIds, ["kaito"]);
  await endScene("SCENE_END Morning comes.");
  assert.equal(participantChecks.length, 5, "checked scenes are not checked again");

  // (2) Looser names never give a scene to the wrong person: the user's persona, a shared first name,
  // a description or an annotation leaves the scene narrator-only and flagged instead.
  for (const [id, name] of [
    ["rossi", "Mari Rossi"],
    ["tanaka", "Kaito Tanaka"],
  ])
    await db
      .insert(characters)
      .values({ id, data: JSON.stringify({ name }), createdAt: "2026-01-01", updatedAt: "2026-01-01" });
  for (const [answer, characterIds, expected, flagged, label, hiddenFrom = []] of [
    [["Mari", "Kaito"], ["kaito", "rossi"], ["kaito"], true, "the persona Mari could be Mari Rossi"],
    [["Mari Rossi", "Mari"], ["kaito", "rossi"], ["rossi"], true, "a full name still counts"],
    [["Mari", "User"], ["kaito"], [], false, "the user alone is a user-only scene, not a mistake"],
    [["Kaito"], ["kaito", "tanaka"], [], true, "two characters share the first name"],
    [["Kaito Nakamura (mentioned only)"], ["kaito"], [], true, "an annotated name is not a plain name"],
    [["sister of Kaito Nakamura"], ["kaito"], [], true, "a description naming a character"],
    [[{ name: "Kaito Nakamura" }], ["kaito"], [], true, "an object is not a name"],
    [{ Kaito: false }, ["kaito"], [], true, "an unreadable answer is not a missing one"],
    // Mari decided on 2026-10-07 (#7184): a group scene with no listed participants goes to every
    // character and is flagged, so the user removes anyone who wasn't there. It was narrator-only before.
    [undefined, ["kaito", "tanaka"], ["kaito", "tanaka"], true, "a group's missing audience goes to everyone"],
    [null, ["kaito", "tanaka"], ["kaito", "tanaka"], true, "a group's null audience goes to everyone"],
    [undefined, ["kaito", "tanaka"], ["tanaka"], true, "everyone skips a hidden character", ["kaito"]],
    [undefined, ["kaito"], ["kaito"], false, "a one-character chat's missing audience is unchanged"],
    [null, ["kaito"], ["kaito"], false, "a one-character chat's null audience is unchanged"],
    [[], ["kaito", "tanaka"], [], false, "a group's empty list is a user-only scene"],
    [{ Kaito: false }, ["kaito", "tanaka"], [], true, "a group's unreadable answer still grants nothing"],
    [["sister of Kaito Nakamura"], ["kaito", "tanaka"], [], true, "a group's description still grants nothing"],
  ] as Array<[unknown, string[], string[], boolean, string, string[]?]>) {
    matrixAudience = answer;
    const matrix = await chats.create({ name: label, mode: "roleplay", characterIds, connectionId: connection.id });
    assert(matrix);
    await memory.updateSettings(matrix.id, {
      ...settings,
      knowledgeStarts: Object.fromEntries(characterIds.map((id) => [id, null])),
    });
    const persona = { personaSnapshot: { name: "Mari" } };
    const hidden = hiddenFrom.length ? { hiddenFromAICharacterIds: hiddenFrom } : {};
    await chats.createMessagesBatch(matrix.id, [
      { role: "user", content: "SCENE_CHANGE AUD_MATRIX Mari waits at the pier.", extra: { ...persona, ...hidden } },
      { role: "assistant", characterId: characterIds.at(-1), content: "The boats come in.", extra: hidden },
      { role: "user", content: "SCENE_CHANGE Later.", extra: { ...persona, isConversationStart: true } },
    ]);
    await memory.initialize(matrix.id);
    const status = await memory.status(matrix.id);
    const saved = status.records.find((record) => record.kind === "scene" && record.content)!;
    assert.deepEqual(saved.audienceCharacterIds, expected, label);
    assert.equal(status.warnings.includes("scene-audience-unmatched"), flagged, `${label}: warning`);
    // The participant check for older scenes reads the same answer the same way.
    await db
      .update(advancedMemoryRecords)
      .set({ dependencies: "[]", audienceCharacterIds: "[]" })
      .where(eq(advancedMemoryRecords.id, saved.id));
    const checks = participantChecks.length;
    await memory.initialize(matrix.id, { detectScenes: false });
    assert.equal(participantChecks.length, checks + 1, `${label}: older-scene check ran`);
    const checked = await memory.status(matrix.id);
    assert.deepEqual(
      checked.records.find((record) => record.id === saved.id)!.audienceCharacterIds,
      expected,
      `${label}: older-scene check`,
    );
    assert.equal(checked.warnings.includes("scene-audience-unmatched"), flagged, `${label}: older-scene warning`);
    if (expected.length < 2) continue;
    // Edit character access removes someone who wasn't there, and later preparation keeps that choice.
    await memory.updateRecord(matrix.id, saved.id, { audienceCharacterIds: [expected[0]!] });
    const before = participantChecks.length;
    await memory.initialize(matrix.id, { detectScenes: false });
    const edited = await memory.status(matrix.id);
    assert.deepEqual(edited.records.find((record) => record.id === saved.id)!.audienceCharacterIds, [expected[0]]);
    assert(!edited.warnings.includes("scene-audience-unmatched"), `${label}: saving access clears the warning`);
    assert.equal(participantChecks.length, before, `${label}: an edited scene is not checked again`);
  }

  // (4) A scene that ends inside the swiped reply's live messages cannot be recalled, so the swipe reuses its memory.
  const walk = await chats.create({
    name: "Walk",
    mode: "roleplay",
    characterIds: ["kaito"],
    connectionId: connection.id,
  });
  assert(walk);
  await memory.updateSettings(walk.id, { ...settings, sceneCheckInterval: 2 });
  await chats.createMessagesBatch(walk.id, [
    { role: "user", content: "SCENE_CHANGE FESTIVAL Mari and Kaito go to the summer festival." },
    { role: "assistant", characterId: "kaito", content: "Kaito lets a paper lantern drift away." },
    {
      role: "user",
      content: "SCENE_CHANGE Kaito, do you remember the lantern festival? Let us walk home.",
      extra: { isConversationStart: true },
    },
    { role: "assistant", characterId: "kaito", content: "Kaito nods, and they walk the road home." },
  ]);
  await memory.initialize(walk.id);
  await chats.createMessage({ chatId: walk.id, role: "user", content: "We reach the door. SCENE_END" });
  const walkSource = await chats.listMessages(walk.id);
  const walkSettings = (await memory.status(walk.id)).settings;
  const walkReply = (cachedSnapshots?: unknown[]) =>
    prepareAdvancedMemoryContext({
      service: memory,
      chatId: walk.id,
      settings: walkSettings,
      sourceMessages: walkSource,
      messages: [{ role: "user", content: "Continue the story." }],
      placements: [],
      audienceCharacterIds: ["kaito"],
      cachedSnapshots,
      toProviderMessages: (messages) => messages,
    });
  const walkFirst = await walkReply();
  assert.equal(walkFirst.receipt.recalledSceneIds.length, 1, "the festival is recalled");
  await chats.createMessage({ chatId: walk.id, role: "assistant", characterId: "kaito", content: "Kaito opens it." });
  await memory.checkScenesAfterGeneration(walk.id);
  assert.equal(
    (await memory.status(walk.id)).records.filter((record) => record.kind === "scene" && record.content).length,
    2,
    "the walk home was saved after the reply",
  );
  assert((await walkReply([walkFirst.snapshot])).receipt.reasons.includes("reused-swipe-memory"));

  // (1) With Maximum recalled scenes at 0, recall is off; the receipt does not claim nothing was available.
  await memory.updateSettings(fresh.id, { retrieveMaxScenes: 0 });
  const off = await memory.prepare({
    chatId: fresh.id,
    messages: await chats.listMessages(fresh.id),
    audienceCharacterIds: ["kaito"],
    budgetTokens: 50000,
    readOnly: true,
  });
  assert(!off.receipt.reasons.some((reason) => reason.startsWith("no-")), JSON.stringify(off.receipt.reasons));

  console.log("Advanced Memory scene participants, recall receipts, swipe refresh and older-scene checks passed.");
} finally {
  provider.closeAllConnections();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await db._fileStore.close();
  rmSync(directory, { recursive: true, force: true });
}
