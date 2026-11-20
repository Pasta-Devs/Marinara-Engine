/**
 * The stock Marinara's Universal Preset sends activated lorebook entries after the chat history. Keyword entries
 * change from turn to turn, and a provider's prompt cache reuses a prompt only up to its first changed token, so lore
 * placed early kept everything after it, the whole history included, out of the cache.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-stock-lore-placement-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.LOG_LEVEL = "silent";

const { createLorebookEntrySchema, createLorebookSchema, isStockMarinaraUniversalPreset } =
  await import("../../../packages/shared/src/index.js");
const { createFileNativeDB } = await import("../../../packages/server/src/db/file-backed-store.js");
const { seedDefaultPreset } = await import("../../../packages/server/src/db/seed.js");
const { createPromptsStorage } = await import("../../../packages/server/src/services/storage/prompts.storage.js");
const { createLorebooksStorage } = await import("../../../packages/server/src/services/storage/lorebooks.storage.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { assemblePrompt } = await import("../../../packages/server/src/services/prompt/assembler.js");
const { postProcessMessages } = await import("../../../packages/server/src/routes/generate/generate-route-utils.js");
const { runNamedCases } = await import("../fixtures/named-cases.js");

type PromptMessage = { role: string; content: string };

const LORE = /WORLD_FACT|CASTLE_LORE|DRAGON_LORE/u;
const db = await createFileNativeDB();

try {
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

  await runNamedCases([
    {
      name: "lorebook entries follow the chat history and precede Output Format, still wrapped as lore",
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
      name: "a turn that fires other entries leaves the system prompt unchanged",
      run: () => {
        assert.match(firstSent.at(-1)!.content, /CASTLE_LORE/u, "the first turn fires the castle entry");
        assert.doesNotMatch(firstSent.at(-1)!.content, /DRAGON_LORE/u);
        assert.match(secondSent.at(-1)!.content, /DRAGON_LORE/u, "the second turn fires the dragon entry");
        assert.equal(firstSent[0]?.role, "system");
        assert.deepEqual(secondSent[0], firstSent[0], "the system prompt is byte-identical across the two turns");
      },
    },
    {
      name: "only the newest user turn carries lore, after the player's own text",
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
  ]);
} finally {
  await db._fileStore.close();
  rmSync(dir, { recursive: true, force: true });
}

console.info("Stock preset lore placement regression checks passed.");
