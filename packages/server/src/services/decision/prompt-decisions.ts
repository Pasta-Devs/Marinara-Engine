/**
 * Decision statements in prompt conditionals: `{{#if decision:"..."}}` and
 * `{{#if decision_choice:"..." == "option"}}`.
 *
 * The macro engine is synchronous, so a statement cannot be asked while a condition is
 * evaluated. Instead the turn's statements are found in the prompt sources first,
 * asked in one batch, and handed to the engine as answers. Only statements the turn
 * can reach are asked (#6582): the parts of a preset it uses, the choices selected,
 * lorebook entries that activate, and blocks nothing else has already ruled out. The engine then looks each
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
  parseChoiceOptions,
  planDecisionStatements,
  resolveChoiceVariableValue,
  resolveDecisionQuestionText,
  resolveDecisionQuestionVariants,
  type DecisionStatementPriority,
  type MacroContext,
  type MacroDecisionAnswers,
  type DecisionDebugReport,
  type DecisionDebugResult,
} from "@marinara-engine/shared";
import { logger, logDebugOverride } from "../../lib/logger.js";
import { buildDecisionState, type DecisionMessage } from "../generation/agent-activation-questions.js";
import type { DecisionBackend } from "./decision-default.js";
import { describeDecisionSlot } from "./decision-slots.js";
import type { LorebookDecisionResolver } from "../lorebook/index.js";
import { DECISION_CHOICE_NONE, type NoulQuestion } from "./system-one.client.js";
import {
  recordDecisionCheck,
  recordDecisionTimer,
  type DecisionTimerState,
  type HeldDecision,
} from "./decision-timers.js";

export interface PlannedDecision {
  kind: "noul" | "choice";
  /** The statement with its macros resolved: the key its answer is stored under. */
  key: string;
  /** For a Choice statement, every option it is compared with anywhere this turn. */
  options: string[];
  /** The longest `sticky:` and `cooldown:` written on any of its occurrences. */
  sticky?: number;
  cooldown?: number;
  /** The smallest `every:` written on any of its occurrences. */
  every?: number;
  /** The highest `priority:` written on any of its occurrences; unset is medium. */
  priority?: DecisionStatementPriority;
  /** Set when sticky, cooldown or `every:` holds its answer this turn: it is not asked, and takes no slot. */
  held?: HeldDecision;
}

/** Which statements sticky, cooldown or `every:` hold this turn (see `heldDecision`). */
export type HeldDecisions = (
  kind: "noul" | "choice",
  key: string,
  modifiers?: { every?: number },
) => HeldDecision | undefined;

/** High first, then medium (unset), then low. */
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;
const priorityRank = (priority: DecisionStatementPriority | undefined) => PRIORITY_RANK[priority ?? "medium"];

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

/** A preset as stored, with the choices this turn uses. */
export interface PresetDecisionParts {
  sections: ReadonlyArray<{ content?: unknown; enabled?: unknown; groupId?: unknown }>;
  groups: ReadonlyArray<{ id?: unknown; enabled?: unknown }>;
  choiceBlocks: ReadonlyArray<{
    variableName?: unknown;
    options?: unknown;
    multiSelect?: unknown;
    randomPick?: unknown;
    separator?: unknown;
  }>;
  /** The chat's choice for each choice block, by variable name. */
  choices?: Readonly<Record<string, string | string[]>>;
}

/**
 * The preset text a turn uses, as the prompt builder uses it: enabled sections in
 * enabled groups, and the selected value of each choice block. A choice block's
 * options are stored as JSON text, so they are parsed here; walking the raw text
 * would plan an option's statement under a key the prompt never looks up.
 */
