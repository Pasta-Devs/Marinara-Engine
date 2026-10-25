// #5080 regression: Professor Mari's preset authoring guidance must make preset variables actually
// work. A choice block only affects the assembled prompt where a section's content references it with
// the `{{variableName}}` macro; if Mari defines a variable and never references it, the user sees a
// picker in the preset UI that changes nothing.
//
// Since #7827 the guidance lives in the shipped `builtin-presets` skill instead of the permanent
// prompt, so the same rule checks the skill: it must name the macro and say the block is inert on its
// own, and its `preset.create` example must reference every variable it defines.
import assert from "node:assert/strict";
import { loadBuiltinSkills } from "../../packages/server/src/services/professor-mari/builtin-skills.js";

const { skills } = await loadBuiltinSkills();
const skill = skills.find((entry) => entry.id === "builtin-presets");
assert.ok(skill, "the presets handbook ships with the app");
const guidance = skill.content;

assert.ok(
  guidance.includes("{{variableName}}"),
  "guidance must name the {{variableName}} macro so Mari references her variables",
);
assert.ok(
  /does nothing on its own|only takes effect|changes nothing/i.test(guidance),
  "guidance must state a choice block is inert until a section references it",
);

type ExampleCommand = {
  action?: string;
  data?: { sections?: Array<{ content?: string }>; choiceBlocks?: Array<{ variableName?: string }> };
};

const presetCreateExamples = guidance
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.startsWith("{") && line.includes('"preset.create"'))
  .map((line) => JSON.parse(line) as ExampleCommand);

assert.ok(presetCreateExamples.length > 0, "there is at least one preset.create worked example to check");

let checkedBlocks = 0;
for (const command of presetCreateExamples) {
  if (command.action !== "preset.create") continue;
  const sections = command.data?.sections ?? [];
  const choiceBlocks = command.data?.choiceBlocks ?? [];
  const allSectionContent = sections.map((section) => section.content ?? "").join("\n");
  for (const block of choiceBlocks) {
    const macro = `{{${block.variableName}}}`;
    assert.ok(
      allSectionContent.includes(macro),
      `preset.create example defines choice block '${block.variableName}' but no section references ${macro} — the variable would do nothing`,
    );
    checkedBlocks += 1;
  }
}

assert.ok(
  checkedBlocks > 0,
  "the preset.create example must define at least one choice block for this to be meaningful",
);

console.log("professor-mari preset-variable guidance regression passed");
