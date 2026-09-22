/**
 * Asking a local chat model the same yes/no question System One answers.
 *
 * One chat completion per question, with `max_tokens: 1`, and the probability read out
 * of the first token's log-probabilities. No grammar or `json_schema` constraint: a
 * constraint can change what `top_logprobs` reports, and the prompt plus a one-token
 * budget is already enough.
 *
 * The shared state goes first and the question last, so llama-server's prompt cache is
 * reused across every question of one group.
 *
 * Nothing here leaves the machine, and nothing throws: a slot that cannot answer
 * returns no answer for that agent, and the gate runs it.
 */
import { DECISION_THINKING_MAX_TOKENS, DECISION_TIMEOUT_MS, type DecisionThinkingMode } from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import {
  getAnswerStyle,
  recordDirectAnswer,
  recordOneTokenFailure,
  recordThinkingAnswer,
} from "./decision-thinking-cache.js";
import { type ResolvedDecisionSlot } from "./decision-slots.js";
import { isDirectAnswer, readLogprobAnswer, readWordAnswer, type TopLogprob } from "./logprob-answer.js";
import type { NoulQuestion } from "./system-one.client.js";

const SYSTEM_PROMPT =
  "You answer one question about the conversation below. Reply with exactly one word: yes or no. Do not explain, and do not write anything else.";

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: unknown; reasoning_content?: unknown };
    logprobs?: { content?: Array<{ token?: unknown; logprob?: unknown; top_logprobs?: TopLogprob[] }> };
  }>;
}

/** What one question's request concluded, before it becomes a probability or a skip. */
export interface SidecarAnswer {
  probability: number | null;
  /** True when the model produced a usable one-token answer. */
  direct: boolean;
  /** True when the probability is really a 1 or a 0, so a threshold has nothing to grip. */
  uncalibrated: boolean;
}

function buildMessages(state: unknown, question: string) {
  const rendered = typeof state === "string" ? state : JSON.stringify(state);
  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "user" as const, content: `Conversation:\n${rendered}\n\nQuestion: ${question}` },
  ];
}

/**
 * One request against a slot.
 *
 * `allowThinking` decides whether the reasoning-off fields are sent at all. In Allowed
 * mode they are omitted entirely rather than set to true, so the request behaves the
 * way the user's own chats do with that model.
 */
