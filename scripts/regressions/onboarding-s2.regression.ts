// Interactive onboarding ("skeleton persona") — slice 2: the pure resolver.
//
// Which questions are asked is decided by the macro engine itself: a question
// is relevant when resolving the five persona fields with the answers so far
// actually reads its variable, in reachable text or in an evaluated {{#if}}.
// This pins that behaviour plus the resolved persona and the author validator.
import assert from "node:assert/strict";
import {
  characterExtensionsSchema,
  getNextOnboardingVariable,
  getRelevantOnboardingVariables,
  resolveOnboardingPersona,
  resolveOnboardingQuestion,
  validateOnboarding,
  type CharacterOnboarding,
  type OnboardingAnswers,
} from "../../packages/shared/src/index.js";

function onboarding(input: Record<string, unknown>): CharacterOnboarding {
  const parsed = characterExtensionsSchema.parse({ onboarding: { enabled: true, ...input } }).onboarding;
  assert.ok(parsed);
  return parsed as CharacterOnboarding;
}
const option = (id: string, value: string, label = value) => ({ id, label, value });

const card = onboarding({
  description:
    "{{player}} serves the {{faction}}. {{#if class == custom}}A {{customClass}}.{{else}}A {{class}}.{{/if}} Friend of {{char}}, known as {{user}}.",
  personality: "{{#if knowsHer == yes}}Knows Anastasia from childhood.{{/if}}",
  appearance: "{{looks}}",
  scenario: "You arrive at the guildhall at dusk.",
  variables: [
    {
      id: "faction",
      variableName: "faction",
      question: "Which faction?",
      options: [option("crown", "Crown"), option("guild", "Guild of {{guildCity}}", "Guild")],
    },
    {
      id: "class",
      variableName: "class",
      question: "Your class?",
      options: [option("ranger", "ranger"), option("other", "custom", "Something else")],
    },
    { id: "customClass", variableName: "customClass", question: "Describe your class" },
    {
      id: "knowsHer",
      variableName: "knowsHer",
      question: "Do you know her?",
      options: [option("y", "yes"), option("n", "no")],
    },
    { id: "looks", variableName: "looks", question: "How do you look?" },
    { id: "guildCity", variableName: "guildCity", question: "Which city's guild?" },
    { id: "unused", variableName: "unused", question: "Never referenced" },
  ],
});
const relevant = (answers: OnboardingAnswers) =>
  getRelevantOnboardingVariables(card, answers).map((variable) => variable.variableName);

// ── Which questions are relevant ──
assert.deepEqual(
  relevant({}),
  ["player", "faction", "class", "knowsHer", "looks"],
  "fresh: the name first, then every variable the fields reach — including knowsHer, used only in a condition",
);
assert.equal(
  getNextOnboardingVariable(card, {})?.variableName,
  "player",
  "a card without a player variable asks the name first",
);
assert.equal(
  getNextOnboardingVariable(card, {})?.question,
  "",
  "the synthetic name question leaves its wording to the UI",
);

assert.deepEqual(
  relevant({ class: { optionIds: ["other"] } }),
  ["player", "faction", "class", "customClass", "knowsHer", "looks"],
  "choosing the 'custom' option opens the customClass sub-question",
);
assert.equal(
  relevant({ class: { optionIds: ["ranger"] } }).includes("customClass"),
  false,
  "other classes keep it closed",
);

assert.equal(
  relevant({}).includes("guildCity"),
  false,
  "a variable used only inside an option value waits for that option",
);
assert.equal(
  relevant({ faction: { optionIds: ["guild"] } }).includes("guildCity"),
  true,
  "choosing an option whose value uses a variable makes that variable relevant",
);
assert.equal(relevant({}).includes("unused"), false, "a variable no field uses is never asked");

const allAnswers: OnboardingAnswers = {
  player: { text: " Kestrel " },
  faction: { optionIds: ["guild"] },
  guildCity: { text: "Vael" },
  class: { optionIds: ["other"] },
  customClass: { text: "battlemage" },
  knowsHer: { optionIds: ["y"] },
  looks: { text: "Tall, soot-marked coat." },
};
assert.equal(
  getNextOnboardingVariable(card, allAnswers),
  null,
  "nothing is left to ask once every relevant question is answered",
);
assert.equal(
  getNextOnboardingVariable(card, { ...allAnswers, looks: { text: "   " } })?.variableName,
  "looks",
  "a blank free-text answer does not count as answered",
);

// ── The resolved persona ──
assert.deepEqual(
  resolveOnboardingPersona(card, allAnswers),
  {
    name: "Kestrel",
    description: "Kestrel serves the Guild of Vael. A battlemage. Friend of {{char}}, known as {{user}}.",
    personality: "Knows Anastasia from childhood.",
    backstory: "",
    appearance: "Tall, soot-marked coat.",
    scenario: "You arrive at the guildhall at dusk.",
  },
  "answers fill the fields; option values resolve their own variables; {{char}}/{{user}} stay live",
);

const partial = resolveOnboardingPersona(card, { player: { text: "Kestrel" } });
assert.equal(partial.description, "Kestrel serves the . A . Friend of {{char}}, known as {{user}}.");
assert.equal(partial.appearance, "", "an unanswered variable is blanked, never left as a raw {{looks}}");

assert.equal(
  resolveOnboardingPersona(card, { ...allAnswers, looks: { text: "Wears {{char}}'s ring" } }).appearance,
  "Wears {{char}}'s ring",
  "the player's own text is inserted as written",
);

