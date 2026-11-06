import { estimateTextTokens } from "@marinara-engine/shared";

// Token budgeting for the preset editor's Sections panel.
//
// Estimates reuse the app's shared light estimator, so a collapsed row and its expanded editor footer
// always agree, and no model call or tokenizer is involved. Values are rough by design: only the
// section's own text is counted, not the XML/Markdown wrapper the assembler adds around it.
//
// Rules (mirrored by estimateEnabledStaticPresetTokens):
// - Marker sections (character info, persona, lorebook/World Info, chat examples, chat history,
//   summaries, agent data) are filled in at prompt assembly from the current chat. The preset alone
//   cannot size them, so they report null — the row shows "Dynamic" — and never count toward the
//   aggregate instead of pretending to be a known zero.
// - Disabled sections keep their own estimate so the row can show it, but are excluded from the
//   aggregate, which is labelled as the enabled *static* preset only.

/** The fields the panel can rely on; marker and enabled flags arrive as booleans or "true"/"false" strings. */
export type PresetSectionTokenShape = {
  content?: unknown;
  enabled?: unknown;
  isMarker?: unknown;
};

function readFlag(value: unknown): boolean {
  return value === true || value === "true";
}

/**
 * Approximate tokens for one section's own text, or null for a marker whose content only exists once
 * the prompt is assembled for a chat.
 */
export function estimatePresetSectionTokens(section: PresetSectionTokenShape): number | null {
  if (readFlag(section.isMarker)) return null;
  return estimateTextTokens(typeof section.content === "string" ? section.content : "");
}

/** Total of enabled static sections only: markers and disabled sections are left out. */
export function estimateEnabledStaticPresetTokens(sections: readonly PresetSectionTokenShape[]): number {
  let total = 0;
  for (const section of sections) {
    if (!readFlag(section.enabled)) continue;
    total += estimatePresetSectionTokens(section) ?? 0;
  }
  return total;
}