async function askOnce(
  slot: ResolvedDecisionSlot,
  state: unknown,
  question: string,
  allowThinking: boolean,
  signal: AbortSignal | undefined,
): Promise<SidecarAnswer | null> {
  const timeout = AbortSignal.timeout(allowThinking ? DECISION_TIMEOUT_MS.thinking : DECISION_TIMEOUT_MS.sidecar);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const body: Record<string, unknown> = {
    model: slot.model,
    messages: buildMessages(state, question),
    max_tokens: allowThinking ? DECISION_THINKING_MAX_TOKENS : 1,
    temperature: 0,
    // openai.provider.ts drops both of these unless they are set explicitly, and the
    // whole method depends on them, so they are always sent here.
    logprobs: true,
    top_logprobs: 10,
    stream: false,
  };
  if (!allowThinking) {
    // Per-request only. Neither field changes the slot's configuration or the user's
    // normal chats, and neither is trusted to have worked: the answer is inspected.
    body.reasoning_format = "none";
    body.chat_template_kwargs = { enable_thinking: false };
  }
  let response: Response;
  try {
    response = await fetch(`${slot.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: combined,
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  let payload: ChatCompletionResponse;
  try {
    payload = (await response.json()) as ChatCompletionResponse;
  } catch {
    return null;
  }
  const choice = payload.choices?.[0];
  const positions = choice?.logprobs?.content ?? [];
  const content = typeof choice?.message?.content === "string" ? choice.message.content : "";

  if (!allowThinking) {
    const reading = readLogprobAnswer(positions[0]?.top_logprobs);
    if (isDirectAnswer(reading)) return { probability: reading.probability, direct: true, uncalibrated: false };
    // No log-probabilities at all is a runtime limitation rather than a model that
    // wants to think, so the single generated word still counts — uncalibrated.
    if (positions.length === 0) {
      const word = readWordAnswer(content);
      if (word !== null) return { probability: word, direct: true, uncalibrated: true };
    }
    return { probability: null, direct: false, uncalibrated: false };
  }

  // In Allowed mode the answer is whatever the model said once its reasoning ended.
  // Prefer log-probabilities on a content position when the server separates them from
  // reasoning; otherwise the final word, which is 1 or 0 and says so.
  for (const position of positions) {
    const reading = readLogprobAnswer(position.top_logprobs);
    if (isDirectAnswer(reading)) return { probability: reading.probability, direct: true, uncalibrated: false };
  }
  const word = readWordAnswer(content);
  return word === null
    ? { probability: null, direct: false, uncalibrated: true }
    : { probability: word, direct: true, uncalibrated: true };
}

/**
 * Ask one question, honouring the slot's Thinking setting.
 *
 * Auto starts on the fast path and switches this model over once it has failed twice,
 * so a reasoning model costs two wasted one-token requests rather than one per turn
 * forever. Off never switches: a model that cannot answer that way fails open.
 */
async function askQuestion(
  slot: ResolvedDecisionSlot,
  state: unknown,
  question: NoulQuestion,
  signal: AbortSignal | undefined,
): Promise<number | null> {
  const thinking: DecisionThinkingMode = slot.thinking;
  const known = getAnswerStyle(slot.modelIdentity);
  const allowThinking = thinking === "allowed" || (thinking === "auto" && known === "thinks");

  const answer = await askOnce(slot, state, question.instructions, allowThinking, signal);
  if (!answer) return null;

  if (allowThinking) {
    if (answer.probability === null) return null;
    recordThinkingAnswer(slot.modelIdentity, answer.uncalibrated);
    return answer.probability;
  }
  if (answer.direct && answer.probability !== null) {
    recordDirectAnswer(slot.modelIdentity, answer.uncalibrated);
    return answer.probability;
  }
  // The model did not answer in one token. The verdict goes in the per-model cache,
  // not in the user's Thinking setting: the cache key carries the loaded model's
  // identity, so swapping to a well-behaved model returns to the fast path by itself,
  // and the three-way setting stays the user's own choice.
  const exhausted = recordOneTokenFailure(slot.modelIdentity);
  if (exhausted && thinking === "auto")
    logger.warn(
      "[decision] %s cannot answer in one token; allowing it to think first. Decisions will be slower.",
      slot.label,
    );
  return null;
}

/**
 * Answer a group of questions against one slot.
 *
 * There is no single parallel pass as with System One, so the group's questions go out
 * concurrently and llama-server's own slots serve them. Every question shares the same
 * state prefix, which is what makes that cheap.
 */
export async function askSidecarNoulQuestions(args: {
  slot: ResolvedDecisionSlot;
  state: unknown;
  questions: NoulQuestion[];
  signal?: AbortSignal;
}): Promise<Map<string, number>> {
  const answers = new Map<string, number>();
  await Promise.all(
    args.questions.map(async (question) => {
      const probability = await askQuestion(args.slot, args.state, question, args.signal);
      if (probability !== null) answers.set(question.id, probability);
    }),
  );
  return answers;
}

/** The Test button's probe: one fixed question, reporting how the slot answered it. */
export async function probeDecisionSlot(
  slot: ResolvedDecisionSlot,
  signal?: AbortSignal,
): Promise<{
  probability: number | null;
  logprobs: boolean;
  answersDirectly: boolean;
  latencyMs: number;
}> {
  const start = Date.now();
  const state = { recent_messages: [{ role: "user", name: "User", content: "The door is open." }] };
  const oneToken = await askOnce(slot, state, "The door is open.", false, signal);
  if (oneToken?.direct && oneToken.probability !== null) {
    recordDirectAnswer(slot.modelIdentity, oneToken.uncalibrated);
    return {
      probability: oneToken.probability,
      logprobs: !oneToken.uncalibrated,
      answersDirectly: true,
      latencyMs: Date.now() - start,
    };
  }
  const thinking = await askOnce(slot, state, "The door is open.", true, signal);
  if (thinking?.probability !== null && thinking !== null) {
    recordThinkingAnswer(slot.modelIdentity, thinking.uncalibrated);
    return {
      probability: thinking.probability,
      logprobs: !thinking.uncalibrated,
      answersDirectly: false,
      latencyMs: Date.now() - start,
    };
  }
  return { probability: null, logprobs: false, answersDirectly: false, latencyMs: Date.now() - start };
}
