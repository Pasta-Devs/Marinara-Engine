import type { CharacterData } from "@marinara-engine/shared";
import type { CharacterCardPage } from "../embeds/character-card.embed.js";

export type EditableCharacterField =
  | "name"
  | "creator"
  | "character_version"
  | "creator_notes"
  | "description"
  | "personality"
  | "backstory"
  | "appearance"
  | "scenario"
  | "first_mes"
  | "mes_example"
  | "system_prompt"
  | "post_history_instructions";

export interface EditableCharacterFieldDefinition {
  field: EditableCharacterField;
  label: string;
  style: "short" | "paragraph";
}

export const EDITABLE_CHARACTER_FIELDS_BY_PAGE: Partial<Record<CharacterCardPage, EditableCharacterFieldDefinition[]>> = {
  metadata: [
    { field: "name", label: "Name", style: "short" },
    { field: "creator", label: "Creator", style: "short" },
    { field: "character_version", label: "Version", style: "short" },
    { field: "creator_notes", label: "Creator Notes", style: "paragraph" },
  ],
  description: [{ field: "description", label: "Description", style: "paragraph" }],
  personality: [{ field: "personality", label: "Personality", style: "paragraph" }],
  backstory: [{ field: "backstory", label: "Backstory", style: "paragraph" }],
  appearance: [{ field: "appearance", label: "Appearance", style: "paragraph" }],
  scenario: [{ field: "scenario", label: "Scenario", style: "paragraph" }],
  dialogue: [
    { field: "first_mes", label: "First Message", style: "paragraph" },
    { field: "mes_example", label: "Example Dialogue", style: "paragraph" },
  ],
  advanced: [
    { field: "system_prompt", label: "System Prompt", style: "paragraph" },
    { field: "post_history_instructions", label: "Post-History Instructions", style: "paragraph" },
  ],
};

export function getEditableFieldsForPage(page: CharacterCardPage) {
  return EDITABLE_CHARACTER_FIELDS_BY_PAGE[page] ?? [];
}

export function getCharacterFieldValue(data: CharacterData, field: EditableCharacterField) {
  if (field === "backstory" || field === "appearance") {
    const value = data.extensions?.[field];
    return typeof value === "string" ? value : "";
  }
  const value = data[field];
  return typeof value === "string" ? value : "";
}

export function applyCharacterFieldUpdates(
  data: CharacterData,
  updates: Partial<Record<EditableCharacterField, string>>,
): CharacterData {
  const nextData: CharacterData = { ...data, extensions: { ...(data.extensions ?? {}) } };
  for (const [field, value] of Object.entries(updates) as Array<[EditableCharacterField, string]>) {
    if (field === "backstory" || field === "appearance") {
      nextData.extensions[field] = value;
    } else {
      nextData[field] = value;
    }
  }
  return nextData;
}
