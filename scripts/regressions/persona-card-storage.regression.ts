import assert from "node:assert/strict";
import { characterDataSchema } from "../../packages/shared/src/schemas/character.schema.js";
import type { Persona } from "../../packages/shared/src/types/persona.js";
import {
  personaRowChanges,
  personaRowFromStored,
  storedPersonaFromRow,
} from "../../packages/server/src/services/personas/persona-card-storage.js";
import { encodePersonaUpdate, projectPersona } from "../../packages/server/src/services/personas/persona-projector.js";
import type { PersonaStorageRow } from "../../packages/server/src/services/storage/characters.storage.js";

const minimalRow: PersonaStorageRow = {
  cardFieldAlternatives: "[]",
  id: "persona-minimal",
  // `name` is the one required authored column with no schema default.
  name: "Minimal",
  comment: "",
  creator: "",
  personaVersion: "1.0",
  versioningEnabled: "true",
  creatorNotes: "",
  phoneticName: "",
  summary: "",
  mes_example: "",
  description: "",
  personality: "",
  scenario: "",
  backstory: "",
  appearance: "",
  imageAppearanceEnabled: "false",
  imageAppearance: "",
  avatarPath: null,
  characterSheetImageId: null,
  useCharacterSheetAsReference: "false",
  avatarCrop: "",
  isActive: "false",
  nameColor: "",
  dialogueColor: "",
  boxColor: "",
  trackerCardColors: '{"mode":"chat"}',
  personaStats: "",
  tags: "[]",
  savedStatusOptions: "[]",
  convoDisplayName: "",
  aboutMe: "",
  convoBehavior: "",
  embedding: null,
  createdAt: "2026-01-03T00:00:00.000Z",
  updatedAt: "2026-01-04T00:00:00.000Z",
};

const canonicalRecord = {
  id: "persona-canonical",
  comment: "Private",
  avatarPath: "/avatars/ada.png",
  isActive: "true",
  embedding: "[0.25,0.5]",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const canonicalPersona: Persona = {
  cardFieldAlternatives: [{ id: "alt-description", field: "description", value: "Alternate", chatIds: ["chat-1"] }],
  id: canonicalRecord.id,
  name: "Ada Lovelace",
  comment: canonicalRecord.comment,
  creator: "Ada",
  personaVersion: "2.0",
  versioningEnabled: false,
  creatorNotes: "Private notes",
  phoneticName: "AY-dah",
  summary: "Mathematician",
  mes_example: "<START>\n{{char}}: hello",
  description: "A curious mathematician.",
  personality: "Curious",
  scenario: "A parlour, late evening.",
  backstory: "Invented the first algorithm.",
  appearance: "Dark hair and a day dress.",
  imageAppearanceEnabled: true,
  imageAppearance: "A portrait in candlelight.",
  avatarPath: canonicalRecord.avatarPath,
  characterSheetImageId: "gallery-image-9",
  useCharacterSheetAsReference: true,
  avatarCrop: { srcX: 0.1, srcY: 0.2, srcWidth: 0.5, srcHeight: 0.6 },
  isActive: true,
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
    portraitFocusX: 40,
    portraitFocusY: 60,
    portraitZoom: 1.25,
  },
  personaStats: {
    enabled: true,
    bars: [
      { name: "Satiety", value: 37, max: 100, color: "#f59e0b" },
      { name: "Energy", value: 88, max: 100, color: "#22c55e" },
    ],
    rpgStats: { enabled: true, attributes: [{ name: "Intellect", value: 18 }], hp: { value: 3, max: 8 } },
    combatIcon: { source: "initials" },
  },
  tags: ["regression", "persona"],
  savedStatusOptions: ["At the library", "Asleep"],
  convoDisplayName: "Ada",
  aboutMe: "Mathematician and countess.",
  convoBehavior: { instruction: "Stay in character.", insertionStrategy: "constant_after" },
  createdAt: canonicalRecord.createdAt,
  updatedAt: canonicalRecord.updatedAt,
};

const canonicalRow = {
  ...minimalRow,
  ...canonicalRecord,
  ...encodePersonaUpdate(canonicalPersona),
  characterSheetImageId: canonicalPersona.characterSheetImageId ?? null,
  useCharacterSheetAsReference: String(canonicalPersona.useCharacterSheetAsReference ?? false),
} as PersonaStorageRow;

const legacyRow: PersonaStorageRow = {
  ...minimalRow,
  id: "persona-legacy",
  name: "Legacy",
  personaVersion: "",
  personaStats: "not json",
  tags: '["a", 1]',
  trackerCardColors: "{}",
  convoBehavior: "",
};

const storedRows = {
  canonical: storedPersonaFromRow(canonicalRow),
  minimal: storedPersonaFromRow(minimalRow),
  legacy: storedPersonaFromRow(legacyRow),
};

for (const [fixture, stored] of Object.entries(storedRows)) {
  const parsed = characterDataSchema.safeParse(JSON.parse(stored.data));
  assert.equal(parsed.success, true, `${fixture} data must pass characterDataSchema`);
}

assert.deepEqual(personaRowChanges(minimalRow), []);
assert.deepEqual(personaRowFromStored(storedRows.minimal), minimalRow);

assert.deepEqual(personaRowChanges(legacyRow), ["personaStats", "personaVersion", "tags", "trackerCardColors"]);
assert.deepEqual(projectPersona(legacyRow), projectPersona(personaRowFromStored(storedRows.legacy)));

assert.deepEqual(personaRowChanges(canonicalRow), []);
assert.deepEqual(personaRowFromStored(storedRows.canonical), canonicalRow);
