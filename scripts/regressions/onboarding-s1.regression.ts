// Interactive onboarding ("skeleton persona") — slice 1.
//
// The card carries an `extensions.onboarding` block describing a persona the
// player fills in when a chat starts. Nothing reads it yet; this file pins the
// parts that are easy to get silently wrong:
//
//   1. The block survives a card round-trip (parse -> store shape -> re-parse).
//   2. A card without it is unchanged, so existing cards are untouched.
//   3. Variables keep the preset-variable shape (minus randomPick) and stay
//      lenient, so an unfinished variable never blocks a card import.
//   4. Export policy: Marinara Native and the Compatible PNG keep it (so an
//      author's card still onboards when someone else imports it); the
//      Compatible JSON export drops it and stays a clean V2 card.
import assert from "node:assert/strict";
import {
  characterCardV2Schema,
  characterDataSchema,
  characterExtensionsSchema,
} from "../../packages/shared/src/index.js";
import { buildCompatibleCharacterExport } from "../../packages/server/src/routes/characters.routes.js";

const VARIABLE_DEFAULTS = {
  allowCustom: false,
  multiSelect: false,
  separator: ", ",
  displayMode: "auto",
  optionSort: "manual",
} as const;

// Fully specified (defaults included) so a parse must return it unchanged.
const ONBOARDING = {
  enabled: true,
  description: "{{player}} serves the {{faction}}.",
  personality: "Quietly stubborn.",
  backstory: "{{#if class == custom}}{{customClass}}{{else}}A {{class}}.{{/if}}",
  appearance: "{{looks}}",
  scenario: "You arrive at the guildhall at dusk.",
  variables: [
    // free text
    { ...VARIABLE_DEFAULTS, id: "v1", variableName: "player", question: "What is your name?", options: [] },
    // choice, first option is the default
    {
      ...VARIABLE_DEFAULTS,
      id: "v2",
      variableName: "faction",
      question: "Which faction do you serve?",
      options: [
        { id: "o1", label: "Crown", value: "Crown" },
        { id: "o2", label: "Guild", value: "Guild" },
      ],
    },
    // choice + "write your own"
    {
      ...VARIABLE_DEFAULTS,
      id: "v3",
      variableName: "class",
      question: "What is your class?",
      allowCustom: true,
      displayMode: "listbox",
      options: [{ id: "o3", label: "Ranger", value: "ranger" }],
    },
  ],
};

// ── 1. A card carrying onboarding parses and keeps every field ──
const cardWithOnboarding = characterDataSchema.parse({
  name: "Anastasia",
  description: "The character, not the player.",
  extensions: { onboarding: ONBOARDING },
});
assert.deepEqual(
  cardWithOnboarding.extensions.onboarding,
  ONBOARDING,
  "every onboarding field must survive a card parse unchanged",
);

// A full V2 envelope round-trip (what an imported PNG/JSON actually is).
const envelope = {
  spec: "chara_card_v2",
  spec_version: "2.0",
  data: { name: "Anastasia", extensions: { onboarding: ONBOARDING } },
};
const reparsed = characterCardV2Schema.parse(JSON.parse(JSON.stringify(envelope)));
assert.deepEqual(
  reparsed.data.extensions.onboarding,
  ONBOARDING,
  "onboarding must survive a JSON round-trip of the V2 envelope",
);

// ── 2. A card WITHOUT onboarding is untouched ──
const plain = characterDataSchema.parse({ name: "Plain", extensions: { backstory: "B." } });
assert.equal("onboarding" in plain.extensions, false, "a card without onboarding must not gain the key");
assert.equal(
  characterExtensionsSchema.parse({}).onboarding,
  undefined,
  "onboarding is optional and must not be defaulted in",
);

// `enabled` defaults to false when an author ships a block but omits the flag,
// so a half-authored block never switches onboarding on by accident.
assert.equal(
  characterExtensionsSchema.parse({ onboarding: {} }).onboarding?.enabled,
  false,
  "an onboarding block with no explicit enabled flag must default to off",
);

// ── Variables ──
// A bare variable fills every preset-style default, and `randomPick` (a
// per-generation re-roll that means nothing once answers are resolved) is not
// part of the shape.
const bareVariable = characterExtensionsSchema.parse({ onboarding: { variables: [{ id: "v" }] } }).onboarding
  ?.variables[0];
assert.deepEqual(
  bareVariable,
  { ...VARIABLE_DEFAULTS, id: "v", variableName: "", question: "", options: [] },
  "a bare variable must parse as an empty free-text question with preset defaults",
);
assert.equal(
  bareVariable && "randomPick" in bareVariable,
  false,
  "randomPick must not be carried over from preset variables",
);

// Lenient on content: an author's unfinished or oddly named variable must not
// make the whole card fail to import. Naming rules are the validator's job.
assert.doesNotThrow(
  () =>
    characterDataSchema.parse({
      name: "Draft",
      extensions: { onboarding: { variables: [{ id: "v", variableName: "has space", options: [] }] } },
    }),
  "an unfinished variable name must not break parsing the card",
);

// ── 3. Export policy ──
const source = { name: "Anastasia", extensions: { onboarding: ONBOARDING, retained: true } };

assert.deepEqual(
  buildCompatibleCharacterExport(source).data.extensions.onboarding,
  undefined,
  "Compatible JSON must omit onboarding so the card stays a clean V2 for other apps",
);
assert.equal(
  (buildCompatibleCharacterExport(source).data.extensions as Record<string, unknown>).retained,
  true,
  "stripping onboarding must not disturb other extension keys",
);
assert.deepEqual(
  buildCompatibleCharacterExport(source, [], { keepOnboarding: true }).data.extensions.onboarding,
  ONBOARDING,
  "Compatible PNG must keep onboarding so an imported card still onboards",
);

// Adding the option must not change the existing compatible-export behaviour
// for the other keys it already rewrites.
const portable = buildCompatibleCharacterExport({
  name: "Portable",
  description: "Base.",
  extensions: {
    backstory: "A history.",
    appearance: "Silver hair.",
    characterSheetImageId: "x",
    onboarding: ONBOARDING,
  },
});
assert.equal(
  portable.data.description,
  "Base.\n\nBackstory:\nA history.\n\nAppearance:\nSilver hair.",
  "the existing compatible description merge must be unchanged",
);
assert.equal(
  (portable.data.extensions as Record<string, unknown>).characterSheetImageId,
  undefined,
  "the existing characterSheetImageId stripping must be unchanged",
);
assert.equal(
  (portable.data.extensions as Record<string, unknown>).useCharacterSheetAsReference,
  false,
  "the existing useCharacterSheetAsReference reset must be unchanged",
);

console.log("onboarding-s1: all assertions passed");
