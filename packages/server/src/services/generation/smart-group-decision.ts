/**
 * Smart response order answered by the Decision model.
 *
 * The chat-model selector reads every candidate and returns a list of ids: one full
 * completion per turn to pick a speaker. This asks the Decision model one yes/no
 * question per candidate instead, then applies the selector's own rules on top, since
 * a per-candidate verdict cannot see the others: roleplay usually wants one speaker,
 * and the last speaker should not go again when someone else has a reason to.
 *
 * Everything here is pure, so the rules are pinned by a regression without a model.
 */
import { estimateTextTokens } from "@marinara-engine/shared";
import { buildDecisionState, type DecisionMessage } from "./agent-activation-questions.js";
import type { NoulQuestion } from "../decision/system-one.client.js";

export interface SmartOrderCandidate {
  id: string;
  name: string;
  status?: string;
  activity?: string;
  /** 0 to 100. */
  talkativeness?: number;
  /** Personality or description, already shortened. */
  about?: string;
}

/** The transcript the chat-model selector reads, so both paths judge the same turns. */
export const SMART_ORDER_TRANSCRIPT_DEPTH = 5;

/** Per candidate, so one long card cannot crowd the transcript out of the budget. */
const CANDIDATE_ABOUT_CHARS = 300;

/**
 * The state every question is asked against: the recent transcript and who could
 * answer. Shared by all questions, so a backend that caches a prefix reuses it.
 */
export function smartOrderState(
  messages: DecisionMessage[],
  candidates: SmartOrderCandidate[],
  maxStateTokens: number,
): Record<string, unknown> {
  const roster = candidates.map((candidate) => ({
    name: candidate.name,
    ...(candidate.status ? { status: candidate.status } : {}),
    ...(candidate.activity ? { activity: candidate.activity } : {}),
    ...(typeof candidate.talkativeness === "number" ? { talkativeness: candidate.talkativeness } : {}),
    ...(candidate.about ? { about: candidate.about.slice(0, CANDIDATE_ABOUT_CHARS) } : {}),
  }));
  // The roster's share comes off the transcript's budget, never the other way round:
  // a question about a candidate the model cannot see is meaningless.
  const rosterTokens = estimateTextTokens(JSON.stringify(roster));
  const transcript = buildDecisionState(
    messages,
    SMART_ORDER_TRANSCRIPT_DEPTH,
    Math.max(256, maxStateTokens - rosterTokens),
  );
  return { ...transcript, candidates: roster };
}

/** One question per candidate, keyed by character id. */
export function smartOrderQuestions(candidates: SmartOrderCandidate[]): NoulQuestion[] {
  return candidates.map((candidate) => ({
    id: candidate.id,
    instructions: `${candidate.name} has a natural, immediate reason to respond to the latest message.`,
  }));
}

/**
 * Turn per-candidate probabilities into a response queue.
 *
 * Returns null when the answers cannot support a choice (none came back), so the caller
 * falls back to the chat-model selector rather than guessing.
 */
export function chooseSmartResponders(args: {
  answers: Map<string, number>;
  /** In roster order, which is also the tie-break. */
  candidateIds: string[];
  lastSpeakerId: string | null;
  threshold: number;
  mode: "conversation" | "roleplay";
}): string[] | null {
  const scored = args.candidateIds
    .map((id, index) => ({ id, index, p: args.answers.get(id) }))
    .filter((entry): entry is { id: string; index: number; p: number } => typeof entry.p === "number")
    // Most likely first; roster order breaks a tie so the result is stable.
    .sort((a, b) => b.p - a.p || a.index - b.index);
  if (scored.length === 0) return null;

  const passing = scored.filter((entry) => entry.p >= args.threshold);
  // Not the same character twice in a row when anyone else has a reason to speak.
  const withoutRepeat = passing.filter((entry) => entry.id !== args.lastSpeakerId);
  const chosen = withoutRepeat.length > 0 ? withoutRepeat : passing;

  if (chosen.length === 0) {
    // Nobody cleared the threshold, but somebody has to answer the user. The most
    // likely candidate who did not just speak is a better pick than the first in the
    // roster, which is what the plain fallback would take.
    const best = scored.find((entry) => entry.id !== args.lastSpeakerId) ?? scored[0]!;
    return [best.id];
  }
  // Roleplay usually wants exactly one speaker; Conversation lets everyone with a
  // reason reply, most likely first.
  return args.mode === "roleplay" ? [chosen[0]!.id] : chosen.map((entry) => entry.id);
}
