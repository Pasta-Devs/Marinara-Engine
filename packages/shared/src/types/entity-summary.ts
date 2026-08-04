/** Origin of a persisted entity summary. */
export type EntitySummarySource = "ai" | "manual";

/** Portable summary text and the provenance needed to determine freshness. */
export interface EntitySummaryFields {
  entitySummary: string;
  entitySummaryGeneratedAt: string | null;
  entitySummarySource: EntitySummarySource | null;
  entitySummaryContentHash: string | null;
  entitySummaryProjectionVersion: number | null;
}

/** Character-card form of EntitySummaryFields. Fields remain optional for V2 card compatibility. */
export type CharacterEntitySummaryFields = Partial<EntitySummaryFields>;

/** Persona file-table/API summary provenance. */
export type PersonaEntitySummaryFields = EntitySummaryFields;

/** Lorebook file-table/API summary provenance. */
export type LorebookEntitySummaryFields = EntitySummaryFields;
