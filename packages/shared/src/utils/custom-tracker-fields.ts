import type { CustomTrackerField } from "../types/game-state.js";

export function formatCustomTrackerFieldForPrompt(field: unknown): string {
  if (!field || typeof field !== "object" || Array.isArray(field)) return "- Field: ";
  const trackerField = field as Partial<CustomTrackerField>;
  const name = typeof trackerField.name === "string" ? trackerField.name : "Field";
  const value = typeof trackerField.value === "string" ? trackerField.value : "";
  const lockLabel = trackerField.locked === true ? " (locked)" : "";
  return `- ${name}: ${value}${lockLabel}`;
}
