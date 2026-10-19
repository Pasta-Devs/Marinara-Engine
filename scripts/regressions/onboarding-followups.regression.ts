// Interactive onboarding follow-ups (#7795, #7797): the shared card parse, the
// rule for chat variables a character leaves behind, and the answers a reopened
// questions window starts on.
//
// `readCardOnboarding` is the one parse the server seeding/removal and both
// client surfaces use; `cardVariableNamesToDrop` is the ownership rule;
// `answersFromStoredValues` is what stops a save from rewriting answers nobody
// edited. Pinning the rules here, not by restating them at the call sites, is what
// makes the regression able to fail when the production behaviour changes.
import assert from "node:assert/strict";
import {
  answersFromStoredValues,
  cardVariableNamesToDrop,
  characterExtensionsSchema,
  getCardVariableNames,
  mergeCardVariables,
  readCardOnboarding,
  type CharacterOnboarding,
} from "../../packages/shared/src/index.js";

function onboarding(input: Record<string, unknown> = {}): CharacterOnboarding {
  const parsed = characterExtensionsSchema.parse({ onboarding: { enabled: true, ...input } }).onboarding;
  assert.ok(parsed);
  return parsed as CharacterOnboarding;
}
const question = (id: string, variableName: string) => ({ id, variableName, question: `${variableName}?` });

// ── readCardOnboarding: one parse, every card shape ──
const cardData = {
  name: "Raven",
  description: "She greets {{bond}}.",
  personality: "Loyal",
  scenario: "A guildhall at dusk.",
  extensions: {
    backstory: "Raised far from the guild.",
    appearance: "Tall, with a scar.",
    onboarding: {
      enabled: true,
      cardVariables: [question("bond", "bond"), question("rank", "rank")],
    },
  },
};
const fromObject = readCardOnboarding(cardData);
assert.ok(fromObject);
assert.equal(fromObject.name, "Raven");
// Top-level fields come from the card root; backstory/appearance live on
// `extensions`. Reading all five from one place silently drops two references.
assert.equal(fromObject.cardFields.description, "She greets {{bond}}.");
assert.equal(fromObject.cardFields.personality, "Loyal");
assert.equal(fromObject.cardFields.scenario, "A guildhall at dusk.");
assert.equal(fromObject.cardFields.backstory, "Raised far from the guild.");
assert.equal(fromObject.cardFields.appearance, "Tall, with a scar.");
assert.deepEqual(
  fromObject.onboarding.cardVariables.map((variable) => variable.variableName),
  ["bond", "rank"],
);

// The same data as the row's JSON string, because the storage layer stores text.
assert.deepEqual(readCardOnboarding(JSON.stringify(cardData)), fromObject);

// An enabled block is returned; `enabled` is the CALLER's gate (seeding and the
// player-facing paths check it, the removal's "stays in chat" side must see it).
const disabled = readCardOnboarding({
  extensions: { onboarding: { enabled: false, cardVariables: [question("bond", "bond")] } },
});
assert.equal(disabled?.onboarding.enabled, false);

// Repeated ids are made unique, exactly as the editor and the questions window
// expect: cards saved before that rule (or written via the API) still repeat one.
const repeated = readCardOnboarding({
  extensions: {
    onboarding: {
      enabled: true,
      cardVariables: [question("same", "bond"), question("same", "rank")],
    },
  },
});
assert.deepEqual(
  repeated?.onboarding.cardVariables.map((variable) => variable.id),
  ["same", "same_2"],
);

// Unreadable input is `null`, never a throw: the draw stores foreign data.
assert.equal(readCardOnboarding("not json"), null);
assert.equal(readCardOnboarding(null), null);
assert.equal(readCardOnboarding({ name: "No extensions" }), null);
assert.equal(readCardOnboarding({ extensions: { onboarding: { variables: "not an array" } } }), null);

// ── getCardVariableNames: storable declarations only ──
const mixed = onboarding({
  cardVariables: [
    question("a", "bond"),
    question("b", "bond"),
    question("c", "bad-name"),
    question("d", "char"),
    question("e", ""),
    question("f", "rank"),
  ],
});
assert.deepEqual(getCardVariableNames(mixed), ["bond", "rank"]);
// Blank, malformed and reserved names can never reach `macroVariables`, so they
// can never need removing either.
assert.deepEqual(getCardVariableNames(onboarding()), []);
assert.deepEqual(getCardVariableNames(null), []);
// Declarations are reported for a disabled block too; the drop rule gates it.
const switchedOff = onboarding({ enabled: false, cardVariables: [question("bond", "bond")] });
assert.deepEqual(getCardVariableNames(switchedOff), ["bond"]);

// ── cardVariableNamesToDrop: owned by the leaving card, not declared by a stayer ──
const bondAndRank = onboarding({ cardVariables: [question("bond", "bond"), question("rank", "rank")] });
const rankOnly = onboarding({ cardVariables: [question("rank", "rank")] });

