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
import { readFileSync } from "node:fs";
import {
  characterCardV2Schema,
  characterDataSchema,
  characterExtensionsSchema,
  dropUnreadableOnboarding,
  ONBOARDING_MAX_QUESTIONS,
  withUniqueOnboardingIds,
} from "../../packages/shared/src/index.js";
import { buildCompatibleCharacterExport } from "../../packages/server/src/routes/characters.routes.js";
import { normalizeNativeCharacterData } from "../../packages/server/src/services/import/marinara.importer.js";

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
        // optional player-facing help text must survive the round-trips below
        { id: "o1", label: "Crown", value: "Crown", description: "Sworn to the old throne." },
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

// ── 5. No length limits: the editor doesn't cap its inputs ──
// Onboarding is saved with the whole card, so a schema limit the editor doesn't
// enforce would let one long question wipe the onboarding or block every save
// (#7308 review). Long questions, help text, separators and 100+ questions
// must all parse. The question cap lives in the editor and in imports (§6, §7).
const long = "x".repeat(5000);
const unlimited = {
  ...ONBOARDING,
  variables: Array.from({ length: 150 }, (_, index) => ({
    ...ONBOARDING.variables[1],
    id: `v${index}`,
    variableName: `q${index}_${long.slice(0, 200)}`,
    question: long,
    separator: long,
    options: [{ id: "o", label: "A", value: "a", description: long }],
  })),
};
assert.deepEqual(
  characterExtensionsSchema.parse({ onboarding: unlimited }).onboarding,
  unlimited,
  "onboarding must have no length limits the editor doesn't enforce",
);

// ── 6. Imports never fail on unreadable onboarding ──
// A hand-edited card can carry onboarding the schema refuses (here: a question
// that isn't text). The card still imports, just without its onboarding.
const unreadable = { ...ONBOARDING, variables: [{ ...ONBOARDING.variables[0], question: 42 }] };
const nativeKept = normalizeNativeCharacterData({ name: "Ana", extensions: { onboarding: ONBOARDING } });
assert.deepEqual(nativeKept?.extensions.onboarding, ONBOARDING, "native import keeps readable onboarding");
const nativeDropped = normalizeNativeCharacterData({
  name: "Ana",
  extensions: { backstory: "B.", onboarding: unreadable },
});
assert.ok(nativeDropped, "native import must not refuse a card over its onboarding");
assert.equal("onboarding" in nativeDropped.extensions, false, "unreadable onboarding is dropped");
assert.equal(nativeDropped.extensions.backstory, "B.", "the rest of the card is kept");
assert.deepEqual(
  dropUnreadableOnboarding({ fav: true, onboarding: unreadable }),
  { extensions: { fav: true }, dropped: true, truncated: false },
  "V2/PNG imports drop unreadable onboarding with the same helper",
);
assert.deepEqual(
  dropUnreadableOnboarding({ fav: true }),
  { extensions: { fav: true }, dropped: false, truncated: false },
  "extensions without onboarding pass through",
);
// Thousands of questions freeze the editor (#7308 review): imports keep the first ones.
const nativeCapped = normalizeNativeCharacterData({ name: "Ana", extensions: { onboarding: unlimited } });
assert.equal(nativeCapped?.extensions.onboarding?.variables.length, ONBOARDING_MAX_QUESTIONS, "imports cap questions");
assert.equal(nativeCapped?.extensions.onboarding?.variables[0]?.id, "v0", "and keep the first ones, in order");
assert.equal(dropUnreadableOnboarding({ onboarding: unlimited }).truncated, true, "V2/PNG imports cap them too");
assert.equal(dropUnreadableOnboarding({ onboarding: null }).dropped, true, "a null block is unreadable, not empty");
// Repeated or empty ids: the editor edits, deletes and reorders by id, so twins
// would change together or multiply on reorder past the cap (#7308 review).
const twins = {
  ...ONBOARDING,
  variables: Array.from({ length: 3 }, (_, index) => ({
    ...ONBOARDING.variables[1],
    id: index === 2 ? "" : "same",
    variableName: `twin${index}`,
    options: [
      { id: "o", label: "A", value: "a" },
      { id: "o", label: "B", value: "b" },
    ],
  })),
};
const unique = dropUnreadableOnboarding({ onboarding: twins }).extensions.onboarding as typeof twins;
const questionIds = unique.variables.map((variable) => variable.id);
assert.deepEqual(questionIds, ["same", "same_2", "question_2"], "repeated and empty question ids are made unique");
assert.deepEqual(
  unique.variables[0]!.options.map((option) => option.id),
  ["o", "o_2"],
  "repeated option ids within a question are made unique",
);
assert.deepEqual(
  dropUnreadableOnboarding({ onboarding: unique }).extensions.onboarding,
  unique,
  "unique ids stay as they are, so re-reading a card is stable",
);
const parsedDemo = characterExtensionsSchema.parse({ onboarding: ONBOARDING }).onboarding!;
assert.equal(
  withUniqueOnboardingIds(parsedDemo),
  parsedDemo,
  "nothing to fix returns the same object (no editor churn)",
);

// ── 7. The editor never shows unreadable onboarding as empty defaults ──
// If it did, the next edit would replace the author's data (#7308 review).
const editorSource = readFileSync(
  new URL("../../packages/client/src/components/characters/CharacterEditor.tsx", import.meta.url),
  "utf8",
);
assert.match(editorSource, /const unreadable = !parsedOnboarding\.success;/, "the tab must know when it can't read");
assert.match(
  editorSource,
  /\) => \{\s*if \(unreadable\) return;/,
  "edits must be ignored while the stored onboarding can't be read",
);
assert.match(editorSource, /maxCount=\{ONBOARDING_MAX_QUESTIONS\}/, "the editor stops adding questions at the cap");
assert.match(
  editorSource,
  /onboarding === undefined \? \{\} :/,
  "only a missing block reads as empty; null is unreadable",
);
assert.match(editorSource, /withUniqueOnboardingIds\(parsedOnboarding\.data/, "the editor reads unique ids");
assert.match(editorSource, /pool\.delete\(id\);/, "a reorder takes each question once, so it can't grow the list");

console.log("onboarding-s1: all assertions passed");
