// ──────────────────────────────────────────────
// Game: one-request dice — the chance pass and its wrapper
//
// A Game turn that rolls dice costs two provider requests today: the GM writes a
// draft with roll requests in it, the engine rolls, and the whole prompt goes back
// so the GM can rewrite the narration with the real numbers. With
// `gameOneRequestDice` on, the GM commits its prose first — both halves of a binary
// outcome, or a placeholder where a number goes — the engine rolls after the
// writing is done, and the rewrite request never fires. The model never sees a
// number before it decides what happens, so it cannot steer the outcome.
//
// ONE session per turn, TWO insertion points, for reasons that are load-bearing:
//
//   1. The branch arm runs before spatial extraction and before the package-verb
//      strip, so a discarded half's commands are gone before anything collects them.
//   2. The placeholder arm runs immediately AFTER the verb strip, so a placeholder
//      inside a verb's argument is already gone with the verb and is never rolled.
//      It cannot run at point 1: the verb table is not fetched until after spatial
//      extraction, so a pass placed there has nothing to compare a `[verb:` head
//      against.
//
// The failure contract is absolute and is the point of the wrapper: the pass never
// throws out of this module. On an internal failure the turn is saved with a notice
// and the affected tags are left sparse, no `[[roll:` span survives into saved
// content for a downstream stripper to half-eat, no branch delimiter survives
// either, and no second provider request is ever made. Nothing here invents a die
// result, a modifier, a total or an outcome.
//
// Both arms are real. Arm 1 keeps the half a live roll selects and deletes the other one
// before anything collects a command out of it; arm 2 rolls `[[roll: 2d6+3]]` with the
// session's crypto roller and substitutes the total, adding sheet modifiers by name
// through the same arithmetic a skill check uses. Each arm's grammar and bounded-span
// walk live in a shared module beside the tag it reads; what lives here is the
// chat-shaped half — the sheet, the roll, the ledger, the dice history and the log.
// ──────────────────────────────────────────────

import {
  dropGameBranchBlocks,
  isEngineRollableSkillCheckTag,
  isRollPlaceholderName,
  parseRollPlaceholderBody,
  parseSkillCheckTagBody,
  readSkillCheckBranchLabel,
  replaceRollPlaceholdersWithNotice,
  resolveRollPlaceholders,
  scanGameBranchBlocks,
  scanRollPlaceholders,
  scanSkillCheckTagSpans,
  selectGameBranchHalf,
  serializeResolvedSkillCheckTag,
  stripGameBranchDelimiters,
  type DiceRollResult,
  type GameBranchBlock,
  type GameBranchRefusal,
  type GameDiceTurnNotice,
  type GameDicePlaceholderRecord,
  type RollPlaceholderRefusalRecord,
  type RollPlaceholderSheetModifier,
  type SkillCheckResult,
  type SkillCheckTagSpan,
  matchRulesetCheckTarget,
  rulesetCheckModifier,
} from "@marinara-engine/shared";
import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { rollDieSecurely, type DieRoller } from "./dice-rng.js";
import type { GameDicePoolSession } from "./dice-pool.service.js";
import {
  attributeModifier,
  getGoverningAttribute,
  mapSheetAttributeName,
  readContextAttributeScore,
  SHEET_ATTRIBUTE_LABELS,
} from "./skill-check.service.js";
import type { GameSkillModifierView } from "./gm-prompts.js";
import {
  isResolvableSkillCheckRequest,
  readRulesetDifficulty,
  loadSkillCheckModifierContext,
  resolveSkillCheckWithContext,
  type SkillCheckModifierContext,
  type SkillCheckRulesetContext,
  type SkillCheckRequest,
} from "./skill-check-resolution.service.js";

export { PLACEHOLDER_BODY_MAX, ROLL_UNAVAILABLE_TEXT } from "@marinara-engine/shared";

/** How much of a refused span is worth carrying into a log line. */
const LOGGED_SPAN_MAX = 200;

/** Which arm produced a ledger entry, and which insertion point the wrapper is at. */
export type GameTurnChanceStage = "branch" | "placeholder";

export interface GameTurnChanceLedgerEntry {
  stage: GameTurnChanceStage;
  /** `resolved` is a real recorded roll. `unreadable` is a span the pass refused and replaced. */
  outcome: "resolved" | "unreadable";
  /** The raw span, truncated, for the log line and the turn notice. */
  span?: string;
}

/** What an arm, or the wrapper's fallback, did to the content. */
export interface GameTurnChanceRewrite {
  content: string;
  changed: boolean;
}

export type GameTurnChanceArm = (content: string, session: GameTurnChanceSession) => Promise<GameTurnChanceRewrite>;

