import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-agent-lorebooks-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const require = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { chats: chatRows, lorebookEntries: entryRows } = await import("../../packages/server/src/db/schema/index.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createChatPresetsStorage } = await import("../../packages/server/src/services/storage/chat-presets.storage.js");
const { createLorebooksStorage } = await import("../../packages/server/src/services/storage/lorebooks.storage.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { resolvePackageAgentLorebookEntries } =
  await import("../../packages/server/src/services/capability-packages/capability-agent-lorebook.service.js");
const { OpenAIProvider } = await import("../../packages/server/src/services/llm/providers/openai.provider.js");
const { characterDataSchema, replaceBuiltInAgentDefinitions } = await import("../../packages/shared/dist/index.js");
const { applyAgentLorebookChatSettings } =
  await import("../../packages/server/src/services/generation/agent-lorebook-triggers.js");
const { captureChatWizardDefaults, reusableChatWizardDefaults, wizardDefaultsMetadataPatch } =
  await import("../../packages/client/src/lib/chat-wizard-defaults.js");

const manifests = ["writer", "tracker"].map((category) => ({
  id: `reference-${category}`,
  name: `Reference ${category}`,
  description: "Isolated lorebook regression",
  category: category as "writer" | "tracker",
  phase: "post_processing" as const,
  enabledByDefault: false,
  defaultPromptTemplate: `REFERENCE_${category.toUpperCase()}_TASK`,
}));
replaceBuiltInAgentDefinitions(manifests);
const prompts: string[] = [];
OpenAIProvider.prototype.chat = async function* (messages) {
  prompts.push(messages.map((message) => String(message.content)).join("\n"));
  yield "The crystal remains quiet.";
  return { promptTokens: 1, completionTokens: 1, totalTokens: 2 };
};
OpenAIProvider.prototype.chatComplete = async (messages) => {
  const text = messages.map((message) => String(message.content)).join("\n");
  prompts.push(text);
  const ids = [...text.matchAll(/<agent_task id="([^"]+)"/gu)].map((match) => match[1]!);
  return {
    content: ids.length
      ? JSON.stringify(Object.fromEntries(ids.map((id) => [id, { text: "Reference checked." }])))
      : JSON.stringify({ text: "Reference checked." }),
    toolCalls: [],
    finishReason: "stop",
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
  };
};
const db = await getDB();
const chats = createChatsStorage(db);
const agents = createAgentsStorage(db);
const books = createLorebooksStorage(db);
const app = require("fastify")();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(chatsRoutes, { prefix: "/api/chats" });
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  const connection = await createConnectionsStorage(db).create({
    name: "Reference fixture",
    provider: "custom",
    baseUrl: "http://127.0.0.1:1/v1",
    model: "fixture-model",
    apiKey: "fixture",
  });
  const configs = await Promise.all(
    [...manifests.map((item) => item.id), "custom-reference"].map((type) =>
      agents.create({
        type,
        name: type,
        phase: "post_processing",
        connectionId: connection.id,
        promptTemplate: `REFERENCE_TASK_${type}`,
        settings: { resultType: "context_injection", batchWithOtherAgents: false, contextSize: 5 },
      }),
    ),
  );
  assert(configs.every(Boolean));
  const firstBook = await books.create({ name: "Writer reference" });
  const secondBook = await books.create({ name: "Tracker reference" });
  assert(firstBook && secondBook);
  await books.createEntry({
    lorebookId: firstBook.id,
    name: "Writer fact",
    keys: ["crystal"],
    content: "WRITER_BOOK_SECRET",
    generationTriggerFilterMode: "include",
    generationTriggerFilters: ["chat"],
  });
  await books.createEntry({
    lorebookId: secondBook.id,
    name: "Tracker fact",
    keys: ["crystal"],
    content: "TRACKER_BOOK_SECRET",
  });
  await books.createEntry({
    lorebookId: firstBook.id,
    name: "Unmatched",
    keys: ["unspoken-key"],
    content: "UNMATCHED_SECRET",
  });
  const chat = await chats.create({
    name: "Agent references",
    mode: "roleplay",
    characterIds: [],
    connectionId: connection.id,
  });
  const otherChat = await chats.create({
    name: "Other chat",
    mode: "roleplay",
    characterIds: [],
    connectionId: connection.id,
  });
  assert(chat && otherChat);
  const types = configs.map((config) => config!.type);
  await chats.patchMetadata(chat.id, { enableAgents: true, activeAgentIds: types, enableTools: false });
  const patch = (id: string, attachments: unknown) =>
    app.inject({
      method: "PATCH",
      url: `/api/chats/${id}/metadata`,
      payload: { agentLorebookAttachments: attachments },
    });
  const patches = await Promise.all([
    patch(chat.id, { [types[0]!]: { enabled: true, lorebookId: firstBook.id } }),
    patch(chat.id, { [types[1]!]: { enabled: true, lorebookId: secondBook.id } }),
  ]);
  assert(patches.every((response) => response.statusCode === 200));
  const loaded = (await app.inject({ method: "GET", url: `/api/chats/${chat.id}` })).json();
  assert.equal(
    Object.keys(loaded.metadata.agentLorebookAttachments).length,
    2,
    "concurrent per-agent patches preserve both selections",
  );
  assert.equal(
    (await app.inject({ method: "GET", url: `/api/chats/${otherChat.id}` })).json().metadata.agentLorebookAttachments,
    undefined,
  );
  const resetChat = await chats.create({ name: "Wizard reset", mode: "roleplay", characterIds: [] });
  assert(resetChat);
  const initialAttachments = {
    [types[0]!]: { enabled: true, lorebookId: firstBook.id },
    [types[1]!]: { enabled: true, lorebookId: secondBook.id },
  };
  assert.equal((await patch(resetChat.id, initialAttachments)).statusCode, 200);
  await chats.patchMetadata(resetChat.id, { characterCommands: true });
  const resetSnapshot = captureChatWizardDefaults((await chats.getById(resetChat.id))!);
  const emptySnapshot = captureChatWizardDefaults({ ...(await chats.getById(resetChat.id))!, metadata: {} });
  assert.equal((await patch(resetChat.id, {})).statusCode, 200);
  assert.deepEqual(
    (await app.inject({ method: "GET", url: `/api/chats/${resetChat.id}` })).json().metadata.agentLorebookAttachments,
    initialAttachments,
    "an empty attachment map merges without clearing existing selections",
  );
  const concurrentAttachment = { enabled: true, lorebookId: firstBook.id };
  assert.equal((await patch(resetChat.id, { concurrent: concurrentAttachment })).statusCode, 200);
  const resetResponse = await app.inject({
    method: "PATCH",
    url: `/api/chats/${resetChat.id}/metadata`,
    payload: wizardDefaultsMetadataPatch(resetSnapshot, emptySnapshot),
  });
  assert.equal(
    resetResponse.statusCode,
    200,
    `Wizard reset must pass the actual metadata route: ${resetResponse.body}`,
  );
  const resetMetadata = resetResponse.json().metadata;
  assert.deepEqual(resetMetadata.agentLorebookAttachments, {
    [types[0]!]: { enabled: false, lorebookId: null },
    [types[1]!]: { enabled: false, lorebookId: null },
    concurrent: concurrentAttachment,
  });
  assert.equal(resetMetadata.characterCommands, null, "other wizard reset fields reach storage in the same request");
  assert.equal(
    (await patch(resetChat.id, { [types[0]!]: { enabled: true, lorebookId: secondBook.id } })).statusCode,
    200,
  );
  const changedSnapshot = captureChatWizardDefaults((await chats.getById(resetChat.id))!);
  const targetSnapshot = captureChatWizardDefaults({
    ...(await chats.getById(resetChat.id))!,
    metadata: {
      agentLorebookAttachments: { [types[0]!]: initialAttachments[types[0]!] },
      characterCommands: true,
    },
  });
  const laterAttachment = { enabled: true, lorebookId: secondBook.id };
  assert.equal((await patch(resetChat.id, { later: laterAttachment })).statusCode, 200);
  const restoreResponse = await app.inject({
    method: "PATCH",
    url: `/api/chats/${resetChat.id}/metadata`,
    payload: wizardDefaultsMetadataPatch(changedSnapshot, targetSnapshot),
  });
  assert.equal(restoreResponse.statusCode, 200, restoreResponse.body);
  assert.deepEqual(restoreResponse.json().metadata.agentLorebookAttachments, {
    [types[0]!]: initialAttachments[types[0]!],
    [types[1]!]: { enabled: false, lorebookId: null },
    concurrent: { enabled: false, lorebookId: null },
    later: laterAttachment,
  });
  assert.equal(restoreResponse.json().metadata.characterCommands, true);
  const profiles = createChatPresetsStorage(db);
  const profileTarget = await chats.create({ name: "Profile target", mode: "roleplay", characterIds: [] });
  const freshProfileTarget = await chats.create({ name: "Fresh profile target", mode: "roleplay", characterIds: [] });
  assert(profileTarget && freshProfileTarget);
  const targetAttachments = { [types[1]!]: { enabled: true, lorebookId: secondBook.id } };
  await chats.patchMetadata(profileTarget.id, { agentLorebookAttachments: targetAttachments });
  const emptyProfile = await profiles.create({ name: "Empty profile", mode: "roleplay", settings: {} });
  assert(emptyProfile);
  await profiles.applyToChat(emptyProfile.id, profileTarget.id);
  assert.deepEqual(
    (await app.inject({ method: "GET", url: `/api/chats/${profileTarget.id}` })).json().metadata
      .agentLorebookAttachments,
    targetAttachments,
    "applying a profile preserves the target chat's own agent attachments",
  );
  const capturedProfile = await profiles.create({
    name: "Captured reference profile",
    mode: "roleplay",
    settings: { metadata: loaded.metadata },
  });
  assert(capturedProfile);
  assert.equal(
    capturedProfile.settings.metadata?.agentLorebookAttachments,
    undefined,
    "profile capture excludes the source chat's agent attachments",
  );
  await profiles.applyToChat(capturedProfile.id, freshProfileTarget.id);
  assert.equal(
    (await app.inject({ method: "GET", url: `/api/chats/${freshProfileTarget.id}` })).json().metadata
      .agentLorebookAttachments,
    undefined,
    "a captured profile cannot copy another chat's agent attachments",
  );
  await patch(resetChat.id, { disabledSource: { enabled: false, lorebookId: firstBook.id } });
  const legacyWizardDefaults = captureChatWizardDefaults((await chats.getById(resetChat.id))!);
  const sourceDefaultsBefore = structuredClone(legacyWizardDefaults);
  for (const target of [profileTarget, freshProfileTarget]) {
    const before = (await chats.getById(target.id))!.metadata;
    const response = await app.inject({
      method: "PATCH",
      url: `/api/chats/${target.id}/metadata`,
      payload: reusableChatWizardDefaults(legacyWizardDefaults).metadata,
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(
      response.json().metadata.agentLorebookAttachments,
      JSON.parse(before as string).agentLorebookAttachments,
      "applying legacy shared wizard defaults preserves only the target chat's existing bindings",
    );
  }
  assert.deepEqual(legacyWizardDefaults, sourceDefaultsBefore, "source/reset snapshot bindings remain intact");
  for (const invalid of [
    [],
    { broken: { enabled: "yes", lorebookId: firstBook.id } },
    { broken: { enabled: true, lorebookId: "" } },
  ]) {
    assert.equal((await patch(chat.id, invalid)).statusCode, 400);
  }
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Inspect the crystal." });
  const firstReply = await chats.createMessage({ chatId: chat.id, role: "assistant", content: "The crystal waits." });
  assert(firstReply);
  const retry = async (agentTypes = types, options: Record<string, unknown> = {}) => {
    prompts.length = 0;
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/retry-agents",
      payload: { chatId: chat.id, agentTypes, ...options },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    assert(
      prompts.some((prompt) => prompt.includes("REFERENCE_TASK_")),
      "the requested reference agent actually runs before checking its sources",
    );
  };
  await retry();
  const writer = prompts.find((prompt) => prompt.includes(`REFERENCE_TASK_${types[0]}`));
  const tracker = prompts.find((prompt) => prompt.includes(`REFERENCE_TASK_${types[1]}`));
  const custom = prompts.find((prompt) => prompt.includes("REFERENCE_TASK_custom-reference"));
  assert(writer && tracker && custom);
  assert.match(writer, /WRITER_BOOK_SECRET/u);
  assert.doesNotMatch(writer, /TRACKER_BOOK_SECRET|UNMATCHED_SECRET/u);
  assert.match(tracker, /TRACKER_BOOK_SECRET/u);
  assert.doesNotMatch(tracker, /WRITER_BOOK_SECRET|UNMATCHED_SECRET/u);
  assert.doesNotMatch(custom, /WRITER_BOOK_SECRET|TRACKER_BOOK_SECRET/u);
  await patch(chat.id, { [types[2]!]: { enabled: true, lorebookId: firstBook.id } });
  await retry([types[2]!]);
  assert(
    prompts.some((prompt) => prompt.includes("WRITER_BOOK_SECRET")),
    "custom agents use the same attachment path",
  );
  await agents.update(configs[2]!.id, { phase: "pre_generation" });
  await retry([types[2]!], { forMessageId: firstReply.id });
  assert(
    prompts.some((prompt) => prompt.includes("WRITER_BOOK_SECRET")),
    "historical pre-generation retry retains the target turn's chat trigger",
  );
  await agents.update(configs[2]!.id, { phase: "post_processing" });
  await patch(chat.id, { [types[0]!]: { enabled: false, lorebookId: firstBook.id } });
  await retry([types[0]!]);
  assert(prompts.every((prompt) => !prompt.includes("WRITER_BOOK_SECRET")));
  await patch(chat.id, { [types[0]!]: { enabled: true, lorebookId: "missing-book" } });
  await retry([types[0]!]);
  assert(
    prompts.every((prompt) => !prompt.includes("WRITER_BOOK_SECRET")),
    "unavailable books never fall back to chat-wide sources",
  );
  await patch(chat.id, { [types[0]!]: { enabled: true, lorebookId: firstBook.id } });
  await Promise.all(
    [configs[0], configs[2]].map((config) =>
      agents.update(config!.id, {
        settings: { resultType: "context_injection", batchWithOtherAgents: true, contextSize: 5 },
      }),
    ),
  );
  // Roleplay deliberately separates tracker contexts; a writer and custom agent can share a batch.
  await patch(chat.id, { [types[2]!]: { enabled: true, lorebookId: secondBook.id } });
  await retry([types[0]!, types[2]!]);
  assert.equal(prompts.length, 1, "grouped agents share one model call");
  assert.match(prompts[0]!, /WRITER_BOOK_SECRET/u);
  assert.match(prompts[0]!, /TRACKER_BOOK_SECRET/u);
  assert.doesNotMatch(prompts[0]!, /UNMATCHED_SECRET/u);
  prompts.length = 0;
  const generated = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: chat.id, userMessage: "Inspect the crystal again." },
  });
  assert.equal(generated.statusCode, 200, generated.body);
  assert(!generated.body.includes('"type":"error"'), generated.body);
  const mainCalls = prompts.filter((prompt) => !prompt.includes("REFERENCE_TASK_"));
  assert(mainCalls.length > 0, "normal generation calls the main responder");
  assert(mainCalls.every((prompt) => !/WRITER_BOOK_SECRET|TRACKER_BOOK_SECRET/u.test(prompt)));
  assert(prompts.some((prompt) => /REFERENCE_TASK_/u.test(prompt) && prompt.includes("WRITER_BOOK_SECRET")));
  assert(prompts.some((prompt) => /REFERENCE_TASK_/u.test(prompt) && prompt.includes("TRACKER_BOOK_SECRET")));
  const attached = await resolvePackageAgentLorebookEntries(db, types[0]!, { chatId: chat.id });
  assert(attached.some((entry) => entry.content === "WRITER_BOOK_SECRET"));
  const scopedCast = await Promise.all(
    ["Alice", "Bob"].map((name) =>
      createCharactersStorage(db).create(characterDataSchema.parse({ name, tags: [`scope-${name}`] })),
    ),
  );
  assert(scopedCast[0] && scopedCast[1]);
  const rosterBook = await books.create({ name: "Active roster reference" });
  assert(rosterBook);
  for (const [index, card] of scopedCast.entries()) {
    assert(card);
    const name = ["Alice", "Bob"][index]!;
    await books.createEntry({
      lorebookId: rosterBook.id,
      constant: true,
      content: `ID_${name}`,
      characterFilterMode: "include",
      characterFilterIds: [card.id],
    });
    await books.createEntry({
      lorebookId: rosterBook.id,
      constant: true,
      content: `TAG_${name}`,
      characterTagFilterMode: "include",
      characterTagFilters: [`scope-${name}`],
    });
  }
  await books.createEntry({ lorebookId: rosterBook.id, constant: true, content: "CAST={{char}}" });
  for (const mode of ["conversation", "roleplay", "game"] as const) {
    const rosterChat = await chats.create({
      name: "All-inactive roster",
      mode,
      characterIds: scopedCast.map((card) => card.id),
    });
    assert(rosterChat);
    await chats.patchMetadata(rosterChat.id, {
      inactiveCharacterIds: scopedCast.map((card) => card.id),
      agentLorebookAttachments: { [types[0]!]: { enabled: true, lorebookId: rosterBook.id } },
    });
    await chats.createMessage({ chatId: rosterChat.id, role: "user", content: "Inspect the reference." });
    const contents = async () =>
      (await resolvePackageAgentLorebookEntries(db, types[0]!, { chatId: rosterChat.id })).map(
        (entry) => entry.content,
      );
    const inactiveEntries = await contents();
    for (const name of ["Alice", "Bob"]) {
      assert.equal(
        inactiveEntries.includes(`ID_${name}`),
        mode === "game",
        `${mode}: inactive identity scope matches the live path`,
      );
      assert.equal(
        inactiveEntries.includes(`TAG_${name}`),
        mode === "game",
        `${mode}: inactive tag scope matches the live path`,
      );
    }
    assert(
      inactiveEntries.some((content) => content.startsWith("CAST=")),
      "ungated entries still resolve with an empty active roster",
    );
    if (mode !== "game") {
      assert(
        inactiveEntries.filter((content) => content.startsWith("CAST=")).every((content) => !/Alice|Bob/.test(content)),
        "macros do not describe excluded cards",
      );
      await chats.patchMetadata(rosterChat.id, { inactiveCharacterIds: [scopedCast[0].id] });
      const oneActive = await contents();
      assert(oneActive.includes("ID_Bob") && oneActive.includes("TAG_Bob"));
      assert(!oneActive.includes("ID_Alice") && !oneActive.includes("TAG_Alice"));
      await chats.patchMetadata(rosterChat.id, { inactiveCharacterIds: [] });
      const restored = await contents();
      assert(["ID_Alice", "TAG_Alice", "ID_Bob", "TAG_Bob"].every((value) => restored.includes(value)));
    }
  }
  const originalRoster = (await chats.getById(chat.id))!.characterIds;
  for (const malformedRoster of ["not-json", "null", "42", '[null,42,""]']) {
    await db.update(chatRows).set({ characterIds: malformedRoster }).where(eq(chatRows.id, chat.id));
    assert(
      (await resolvePackageAgentLorebookEntries(db, types[0]!, { chatId: chat.id })).some(
        (entry) => entry.content === "WRITER_BOOK_SECRET",
      ),
      `legacy roster ${malformedRoster} resolves references with an empty character roster`,
    );
  }
  await db.update(chatRows).set({ characterIds: originalRoster }).where(eq(chatRows.id, chat.id));
  assert(
    attached.every((entry) => !entry.content.includes("TRACKER_BOOK_SECRET")),
    "package feature calls cannot select another agent's attachment",
  );
  assert.deepEqual(await resolvePackageAgentLorebookEntries(db, "other-package", { chatId: chat.id }), []);
  assert.deepEqual(await resolvePackageAgentLorebookEntries(db, types[0]!, { chatId: otherChat.id }), []);
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(resolvePackageAgentLorebookEntries(db, types[0]!, { chatId: chat.id, signal: aborted.signal }), {
    name: "AbortError",
  });
  await patch(chat.id, { [types[0]!]: { enabled: false, lorebookId: firstBook.id } });
  assert.deepEqual(await resolvePackageAgentLorebookEntries(db, types[0]!, { chatId: chat.id }), []);
  await patch(chat.id, { [types[0]!]: { enabled: true, lorebookId: "missing" } });
  assert.deepEqual(await resolvePackageAgentLorebookEntries(db, types[0]!, { chatId: chat.id }), []);
  await patch(chat.id, { [types[0]!]: { enabled: true, lorebookId: firstBook.id } });
  await books.update(firstBook.id, { enabled: false });
  assert.deepEqual(await resolvePackageAgentLorebookEntries(db, types[0]!, { chatId: chat.id }), []);
  await books.update(firstBook.id, { enabled: true });
  await books.createEntry({
    lorebookId: firstBook.id,
    name: "Macro reference",
    keys: ["crystal"],
    content: "The {{user}} keeps {{getvar::reference}}.",
  });
  await chats.patchMetadata(chat.id, { macroVariables: { reference: "a map" } });
  assert(
    (await resolvePackageAgentLorebookEntries(db, types[0]!, { chatId: chat.id })).some(
      (entry) => entry.content === "The User keeps a map.",
    ),
    "package reference content uses chat macros",
  );
  await books.createEntry({
    lorebookId: firstBook.id,
    name: "Guide reference",
    keys: ["compass"],
    content: "GUIDE_ONLY_REFERENCE",
  });
  await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    content: "A light draws near.",
    extra: { generationReplay: { generationGuide: "A compass arrives.", generationGuideSource: "guide" } },
  });
  assert(
    (await resolvePackageAgentLorebookEntries(db, types[0]!, { chatId: chat.id })).some(
      (entry) => entry.content === "GUIDE_ONLY_REFERENCE",
    ),
    "package reference scans include a saved guide even when the reply omits its keyword",
  );
  await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    content: "A silent room.",
    extra: { isConversationStart: true },
  });
  await chats.createMessage({ chatId: chat.id, role: "user", content: "crystal", extra: { hiddenFromAI: true } });
  assert.deepEqual(
    await resolvePackageAgentLorebookEntries(db, types[0]!, { chatId: chat.id }),
    [],
    "past-start and hidden messages cannot trigger package references",
  );
  await chats.patchMetadata(otherChat.id, {
    enableAgents: true,
    activeAgentIds: [types[0]!],
    agentLorebookAttachments: { [types[0]!]: { enabled: true, lorebookId: firstBook.id } },
  });
  await chats.createMessage({ chatId: otherChat.id, role: "assistant", content: "The crystal continues." });
  await retry([types[0]!], { chatId: otherChat.id });
  assert(
    prompts.every((prompt) => !prompt.includes("WRITER_BOOK_SECRET")),
    "an assistant-only continuation does not activate chat-only entries",
  );
  const windowChat = await chats.create({ name: "Bounded package history", mode: "roleplay", characterIds: [] });
  const windowBook = await books.create({ name: "Window reference" });
  assert(windowChat && windowBook);
  await agents.update(configs[0]!.id, { settings: { contextSize: 2 } });
  await books.createEntry({
    lorebookId: windowBook.id,
    keys: ["inside-window"],
    content: "RECENT_WINDOW_REFERENCE for {{user}} after {{getvar::processed}} messages",
  });
  await books.createEntry({
    lorebookId: windowBook.id,
    keys: ["outside-window"],
    content: "DISCARDED_MACRO_REFERENCE after {{getvar::processed}} messages",
  });
  await chats.patchMetadata(windowChat.id, {
    agentLorebookAttachments: { [types[0]!]: { enabled: true, lorebookId: windowBook.id } },
    macroVariables: { windowKey: "inside-window", processed: "0" },
  });
  for (let index = 0; index < 32; index++)
    await chats.createMessage({
      chatId: windowChat.id,
      role: "assistant",
      content: `{{incvar::processed}}{{setvar::windowKey::outside-window}} {{lorebooksize::${windowBook.id}}}`,
    });
  await chats.createMessage({
    chatId: windowChat.id,
    role: "user",
    content: "Read the current window. {{incvar::processed}}",
  });
  await chats.createMessage({
    chatId: windowChat.id,
    role: "assistant",
    content: "{{getvar::windowKey}} {{incvar::processed}}",
  });
  const cleanWindowChat = await chats.create({ name: "Only the retained window", mode: "roleplay", characterIds: [] });
  assert(cleanWindowChat);
  await chats.patchMetadata(cleanWindowChat.id, {
    agentLorebookAttachments: { [types[0]!]: { enabled: true, lorebookId: windowBook.id } },
    macroVariables: { windowKey: "inside-window", processed: "0" },
  });
  await chats.createMessage({
    chatId: cleanWindowChat.id,
    role: "user",
    content: "Read the current window. {{incvar::processed}}",
  });
  await chats.createMessage({
    chatId: cleanWindowChat.id,
    role: "assistant",
    content: "{{getvar::windowKey}} {{incvar::processed}}",
  });
  let entryCountQueries = 0;
  const originalSelect = db.select;
  db.select = ((projection?: Record<string, unknown>) => {
    if (projection && Object.keys(projection).length === 1 && projection.lorebookId === entryRows.lorebookId)
      entryCountQueries++;
    return originalSelect(projection as never);
  }) as typeof db.select;
  try {
    const cleanWindowEntries = await resolvePackageAgentLorebookEntries(db, types[0]!, { chatId: cleanWindowChat.id });
    const baselineCountQueries = entryCountQueries;
    entryCountQueries = 0;
    const windowEntries = await resolvePackageAgentLorebookEntries(db, types[0]!, { chatId: windowChat.id });
    assert.equal(
      entryCountQueries,
      baselineCountQueries,
      `discarded history must not load macro dependencies: ${JSON.stringify(windowEntries)}`,
    );
    assert.deepEqual(
      windowEntries.map((entry) => entry.content),
      ["RECENT_WINDOW_REFERENCE for User after 2 messages"],
      "discarded variable writes cannot change the retained history's triggers",
    );
    assert.deepEqual(windowEntries, cleanWindowEntries, "the bounded scan matches the equivalent clean window");
    assert(!Object.hasOwn(windowEntries[0]!, "name"), "unnamed entries omit the optional public string field");
    await books.updateEntry(windowEntries[0]!.id, { name: "" });
    await chats.createMessage({
      chatId: windowChat.id,
      role: "assistant",
      content: `{{lorebooksize::${windowBook.id}}} {{getvar::windowKey}} {{incvar::processed}}`,
    });
    entryCountQueries = 0;
    const retainedEntries = await resolvePackageAgentLorebookEntries(db, types[0]!, { chatId: windowChat.id });
    assert.equal(
      entryCountQueries,
      baselineCountQueries + 1,
      "a macro in the retained window still loads its dependencies",
    );
    assert.deepEqual(
      retainedEntries.map((entry) => entry.content),
      ["RECENT_WINDOW_REFERENCE for User after 2 messages"],
    );
    assert.equal(retainedEntries[0]?.name, "", "an explicitly empty string remains a valid public name");
    console.info(
      "PASS: two-message package macro window, discarded-history isolation, dependency controls and optional names",
    );
  } finally {
    db.select = originalSelect;
  }
  for (const config of configs)
    assert(
      !JSON.parse((await agents.getById(config!.id))!.settings as string).chatLorebookAttachmentEnabled,
      "chat overrides never modify global definitions",
    );
  const settings = { contextSize: 8 };
  assert.equal(applyAgentLorebookChatSettings(types[0]!, settings, {}), settings);
  for (const lorebookId of [null, "", "   "]) {
    assert.equal(
      applyAgentLorebookChatSettings(types[0]!, settings, {
        agentLorebookAttachments: { [types[0]!]: { enabled: true, lorebookId } },
      }),
      settings,
      "an enabled but unselected attachment cannot admit this agent to the trigger pass",
    );
  }
  console.info(
    "PASS: chat-scoped lorebook persistence, validation, triggering, isolation, custom agents, disabling, missing books and grouped retries",
  );
} finally {
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
