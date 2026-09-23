// ──────────────────────────────────────────────
// React Query: the Decision model setting
// ──────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  DecisionCalibration,
  DecisionLocalSlot,
  DecisionModelOptions,
  DecisionThinkingMode,
} from "@marinara-engine/shared";
import { DEFAULT_DECISION_CALIBRATION } from "@marinara-engine/shared";
import { api } from "../lib/api-client";
import { connectionKeys } from "./use-connections";

export const decisionKeys = {
  all: ["decision"] as const,
  options: () => [...decisionKeys.all, "options"] as const,
  thinkingPreGeneration: () => [...decisionKeys.all, "thinking-pregeneration"] as const,
  smartOrder: () => [...decisionKeys.all, "smart-order"] as const,
  promptQuestionLimit: () => [...decisionKeys.all, "prompt-question-limit"] as const,
};

/**
 * Every entry the Decision model dropdown offers, including the ones that cannot
 * serve. The server decides what is offerable so the list and the stored choice
 * cannot disagree, and so a reason is available for each greyed-out row.
 */
export function useDecisionOptions(enabled = true) {
  return useQuery({
    queryKey: decisionKeys.options(),
    queryFn: () => api.get<DecisionModelOptions>("/decision/options"),
    staleTime: 15_000,
    enabled,
  });
}

/** True once any decision model is chosen, which is what enables the editor fields. */
export function useHasDecisionModel(): boolean {
  return !!useDecisionOptions().data?.selected;
}

/**
 * The selected model's operating point, for seeding a new question's threshold.
 *
 * Falls back to the documented default until the options load, so the editor never
 * shows a blank slider.
 */
export function useDecisionCalibration(): DecisionCalibration {
  return useDecisionOptions().data?.calibration ?? DEFAULT_DECISION_CALIBRATION;
}

export function useSelectDecisionModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | null) => api.post<{ selected: string | null }>("/decision/select", { id }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: decisionKeys.options() });
      // Selecting a connection flips its own defaultForAgents flag, so the
      // connections list is stale too.
      void qc.invalidateQueries({ queryKey: connectionKeys.list() });
    },
  });
}

export function useSetDecisionThinking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { slot: DecisionLocalSlot; thinking: DecisionThinkingMode }) =>
      api.post("/decision/thinking", input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: decisionKeys.options() }),
  });
}

export interface DecisionSlotTestResult {
  success: boolean;
  decisionProbability?: number;
  latencyMs: number;
  logprobs?: boolean;
  answersDirectly?: boolean;
  errorCode?: string;
}

/** Test a local entry, which has no connection form and so no Test button of its own. */
export function useTestDecisionSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slot: DecisionLocalSlot) => api.post<DecisionSlotTestResult>("/decision/test", { slot }),
    // A probe records what the model turned out to do, so the entry's reported
    // answer style may have changed.
    onSettled: () => void qc.invalidateQueries({ queryKey: decisionKeys.options() }),
  });
}

export function useThinkingPreGeneration() {
  return useQuery({
    queryKey: decisionKeys.thinkingPreGeneration(),
    queryFn: () => api.get<{ enabled: boolean }>("/decision/thinking-pregeneration"),
    staleTime: 60_000,
  });
}

export function useSetThinkingPreGeneration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => api.post("/decision/thinking-pregeneration", { enabled }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: decisionKeys.thinkingPreGeneration() }),
  });
}

export function useDecisionSmartOrder() {
  return useQuery({
    queryKey: decisionKeys.smartOrder(),
    queryFn: () => api.get<{ enabled: boolean }>("/decision/smart-order"),
    staleTime: 60_000,
  });
}

export function useSetDecisionSmartOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => api.post("/decision/smart-order", { enabled }),
    onSettled: () => void qc.invalidateQueries({ queryKey: decisionKeys.smartOrder() }),
  });
}

export function useDecisionPromptQuestionLimit() {
  return useQuery({
    queryKey: decisionKeys.promptQuestionLimit(),
    queryFn: () =>
      api.get<{ limit: number; defaultLimit: number; maxLimit: number }>("/decision/prompt-question-limit"),
    staleTime: 60_000,
  });
}

export function useSetDecisionPromptQuestionLimit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (limit: number) => api.post("/decision/prompt-question-limit", { limit }),
    onSettled: () => void qc.invalidateQueries({ queryKey: decisionKeys.promptQuestionLimit() }),
  });
}
