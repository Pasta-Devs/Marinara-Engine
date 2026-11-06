import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const directory = mkdtempSync(join(tmpdir(), "marinara-illustrator-output-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
const { parseIllustratorBackgroundPlan } =
  await import("../../packages/server/src/services/generation/illustrator-background-generation.js");
const { parseManualIllustratorPromptPlan } =
  await import("../../packages/server/src/services/generation/illustrator-manual-prompt-generation.js");

try {
  const background = "Courtyard architectural detail. ".repeat(250) + "FINAL_BACKGROUND_DETAIL";
  const prompt = "Comic panel composition detail. ".repeat(300) + "FINAL_IMAGE_DETAIL";
  const negative = "Exclude misplaced visual detail. ".repeat(250) + "FINAL_NEGATIVE_DETAIL";
  const style = "Painterly lighting and material direction. ".repeat(40) + "FINAL_STYLE_DETAIL";
  await test("background plans preserve the complete long generated image prompt", () => {
    const record = { locationName: "courtyard", prompt: `  ${background}  ` };
    for (const input of [record, `\`\`\`json\n${JSON.stringify(record)}\n\`\`\``]) {
      assert.equal(parseIllustratorBackgroundPlan(input)?.prompt, background);
    }
    assert.equal(parseIllustratorBackgroundPlan({ name: "courtyard", description: background })?.prompt, background);
  });
  await test("manual plans preserve the complete long generated image prompt", () => {
    const record = { prompt: `  ${prompt}  `, negativePrompt: "omit watermarks" };
    for (const input of [record, JSON.stringify(record)]) {
      assert.equal(parseManualIllustratorPromptPlan(input)?.prompt, prompt);
    }
    assert.equal(parseManualIllustratorPromptPlan({ imagePrompt: prompt })?.prompt, prompt);
  });
  await test("manual plans preserve the complete long generated negative prompt", () => {
    const record = { prompt: "A courtyard.", negativePrompt: `  ${negative}  ` };
    for (const input of [record, JSON.stringify(record)]) {
      assert.equal(parseManualIllustratorPromptPlan(input)?.negativePrompt, negative);
    }
    assert.equal(
      parseManualIllustratorPromptPlan({ prompt: "A courtyard.", negative_prompt: negative })?.negativePrompt,
      negative,
    );
  });
  await test("manual plans preserve the complete generated style that becomes provider-facing prompt text", () => {
    const record = { prompt: "A courtyard.", style: `  ${style}  ` };
    for (const input of [record, JSON.stringify(record)]) {
      assert.equal(parseManualIllustratorPromptPlan(input)?.style, style);
    }
    assert.equal(parseManualIllustratorPromptPlan({ prompt: "A courtyard.", artStyle: style })?.style, style);
  });
  await test("background plans still reject malformed, missing and empty required fields", () => {
    for (const input of [
      null,
      [],
      "not JSON",
      '{"locationName":"courtyard","prompt":',
      "I cannot provide an illustration.",
      { locationName: "courtyard", prompt: "   " },
      { locationName: "", prompt: "A courtyard." },
      { locationName: "courtyard", prompt: { text: "not a string" } },
    ]) {
      assert.equal(parseIllustratorBackgroundPlan(input), null);
    }
  });
  await test("manual plans still reject malformed or empty prompts and normalize invalid optional negatives", () => {
    for (const input of [
      null,
      [],
      "not JSON",
      '{"prompt":',
      "I cannot provide an illustration.",
      { prompt: "   " },
      { prompt: 42 },
    ]) {
      assert.equal(parseManualIllustratorPromptPlan(input), null);
    }
    assert.equal(parseManualIllustratorPromptPlan({ prompt: "A courtyard.", negativePrompt: {} })?.negativePrompt, "");
  });
} finally {
  rmSync(directory, { recursive: true, force: true });
}
