import { readFileSync } from "node:fs";

const mode = process.argv[2] ?? "after";
const apiSource = readFileSync("src/features/modes/game/api/game-api.ts", "utf8");
let promptSource = "";
try {
  promptSource = readFileSync("src/features/modes/game/api/game-asset-prompts.ts", "utf8");
} catch {
  promptSource = "";
}
const source = `${apiSource}\n${promptSource}`;

const checks = {
  forwardsNegativePrompt:
    /gameImageGenerationRequest\(imageConnectionId,\s*item\)/.test(apiSource) &&
    /negativePrompt:\s*item\.negativePrompt/.test(promptSource),
  hasPortraitNegativePrompt: /GAME_PORTRAIT_NEGATIVE_PROMPT/.test(source),
  hasBackgroundNegativePrompt: /GAME_BACKGROUND_NEGATIVE_PROMPT/.test(source),
  hasIllustrationNegativePrompt: /GAME_ILLUSTRATION_NEGATIVE_PROMPT/.test(source),
  hasNonHumanSpeciesRule: source.includes("Preserve that exact species, body plan, age category, and silhouette"),
  hasHumanDefaultRule: source.includes("Do not infer an animal species from the name, mood, speech verbs, or setting"),
};

const fixed = Object.values(checks).every(Boolean);
const expectedFixed = mode === "after";
const passed = expectedFixed ? fixed : !fixed;
const output = {
  mode,
  expectedFixed,
  passed,
  checks,
};

console.log(JSON.stringify(output, null, 2));

if (!passed) process.exit(1);
