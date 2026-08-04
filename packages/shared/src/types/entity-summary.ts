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

export type EntitySummaryKind = "character" | "persona" | "lorebook";
export type EntitySummaryBatchStatus = "queued" | "running" | "completed" | "cancelled";
export type EntitySummaryBatchItemStatus =
  | "queued"
  | "running"
  | "candidate"
  | "failed"
  | "cancelled"
  | "applied"
  | "stale";

export interface EntitySummaryBatchItemRef {
  kind: EntitySummaryKind;
  entityId: string;
}

export interface EntitySummaryBatchItem extends EntitySummaryBatchItemRef {
  id: string;
  batchId: string;
  status: EntitySummaryBatchItemStatus;
  attempts: number;
  sourceHash: string | null;
  candidateSummary: string | null;
  error: string | null;
  connectionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EntitySummaryBatch {
  id: string;
  status: EntitySummaryBatchStatus;
  cancelRequested: boolean;
  timeoutMs: number;
  debugMode: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  items: EntitySummaryBatchItem[];
}
