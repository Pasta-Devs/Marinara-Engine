import {
  DECISION_PROMPT_QUESTION_LIMIT_SETTINGS_KEY,
  MAX_CUSTOM_AGENT_ACTIVATION_QUESTION_LENGTH,
  parseDecisionPromptQuestionLimit,
  type CapabilityDecisionHost,
  type CapabilityDecisionRequest,
} from "@marinara-engine/shared";
import { isDebugAgentsEnabled } from "../../config/runtime-config.js";
import type { DB } from "../../db/connection.js";
import {
  DECISION_SETTINGS_KEYS,
  answersAskedFor,
  resolveDecisionBackend,
  type DecisionBackend,
} from "../decision/decision-default.js";
import type { NoulQuestion } from "../decision/system-one.client.js";
import { buildDecisionState } from "../generation/agent-activation-questions.js";
import { createAppSettingsStorage } from "../storage/app-settings.storage.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";

const MAX_DECISION_MESSAGES = 200;
const MAX_DECISION_CONTEXT_CHARACTERS = 200_000;
const MAX_DECISION_NAME_CHARACTERS = 100;

type ResolveBackend = (request: CapabilityDecisionRequest) => Promise<DecisionBackend | null>;

function invalid(message: string): never {
  throw new TypeError(`Invalid decision request: ${message}`);
}

/** Validate a package's request at the trust boundary and map it to the backend's questions. */
function readQuestions(request: CapabilityDecisionRequest, limit: number): NoulQuestion[] {
  if (!Array.isArray(request?.messages) || request.messages.length > MAX_DECISION_MESSAGES)
    invalid(`messages must be an array of at most ${MAX_DECISION_MESSAGES}`);
  let characters = 0;
  for (const message of request.messages) {
    if (typeof message?.content !== "string") invalid("every message needs string content");
    if (message.role !== "system" && message.role !== "user" && message.role !== "assistant")
      invalid("message roles must be system, user or assistant");
    // A name survives state trimming whole, so it must stay small enough to always fit.
    if (
      message.name !== undefined &&
      (typeof message.name !== "string" || message.name.length > MAX_DECISION_NAME_CHARACTERS)
    )
      invalid(`message names must be strings of at most ${MAX_DECISION_NAME_CHARACTERS} characters`);
    characters += message.content.length;
  }
  if (characters > MAX_DECISION_CONTEXT_CHARACTERS)
    invalid(`messages may hold at most ${MAX_DECISION_CONTEXT_CHARACTERS} characters`);
  if (!Array.isArray(request.questions) || request.questions.length === 0) invalid("questions must not be empty");
  const ids = new Set<string>();
  const questions = request.questions.map(({ id, question, options }) => {
    // The backend joins ids and option indexes with NUL, so an id may not carry one.
    if (typeof id !== "string" || !id || id.includes("\u0000") || ids.has(id)) invalid("ids must be unique strings");
    ids.add(id);
    const text = typeof question === "string" ? question.trim() : "";
    if (!text || text.length > MAX_CUSTOM_AGENT_ACTIVATION_QUESTION_LENGTH)
      invalid(`question "${id}" must be 1-${MAX_CUSTOM_AGENT_ACTIVATION_QUESTION_LENGTH} characters`);
    if (options === undefined) return { id, instructions: text };
    const clean = Array.isArray(options)
      ? options.map((option) => (typeof option === "string" ? option.trim() : ""))
      : [];
    if (
      clean.length < 2 ||
      clean.some((option) => !option || option.length > MAX_CUSTOM_AGENT_ACTIVATION_QUESTION_LENGTH)
    )
      invalid(`question "${id}" needs at least two non-empty options`);
    return { id, instructions: text, options: clean };
  });
  // The user's per-turn limit bounds the cost of one request, the same as for prompt conditionals.
  if (answersAskedFor(questions) > limit)
    invalid(`asks for more than the user's limit of ${limit} answers (each Choice option counts once, plus one)`);
  return questions;
}

export function createCapabilityDecisionHost(db: DB, resolveBackend?: ResolveBackend): CapabilityDecisionHost {
  const appSettings = createAppSettingsStorage(db);
  const connections = createConnectionsStorage(db);
  const resolve: ResolveBackend =
    resolveBackend ??
    ((request) =>
      resolveDecisionBackend(
        {
          getLocalDefault: () => appSettings.get(DECISION_SETTINGS_KEYS.localDefault),
          getThinkingPreGeneration: async () => false,
          getDefaultConnection: () => connections.getDefaultForDecision(),
          getConnectionWithKey: (id) => connections.getWithKey(id),
          debugMode: request.debugMode || isDebugAgentsEnabled(),
        },
        request.signal,
      ));
  return Object.freeze({
    async evaluate(request: CapabilityDecisionRequest) {
      const limit = parseDecisionPromptQuestionLimit(
        await appSettings.get(DECISION_PROMPT_QUESTION_LIMIT_SETTINGS_KEY),
      );
      const questions = readQuestions(request, limit);
      const backend = await resolve(request);
      if (!backend) return null;
      const state = buildDecisionState(request.messages, request.messages.length, backend.maxStateTokens);
      const result = await backend.askMixed(state, questions);
      // The backends fail open with empty maps; no answer at all means the model was not reached.
      if (result.answers.size === 0 && result.choices.size === 0) return null;
      return {
        model: backend.model ?? null,
        answers: Object.fromEntries(result.answers),
        choices: Object.fromEntries(result.choices),
        threshold: backend.calibration.defaultThreshold,
      };
    },
  });
}
