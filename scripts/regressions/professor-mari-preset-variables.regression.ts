// #5080 regression: Professor Mari's preset authoring guidance must make preset variables actually
// work. A choice block (`{ variableName, question, options }`) only affects the assembled prompt
// where a section's content references it with the `{{variableName}}` macro; if Mari defines a
// variable and never references it, the user sees a picker in the preset UI that changes nothing.
//
// Pins two things in the workspace command-protocol prompt:
//   1) the guidance names the `{{variableName}}` macro and states the variable is inert until a
//      section references it, and
//   2) every `preset.create` worked example that defines choiceBlocks references each variable as
//      `{{variableName}}` in at least one section's content — i.e. the example follows the rule it
//      teaches (the old `tone` example defined `{{tone}}` but its section was a bare
//      `"You are {{char}}."`, demonstrating the anti-pattern this issue fixes).
import assert from "node:assert/strict";
import { workspaceCommandProtocolPrompt } from "../../packages/server/src/services/professor-mari/workspace-agent.service.js";

const prompt = workspaceCommandProtocolPrompt();

// 1) Guidance names the macro and the "inert until referenced" rule.
assert.ok(prompt.includes("{{variableName}}"), "guidance must name the {{variableName}} macro so Mari references her variables");
assert.ok(
  /does nothing on its own|only takes effect|changes nothing/i.test(prompt),
  "guidance must state a choice block is inert until a section references it",
);

// 2) Every preset.create worked example that defines choiceBlocks must reference each variable in a
//    section. Examples are one JSON object per line inside the prompt.
type ExampleCommand = { name?: string; arguments?: { action?: string; data?: { sections?: Array<{ content?: string }>; choiceBlocks?: Array<{ variableName?: string }> } } };
type Example = { commands?: ExampleCommand[] };

const presetCreateExamples = prompt
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.startsWith("{") && line.includes('"preset.create"'))
  .map((line) => JSON.parse(line) as Example);

assert.ok(presetCreateExamples.length > 0, "there is at least one preset.create worked example to check");

let checkedBlocks = 0;
for (const example of presetCreateExamples) {
  for (const command of example.commands ?? []) {
    if (command.arguments?.action !== "preset.create") continue;
    const sections = command.arguments.data?.sections ?? [];
    const choiceBlocks = command.arguments.data?.choiceBlocks ?? [];
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
}

assert.ok(checkedBlocks > 0, "the preset.create example must define at least one choice block for this to be meaningful");

console.log("professor-mari preset-variable guidance regression passed");
