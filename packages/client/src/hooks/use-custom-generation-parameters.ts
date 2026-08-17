import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CUSTOM_GENERATION_PARAMETERS_SETTINGS_KEY,
  parseManagedGenerationParameterDefinitions,
  type AppSettingsResponse,
  type ManagedGenerationParameterDefinition,
} from "@marinara-engine/shared";
import { api } from "../lib/api-client";

export const customGenerationParameterKeys = {
  all: ["app-settings", CUSTOM_GENERATION_PARAMETERS_SETTINGS_KEY] as const,
};

export function useCustomGenerationParameters() {
  return useQuery<ManagedGenerationParameterDefinition[]>({
    queryKey: customGenerationParameterKeys.all,
    queryFn: async () => {
      const response = await api.get<AppSettingsResponse>(`/app-settings/${CUSTOM_GENERATION_PARAMETERS_SETTINGS_KEY}`);
      return parseManagedGenerationParameterDefinitions(response.value);
    },
  });
}

export function useSaveCustomGenerationParameters() {
  const queryClient = useQueryClient();
  return useMutation<ManagedGenerationParameterDefinition[], Error, ManagedGenerationParameterDefinition[]>({
    mutationFn: async (definitions) => {
      const normalized = parseManagedGenerationParameterDefinitions(definitions);
      const response = await api.put<AppSettingsResponse>(
        `/app-settings/${CUSTOM_GENERATION_PARAMETERS_SETTINGS_KEY}`,
        { value: JSON.stringify(normalized) },
      );
      return parseManagedGenerationParameterDefinitions(response.value);
    },
    onSuccess: (definitions) => {
      queryClient.setQueryData(customGenerationParameterKeys.all, definitions);
    },
  });
}