/**
 * One object per turn, holding one shared roller, one lazily loaded sheet-modifier
 * context and one ordered ledger. Resolving N checks in one narration must not mean N
 * snapshot reads, and every check in one turn must see the same sheet.
 */
export interface GameTurnChanceSession {
  readonly chatId: string;
  /** The one roller every mechanism in this turn uses. */
  readonly roll: DieRoller;
  /** Loaded at most once per turn, on first use. */
  loadModifierContext(): Promise<SkillCheckModifierContext>;
  /** Everything the pass resolved or refused, in the order it happened. */
  readonly ledger: GameTurnChanceLedgerEntry[];
  /**
   * Rolls this turn's pass threw, for the message extra and the session log. The route
   * pushes them onto the turn's dice results; deliberately WITHOUT the `tool_result`
   * frame that pops a full-screen dice card, because a damage placeholder popping a
   * card would bury the narration and three placeholders would queue three.
   */
  readonly diceRolls: DiceRollResult[];
  /** One audit record per substituted placeholder, in reading order. */
  readonly placeholders: GameDicePlaceholderRecord[];
  /** True once an arm threw and the fallback rewrite took over. */
  failed: boolean;
}

export interface GameTurnChanceSessionOptions {
  db: DB;
  chatId: string;
  /** Substitutable for a lane. Production always uses the crypto roller. */
  roll?: DieRoller;
  /** Substitutable for a lane that must not touch the database. */
  loadModifierContext?: () => Promise<SkillCheckModifierContext>;
}

/** Absent means off. The switch defaults to off at first release. */
export function isOneRequestDiceEnabled(chatMeta: Record<string, unknown> | null | undefined): boolean {
  return chatMeta?.gameOneRequestDice === true;
}

/**
 * The one-request guarantee, in code.
 *
 * While the switch is on this reads as if the narration toggle were off,
 * unconditionally: on a clean turn, on a fallback sparse tag, on a refused
 * placeholder, on a branch failure, and on a thrown pass. Nothing else in this
 * feature adds a provider call, so holding this closed is what makes a rolled turn
 * cost one request.
 *
 * The stored narration setting is read, never written: a player who turns the switch
 * off gets their narration preference back exactly as they left it.
 */
export function shouldNarrateGameDiceOutcome(
  chatMeta: Record<string, unknown> | null | undefined,
  rolledSomething: boolean,
): boolean {
  if (isOneRequestDiceEnabled(chatMeta)) return false;
  return chatMeta?.gameDiceOutcomeNarration !== false && rolledSomething;
}

export function createGameTurnChanceSession(options: GameTurnChanceSessionOptions): GameTurnChanceSession {
  let pending: Promise<SkillCheckModifierContext> | null = null;
  const load = options.loadModifierContext ?? (() => loadSkillCheckModifierContext(options.db, options.chatId));
  return {
    chatId: options.chatId,
    roll: options.roll ?? rollDieSecurely,
    loadModifierContext() {
      pending ??= load();
      return pending;
    },
    ledger: [],
    diceRolls: [],
    placeholders: [],
    failed: false,
  };
}

/** Why the arm would not resolve a block. The block's own reasons, plus the matching ones. */
export type GameBranchArmRefusal =
  | GameBranchRefusal
  /** No check tag claimed this block's label back. */
  | "unmatched-label"
  /** Two blocks, or two check tags, claimed the same label, so the label decides nothing. */
  | "ambiguous-label"
  /** The claimed tag is not a check this engine rolls, is out of bounds, or already carries a result. */
  | "unrollable-check";

/** Plain words for each refusal, so the log says what the model wrote rather than what a flag is called. */
const BRANCH_REFUSAL_REASONS: Record<GameBranchArmRefusal, string> = {
  unterminated: "the block never closed",
  nested: "the block carried another block or a check tag inside it",
  "empty-label": "the block named no label",
  "missing-half": "the block is missing one of its two halves",
  "duplicate-half": "the block wrote the same half twice",
  "unmatched-label": "no check tag claimed the block's label",
  "ambiguous-label": "the label was claimed more than once, so it decides nothing",
  "unrollable-check": "the claimed check is not one this engine rolls",
};

/** What the arm decided about one block, before anything is spliced. */
interface GameBranchPlan {
  block: GameBranchBlock;
  /** The check tag this block's label claimed, when exactly one claimed it back and it is rollable. */
  check: (SkillCheckTagSpan & { request: SkillCheckRequest }) | null;
  /** Null only when a half will be kept. */
  refusal: GameBranchArmRefusal | null;
}

/** One replacement, spliced in reading order so the prose between spans stays byte for byte. */
interface GameBranchEdit {
  start: number;
  end: number;
  replacement: string;
}

