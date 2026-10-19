// #7760: Professor Mari's prompt must teach `character.onboarding.get|update`, and its worked
// example must follow the rules it teaches. Since #7827 the example lives in the shipped
// `builtin-onboarding` skill instead of the permanent prompt, so the same gate checks the skill:
// the example's block is run through the real server gate (`buildOnboardingUpdate`) against the
// card text its own `character.update` writes. It must save with no errors AND no "unused
// question" warnings, or Mari would learn a broken pattern from the skill she is told to follow.
import assert from "node:assert/strict";
import { buildOnboardingUpdate } from "../../packages/server/src/services/mari-db/character-onboarding.js";
import { loadBuiltinSkills } from "../../packages/server/src/services/professor-mari/builtin-skills.js";
import { workspaceCommandProtocolPrompt } from "../../packages/server/src/services/professor-mari/workspace-agent.service.js";

const prompt = workspaceCommandProtocolPrompt();

assert.ok(prompt.includes("character.onboarding.get"), "the prompt names character.onboarding.get");
assert.ok(prompt.includes("character.onboarding.update"), "the prompt names character.onboarding.update");
assert.ok(
  prompt.includes("builtin-onboarding"),
  "the prompt routes to the shipped skill instead of restating the whole procedure",
);

const { skills } = await loadBuiltinSkills();
const skill = skills.find((entry) => entry.id === "builtin-onboarding");
assert.ok(skill, "the shipped onboarding skill loads from the app's assets");
const body = skill.content;

assert.match(body, /\{\{#if name == value\}\}/, "the skill teaches the #if condition syntax");
assert.ok(body.includes("character.update"), "the skill says a character question's {{name}} goes into the card");
assert.ok(body.includes("docs/characters/interactive-onboarding.md"), "the skill points at the user doc");

type Command = {
  name?: string;
  arguments?: { action?: string; patch?: Record<string, unknown>; onboarding?: unknown };
};
const commands = body
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
