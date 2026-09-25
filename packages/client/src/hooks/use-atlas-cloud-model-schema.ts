// ──────────────────────────────────────────────
// React Query: Atlas Cloud video model schema
// ──────────────────────────────────────────────
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import type { AtlasCloudVideoModelSchemaResponse } from "@marinara-engine/shared";

export const atlasCloudModelSchemaKeys = {
  all: ["atlas-cloud-model-schema"] as const,
  video: (model: string) => [...atlasCloudModelSchemaKeys.all, "video", model] as const,
};

/** Atlas Cloud model IDs are `vendor/model[/variant]`; anything else is still being typed. */
const ATLAS_CLOUD_MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)+$/i;

export function useAtlasCloudVideoModelSchema(model: string) {
  const trimmed = model.trim();
  return useQuery({
    queryKey: atlasCloudModelSchemaKeys.video(trimmed),
    queryFn: () =>
      api.get<AtlasCloudVideoModelSchemaResponse>(
        `/connections/atlas-cloud/video-model-schema?model=${encodeURIComponent(trimmed)}`,
      ),
    enabled: ATLAS_CLOUD_MODEL_ID_PATTERN.test(trimmed),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
