/**
 * Parts of the prompt that change every turn (activated lorebook entries, recalled memories) go after the chat history.
 * A provider's prompt cache reuses a prompt only up to its first changed token, so a block like that placed before the
 * history kept the whole history out of the cache. Covers the stock Marinara's Universal Preset, the shared
 * `insertAfterHistory` helper (which Memory Recall also uses), and real turns of preset-less Roleplay and Conversation
 * chats.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-per-turn-after-history-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { characterDataSchema, createLorebookEntrySchema, createLorebookSchema, isStockMarinaraUniversalPreset } =
  await import("../../../packages/shared/src/index.js");
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { seedDefaultPreset } = await import("../../../packages/server/src/db/seed.js");
const { createPromptsStorage } = await import("../../../packages/server/src/services/storage/prompts.storage.js");
const { createLorebooksStorage } = await import("../../../packages/server/src/services/storage/lorebooks.storage.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createCharactersStorage } = await import("../../../packages/server/src/services/storage/characters.storage.js");
const { createConnectionsStorage } =
  await import("../../../packages/server/src/services/storage/connections.storage.js");
const { assemblePrompt } = await import("../../../packages/server/src/services/prompt/assembler.js");
const { insertAfterHistory } = await import("../../../packages/server/src/services/lorebook/prompt-injector.js");
const { postProcessMessages } = await import("../../../packages/server/src/routes/generate/generate-route-utils.js");
const { generateRoutes } = await import("../../../packages/server/src/routes/generate.routes.js");
const { runNamedCases } = await import("../fixtures/named-cases.js");
const requireServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;

type PromptMessage = { role: string; content: string; contextKind?: "prompt" | "history" | "injection" };

const LORE = /WORLD_FACT|CASTLE_LORE|DRAGON_LORE/u;
const db = await getDB();

// A local stand-in for an OpenAI-compatible service: records each request's messages and streams a short reply.
const requests: PromptMessage[][] = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  requests.push((JSON.parse(Buffer.concat(chunks).toString() || "{}").messages ?? []) as PromptMessage[]);
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.end(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: "Reply." }, finish_reason: null }] })}\n\n` +
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
  );
});
const app = Fastify();
app.decorate("db", db);
app.decorate("activeGenerations", new Map());
await app.register(generateRoutes, { prefix: "/api/generate" });

try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");

  await seedDefaultPreset(db);
  const prompts = createPromptsStorage(db);
  const stock = (await prompts.list()).find(isStockMarinaraUniversalPreset);
  assert.ok(stock, "a fresh profile receives the stock preset");
  const sections = await prompts.listSections(stock.id);
  const groups = await prompts.listGroups(stock.id);
  const choiceBlocks = await prompts.listChoiceBlocksForPreset(stock.id);

  const lorebooks = createLorebooksStorage(db);
  const world = await lorebooks.create(createLorebookSchema.parse({ name: "World" }));
  assert.ok(world);
  for (const entry of [
    { name: "World", content: "WORLD_FACT: magic is rare.", constant: true },
    { name: "Castle", content: "CASTLE_LORE: the castle has no gate.", keys: ["castle"] },
    { name: "Dragon", content: "DRAGON_LORE: the dragon sleeps by day.", keys: ["dragon"] },
  ]) {
    await lorebooks.createEntry(createLorebookEntrySchema.parse({ lorebookId: world.id, ...entry }));
  }
  const chats = createChatsStorage(db);
  const chat = await chats.create({ name: "Lore placement", mode: "roleplay", characterIds: [] } as never);
  assert.ok(chat);
  await chats.patchMetadata(chat.id, { activeLorebookIds: [world.id] });

  const assemble = async (chatMessages: PromptMessage[]) =>
    (
      await assemblePrompt({
        db,
        preset: stock,
        sections,
        groups,
        choiceBlocks,
        chatChoices: {},
        chatId: chat.id,
        characterIds: [],
        personaName: "Ada",
        personaDescription: "",
        chatMessages,
        activeLorebookIds: [world.id],
        enableAgents: false,
        previewOnly: true,
      } as never)
    ).messages as PromptMessage[];
  // Two consecutive turns of one chat: the first mentions the castle, the second the dragon.
  const firstTurn = [{ role: "user", content: "We ride toward the castle." }];
  const secondTurn = [
    ...firstTurn,
    { role: "assistant", content: "The road bends north." },
    { role: "user", content: "A dragon lands ahead." },
  ];
  const first = await assemble(firstTurn);
  const second = await assemble(secondTurn);
  // What a provider receives: the route folds system sections placed after the history into the newest user turn.
  const firstSent = postProcessMessages(first as never) as PromptMessage[];
  const secondSent = postProcessMessages(second as never) as PromptMessage[];

  // Two real turns through the generate route; returns the request each turn sent to the provider.
  const character = await createCharactersStorage(db).create(
    characterDataSchema.parse({ name: "Mira", description: "Mira is a cartographer.", personality: "Curious." }),
  );
  const connection = await createConnectionsStorage(db).create({
    name: "Local fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 8192,
    maxTokensOverride: 256,
  } as never);
  assert.ok(character && connection);
  const twoRealTurns = async (mode: "roleplay" | "conversation") => {
    const turnChat = await chats.create({
      name: `Lore placement ${mode}`,
      mode,
      characterIds: [character.id],
      connectionId: connection.id,
      promptPresetId: null,
    } as never);
    assert.ok(turnChat);
    await chats.patchMetadata(turnChat.id, {
      activeLorebookIds: [world.id],
      enableAgents: false,
      enableMemoryRecall: false,
    });
    const sent: PromptMessage[][] = [];
    for (const userMessage of ["We ride toward the castle.", "A dragon lands ahead."]) {
      const before = requests.length;
      const response = await app.inject({
        method: "POST",
        url: "/api/generate/",
        payload: { chatId: turnChat.id, userMessage },
      });
      assert.equal(response.statusCode, 200, response.body);
      const turn = requests.slice(before).find((messages) => messages.some((m) => m.content.includes(userMessage)));
      assert.ok(turn, `${mode}: the turn reached the provider`);
      sent.push(turn);
    }
    return sent;
  };
  const roleplayTurns = await twoRealTurns("roleplay");
  const conversationTurns = await twoRealTurns("conversation");
  const assertLoreOnlyInNewestTurn = (sent: PromptMessage[][], label: string) => {
    for (const [index, messages] of sent.entries()) {
      const last = messages.at(-1)!;
      assert.equal(last.role, "user", `${label}: the request ends on the newest user turn`);
      assert.match(last.content, index === 0 ? /CASTLE_LORE/u : /DRAGON_LORE/u, `${label}: turn ${index + 1} lore`);
      assert.deepEqual(
        messages.slice(0, -1).filter((message) => LORE.test(message.content)),
        [],
        `${label}: no earlier message holds lore`,
      );
      const playerText = index === 0 ? "We ride toward the castle." : "A dragon lands ahead.";
      assert.ok(
        last.content.indexOf(playerText) < last.content.search(LORE),
        `${label}: the player's text comes first`,
      );
    }
  };

  await runNamedCases([
    {
      name: "stock preset: lorebook entries follow the chat history and precede Output Format, still wrapped as lore",
      run: () => {
        const prompt = first.map((message) => message.content).join("\n");
        const history = prompt.indexOf("We ride toward the castle.");
        const lore = prompt.search(LORE);
        const outputFormat = prompt.indexOf("<output_format>");
        assert.ok(history >= 0 && lore >= 0 && outputFormat >= 0, "history, lore and Output Format are all sent");
        assert.ok(history < lore, "lore comes after the chat history");
        assert.ok(lore < outputFormat, "Output Format stays the last instruction");
        assert.match(prompt, /<lore>\s*<setting>[\s\S]*WORLD_FACT[\s\S]*CASTLE_LORE[\s\S]*<\/setting>\s*<\/lore>/u);
      },
    },
    {
      name: "stock preset: a turn that fires other entries leaves the system prompt unchanged",
      run: () => {
        assert.match(firstSent.at(-1)!.content, /CASTLE_LORE/u, "the first turn fires the castle entry");
        assert.doesNotMatch(firstSent.at(-1)!.content, /DRAGON_LORE/u);
        assert.match(secondSent.at(-1)!.content, /DRAGON_LORE/u, "the second turn fires the dragon entry");
        assert.equal(firstSent[0]?.role, "system");
        assert.deepEqual(secondSent[0], firstSent[0], "the system prompt is byte-identical across the two turns");
      },
    },
    {
      name: "stock preset: only the newest user turn carries lore, after the player's own text",
      run: () => {
        for (const sent of [firstSent, secondSent]) {
          const last = sent.at(-1)!;
          assert.equal(last.role, "user");
          assert.deepEqual(
            sent.slice(0, -1).filter((message) => LORE.test(message.content)),
            [],
            "no earlier message holds lore",
          );
        }
        const last = secondSent.at(-1)!.content;
        assert.ok(last.indexOf("A dragon lands ahead.") < last.search(LORE), "the player's text comes first");
      },
    },
    {
      name: "insertAfterHistory puts a block right after the newest history message, or at the end without history",
      run: () => {
        const messages: PromptMessage[] = [
          { role: "system", content: "rules" },
          { role: "user", content: "u1", contextKind: "history" },
          { role: "assistant", content: "a1", contextKind: "history" },
          { role: "user", content: "u2", contextKind: "history" },
          { role: "system", content: "post-history instructions", contextKind: "prompt" },
        ];
        insertAfterHistory(messages, { role: "system", content: "BLOCK", contextKind: "injection" });
        assert.deepEqual(
          messages.map((message) => message.content),
          ["rules", "u1", "a1", "u2", "BLOCK", "post-history instructions"],
        );
        const noHistory: PromptMessage[] = [{ role: "system", content: "rules" }];
        insertAfterHistory(noHistory, { role: "system", content: "BLOCK" });
        assert.deepEqual(
          noHistory.map((message) => message.content),
          ["rules", "BLOCK"],
        );
      },
    },
    {
      name: "preset-less Roleplay: only the newest turn carries lore, and earlier messages stay the same",
      run: () => {
        assertLoreOnlyInNewestTurn(roleplayTurns, "Roleplay");
        const [turn1, turn2] = roleplayTurns as [PromptMessage[], PromptMessage[]];
        assert.deepEqual(
          turn2.slice(0, turn1.length - 1),
          turn1.slice(0, -1),
          "everything before the first turn's newest message is sent again unchanged",
        );
      },
    },
    {
      name: "Conversation without a {{lorebook}} macro: only the newest turn carries lore",
      run: () => assertLoreOnlyInNewestTurn(conversationTurns, "Conversation"),
    },
  ]);
} finally {
  await app.close();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}

console.info("Per-turn blocks after history regression checks passed.");
