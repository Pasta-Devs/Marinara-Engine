/**
 * Marinara's Novel Preset, seeded and assembled for real in the four setups a novel can have: no persona
 * and no characters, a persona with characters, characters only, and a persona only. The protagonist is
 * the persona when there is one, otherwise the manuscript's lead, a character, or one the AI establishes.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-novel-preset-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { seedDefaultPreset } = await import("../../packages/server/src/db/seed.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { assemblePrompt } = await import("../../packages/server/src/services/prompt/assembler.js");
const { characterDataSchema, isStockMarinaraNovelPreset } = await import("../../packages/shared/src/index.js");

// The bundled file: each choice's default is its first option, and every section is placed once.
const bundled = JSON.parse(
  readFileSync(new URL("../../packages/server/src/db/novel-preset.json", import.meta.url), "utf8"),
).data;
const defaults = JSON.parse(bundled.preset.defaultChoices) as Record<string, string>;
assert.equal(bundled.preset.parameters, "{}");
for (const block of bundled.choiceBlocks) {
  const options = JSON.parse(block.options) as Array<{ value: string }>;
  assert.equal(defaults[block.variableName], options[0]!.value, `${block.variableName} defaults to its first option`);
}
assert.deepEqual(
  Object.keys(defaults).sort(),
  bundled.choiceBlocks.map((b: { variableName: string }) => b.variableName).sort(),
);
const order = JSON.parse(bundled.preset.sectionOrder) as string[];
assert.deepEqual([...order].sort(), bundled.sections.map((section: { id: string }) => section.id).sort());
assert.deepEqual(
  bundled.sections
    .filter((section: { isMarker: string }) => section.isMarker === "true")
    .map((section: { markerConfig: string }) => JSON.parse(section.markerConfig).type),
  ["lorebook", "character", "dialogue_examples", "persona", "chat_summary", "chat_history"],
);
assert.equal(bundled.sections.at(-1).name, "Output Format");
// The passage holds only the story: no bracketed notes or guidance copied from the guide.
assert.ok(
  bundled.sections.at(-1).content.includes("- Never write bracketed notes, directions, or guidance into the passage."),
);
assert.ok(!bundled.sections.at(-1).content.includes("bracketed guide"));
// The novel page shows italic and bold, so the model may write *italics*, and no other markdown.
assert.ok(
  bundled.sections
    .at(-1)
    .content.includes(
      "You may use *italics* for a character's thoughts and for emphasis; use no other markdown: no bold, headings, lists, or notes about the writing.",
    ),
);
assert.ok(!bundled.sections.at(-1).content.includes("No markdown, asterisks"));

const db = await getDB();
try {
  await seedDefaultPreset(db);
  const prompts = createPromptsStorage(db);
  const novel = (await prompts.list()).find(isStockMarinaraNovelPreset);
  assert.ok(novel, "the seed creates Marinara's Novel Preset");
  const [sections, groups, choiceBlocks] = await Promise.all([
    prompts.listSections(novel.id),
    prompts.listGroups(novel.id),
    prompts.listChoiceBlocksForPreset(novel.id),
  ]);
  const characters = createCharactersStorage(db);
  const ivo = await characters.create(
    characterDataSchema.parse({ name: "Ivo", description: "A harbour pilot who is {{user}}'s brother." }),
  );
  const lena = await characters.create(
    characterDataSchema.parse({ name: "Lena", description: "A lighthouse keeper." }),
  );

  const assemble = async (persona: { name: string; description: string } | null, characterIds: string[]) => {
    const assembled = await assemblePrompt({
      db,
      preset: novel as never,
      sections: sections as never,
      groups: groups as never,
      choiceBlocks: choiceBlocks as never,
      chatChoices: {},
      chatId: "novel-preset-proof",
      characterIds,
      personaName: persona?.name ?? "User",
      personaDescription: persona?.description ?? "",
      chatMessages: [{ role: "assistant", content: "The rain kept falling on the harbour." }],
      disableLorebooks: true,
      enableAgents: false,
      previewOnly: true,
    });
    return assembled.messages;
  };
  const mara = { name: "Mara", description: "A cartographer who maps the coast." };
  const cases = {
    a: await assemble(null, []),
    bOne: await assemble(mara, [ivo.id]),
    bMany: await assemble(mara, [ivo.id, lena.id]),
    cOne: await assemble(null, [ivo.id]),
    cMany: await assemble(null, [ivo.id, lena.id]),
    d: await assemble(mara, []),
    nameOnly: await assemble({ name: "Mara", description: "" }, [ivo.id]),
  };
  const text = (messages: Array<{ content: string }>) => messages.map((message) => message.content).join("\n");

  for (const [name, messages] of Object.entries(cases)) {
    const prompt = text(messages);
    assert.doesNotMatch(prompt, /\{\{|\}\}/, `${name}: every macro resolves`);
    assert.doesNotMatch(prompt, /Never narrate|\*thoughts\*|<speaker/, name);
    assert.doesNotMatch(prompt, /The protagonist is (the protagonist|User)\b/, name);
    assert.ok(prompt.includes(`Keep the passage ${defaults.length}.`), `${name}: the default length`);
    assert.ok(prompt.includes("Write the next passage of the manuscript"), name);
    assert.ok(prompt.includes(defaults.guidelines!.slice(0, 40)), `${name}: the NSFW default`);
    // The request ends on the system output format, never on an assistant passage that reads as a prefill.
    const last = messages.at(-1)!;
    assert.equal(last.role, "system", name);
    assert.match(last.content, /<output_format>[\s\S]*Write the next passage[\s\S]*<\/output_format>/, name);
  }

  // (a) No persona, no characters: the AI establishes a protagonist and there is no prepared cast.
  assert.ok(text(cases.a).includes("establish a protagonist in this passage"));
  assert.ok(text(cases.a).includes("There is no prepared cast."));
  // (b) A persona with characters: the persona is the protagonist, the characters are the cast.
  assert.ok(text(cases.bOne).includes("The protagonist is Mara, whose profile is in the story bible below."));
  assert.ok(text(cases.bOne).includes("The principal character is Ivo."));
  assert.ok(text(cases.bOne).includes("A harbour pilot who is Mara's brother."));
  assert.ok(text(cases.bMany).includes("The principal characters are Ivo, Lena."));
  assert.ok(!text(cases.bMany).includes("No protagonist has been set"));
  // (c) Characters only: the manuscript decides, else a character.
  assert.ok(text(cases.cOne).includes("the protagonist is Ivo, unless the profile below points to someone else"));
  assert.ok(text(cases.cOne).includes("A harbour pilot who is User's brother."));
  assert.ok(text(cases.cMany).includes("choose the protagonist: one of Ivo, Lena if the story is clearly theirs"));
  assert.ok(text(cases.cMany).includes("The principal characters are Ivo, Lena."));
  // (d) A persona only.
  assert.ok(text(cases.d).includes("The protagonist is Mara, whose profile is in the story bible below."));
  assert.ok(text(cases.d).includes("There is no prepared cast."));
  // A persona with only a name counts as no persona: nothing else in the prompt shows its name either.
  assert.ok(text(cases.nameOnly).includes("No protagonist has been set"));
  assert.ok(!text(cases.nameOnly).includes("The protagonist is Mara"));
  // The preset never names the "User" fallback itself.
  for (const section of bundled.sections as Array<{ content: string }>) assert.ok(!section.content.includes('"User"'));
  // The point of view is the grammatical person, then the narration style: "in third-person limited narration".
  assert.ok(text(cases.a).includes("in third-person limited narration that stays close to the protagonist"));
} finally {
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}

console.info("Novel preset regression passed.");
