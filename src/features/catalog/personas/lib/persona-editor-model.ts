import { parseAvatarCropJson, type AvatarCrop, type LegacyAvatarCrop } from "../../../../shared/lib/utils";

export interface AltDescriptionEntry {
  id: string;
  label: string;
  content: string;
  active: boolean;
}

export interface PersonaStatBar {
  name: string;
  value: number;
  max: number;
  color: string;
}

export interface PersonaRPGAttribute {
  name: string;
  value: number;
}

export interface PersonaRPGStats {
  enabled: boolean;
  attributes: PersonaRPGAttribute[];
  hp: { value: number; max: number };
}

export interface PersonaStatsData {
  enabled: boolean;
  bars: PersonaStatBar[];
  rpgStats?: PersonaRPGStats;
}

export interface PersonaFormData {
  name: string;
  comment: string;
  description: string;
  personality: string;
  scenario: string;
  backstory: string;
  appearance: string;
  nameColor: string;
  dialogueColor: string;
  boxColor: string;
  personaStats: PersonaStatsData | null;
  altDescriptions: AltDescriptionEntry[];
  tags: string[];
  avatarCrop: AvatarCrop | LegacyAvatarCrop | null;
}

export interface PersonaRow {
  id: string;
  name: string;
  comment?: string;
  description: string;
  personality: string;
  scenario: string;
  backstory: string;
  appearance: string;
  avatarPath: string | null;
  avatarCrop?: AvatarCrop | LegacyAvatarCrop | string | null;
  isActive: string | boolean;
  nameColor?: string;
  dialogueColor?: string;
  boxColor?: string;
  personaStats?: PersonaStatsData | Record<string, unknown> | string;
  altDescriptions?: AltDescriptionEntry[];
  tags?: string[];
}

export const DEFAULT_RPG_STATS: PersonaRPGStats = {
  enabled: false,
  attributes: [
    { name: "STR", value: 10 },
    { name: "DEX", value: 10 },
    { name: "CON", value: 10 },
    { name: "INT", value: 10 },
    { name: "WIS", value: 10 },
    { name: "CHA", value: 10 },
  ],
  hp: { value: 100, max: 100 },
};

export const DEFAULT_PERSONA_STATS: PersonaStatsData = {
  enabled: false,
  bars: [
    { name: "Satiety", value: 100, max: 100, color: "#f59e0b" },
    { name: "Energy", value: 100, max: 100, color: "#22c55e" },
    { name: "Hygiene", value: 100, max: 100, color: "#3b82f6" },
    { name: "Mood", value: 100, max: 100, color: "#ec4899" },
  ],
  rpgStats: DEFAULT_RPG_STATS,
};

function parseAvatarCropValue(value: PersonaRow["avatarCrop"]): AvatarCrop | LegacyAvatarCrop | null {
  if (!value) return null;
  if (typeof value === "string") return parseAvatarCropJson(value);
  return parseAvatarCropJson(JSON.stringify(value));
}

export function buildPersonaFormData(persona: PersonaRow): PersonaFormData {
  return {
    name: persona.name,
    comment: persona.comment ?? "",
    description: persona.description,
    personality: persona.personality ?? "",
    scenario: persona.scenario ?? "",
    backstory: persona.backstory ?? "",
    appearance: persona.appearance ?? "",
    nameColor: persona.nameColor ?? "",
    dialogueColor: persona.dialogueColor ?? "",
    boxColor: persona.boxColor ?? "",
    personaStats:
      persona.personaStats && typeof persona.personaStats === "object"
        ? (persona.personaStats as unknown as PersonaStatsData)
        : null,
    altDescriptions: Array.isArray(persona.altDescriptions) ? persona.altDescriptions : [],
    tags: Array.isArray(persona.tags) ? persona.tags : [],
    avatarCrop: parseAvatarCropValue(persona.avatarCrop),
  };
}
