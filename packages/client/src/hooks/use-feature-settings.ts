import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FEATURE_SETTINGS_KEY,
  resolveFeatureEnabled,
  resolveFeatureNumber,
  type FeatureNumberName,
  type FeatureSettings,
  type FeatureSettingsResponse,
  type FeatureSwitchName,
} from "@marinara-engine/shared";
import { api } from "../lib/api-client";

const FEATURES_PATH = `/app-settings/${FEATURE_SETTINGS_KEY}`;

export const featureSettingsKeys = {
  all: [FEATURE_SETTINGS_KEY] as const,
};

/** Server-side Settings > Advanced > Features switches. Absent keys use the registry default (off). */
export function useFeatureSettings() {
  return useQuery<FeatureSettingsResponse>({
    queryKey: featureSettingsKeys.all,
    queryFn: () => api.get<FeatureSettingsResponse>(FEATURES_PATH),
    staleTime: 5 * 60_000,
  });
}

/**
 * Whether a switch is in effect on the server: the environment value when one pins it, else the
 * saved setting, else the default. Returns the default (off) until the settings load.
 */
export function useFeatureEnabled(name: FeatureSwitchName): boolean {
  const data = useFeatureSettings().data;
  return data?.effective?.[name] ?? resolveFeatureEnabled(data?.settings, name);
}

export function useFeatureNumber(name: FeatureNumberName): number {
  return resolveFeatureNumber(useFeatureSettings().data?.settings, name);
}

/** Save the complete switch object (omitted keys return to their defaults). */
export function useSaveFeatureSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: FeatureSettings) => api.put<FeatureSettingsResponse>(FEATURES_PATH, settings),
    onSuccess: async (response) => {
      await queryClient.cancelQueries({ queryKey: featureSettingsKeys.all });
      queryClient.setQueryData<FeatureSettingsResponse>(featureSettingsKeys.all, response);
    },
  });
}