/**
 * Match every block to the check tag its label claims, and say what is wrong where it
 * does not work out.
 *
 * Matching is by label, folded, and it has to be exactly one on each side: a label two
 * blocks claim, or two check tags claim, decides nothing, and guessing which pairing the
 * model meant would decide a real outcome on a coin flip the player never sees.
 *
 * A check tag inside ANY block is excluded from the match map, not merely from the block
 * that contains it. Excluding it only from its own container left block B free to match a
 * tag sitting inside block A: A was refused for carrying it and re-emitted the tag raw,
 * while B's resolved-tag edit for the same span was dropped by the splice's overlap
 * guard, so the saved turn kept B's chosen half beside a SPARSE tag that the shipped
 * resolver then rolled a second time — a recorded outcome that can contradict the prose
 * the player reads. With the exclusion, B is simply refused as unmatched, the tag is
 * rolled exactly once by the shipped resolver, and the two spans can never overlap when
 * the splice runs.
 */
export function planGameTurnBranches(content: string, blocks: GameBranchBlock[]): GameBranchPlan[] {
  const claimedByBlocks = new Map<string, number>();
  for (const block of blocks) {
    if (block.label) claimedByBlocks.set(block.label, (claimedByBlocks.get(block.label) ?? 0) + 1);
  }

  /** A label mapped to `null` was claimed twice, which is the same as not being claimed. */
  const checksByLabel = new Map<string, SkillCheckTagSpan | null>();
  const insideAnyBlock = (span: SkillCheckTagSpan) =>
    blocks.some((block) => span.start >= block.start && span.end <= block.end);
  for (const span of scanSkillCheckTagSpans(content)) {
    if (insideAnyBlock(span)) continue;
    const label = readSkillCheckBranchLabel(span.body);
    if (!label) continue;
    checksByLabel.set(label, checksByLabel.has(label) ? null : span);
  }

  return blocks.map((block) => {
    const claimed = block.label ? checksByLabel.get(block.label) : undefined;
    const ambiguous = (claimedByBlocks.get(block.label) ?? 0) > 1 || claimed === null;
    const span = claimed ?? undefined;

    let check: GameBranchPlan["check"] = null;
    let matchRefusal: GameBranchArmRefusal | null = null;
    if (!block.label) {
      matchRefusal = "empty-label";
    } else if (ambiguous) {
      matchRefusal = "ambiguous-label";
    } else if (!span) {
      matchRefusal = "unmatched-label";
    } else {
      const tag = parseSkillCheckTagBody(span.body);
      const request: SkillCheckRequest | null =
        tag && !tag.resolvedResult && isEngineRollableSkillCheckTag(tag)
          ? {
              skill: tag.skill,
              ...(tag.dc !== undefined ? { dc: tag.dc } : {}),
              ...(tag.difficulty ? { difficulty: tag.difficulty } : {}),
              ...(tag.explode != null ? { explode: tag.explode } : {}),
              ...(tag.double != null ? { double: tag.double } : {}),
              advantage: tag.advantage,
              disadvantage: tag.disadvantage,
              preRolledD20: tag.preRolledD20,
            }
          : null;
      // A difficulty named only by its ladder step is read when the sheet is, below, because that is
      // when the ruleset is in hand; until then it is plannable on the strength of the name alone.
      const plannable =
        request && (request.dc === undefined ? !!request.difficulty : isResolvableSkillCheckRequest(request));
      if (request && plannable) check = { ...span, request };
      else matchRefusal = "unrollable-check";
    }
    return { block, check, refusal: block.refusal ?? matchRefusal };
  });
}

/**
 * Branch arm. Scans for `[branch: id] ... [/branch]` blocks with their matching sparse
 * check tags, resolves in reading order and splices.
 *
 * It runs BEFORE spatial extraction and BEFORE the package-verb strip, and that position
 * is the whole reason the arm exists where it does: the discarded half is gone before
 * anything collects a command out of it, so a `[spatial_move:]` or a package verb the
 * model wrote into the outcome that did not happen never reaches a parser at all. The
 * live rewrite path only holds that invariant by re-parsing both after the rewrite, and
 * re-parsing is exactly what a one-request turn skips.
 *
 * The roll goes through `resolveSkillCheckWithContext` with the session's crypto roller,
 * like every other check in the turn, so the sheet modifier, the advantage handling and
 * the critical flags are the shipped ones rather than a second implementation. A critical
 * folds into the success or failure half by its `success` boolean and is recorded in the
 * tag; it never becomes a third half.
 *
 * The failure contract, per 3.5, and every branch of it ends in the same place: the check
 * is rolled once, the RESOLVED record is written — never a sparse tag, which the client's
 * own fallback would pick up and roll a second time — neither half's prose is kept, the
 * delimiters are stripped, and no second provider request is ever made.
 */
