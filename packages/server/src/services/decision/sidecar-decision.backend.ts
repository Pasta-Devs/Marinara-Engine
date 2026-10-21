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
 * A chat-model Decision connection is asked exactly the same way, at the URL the user
 * entered and under the provider URL policy. A managed slot's requests never leave the
 * machine. Nothing throws: a target that cannot answer returns no answer for that
 * agent, and the gate runs it.
 */
import {
  DECISION_THINKING_MAX_TOKENS,
  DECISION_TIMEOUT_MS,
  type DecisionThinkingMode,
  type DecisionDebugReport,
  type DecisionDebugRequest,
} from "@marinara-engine/shared";
import { logRateLimited } from "../../lib/log-rate-limit.js";
import { logger, logDebugOverride } from "../../lib/logger.js";
import type { DecisionConnection } from "./decision-connection.js";
import {
  getAnswerStyle,
  recordDirectAnswer,
  recordOneTokenFailure,
  recordThinkingAnswer,
} from "./decision-thinking-cache.js";
import { whenDecisionServerFree } from "./decision-server-queue.js";
import { type ResolvedDecisionSlot } from "./decision-slots.js";
import { isDirectAnswer, readLogprobAnswer, readWordAnswer, type TopLogprob } from "./logprob-answer.js";
import { isRefusedFetch, postDecisionRequest, type NoulQuestion } from "./system-one.client.js";

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

interface SidecarDiagnostics {
  inspection?: DecisionDebugReport;
  debugMode?: boolean;
  onAnswer?: (id: string, answer: SidecarAnswer) => void;
  /** Why a request produced no usable answer, for the Test button. */
  onError?: (error: string) => void;
}

/**
 * Who answers: a managed local slot on loopback, or a chat-model Decision connection,
 * which brings its own URL, key and time limit.
 */
export type ChatDecisionTarget = Pick<
  ResolvedDecisionSlot,
  "baseUrl" | "serverSlots" | "model" | "modelIdentity" | "label" | "thinking"
> & { connection?: DecisionConnection };

/**
 * A chat-model Decision connection as a target.
 *
 * It has no Thinking setting of its own, so it runs on Auto, and the verdict is cached
 * per connection and model so changing either starts on the fast path again. How many
 * requests the user's server works on at once is unknown, so it is asked one at a
 * time: each statement's time limit then starts when the server takes it, rather than
 * running out while it waits behind the others.
 */
export function connectionChatTarget(id: string, label: string, connection: DecisionConnection): ChatDecisionTarget {
  return {
    baseUrl: "",
    serverSlots: 1,
    model: connection.model,
    modelIdentity: `connection:${id}:${connection.model}`,
    label,
    thinking: "auto",
    connection,
  };
}