function presetDecisionTexts(preset: PresetDecisionParts, texts: string[]): void {
  const enabled = (value: unknown) => value === true || value === "true";
  const disabledGroups = new Set(
    preset.groups.filter((group) => !enabled(group.enabled)).map((group) => String(group.id)),
  );
  for (const section of preset.sections)
    if (enabled(section.enabled) && !(typeof section.groupId === "string" && disabledGroups.has(section.groupId)))
      collectDecisionTexts(section.content, texts);
  for (const block of preset.choiceBlocks) {
    const options = parseChoiceOptions(block.options);
    const selected = preset.choices?.[String(block.variableName)];
    // A random pick is made later, so every selected option could be the one used.
    const random = enabled(block.randomPick);
    collectDecisionTexts(
      resolveChoiceVariableValue({
        selected,
        options,
        multiSelect: random || block.multiSelect,
        randomPick: false,
        separator: random ? "\n" : typeof block.separator === "string" ? block.separator : null,
      }),
      texts,
    );
  }
}

/** The pieces of a turn that can hold decision statements, most important first. */
export interface TurnDecisionSources {
  /** The preset, when the turn uses one. */
  preset?: PresetDecisionParts;
  ctx: MacroContext;
  extra?: unknown[];
}

/**
 * Every text this turn resolves that could hold a decision statement. Generation and
 * Peek Prompt both call this, so they plan the same statements from the same sources.
 * Order matters: past the per-turn limit, the last statements found read as no.
 * Lorebook entries are not here: their statements are asked once the scan knows which
 * entries activate (see `createLorebookDecisionResolver`).
 */
export function collectTurnDecisionTexts(sources: TurnDecisionSources): string[] {
  const texts: string[] = [];
  if (sources.preset) presetDecisionTexts(sources.preset, texts);
  collectDecisionTexts([sources.ctx.characterProfiles, sources.ctx.personaFields, ...(sources.extra ?? [])], texts);
  return texts;
}

/**
 * The statements `texts` can reach this turn, as written and as resolved. A statement
 * behind a condition already settled without it, like `char == "Dottore"` while the
 * character is Mira, is left out; anything that could still matter is kept.
 */