export async function resolveGameTurnBranches(
  content: string,
  session: GameTurnChanceSession,
): Promise<GameTurnChanceRewrite> {
  const blocks = scanGameBranchBlocks(content);
  if (blocks.length === 0) return { content, changed: false };

  const plans = planGameTurnBranches(content, blocks);
  // The sheet is read at most once per turn, and only when a block actually has a check
  // to roll: a turn whose every block is malformed reads no snapshot at all.
  const context = plans.some((plan) => plan.check) ? await session.loadModifierContext() : null;

  const edits: GameBranchEdit[] = [];
  for (const plan of plans) {
    let result: SkillCheckResult | null = null;
    let refusal = plan.refusal;
    if (plan.check && context) {
      const definition = context.ruleset?.definition;
      const request = readRulesetDifficulty(plan.check.request, definition);
      // Only a named difficulty is read here; a check that wrote its own number was bounded above.
      if (plan.check.request.dc === undefined && !isResolvableSkillCheckRequest(request, definition)) {
        refusal = "unrollable-check";
      } else {
        result = resolveSkillCheckWithContext(context, request, () => session.roll(20));
        edits.push({
          start: plan.check.start,
          end: plan.check.end,
          replacement: serializeResolvedSkillCheckTag(result),
        });
      }
    }

    const half = refusal === null && result ? selectGameBranchHalf(plan.block, result.success) : null;
    if (half) {
      edits.push({ start: plan.block.start, end: plan.block.end, replacement: half.text });
      session.ledger.push({ stage: "branch", outcome: "resolved", span: plan.block.raw.slice(0, LOGGED_SPAN_MAX) });
      continue;
    }

    // Neither half is kept. Any check tag that sat inside the block is re-emitted,
    // because losing the ask is the one thing a refusal may not do.
    edits.push({
      start: plan.block.start,
      end: plan.block.end,
      replacement: plan.block.innerCheckTags.join(" "),
    });
    session.ledger.push({ stage: "branch", outcome: "unreadable", span: plan.block.raw.slice(0, LOGGED_SPAN_MAX) });
    logger.warn(
      "[game/one-request-dice] Refused a branch block in chat %s: %s (%s)%s",
      session.chatId,
      plan.block.raw.slice(0, LOGGED_SPAN_MAX),
      BRANCH_REFUSAL_REASONS[refusal ?? "unmatched-label"],
      result ? " the check was still rolled and recorded" : "",
    );
  }

  edits.sort((left, right) => left.start - right.start);
  let next = "";
  let cursor = 0;
  for (const edit of edits) {
    // Overlapping spans cannot happen: a check tag sitting inside ANY block is excluded
    // from the match map, so no block's resolved-tag edit can ever land inside another
    // block's span. The guard is still a skip rather than a trust, because a splice that
    // silently duplicated prose would be invisible in the saved turn.
    if (edit.start < cursor) continue;
    next += content.slice(cursor, edit.start) + edit.replacement;
    cursor = edit.end;
  }
  next += content.slice(cursor);
  // A half marker or a closer with no opener of its own is left over from a block the
  // walk could not bound. Nothing else on either side reaches those two spellings.
  next = stripGameBranchDelimiters(next);
  return { content: next, changed: next !== content };
}

/**
 * Placeholder arm. The opener walk, resolved and spliced in reading order.
 *
 * Every bounded span is either rolled or replaced with the visible notice, so no raw
 * `[[roll:` can reach saved content for a downstream stripper to half-eat, and nothing
 * is ever substituted with a number the engine did not throw.
 *
 * The chat's sheet is read at most once per turn, and only when a placeholder actually
 * names one: resolving N placeholders in one narration must not mean N snapshot reads,
 * and every roll in one turn must see the same sheet.
 */
export async function resolveGameTurnPlaceholders(
  content: string,
  session: GameTurnChanceSession,
): Promise<GameTurnChanceRewrite> {
  const spans = scanRollPlaceholders(content);
  if (spans.length === 0) return { content, changed: false };

  // The sheet is read only when a body actually names one. A turn of pure `2d6+3`
  // damage needs no snapshot at all, and in the default configuration there is no
  // snapshot to read: agents off means no game-state row was ever created.
  const namesSheet = spans.some(
    (span) => span.refusal === null && parseRollPlaceholderBody(span.body)?.sheetName != null,
  );
  const context = namesSheet ? await session.loadModifierContext() : null;
  const pass = resolveRollPlaceholders(content, {
    nextValue: session.roll,
    ...(context ? { resolveSheetName: (name: string) => resolveSheetModifier(context, name) } : {}),
  });

  for (const record of pass.records) {
    session.diceRolls.push({
      notation: record.notation,
      rolls: record.rolls,
      modifier: record.modifier,
      total: record.total,
    });
    session.placeholders.push(record);
    session.ledger.push({ stage: "placeholder", outcome: "resolved", span: record.raw });
  }
  for (const clamp of pass.clamps) {
    // The shipped policy for this path is to clamp rather than refuse, so the player
    // still gets a number. The log is the only place the difference is visible.
    logger.warn(
      "[game/one-request-dice] Clamped placeholder %s to %s in chat %s",
      clamp.requested,
      clamp.thrown,
      session.chatId,
    );
  }
  for (const refusal of pass.refusals) {
    logRefusedPlaceholder(refusal, session.chatId);
    session.ledger.push({ stage: "placeholder", outcome: "unreadable", span: refusal.raw.slice(0, LOGGED_SPAN_MAX) });
  }
  return { content: pass.content, changed: pass.changed };
}

