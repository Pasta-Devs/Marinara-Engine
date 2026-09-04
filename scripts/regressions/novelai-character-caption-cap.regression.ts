// Guards the NovelAI request builder's caption cap: V5 carries up to 22 character captions,
// V4/V4.5 still stop at six. Kept separate from the Illustrator regression so neither file
// loads both the image-generation and agent-executor module graphs at once.
import assert from "node:assert/strict";
import { buildNovelAiV4CharacterPromptPayload } from "../../packages/server/src/services/image/image-generation.js";

const crowd = Array.from({ length: 10 }, (_, index) => `Colonist ${index + 1}`);
const crowdPrompts = crowd.map((name) => ({ name, prompt: `girl, ${name}` }));

// The NovelAI request builder honours the V5 cap instead of the old fixed six.
const sevenCaptions = crowdPrompts.slice(0, 7).map((entry, index) => ({
  ...entry,
  position: { x: (index + 1) / 8, y: 0.5 },
}));
assert.equal(
  buildNovelAiV4CharacterPromptPayload(sevenCaptions, "nai-diffusion-5-full").captions.length,
  7,
  "V5 payload carries all seven captions",
);
assert.equal(
  buildNovelAiV4CharacterPromptPayload(sevenCaptions, "nai-diffusion-4-5-full").captions.length,
  6,
  "V4.5 payload still stops at six",
);

console.log("NovelAI character caption cap regression passed");
