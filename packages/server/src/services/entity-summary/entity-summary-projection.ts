import { createHash } from "node:crypto";
import {
  ENTITY_SUMMARY_PROJECTION_VERSION,
  projectCharacterForEntitySummary,
  projectLorebookForEntitySummary,
  projectPersonaForEntitySummary,
  type CharacterEntitySummaryProjectionInput,
  type LorebookEntitySummaryProjectionInput,
  type LorebookEntryEntitySummaryProjectionInput,
  type PersonaEntitySummaryProjectionInput,
} from "@marinara-engine/shared";

export { ENTITY_SUMMARY_PROJECTION_VERSION };

export type EntitySummaryProjectionKind = "character" | "persona" | "lorebook";

export function hashEntitySummaryProjection(projection: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(projection)).digest("hex")}`;
}

export function projectAndHashEntitySummary(
  kind: "character",
  entity: CharacterEntitySummaryProjectionInput,
): { projection: ReturnType<typeof projectCharacterForEntitySummary>; contentHash: string };
export function projectAndHashEntitySummary(
  kind: "persona",
  entity: PersonaEntitySummaryProjectionInput,
): { projection: ReturnType<typeof projectPersonaForEntitySummary>; contentHash: string };
export function projectAndHashEntitySummary(
  kind: "lorebook",
  entity: LorebookEntitySummaryProjectionInput,
  entries: ReadonlyArray<LorebookEntryEntitySummaryProjectionInput>,
): { projection: ReturnType<typeof projectLorebookForEntitySummary>; contentHash: string };
export function projectAndHashEntitySummary(
  kind: EntitySummaryProjectionKind,
  entity:
    | CharacterEntitySummaryProjectionInput
    | PersonaEntitySummaryProjectionInput
    | LorebookEntitySummaryProjectionInput,
  entries: ReadonlyArray<LorebookEntryEntitySummaryProjectionInput> = [],
) {
  const projection =
    kind === "character"
      ? projectCharacterForEntitySummary(entity as CharacterEntitySummaryProjectionInput)
      : kind === "persona"
        ? projectPersonaForEntitySummary(entity as PersonaEntitySummaryProjectionInput)
        : projectLorebookForEntitySummary(entity as LorebookEntitySummaryProjectionInput, entries);
  return { projection, contentHash: hashEntitySummaryProjection(projection) };
}
