import type { PersonaCardData, PersonaCardPage } from "../embeds/persona-card.embed.js";

export type EditablePersonaField = "description" | "personality" | "backstory" | "appearance" | "scenario";

export interface EditablePersonaFieldDefinition {
  field: EditablePersonaField;
  label: string;
}

export const EDITABLE_PERSONA_FIELDS_BY_PAGE: Record<PersonaCardPage, EditablePersonaFieldDefinition[]> = {
  description: [{ field: "description", label: "Description" }],
  personality: [{ field: "personality", label: "Personality" }],
  backstory: [{ field: "backstory", label: "Backstory" }],
  appearance: [{ field: "appearance", label: "Appearance" }],
  scenario: [{ field: "scenario", label: "Scenario" }],
};

export function getEditablePersonaFieldsForPage(page: PersonaCardPage) {
  return EDITABLE_PERSONA_FIELDS_BY_PAGE[page];
}

export function getPersonaFieldValue(persona: PersonaCardData, field: EditablePersonaField) {
  const value = persona[field];
  return typeof value === "string" ? value : "";
}

export function applyPersonaFieldUpdates(
  persona: PersonaCardData,
  updates: Partial<Record<EditablePersonaField, string>>,
): PersonaCardData {
  return { ...persona, ...updates };
}
