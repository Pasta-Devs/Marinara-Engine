import { ENTITY_SUMMARY_PROJECTION_VERSION, type EntitySummaryFields } from "@marinara-engine/shared";

export type EntitySummaryStatus = "ai" | "manual" | "stale" | "unknown";

export type EntitySummaryStatusInput = Partial<EntitySummaryFields> & {
  projection?: unknown;
  currentContentHash?: string | null;
};

async function hashProjection(projection: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(projection));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function getEntitySummaryStatus(input: EntitySummaryStatusInput): Promise<EntitySummaryStatus | null> {
  if (!input.entitySummary?.trim()) return null;
  if (
    !input.entitySummaryContentHash ||
    input.entitySummaryProjectionVersion !== ENTITY_SUMMARY_PROJECTION_VERSION ||
    input.entitySummaryContentHash !==
      (input.currentContentHash ?? (input.projection === undefined ? null : await hashProjection(input.projection)))
  ) {
    return "stale";
  }
  if (input.entitySummarySource === "manual" || input.entitySummarySource === "ai") return input.entitySummarySource;
  return "unknown";
}
