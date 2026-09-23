/**
 * Decision statements in prompt conditionals: `{{#if decision:"..."}}` and
 * `{{#if decision_choice:"..." == "option"}}`.
 *
 * The macro engine is synchronous, so a statement cannot be asked while a condition is
 * evaluated. Instead the turn's statements are found in the raw prompt sources first,
 * asked in one batch, and handed to the engine as answers. The engine then looks each
 * one up wherever it is evaluated: a preset section, a card field, a group block, a
 * per-responder pass, a lorebook entry. A statement with no answer reads as false, so a
 * prompt with no Decision model behaves exactly as it did before this existed.
 *
 * Answers are cached for the turn, so a regeneration, a swipe and Peek Prompt all see
 * the same branches, and the model is only asked again when a new message arrives.
 */
import { createHash } from "node:crypto";
import {
  collectDecisionQuestions,
  decisionLocalSlotForId,
  DEFAULT_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH,
  normalizeDecisionQuestion,
  resolveDecisionQuestionText,
  resolveDecisionQuestionVariants,
  type MacroContext,
  type MacroDecisionAnswers,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { buildDecisionState, type DecisionMessage } from "../generation/agent-activation-questions.js";
import type { DecisionBackend } from "./decision-default.js";
import { describeDecisionSlot } from "./decision-slots.js";
import type { LorebookDecisionResolver } from "../lorebook/index.js";
import { DECISION_CHOICE_NONE, type NoulQuestion } from "./system-one.client.js";

export interface PlannedDecision {
  kind: "noul" | "choice";
  /** The statement with its macros resolved: the key its answer is stored under. */
  key: string;
  /** For a Choice statement, every option it is compared with anywhere this turn. */
  options: string[];
}

export interface PromptDecisionPlan {
  decisions: PlannedDecision[];
  /** Statements past the per-turn limit. They read as false and are logged. */
  dropped: string[];
}

/** Whether any text could hold a decision statement, before paying for a full parse. */
export function mayContainDecisions(text: unknown): text is string {
  return typeof text === "string" && /decision(?:_choice)?\s*:/iu.test(text);
}

/**
 * Every string inside `value` that could hold a decision statement.
 *
 * A walk rather than a field list, so a preset section, a choice block's option, a card
 * field or a lorebook entry is found wherever it keeps its text. Bounded in depth and in
 * count so a very large structure cannot stall a turn.
 */
export function collectDecisionTexts(value: unknown, out: string[] = [], depth = 0): string[] {
  if (out.length >= 5_000 || depth > 8) return out;
  if (typeof value === "string") {
    if (mayContainDecisions(value)) out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectDecisionTexts(item, out, depth + 1);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectDecisionTexts(item, out, depth + 1);
  }
  return out;
}

/** The pieces of a turn that can hold decision statements, most important first. */
export interface TurnDecisionSources {
  /** Preset sections, groups and choice blocks, when the turn uses a preset. */
  preset?: unknown;
  ctx: MacroContext;
  extra?: unknown[];
  lorebookEntries?: Array<{ content?: unknown }>;
}

/**
 * Every text this turn resolves that could hold a decision statement. Generation and
 * Peek Prompt both call this, so they plan the same statements from the same sources.
 * Order matters: past the per-turn limit, the last statements found read as no.
 */
export function collectTurnDecisionTexts(sources: TurnDecisionSources): string[] {
  const texts: string[] = [];
  if (sources.preset !== undefined) collectDecisionTexts(sources.preset, texts);
  collectDecisionTexts([sources.ctx.characterProfiles, sources.ctx.personaFields, ...(sources.extra ?? [])], texts);
  collectDecisionTexts(
    (sources.lorebookEntries ?? []).map((entry) => entry.content),
    texts,
  );
  return texts;
}

/**
 * The turn key for statements read with a finished reply. A regenerated swipe keeps its
 * message id, so the reply text is part of the key: a new swipe is asked again rather
 * than handed the previous reply's answers.
 */
export function replyDecisionTurnId(messageId: string | null | undefined, reply: string): string {
  return `${messageId || "reply"}:${createHash("sha256").update(reply).digest("hex").slice(0, 16)}`;
}

/**
 * The turn key for statements read before the reply: the newest message by id and by
 * text, so editing that message and regenerating asks again instead of reusing answers
 * about the old text. Generation, Peek Prompt and dry runs all key turns with this.
 */
export function latestTurnDecisionId(messages: ReadonlyArray<{ id?: unknown; content?: unknown }>): string | null {
  const latest = [...messages].reverse().find((message) => typeof message.id === "string" && message.id);
  if (!latest) return null;
  return replyDecisionTurnId(latest.id as string, typeof latest.content === "string" ? latest.content : "");
}

/**
 * Whether the Decision model setting can answer right now, checked without starting a
 * local model. Previews use it so "no Decision model" means what generation will do:
 * a local model that cannot serve reads every statement as no, like having none.
 */
export function decisionModelUsable(localSetting: string | null, connectionId: string | null): boolean {
  const slot = decisionLocalSlotForId(localSetting);
  return slot ? describeDecisionSlot(slot).available : connectionId !== null;
}

/** Chat, the newest message the decision reads, and the Decision model that answered. */
export function promptDecisionCacheKey(chatId: string, latestMessageId: string | null, decisionModelId: string | null) {
  return `${chatId}:${latestMessageId ?? "start"}:${decisionModelId ?? "none"}`;
}

/**
 * The macro context an agent template is resolved in, near enough to plan with: the
 * agent executor names `{{char}}` as every character in the chat, not one of them.
 */
export function agentShapedDecisionContext(ctx: MacroContext): MacroContext {
  return { ...ctx, char: ctx.characters.join(", ") || "Assistant" };
}

/**
 * The turn's decision statements, in source order, merged and capped.
 *
 * A Choice statement compared with "angry" in one block and "sad" in another is one
 * question with both options. Order is kept so the limit drops the last statements
 * found, which lets the caller put the sources it cares about most first.
 */
export function planPromptDecisions(
  groups: Array<{ texts: string[]; ctx: MacroContext }>,
  limit: number,
): PromptDecisionPlan {
  const byKey = new Map<string, PlannedDecision>();
  const optionKeys = new Map<string, Set<string>>();
  const dropped: string[] = [];
  // Each group is resolved in the context it will be evaluated in: an agent template
  // sees `{{char}}` as every character's name, a preset section as the responder's.
  for (const { texts, ctx } of groups)
    for (const text of texts) {
      for (const collected of collectDecisionQuestions(text)) {
        for (const key of resolveDecisionQuestionVariants(collected.question, ctx)) {
          const id = `${collected.kind}\u0000${key}`;
          let planned = byKey.get(id);
          if (!planned) {
            if (byKey.size >= limit) {
              if (!dropped.includes(key)) dropped.push(key);
              continue;
            }
            planned = { kind: collected.kind, key, options: [] };
            byKey.set(id, planned);
            optionKeys.set(id, new Set());
          }
          const seen = optionKeys.get(id)!;
          for (const option of collected.options) {
            const normalized = normalizeDecisionQuestion(option).toLowerCase();
            if (!normalized || seen.has(normalized)) continue;
            seen.add(normalized);
            planned.options.push(normalizeDecisionQuestion(option));
          }
        }
      }
    }
  // A Choice statement nobody compares with an option has nothing to choose between.
  return { decisions: [...byKey.values()].filter((d) => d.kind === "noul" || d.options.length > 0), dropped };
}

/**
 * A yes/no answer is cached already decided, with the probability kept for logging.
 * Deciding at answer time means a reader (Peek Prompt) never needs the model's
 * threshold, and so never has to resolve a backend, which could start a local model.
 */
type CachedTurn = { noul: Map<string, { p: number; yes: boolean }>; choice: Map<string, string>; at: number };

/**
 * Answers per turn: chat, the newest message the decision reads, and which Decision
 * model answered. Small and bounded; an entry for a turn that has moved on is simply
 * never read again.
 */
export class PromptDecisionTurnCache {
  private readonly turns = new Map<string, CachedTurn>();
  constructor(private readonly maxTurns = 200) {}

  get(key: string): CachedTurn {
    let turn = this.turns.get(key);
    if (!turn) {
      turn = { noul: new Map(), choice: new Map(), at: Date.now() };
      this.turns.set(key, turn);
      while (this.turns.size > this.maxTurns) this.turns.delete(this.turns.keys().next().value!);
    }
    return turn;
  }

  peek(key: string): CachedTurn | undefined {
    return this.turns.get(key);
  }
}

export const promptDecisionTurnCache = new PromptDecisionTurnCache();

/** A Choice answer is cached against its option set, which a later edit can change. */
function choiceCacheKey(decision: PlannedDecision): string {
  return `${decision.key}\u0000${[...decision.options].sort().join("\u0001")}`;
}

/** What is already known for this turn, without asking anything. For Peek Prompt. */
export function cachedPromptDecisionAnswers(plan: PromptDecisionPlan, cacheKey: string): MacroDecisionAnswers {
  const turn = promptDecisionTurnCache.peek(cacheKey);
  const answers = new Map<string, boolean>();
  const choices = new Map<string, string>();
  for (const decision of plan.decisions) {
    if (decision.kind === "noul") {
      const cached = turn?.noul.get(decision.key);
      if (cached !== undefined) answers.set(decision.key, cached.yes);
    } else {
      const choice = turn?.choice.get(choiceCacheKey(decision));
      if (choice !== undefined) choices.set(decision.key, choice);
    }
  }
  return { answers, choices, unanswered: new Set() };
}

/**
 * Answer the planned statements, asking only what this turn has not asked yet.
 *
 * Never throws: a backend that fails leaves those statements unanswered, and an
 * unanswered statement reads as false.
 */
export async function answerPromptDecisions(args: {
  plan: PromptDecisionPlan;
  backend: DecisionBackend;
  messages: DecisionMessage[];
  cacheKey: string;
  chatId?: string;
  /**
   * True when nothing waits on the answer: post-processing agents and retried agents.
   * A reasoning model is then asked too; in front of a reply it is skipped unless the
   * user opted into waiting for it.
   */
  afterReply?: boolean;
}): Promise<MacroDecisionAnswers> {
  const { plan, backend } = args;
  const turn = promptDecisionTurnCache.get(args.cacheKey);
  const pending = plan.decisions.filter((decision) =>
    decision.kind === "noul" ? !turn.noul.has(decision.key) : !turn.choice.has(choiceCacheKey(decision)),
  );
  if (plan.dropped.length > 0)
    logger.warn(
      "[decision] Chat %s asks more decision statements than the per-turn limit; %d read as no: %s",
      args.chatId ?? "?",
      plan.dropped.length,
      plan.dropped.join(" | "),
    );
  if (pending.length > 0 && (args.afterReply || !backend.deferPreGeneration)) {
    const questions: NoulQuestion[] = pending.map((decision, index) => ({
      id: `d${index}`,
      instructions: decision.key,
      ...(decision.kind === "choice" ? { options: decision.options } : {}),
    }));
    try {
      const state = buildDecisionState(
        args.messages,
        DEFAULT_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH,
        backend.maxStateTokens,
      );
      const result = await backend.askMixed(state, questions);
      pending.forEach((decision, index) => {
        if (decision.kind === "noul") {
          const p = result.answers.get(`d${index}`);
          if (p !== undefined) turn.noul.set(decision.key, { p, yes: p >= backend.calibration.defaultThreshold });
        } else {
          const choice = result.choices.get(`d${index}`);
          if (choice !== undefined) turn.choice.set(choiceCacheKey(decision), choice);
        }
      });
    } catch (error) {
      logger.warn(error, "[decision] Prompt decision request failed; those branches read as no");
    }
  }
  const answers = cachedPromptDecisionAnswers(plan, args.cacheKey);
  for (const decision of plan.decisions)
    logger.debug(
      "[decision] Prompt %s %s -> %s",
      decision.kind === "noul" ? "statement" : "choice",
      JSON.stringify(decision.key),
      decision.kind === "noul"
        ? (() => {
            const cached = turn.noul.get(decision.key);
            return cached === undefined
              ? "no answer (reads as no)"
              : `${cached.p.toFixed(3)} (${cached.yes ? "yes" : "no"})`;
          })()
        : (answers.choices!.get(decision.key) ?? `no answer (every option reads as no)`),
    );
  return answers;
}

/**
 * Answer the statements in agents' prompt templates outside a live turn, for Retry
 * agents. `macroContext` is the one the agent executor resolves templates in.
 */
export async function answerAgentTemplateDecisions(args: {
  /** Each agent's effective template (see `effectiveAgentPromptTemplate`) and settings. */
  agents: Array<{ template: string; settings?: unknown }>;
  macroContext: MacroContext;
  messages: DecisionMessage[];
  turnId: string | null;
  chatId: string;
  decisionModelId: string | null;
  limit: number;
  getBackend: () => Promise<DecisionBackend | null>;
  /** False for pre-generation agents, which a live turn asks in front of the reply. */
  afterReply?: boolean;
}): Promise<MacroDecisionAnswers | undefined> {
  const texts = collectDecisionTexts(args.agents.map((agent) => [agent.template, agent.settings]));
  if (texts.length === 0) return undefined;
  const plan = planPromptDecisions([{ texts, ctx: args.macroContext }], args.limit);
  if (plan.decisions.length === 0) return undefined;
  const backend = await args.getBackend();
  if (!backend) return undefined;
  return answerPromptDecisions({
    plan,
    backend,
    messages: args.messages,
    chatId: args.chatId,
    cacheKey: promptDecisionCacheKey(args.chatId, args.turnId, args.decisionModelId),
    afterReply: args.afterReply ?? true,
  });
}

/**
 * Answers lorebook entries' decision statements for activation (#6570). Each statement
 * is resolved in the turn's macro context and keyed like a prompt statement, so an
 * entry and a `{{#if decision:"..."}}` asking the same thing share one cached answer.
 * `answer` asks the Decision model (generation) or reads what the turn already has
 * (previews); a statement it has no answer for reads as no.
 *
 * `limit` is what the turn has left for new statements, spent across every call (a
 * lorebook scan can ask twice). A statement in `freeKeys`, already planned by the
 * prompt and so already answered this turn, costs nothing.
 */
export function createLorebookDecisionResolver(args: {
  macroContext: MacroContext;
  limit: number;
  freeKeys?: ReadonlySet<string>;
  answer: (plan: PromptDecisionPlan) => Promise<MacroDecisionAnswers | undefined>;
  /** Told each statement that got no answer, for a preview's report. */
  onUnanswered?: (statement: string) => void;
}): LorebookDecisionResolver {
  const charged = new Set<string>();
  let remaining = args.limit;
  return async (requests) => {
    const keyed = requests.map((request) => ({
      entryId: request.entryId,
      key: resolveDecisionQuestionText(request.statement, args.macroContext),
    }));
    const planned: PlannedDecision[] = [];
    const dropped: string[] = [];
    const seen = new Set<string>();
    for (const { key } of keyed) {
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (args.freeKeys?.has(key) || charged.has(key)) {
        planned.push({ kind: "noul", key, options: [] });
      } else if (remaining > 0) {
        remaining -= 1;
        charged.add(key);
        planned.push({ kind: "noul", key, options: [] });
      } else dropped.push(key);
    }
    const plan: PromptDecisionPlan = { decisions: planned, dropped };
    const answers = plan.decisions.length > 0 ? await args.answer(plan) : undefined;
    const byEntry = new Map<string, boolean>();
    for (const { entryId, key } of keyed) {
      const answer = answers?.answers?.get(key);
      if (answer === undefined) args.onUnanswered?.(key);
      else byEntry.set(entryId, answer);
    }
    return byEntry;
  };
}

export { DECISION_CHOICE_NONE };