const multi = onboarding({
  description: "Skills: {{skills}}.",
  variables: [
    {
      id: "skills",
      variableName: "skills",
      multiSelect: true,
      separator: " / ",
      options: [option("a", "archery"), option("b", "stealth"), option("c", "cooking")],
    },
  ],
});
assert.equal(
  resolveOnboardingPersona(multi, { skills: { optionIds: ["a", "c"] } }).description,
  "Skills: archery / cooking.",
  "multi-select joins the chosen values with the separator in card order",
);

const blankValue = onboarding({
  description: "Gender: {{gender}}.",
  variables: [{ id: "g", variableName: "gender", options: [option("m", "", "Male"), option("f", "  ", "Female")] }],
});
assert.equal(
  resolveOnboardingPersona(blankValue, { gender: { optionIds: ["m"] } }).description,
  "Gender: Male.",
  "a blank option value falls back to the option label",
);
assert.equal(
  resolveOnboardingPersona(blankValue, { gender: { optionIds: ["f"] } }).description,
  "Gender: Female.",
  "a whitespace-only value counts as blank too",
);

// Questions shown to the player resolve the answers so far.
assert.equal(
  resolveOnboardingQuestion(blankValue, { player: { text: "Mari" } }, "What does {{player}} look like?", "Ana"),
  "What does Mari look like?",
  "a question can use an earlier answer",
);
assert.equal(
  resolveOnboardingQuestion(blankValue, {}, "Have you met {{char}}, {{user}}? ({{gender}})", "Ana"),
  "Have you met Ana, …? (…)",
  "{{char}} is the card's name; unanswered names and {{user}} show as …",
);

const withPlayer = onboarding({
  description: "{{player}} of the north.",
  variables: [
    { id: "p", variableName: "player", question: "Pick a name", options: [option("1", "Ash")], allowCustom: true },
  ],
});
assert.deepEqual(
  getRelevantOnboardingVariables(withPlayer, {}).map((variable) => variable.id),
  ["p"],
  "an author's own player variable replaces the built-in name question",
);
assert.equal(resolveOnboardingPersona(withPlayer, { player: { text: "Rowan" } }).name, "Rowan");
assert.equal(
  resolveOnboardingPersona(withPlayer, { player: { optionIds: ["1"] } }).name,
  "Ash",
  "a name picked from the author's options becomes the persona name too",
);

// ── Author validator ──
const issues = validateOnboarding(
  onboarding({
    description: "{{class}} {{appearance}} {{dupe}} {{if class == mage}}x{{/if}}",
    personality: "{{If knows}}",
    variables: [
      { id: "1", variableName: "class" },
      { id: "2", variableName: "" },
      { id: "3", variableName: "has space" },
      { id: "4", variableName: "appearance" },
      { id: "5", variableName: "dupe" },
      { id: "6", variableName: "dupe" },
      { id: "7", variableName: "lonely" },
      { id: "8", variableName: "player" },
    ],
  }),
);
assert.deepEqual(
  issues,
  [
    { code: "emptyName", variableId: "2", name: "" },
    { code: "invalidName", variableId: "3", name: "has space" },
    { code: "reservedName", variableId: "4", name: "appearance" },
    { code: "duplicateName", variableId: "6", name: "dupe" },
    { code: "unused", variableId: "7", name: "lonely" },
    { code: "plainIf", field: "description" },
    { code: "plainIf", field: "personality" },
  ],
  "validator flags empty, invalid, reserved, duplicate and unused names, and {{if}} without #",
);

// A name in the fields that is neither a question nor a macro reaches the
// persona verbatim (or, in a condition, silently compares false) — the typo case.
assert.deepEqual(
  validateOnboarding(
    onboarding({
      description: "{{player}} of the {{facton}}, friend of {{char}}. {{class}} {{facton}}",
      personality: "{{#if knowsHr == yes}}Knows her.{{else if class == mage}}A mage.{{/if}}",
      variables: [
        { id: "1", variableName: "faction" },
        { id: "2", variableName: "class" },
      ],
    }),
  ),
  [
    { code: "unused", variableId: "1", name: "faction" },
    { code: "unknownName", field: "description", name: "facton" },
    { code: "unknownName", field: "personality", name: "knowsHr" },
  ],
  "a misspelled name in text or in a condition is flagged once per field; questions, player and macros are not",
);

// "Used" means a real macro reference: a word in prose doesn't count, but a
// follow-up read from another question's option value does.
assert.deepEqual(
  validateOnboarding(
    onboarding({
      description: "A first class ticket. {{kind}}",
      variables: [
        { id: "1", variableName: "class" },
        { id: "2", variableName: "kind", options: [option("o", "{{customKind}}", "Other")] },
        { id: "3", variableName: "customKind" },
      ],
    }),
  ),
  [{ code: "unused", variableId: "1", name: "class" }],
  "prose words don't mark a question as used; option-value references do",
);

// Card text is untrusted: the condition scan must stay linear (CodeQL
// js/polynomial-redos reported "{{{{#if\t" followed by many tabs).
const hostile = "{{{{#if\t" + "\t".repeat(50_000);
const started = performance.now();
validateOnboarding(onboarding({ description: hostile, variables: [] }));
assert.ok(performance.now() - started < 2000, "the condition scan must not backtrack on long whitespace runs");
assert.deepEqual(
  validateOnboarding(onboarding({ description: "{{#if   knowsHr == yes}}x{{/if}}", variables: [] })),
  [{ code: "unknownName", field: "description", name: "knowsHr" }],
  "conditions with extra spaces after #if are still read",
);

console.log("onboarding-s2: all assertions passed");
