import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { coreModulesApi } from "../../../../shared/api/core-modules-api";
import { coreModuleViews, enabledCoreModuleStyles, isCoreModuleEnabled } from "../lib/core-module-registry";

const DEFAULT_CORE_MODULE_SETTINGS = { enabled: {} };

const coreModuleKeys = {
  all: ["core-modules"] as const,
  settings: () => [...coreModuleKeys.all, "settings"] as const,
};

function useCoreModuleSettings() {
  return useQuery({
    queryKey: coreModuleKeys.settings(),
    queryFn: coreModulesApi.settings.get,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useCoreModules() {
  const query = useCoreModuleSettings();
  return {
    ...query,
    data: coreModuleViews(query.data ?? DEFAULT_CORE_MODULE_SETTINGS),
  };
}

export function useEnabledCoreModuleStyles() {
  const query = useCoreModuleSettings();
  return {
    ...query,
    data: query.data ? enabledCoreModuleStyles(query.data) : undefined,
  };
}

export function useIsCoreModuleEnabled(moduleId: string) {
  const query = useCoreModuleSettings();
  return {
    ...query,
    data: query.data ? isCoreModuleEnabled(moduleId, query.data) : false,
  };
}

export function useSetCoreModuleEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, enabled }: { moduleId: string; enabled: boolean }) =>
      coreModulesApi.settings.setEnabled(moduleId, enabled),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: coreModuleKeys.all });
    },
  });
}
