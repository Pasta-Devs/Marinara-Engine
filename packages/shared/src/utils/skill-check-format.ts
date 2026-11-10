import type { SkillCheckResult } from "../types/game.js";

export function getSkillCheckOutcomeLabel(
  result: Pick<SkillCheckResult, "success" | "criticalSuccess" | "criticalFailure" | "outcome" | "symbols">,
): string {
  // A ruleset's own band says it in the ruleset's words, and says whether it succeeded beside it.
  if (result.outcome) return `${result.outcome} (${result.success ? "success" : "failure"})`;
  if (result.symbols) return result.success ? "Success" : "Failure";
  if (result.criticalSuccess) return "Critical success";
  if (result.criticalFailure) return "Critical failure";
  return result.success ? "Success" : "Failure";
}

export function getSkillCheckOutcomeKey(
  result: Pick<SkillCheckResult, "success" | "criticalSuccess" | "criticalFailure" | "symbols">,
): string {
  if (result.symbols) return result.success ? "success" : "failure";
  if (result.criticalSuccess) return "critical_success";
  if (result.criticalFailure) return "critical_failure";
  return result.success ? "success" : "failure";
}

/**
 * Whether the dice literally sum to the total, so a "a + b + c = total"
 * breakdown is a true statement.
 *
 * False for advantage/disadvantage (only one die counts) and for pool systems
 * that count successes rather than add pips. Callers must not render an
 * addition unless this holds — the alternative is a card that asserts
 * arithmetic nobody performed. Deliberately checks the numbers instead of
 * asking which rules system is in play, so systems the engine has never heard
 * of still display honestly.
 */
export function skillCheckDiceSumToTotal(
  result: Pick<SkillCheckResult, "rolls" | "modifier" | "total" | "resolution" | "symbols">,
): boolean {
  return (
    !result.symbols &&
    result.resolution === "sum" &&
    result.rolls.reduce((sum, roll) => sum + roll, 0) + result.modifier === result.total
  );
}

/** A face's worth as a card shows it: the die's own number, or its value where the ruleset gives its
 *  faces values (1.136), signed so Fate's dice read -1, 0, +1. */
export function skillCheckFaceText(result: Pick<SkillCheckResult, "faces">, face: number): string {
  if (!result.faces) return String(face);
  const worth = result.faces[face - 1];
  if (worth === undefined) return String(face);
  return worth > 0 ? `+${worth}` : String(worth);
}

/** The net narrative symbols, in the ruleset's own words. Empty is left to each caller's locale. */
export function skillCheckSymbolText(result: Pick<SkillCheckResult, "symbols" | "symbolLabels">): string {
  return Object.entries(result.symbols ?? {})
    .map(([id, count]) => `${count} ${result.symbolLabels?.[id] ?? id}`)
    .join(", ");
}

/** The dice kept for a light-only outcome. Indices keep tied dark dice out of the highlight. */
export function skillCheckLightKeptIndices(
  result: Pick<SkillCheckResult, "rolls" | "dark" | "darkOutcome" | "highest" | "zeroDice">,
): number[] | undefined {
  if (result.darkOutcome !== "light" || !result.highest) return undefined;
  return result.rolls
    .slice(0, Math.max(0, result.rolls.length - (result.dark ?? 0)))
    .map((face, index) => ({ face, index }))
    .sort((a, b) => (result.zeroDice ? a.face - b.face : b.face - a.face))
    .slice(0, result.zeroDice ? 1 : result.highest)
    .map(({ index }) => index);
}