// A shared name stays: the remaining card still declares it and reads it.
assert.deepEqual(cardVariableNamesToDrop([bondAndRank], [rankOnly]), ["bond"]);
// Leaving the card declared by nobody removes every name it owned.
assert.deepEqual(cardVariableNamesToDrop([bondAndRank], []), ["bond", "rank"]);
// A card whose onboarding is switched off owns nothing: nothing was seeded for it.
assert.deepEqual(cardVariableNamesToDrop([switchedOff], []), []);
// The stayer's block being switched off does NOT release the name: its card's
// fields can still read the variable, so deleting it is the worse outcome.
assert.deepEqual(cardVariableNamesToDrop([bondAndRank], [switchedOff]), ["rank"]);
// Two leaving cards declaring the same name drop it once.
assert.deepEqual(cardVariableNamesToDrop([bondAndRank, rankOnly], []), ["bond", "rank"]);
// Non-storable names never enter the rule.
const weird = onboarding({ cardVariables: [question("a", "bad-name"), question("b", "char")] });
assert.deepEqual(cardVariableNamesToDrop([weird], []), []);

// ── answersFromStoredValues: a reopened window starts on what the chat saved ──
// The marker in Chat Settings opens ONE card's questions on a chat that already
// holds answers. Starting every question on its first option meant saving one
// edited answer rewrote the rest with those defaults (#7797 review).
const rankOptions = [
  { id: "sc", label: "Scout", value: "scout" },
  { id: "rg", label: "Ranger", value: "" },
  { id: "kn", label: "Knight", value: "knight" },
];
const reanswerable = onboarding({
  cardVariables: [
    { ...question("rank", "rank"), options: rankOptions },
    question("bond", "bond"),
    { ...question("tags", "tags"), options: rankOptions, multiSelect: true, separator: ", " },
  ],
});
const declared = reanswerable.cardVariables ?? [];
const storedAnswers = { rank: "scout", bond: "an old friend", tags: "scout, knight" };
const seeded = answersFromStoredValues(declared, storedAnswers);
// A choice is stored by option VALUE, free text as typed, and a multi-select as
// the chosen values joined by its separator.
assert.deepEqual(seeded.rank, { optionIds: ["sc"] });
assert.deepEqual(seeded.bond, { text: "an old friend" });
assert.deepEqual(seeded.tags, { optionIds: ["sc", "kn"] });

// The property that matters: opening the window and saving without editing
// anything writes the chat's own answers back, unchanged.
assert.deepEqual(
  mergeCardVariables([{ onboarding: reanswerable, answers: seeded }], [new Set(getCardVariableNames(reanswerable))]),
  storedAnswers,
);

// A blank option value is stored as its LABEL, so the label has to match too.
assert.deepEqual(answersFromStoredValues(declared, { rank: "Ranger" }).rank, { optionIds: ["rg"] });

// A value the current options cannot express (the author edited the choices, or
// a macro expanded into it) is an empty choice: it renders unselected and writes
// nothing, so an untouched save keeps what the chat holds.
const unmatchable = answersFromStoredValues(declared, { rank: "admiral", tags: "scout, admiral" });
assert.deepEqual(unmatchable.rank, { optionIds: [] });
assert.deepEqual(unmatchable.tags, { optionIds: [] });
assert.deepEqual(
  mergeCardVariables([{ onboarding: reanswerable, answers: unmatchable }], [new Set(["rank", "tags"])]),
  {},
);

// A single choice that allows an own answer keeps it as typed text, which is
// where the window shows player-written answers.
const customRank = onboarding({
  cardVariables: [{ ...question("rank", "rank"), options: rankOptions, allowCustom: true }],
});
assert.deepEqual(answersFromStoredValues(customRank.cardVariables ?? [], { rank: "Admiral of the fleet" }).rank, {
  text: "Admiral of the fleet",
});

// Names the chat does not hold, blank values, and names this card does not
// declare are all left alone: only a real stored answer seeds a question.
assert.deepEqual(Object.keys(answersFromStoredValues(declared, {})), []);
assert.deepEqual(Object.keys(answersFromStoredValues(declared, { rank: "   " })), []);
assert.deepEqual(Object.keys(answersFromStoredValues(declared, { unrelated: "x" })), []);

// A multi-select with an EMPTY separator joined its values with nothing between
// them, so they cannot be split apart again; treat it as unmatchable rather than
// guess where one value ends.
const noSeparator = onboarding({
  cardVariables: [{ ...question("tags", "tags"), options: rankOptions, multiSelect: true, separator: "" }],
});
assert.deepEqual(answersFromStoredValues(noSeparator.cardVariables ?? [], { tags: "scoutknight" }).tags, {
  optionIds: [],
});

// A question legitimately named `__proto__` stays an own key instead of touching
// the prototype of the map the window then edits.
const protoAnswers = answersFromStoredValues(
  onboarding({ cardVariables: [question("p", "__proto__")] }).cardVariables ?? [],
  JSON.parse('{"__proto__":"kept"}') as Record<string, string>,
);
assert.deepEqual(Object.keys(protoAnswers), ["__proto__"]);
assert.deepEqual(protoAnswers["__proto__"], { text: "kept" });
