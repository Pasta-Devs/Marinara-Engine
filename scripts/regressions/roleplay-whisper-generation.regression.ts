import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-whisper-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const {
  characterDataSchema,
  formatTextQuotes,
  getRoleplayCommandContentOffset,
  getRoleplayWhispers,
  reanchorRoleplayCommandActivity,
} = await import("../../packages/shared/dist/index.js");
const prompts: string[] = [];
let outputs: string[] = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  prompts.push(JSON.stringify(body.messages));
  const content = outputs.shift();
  assert.notEqual(content, undefined, "unexpected provider request");
  response.writeHead(200, { "content-type": "text/event-stream" });
  // Split every character, including command prefixes, escaped quotes and brackets.
  for (const character of content!)
    response.write(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: character }, finish_reason: null }] })}\n\n`,
    );
  response.end(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
  );
});
const db = await getDB();
const chats = createChatsStorage(db);
const characters = createCharactersStorage(db);
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });
await app.register(chatsRoutes, { prefix: "/api/chats" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Whisper fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 32768,
    maxTokensOverride: 512,
  });
  assert(connection);
  const participants = await Promise.all(
    ["Alice", "Bob", "Narrator"].map((name) => characters.create(characterDataSchema.parse({ name }))),
  );
  const [alice, bob, narrator] = participants;
  assert(alice && bob && narrator);
  const persona = await characters.createPersona("Mari", "The player.");
  assert(persona);
  const presets = createPromptsStorage(db);
  const preset = await presets.create({
    name: "Whisper fixture",
    parameters: { maxTokens: 512, maxContext: 32768, strictRoleFormatting: true },
    wrapFormat: "xml",
  });
  assert(preset);
  await presets.createSection({
    presetId: preset.id,
    identifier: "rules",
    name: "Rules",
    content: "Respond as {{char}}.",
  });
  await presets.createSection({
    presetId: preset.id,
    identifier: "history",
    name: "Chat History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  });
  const chat = await chats.create({
    name: "Whisper proof",
    mode: "roleplay",
    characterIds: [alice.id, bob.id, narrator.id],
    personaId: persona.id,
    connectionId: connection.id,
    promptPresetId: preset.id,
  });
  assert(chat);
  await chats.patchMetadata(chat.id, {
    enableAgents: false,
    enableTools: false,
    enableMemoryRecall: false,
    roleplayCommandsEnabled: true,
    roleplayCommandToggles: { whisper: true },
    roleplayCommandNarratorId: narrator.id,
    groupChatMode: "individual",
    groupResponseOrder: "manual",
  });
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Begin." });
  const generate = async (output: string, forCharacterId = alice.id, options: Record<string, unknown> = {}) => {
    outputs = [output];
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, forCharacterId, ...options },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    assert.equal(outputs.length, 0);
    return response;
  };
  const preview = async (forCharacterId: string, options: Record<string, unknown> = {}) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/dryRun",
      payload: { chatId: chat.id, forCharacterId, returnPrompt: true, ...options },
    });
    assert.equal(response.statusCode, 200, response.body);
    return JSON.stringify(response.json().prompt.messages);
  };
  const first = await generate(
    'Before. [whisper: character="Bob" text="BOB_ONLY_SECRET"] After. [whisper: character="Mari" text="PERSONA_ONLY_SECRET"]',
  );
  const tokens = first.body
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .flatMap((line) => {
      try {
        const event = JSON.parse(line.slice(6));
        return event.type === "token" ? [event.data] : [];
      } catch {
        return [];
      }
    })
    .join("");
  assert(tokens.includes("Before.") && tokens.includes("After."), "the stream proof includes real public tokens");
  assert(
    !tokens.includes("SECRET") && !tokens.includes("[whisper"),
    "streamed narration never contains private command text",
  );
  const saved = (await chats.listMessages(chat.id)).at(-1)!;
  assert.equal(saved.content, "Before.  After.");
  const whispers = getRoleplayWhispers(JSON.parse(saved.extra));
  assert.equal(whispers.length, 2);
  assert.deepEqual(whispers[0]!.recipient, { id: bob.id, kind: "character" });
  assert.deepEqual(whispers[1]!.recipient, { id: persona.id, kind: "persona" });
  assert.equal(whispers[0]!.activity.contentOffset, "Before.".length);
  for (const id of [alice.id, bob.id, narrator.id]) {
    await generate("Public reply.", id);
    const live = prompts.at(-1)!;
    const dry = await preview(id);
    for (const content of [live, dry]) {
      assert.equal(
        content.includes("BOB_ONLY_SECRET"),
        id === bob.id || id === narrator.id,
        "recipient and narrator alone get the character secret",
      );
      assert.equal(
        content.includes("PERSONA_ONLY_SECRET"),
        id === narrator.id,
        "the sender does not gain recipient knowledge",
      );
      if (id !== alice.id)
        assert(
          content.indexOf("Before.") < content.indexOf("BOB_ONLY_SECRET") &&
            content.indexOf("BOB_ONLY_SECRET") < content.indexOf("After."),
          "the private prompt preserves the whisper's position between public statements",
        );
    }
  }
  await chats.patchMetadata(chat.id, { inactiveCharacterIds: [narrator.id] });
  assert(!(await preview(narrator.id)).includes("BOB_ONLY_SECRET"));
  assert((await preview(bob.id)).includes("BOB_ONLY_SECRET"));
  await chats.patchMetadata(chat.id, { inactiveCharacterIds: [] });
  await generate(
    'Start. [whisper: character="Bob" text="FIRST_SECRET"] [whisper: character="Bob" text="SECOND_SECRET"] End.',
  );
  const adjacent = await preview(bob.id);
  assert(adjacent.indexOf("Start.") < adjacent.indexOf("FIRST_SECRET"));
  assert(adjacent.indexOf("FIRST_SECRET") < adjacent.indexOf("SECOND_SECRET"));
  assert(adjacent.indexOf("SECOND_SECRET") < adjacent.indexOf("End."));
  await generate('Repeat. [whisper: character="Bob" text="REPEATED_ANCHOR_SECRET"] Repeat.');
  const repeated = await preview(bob.id);
  assert(repeated.indexOf("Repeat.") < repeated.indexOf("REPEATED_ANCHOR_SECRET"));
  assert(repeated.indexOf("REPEATED_ANCHOR_SECRET") < repeated.lastIndexOf("Repeat."), repeated);
  await generate("I acknowledge the vision.", alice.id, { impersonate: true });
  for (const content of [prompts.at(-1)!, await preview(alice.id, { impersonate: true })]) {
    assert(content.includes("PERSONA_ONLY_SECRET"));
    assert(!content.includes("BOB_ONLY_SECRET"));
  }
  await chats.updateMessageExtra(saved.id, { hiddenFromAICharacterIds: [bob.id] });
  // #7191 reversed the original rule: hiding a message from its whisper's recipient hides only the narration.
  const hiddenFromBob = await preview(bob.id);
  assert(hiddenFromBob.includes("BOB_ONLY_SECRET"), "the recipient keeps its whisper");
  assert(!hiddenFromBob.includes("Before.") && !hiddenFromBob.includes("After."), "the hidden narration stays hidden");
  assert((await preview(narrator.id)).includes("BOB_ONLY_SECRET"));
  await chats.updateMessageExtra(saved.id, { hiddenFromAICharacterIds: [], hiddenFromAI: true });
  assert(!(await preview(narrator.id)).includes("BOB_ONLY_SECRET"));
  await chats.updateMessageExtra(saved.id, { hiddenFromAI: false });
  await generate("A different public reply.", alice.id, { regenerateMessageId: saved.id });
  assert(!prompts.at(-1)!.includes("BOB_ONLY_SECRET"));
  assert(!(await preview(narrator.id)).includes("BOB_ONLY_SECRET"), "the active swipe owns its secrets");
  await chats.setActiveSwipe(saved.id, 0);
  assert((await preview(bob.id)).includes("BOB_ONLY_SECRET"));

  const beforeEdit = JSON.parse((await chats.getMessage(saved.id))!.extra);
  const beforeSwipes = await chats.getSwipes(saved.id);
  const editedActivity = beforeEdit.roleplayCommandActivity.map(
    (item: (typeof whispers)[number]["activity"], index: number) =>
      index === whispers[0]!.index ? { ...item, command: { ...item.command, text: "BOB_EDITED_SECRET" } } : item,
  );
  const edit = await app.inject({
    method: "PATCH",
    url: `/api/chats/${chat.id}/messages/${saved.id}/extra?swipeIndex=0`,
    payload: { roleplayCommandActivity: editedActivity },
  });
  assert.equal(edit.statusCode, 200, edit.body);
  const edited = (await chats.getMessage(saved.id))!;
  assert.equal(edited.content, saved.content, "editing a whisper leaves public narration untouched");
  assert.deepEqual(
    JSON.parse(edited.extra),
    { ...beforeEdit, roleplayCommandActivity: editedActivity },
    "only command text changes; recipient, offsets, anchors, original activity and other commands remain intact",
  );
  const editedSwipes = await chats.getSwipes(saved.id);
  assert.deepEqual(editedSwipes[1], beforeSwipes[1], "editing the active whisper leaves the other swipe untouched");
  assert.deepEqual(JSON.parse(editedSwipes[0]!.extra).roleplayCommandActivity, editedActivity);
  for (const id of [alice.id, bob.id, narrator.id]) {
    await generate("A reply after the edit.", id);
    for (const content of [prompts.at(-1)!, await preview(id)]) {
      assert.equal(content.includes("BOB_EDITED_SECRET"), id === bob.id || id === narrator.id);
      assert(!content.includes("BOB_ONLY_SECRET"), "later prompts use edited text rather than the original command");
      assert.equal(content.includes("PERSONA_ONLY_SECRET"), id === narrator.id, "the other whisper keeps its audience");
    }
  }
  const personaPreview = await preview(alice.id, { impersonate: true });
  assert(personaPreview.includes("PERSONA_ONLY_SECRET") && !personaPreview.includes("BOB_EDITED_SECRET"));

  await chats.setActiveSwipe(saved.id, 1);
  const otherSwipeMessage = (await chats.getMessage(saved.id))!;
  const reeditedActivity = editedActivity.map((item: (typeof whispers)[number]["activity"], index: number) =>
    index === whispers[0]!.index ? { ...item, command: { ...item.command, text: "BOB_REEDITED_SECRET" } } : item,
  );
  const lateEdit = await app.inject({
    method: "PATCH",
    url: `/api/chats/${chat.id}/messages/${saved.id}/extra?swipeIndex=0`,
    payload: { roleplayCommandActivity: reeditedActivity },
  });
  assert.equal(lateEdit.statusCode, 200, lateEdit.body);
  assert.deepEqual(
    await chats.getMessage(saved.id),
    otherSwipeMessage,
    "a late save stays attached to its original swipe",
  );
  assert.deepEqual((await chats.getSwipes(saved.id))[1], beforeSwipes[1]);
  assert(!(await preview(narrator.id)).includes("BOB_REEDITED_SECRET"), "inactive swipe whispers stay out of prompts");
  await chats.setActiveSwipe(saved.id, 0);
  assert((await preview(bob.id)).includes("BOB_REEDITED_SECRET"), "edited metadata survives switching away and back");
  const invalidEdit = await app.inject({
    method: "PATCH",
    url: `/api/chats/${chat.id}/messages/${saved.id}/extra?swipeIndex=99`,
    payload: { roleplayCommandActivity: [] },
  });
  assert.equal(invalidEdit.statusCode, 404);
  assert.deepEqual(JSON.parse((await chats.getMessage(saved.id))!.extra).roleplayCommandActivity, reeditedActivity);

  await generate('[whisper: character="Bob" text="WHISPER_WITHOUT_PROSE"]');
  assert((await preview(bob.id)).includes("WHISPER_WITHOUT_PROSE"), "secret-only messages survive history shaping");
  assert(!(await preview(alice.id)).includes("WHISPER_WITHOUT_PROSE"));
  await generate('Continued. [whisper: character="Bob" text="CONTINUED_SECRET"]', alice.id, {
    continueMessageId: saved.id,
  });
  assert((await preview(bob.id)).includes("CONTINUED_SECRET"));
  assert(!(await preview(bob.id, { regenerateMessageId: saved.id })).includes("CONTINUED_SECRET"));

  await chats.patchMetadata(chat.id, { roleplayWhisperAudience: "narrator" });
  await generate('Ignored. [whisper: character="Bob" text="UNAUTHORIZED_SECRET"]');
  assert(!prompts.at(-1)!.includes("[whisper:"));
  assert(!(await preview(bob.id)).includes("UNAUTHORIZED_SECRET"));
  await generate('Allowed. [whisper: character="Bob" text="NARRATOR_SECRET"]', narrator.id);
  assert((await preview(bob.id)).includes("NARRATOR_SECRET"));
  await generate('Invalid. [whisper: character="Unknown" text="INVALID_TARGET_SECRET"]', narrator.id);
  assert(!(await preview(narrator.id)).includes("INVALID_TARGET_SECRET"));
  await chats.patchMetadata(chat.id, { roleplayWhisperAudience: "all", groupResponseOrder: "sequential" });
  outputs = [
    'Alice speaks. [whisper: character="Bob" text="SAME_TURN_SECRET"]',
    'Bob answers. [whisper: character="Mari" text="SAME_TURN_PERSONA_SECRET"]',
    "The narrator continues.",
  ];
  const turnStart = prompts.length;
  const group = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
  assert.equal(group.statusCode, 200, group.body);
  assert(!group.body.includes('"type":"error"'), group.body);
  assert.equal(outputs.length, 0);
  assert.equal(prompts.length - turnStart, 3);
  assert(!prompts[turnStart]!.includes("SAME_TURN_SECRET"));
  assert(
    prompts[turnStart + 1]!.includes("SAME_TURN_SECRET"),
    "later recipients receive whispers within the same turn",
  );
  assert(prompts[turnStart + 2]!.includes("SAME_TURN_PERSONA_SECRET"), "the narrator sees the latest in-turn secrets");
  // An edit keeps a model whisper where it was, also when saving the edit curls the quotes.
  await generate('"Wait," she says. [whisper: character="Bob" text="PLACED_SECRET"] She leaves. "Bye."');
  const placed = (await chats.listMessages(chat.id)).at(-1)!;
  const editedContent = formatTextQuotes(placed.content.replace("Wait,", "Wait a moment,"), "typographic");
  const editResponse = await app.inject({
    method: "PATCH",
    url: `/api/chats/${chat.id}/messages/${placed.id}`,
    payload: { content: editedContent },
  });
  assert.equal(editResponse.statusCode, 200, editResponse.body);
  const afterEdit = (await chats.getMessage(placed.id))!;
  assert.equal(afterEdit.content, editedContent);
  const placedWhisper = getRoleplayWhispers(JSON.parse(afterEdit.extra)).find(
    ({ command }) => command.text === "PLACED_SECRET",
  )!;
  const saysEnd = editedContent.indexOf("she says.") + "she says.".length;
  assert.equal(getRoleplayCommandContentOffset(afterEdit.content, placedWhisper.activity), saysEnd);
  const placedView = await preview(bob.id);
  assert(
    placedView.indexOf("she says.") < placedView.indexOf("PLACED_SECRET") &&
      placedView.indexOf("PLACED_SECRET") < placedView.indexOf("She leaves."),
    "the prompt keeps the edited whisper in place",
  );
  // A saved anchor in straight quotes still finds text whose quotes were curled later.
  for (const contentOffset of [15, 3])
    assert.equal(
      getRoleplayCommandContentOffset("\u201cHi,\u201d she said. Then", {
        command: placedWhisper.command,
        raw: placedWhisper.activity.raw,
        contentOffset,
        contentAnchor: '"Hi," she said.',
      }),
      15,
    );
  // Other edits: unchanged text around a whisper keeps it in place; without any, it shows at the end as before.
  const typos =
    "The tavern was quiet tonight, the fire low.\n\nMara wiped the counter as she worked.\n\nBob ordered, smilling.";
  for (const [before, after, marker, expected] of [
    [typos, typos.replace("tonight", "tonite").replace("smilling", "smiling"), "as she worked.", "as she worked.[W]"],
    ["A. middle. Z.", "AA. middle. ZZ.", "middle.", "AA. middle.[W] ZZ."],
    ["She nods. She smiles. She leaves.", "She nods. She leaves.", "smiles.", "She nods.[W] She leaves."],
    ["One. Two. Three.", "One. Three.", "Two.", "One.[W] Three."],
    ["Hello. Bye.", "Hello. New. Bye.", "Hello.", "Hello.[W] New. Bye."],
    ['He smiled. "Fine, go then."', 'She frowned. "Leave now."', "smiled.", 'She frowned. "Leave now."[W]'],
  ] as const) {
    const offset = before.indexOf(marker) + marker.length;
    const [moved] = reanchorRoleplayCommandActivity(before, after, [
      {
        command: placedWhisper.command,
        raw: placedWhisper.activity.raw,
        contentOffset: offset,
        contentAnchor: before.slice(Math.max(0, offset - 80), offset),
      },
    ]);
    const position = getRoleplayCommandContentOffset(after, moved!);
    const placedText = `${after.slice(0, position)}[W]${after.slice(position)}`;
    assert(placedText.includes(expected), placedText);
  }
  // Restoring the earlier text, as Prose Guardian's toggle does, brings the whisper back to where it was.
  const whisperAfter = (text: string, marker: string) => {
    const offset = text.indexOf(marker) + marker.length;
    return {
      command: placedWhisper.command,
      raw: placedWhisper.activity.raw,
      contentOffset: offset,
      contentAnchor: text.slice(Math.max(0, offset - 80), offset),
    };
  };
  const placeAfterEdits = (texts: readonly string[], marker: string) => {
    let item = whisperAfter(texts[0]!, marker);
    for (let index = 1; index < texts.length; index++)
      item = reanchorRoleplayCommandActivity(texts[index - 1]!, texts[index]!, [item])[0]!;
    const text = texts.at(-1)!;
    const position = getRoleplayCommandContentOffset(text, item);
    return `${text.slice(0, position)}[W]${text.slice(position)}`;
  };
  const original = 'She smiled softly.  Her eyes sparkled. "Come here," she said.';
  for (const rewrite of [
    'She smiled.  Her eyes sparkled. "Come here," she said.',
    'She smiled. Her eyes sparkled. "Come here," she said.',
  ])
    assert(placeAfterEdits([original, rewrite, original, rewrite, original], "softly.").includes("softly.[W]"));
  // Undoing a deletion, or several edits, puts the whisper back where it first was.
  const nodding = "He nods. She smiles. Bob leaves.";
  assert(placeAfterEdits([nodding, "He nods. Bob leaves.", nodding], "smiles.").includes("smiles.[W] Bob"));
  const late = 'She nods. "You\'re late," she says. She smiles.';
  assert(
    placeAfterEdits(
      [
        late,
        'A nod. "You\'re late," she says. A smile tugs at her lips.',
        'A nod. "You\'re late," she said. A smile tugs at her lips.',
        late,
      ],
      "she says.",
    ).includes("she says.[W] She smiles."),
  );
  // Editing away one copy of a repeated phrase leaves the whisper after the edited copy, not the other one.
  assert(placeAfterEdits(["Go. He leaves. Go.", "Stop. He leaves. Go."], "Go.").includes("Stop.[W] He leaves."));
  // A phrase that appears twice never pulls a whisper to the other copy; it shows at the end, as before.
  const repeatedBeat =
    '"You came?" *She glances at the door.* "Sit."\n\nMara pours. "Drink first." *She glances at the door.*';
  assert(
    placeAfterEdits(
      [
        repeatedBeat,
        repeatedBeat
          .replace('Mara pours. "Drink', 'Mara pours two. "Drink')
          .replace(/\*She glances at the door\.\*$/, "*Her eyes return.*"),
      ],
      '"Drink first."',
    ).endsWith("[W]"),
  );
  await chats.patchMetadata(chat.id, { groupChatMode: "merged", roleplayWhisperAudience: "all" });
  assert(!(await preview(bob.id)).includes("BOB_REEDITED_SECRET"), "merged voices must not receive private knowledge");
  await generate('Merged. [whisper: character="Bob" text="MERGED_SECRET"]');
  assert(!prompts.at(-1)!.includes("[whisper:"));
  assert.equal(getRoleplayWhispers(JSON.parse((await chats.listMessages(chat.id)).at(-1)!.extra)).length, 0);
  console.log(
    "Roleplay whisper generation passed: streamed privacy, recipient/narrator/persona prompts, preview parity, edited metadata, swipe isolation, failed saves, visibility, continuation and permissions.",
  );
} finally {
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