/** Every caller asking the same server shares its queue. */
function serverKey(slot: ChatDecisionTarget): string {
  return slot.connection?.endpoint ?? slot.baseUrl;
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
  slot: ChatDecisionTarget,
  state: unknown,
  question: NoulQuestion,
  allowThinking: boolean,
  signal: AbortSignal | undefined,
  diagnostics: SidecarDiagnostics = {},
): Promise<SidecarAnswer | null> {
  const start = Date.now();
  const connection = slot.connection;
  const limit = connection?.timeoutMs ?? DECISION_TIMEOUT_MS.sidecar;
  const timeout = AbortSignal.timeout(allowThinking ? Math.max(limit, DECISION_TIMEOUT_MS.thinking) : limit);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const body: Record<string, unknown> = {
    model: slot.model,
    messages: buildMessages(state, question.instructions),
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
  let trace: DecisionDebugRequest | undefined;
  if (diagnostics.inspection) {
    trace = { protocol: "chat_logprobs", body };
    diagnostics.inspection.requests.push(trace);
    if (diagnostics.inspection.mode === "inspect") return null;
  }
  const debug = diagnostics.debugMode === true || process.env.DEBUG_AGENTS === "true";
  const source = connection ? "Chat connection" : "Local";
  logDebugOverride(debug, "[decision] %s request: %s", source, JSON.stringify(body));
  const finish = (answer: SidecarAnswer | null, error?: string) => {
    const result = {
      id: question.id,
      ...(answer?.probability != null
        ? answer.uncalibrated
          ? { yes: answer.probability === 1, binary: true }
          : { probability: answer.probability }
        : {}),
    };
    if (trace) Object.assign(trace, { results: [result], latencyMs: Date.now() - start, ...(error ? { error } : {}) });
    logDebugOverride(debug, "[decision] %s result: %s%s", source, JSON.stringify(result), error ? ` (${error})` : "");
    if (error) diagnostics.onError?.(error);
    // A gate asks on every turn, so a connection that stays down logs once per window.
    // A managed slot's own service already reports why it is down.
    if (!answer && error && error !== "cancelled" && connection)
      logRateLimited(
        "warn",
        `decision.chat-connection:${error}`,
        undefined,
        "[decision] Chat-model decision request failed: %s",
        error,
      );
    return answer;
  };
  let response: Response;
  try {
    response = connection
      ? await postDecisionRequest(connection.endpoint, connection.apiKey, body, combined)
      : await fetch(`${slot.baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: combined,
        });
  } catch (err) {
    return finish(
      null,
      signal?.aborted ? "cancelled" : timeout.aborted ? "timeout" : isRefusedFetch(err) ? err.message : "network",
    );
  }
  if (!response.ok) return finish(null, `http_${response.status}`);
  let payload: ChatCompletionResponse;
  try {
    payload = (await response.json()) as ChatCompletionResponse;
  } catch {
    return finish(null, "invalid_response");
  }
  const choice = payload.choices?.[0];
  const positions = choice?.logprobs?.content ?? [];
  const content = typeof choice?.message?.content === "string" ? choice.message.content : "";

  if (!allowThinking) {
    const reading = readLogprobAnswer(positions[0]?.top_logprobs);
    if (isDirectAnswer(reading)) return finish({ probability: reading.probability, direct: true, uncalibrated: false });
    // No log-probabilities at all is a runtime limitation rather than a model that
    // wants to think, so the single generated word still counts — uncalibrated.
    if (positions.length === 0) {
      const word = readWordAnswer(content);
      if (word !== null) return finish({ probability: word, direct: true, uncalibrated: true });
    }
    return finish({ probability: null, direct: false, uncalibrated: false }, "no_answer");
  }

  // In Allowed mode the answer is whatever the model said once its reasoning ended.
  // Prefer log-probabilities on a content position when the server separates them from
  // reasoning; otherwise the final word, which is 1 or 0 and says so.
  for (const position of positions) {
    const reading = readLogprobAnswer(position.top_logprobs);
    if (isDirectAnswer(reading)) return finish({ probability: reading.probability, direct: true, uncalibrated: false });
  }
  const word = readWordAnswer(content);
  return word === null
    ? finish({ probability: null, direct: false, uncalibrated: true }, "no_answer")
    : finish({ probability: word, direct: true, uncalibrated: true });
}

/**
 * Ask one question, honouring the slot's Thinking setting.
 *
 * Auto starts on the fast path and switches this model over once it has failed twice,
 * so a reasoning model costs two wasted one-token requests rather than one per turn
 * forever. Off never switches: a model that cannot answer that way fails open.
 */
async function askQuestion(
  slot: ChatDecisionTarget,
  state: unknown,
  question: NoulQuestion,
  signal: AbortSignal | undefined,
  diagnostics: SidecarDiagnostics = {},
): Promise<number | null> {
  const thinking: DecisionThinkingMode = slot.thinking;
  const known = getAnswerStyle(slot.modelIdentity);
  const allowThinking = thinking === "allowed" || (thinking === "auto" && known === "thinks");

  const answer = await askOnce(slot, state, question, allowThinking, signal, diagnostics);
  if (!answer) return null;
  diagnostics.onAnswer?.(question.id, answer);
  // An inspection must not teach Auto a different strategy for the next live turn.
  if (diagnostics.inspection) return answer.probability;

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
 * as many at a time as llama-server has slots, and the rest wait for one. Every
 * question shares the same state prefix, which is what makes that cheap.
 */
export async function askSidecarNoulQuestions(
  args: {
    slot: ChatDecisionTarget;
    state: unknown;
    questions: NoulQuestion[];
    signal?: AbortSignal;
  } & SidecarDiagnostics,
): Promise<Map<string, number>> {
  const answers = new Map<string, number>();
  await Promise.all(
    args.questions.map(async (question) => {
      // Each statement's time limit starts once the server can work on it, not while it
      // waits behind the others for one of llama-server's slots.
      const probability = await whenDecisionServerFree(serverKey(args.slot), args.slot.serverSlots, args.signal, () =>
        askQuestion(args.slot, args.state, question, args.signal, args),
      );
      if (probability !== null) answers.set(question.id, probability);
    }),
  );
  return answers;
}

/** The Test button's probe: one fixed question, reporting how the slot answered it. */
export async function probeDecisionSlot(
  slot: ChatDecisionTarget,
  signal?: AbortSignal,
): Promise<{
  probability: number | null;
  logprobs: boolean;
  answersDirectly: boolean;
  latencyMs: number;
  /** Why the last attempt gave no answer, when neither did. */
  error?: string;
}> {
  // Timed from when the server can take it, so a Test clicked during a busy turn
  // reports how long the model takes to answer, not how long it queued.
  return whenDecisionServerFree(serverKey(slot), slot.serverSlots, signal, () => probeOnce(slot, signal));
}

async function probeOnce(slot: ChatDecisionTarget, signal: AbortSignal | undefined) {
  const start = Date.now();
  let error: string | undefined;
  const diagnostics: SidecarDiagnostics = { onError: (reason) => (error = reason) };
  const state = { recent_messages: [{ role: "user", name: "User", content: "The door is open." }] };
  const question = { id: "probe", instructions: "The door is open." };
  const oneToken = await askOnce(slot, state, question, false, signal, diagnostics);
  if (oneToken?.direct && oneToken.probability !== null) {
    recordDirectAnswer(slot.modelIdentity, oneToken.uncalibrated);
    return {
      probability: oneToken.probability,
      logprobs: !oneToken.uncalibrated,
      answersDirectly: true,
      latencyMs: Date.now() - start,
    };
  }
  const thinking = await askOnce(slot, state, question, true, signal, diagnostics);
  if (thinking?.probability !== null && thinking !== null) {
    recordThinkingAnswer(slot.modelIdentity, thinking.uncalibrated);
    return {
      probability: thinking.probability,
      logprobs: !thinking.uncalibrated,
      answersDirectly: false,
      latencyMs: Date.now() - start,
    };
  }
  return { probability: null, logprobs: false, answersDirectly: false, latencyMs: Date.now() - start, error };
}
