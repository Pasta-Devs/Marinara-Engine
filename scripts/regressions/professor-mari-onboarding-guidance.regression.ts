// #7760: Professor Mari's prompt must teach `character.onboarding.get|update`, and its worked
// example must follow the rules it teaches. The example's block goes through the real server gate
// (`buildOnboardingUpdate`) against the card text its own `character.update` writes: it must save
// with no errors AND no "unused question" warnings, or Mari would learn a broken pattern.
import assert from "node:assert/strict";
import { buildOnboardingUpdate } from "../../packages/server/src/services/mari-db/character-onboarding.js";
import { workspaceCommandProtocolPrompt } from "../../packages/server/src/services/professor-mari/workspace-agent.service.js";

const prompt = workspaceCommandProtocolPrompt();

assert.ok(prompt.includes("character.onboarding.get"), "the prompt names character.onboarding.get");
assert.ok(prompt.includes("character.onboarding.update"), "the prompt names character.onboarding.update");
assert.ok(prompt.includes("{{#if name == value}}"), "the prompt teaches the #if condition syntax");

type Command = {
  name?: string;
  arguments?: { action?: string; patch?: Record<string, unknown>; onboarding?: unknown };
};
const commands = prompt
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.startsWith("{") && line.includes('"character.onboarding.update"'))
  .flatMap((line) => (JSON.parse(line) as { commands?: Command[] }).commands ?? []);

const write = commands.find((command) => command.arguments?.action === "character.onboarding.update");
assert.ok(write, "there is a character.onboarding.update worked example");
const cardEdit = commands.find((command) => command.arguments?.action === "character.update");
assert.ok(cardEdit, "the example also writes the character question's {{name}} into the card");
assert.ok(
  commands.indexOf(cardEdit) < commands.indexOf(write),
  "the card edit comes first, so the onboarding check already sees the {{name}}",
);

const { onboarding, warnings } = buildOnboardingUpdate(
  { name: "Queen Ayrene", ...cardEdit.arguments?.patch },
  write.arguments?.onboarding,
);
assert.equal(onboarding.enabled, true, "the example turns onboarding on");
assert.ok(onboarding.cardVariables.length > 0, "the example shows a character question");
assert.deepEqual(warnings, [], "every question in the example is used");

console.log("professor-mari onboarding guidance regression passed");