/** Plain words for each refusal, so the log says what the model did rather than what a flag is called. */
const REFUSAL_REASONS: Record<RollPlaceholderRefusalRecord["reason"], string> = {
  unterminated: "the opener never closed before the line ended",
  "over-long": "the body ran past the length cap",
  "closing-bracket": "the body carried a closing bracket",
  notation: "the body is not one NdM term with at most one flat modifier and one sheet name",
  "unresolved-name": "the named sheet modifier does not resolve for this chat",
};

function logRefusedPlaceholder(refusal: RollPlaceholderRefusalRecord, chatId: string): void {
  logger.warn(
    "[game/one-request-dice] Refused a roll placeholder in chat %s: %s (%s)%s",
    chatId,
    refusal.raw.slice(0, LOGGED_SPAN_MAX),
    REFUSAL_REASONS[refusal.reason],
    refusal.name ? ` name=${refusal.name}` : "",
  );
}

/**
 * Resolve one `+NAME` term against the sheet this turn loaded, or refuse it.
 *
 * The two forms are deliberately not the same sum, and this is the only place that
 * difference is written down:
 *
 *   - `+<attribute>` adds `attributeModifier(score)` and nothing else. `1d8+STR` with
 *     STR 14 adds +2.
 *   - `+<skill>` adds the skill bonus PLUS its governing attribute's modifier, which is
 *     exactly what a skill check already does. `2d6+Athletics` with Athletics +3 and
 *     STR 14 adds +5. Anything else would make two numbers in the same turn follow
 *     different arithmetic with nothing telling the player which was which.
 *
 * A name that resolves to neither returns null, and the placeholder becomes the notice.
 * Refused, never defaulted to zero: a check with an unknown skill still has a defined
 * shape, so the check path's fallback is defensible, but a placeholder's name is only a
 * modifier source, and defaulting it would add a number nobody asked for to a sentence
 * the player reads as fact.
 */
export function resolveSheetModifier(
  context: SkillCheckModifierContext,
  name: string,
): RollPlaceholderSheetModifier | null {
  if (context.ruleset) return resolveRulesetSheetModifier(context.ruleset, name);
  const attribute = mapSheetAttributeName(name);
  if (attribute) {
    const score = readContextAttributeScore(context, attribute);
    if (score === null) return null;
    return { value: attributeModifier(score), source: "attribute" };
  }

  const skills = context.skills;
  const rawSkillMod = skills ? (skills[name] ?? skills[name.toLowerCase()]) : undefined;
  if (rawSkillMod === undefined || !Number.isFinite(Number(rawSkillMod))) return null;
  const governing = readContextAttributeScore(context, getGoverningAttribute(name));
  return {
    value: Number(rawSkillMod) + (governing === null ? 0 : attributeModifier(governing)),
    source: "skill",
  };
}

/** The ruleset form of the same lookup, for the player's sheet: a skill, save or ability by id
 *  or label, plus `PROF` for the proficiency bonus. Unknown names stay refused, never zero. */
function resolveRulesetSheetModifier(
  ruleset: SkillCheckRulesetContext,
  name: string,
): RollPlaceholderSheetModifier | null {
  // A pool ruleset's sheet numbers are counts of dice, not bonuses. Adding one to `2d6+NAME` would
  // put a number in a sentence that means something else entirely, so no name resolves at all.
  if (ruleset.definition.resolution.kind === "dice-pool") return null;
  const sheet = (ruleset.playerKey ? ruleset.sheets.get(ruleset.playerKey) : undefined) ?? ruleset.blank;
  if (/^prof(?:iciency)?$/i.test(name.trim())) {
    return ruleset.definition.resolution.proficiency ? { value: sheet.proficiencyBonus, source: "attribute" } : null;
  }
  const target = matchRulesetCheckTarget(ruleset.definition, name);
  if (!target) return null;
  return {
    value: rulesetCheckModifier(sheet, target),
    source: target.type === "ability" ? "attribute" : "skill",
  };
}

