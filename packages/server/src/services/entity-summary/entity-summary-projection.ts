import { createHash } from "node:crypto";
import type { CharacterData, Lorebook, LorebookEntry, Persona } from "@marinara-engine/shared";

export const ENTITY_SUMMARY_PROJECTION_VERSION = 1;

export type EntitySummaryProjectionKind = "character" | "persona" | "lorebook";

function text(value: unknown): string {
  return typeof value === "string" ? value.normalize("NFC").replace(/\s+/gu, " ").trim() : "";
}

function tags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(text).filter(Boolean))).sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
}

/**
 * Canonical character source. Creator notes and prompt fields are included;
 * assets, imported metadata, summary provenance, and embedded lorebooks are not.
 */
export function projectCharacterForEntitySummary(data: CharacterData) {
  return {
    kind: "character" as const,
    version: ENTITY_SUMMARY_PROJECTION_VERSION,
    name: text(data.name),
    description: text(data.description),
    personality: text(data.personality),
    scenario: text(data.scenario),
    backstory: text(data.extensions?.backstory),
    appearance: text(data.extensions?.appearance),
    creatorNotes: text(data.creator_notes),
    systemPrompt: text(data.system_prompt),
    postHistoryInstructions: text(data.post_history_instructions),
    tags: tags(data.tags),
  };
}

export function projectPersonaForEntitySummary(persona: Partial<Persona>) {
  return {
    kind: "persona" as const,
    version: ENTITY_SUMMARY_PROJECTION_VERSION,
    name: text(persona.name),
    description: text(persona.description),
    personality: text(persona.personality),
    scenario: text(persona.scenario),
    backstory: text(persona.backstory),
    appearance: text(persona.appearance),
    creatorNotes: text((persona as Partial<Persona> & { creatorNotes?: unknown }).creatorNotes),
    tags: tags(persona.tags),
  };
}

export function projectLorebookForEntitySummary(
  lorebook: Partial<Lorebook>,
  entries: ReadonlyArray<Partial<LorebookEntry>>,
) {
  const projectedEntries = entries
    .map((entry) => ({
      name: text(entry.name),
      description: text(entry.description),
      content: text(entry.content),
      keys: tags(entry.keys),
      secondaryKeys: tags(entry.secondaryKeys),
      order: Number.isFinite(entry.order) ? Number(entry.order) : 0,
    }))
    .sort((left, right) => {
      const orderDifference = left.order - right.order;
      if (orderDifference !== 0) return orderDifference;
      const leftValue = JSON.stringify(left);
      const rightValue = JSON.stringify(right);
      return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
    });
  return {
    kind: "lorebook" as const,
    version: ENTITY_SUMMARY_PROJECTION_VERSION,
    name: text(lorebook.name),
    description: text(lorebook.description),
    category: text(lorebook.category),
    tags: tags(lorebook.tags),
    entries: projectedEntries,
  };
}

export function hashEntitySummaryProjection(projection: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(projection)).digest("hex")}`;
}

export function projectAndHashEntitySummary(
  kind: "character",
  entity: CharacterData,
): { projection: ReturnType<typeof projectCharacterForEntitySummary>; contentHash: string };
export function projectAndHashEntitySummary(
  kind: "persona",
  entity: Partial<Persona>,
): { projection: ReturnType<typeof projectPersonaForEntitySummary>; contentHash: string };
export function projectAndHashEntitySummary(
  kind: "lorebook",
  entity: Partial<Lorebook>,
  entries: ReadonlyArray<Partial<LorebookEntry>>,
): { projection: ReturnType<typeof projectLorebookForEntitySummary>; contentHash: string };
export function projectAndHashEntitySummary(
  kind: EntitySummaryProjectionKind,
  entity: CharacterData | Partial<Persona> | Partial<Lorebook>,
  entries: ReadonlyArray<Partial<LorebookEntry>> = [],
) {
  const projection =
    kind === "character"
      ? projectCharacterForEntitySummary(entity as CharacterData)
      : kind === "persona"
        ? projectPersonaForEntitySummary(entity as Partial<Persona>)
        : projectLorebookForEntitySummary(entity as Partial<Lorebook>, entries);
  return { projection, contentHash: hashEntitySummaryProjection(projection) };
}
