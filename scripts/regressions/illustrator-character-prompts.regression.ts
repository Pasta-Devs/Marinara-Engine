// Guards native NovelAI per-character captions for the roleplay Illustrator.
//
// The storyboard planner already emits characterPrompts with normalized centers; the Illustrator
// reuses the same sanitizer and instruction block, and the caption cap follows the model:
// V5 accepts 22 characters while V4/V4.5 stop at 6. Anything past the cap used to be dropped
// silently, and a non-NovelAI connection must never receive the instruction at all.
import assert from "node:assert/strict";
import {
  buildIllustratorCharacterPromptInstruction,
  resolveNovelAiCharacterPromptLimit,
  sanitizeCharacterPrompts,
  supportsNovelAiCharacterPrompts,
} from "../../packages/server/src/services/image/character-prompts.js";
import { resolveIllustratorCharacterPromptInstruction } from "../../packages/server/src/services/generation/illustrator-background-generation.js";

// Caption cap follows the model generation.
assert.equal(resolveNovelAiCharacterPromptLimit("nai-diffusion-5-full"), 22);
assert.equal(resolveNovelAiCharacterPromptLimit("nai-diffusion-5-curated"), 22);
assert.equal(resolveNovelAiCharacterPromptLimit("nai-diffusion-4-5-full"), 6);
assert.equal(resolveNovelAiCharacterPromptLimit("nai-diffusion-4-curated-preview"), 6);

// Only a native NovelAI connection on a V4+ model can take structured captions.
assert.equal(
  supportsNovelAiCharacterPrompts({ model: "nai-diffusion-5-full", baseUrl: "https://image.novelai.net" }),
  true,
);
assert.equal(
  supportsNovelAiCharacterPrompts({ model: "nai-diffusion-3", baseUrl: "https://image.novelai.net" }),
  false,
  "V3 has no character captions",
);
assert.equal(
  supportsNovelAiCharacterPrompts({ model: "nai-diffusion-5-full", baseUrl: "https://linkapi.ai/v1" }),
  false,
  "proxies speak OpenAI chat completions, not the native NovelAI body",
);
assert.equal(
  supportsNovelAiCharacterPrompts({ model: "aMixIllustrious_aMix.safetensors", baseUrl: "http://127.0.0.1:8188" }),
  false,
);

// Sanitizer: name matching, dedupe, position clamping, defaults, and the cap.
const roster = ["Imogen McSweeney", "Vivianne", "Bartender"];
const sanitized = sanitizeCharacterPrompts(
  [
    { name: "imogen mcsweeney", prompt: "  girl, copper hair,   green eyes ", position: { x: 1.4, y: -0.2 } },
    { name: "Imogen McSweeney", prompt: "duplicate entry must be dropped" },
    { name: "Nobody Here", prompt: "unknown names are dropped" },
    {
      name: "Vivianne",
      prompt: "girl, platinum hair",
      negativePrompt: "copper hair",
      position: { x: 0.333, y: "0.5" },
    },
    { name: "Bartender", prompt: "" },
  ],
  roster,
  22,
);
assert.equal(sanitized.length, 2, "duplicate, unknown, and empty entries are dropped");
assert.equal(sanitized[0]!.name, "Imogen McSweeney", "matched name keeps the roster spelling");
assert.equal(sanitized[0]!.prompt, "girl, copper hair, green eyes", "whitespace is compacted");
assert.deepEqual(sanitized[0]!.position, { x: 1, y: 0 }, "positions clamp to the unit square");
assert.equal(sanitized[1]!.negativePrompt, "copper hair");
assert.deepEqual(sanitized[1]!.position, { x: 0.33, y: 0.5 }, "positions round to two decimals and coerce strings");

const noPositions = sanitizeCharacterPrompts(
  [
    { name: "Imogen McSweeney", prompt: "girl" },
    { name: "Vivianne", prompt: "girl" },
  ],
  roster,
  22,
);
assert.deepEqual(
  noPositions.map((entry) => entry.position),
  [
    { x: 1 / 3, y: 0.5 },
    { x: 2 / 3, y: 0.5 },
  ],
  "missing positions spread characters across the frame",
);