export function reachableDecisionStatements(texts: readonly string[], ctx: MacroContext): Set<string> {
  const reachable = new Set<string>();
  for (const text of texts)
    for (const statement of planDecisionStatements(text, ctx).statements) reachable.add(statement);
  return reachable;
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
 * The turn's decision statements, merged and capped.
 *
 * A Choice statement compared with "angry" in one block and "sad" in another is one
 * question with both options. Past the limit, `priority:low` statements are dropped
 * first and `priority:high` last; within a priority, the last statements found are,
 * which lets the caller put the sources it cares about most first. Held statements
 * are planned, so their held answer reaches the prompt, but take no slot.
 */
export function planPromptDecisions(
  groups: Array<{
    texts: string[];
    ctx: MacroContext;
    /** From `reachableDecisionStatements` in this group's context: anything else is left out before the limit counts. */
    reachable?: ReadonlySet<string>;
  }>,
  limit: number,
  options: { held?: HeldDecisions } = {},
): PromptDecisionPlan {
  const byKey = new Map<string, PlannedDecision>();
  const optionKeys = new Map<string, Set<string>>();
  // Each group is resolved in the context it will be evaluated in: an agent template
  // sees `{{char}}` as every character's name, a preset section as the responder's.
  for (const { texts, ctx, reachable } of groups)
    for (const text of texts) {
      for (const collected of collectDecisionQuestions(text)) {
        const variants = resolveDecisionQuestionVariants(collected.question, ctx);
        if (
          reachable &&
          !reachable.has(normalizeDecisionQuestion(collected.question)) &&
          !variants.some((key) => reachable.has(key))
        )
          continue;
        for (const key of variants) {
          const id = `${collected.kind}\u0000${key}`;
          let planned = byKey.get(id);
          const first = !planned;
          if (!planned) {
            planned = { kind: collected.kind, key, options: [] };
            byKey.set(id, planned);
            optionKeys.set(id, new Set());
          }
          if (collected.sticky) planned.sticky = Math.max(planned.sticky ?? 0, collected.sticky);
          if (collected.cooldown) planned.cooldown = Math.max(planned.cooldown ?? 0, collected.cooldown);
          if (collected.every) planned.every = Math.min(planned.every ?? collected.every, collected.every);
          // The highest priority anywhere wins; an occurrence with none counts as medium.
          const rank = first
            ? priorityRank(collected.priority)
            : Math.min(priorityRank(planned.priority), priorityRank(collected.priority));
          const priority = rank === 0 ? "high" : rank === 2 ? "low" : undefined;
          if (priority) planned.priority = priority;
          else delete planned.priority;
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
  const candidates = [...byKey.values()].filter((d) => d.kind === "noul" || d.options.length > 0);
  for (const decision of candidates) {
    const held = options.held?.(decision.kind, decision.key, decision);
    if (held) decision.held = held;
  }
  // Stable, so source order still decides within a priority.
  const ranked = [...candidates].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
  const decisions: PlannedDecision[] = [];
  const dropped: string[] = [];
  let counted = 0;
  for (const decision of ranked) {
    if (decision.held) decisions.push(decision);
    else if (counted < limit) {
      counted += 1;
      decisions.push(decision);
    } else if (!dropped.includes(decision.key)) dropped.push(decision.key);
  }
  return { decisions, dropped };
}

/**
 * A yes/no answer is cached already decided, with the probability kept for logging.
 * Deciding at answer time means a reader (Peek Prompt) never needs the model's
 * threshold, and so never has to resolve a backend, which could start a local model.
 */
type CachedTurn = {
  noul: Map<string, { p?: number; yes: boolean; threshold?: number; binary?: boolean; held?: boolean }>;
  choice: Map<string, string>;
  at: number;
};

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
export function cachedPromptDecisionAnswers(
  plan: PromptDecisionPlan,
  cacheKey: string,
  cache = promptDecisionTurnCache,
): MacroDecisionAnswers {
  const turn = cache.peek(cacheKey);
  const answers = new Map<string, boolean>();
  const choices = new Map<string, string>();
  for (const decision of plan.decisions) {
    if (decision.kind === "noul") {
      const cached = turn?.noul.get(decision.key)?.yes ?? decision.held?.yes;
      if (cached !== undefined) answers.set(decision.key, cached);
    } else {
      const choice =
        turn?.choice.get(choiceCacheKey(decision)) ??
        (decision.held ? (decision.held.yes ? decision.held.choice : DECISION_CHOICE_NONE) : undefined);
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
  backend: DecisionBackend | null;
  messages: DecisionMessage[];
  cacheKey: string;
  /** Tests use a request-local cache, never the live chat's answers. */
  cache?: PromptDecisionTurnCache;
  inspection?: DecisionDebugReport;
  chatId?: string;
  /**
   * True when nothing waits on the answer: post-processing agents and retried agents.
   * A reasoning model is then asked too; in front of a reply it is skipped unless the
   * user opted into waiting for it.
   */
  afterReply?: boolean;
  /** Sticky and cooldown: a fresh yes on this turn starts the statement's timers. */
  timers?: { state: DecisionTimerState; turn: number };
}): Promise<MacroDecisionAnswers> {
  const { plan, backend } = args;
  const cache = args.cache ?? promptDecisionTurnCache;
  const inspection = args.inspection ?? backend?.inspection;
  const traceStart = inspection?.requests.length ?? 0;
  const turn = cache.get(args.cacheKey);
  // A held statement is answered by its timer and never asked.
  for (const decision of plan.decisions) {
    if (!decision.held) continue;
    if (decision.kind === "noul") turn.noul.set(decision.key, { yes: decision.held.yes, held: true });
    else
      turn.choice.set(
        choiceCacheKey(decision),
        decision.held.yes && decision.held.choice !== undefined ? decision.held.choice : DECISION_CHOICE_NONE,
      );
  }
  const pending = plan.decisions.filter((decision) =>
    decision.kind === "noul" ? !turn.noul.has(decision.key) : !turn.choice.has(choiceCacheKey(decision)),
  );
  if (plan.dropped.length > 0) {
    // The count at warn; the statements themselves are chat content and go to debug.
    logger.warn(
      "[decision] Chat %s asks more decision statements than the per-turn limit; %d read as no",
      args.chatId ?? "?",
      plan.dropped.length,
    );
    logger.debug("[decision] Dropped decision statements: %s", plan.dropped.join(" | "));
  }
  let requestError: string | undefined;
  if (backend && pending.length > 0 && (args.afterReply || !backend.deferPreGeneration)) {
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
      requestError = result.error;
      pending.forEach((decision, index) => {
        if (decision.kind === "noul") {
          const p = result.answers.get(`d${index}`);
          if (p === undefined) return;
          const yes = p >= backend.calibration.defaultThreshold;
          turn.noul.set(decision.key, {
            p,
            yes,
            threshold: backend.calibration.defaultThreshold,
            binary: result.binaryAnswers?.has(`d${index}`),
          });
          if (args.timers) {
            recordDecisionTimer(args.timers.state, args.timers.turn, decision, { yes });
            recordDecisionCheck(args.timers.state, args.timers.turn, decision);
          }
        } else {
          const choice = result.choices.get(`d${index}`);
          if (choice === undefined) return;
          turn.choice.set(choiceCacheKey(decision), choice);
          if (args.timers) {
            if (choice !== DECISION_CHOICE_NONE)
              recordDecisionTimer(args.timers.state, args.timers.turn, decision, { choice });
            recordDecisionCheck(args.timers.state, args.timers.turn, decision);
          }
        }
      });
    } catch (error) {
      requestError = "request_failed";
      logger.warn(error, "[decision] Prompt decision request failed; those branches read as no");
    }
  }
  const answers = cachedPromptDecisionAnswers(plan, args.cacheKey, cache);
  const report: DecisionDebugResult[] = plan.decisions.map((decision) => {
    const cached = turn.noul.get(decision.key);
    const choice = answers.choices?.get(decision.key);
    const answered = decision.kind === "noul" ? cached !== undefined : choice !== undefined;
    const index = pending.indexOf(decision);
    const status = decision.held
      ? "held"
      : answered
        ? index >= 0
          ? "evaluated"
          : "cached"
        : !backend
          ? "unavailable"
          : backend.deferPreGeneration && !args.afterReply
            ? "deferred"
            : inspection?.mode === "inspect"
              ? "ready"
              : "unanswered";
    const error =
      status === "unanswered"
        ? (requestError ??
          inspection?.requests
            .slice(traceStart)
            .find((request) => request.results?.some((result) => result.id === `d${index}`))?.error)
        : undefined;
    return {
      statement: decision.key,
      kind: decision.kind,
      status,
      ...(decision.kind === "choice"
        ? { options: decision.options, ...(choice !== undefined ? { choice } : {}) }
        : {
            ...(cached ? { yes: cached.yes } : {}),
            ...(!decision.held && cached?.p !== undefined && !cached.binary && !cached.held
              ? { probability: cached.p }
              : {}),
            ...(cached?.binary ? { binary: true } : {}),
            ...(!decision.held && backend
              ? { threshold: cached?.threshold ?? backend.calibration.defaultThreshold }
              : {}),
          }),
      ...(error ? { error } : {}),
    };
  });
  report.push(
    ...plan.dropped.map((statement): DecisionDebugResult => ({ statement, kind: "noul", status: "dropped" })),
  );
  if (inspection) {
    for (const result of report) {
      const existing = inspection.results.findIndex(
        (row) => row.statement === result.statement && row.kind === result.kind,
      );
      // A later lorebook pass reusing this test's answer does not erase its fresh result.
      if (existing < 0) inspection.results.push(result);
      else if (result.status !== "cached") inspection.results[existing] = result;
    }
  }
  for (const result of report)
    logDebugOverride(
      backend?.debugMode === true || process.env.DEBUG_AGENTS === "true",
      "[decision] Turn %s: %s",
      args.cacheKey,
      JSON.stringify(result),
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
  const plan = planPromptDecisions(
    [{ texts, ctx: args.macroContext, reachable: reachableDecisionStatements(texts, args.macroContext) }],
    args.limit,
  );
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
 * Answers lorebook entries' decision statements for activation (#6570), and the
 * `{{#if decision}}` statements in the text of entries about to activate (#6582). Each
 * statement is resolved in the turn's macro context and keyed like a prompt statement,
 * so an entry and a prompt asking the same thing share one cached answer. `answer`
 * asks the Decision model (generation) or reads what the turn already has (previews);
 * a statement it has no answer for reads as no.
 *
 * `limit` is what the turn has left for new statements, spent across every call (a
 * lorebook scan can ask several times). A statement in `freeKeys`, already planned by
 * the prompt and so already answered this turn, costs nothing.
 */
export function createLorebookDecisionResolver(args: {
  macroContext: MacroContext;
  limit: number;
  freeKeys?: ReadonlySet<string>;
  answer: (plan: PromptDecisionPlan) => Promise<MacroDecisionAnswers | undefined>;
  /** Told each statement that got no answer, for a preview's report. */
  onUnanswered?: (statement: string) => void;
  /** Told each statement left out for the per-turn limit, for a preview's report. */
  onDropped?: (statement: string) => void;
  /** Statements sticky or cooldown hold this turn: never asked, and free. */
  held?: HeldDecisions;
}): LorebookDecisionResolver {
  const charged = new Set<string>();
  let remaining = args.limit;
  /** Whether a statement may be asked, charging the turn's limit unless it is already paid for. */
  const admit = (key: string) => {
    if (args.freeKeys?.has(key) || charged.has(key)) return true;
    if (remaining <= 0) {
      args.onDropped?.(key);
      return false;
    }
    remaining -= 1;
    charged.add(key);
    return true;
  };
  const resolver: LorebookDecisionResolver = async (requests) => {
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
      // A Decision field has no timing of its own, but the same statement held elsewhere
      // keeps its held answer here too, and takes no slot.
      const held = args.held?.("noul", key);
      if (held || admit(key)) planned.push({ kind: "noul", key, options: [], ...(held ? { held } : {}) });
      else dropped.push(key);
    }
    const plan: PromptDecisionPlan = { decisions: planned, dropped };
    const answers = plan.decisions.length > 0 ? await args.answer(plan) : undefined;
    const byEntry = new Map<string, boolean>();
    for (const { entryId, key } of keyed) {
      const answer = answers?.answers?.get(key);
      if (answer === undefined) {
        if (!dropped.includes(key)) args.onUnanswered?.(key);
      } else byEntry.set(entryId, answer);
    }
    return byEntry;
  };
  resolver.answerStatements = async (texts) => {
    const ctx = args.macroContext;
    const all = planPromptDecisions(
      [{ texts, ctx, reachable: reachableDecisionStatements(texts, ctx) }],
      Number.POSITIVE_INFINITY,
      { held: args.held },
    );
    const decisions = all.decisions.filter((decision) => decision.held || admit(decision.key));
    if (decisions.length === 0) return;
    const dropped = all.decisions.filter((decision) => !decisions.includes(decision)).map((decision) => decision.key);
    const answers = await args.answer({ decisions, dropped });
    // Merged into the turn's answers object in place: the prompt builder and the agents
    // hold this same object, so they see the new answers without being handed them.
    const target = (ctx.decisions ??= {});
    target.answers = new Map([...(target.answers ?? []), ...(answers?.answers ?? [])]);
    target.choices = new Map([...(target.choices ?? []), ...(answers?.choices ?? [])]);
    for (const decision of decisions)
      if (!(decision.kind === "noul" ? answers?.answers : answers?.choices)?.has(decision.key))
        args.onUnanswered?.(decision.key);
  };
  // Settled branches only, with the answers so far: a lorebook scan follows a branch once it is decided.
  resolver.planText = (text) => planDecisionStatements(text, args.macroContext, { settledOnly: true }).text;
  return resolver;
}

export { DECISION_CHOICE_NONE };