export function formatSkillCheckResultSummary(result: SkillCheckResult): string {
  if (result.symbols) {
    return `${result.skill} check (${result.dc} difficulty dice): ${skillCheckSymbolText(result) || "no net symbols"}. ${getSkillCheckOutcomeLabel(result)}.`;
  }
  const modifier = result.modifier === 0 ? "" : ` ${result.modifier > 0 ? "+" : ""}${result.modifier}`;
  const rollMode = result.rollMode !== "normal" ? ` (${result.rollMode})` : "";
  // Only claim the dice add up to the total when they actually do; otherwise
  // report the total on its own so the GM reads back what the player saw.
  const arithmetic = skillCheckDiceSumToTotal(result)
    ? `[${result.rolls.join(", ")}]${modifier}${rollMode} = ${result.total}`
    : `[${result.rolls.map((face) => skillCheckFaceText(result, face)).join(", ")}]${result.resolution === "successes" ? "" : modifier}${rollMode} → ${result.total}${result.resolution === "successes" ? ` ${result.total === 1 ? "success" : "successes"}` : ""}`;
  // A complication is alongside the outcome, never instead of it, so the outcome is still said first.
  const complication = result.complication ? " Something went wrong on the side." : "";
  const unmodified = result.unmodified !== undefined ? ` Unmodified ${result.unmodified}.` : "";
  const exact = result.exact
    ? ` ${result.exact} ${result.exact === 1 ? "die" : "dice"} showed exactly ${result.threshold}${result.exactLabel ? `: ${result.exactLabel}` : ""}.`
    : "";
  // A keep-the-highest check (1.138) says which dice it read; the dark dice are the last ones thrown.
  const highest = result.highest
    ? result.darkOutcome === "light" && result.rolls.length === (result.dark ?? 0)
      ? " No light dice: the check failed."
      : result.zeroDice
        ? " No dice: the lower of two was kept."
        : ` Highest ${result.highest === 1 ? "die" : `${result.highest} dice`} kept.`
    : "";
  const dark = result.dark
    ? ` ${result.dark} ${result.darkLabel ?? "dark"} ${result.dark === 1 ? "die" : "dice"} (the last ${result.dark === 1 ? "one" : result.dark})${result.darkHighest ? `; a ${result.darkLabel ?? "dark"} die rolled highest` : ""}.`
    : "";
  // A roll at most a target (1.139) says so, because "DC 45" would read as needing 45 or more.
  const needed = result.against === "at-most" ? `at most ${result.dc}` : `DC ${result.dc}`;
  return `${result.skill} check (${needed}): ${arithmetic}. ${getSkillCheckOutcomeLabel(result)}.${complication}${unmodified}${exact}${highest}${dark}${result.darkOutcome === "light" ? " Only light dice decide the outcome." : ""}`;
}