const crowd = Array.from({ length: 10 }, (_, index) => `Colonist ${index + 1}`);
const crowdPrompts = crowd.map((name) => ({ name, prompt: `girl, ${name}` }));
assert.equal(sanitizeCharacterPrompts(crowdPrompts, crowd, 6).length, 6, "V4.5 cap keeps the first six");
assert.equal(sanitizeCharacterPrompts(crowdPrompts, crowd, 22).length, 10, "V5 keeps every entry under 22");
assert.equal(sanitizeCharacterPrompts(crowdPrompts, [], 22).length, 0, "no roster means no captions");

// Instruction block names the field and the cap so the prompt writer stays inside it.
const instruction = buildIllustratorCharacterPromptInstruction(22);
assert.match(instruction, /characterPrompts/);
assert.match(instruction, /\b22\b/);
assert.match(instruction, /source#/, "action-role syntax is taught");
assert.match(instruction, /x=0 is left/, "position semantics are taught");

// The resolver only produces an instruction for a native NovelAI image connection.
type FakeConnection = {
  id: string;
  model: string;
  baseUrl: string;
  imageService?: string | null;
  imageGenerationSource?: string | null;
};
const naiConnection: FakeConnection = {
  id: "nai",
  model: "nai-diffusion-5-full",
  baseUrl: "https://image.novelai.net",
  imageService: "novelai",
};
const comfyConnection: FakeConnection = {
  id: "comfy",
  model: "aMixIllustrious_aMix.safetensors",
  baseUrl: "http://127.0.0.1:8188",
  imageService: "comfyui",
};
const fakeStore = (connections: FakeConnection[], defaultId: string | null) => ({
  getWithKey: async (id: string) => connections.find((entry) => entry.id === id) ?? null,
  getDefaultForImageGeneration: async () => connections.find((entry) => entry.id === defaultId) ?? null,
});
const illustratorAgent = (imageConnectionId: string | null) => ({ settings: { imageConnectionId } }) as never;

const viaAgentSetting = await resolveIllustratorCharacterPromptInstruction({
  connections: fakeStore([naiConnection, comfyConnection], "comfy") as never,
  illustratorAgent: illustratorAgent("nai"),
  chatMode: "roleplay",
  chatMetadata: {},
});
assert.match(viaAgentSetting.instruction, /characterPrompts/, "agent-level NovelAI connection enables captions");
assert.equal(viaAgentSetting.limit, 22);

const viaDefault = await resolveIllustratorCharacterPromptInstruction({
  connections: fakeStore([naiConnection, comfyConnection], "nai") as never,
  illustratorAgent: illustratorAgent(null),
  chatMode: "roleplay",
  chatMetadata: {},
});
assert.match(viaDefault.instruction, /characterPrompts/, "default image connection is honoured");

const chatOverride = await resolveIllustratorCharacterPromptInstruction({
  connections: fakeStore([naiConnection, comfyConnection], "nai") as never,
  illustratorAgent: illustratorAgent("nai"),
  chatMode: "roleplay",
  chatMetadata: { illustratorImageConnectionId: "comfy" },
});
assert.equal(chatOverride.instruction, "", "a chat pinned to ComfyUI gets no NovelAI instruction");
assert.equal(chatOverride.limit, 0);

console.log("illustrator character prompts regression passed");

// The manual Illustration button keeps the raw captions on its plan so dispatch can validate them.
{
  const { parseManualIllustratorPromptPlan } =
    await import("../../packages/server/src/services/generation/illustrator-manual-prompt-generation.js");
  const plan = parseManualIllustratorPromptPlan({
    prompt: "2girls, tavern",
    characters: ["Imogen McSweeney", "Vivianne"],
    characterPrompts: [{ name: "Vivianne", prompt: "girl, platinum hair" }],
  });
  assert.ok(plan);
  assert.equal(plan!.characterPrompts.length, 1, "manual plan keeps characterPrompts for dispatch-time validation");
  assert.equal(
    parseManualIllustratorPromptPlan({ prompt: "1girl" })!.characterPrompts.length,
    0,
    "missing characterPrompts parse as an empty list",
  );
}

// The agent executor only renders the block the host resolved; anything else stays silent.
{
  const { buildIllustratorCharacterPromptInstructionBlock } =
    await import("../../packages/server/src/services/agents/agent-executor.js");
  assert.equal(buildIllustratorCharacterPromptInstructionBlock(undefined), "");
  assert.equal(buildIllustratorCharacterPromptInstructionBlock(42), "");
  assert.equal(
    buildIllustratorCharacterPromptInstructionBlock(buildIllustratorCharacterPromptInstruction(22)),
    buildIllustratorCharacterPromptInstruction(22),
  );
}

console.log("illustrator character prompts regression (manual + executor) passed");

// Card appearance reaches the prompt writer as a reference block; the writer decides how to use it.
{
  const { buildCharacterAppearanceReferenceBlock, splitEnsembleAppearance } =
    await import("../../packages/server/src/services/image/character-prompts.js");
  const sourced = buildIllustratorCharacterPromptInstruction(22);
  assert.match(sourced, /verbatim/i, "Danbooru-tagged card appearance is to be copied verbatim");
  assert.match(sourced, /outfit/i, "clothing is sourced from the tracker outfit");

  const ensemble =
    "[MALI] petite, tan, black hair, thong | [DARCIE] 1girl, solo, toned, pale skin, blue hair |, [ZOE] short hair";
  const segments = splitEnsembleAppearance(ensemble);
  assert.deepEqual(
    segments?.map((entry) => entry.name),
    ["MALI", "DARCIE", "ZOE"],
    "bracket markers split the block, with or without a stray comma after the pipe",
  );
  assert.equal(segments?.[0]?.appearance, "petite, tan, black hair, thong");
  assert.equal(splitEnsembleAppearance("1girl, solo, red hair"), null, "single-character blocks are not split");

  const block = buildCharacterAppearanceReferenceBlock([
    { name: "Darcie and Mali", appearance: ensemble },
    { name: "Blake", appearance: "A tall man with black hair and green eyes." },
    { name: "Empty", appearance: "   " },
  ]);
  assert.match(block, /<character_appearance_reference>/);
  assert.match(block, /\[MALI\] petite, tan, black hair, thong/, "ensemble segments are listed per character");
  assert.match(block, /\[DARCIE\] 1girl, solo, toned, pale skin, blue hair/);
  assert.match(block, /\[ZOE\] short hair/, "every segment is offered; the writer picks who is visible");
  assert.match(block, /\[Blake\] A tall man with black hair and green eyes\./, "single cards keep their own name");
  assert.doesNotMatch(block, /\[Empty\]/, "blank appearance fields are skipped");
  assert.match(block, /verbatim/i, "fixed traits are to be copied verbatim into the caption");
  assert.match(block, /outfit|clothing/i, "clothing tags are a default the scene or tracker overrides");
  assert.equal(buildCharacterAppearanceReferenceBlock([]), "", "no appearance means no block");

  const oversized = buildCharacterAppearanceReferenceBlock(
    Array.from({ length: 40 }, (_, index) => ({ name: `Colonist ${index + 1}`, appearance: "x".repeat(400) })),
  );
  assert.ok(oversized.length < 9000, "the reference block is capped so a huge ensemble cannot flood the prompt");
}

// The executor composes the instruction and the appearance reference; both are host-resolved.
{
  const { buildIllustratorCharacterPromptInstructionBlock } =
    await import("../../packages/server/src/services/agents/agent-executor.js");
  const instruction = buildIllustratorCharacterPromptInstruction(22);
  const composed = buildIllustratorCharacterPromptInstructionBlock(
    instruction,
    "<character_appearance_reference>x</character_appearance_reference>",
  );
  assert.ok(composed.startsWith(instruction), "instruction comes first");
  assert.match(composed, /<character_appearance_reference>x<\/character_appearance_reference>$/);
  assert.equal(
    buildIllustratorCharacterPromptInstructionBlock(
      undefined,
      "<character_appearance_reference>x</character_appearance_reference>",
    ),
    "",
    "no caption instruction means no reference block either",
  );
}

console.log("illustrator character prompts regression (appearance reference) passed");
