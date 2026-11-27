// Applying approved Card Evolution Auditor edits to a character card's data, shared by the approval popup and the
// server, which applies edits held for a chat's summary turn ("Run with summaries").
import type { CharacterCardFieldUpdate, EditableCharacterCardField } from "../types/agent.js";

export function getCharacterCardFieldValue(
  data: Record<string, unknown>,
  field: EditableCharacterCardField,
): string | null {
  if (field === "backstory" || field === "appearance" || field === "aboutMe") {
    const extensions = data.extensions;
    const value =
      extensions && typeof extensions === "object" ? (extensions as Record<string, unknown>)[field] : undefined;
    if (typeof value === "string") return value;
    // aboutMe is optional and often absent; treat missing as empty so it can be filled from scratch.
    // backstory/appearance keep returning null when absent (they always carry a "" default in practice).
    return field === "aboutMe" ? "" : null;
  }
  const value = data[field];
  return typeof value === "string" ? value : null;
}

export function setCharacterCardFieldValue(
  data: Record<string, unknown>,
  field: EditableCharacterCardField,
  value: string,
): Record<string, unknown> {
  if (field === "backstory" || field === "appearance" || field === "aboutMe") {
    const extensions =
      data.extensions && typeof data.extensions === "object" ? (data.extensions as Record<string, unknown>) : {};
    return { ...data, extensions: { ...extensions, [field]: value } };
  }
  return { ...data, [field]: value };
}

/** Whether an edit no longer matches the card: its old text is gone (an empty field filled from scratch is fine). */
export function isCharacterCardUpdateStale(data: Record<string, unknown>, update: CharacterCardFieldUpdate): boolean {
  const current = getCharacterCardFieldValue(data, update.field);
  if (update.oldText.length === 0 && current === "") return false;
  return !(typeof current === "string" && update.oldText.length > 0 && current.includes(update.oldText));
}

function appendStaleCardReplacement(base: string, replacement: string): string {
  const trimmedReplacement = replacement.trim();
  if (!trimmedReplacement) return base;
  if (base.includes(trimmedReplacement)) return base;
  const separator = base.trim().length > 0 ? "\n\n" : "";
  return `${base.trimEnd()}${separator}${trimmedReplacement}`;
}

export function bumpCharacterVersion(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "1.1";
  const match = raw.match(/^(.*?)(\d+)(\D*)$/);
  if (!match) return `${raw}.1`;
  const prefix = match[1] ?? "";
  const numberPart = match[2] ?? "0";
  const suffix = match[3] ?? "";
  const next = String(Number(numberPart) + 1).padStart(numberPart.length, "0");
  return `${prefix}${next}${suffix}`;
}

/**
 * The card data with the edits applied as targeted replacements inside each field, never by overwriting the field.
 * An edit whose old text is gone is skipped, unless `overrideStale`, which appends its new text instead so stale old
 * text can't delete unrelated card content. Bumps `character_version`.
 */
export function applyCharacterCardFieldUpdates(
  data: Record<string, unknown>,
  updates: readonly CharacterCardFieldUpdate[],
  overrideStale = false,
): Record<string, unknown> {
  let nextData: Record<string, unknown> = { ...data };
  for (const update of updates) {
    const base = getCharacterCardFieldValue(nextData, update.field);
    if (typeof base !== "string") continue;
    let nextValue: string;
    if (update.oldText.length === 0 && base === "") {
      nextValue = update.newText;
    } else if (update.oldText.length > 0 && base.includes(update.oldText)) {
      // Exact-match replace; a function keeps `$` sequences in the new text literal.
      nextValue = base.replace(update.oldText, () => update.newText);
    } else if (overrideStale) {
      nextValue = appendStaleCardReplacement(base, update.newText);
    } else {
      nextValue = base;
    }
    nextData = setCharacterCardFieldValue(nextData, update.field, nextValue);
  }
  nextData.character_version = bumpCharacterVersion(nextData.character_version);
  return nextData;
}

/** Chat setting: Lorebook Keeper runs with each automatic summary instead of on its own count. */
export const LOREBOOK_KEEPER_RUN_WITH_SUMMARIES_KEY = "lorebookKeeperRunWithSummaries";
/**
 * Chat setting: Card Evolution Auditor runs with each automatic summary, and card edits approved later wait for the
 * next summary turn (`heldCardUpdates`).
 */
export const CARD_EVOLUTION_RUN_WITH_SUMMARIES_KEY = "cardEvolutionRunWithSummaries";

/** Approved card edits waiting in a chat's metadata (`heldCardUpdates`) for its next summary turn. */
export interface HeldCardUpdate {
  id: string;
  characterId: string;
  characterName: string;
  agentName: string;
  updates: CharacterCardFieldUpdate[];
  overrideStale: boolean;
  approvedAt: string;
}

export function readHeldCardUpdates(metadata: Record<string, unknown> | null | undefined): HeldCardUpdate[] {
  const raw = metadata?.heldCardUpdates;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is HeldCardUpdate =>
      !!item &&
      typeof item === "object" &&
      typeof (item as HeldCardUpdate).id === "string" &&
      typeof (item as HeldCardUpdate).characterId === "string" &&
      Array.isArray((item as HeldCardUpdate).updates),
  );
}
