import assert from "node:assert/strict";
import { mock } from "node:test";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-scene-participants-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
const { buildApp } = await import("../../packages/server/src/app.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { resolveConversationPresenceRuntime } =
  await import("../../packages/server/src/routes/generate/conversation-presence-runtime.js");
const { resolveSceneBusyCharacterIds } =
  await import("../../packages/server/src/services/generation/scene-context-runtime.js");
const app = await buildApp();
const requests: Array<{ messages: Array<{ content: string }> }> = [];
const plan = {
  name: "Scene: Library",
  description: "A library.",
  scenario: "Find a book.",
  firstMessage: "Welcome.",
  background: null,
  characterIds: ["not-in-chat"],
  systemPrompt: "Write a scene.",
  rating: "sfw",
  relationshipHistory: "Friends.",
  participationGuide: "Explore the library.",
};
let providerContent = JSON.stringify(plan);
const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  requests.push(JSON.parse(Buffer.concat(chunks).toString()));
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ choices: [{ message: { content: providerContent }, finish_reason: "stop" }] }));
});
try {
  await app.ready();
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address !== "string");
  const api = async (method: "GET" | "POST" | "PATCH", url: string, payload?: object) => {
    const response = await app.inject({ method, url, payload });
    assert.equal(response.statusCode, 200, response.body);
    return response.json();
  };
  const ids: string[] = [];
  for (const name of ["Alice", "Bob", "Charlie"]) {
    ids.push(
      (
        await api("POST", "/api/characters", {
          data: { name, extensions: { convoDisplayName: name === "Alice" ? "Al" : name === "Bob" ? "Charlie" : "" } },
        })
      ).id,
    );
  }
  const persona = await api("POST", "/api/characters/personas", { name: "Scene persona", description: "A visitor." });
  const origin = await api("POST", "/api/chats", { name: "Source", mode: "conversation", characterIds: ids });
  const conn = await api("POST", "/api/connections", {
    name: "Scene fixture",
    provider: "custom",
    model: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
  });
  const selected = { participantCharacterIds: ids.slice(0, 2), personaId: persona.id };
  const planned = await api("POST", "/api/scene/plan", {
    chatId: origin.id,
    connectionId: conn.id,
    prompt: "Visit the library",
    promptPreferences: { pov: "third_person", tense: "past", ...selected },
  });
  assert.deepEqual(
    planned.plan.characterIds,
    selected.participantCharacterIds,
    "The model cannot override explicit participants",
  );
  // Models often slip on JSON (an unquoted key, single quotes, a trailing comma); the plan is still read.
  providerContent = `{
  name: 'Scene: Library',
  "description": "A library.",
  "scenario": "Find a book.",
  "firstMessage": "Welcome.",
}`;
  const repaired = await api("POST", "/api/scene/plan", {
    chatId: origin.id,
    connectionId: conn.id,
    prompt: "Visit the library",
    promptPreferences: { pov: "third_person", tense: "past", ...selected },
  });
  assert.equal(repaired.error, undefined, "a slightly broken JSON plan is repaired");
  assert.equal(repaired.plan?.name, "Scene: Library");
  assert.equal(repaired.plan?.scenario, "Find a book.");
  // Dialogue in plain quotes inside a one-line value ("firstMessage": ""Hi," she says."): the quotes are kept as text.
  providerContent = [
    "{",
    '  "name": "Scene: Library",',
    '  "scenario": "Find a book.",',
    '  "firstMessage": "So. You came back.", The librarian smiles. "Again?",',
    '  "description": "A library."',
    "}",
  ].join("\n");
  const quoted = await api("POST", "/api/scene/plan", {
    chatId: origin.id,
    connectionId: conn.id,
    prompt: "Visit the library",
    promptPreferences: { pov: "third_person", tense: "past", ...selected },
  });
  assert.equal(quoted.error, undefined, "dialogue quotes inside a value are repaired");
  assert.equal(quoted.plan?.firstMessage, 'So. You came back.", The librarian smiles. "Again?');
  assert.equal(quoted.plan?.description, "A library.");
  // The shared repair keeps valid lines as they are: two properties on one valid line stay two properties.
  const { tryParseJsonRecord } = await import("../../packages/server/src/lib/json-repair.js");
  // Dialogue quotes come in pairs, so a bare `, warning: "` inside quoted dialogue is not a key: no field is cut short.
  const signsText = 'The signs read, "Welcome", warning: "Do not enter."';
  for (const [field, other] of [
    ["firstMessage", "description"],
    ["description", "firstMessage"],
  ] as const) {
    const lines = [
      "{",
      '  "name": "Scene: Library",',
      `  "${field}": "${signsText}",`,
      `  "${other}": "A library."`,
      "}",
    ];
    providerContent = lines.join("\n");
    assert.deepEqual(tryParseJsonRecord(providerContent), {
      name: "Scene: Library",
      [field]: signsText,
      [other]: "A library.",
    });
    const signs = await api("POST", "/api/scene/plan", {
      chatId: origin.id,
      connectionId: conn.id,
      prompt: "Visit the library",
      promptPreferences: { pov: "third_person", tense: "past", ...selected },
    });
    assert.equal(signs.error, undefined);
    assert.equal(signs.plan?.[field], signsText, `${field} is kept whole`);
    assert.equal(signs.plan?.[other], "A library.");
  }
  // Real properties before and after that dialogue still split off.
  assert.deepEqual(tryParseJsonRecord(`{\n  "firstMessage": "${signsText}", mood: "warm"\n}`), {
    firstMessage: signsText,
    mood: "warm",
  });
  assert.deepEqual(tryParseJsonRecord(`{\n  "name": "Scene", "firstMessage": "${signsText}", mood: "warm"\n}`), {
    name: "Scene",
    firstMessage: signsText,
    mood: "warm",
  });
  // A dialogue quote never closed doesn't swallow the whole properties written after it on the line.
  assert.deepEqual(
    tryParseJsonRecord('{\n  "firstMessage": "The sign said "Welcome.", mood: "warm",\n  "name": "x"\n}'),
    {
      firstMessage: 'The sign said "Welcome.',
      mood: "warm",
      name: "x",
    },
  );
  assert.deepEqual(
    tryParseJsonRecord('{\n  "firstMessage": "The sign said "Welcome.", mood: "warm", "tone": "calm"\n}'),
    { firstMessage: 'The sign said "Welcome.', mood: "warm", tone: "calm" },
  );
  // A value missing its own closing quote doesn't swallow the bare property after it either.
  const openHead = '"description": "The lab was cold, title: "The Lab"';
  assert.deepEqual(tryParseJsonRecord(`{\n  ${openHead}\n}`), { description: "The lab was cold", title: "The Lab" });
  assert.deepEqual(tryParseJsonRecord(`{\n  "name": "x", ${openHead}\n}`), {
    name: "x",
    description: "The lab was cold",
    title: "The Lab",
  });
  providerContent = `{\n  "name": "Scene: Lab",\n  "firstMessage": "Cold in here.",\n  ${openHead}\n}`;
  const openHeadPlan = await api("POST", "/api/scene/plan", {
    chatId: origin.id,
    connectionId: conn.id,
    prompt: "Visit the lab",
    promptPreferences: { pov: "third_person", tense: "past", ...selected },
  });
  assert.equal(openHeadPlan.error, undefined);
  assert.equal(openHeadPlan.plan?.description, "The lab was cold", "the description isn't joined to the next property");
  assert.deepEqual(tryParseJsonRecord(`{\n  "firstMessage": "${signsText.replace("warning", "'warning'")}"\n}`), {
    firstMessage: signsText.replace("warning", "'warning'"),
  });
  // Dialogue that quotes a "key": "value" of its own is still one value: only a comma before the key starts another.
  // ("She said, "mood": "warm"" can't be told from a real property, so there jsonrepair's reading stands.)
  for (const dialogue of ['She read "mood": "warm" aloud', 'He said "hi" twice']) {
    assert.deepEqual(tryParseJsonRecord(`{\n  "firstMessage": "${dialogue}",\n  "name": "x"\n}`), {
      firstMessage: dialogue,
      name: "x",
    });
  }
  // Two properties on one broken line, either one holding dialogue quotes: each keeps its own value.
  assert.deepEqual(tryParseJsonRecord('{\n  "name": "Scene: Return", "firstMessage": ""Hi," she says."\n}'), {
    name: "Scene: Return",
    firstMessage: '"Hi," she says.',
  });
  assert.deepEqual(tryParseJsonRecord('{\n  "firstMessage": ""Hi," she says.", "name": "Scene: Return"\n}'), {
    firstMessage: '"Hi," she says.',
    name: "Scene: Return",
  });
  // A key written with an escape (first\u004dessage) counts as the key it reads as.
  assert.deepEqual(tryParseJsonRecord('{\n  "first\\u004dessage": "Hello", "name": "x" "role": "assistant"\n}'), {
    firstMessage: "Hello",
    name: "x",
    role: "assistant",
  });
  // A missing comma between real properties is jsonrepair's to fix; nothing is merged into one value.
  assert.deepEqual(tryParseJsonRecord('{\n  "firstMessage": "Hello", "name": "x" "role": "assistant"\n}'), {
    firstMessage: "Hello",
    name: "x",
    role: "assistant",
  });
  // An invalid line holding two properties keeps both: the dialogue escape leaves it to jsonrepair.
  assert.deepEqual(tryParseJsonRecord('{\n  "firstMessage": "She said "hi"", "mood": "warm",\n  "name": "x"\n}'), {
    firstMessage: 'She said "hi"',
    mood: "warm",
    name: "x",
  });
  // Quoted and bare keys mixed, as models write them: every property is kept, none swallowed into the one before.
  assert.deepEqual(tryParseJsonRecord('{\n  "name": "Scene: X", firstMessage: "Hi there"\n}'), {
    name: "Scene: X",
    firstMessage: "Hi there",
  });
  assert.deepEqual(tryParseJsonRecord('{\n  "name": "Scene: X, again", \'firstMessage\': "Hi there"\n}'), {
    name: "Scene: X, again",
    firstMessage: "Hi there",
  });
  assert.deepEqual(
    tryParseJsonRecord('{\n  "name": "Scene: X", firstMessage: "Hi", "scenario": "Find: a book", rating: "sfw"\n}'),
    { name: "Scene: X", firstMessage: "Hi", scenario: "Find: a book", rating: "sfw" },
  );
  assert.deepEqual(tryParseJsonRecord('{\n  name: "Scene: X",\n  "firstMessage": "Hi there"\n}'), {
    name: "Scene: X",
    firstMessage: "Hi there",
  });
  // Prose that jsonrepair would turn into a key sends the line to the dialogue escape, which splits at a bare key too.
  assert.deepEqual(
    tryParseJsonRecord('{\n  "name": "Scene: Rain", firstMessage: "You\'re late.", She turns. "Again."\n}'),
    { name: "Scene: Rain", firstMessage: 'You\'re late.", She turns. "Again.' },
  );
  assert.deepEqual(
    tryParseJsonRecord('{\n  "name": "Scene: Rain", \'firstMessage\': "You\'re late.", She turns. "Again."\n}'),
    { name: "Scene: Rain", firstMessage: 'You\'re late.", She turns. "Again.' },
  );
  // Prose shaped like a bare key (", softly: "") stays inside its value.
  assert.deepEqual(tryParseJsonRecord('{\n  "firstMessage": "She said, softly: "Come here."",\n  "name": "x"\n}'), {
    firstMessage: 'She said, softly: "Come here."',
    name: "x",
  });
  assert.deepEqual(tryParseJsonRecord('{\n  "name": "Scene: X", "firstMessage": "Hi there"\n}'), {
    name: "Scene: X",
    firstMessage: "Hi there",
  });
  assert.deepEqual(tryParseJsonRecord('{\n  "a": "x", "b": "y",\n  "c": "He said "hi" twice",\n}'), {
    a: "x",
    b: "y",
    c: 'He said "hi" twice',
  });
  providerContent = JSON.stringify(plan);
  const sent = requests
    .at(-1)!
    .messages.map((m) => m.content)
    .join("\n");
  assert.ok(sent.includes("Scene persona") && sent.includes("Alice") && sent.includes("Bob"));
  assert.ok(!sent.includes("Charlie"), "Excluded character cards are not sent to the planner");

  // In Individual group mode the opening is credited to the initiator, so the planner writes it in their voice.
  const individualProfile = await api("POST", "/api/chat-presets", {
    name: "Individual scenes",
    mode: "roleplay",
    settings: { metadata: { groupChatMode: "individual" } },
  });
  await api("POST", `/api/chat-presets/${individualProfile.id}/set-active`);
  await api("POST", "/api/scene/plan", {
    chatId: origin.id,
    connectionId: conn.id,
    prompt: "Visit the library",
    promptPreferences: { pov: "first_person", tense: "present", ...selected },
    initiatorCharId: ids[1],
  });
  const openerPrompt = requests
    .at(-1)!
    .messages.map((m) => m.content)
    .join("\n");
  assert.match(openerPrompt, /<opening_character>Bob<\/opening_character>/u, "the planner knows who opens");
  assert.match(openerPrompt, /"firstMessage" is posted by Bob\. Write it only as Bob/u);
  assert.match(openerPrompt, /\("I" is Bob\)/u, 'first person: the opener is "I"');
  assert.match(openerPrompt, /says aloud in double quotes/u, "spoken words are quoted");
  // Third person: the opener is not made "I" against the selected POV.
  await api("POST", "/api/scene/plan", {
    chatId: origin.id,
    connectionId: conn.id,
    prompt: "Visit the library",
    promptPreferences: { pov: "third_person", tense: "past", ...selected },
    initiatorCharId: ids[1],
  });
  const thirdPersonPrompt = requests
    .at(-1)!
    .messages.map((m) => m.content)
    .join("\n");
  assert.match(
    thirdPersonPrompt,
    /Write it only as Bob: Bob's own actions, dialogue and thoughts, in the selected POV/u,
  );
  assert.doesNotMatch(thirdPersonPrompt, /"I" is Bob/u);
  // In merged group mode one narrating voice tells the scene, so the opening is written that way.
  const mergedProfile = await api("POST", "/api/chat-presets", {
    name: "Merged scenes",
    mode: "roleplay",
    settings: { metadata: { groupChatMode: "merged" } },
  });
  await api("POST", `/api/chat-presets/${mergedProfile.id}/set-active`);
  await api("POST", "/api/scene/plan", {
    chatId: origin.id,
    connectionId: conn.id,
    prompt: "Visit the library",
    promptPreferences: selected,
    initiatorCharId: ids[1],
  });
  const mergedPrompt = requests
    .at(-1)!
    .messages.map((m) => m.content)
    .join("\n");
  assert.match(mergedPrompt, /told by one narrating voice for every character/u, "merged: narrated opening");
  assert.doesNotMatch(mergedPrompt, /Write it only as Bob/u);
  await api("POST", `/api/chat-presets/${individualProfile.id}/set-active`);
  // Without chosen participants, a cast the model picks always keeps the opening character.
  providerContent = JSON.stringify({ ...plan, characterIds: [ids[0]] });
  const castPlan = await api("POST", "/api/scene/plan", {
    chatId: origin.id,
    connectionId: conn.id,
    prompt: "Visit the library",
    initiatorCharId: ids[1],
  });
  assert.deepEqual(castPlan.plan.characterIds, [ids[1], ids[0]], "the opening character stays in the scene");
  // Without an initiator the first participant opens; a model that reorders the cast doesn't hand the opening to
  // someone else, since /scene/create credits the first listed participant.
  providerContent = JSON.stringify({ ...plan, characterIds: [ids[1], ids[0]] });
  const noInitiatorPlan = await api("POST", "/api/scene/plan", {
    chatId: origin.id,
    connectionId: conn.id,
    prompt: "Visit the library",
  });
  assert.match(
    requests
      .at(-1)!
      .messages.map((m) => m.content)
      .join("\n"),
    /<opening_character>Alice<\/opening_character>/u,
  );
  assert.deepEqual(noInitiatorPlan.plan.characterIds, [ids[0], ids[1]], "the opening character is listed first");
  providerContent = JSON.stringify(plan);
  // The starred Roleplay settings profile, as a new Roleplay chat would get it, with its own prompt preset.
  const writingPreset = await api("POST", "/api/prompts", { name: "House style" });
  await api("POST", `/api/prompts/${writingPreset.id}/sections`, {
    presetId: writingPreset.id,
    identifier: "house-style",
    name: "House style",
    content: "HOUSE-STYLE: write dialogue in double quotes.",
  });
  const profile = await api("POST", "/api/chat-presets", {
    name: "Scene defaults",
    mode: "roleplay",
    settings: { promptPresetId: writingPreset.id, metadata: { illustratorRunInterval: 7, enableAgents: false } },
  });
  await api("POST", `/api/chat-presets/${profile.id}/set-active`);
  // With no preset picked for the scene, the planner follows the profile's prompt preset, as the scene chat will.
  await api("POST", "/api/scene/plan", {
    chatId: origin.id,
    connectionId: conn.id,
    prompt: "Visit the library",
    promptPreferences: selected,
  });
  assert.match(
    requests
      .at(-1)!
      .messages.map((m) => m.content)
      .join("\n"),
    /<scene_writing_instructions>[\s\S]*HOUSE-STYLE: write dialogue in double quotes\./u,
    "the starred profile's writing rules reach the planner",
  );
  const payload = {
    originChatId: origin.id,
    connectionId: conn.id,
    plan: planned.plan,
    initiatorCharId: ids[2],
    ...selected,
  };
  const creations = await Promise.all(
    [0, 1].map(() => app.inject({ method: "POST", url: "/api/scene/create", payload })),
  );
  assert.deepEqual(
    creations.map((response) => response.statusCode).sort(),
    [200, 409],
    "Only one active Scene can claim a Conversation",
  );
  const created = creations.find((response) => response.statusCode === 200)!.json();
  const scene = await api("GET", `/api/chats/${created.chatId}`);
  // The scene starts from the starred Roleplay profile, with its own scene settings on top.
  const sceneMeta = typeof scene.metadata === "string" ? JSON.parse(scene.metadata) : scene.metadata;
  assert.equal(sceneMeta.appliedChatPresetId, profile.id, "the starred Roleplay profile is applied");
  assert.equal(sceneMeta.illustratorRunInterval, 7);
  assert.equal(sceneMeta.enableAgents, false);
  assert.equal(sceneMeta.sceneStatus, "active", "the scene's own settings stay");
  assert.equal(scene.connectionId, conn.id, "the connection the scene was given stays");
  assert.deepEqual(scene.characterIds, selected.participantCharacterIds);
  assert.equal(scene.personaId, persona.id);
  const messages = await api("GET", `/api/chats/${scene.id}/messages`);
  assert.equal(messages.at(-1).characterId, ids[0], "An excluded initiator cannot author the Scene opening");
  // The opening is only the character's own message; the description is narration, posted by the narrator.
  assert.equal(messages.at(-1).content, "Welcome.", "the description is not glued onto the opening");
  const narration = messages.filter((message: { role: string }) => message.role === "narrator");
  assert.deepEqual(
    narration.map((message: { content: string }) => message.content),
    ["Explore the library.", "A library."],
    "the guide, then the description",
  );
  const guideExtra = typeof narration[0].extra === "string" ? JSON.parse(narration[0].extra) : narration[0].extra;
  assert.equal(guideExtra?.sceneParticipationGuide, true, "the guide is marked so a fork can leave out only it");
  // A copy without the guide leaves out only the guide: the description and the opening stay.
  const fork = await api("POST", "/api/scene/fork", {
    sceneChatId: scene.id,
    mode: "clone",
    includeParticipationGuide: false,
  });
  const forkMessages = await api("GET", `/api/chats/${fork.chatId}/messages`);
  assert.deepEqual(
    forkMessages
      .filter((message: { role: string }) => message.role !== "system")
      .map((message: { content: string }) => message.content)
      .filter(
        (content: string) => content === "A library." || content === "Welcome." || content === "Explore the library.",
      ),
    ["A library.", "Welcome."],
    "only the guide is left out",
  );
  // A scene whose plan had no guide: the copy still keeps the description, which is marked too.
  const guideMessage = (await api("GET", `/api/chats/${scene.id}/messages`)).find(
    (message: { content: string }) => message.content === "Explore the library.",
  );
  await createChatsStorage(app.db).removeMessage(guideMessage.id);
  const noGuideFork = await api("POST", "/api/scene/fork", {
    sceneChatId: scene.id,
    mode: "clone",
    includeParticipationGuide: false,
  });
  assert.deepEqual(
    (await api("GET", `/api/chats/${noGuideFork.chatId}/messages`))
      .map((message: { content: string }) => message.content)
      .filter((content: string) => content === "A library." || content === "Welcome."),
    ["A library.", "Welcome."],
    "with no guide in the scene, nothing else is left out",
  );
  const store = createChatsStorage(app.db);
  const chars = createCharactersStorage(app.db);
  const meta = (await api("GET", `/api/chats/${origin.id}`)).metadata;
  assert.deepEqual(meta.sceneBusyCharIds, selected.participantCharacterIds);
  // Earlier versions marked only the initiating character busy. Read the actual Scene roster.
  const legacyMeta = { ...meta, sceneBusyCharIds: [ids[0]] };
  assert.deepEqual(await resolveSceneBusyCharacterIds(store, origin.id, legacyMeta), selected.participantCharacterIds);
  for (const [chatId, field] of [
    [origin.id, "metadata"],
    [scene.id, "metadata"],
    [scene.id, "characterIds"],
  ]) {
    assert.deepEqual(
      await resolveSceneBusyCharacterIds(
        {
          getById: async (id) => {
            const row = await store.getById(id);
            return id === chatId && row ? { ...row, [field]: "invalid JSON" } : row;
          },
        },
        origin.id,
      ),
      [],
      `Malformed ${field} cannot crash Conversation availability`,
    );
  }
  const presenceArgs = {
    db: app.db,
    chatId: origin.id,
    chatMeta: legacyMeta,
    characterIds: ids,
    chats: store,
    chars,
    promptNow: new Date(),
    shouldAccountAutonomousGeneration: false,
    skipPresenceDelay: true,
    supportsHiddenFromAI: false,
    contextMessageLimit: null,
    chatMessages: [],
    finalMessages: [],
    abortSignal: new AbortController().signal,
    writeSse: () => {},
    endSse: () => {},
    mapChatHistoryMessageForPrompt: async () => ({ role: "user" as const, content: "Hello" }),
    resolveHistoryMessageMacros: (messages: any[]) => messages,
  };
  assert.deepEqual((await resolveConversationPresenceRuntime(presenceArgs)).respondingCharacterIds, [ids[2]]);
  const blockedEvents: unknown[] = [];
  assert.equal(
    (
      await resolveConversationPresenceRuntime({
        ...presenceArgs,
        forCharacterId: ids[0],
        writeSse: (event) => blockedEvents.push(event),
      })
    ).ended,
    true,
  );
  assert.deepEqual(blockedEvents[0], { type: "offline", reason: "scene_busy", characters: ["Al"] });
  const sourceReply = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: {
      chatId: origin.id,
      connectionId: conn.id,
      forCharacterId: ids[0],
      streaming: false,
      skipPresenceDelay: true,
    },
  });
  assert.ok(sourceReply.body.includes('"reason":"scene_busy"'), sourceReply.body);
  const mixedEvents: unknown[] = [];
  await resolveConversationPresenceRuntime({
    ...presenceArgs,
    chats: {
      getById: (id) => store.getById(id),
      patchMetadata: (...args) => store.patchMetadata(...args),
      listMessages: (id) => store.listMessages(id),
      resolveConversationPresenceState: async () => ({
        schedules: {},
        statusOverrides: {
          [ids[2]]: {
            status: "offline" as const,
            activity: "Away",
            createdAt: new Date().toISOString(),
            expiresAt: null,
          },
        },
      }),
    },
    writeSse: (event) => mixedEvents.push(event),
  });
  assert.deepEqual(
    mixedEvents,
    [
      { type: "offline", reason: "scene_busy", characters: ["Al", "Charlie"] },
      { type: "offline", characters: ["Charlie"] },
      { type: "done" },
    ],
    "Scene participation and actual offline presence have separate notices even with colliding names",
  );
  providerContent = "I stayed in the Conversation.";
  const mergedReply = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: {
      chatId: origin.id,
      connectionId: conn.id,
      userMessage: "Hello, everyone.",
      streaming: false,
      skipPresenceDelay: true,
    },
  });
  assert.equal(mergedReply.statusCode, 200, mergedReply.body);
  assert.ok(!mergedReply.body.includes('"type":"error"'), mergedReply.body);
  assert.ok(
    requests.at(-1)!.messages.some((message) => message.content.includes("Only Charlie may respond this turn")),
    "Merged replies instruct the model to exclude characters currently in a Scene",
  );
  const savedReply = (await store.listMessages(origin.id)).findLast((message) => message.role === "assistant");
  assert.equal(savedReply?.characterId, ids[2], "An untagged merged reply belongs to an available character");
  for (const content of [
    "[12:01] Alice: I ignored the instruction.",
    '<speaker="Bob">I ignored it too.</speaker>',
    "Al: This uses my Conversation display name.",
    "Charlie: My display name matches an available character.",
  ]) {
    providerContent = content;
    const blocked = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: origin.id, connectionId: conn.id, streaming: false, skipPresenceDelay: true },
    });
    assert.ok(blocked.body.includes('"type":"offline"'), "A rejected reply emits an unavailable event");
    assert.ok(blocked.body.includes('"reason":"scene_busy"'), "A rejected reply explains Scene participation");
    assert.equal(
      (await store.listMessages(origin.id)).filter((message) => message.role === "assistant").length,
      1,
      "A recognized busy speaker cannot be saved even when the model ignores the instruction",
    );
  }
  // A merged response can name two unavailable characters through one display name.
  await store.update(scene.id, { characterIds: [ids[1]] });
  await chars.update(
    ids[2],
    {
      extensions: {
        conversationStatusOverride: {
          status: "offline",
          activity: "Away",
          createdAt: new Date().toISOString(),
          expiresAt: null,
        },
      },
    } as never,
    undefined,
    { skipVersionSnapshot: true },
  );
  providerContent = "Charlie: I cannot reply.";
  const collisionReply = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: origin.id, connectionId: conn.id, streaming: false, skipPresenceDelay: true },
  });
  const collisionNotices = collisionReply.body
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)))
    .filter((event) => event.type === "offline");
  assert.deepEqual(collisionNotices, [
    { type: "offline", reason: "scene_busy", characters: ["Charlie"] },
    { type: "offline", characters: ["Charlie"] },
  ]);
  await store.update(scene.id, { characterIds: selected.participantCharacterIds });
  await chars.update(ids[2], { extensions: { conversationStatusOverride: null } } as never, undefined, {
    skipVersionSnapshot: true,
  });
  providerContent = JSON.stringify(plan);
  const before = requests.length;
  for (const invalid of [
    { participantCharacterIds: [] },
    { participantCharacterIds: ["stranger"] },
    { participantCharacterIds: [42] },
    { personaId: "missing" },
    { personaId: 42 },
  ]) {
    for (const url of ["/api/scene/plan", "/api/scene/create"]) {
      const response = await app.inject({
        method: "POST",
        url,
        payload: url.endsWith("plan")
          ? { chatId: origin.id, connectionId: conn.id, promptPreferences: invalid }
          : { ...payload, ...invalid },
      });
      assert.equal(response.statusCode, 400, response.body);
    }
  }
  assert.equal(requests.length, before, "Invalid selections never call the provider");
  // The Scene card switch frees participants for user replies only; autonomous messages stay paused.
  await api("PATCH", `/api/chats/${scene.id}/metadata`, { sceneOriginRepliesAllowed: true });
  assert.deepEqual(await resolveSceneBusyCharacterIds(store, origin.id, legacyMeta, { userReply: true }), []);
  assert.deepEqual(await resolveSceneBusyCharacterIds(store, origin.id, legacyMeta), selected.participantCharacterIds);
  assert.deepEqual(
    (await resolveConversationPresenceRuntime({ ...presenceArgs, forCharacterId: ids[0] })).respondingCharacterIds,
    [ids[0]],
  );
  assert.deepEqual(
    (await resolveConversationPresenceRuntime({ ...presenceArgs, shouldAccountAutonomousGeneration: true }))
      .respondingCharacterIds,
    [ids[2]],
    "Autonomous messages keep Scene participants paused",
  );
  await api("PATCH", `/api/chats/${scene.id}/metadata`, { sceneOriginRepliesAllowed: false });
  assert.deepEqual(
    await resolveSceneBusyCharacterIds(store, origin.id, legacyMeta, { userReply: true }),
    selected.participantCharacterIds,
  );
  await api("POST", "/api/scene/abandon", { sceneChatId: scene.id });
  const restored = (await api("GET", `/api/chats/${origin.id}`)).metadata;
  assert.deepEqual(await resolveSceneBusyCharacterIds(store, origin.id, legacyMeta), []);
  assert.deepEqual(
    (await resolveConversationPresenceRuntime({ ...presenceArgs, chatMeta: restored })).respondingCharacterIds,
    ids,
  );

  // A Scene opened while a Conversation reply waits must suppress that delayed reply.
  mock.timers.enable({ apis: ["setTimeout"] });
  let delayed!: () => void;
  const delayEvents: any[] = [];
  const delayReady = new Promise<void>((resolve) => (delayed = resolve));
  const delayedReply = resolveConversationPresenceRuntime({
    ...presenceArgs,
    chatMeta: restored,
    forCharacterId: ids[0],
    skipPresenceDelay: false,
    chats: {
      ...store,
      resolveConversationPresenceState: async () => ({
        schedules: {},
        statusOverrides: { [ids[0]!]: { status: "idle" as const, createdAt: new Date().toISOString() } },
      }),
    },
    writeSse: (event: any) => {
      delayEvents.push(event);
      if (event.type === "delayed") delayed();
    },
  });
  await delayReady;
  const laterScene = await api("POST", "/api/scene/create", payload);
  mock.timers.tick(15 * 60_000);
  const delayedResult = await delayedReply;
  mock.timers.reset();
  assert.equal(delayedResult.ended, true);
  assert.deepEqual(delayedResult.respondingCharacterIds, []);
  assert.deepEqual(delayEvents.find((event) => event.type === "offline")?.characters, ["Al"]);
  await api("POST", "/api/scene/conclude", { sceneChatId: laterScene.chatId, connectionId: conn.id });
  const returned = await api("GET", `/api/chats/${origin.id}/messages`);
  assert.ok(
    returned.at(-1).content.startsWith("*Scene persona and Alice returned"),
    "The return message uses a participant, not the excluded initiator",
  );

  // Omitted overrides preserve the automatic plan and the source persona.
  await api("PATCH", `/api/chats/${origin.id}`, { personaId: persona.id });
  const automatic = await api("POST", "/api/scene/create", {
    originChatId: origin.id,
    plan: { ...plan, characterIds: [ids[1]] },
    initiatorCharId: ids[1],
  });
  const automaticChat = await api("GET", `/api/chats/${automatic.chatId}`);
  assert.deepEqual(automaticChat.characterIds, [ids[1]]);
  assert.equal(automaticChat.personaId, persona.id);
  await api("POST", "/api/scene/abandon", { sceneChatId: laterScene.chatId });
  const stillActive = await api("GET", `/api/chats/${origin.id}`);
  assert.equal(
    stillActive.metadata.activeSceneChatId,
    automatic.chatId,
    "Cleaning up an older Scene cannot release the active Scene",
  );
  assert.deepEqual(stillActive.metadata.sceneBusyCharIds, [ids[1]]);
  assert.equal(stillActive.connectedChatId, automatic.chatId);
} finally {
  mock.timers.reset();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
}