/** The longest skill name the prompt will advertise, and how many. A sheet is not that long. */
const SHEET_NAME_MAX = 40;
const SHEET_NAMES_MAX = 40;

/**
 * The names the prompt may advertise for a `[[roll: 1d8+NAME]]` placeholder this turn.
 *
 * Only names this same module would resolve are listed, and skill names are carried exactly
 * as the sheet spells them rather than re-cased: `resolveSheetModifier` looks a skill up by
 * the written name and then by its lowercase form, so re-casing "sleight_of_hand" into
 * something prettier would print a name that then refuses. An empty view is the normal
 * default configuration, where no game-state snapshot means no skills, and it is what drops the
 * sheet-modifier sentence from the block entirely.
 *
 * A skill key is model-written text from the snapshot, so it is advertised only when the
 * placeholder grammar could read it back: a name with a bracket, a newline or a sign in it
 * can never be written into a placeholder, and printing it would let it reshape the block
 * it is printed into. The list is bounded for the same reason.
 */
export function buildGameSkillModifierView(context: SkillCheckModifierContext): GameSkillModifierView {
  if (context.ruleset) {
    // A ruleset's ids are already placeholder-safe and its own to spell: skills and saves by id,
    // abilities by short label or id, and PROF when the ruleset has a proficiency bonus.
    const { sheet, resolution } = context.ruleset.definition;
    // A pool ruleset resolves none of them, so it advertises none: a name the prompt offers and
    // the resolver then refuses is worse than a block that never mentions sheet modifiers.
    if (resolution.kind === "dice-pool") return { skills: [], attributes: [] };
    const advertised = (names: string[]) =>
      names.filter((name) => name.length <= SHEET_NAME_MAX && isRollPlaceholderName(name)).slice(0, SHEET_NAMES_MAX);
    return {
      skills: advertised([...sheet.skills, ...sheet.saves].map((entry) => entry.id)),
      attributes: advertised([
        ...sheet.abilities.map((ability) => ability.short ?? ability.id),
        ...(resolution.proficiency ? ["PROF"] : []),
      ]),
    };
  }
  const skills: string[] = [];
  for (const [name, value] of Object.entries(context.skills ?? {})) {
    const trimmed = typeof name === "string" ? name.trim() : "";
    // A key with whitespace around it is skipped rather than trimmed: the resolver looks a
    // skill up by the written name and its lowercase form, so the trimmed spelling would
    // be advertised and then refuse.
    if (!trimmed || trimmed !== name || trimmed.length > SHEET_NAME_MAX || !isRollPlaceholderName(trimmed)) continue;
    if (!Number.isFinite(Number(value))) continue;
    skills.push(trimmed);
    if (skills.length >= SHEET_NAMES_MAX) break;
  }

  const attributes: string[] = [];
  for (const [key, label] of SHEET_ATTRIBUTE_LABELS) {
    if (readContextAttributeScore(context, key) !== null) attributes.push(label);
  }

  return { skills, attributes };
}

/**
 * The throw-safe wrapper, and the only way the route calls an arm.
 *
 * An arm that throws does not take the turn with it. The session is marked failed, the
 * error is logged, and this stage's fallback rewrite runs so the content can stand:
 * every `[[roll:` span the scanner still finds becomes a visible notice, and every
 * branch delimiter is stripped. Once a stage has failed the later stage runs its own
 * fallback too rather than its arm, so no raw span can reach saved content by arriving
 * after the failure.
 *
 * The caller must set `contentReplaced` whenever this reports `changed`, including on
 * the fallback rewrite: without it the corrected text is saved but never sent, and the
 * player's streamed view keeps the hole.
 */
export async function runGameTurnChancePass(
  content: string,
  session: GameTurnChanceSession,
  arm: GameTurnChanceArm,
  stage: GameTurnChanceStage,
): Promise<GameTurnChanceRewrite> {
  if (session.failed) return applyChanceFallback(content, session, stage);
  try {
    return await arm(content, session);
  } catch (err) {
    session.failed = true;
    logger.error(err, "[game/one-request-dice] The %s arm failed for chat %s; keeping the turn", stage, session.chatId);
    return applyChanceFallback(content, session, stage);
  }
}

/**
 * The fallback rewrite of the failure contract. Drops the branch blocks at either stage,
 * and sweeps the placeholder spans at the later stage only, so a placeholder inside a
 * package verb's argument still goes away with the verb instead of being rewritten in
 * front of it.
 *
 * The blocks are DROPPED rather than un-delimited, which is the same call 3.5 makes for a
 * block the arm itself refused: a pass that failed rolled nothing, so keeping both halves
 * would save a turn asserting two contradictory outcomes and keeping one would invent the
 * outcome. The check tags inside a dropped block are re-emitted, so the ask survives and
 * the shipped resolver still rolls it.
 */
