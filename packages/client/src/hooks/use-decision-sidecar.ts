// ──────────────────────────────────────────────
// React Query: the managed decision sidecar
// ──────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DecisionSidecarSettings, SidecarLoadAssessment } from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { decisionKeys } from "./use-decision-model";

export interface DecisionSidecarModel {
  id: string;
  label: string;
  description: string;
  downloadSizeBytes: number;
  diskBytes: number;
  vramBytes: number;
  licenses: string[];
  downloaded: boolean;
  preflight: {
    modelId: string;
    assessment: SidecarLoadAssessment;
    /** One sentence naming the obstacle, or null when there is none. */
    reason: string | null;
    installable: boolean;
  };
}

export interface DecisionSidecarStatus {
  supported: boolean;
  unsupportedReason: string | null;
  settings: DecisionSidecarSettings;
  runtimeInstalled: boolean;
  process: { running: boolean; baseUrl: string | null; modelId: string | null; error: string | null };
  logPath: string;
  models: DecisionSidecarModel[];
}

export const decisionSidecarKey = [...decisionKeys.all, "sidecar"] as const;

export function useDecisionSidecar() {
  return useQuery({
    queryKey: decisionSidecarKey,
    queryFn: () => api.get<DecisionSidecarStatus>("/decision/sidecar"),
    // Each call runs a preflight, which reads a cached GPU probe rather than
    // probing, so this is cheap; it still does not need to be live.
    staleTime: 15_000,
  });
}

/** Anything that changes the sidecar also changes what the model dropdown offers. */
function invalidate(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: decisionSidecarKey });
  void qc.invalidateQueries({ queryKey: decisionKeys.options() });
}

export function useEnableDecisionSidecar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { enabled: boolean; confirmedVerdict?: string }) =>
      api.post<{ settings: DecisionSidecarSettings }>("/decision/sidecar/enable", input),
    onSuccess: () => invalidate(qc),
  });
}

export function useInstallDecisionModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (modelId: string) =>
      api.post<{ settings: DecisionSidecarSettings }>("/decision/sidecar/install", { modelId }),
    onSuccess: () => invalidate(qc),
  });
}

export function useRemoveDecisionSidecar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ settings: DecisionSidecarSettings }>("/decision/sidecar/remove", {}),
    onSuccess: () => invalidate(qc),
  });
}

/** Look at a pasted repository without installing it. */
export function useInspectDecisionRepo() {
  return useMutation({
    mutationFn: (input: { repoId: string; revision?: string }) =>
      api.post<{
        refusal?: string;
        revision?: string | null;
        model?: {
          id: string;
          label: string;
          downloadSizeBytes: number;
          diskBytes: number;
          vramBytes: number;
          artifacts: Array<{ repoId: string; revision: string }>;
        };
        preflight?: DecisionSidecarModel["preflight"];
      }>("/decision/sidecar/inspect", input),
  });
}

export function useInstallDecisionRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { repoId: string; revision?: string }) =>
      api.post<{ settings: DecisionSidecarSettings }>("/decision/sidecar/install", input),
    onSuccess: () => invalidate(qc),
  });
}

export function useSetDecisionStartPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (startPolicy: DecisionSidecarSettings["startPolicy"]) =>
      api.post<{ settings: DecisionSidecarSettings }>("/decision/sidecar/start-policy", { startPolicy }),
    onSuccess: () => invalidate(qc),
  });
}
