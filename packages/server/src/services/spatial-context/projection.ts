import type {
  ResolvedOwnerSpatialProjection,
  SpatialContextDefinition,
} from "@marinara-engine/shared";
import { getCapabilityService } from "../capability-packages/capability-service-registry.service.js";
import type { ResolveSpatialStateOptions } from "./state-resolution.js";

interface ProjectionService {
  buildOwnerSpatialProjection(
    chatId: string,
    definition: SpatialContextDefinition | null,
    currentLocationId: string | null,
  ): ResolvedOwnerSpatialProjection | null;
  resolveOwnerSpatialProjection(
    chatId: string,
    options?: ResolveSpatialStateOptions,
  ): Promise<ResolvedOwnerSpatialProjection | null>;
  formatOwnerSpatialBreadcrumb(projection: ResolvedOwnerSpatialProjection): string;
  formatOwnerSpatialPrompt(projection: ResolvedOwnerSpatialProjection): string;
  injectOwnerSpatialPrompt<T extends { role: "system" | "user" | "assistant"; content: string }>(
    messages: T[],
    projection: ResolvedOwnerSpatialProjection | null,
  ): T[];
  projectGameSnapshotLocation<T extends object>(
    snapshot: T | null,
    projection: ResolvedOwnerSpatialProjection | null,
  ): T | null;
  omitAuthoritativeGameLocation<T extends Record<string, unknown>>(
    patch: T,
    projection: ResolvedOwnerSpatialProjection | null,
  ): T;
}

const service = () => getCapabilityService<ProjectionService>("hierarchical-maps:projection");

export function buildOwnerSpatialProjection(
  chatId: string,
  definition: SpatialContextDefinition | null,
  currentLocationId: string | null,
): ResolvedOwnerSpatialProjection | null {
  return service()?.buildOwnerSpatialProjection(chatId, definition, currentLocationId) ?? null;
}

export async function resolveOwnerSpatialProjection(
  chatId: string,
  options: ResolveSpatialStateOptions = {},
): Promise<ResolvedOwnerSpatialProjection | null> {
  return service()?.resolveOwnerSpatialProjection(chatId, options) ?? null;
}

export function formatOwnerSpatialBreadcrumb(projection: ResolvedOwnerSpatialProjection): string {
  return service()?.formatOwnerSpatialBreadcrumb(projection) ?? projection.breadcrumb.map(({ name }) => name).join(" > ");
}

export function formatOwnerSpatialPrompt(projection: ResolvedOwnerSpatialProjection): string {
  return service()?.formatOwnerSpatialPrompt(projection) ?? "";
}

export function injectOwnerSpatialPrompt<T extends { role: "system" | "user" | "assistant"; content: string }>(
  messages: T[],
  projection: ResolvedOwnerSpatialProjection | null,
): T[] {
  return service()?.injectOwnerSpatialPrompt(messages, projection) ?? messages;
}

export function projectGameSnapshotLocation<T extends object>(
  snapshot: T | null,
  projection: ResolvedOwnerSpatialProjection | null,
): T | null {
  return service()?.projectGameSnapshotLocation(snapshot, projection) ?? snapshot;
}

export function omitAuthoritativeGameLocation<T extends Record<string, unknown>>(
  patch: T,
  projection: ResolvedOwnerSpatialProjection | null,
): T {
  return service()?.omitAuthoritativeGameLocation(patch, projection) ?? patch;
}