export function applyChanceFallback(
  content: string,
  session: GameTurnChanceSession,
  stage: GameTurnChanceStage,
): GameTurnChanceRewrite {
  let next = content;
  let changed = false;
  const blocks = dropGameBranchBlocks(next);
  if (blocks.changed) {
    next = blocks.content;
    changed = true;
    for (const block of blocks.blocks) {
      session.ledger.push({ stage, outcome: "unreadable", span: block.slice(0, LOGGED_SPAN_MAX) });
      logger.warn(
        "[game/one-request-dice] Dropped a branch block after the pass failed in chat %s: %s",
        session.chatId,
        block.slice(0, LOGGED_SPAN_MAX),
      );
    }
    if (blocks.blocks.length === 0) {
      session.ledger.push({ stage, outcome: "unreadable", span: "[branch]" });
    }
  }
  if (stage === "placeholder") {
    const placeholders = replaceUnreadablePlaceholders(next, session.chatId);
    if (placeholders.changed) {
      next = placeholders.content;
      changed = true;
      for (const span of placeholders.spans) {
        session.ledger.push({ stage, outcome: "unreadable", span });
      }
    }
  }
  return { content: next, changed };
}

/** Strip `[branch: id]`, `[on success]`, `[on failure]` and `[/branch]`, keeping the prose between them. */
export function stripBranchDelimiters(content: string): GameTurnChanceRewrite {
  const next = stripGameBranchDelimiters(content);
  return { content: next, changed: next !== content };
}

/**
 * Replace every `[[roll:` span with a visible notice, reading none of them. Never with
 * a number: an invented number is read back as fact on the next turn, which is the one
 * thing the shipped never-invent contract forbids without exception.
 *
 * This is the failure path, not the resolution path. The span is always bounded, which
 * is what makes the replacement absolute; the bounding rules live with the scanner in
 * the shared placeholder module, beside the grammar they belong to.
 */
export function replaceUnreadablePlaceholders(
  content: string,
  chatId: string,
): GameTurnChanceRewrite & { spans: string[] } {
  const swept = replaceRollPlaceholdersWithNotice(content);
  const spans = swept.spans.map((span) => span.slice(0, LOGGED_SPAN_MAX));
  for (const span of spans) {
    logger.warn("[game/one-request-dice] Refused an unreadable roll placeholder in chat %s: %s", chatId, span);
  }
  return { content: swept.content, changed: swept.changed, spans };
}

/**
 * The turn notice of the failure contract, for the message extra and the SSE frame.
 * Only truthy fields are written, so a clean turn stores nothing at all and an older
 * transcript reads exactly as it always did.
 */
export function summarizeGameDiceTurn(
  session: GameTurnChanceSession,
  pool?: GameDicePoolSession | null,
): GameDiceTurnNotice | null {
  const forms: Array<"branch" | "placeholder"> = [];
  let unreadablePlaceholders = 0;
  let branchFailures = 0;
  for (const entry of session.ledger) {
    if (entry.outcome === "resolved") {
      if (!forms.includes(entry.stage)) forms.push(entry.stage);
    } else if (entry.stage === "placeholder") {
      unreadablePlaceholders += 1;
    } else {
      branchFailures += 1;
    }
  }
  const notice: GameDiceTurnNotice = {
    ...(forms.length > 0 ? { forms } : {}),
    ...(session.placeholders.length > 0 ? { placeholders: [...session.placeholders] } : {}),
    ...(unreadablePlaceholders > 0 ? { unreadablePlaceholders } : {}),
    ...(branchFailures > 0 ? { branchFailures } : {}),
    ...(session.failed ? { passFailed: true } : {}),
    // The pool's own half, written only while the sub-option is on. A turn that spent
    // nothing and overflowed nothing adds nothing, so a chat that never turned the
    // sub-option on stores exactly what it stored before.
    ...(pool && pool.consumed.length > 0 ? { poolSlots: [...pool.consumed] } : {}),
    ...(pool && pool.overflow > 0 ? { poolOverflow: pool.overflow } : {}),
    ...(pool && pool.mismatches.length > 0 ? { poolMismatches: [...pool.mismatches] } : {}),
  };
  return Object.keys(notice).length > 0 ? notice : null;
}

