import {
  customAgentActivationSettingsSchema,
  DEFAULT_CUSTOM_AGENT_ACTIVATION_THRESHOLD,
  estimateTextTokens,
  sliceTextToTokenBudget,
} from "@marinara-engine/shared";
import { normalizeAgentActivationScanDepth } from "../../routes/generate/agent-activation.js";
import type { NoulQuestion } from "../decision/system-one.client.js";
import { countMessagesSinceAgentRun } from "./agent-cadence.js";
import { logRateLimited } from "../../lib/log-rate-limit.js";
import {
  attachDecisionMedia,
  clampDecisionMediaWant,
  decisionMediaKey,
  NO_DECISION_MEDIA,
  wantsDecisionMedia,
  type DecisionMediaRef,
  type DecisionMediaWant,
} from "../decision/decision-media.js";

export interface ActivationQuestionCandidate {
  agentId: string;
  question: string;
  /** Undefined when the agent never chose one; the backend's default applies. */
  threshold: number | undefined;
  scanDepth: number;
  /** How many of the chat's newest pictures and clips the question looks at. None by default. */
  media?: DecisionMediaWant;
}
export interface DecisionMessage {
  role?: string | null;
  name?: string;
  content?: unknown;
  /** Pictures and clips on the message, for a decision model that reads them. Never serialized. */
  media?: DecisionMediaRef[];
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
    media: clampDecisionMediaWant({
      pictures: parsed.data.activationPictures,
      clips: parsed.data.activationClips,
    }),
    /** Ask only when one of this many newest messages has a picture or clip; otherwise the agent does not run. */
    mediaWithin: parsed.data.activationMediaWithin,
  };
}

/** What one picture and one clip cost in a decision model's input, in tokens. */
export interface DecisionMediaTokens {
  picture: number;
  clip: number;
}

/**
 * Fit serialized state, including role/name wrappers. Keep the newest message's suffix.
 *
 * With `media`, the newest pictures and clips of the kept messages ride along for a
 * decision model that reads them, and the scene leaves room for them in its budget.
 * Without it, none do: a decision looks at pictures only when its author asked.
 */
export function buildDecisionState(
  messages: DecisionMessage[],
  depth: number,
  maxStateTokens: number,
  media: { want: DecisionMediaWant; tokens?: DecisionMediaTokens } = { want: NO_DECISION_MEDIA },
) {
  const want = clampDecisionMediaWant(media.want);
  if (wantsDecisionMedia(want) && media.tokens)
    maxStateTokens = Math.max(
      Math.min(256, maxStateTokens),
      maxStateTokens - want.pictures * media.tokens.picture - want.clips * media.tokens.clip,
    );
  const window = messages.slice(-depth);
  const recent_messages = window.map((message) => ({
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
  // The media of the messages that made it into the scene, in the chat's order. A model
  // that reads them takes the newest of those asked for; every other backend never sees them.
  return attachDecisionMedia(
    state,
    window.slice(window.length - recent_messages.length).flatMap((message) => message.media ?? []),
    want,
  );
}

export async function evaluateActivationQuestions(args: {
  candidates: ActivationQuestionCandidate[];
  messages: DecisionMessage[];
  maxStateTokens: number;
  /** The selected model's operating point, for agents that never chose one. */
  defaultThreshold?: number;
  /** What a picture and a clip cost the selected model, so a scene leaves room for them. */
  mediaTokens?: DecisionMediaTokens;
  ask: (state: unknown, questions: NoulQuestion[]) => Promise<Map<string, number> | null>;
}): Promise<{ skip: Set<string>; results: Map<string, number | "failed"> }> {
  const fallbackThreshold = args.defaultThreshold ?? DEFAULT_CUSTOM_AGENT_ACTIVATION_THRESHOLD;
  // One request per scan depth and media setting: questions that read the same scene
  // with the same pictures share it.
  const groups = new Map<
    string,
    { depth: number; media: DecisionMediaWant; candidates: ActivationQuestionCandidate[] }
  >();
  for (const candidate of args.candidates) {
    const media = clampDecisionMediaWant(candidate.media);
    const key = `${candidate.scanDepth}\u0000${decisionMediaKey(media)}`;
    const group = groups.get(key) ?? { depth: candidate.scanDepth, media, candidates: [] };
    group.candidates.push(candidate);
    groups.set(key, group);
  }
  const skip = new Set<string>();
  const results = new Map<string, number | "failed">();
  await Promise.all(
    [...groups.values()].map(async ({ depth, media, candidates }) => {
      const questions = candidates.map((candidate) => ({ id: candidate.agentId, instructions: candidate.question }));
      // Reserve extra room for long/macro-expanded questions beyond the normal 500-token margin.
      const questionTokens = Math.max(...questions.map((question) => estimateTextTokens(question.instructions)));
      const budget = Math.max(1, args.maxStateTokens - Math.max(0, questionTokens - 250));
      const state = buildDecisionState(args.messages, depth, budget, { want: media, tokens: args.mediaTokens });
      let answers = new Map<string, number>();
      try {
        // Even the role/name wrappers may exceed a tiny user-selected budget.
        if (estimateTextTokens(JSON.stringify(state)) <= budget && questionTokens <= args.maxStateTokens + 250)
          answers = (await args.ask(state, questions)) ?? new Map();
      } catch (err) {
        // An injected transport must also fail open; every candidate below then reads "failed".
        // Non-fatal, and it can repeat every turn, so warn at most once per rate-limit window.
        logRateLimited(
          "warn",
          "agents.activation-questions.transport",
          err,
          "[agents] Activation question transport failed; failing open",
        );
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
