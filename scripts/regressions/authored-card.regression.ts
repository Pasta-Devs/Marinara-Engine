import assert from "node:assert/strict";
import {
  cardFromPersona,
  independentCardFields,
  personaFromCard,
} from "../../packages/shared/src/utils/authored-card.js";
import type { Persona } from "../../packages/shared/src/types/persona.js";

const metadata = {
  id: "persona-42",
  comment: "Private",
  avatarPath: "/avatar.png",
  createdAt: "old",
  updatedAt: "new",
  isActive: true,
};

const persona: Persona = {
  cardFieldAlternatives: [{ id: "alt-description", field: "description", value: "Alternate  ", chatIds: ["chat-1"] }],
  id: metadata.id,
  name: "  Ada Lovelace  ",
  comment: metadata.comment,
  creator: "Ada",
  personaVersion: "2.4",
  versioningEnabled: false,
  creatorNotes: "creator notes with trailing spaces   ",
  phoneticName: "AY-dah",
  summary: "summary  ",
  mes_example: "<START>\n{{char}}: hello  ",
  description: "  description with authored edges\n",
  personality: "curious ",
  scenario: "a parlour, late evening",
  backstory: "backstory\n",
  appearance: "appearance ",
  imageAppearanceEnabled: true,
  imageAppearance: "image appearance  ",
  avatarPath: metadata.avatarPath,
  characterSheetImageId: "gallery-image-9",
  useCharacterSheetAsReference: true,
  avatarCrop: null,
  isActive: metadata.isActive,
  nameColor: "#ffffff",
  dialogueColor: "#ff0000",
  boxColor: "#000000",
  trackerCardColors: {
    mode: "custom",
    displayEnabled: true,
    nameColor: "#123456",
    nameColorOpacity: 55,
    accentEnabled: true,
    dialogueColor: "#654321",
    dialogueColorOpacity: 45,
    surfaceEnabled: true,
    boxColor: "#101010",
    boxColorOpacity: 35,
    portraitStageBackground: "spotlight",
  },
  personaStats: {
    enabled: true,
    rpgStats: { enabled: true, attributes: [], hp: { value: 3, max: 8 } },
    rulesetSheets: { test: { level: 2 } },
    combatIcon: { source: "initials" },
    bars: [
      { name: "Satiety", value: 37, max: 100, color: "#f59e0b" },
      { name: "Energy", value: 88, max: 100, color: "#22c55e" },
    ],
  },
  tags: ["regression", "persona"],
  savedStatusOptions: ["At the library", "Asleep"],
  convoDisplayName: "Ada",
  aboutMe: "Mathematician ",
  createdAt: metadata.createdAt,
  updatedAt: metadata.updatedAt,
};

// Compare persisted JSON, where undefined optional fields are omitted.
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
const card = cardFromPersona(persona);
assert.deepEqual(json({ ...personaFromCard(card), ...metadata }), json(persona));
for (const field of Object.keys(metadata)) assert.equal(Object.hasOwn(card, field), false);
assert.equal(card.extensions.rpgStats?.hp.value, 3);

const original = {
  ...card,
  first_mes: "Hello {{user}}",
  vendor: "v1",
  extensions: { ...card.extensions, nameAliases: ["Addie"], otherTool: { enabled: true } },
};
const edited = cardFromPersona(
  { ...personaFromCard(original), description: "Edited", personaStats: undefined },
  original,
);
assert.equal(edited.description, "Edited");
assert.equal(edited.first_mes, original.first_mes);
assert.equal(edited.vendor, "v1");
assert.deepEqual(edited.extensions.otherTool, { enabled: true });
assert.deepEqual(edited.extensions.nameAliases, ["Addie"]);
assert.equal(personaFromCard(edited).personaStats, undefined);
assert.equal(original.extensions.rpgStats?.hp.value, 3);

const copy = independentCardFields({
  ...persona,
  personaStats: { ...persona.personaStats!, combatIcon: { source: "image", imageId: "owned", url: "/owned" } },
});
assert.deepEqual(copy.cardFieldAlternatives?.[0].chatIds, []);
assert.deepEqual(persona.cardFieldAlternatives?.[0].chatIds, ["chat-1"]);
assert.equal(copy.characterSheetImageId, undefined);
assert.equal(copy.personaStats?.combatIcon, undefined);
assert.deepEqual(copy.personaStats?.bars, persona.personaStats?.bars);

// A card saved without tags still converts to a persona that sends an array.
assert.deepEqual(personaFromCard({ ...card, tags: undefined as unknown as string[] }).tags, []);

// Game settings can exist before RPG stats are configured. Preserve explicitly empty bars.
const iconOnly = { ...edited, extensions: { ...edited.extensions, combatIcon: { source: "initials" as const } } };
const iconStats = independentCardFields(personaFromCard(iconOnly)).personaStats;
assert.equal(iconStats?.enabled, false);
assert.deepEqual(iconStats?.combatIcon, { source: "initials" });
assert.deepEqual(
  iconStats?.bars.map((bar) => bar.name),
  ["Satiety", "Energy", "Hygiene", "Mood"],
);
assert.deepEqual(
  personaFromCard({ ...iconOnly, extensions: { ...iconOnly.extensions, personaStats: { enabled: true, bars: [] } } })
    .personaStats?.bars,
  [],
);
