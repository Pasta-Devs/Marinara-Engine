// ──────────────────────────────────────────────
// Hook: Oracle Config & Test
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import type { OracleConfig, OracleTestResponse } from "@marinara-engine/shared";
import { ORACLE_API_KEY_MASK } from "@marinara-engine/shared";

const KEYS = {
  config: ["oracle", "config"] as const,
};

export function useOracleConfig() {
  return useQuery({
    queryKey: KEYS.config,
    queryFn: () => api.get<OracleConfig>("/oracle/config"),
    staleTime: 60_000,
  });
}

export function useUpdateOracleConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: OracleConfig) => api.put<void>("/oracle/config", config),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.config });
    },
  });
}

export function useTestOracleConnection() {
  return useMutation({
    mutationFn: () => api.post<OracleTestResponse>("/oracle/test", {}),
  });
}

export { ORACLE_API_KEY_MASK };