function serializeSkillCheckAttribute(value: string): string {
  return value.replace(/["\r\n]/g, "'").trim();
}

/**
 * The request half of a check tag, with no numbers claimed for it.
 *
 * This is what a resolution failure has to be able to write. When the roll
 * cannot happen — the chat's modifiers will not load, say — the turn still has
 * to be saved, and the one thing that must never be saved is the model's own
 * `rolls=`/`total=`/`result=` on a check nobody rolled: that invention is read
 * back as fact next turn, which is the entire dishonesty the engine took the die
 * away to end. So the numbers are dropped and the ask is kept.
 *
 * Nothing here is invented in their place. Only what the GM declared and this
 * reader vouched for is written back: the skill, the DC, the mode when one was
 * declared, the player's own die when they rolled it, the dice label when the GM
 * wrote one. Re-reading the result yields the same request and the same
 * `isEngineRollableSkillCheckTag` verdict, so the check is still owed a roll and
 * the client's fallback can still ask for one.
 */
/**
 * Attributes appended after everything a check tag has always carried.
 *
 * Both are optional and both render nothing when absent, so every shipped call site
 * writes the same bytes it has always written and no already-saved transcript changes
 * how it reads. `threshold=` used to be spliced onto the end of a finished tag by the
 * one caller that needed it; it is written here now so the two spellings cannot drift.
 */
export interface SkillCheckTagExtras {
  /** Per-die threshold for a success pool, when the GM declared a usable one. */
  threshold?: number;
  /** `pool="d20:1"` — the slot the engine actually spent, never the one the model claimed. */
  pool?: string;
  /** `who="Name"` — the party member a ruleset game rolled for. Written only by that path. */
  who?: string;
  /** `with="Ability"` — the ability a ruleset check rolled with instead of the skill's own. */
  with?: string;
  /** `bonus="+2"` — dice a pool ruleset added or took for this check. Written only by that path. */
  bonus?: number;
  /** `spend="willpower:1"` — what the check actually paid, never what the model asked to pay. */
  spend?: string;
  /** `auto="2"` — successes a spend added that nobody rolled, so a reader can tell them apart. */
  auto?: number;
  /** `use="Potence"` — the catalog entry the check actually applied, never one it could not. */
  use?: string;
  /** `rerolled="3"` — how many dice a bought re-throw replaced. */
  rerolled?: number;
  /** The wound penalty already applied by the Engine. */
  penalty?: number;
  /** `difficulty="Grim"` — the ladder step a sparse ask named. Only ever the ask: a rolled record
   *  says the numbers the step stood for instead. */
  difficulty?: string;
  /** `explode="9"` / `double="9"` — the face a pool check moved the rule to, or the ask for it. */
  explode?: number;
  double?: number;
  /** `complication="true"` — the roll went wrong on the side without botching outright. */
  complication?: boolean;
  /** `adjust="-2"` — what the sheet itself added to or took off the check. */
  adjust?: number;
  /** `reroll="rote"` — the standing re-throw the check applied, or the ask for one. */
  reroll?: string;
  /** `reason="untrained"` — the Engine did not roll the check, because the character cannot attempt
   *  it untrained; `reason="unknown-roller"`, because it picks out no one party member. Only ever on an ask. */
  reason?: "untrained" | "unknown-roller";
  /** `effects="-1"` — what the character's conditions and worn or carried items added or took. */
  effects?: number;
  /** `from="Poisoned; Leather coat"` — the conditions and items that changed the check. */
  from?: string[];
  /** `automatic="true"` — the save failed without a roll. */
  automatic?: boolean;
  /** `outcome="Barely"` — the ruleset's outcome band the check landed in (1.135). */
  outcome?: string; /** `faces="-1|0|1"` — what each face of the die is worth (1.136). */
  faces?: number[];
  /** `unmodified="66"` — the single die's face, rolled unmodified (1.136). */
  unmodified?: number;
  /** `compare="below"` — a stance made the pool's dice count below or above the target (1.137). */
  compare?: "below" | "above";
  /** `exact="1" exactLabel="LASER FEELINGS"` — dice that showed exactly the target (1.137). */
  exact?: number;
  exactLabel?: string;
  /** `highest="1"` — a keep-the-highest check and how many dice it kept; `zeroDice="true"` — no
   *  dice, the lower of two kept (1.138). */
  highest?: number;
  zeroDice?: boolean;
  /** `dark="2" darkLabel="Dark" darkHighest="true"` — the dark dice at the end of `rolls` (1.138). */
  dark?: number;
  darkLabel?: string;
  darkHighest?: boolean;
  darkOutcome?: "light";
  /** `against="at-most"` and `tens="+1"` — a roll read against the sheet's number (1.139). */
  against?: "at-most" | "at-least";
  tens?: number;
  upgrade?: number;
  setback?: number;
  upgradeOwn?: number;
  symbols?: Record<string, number>;
  thrown?: string[];
  symbolLabels?: Record<string, string>;
  symbolFaces?: string[][];
  criticalSuccess?: boolean;
  criticalFailure?: boolean;
  /** `for="climb"` (1.752): what the check was made for, which a change narrowed to it read. */
  for?: string;
}

/** A name in `from=`: no brackets, which would end the tag, and no semicolons, which part the names. */
function fromName(name: string): string {
  return serializeSkillCheckAttribute(name.replace(/[[\];]/g, " ").replace(/\s+/g, " "));
}

function serializeSkillCheckExtras(extras: SkillCheckTagExtras | undefined): string {
  if (!extras) return "";
  const parts: string[] = [];
  if (extras.threshold != null && Number.isFinite(extras.threshold)) parts.push(`threshold="${extras.threshold}"`);
  if (extras.pool) parts.push(`pool="${serializeSkillCheckAttribute(extras.pool)}"`);
  if (extras.who) parts.push(`who="${serializeSkillCheckAttribute(extras.who)}"`);
  // Appended after everything a tag has always carried, so no shipped call site changes its bytes.
  if (extras.with) parts.push(`with="${serializeSkillCheckAttribute(extras.with)}"`);
  if (extras.bonus != null && Number.isFinite(extras.bonus)) {
    parts.push(`bonus="${extras.bonus > 0 ? "+" : ""}${extras.bonus}"`);
  }
  if (extras.spend) parts.push(`spend="${serializeSkillCheckAttribute(extras.spend)}"`);
  if (extras.auto != null && Number.isFinite(extras.auto) && extras.auto > 0) parts.push(`auto="${extras.auto}"`);
  if (extras.use) parts.push(`use="${serializeSkillCheckAttribute(extras.use)}"`);
  if (extras.rerolled != null && Number.isFinite(extras.rerolled) && extras.rerolled > 0) {
    parts.push(`rerolled="${extras.rerolled}"`);
  }
  if (extras.penalty != null && Number.isFinite(extras.penalty) && extras.penalty < 0) {
    parts.push(`penalty="${extras.penalty}"`);
  }
  if (extras.difficulty) parts.push(`difficulty="${serializeSkillCheckAttribute(extras.difficulty)}"`);
  if (extras.explode != null && Number.isFinite(extras.explode)) parts.push(`explode="${extras.explode}"`);
  if (extras.double != null && Number.isFinite(extras.double)) parts.push(`double="${extras.double}"`);
  if (extras.complication) parts.push(`complication="true"`);
  if (extras.adjust != null && Number.isFinite(extras.adjust) && extras.adjust !== 0) {
    parts.push(`adjust="${extras.adjust > 0 ? "+" : ""}${extras.adjust}"`);
  }
  if (extras.reroll) parts.push(`reroll="${serializeSkillCheckAttribute(extras.reroll)}"`);
  if (extras.reason) parts.push(`reason="${extras.reason}"`);
  if (extras.effects != null && Number.isFinite(extras.effects) && extras.effects !== 0) {
    parts.push(`effects="${extras.effects > 0 ? "+" : ""}${extras.effects}"`);
  }
  const from = (extras.from ?? []).map(fromName).filter(Boolean);
  if (from.length > 0) parts.push(`from="${from.join("; ")}"`);
  if (extras.automatic) parts.push(`automatic="true"`);
  if (extras.outcome) parts.push(`outcome="${serializeSkillCheckAttribute(extras.outcome)}"`);
  if (extras.faces?.length) parts.push(`faces="${extras.faces.join("|")}"`);
  if (extras.unmodified != null && Number.isInteger(extras.unmodified)) parts.push(`unmodified="${extras.unmodified}"`);
  if (extras.compare) parts.push(`compare="${extras.compare}"`);
  if (extras.exact != null && Number.isInteger(extras.exact) && extras.exact > 0) {
    parts.push(`exact="${extras.exact}"`);
    if (extras.exactLabel) parts.push(`exactLabel="${serializeSkillCheckAttribute(extras.exactLabel)}"`);
  }
  if (extras.highest != null && Number.isInteger(extras.highest) && extras.highest > 0) {
    parts.push(`highest="${extras.highest}"`);
    if (extras.zeroDice) parts.push(`zeroDice="true"`);
  }
  if (extras.upgrade != null && Number.isInteger(extras.upgrade) && extras.upgrade >= 0)
    parts.push(`upgrade="${extras.upgrade}"`);
  for (const key of ["setback", "upgradeOwn"] as const) {
    const value = extras[key];
    if (value != null && Number.isInteger(value) && value >= 0) parts.push(`${key}="${value}"`);
  }
  if (extras.darkOutcome === "light") parts.push('darkOutcome="light"');
  if (extras.symbols) {
    parts.push(
      `symbols="${Object.entries(extras.symbols)
        .map(([id, count]) => `${count}${id}`)
        .join(" ")}"`,
    );
    parts.push(`thrown="${(extras.thrown ?? []).join("|")}"`);
    // URI encoding keeps arbitrary labels, including quotes and tag brackets, inside one attribute.
    parts.push(
      `symbolDetails="${encodeURIComponent(
        JSON.stringify({
          labels: extras.symbolLabels ?? {},
          faces: extras.symbolFaces ?? [],
          criticalSuccess: !!extras.criticalSuccess,
          criticalFailure: !!extras.criticalFailure,
        }),
      ).replace(/'/g, "%27")}"`,
    );
  }
  if (extras.against) parts.push(`against="${extras.against}"`);
  if (extras.tens != null && Number.isInteger(extras.tens) && extras.tens !== 0) {
    parts.push(`tens="${extras.tens > 0 ? "+" : ""}${extras.tens}"`);
  }
  if (extras.dark != null && Number.isInteger(extras.dark) && extras.dark > 0) {
    parts.push(`dark="${extras.dark}"`);
    if (extras.darkLabel) parts.push(`darkLabel="${serializeSkillCheckAttribute(extras.darkLabel)}"`);
    if (extras.darkHighest) parts.push(`darkHighest="true"`);
  }
  if (extras.for) parts.push(`for="${serializeSkillCheckAttribute(extras.for)}"`);
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

export function serializeSparseSkillCheckTag(
  request: {
    skill: string;
    /** Absent on an ask that named its difficulty with `difficulty=` instead; see the extras. */
    dc?: number;
    advantage?: boolean;
    disadvantage?: boolean;
    preRolledD20?: number;
    declaredDice?: string;
    declaredResolution?: string;
  },
  extras?: SkillCheckTagExtras,
): string {
  const parts = [`[skill_check: skill="${serializeSkillCheckAttribute(request.skill)}"`];
  if (request.dc != null && Number.isFinite(request.dc)) parts.push(`dc="${request.dc}"`);
  if (request.preRolledD20 != null) parts.push(`rolls="${request.preRolledD20}"`);
  if (request.advantage && !request.disadvantage) parts.push(`mode="advantage"`);
  else if (request.disadvantage && !request.advantage) parts.push(`mode="disadvantage"`);
  if (request.declaredDice) parts.push(`dice="${serializeSkillCheckAttribute(request.declaredDice)}"`);
  if (request.declaredResolution)
    parts.push(`resolution="${serializeSkillCheckAttribute(request.declaredResolution)}"`);
  return `${parts.join(" ")}${serializeSkillCheckExtras(extras)}]`;
}

export function serializeResolvedSkillCheckTag(result: SkillCheckResult, extras?: SkillCheckTagExtras): string {
  // A result that carries its own `who` or per-die threshold writes them without the caller
  // repeating itself. An explicit extra still wins: a caller that passes one is the path that
  // measured it, and the legacy pool path has always passed its own.
  const merged: SkillCheckTagExtras = {
    ...(result.threshold != null ? { threshold: result.threshold } : {}),
    ...(result.who ? { who: result.who } : {}),
    ...(result.withAbility ? { with: result.withAbility } : {}),
    ...(result.purpose ? { for: result.purpose } : {}),
    ...(result.bonusDice ? { bonus: result.bonusDice } : {}),
    ...(result.spent ? { spend: `${result.spent.pool}:${result.spent.amount}` } : {}),
    ...(result.autoSuccesses ? { auto: result.autoSuccesses } : {}),
    ...(result.used ? { use: result.used } : {}),
    ...(result.rerolled ? { rerolled: result.rerolled } : {}),
    ...(result.penalty != null ? { penalty: result.penalty } : {}),
    ...(result.explodeFrom != null ? { explode: result.explodeFrom } : {}),
    ...(result.doubleFrom != null ? { double: result.doubleFrom } : {}),
    ...(result.complication ? { complication: true } : {}),
    ...(result.adjust ? { adjust: result.adjust } : {}),
    ...(result.reroll ? { reroll: result.reroll } : {}),
    ...(result.effects ? { effects: result.effects } : {}),
    ...(result.from?.length ? { from: result.from } : {}),
    ...(result.automatic ? { automatic: true } : {}),
    ...(result.outcome ? { outcome: result.outcome } : {}),
    ...(result.faces?.length ? { faces: result.faces } : {}),
    ...(result.unmodified !== undefined ? { unmodified: result.unmodified } : {}),
    ...(result.compare ? { compare: result.compare } : {}),
    ...(result.exact ? { exact: result.exact, ...(result.exactLabel ? { exactLabel: result.exactLabel } : {}) } : {}),
    ...(result.symbols
      ? {
          symbols: result.symbols,
          setback: result.setback,
          upgradeOwn: result.upgradeOwn,
          thrown: result.thrown,
          symbolLabels: result.symbolLabels,
          symbolFaces: result.symbolFaces,
          criticalSuccess: result.criticalSuccess,
          criticalFailure: result.criticalFailure,
        }
      : {}),
    ...(result.against ? { against: result.against } : {}),
    ...(result.tens ? { tens: result.tens } : {}),
    ...(result.highest ? { highest: result.highest, ...(result.zeroDice ? { zeroDice: true } : {}) } : {}),
    ...(result.darkOutcome ? { darkOutcome: result.darkOutcome } : {}),
    ...(result.dark
      ? {
          dark: result.dark,
          ...(result.darkLabel ? { darkLabel: result.darkLabel } : {}),
          ...(result.darkHighest ? { darkHighest: true } : {}),
        }
      : {}),
    // An extra a caller left undefined is absent, not an instruction to erase what the result says.
    ...Object.fromEntries(Object.entries(extras ?? {}).filter(([, value]) => value !== undefined)),
  };
  return `${[
    `[skill_check: skill="${serializeSkillCheckAttribute(result.skill)}"`,
    `dc="${result.dc}"`,
    `rolls="${result.rolls.join("|")}"`,
    `used="${result.usedRoll}"`,
    `modifier="${result.modifier}"`,
    `total="${result.total}"`,
    `result="${getSkillCheckOutcomeKey(result)}"`,
    `mode="${result.rollMode}"`,
    `resolution="${result.resolution}"`,
    `dice="${serializeSkillCheckAttribute(result.dice ?? "1d20")}"`,
  ].join(" ")}${serializeSkillCheckExtras(merged)}]`;
}
