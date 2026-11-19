// ──────────────────────────────────────────────
// React Query: the managed decision sidecar
// ──────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DecisionInstallProgress, DecisionSidecarSettings, SidecarLoadAssessment } from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { decisionKeys } from "./use-decision-model";

export interface DecisionSidecarModel {
  id: string;
  label: string;
  description: string;
  downloadSizeBytes: number;
  diskBytes: number;
  vramBytes: number;
  /** What `vramBytes` is weighed against: an NVIDIA card, system memory, or either (llama.cpp). */
  memory?: "nvidia" | "cpu" | "llama";
  runtime?: string;
  /** Plain words for the languages it was checked on, when known. */
  languages?: string | null;
  /** System One question types it answers: noul, choice, score, bbox. */
  questionTypes?: string[];
  /** What it reads here (text, image, video), and what its other release adds. */
  inputs?: string[];
  extraInputs?: string[];
  /** Seconds, from the speed it was timed at on this computer; null before it has run here. */
  speed?: { sceneSeconds: number; pictureSeconds?: number; clipSeconds?: number } | null;
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
  /** On disk and was working, but an engine update changed its uv, Python or lock. */
  runtimeNeedsUpdate?: boolean;
  /** Whether the installed model's weights are on disk and whole; null with no model installed. */
  installedModelDownloaded: boolean | null;
  process: { running: boolean; baseUrl: string | null; modelId: string | null; error: string | null };
  logPath: string;
  models: DecisionSidecarModel[];
  /** NVIDIA GPUs by `nvidia-smi` index, for the device picker. */
  devices: Array<{ index: number; name: string; totalBytes: number }>;
  /** The device the sidecar will use: the stored choice, else the default. */
  cudaDevice: number;
}

/** No decision model can run on this machine: unsupported, or every catalog model has the verdict "unsupported". */
export const decisionCannotRun = (data: DecisionSidecarStatus | undefined) =>
  !!data &&
  (!data.supported ||
    (data.models.length > 0 && data.models.every((model) => model.preflight.assessment.verdict === "unsupported")));

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
/** Not under the sidecar key: invalidating that after every change would restart its polling needlessly. */
const decisionInstallProgressKey = ["decision", "install-progress"] as const;

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

/**
 * What an install is downloading right now. Read once when the page opens, so a
 * download started earlier still shows its bar, then every 1.5 s while one runs.
 */
export function useDecisionInstallProgress(installing: boolean) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: decisionInstallProgressKey,
    queryFn: () => api.get<{ progress: DecisionInstallProgress | null }>("/decision/install-progress"),
    refetchInterval: (state) => (installing || state.state.data?.progress ? 1500 : false),
  });
  // When a download this page did not start finishes, nothing else re-reads the model
  // list, and the page would still offer to download what is now installed.
  const active = !!query.data?.progress;
  const wasActive = useRef(active);
  useEffect(() => {
    if (wasActive.current && !active) invalidate(qc);
    wasActive.current = active;
  }, [active, qc]);
  return query;
}

export function useCancelDecisionInstall() {
  return useMutation({
    mutationFn: () => api.post<{ cancelled: boolean }>("/decision/sidecar/cancel-install", {}),
  });
}

/** Rebuild a runtime an engine update left behind; the downloaded model stays. */
export function useUpdateDecisionRuntime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ updated: boolean }>("/decision/sidecar/update-runtime", {}),
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
          memory?: "nvidia" | "cpu" | "llama";
          licenses: string[];
          questionTypes?: string[];
          inputs?: string[];
          extraInputs?: string[];
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
