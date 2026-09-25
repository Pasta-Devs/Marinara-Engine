import {
  customAgentActivationSettingsSchema,
  DEFAULT_CUSTOM_AGENT_ACTIVATION_THRESHOLD,
  estimateTextTokens,
  sliceTextToTokenBudget,
} from "@marinara-engine/shared";
import { normalizeAgentActivationScanDepth } from "../../routes/generate/agent-activation.js";
import type { NoulQuestion } from "../decision/system-one.client.js";
import { countMessagesSinceAgentRun } from "./agent-cadence.js";

export interface ActivationQuestionCandidate {
  agentId: string;
  question: string;
  /** Undefined when the agent never chose one; the backend's default applies. */
  threshold: number | undefined;
  scanDepth: number;
}
export interface DecisionMessage {
  role?: string | null;
  name?: string;
  content?: unknown;
}

/** A missing run or removed anchor is stale: bootstrap the agent instead of gating it forever. */
export function bypassActivationQuestion(
  maxSkip: number | undefined,
  lastMessageId: string | null | undefined,
  messages: Array<{ id?: string | null; role?: string | null }>,
  upcoming = false,
): boolean {
  if (!maxSkip) return false;
  const count = countMessagesSinceAgentRun(messages, lastMessageId, upcoming);
  return count === null || count >= maxSkip;
}

export function activationQuestionSettings(settings: Record<string, unknown>) {
  const parsed = customAgentActivationSettingsSchema.safeParse(settings);
  if (!parsed.success || !parsed.data.activationQuestion) return null;
  return {
    question: parsed.data.activationQuestion,
    // Deliberately not collapsed to a constant here. Probabilities are not comparable
    // across decision models, so an unset threshold has to reach the resolved backend
    // and take that model's operating point rather than a global 0.5.
    threshold: parsed.data.activationThreshold,
    maxSkip: parsed.data.activationMaxSkip,
    scanDepth: normalizeAgentActivationScanDepth(parsed.data.activationScanDepth),
  };
}

/** Fit serialized state, including role/name wrappers. Keep the newest message's suffix. */
export function buildDecisionState(messages: DecisionMessage[], depth: number, maxStateTokens: number) {
  const recent_messages = messages.slice(-depth).map((message) => ({
    role: message.role ?? "user",
    ...(message.name ? { name: message.name } : {}),
    content: typeof message.content === "string" ? message.content : "",
  }));
  const state = { recent_messages };
  while (recent_messages.length > 1 && estimateTextTokens(JSON.stringify(state)) > maxStateTokens)
    recent_messages.shift();
  const newest = recent_messages[0];
  if (newest && estimateTextTokens(JSON.stringify(state)) > maxStateTokens) {
    const original = newest.content;
    newest.content = "";
    // JSON escaping can expand content, so verify the serialized result after truncation.
    let budget = Math.max(0, maxStateTokens - estimateTextTokens(JSON.stringify(state)));
    newest.content = sliceTextToTokenBudget(original, budget, true);
    while (budget > 0 && estimateTextTokens(JSON.stringify(state)) > maxStateTokens) {
      budget = Math.max(0, budget - Math.max(1, estimateTextTokens(JSON.stringify(state)) - maxStateTokens));
      newest.content = sliceTextToTokenBudget(original, budget, true);
    }
  }
  return state;
}

export async function evaluateActivationQuestions(args: {
  candidates: ActivationQuestionCandidate[];
  messages: DecisionMessage[];
  maxStateTokens: number;
  /** The selected model's operating point, for agents that never chose one. */
  defaultThreshold?: number;
  ask: (state: unknown, questions: NoulQuestion[]) => Promise<Map<string, number> | null>;
}): Promise<{ skip: Set<string>; results: Map<string, number | "failed"> }> {
  const fallbackThreshold = args.defaultThreshold ?? DEFAULT_CUSTOM_AGENT_ACTIVATION_THRESHOLD;
  const groups = new Map<number, ActivationQuestionCandidate[]>();
  for (const candidate of args.candidates) {
    const group = groups.get(candidate.scanDepth) ?? [];
    group.push(candidate);
    groups.set(candidate.scanDepth, group);
  }
  const skip = new Set<string>();
  const results = new Map<string, number | "failed">();
  await Promise.all(
    [...groups].map(async ([depth, candidates]) => {
      const questions = candidates.map((candidate) => ({ id: candidate.agentId, instructions: candidate.question }));
      // Reserve extra room for long/macro-expanded questions beyond the normal 500-token margin.
      const questionTokens = Math.max(...questions.map((question) => estimateTextTokens(question.instructions)));
      const budget = Math.max(1, args.maxStateTokens - Math.max(0, questionTokens - 250));
      const state = buildDecisionState(args.messages, depth, budget);
      let answers = new Map<string, number>();
      try {
        // Even the role/name wrappers may exceed a tiny user-selected budget.
        if (estimateTextTokens(JSON.stringify(state)) <= budget && questionTokens <= args.maxStateTokens + 250)
          answers = (await args.ask(state, questions)) ?? new Map();
      } catch {
        /* An injected transport must also fail open. */
      }
      for (const candidate of candidates) {
        const probability = answers.get(candidate.agentId);
        if (typeof probability !== "number" || !Number.isFinite(probability) || probability < 0 || probability > 1) {
          results.set(candidate.agentId, "failed");
        } else {
          results.set(candidate.agentId, probability);
          if (probability < (candidate.threshold ?? fallbackThreshold)) skip.add(candidate.agentId);
        }
      }
    }),
  );
  return { skip, results };
}