/**
 * Fold the notice a continuation's new segment produced into the one its earlier segment
 * already saved.
 *
 * A continuation appends to the SAME message and the SAME swipe, and a message-extra
 * update is a shallow merge, so writing the new segment's notice on its own replaces the
 * record wholesale: the first segment's `placeholders[]` disappear, and with them the
 * inline breakdown on numbers the player already read, along with every log line saying
 * what the engine could not roll. The sibling `diceRollResults` retains the earlier
 * segment explicitly for exactly this reason, and this is the same retention.
 *
 * Counts sum, lists concatenate in segment order, `forms` keeps first-seen order, and a
 * fold that has nothing in it is `null` rather than an empty object, so a chat that never
 * rolled anything stores exactly what it stored before.
 *
 * `previous` is typed `unknown` because it comes back off a stored message extra, which is
 * parsed JSON and not a validated shape. Every field is read through a guard, so a
 * transcript carrying something else in that key degrades to "no earlier segment" rather
 * than writing a malformed record back over a good one.
 */
export function mergeGameDiceTurnNotices(
  previous: unknown,
  next: GameDiceTurnNotice | null | undefined,
): GameDiceTurnNotice | null {
  const earlier = readStoredDiceTurnNotice(previous);
  if (!earlier) return next ?? null;
  if (!next) return earlier;

  const forms: Array<"branch" | "placeholder"> = [];
  for (const form of [...(earlier.forms ?? []), ...(next.forms ?? [])]) {
    if (!forms.includes(form)) forms.push(form);
  }
  const placeholders = [...(earlier.placeholders ?? []), ...(next.placeholders ?? [])];
  const poolSlots = [...(earlier.poolSlots ?? []), ...(next.poolSlots ?? [])];
  const poolMismatches = [...(earlier.poolMismatches ?? []), ...(next.poolMismatches ?? [])];
  const unreadablePlaceholders = (earlier.unreadablePlaceholders ?? 0) + (next.unreadablePlaceholders ?? 0);
  const branchFailures = (earlier.branchFailures ?? 0) + (next.branchFailures ?? 0);
  const poolOverflow = (earlier.poolOverflow ?? 0) + (next.poolOverflow ?? 0);

  const merged: GameDiceTurnNotice = {
    ...(forms.length > 0 ? { forms } : {}),
    ...(placeholders.length > 0 ? { placeholders } : {}),
    ...(unreadablePlaceholders > 0 ? { unreadablePlaceholders } : {}),
    ...(branchFailures > 0 ? { branchFailures } : {}),
    ...(earlier.passFailed || next.passFailed ? { passFailed: true } : {}),
    ...(poolSlots.length > 0 ? { poolSlots } : {}),
    ...(poolOverflow > 0 ? { poolOverflow } : {}),
    ...(poolMismatches.length > 0 ? { poolMismatches } : {}),
  };
  return Object.keys(merged).length > 0 ? merged : null;
}

/**
 * Read a stored `gameDiceTurn` back into the shape the fold above expects. Lists keep
 * their elements as written — they were produced by this module and are only being handed
 * back to the same store — but a field of the wrong KIND is dropped, so nothing the fold
 * sums or concatenates can be a non-number or a non-array.
 */
function readStoredDiceTurnNotice(value: unknown): GameDiceTurnNotice | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const stored = value as Record<string, unknown>;
  const list = <Key extends "placeholders" | "poolSlots" | "poolMismatches">(
    key: Key,
  ): GameDiceTurnNotice[Key] | undefined =>
    Array.isArray(stored[key]) && stored[key].length > 0 ? (stored[key] as GameDiceTurnNotice[Key]) : undefined;
  const count = (key: "unreadablePlaceholders" | "branchFailures" | "poolOverflow"): number | undefined => {
    const raw = stored[key];
    return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : undefined;
  };

  const rawForms = Array.isArray(stored.forms) ? stored.forms : [];
  const forms = rawForms.filter(
    (form): form is "branch" | "placeholder" => form === "branch" || form === "placeholder",
  );
  const placeholders = list("placeholders");
  const poolSlots = list("poolSlots");
  const poolMismatches = list("poolMismatches");
  const unreadablePlaceholders = count("unreadablePlaceholders");
  const branchFailures = count("branchFailures");
  const poolOverflow = count("poolOverflow");

  const notice: GameDiceTurnNotice = {
    ...(forms.length > 0 ? { forms } : {}),
    ...(placeholders ? { placeholders } : {}),
    ...(unreadablePlaceholders !== undefined ? { unreadablePlaceholders } : {}),
    ...(branchFailures !== undefined ? { branchFailures } : {}),
    ...(stored.passFailed === true ? { passFailed: true } : {}),
    ...(poolSlots ? { poolSlots } : {}),
    ...(poolOverflow !== undefined ? { poolOverflow } : {}),
    ...(poolMismatches ? { poolMismatches } : {}),
  };
  return Object.keys(notice).length > 0 ? notice : null;
}
