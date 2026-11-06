// A greeting that uses a persona question's `{{name}}` is filled in from the
// player's persona answers when they create that persona from the card's template
// in the wizard. Pinned through the real shared helpers: the same answer context
// the persona uses, so conditions, option macros and follow-ups behave alike.
import assert from "node:assert/strict";
import {
  characterExtensionsSchema,
  findPersonaVariableUses,
  getGreetingVariableChipNames,
  greetingMentionsPersonaName,
  resolveOnboardingGreeting,
  shouldFillGreetingFromPersona,
  type CharacterOnboarding,
  type OnboardingAnswers,
} from "../../packages/shared/src/index.js";

function onboarding(input: Record<string, unknown>): CharacterOnboarding {
  const parsed = characterExtensionsSchema.parse({ onboarding: { enabled: true, ...input } }).onboarding;
  assert.ok(parsed);
  return parsed as CharacterOnboarding;
}
const option = (id: string, value: string, label = value) => ({ id, label, value });

// A greeting's chips offer both kinds of answer, split by who answers them.
{
  const both = onboarding({
    description: "A {{class}}.",
    variables: [
      { id: "class", variableName: "class", question: "Class?" },
      { id: "shared", variableName: "shared", question: "Shared?" },
    ],
    cardVariables: [
      { id: "bond", variableName: "bond", question: "Bond?" },
      { id: "shared2", variableName: "shared", question: "Shared?" },
    ],
  });
  const names = getGreetingVariableChipNames(both);
  assert.deepEqual(names.character, ["bond", "shared"], "character questions come first");
  assert.ok(names.persona.includes("class"), "persona questions are offered too");
  assert.ok(names.persona.includes("player"), "the built-in player name fills in like any persona question");
  assert.ok(
    !names.persona.includes("shared"),
    "a name in both lists is one chat variable and stays with the character",
  );

  const cardOnly = onboarding({ cardVariables: [{ id: "bond", variableName: "bond", question: "Bond?" }] });
  assert.deepEqual(
    getGreetingVariableChipNames(cardOnly),
    { character: ["bond"], persona: [] },
    "without a persona template nothing can fill a persona name, so none is offered",
  );
  assert.deepEqual(
    getGreetingVariableChipNames({ ...both, enabled: false }),
    { character: [], persona: [] },
    "the onboarding toggle being off offers no chips",
  );
}

// `class` is a choice; `customClass` is asked only for the `custom` option, whose
// value holds a macro; `pet` is never answered in these tests.
const template = onboarding({
  description: "A {{class}} named {{player}}.",
  variables: [
    {
      id: "class",
      variableName: "class",
      question: "Class?",
      options: [option("ranger", "Ranger"), option("custom", "{{customClass}}")],
    },
    { id: "customClass", variableName: "customClass", question: "Which?" },
    { id: "pet", variableName: "pet", question: "Pet?" },
  ],
  cardVariables: [
    {
      id: "rel",
      variableName: "relationshipToUser",
      question: "Who are you to her?",
      options: [option("friend", "friend"), option("rival", "rival")],
    },
  ],
});
const answers = (input: Record<string, { optionIds?: string[]; text?: string }>) => input as OnboardingAnswers;
const ranger = answers({ player: { text: "Ana" }, class: { optionIds: ["ranger"] } });
const fill = (greeting: string, given = ranger, character: Record<string, string> = {}) =>
  resolveOnboardingGreeting(template, given, greeting, character);

// A plain persona answer.
assert.equal(fill("Ah, so you are a {{class}}."), "Ah, so you are a Ranger.");

// A condition on a persona answer.
assert.equal(
  fill("{{#if class == Ranger}}Quiet steps.{{else}}Loud steps.{{/if}}"),
  "Quiet steps.",
  "a condition on a persona answer takes its branch",
);

// A macro inside an option value is resolved like the persona does.
assert.equal(
  fill(
    "A {{class}}!",
    answers({ player: { text: "Ana" }, class: { optionIds: ["custom"] }, customClass: { text: "Bard" } }),
  ),
  "A Bard!",
  "a macro inside the chosen option's value resolves",
);

// An unanswered follow-up goes blank instead of showing its tag.
assert.equal(fill("Pet: {{pet}}|{{class}}"), "Pet: |Ranger", "an unanswered question goes blank");

// {{user}} and {{char}} stay live.
assert.equal(
  fill("{{user}} meets {{char}}, a {{class}}."),
  "{{user}} meets {{char}}, a Ranger.",
  "{{user}} and {{char}} stay as tags",
);

// A condition on a CHARACTER answer takes the right branch, and that branch is kept.
const conditional = "{{class}}: {{#if relationshipToUser == friend}}Old friend!{{else}}Stranger.{{/if}}";
assert.equal(fill(conditional, ranger, { relationshipToUser: "friend" }), "Ranger: Old friend!");
assert.equal(fill(conditional, ranger, { relationshipToUser: "rival" }), "Ranger: Stranger.");
// A plain character tag next to a persona tag is filled in too (accepted).
assert.equal(
  fill("{{class}} and {{relationshipToUser}}", ranger, { relationshipToUser: "friend" }),
  "Ranger and friend",
);

// The caller's character answers are only read.
const given = { relationshipToUser: "friend" };
fill("{{class}}{{setvar::mood::grim}}", ranger, given);
assert.deepEqual(
  given,
  { relationshipToUser: "friend" },
  "a {{setvar}} in a greeting doesn't write into the caller's map",
);

// A mention: bare tag, or the left side of a condition.
assert.ok(greetingMentionsPersonaName(template, "Hi {{class}}"));
assert.ok(greetingMentionsPersonaName(template, "{{#if class == Ranger}}Hi{{/if}}"));
assert.ok(greetingMentionsPersonaName(template, "{{#if pet}}Hi{{/if}}"));
assert.deepEqual([...findPersonaVariableUses(template, ["{{class}}", "{{#if pet}}x{{/if}}"])].sort(), ["class", "pet"]);

// Not a mention: a name that only looks like one, a character question, plain prose.
assert.ok(!greetingMentionsPersonaName(template, "Hi {{classy}}"));
assert.ok(!greetingMentionsPersonaName(template, "Hi {{relationshipToUser}}"));
assert.ok(!greetingMentionsPersonaName(template, "A ranger class"));

// No persona name: returned untouched, byte for byte, whatever else it holds.
for (const plain of [
  "  Hello {{user}}, {{relationshipToUser}} {{#if relationshipToUser == friend}}x{{/if}} {{random::a,b}}\r\n ",
  "{{classy}}",
  "",
]) {
  assert.equal(
    fill(plain, ranger, { relationshipToUser: "friend" }),
    plain,
    "a greeting without a persona name is unchanged",
  );
}

// The wizard's decision: owner card, and the chat still on the created persona.
const created = { cardId: "card-1", personaId: "persona-1" };
assert.equal(shouldFillGreetingFromPersona(created, "card-1", "persona-1"), true);
assert.equal(shouldFillGreetingFromPersona(created, "card-2", "persona-1"), false, "another card's greeting stays raw");
assert.equal(shouldFillGreetingFromPersona(created, "card-1", "persona-2"), false, "another persona picked afterwards");
assert.equal(shouldFillGreetingFromPersona(created, "card-1", null), false, "no persona chosen");
assert.equal(
  shouldFillGreetingFromPersona(null, "card-1", "persona-1"),
  false,
  "no persona was created from a template",
);
