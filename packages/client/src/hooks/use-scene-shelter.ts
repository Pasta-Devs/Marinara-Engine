import { useMemo } from "react";
import { sceneShelter, type SceneShelter } from "@marinara-engine/shared";
import { useSpatialContext } from "./use-spatial-context";

function readMetadata(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** Whether the chat runs World Maps (the "hierarchical-maps" agent). */
export function chatUsesWorldMaps(metadata: unknown): boolean {
  const meta = readMetadata(metadata);
  return (
    meta.enableAgents === true &&
    Array.isArray(meta.activeAgentIds) &&
    (meta.activeAgentIds as unknown[]).includes("hierarchical-maps")
  );
}

/**
 * Indoors or outdoors for the open chat: the World Maps current place kind (room, floor, building)
 * when the chat has a map, and the World State location text. "" when it can't tell.
 */
export function useSceneShelter(
  chatId: string | null,
  chatMetadata: unknown,
  location: string | null | undefined,
): SceneShelter {
  const mapsActive = chatUsesWorldMaps(chatMetadata);
  const spatial = useSpatialContext(chatId, mapsActive);
  const data = mapsActive ? spatial.data : null;
  const currentId = data?.currentLocationId ?? null;
  const current = currentId ? data?.definition?.locations.find((place) => place.id === currentId) : undefined;
  const mapKind = current?.kind ?? null;
  const placeName = current?.name ?? null;
  return useMemo(() => sceneShelter(location || placeName, mapKind), [location, placeName, mapKind]);
}
