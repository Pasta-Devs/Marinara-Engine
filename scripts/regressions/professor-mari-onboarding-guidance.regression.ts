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
import { ONBOARDING_MAX_QUESTIONS } from "../../packages/shared/src/utils/onboarding.js";

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

type Command = {
  action?: string;
  patch?: Record<string, unknown>;
  onboarding?: unknown;
};
// The example is protocol-neutral: one app_data argument object per line, in response order.
const commands = body
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.startsWith('{"action"'))
  .map((line) => JSON.parse(line) as Command);

const write = commands.find((command) => command.action === "character.onboarding.update");
assert.ok(write, "there is a character.onboarding.update worked example");
const cardEdit = commands.find((command) => command.action === "character.update");
assert.ok(cardEdit, "the example also writes the character question's {{name}} into the card");
assert.ok(
  commands.indexOf(cardEdit) < commands.indexOf(write),
  "the card edit comes first, so the onboarding check already sees the {{name}}",
);

const { onboarding, warnings } = buildOnboardingUpdate({ name: "Queen Ayrene", ...cardEdit.patch }, write.onboarding);
assert.equal(onboarding.enabled, true, "the example turns onboarding on");
assert.ok(onboarding.cardVariables.length > 0, "the example shows a character question");
assert.deepEqual(warnings, [], "every question in the example is used");

// A JSON string cut by an unescaped quote arrives as garbage keys; name that failure, not just the keys.
assert.throws(
  () => buildOnboardingUpdate({ name: "Fenris" }, { '}}",backstory': "x" } as never),
  /cut by an unescaped ".*resend each value as one plain JSON string/u,
);

// The errors table quotes the server's own wording, which lives in `describeIssue` and the
// `buildOnboardingUpdate` gates. Nothing else pins it: a reworded message would leave the handbook
// plausible and wrong. Every fragment below must still be produced by the real gate AND still be
// quoted by the skill.
function refusal(patch: unknown): string {
  try {
    buildOnboardingUpdate({ name: "Regression" }, patch);
    return "";
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
function assertQuoted(fragment: string, patch: unknown) {
  const message = refusal(patch);
  assert.ok(
    message.includes(fragment),
    `the server still refuses with "${fragment}" (got: ${message.split("\n")[0] ?? ""})`,
  );
  assert.ok(body.includes(fragment), `the handbook still quotes "${fragment}"`);
}

assertQuoted("doesn't match the shape", { enabled: "true" });
assertQuoted("needs an onboarding object", null);
assertQuoted("Unknown onboarding key(s):", { bogus: 1 });
assertQuoted("has unknown key(s):", { variables: [{ variableName: "a", question: "Q", bogus: 1 }] });
assertQuoted("A question has no variableName", { variables: [{ question: "Q" }] });
assertQuoted("is not a valid variableName", { variables: [{ variableName: "x y", question: "Q" }] });
assertQuoted("is a built-in macro name", { variables: [{ variableName: "random", question: "Q" }] });
assertQuoted("More than one question is named", {
  variables: [
    { variableName: "a", question: "Q" },
    { variableName: "a", question: "Q2" },
  ],
});
assertQuoted("An option value uses", {
  description: "{{a}}",
  variables: [{ variableName: "a", question: "Q", options: [{ label: "L", value: "{{nope}}" }] }],
});
assertQuoted("field has {{if", {
  description: "{{if a == b}}x{{/if}}",
  variables: [{ variableName: "a", question: "Q" }],
});
assertQuoted("but no question has that name", { description: "{{nope}}" });
assertQuoted("has more than 100 questions", {
  variables: Array.from({ length: ONBOARDING_MAX_QUESTIONS + 1 }, (_, index) => ({
    variableName: `q${index}`,
    question: "?",
  })),
});

// The two warnings do not block a save, so they are returned rather than thrown; the handbook has to
// quote them just as literally, because describing a warning wrongly reads as a refusal.
const unusedWarnings = (
  buildOnboardingUpdate({ name: "Regression" }, { variables: [{ variableName: "a", question: "Q" }] }) as {
    warnings: string[];
  }
).warnings;
assert.ok(
  unusedWarnings.some((warning) => warning.includes("isn't used in any of the five template fields")),
  "the server still warns about an unused persona question",
);
assert.ok(body.includes("isn't used in any of the five template fields"), "the handbook quotes that warning");
// Taken from the server's own warning, so a reworded warning fails here instead of drifting.
const cardWarning = (
  buildOnboardingUpdate({ name: "Regression" }, { cardVariables: [{ variableName: "c", question: "Q" }] }) as {
    warnings: string[];
  }
).warnings.find((warning) => warning.startsWith('Character question "c"'));
assert.ok(cardWarning, "the server still warns about an unused character question");
const cardWarningText = cardWarning.slice(
  cardWarning.indexOf("isn't used"),
  cardWarning.indexOf("so it is skipped") + 16,
);
// The handbook wraps long lines, so compare with whitespace collapsed.
assert.ok(
  body.replace(/\s+/gu, " ").includes(cardWarningText),
  "the handbook quotes the unused character-question warning",
);

// The cap the handbook quotes is the code's cap, not a number that drifted.
assert.ok(body.includes(`at most ${ONBOARDING_MAX_QUESTIONS} questions`), "the handbook quotes the real per-list cap");

console.log("professor-mari onboarding guidance regression passed");
