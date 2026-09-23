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
  /** NVIDIA GPUs by `nvidia-smi` index, for the device picker. */
  devices: Array<{ index: number; name: string; totalBytes: number }>;
  /** The device the sidecar will use: the stored choice, else the default. */
  cudaDevice: number;
}

export const decisionSidecarKey = [...decisionKeys.all, "sidecar"] as const;

export function useDecisionSidecar(enabled = true) {
  return useQuery({
    queryKey: decisionSidecarKey,
    queryFn: () => api.get<DecisionSidecarStatus>("/decision/sidecar"),
    enabled,
    // Each call runs a preflight, which reads a cached GPU probe rather than
    // probing, so this is cheap; it still does not need to be live.
    staleTime: 15_000,
    // Re-read whenever the panel is opened. The verdict describes how much of the
    // card is free, which a game or a model load can change between two visits, and
    // a stale "recommended" is the one thing this dialog must not show.
    refetchOnMount: "always",
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
          licenses: string[];
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

export function useSetDecisionDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cudaDevice: number | null) =>
      api.post<{ settings: DecisionSidecarSettings }>("/decision/sidecar/device", { cudaDevice }),
    // The verdicts are about the chosen card, so they are re-read with it.
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
