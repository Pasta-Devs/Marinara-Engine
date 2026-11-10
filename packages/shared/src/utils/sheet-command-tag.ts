// ──────────────────────────────────────────────
// Sheet command tag — `[sheet: op="spend" ...]`
//
// The Game Master writes what happened to a character
// sheet; the Engine owns whether it may happen. So this
// reader takes the REQUEST and nothing else: a `result`,
// `reason` or `now` attribute in the input is dropped on
// the floor, because a model that may write its own
// outcome can spend a slot it does not have simply by
// saying it did. The Engine applies the command and
// rewrites the tag with the outcome it actually got.
// ──────────────────────────────────────────────

import { RULESET_SHEET_OP_NAMES, type RulesetSheetOp } from "../features/rulesets/live-state.js";
import { readGmTagAttributes } from "./skill-check-tag.js";

/** Longest body a sheet tag can carry. The longest honest one is a note with a 500-character value;
 *  the bound is what keeps a reply full of unclosed `[sheet:` heads from costing a scan to the end
 *  of the text for every one of them. */
const MAX_SHEET_TAG_BODY = 1500;

/** A fresh global, case-insensitive matcher over `[sheet: ...]` tags. The body is ONE bounded run of
 *  anything but `]`: no `\s*` in front of it, because two adjacent runs that can both take a space
 *  are what makes a regex backtrack polynomially. The body is trimmed by whoever reads it. */
export function createSheetCommandTagRegex(): RegExp {
  return new RegExp(`\\[sheet:([^\\]]{0,${MAX_SHEET_TAG_BODY}})\\]`, "gi");
}

/** The tag and one space on either side, so removing it does not leave a doubled space behind. */
function createSheetCommandStripRegex(): RegExp {
  return new RegExp(`([^\\S\\r\\n]?)\\[sheet:[^\\]]{0,${MAX_SHEET_TAG_BODY}}\\]([^\\S\\r\\n]?)`, "gi");
}

export interface ParsedSheetCommandTag {
  sheet?: string;
  who?: string;
  /** Null when the tag names no op this Engine has, or is missing what that op needs. */
  op: RulesetSheetOp | null;
  /** The value the Game Master said it leaves, as they wrote it. */
  claimed?: string;
}

/** Longest name a `who=` may carry, the same ceiling the check tag uses. */
const MAX_WHO_LENGTH = 100;
/** Every attribute the Engine writes back is capped here, so one tag can never run away. */
const MAX_ATTRIBUTE_LENGTH = 120;

function readAttributes(body: string): Map<string, string> {
  const values = new Map<string, string>();
  const attributes = readGmTagAttributes(body);
  attributes.forEach((attribute, index) => {
    const key = attribute.key.trim().toLowerCase();
    // An unquoted value runs to the next attribute, as an inventory tag's does, so a name whose
    // quotes a rewrite lost (`who=Ulfgar Stonejaw op=damage`) is the whole name.
    const quoted = /^["']/.test(attribute.rawValue);
    const raw = quoted
      ? attribute.rawValue
      : body.slice(attribute.end - attribute.rawValue.length, attributes[index + 1]?.start ?? body.length);
    const rawValue = raw.trim();
    if (!key || !rawValue) return;
    values.set(key, rawValue.replace(/^['"]|['"]$/g, ""));
  });
  return values;
}

/** A signed integer, bounded by its digit count so a long run of digits cannot cost anything. */
function readInteger(value: string | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed || !/^[+-]?\d{1,9}$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function readOpName(raw: string | undefined): RulesetSheetOp["op"] | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  // `heal` and `cast` are the words a Game Master reaches for; they are the same commands as
  // `restore` and `use`.
  if (value === "heal") return "restore";
  if (value === "cast") return "use";
  return (RULESET_SHEET_OP_NAMES as readonly string[]).includes(value) ? (value as RulesetSheetOp["op"]) : null;
}

function readState(raw: string | undefined): boolean | null {
  const value = raw?.trim().toLowerCase();
  if (value === undefined || value === "") return true; // a bare condition command turns it on
  if (value === "on" || value === "add" || value === "true") return true;
  if (value === "off" || value === "remove" || value === "false") return false;
  return null;
}

/** Read one `[sheet: ...]` body into the command it asks for. Never throws; an unreadable body
 *  comes back with `op: null`, which the caller records as a refusal rather than dropping. */
export function parseSheetCommandTagBody(body: string): ParsedSheetCommandTag {
  const values = readAttributes(body);
  const whoValue = values.get("who")?.trim();
  const who = whoValue ? whoValue.slice(0, MAX_WHO_LENGTH) : undefined;
  const sheet = values.get("sheet");
  // A `now=` beside a `result=` is an Engine record the model copied into its own tag, not a claim
  // about this command, so it never marks the command as already paid (cheap-GM playtest 2026-10-26:
  // models copy the Engine's outcome fields into new tags). The command is read as a fresh request.
  const claimed = values.has("result") ? undefined : values.get("now")?.trim().slice(0, MAX_ATTRIBUTE_LENGTH);
  const parsed: ParsedSheetCommandTag = {
    op: null,
    ...(who ? { who } : {}),
    ...(sheet !== undefined ? { sheet } : {}),
    ...(claimed ? { claimed } : {}),
  };
  const name = readOpName(values.get("op"));
  if (!name) return parsed;

  if (name === "spend" || name === "restore" || name === "damage" || name === "temp") {
    const amount = readInteger(values.get("amount"));
    // A `damage` that names a track is a mark on a WOUND track. The kind is what the ruleset calls
    // the harm; the pool form is untouched, so a ruleset whose health is a pool reads as it always did.
    const track = values.get("track")?.trim();
    if (name === "damage" && track) {
      // A mark has to say what it is; a heal may leave the kind out, and then clears the lightest.
      const kind = values.get("kind")?.trim() ?? "";
      if (amount === null || (amount >= 0 && !kind)) return parsed;
      // Where the mark aims on an indexed track. A box that does not read as a number is a tag that
      // does not say what it means, so it is refused rather than dropped to box 1.
      const rawBox = values.get("box");
      const box = rawBox === undefined ? null : readInteger(rawBox);
      if (rawBox !== undefined && box === null) return parsed;
      return { ...parsed, op: { op: "damage", track, kind, amount, ...(box !== null ? { box } : {}) } };
    }
    const pool = values.get("pool")?.trim();
    if (amount === null) return parsed;
    // Harm, a heal or a shield that names no pool is health's, which the sheet pass fills in from
    // the ruleset (laptop 2026-10-25: an injury written as `op="damage" amount="1"` refused). A spend
    // has to say what it spends.
    if (!pool && name === "spend") return parsed;
    return { ...parsed, op: { op: name, pool: pool ?? "", amount } };
  }
  if (name === "advance") {
    const targets = ["field", "ability", "skill", "save"].filter((key) => values.has(key));
    if (targets.length !== 1) return parsed;
    const target = targets[0]!;
    const requested = values.get(target)?.trim();
    if (!requested) return parsed;
    if (target === "skill" || target === "save") {
      const tier = values.get("tier")?.trim();
      if (!tier || values.has("to") || values.has("by")) return parsed;
      return {
        ...parsed,
        op: target === "skill" ? { op: "advance", skill: requested, tier } : { op: "advance", save: requested, tier },
      };
    }
    if (values.has("to") === values.has("by") || values.has("tier")) return parsed;
    const to = values.get("to");
    const raw = values.get("by") ?? to;
    const numeric = raw !== undefined && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw.trim()) ? Number(raw) : NaN;
    if ((target === "ability" || values.has("by")) && !Number.isFinite(numeric)) return parsed;
    if (target === "ability")
      return {
        ...parsed,
        op: { op: "advance", ability: requested, ...(to === undefined ? { by: numeric } : { to: numeric }) },
      };
    return { ...parsed, op: { op: "advance", field: requested, ...(to === undefined ? { by: numeric } : { to }) } };
  }
  if (name === "track") {
    const track = values.get("track")?.trim();
    const to = readInteger(values.get("to"));
    const by = readInteger(values.get("by"));
    // Exactly one of the two, or the tag does not say what it means.
    if (!track || (to === null) === (by === null)) return parsed;
    // `upto=` (1.364) only stops a move by some amount; beside `to=` it says nothing anyone could mean.
    const upTo = values.has("upto") ? readInteger(values.get("upto")) : undefined;
    if (upTo === null || (upTo !== undefined && to !== null)) return parsed;
    return {
      ...parsed,
      op:
        to !== null
          ? { op: "track", track, to }
          : { op: "track", track, by: by!, ...(upTo !== undefined ? { upTo } : {}) },
    };
  }
  if (name === "condition") {
    const condition = values.get("condition")?.trim();
    const active = readState(values.get("state"));
    if (!condition || active === null) return parsed;
    return { ...parsed, op: { op: "condition", condition, active } };
  }
  if (name === "state") {
    // `state=` names the state here; on a condition it is on or off. The op decides which.
    const state = values.get("state")?.trim();
    const value = values.get("value")?.trim();
    if (!state || !value) return parsed;
    return { ...parsed, op: { op: "state", state, value } };
  }
  if (name === "note") {
    const field = values.get("field")?.trim();
    if (!field) return parsed;
    // An absent value is how a note is cleared; the field still has to be named.
    return { ...parsed, op: { op: "note", field, value: values.get("value") ?? "" } };
  }
  if (name === "pass") {
    // Days of game time (1.445): a whole count.
    const days = readInteger(values.get("days"));
    if (days === null || days < 1) return parsed;
    // Spent resting (1.756): yes, true or on.
    const resting = /^(yes|true|on)$/i.test(values.get("resting")?.trim() ?? "");
    return { ...parsed, op: { op: "pass", days, ...(resting ? { resting: true as const } : {}) } };
  }
  if (name === "use") {
    // `spell=` is the word that goes with `cast=`; both are read as the general `name=`.
    const entry = (values.get("name") ?? values.get("spell"))?.trim();
    const pool = values.get("pool")?.trim();
    // A use that names only the pool it pays is that pool's spend (cheap-GM playtest 2026-10-26: a
    // slot written as `op="use" pool="spell_slots_2"` was refused, so the spell cost nothing).
    if (!entry) {
      const amount = values.has("amount") ? readInteger(values.get("amount")) : 1;
      return pool && amount !== null ? { ...parsed, op: { op: "spend", pool, amount } } : parsed;
    }
    // What it gives back (1.410): `recover="Level 1 Slot:2, Level 2 Slot:1"`, a count after each pool.
    const rawRecover = values.get("recover");
    const recover = rawRecover === undefined ? [] : readRecover(rawRecover);
    if (recover === null) return parsed;
    // The creature it calls (1.798): `as="Owl"`, for a call that stays once the use is done.
    const as = values.get("as")?.trim();
    // As a ritual (1.807): yes, true or on.
    const ritual = /^(yes|true|on)$/i.test(values.get("ritual")?.trim() ?? "");
    return {
      ...parsed,
      op: {
        op: "use",
        name: entry,
        ...(pool ? { pool } : {}),
        ...(recover.length ? { recover } : {}),
        ...(as ? { as } : {}),
        ...(ritual ? { ritual: true as const } : {}),
      },
    };
  }
  if (name === "dismiss") {
    // What a use outside a fight called and kept (1.798), by the entry's name or the creature's.
    const entry = values.get("name")?.trim();
    if (!entry) return parsed;
    return { ...parsed, op: { op: "dismiss", name: entry } };
  }
  if (name === "prepare" || name === "unprepare") {
    // What a caster has ready, changed in the story; `spell=` is read as `name=`, as on a use.
    const entry = (values.get("name") ?? values.get("spell"))?.trim();
    if (!entry) return parsed;
    return { ...parsed, op: { op: name, name: entry } };
  }
  const rest = values.get("rest")?.trim();
  if (!rest) return parsed;
  // Dice spent to heal on it (1.335): a count, or the tag does not say what it means.
  const rawDice = values.get("dice");
  const dice = rawDice === undefined ? null : readInteger(rawDice);
  if (rawDice !== undefined && (dice === null || dice < 0)) return parsed;
  // From one pool of several (1.337): 5e's d8 hit dice.
  const pool = dice ? values.get("pool")?.trim() : undefined;
  // A feature it offers as it ends (1.789): `use="Arcane Recovery"`, and what it gives back, if picked.
  const use = values.get("use")?.trim();
  const rawRecover = use ? values.get("recover") : undefined;
  const recover = rawRecover === undefined ? [] : readRecover(rawRecover);
  if (recover === null) return parsed;
  return {
    ...parsed,
    op: {
      op: "rest",
      rest,
      ...(dice ? { dice } : {}),
      ...(pool ? { pool } : {}),
      ...(use ? { use } : {}),
      ...(recover.length ? { recover } : {}),
    },
  };
}

/** Pools and counts, `Pool:2, Other:1`; a pool without a count is one of it. Null when a count is not
 *  a whole number above 0. */
function readRecover(raw: string): Array<{ pool: string; count: number }> | null {
  const out: Array<{ pool: string; count: number }> = [];
  for (const part of raw.split(",")) {
    const text = part.trim();
    if (!text) continue;
    const colon = text.lastIndexOf(":");
    const pool = (colon < 0 ? text : text.slice(0, colon)).trim();
    const count = colon < 0 ? 1 : readInteger(text.slice(colon + 1).trim());
    if (!pool || count === null || count < 1) return null;
    out.push({ pool, count });
  }
  return out;
}

/** The outcome summary (`now`) of a command for the whole party lists one value per member, so it
 *  gets more room than an ordinary attribute: a long rest for four casters reads every pool back. */
export const SHEET_COMMAND_NOW_MAX_LENGTH = 600;

/** A party command's entries, one per member, joined to fit the summary. Where they cannot all fit,
 *  the last say how many more there were, so the record never reads as if a member was left out
 *  (playtest: a long rest whose summary named three of four). `whole` (the members it was refused
 *  for) is never cut into: only `entries` are counted off, so "and N more" can only stand for ones
 *  it applied to. */
export function joinSheetSummary(
  entries: readonly string[],
  limit = SHEET_COMMAND_NOW_MAX_LENGTH,
  whole: readonly string[] = [],
): string {
  const all = [...entries, ...whole].join("; ");
  if (all.length <= limit) return all;
  for (let kept = entries.length - 1; kept > 0; kept--) {
    const joined = [...entries.slice(0, kept), `and ${entries.length - kept} more`, ...whole].join("; ");
    if (joined.length <= limit) return joined;
  }
  return truncateSheetSummary(all, limit);
}

/** Cut a `; `-joined summary to a limit without splitting an entry in half. */
export function truncateSheetSummary(value: string, limit: number): string {
  if (value.length <= limit) return value;
  const cut = value.slice(0, limit);
  const lastSeparator = cut.lastIndexOf("; ");
  return lastSeparator > 0 ? cut.slice(0, lastSeparator) : cut;
}

/** Sheet text is user- and model-authored, and it is about to be written back inside a tag. A
 *  quote, a bracket or a line break would reshape the tag or take the shape of another one. */
function sanitizeSheetTagValue(value: string, limit = MAX_ATTRIBUTE_LENGTH): string {
  return truncateSheetSummary(
    value
      .replace(/[\p{Cc}\p{Zl}\p{Zp}"[\]]/gu, " ")
      .replace(/\s{2,}/g, " ")
      .trim(),
    limit,
  ).trim();
}

export type SheetCommandTagOutcome = { ok: true; now: string } | { ok: false; reason: string };

/** The canonical form of one resolved tag. What goes back into the reply is built from what the
 *  Engine read and did, never spliced out of what the model wrote — so a forged `result=` cannot
 *  survive a round trip, and an unreadable body keeps only a sanitized copy of itself. */
export function serializeSheetCommandTag(
  input: { sheet?: string; who?: string; op: RulesetSheetOp | null; raw: string },
  outcome: SheetCommandTagOutcome,
): string {
  const parts: string[] = [];
  const attribute = (key: string, value: string | number, limit?: number) =>
    parts.push(`${key}="${sanitizeSheetTagValue(String(value), limit)}"`);

  if (input.sheet !== undefined) attribute("sheet", input.sheet);
  const op = input.op;
  if (!op) {
    attribute("raw", input.raw);
  } else {
    if (input.who) attribute("who", input.who);
    attribute("op", op.op);
    if (op.op === "damage" && "track" in op) {
      attribute("track", op.track);
      if (op.kind) attribute("kind", op.kind);
      attribute("amount", op.amount);
      if (op.box !== undefined) attribute("box", op.box);
    } else if (op.op === "spend" || op.op === "restore" || op.op === "damage" || op.op === "temp") {
      attribute("pool", op.pool);
      attribute("amount", op.amount);
    } else if (op.op === "advance") {
      if ("skill" in op || "save" in op) {
        if ("skill" in op) attribute("skill", op.skill);
        else attribute("save", op.save);
        attribute("tier", op.tier);
      } else {
        if ("field" in op) attribute("field", op.field);
        else attribute("ability", op.ability);
        if (op.to !== undefined) attribute("to", op.to);
        else attribute("by", op.by ?? 0);
      }
    } else if (op.op === "track") {
      attribute("track", op.track);
      if (op.to !== undefined) attribute("to", op.to);
      else attribute("by", op.by ?? 0);
      if (op.upTo !== undefined && op.to === undefined) attribute("upto", op.upTo);
    } else if (op.op === "condition") {
      attribute("condition", op.condition);
      attribute("state", op.active ? "on" : "off");
    } else if (op.op === "state") {
      attribute("state", op.state);
      attribute("value", op.value);
    } else if (op.op === "note") {
      attribute("field", op.field);
      attribute("value", op.value);
    } else if (op.op === "use") {
      attribute("name", op.name);
      if (op.pool) attribute("pool", op.pool);
      if (op.recover?.length)
        attribute("recover", op.recover.map((entry) => `${entry.pool}:${entry.count}`).join(", "));
      if (op.as) attribute("as", op.as);
      if (op.ritual) attribute("ritual", "yes");
    } else if (op.op === "dismiss" || op.op === "prepare" || op.op === "unprepare") {
      attribute("name", op.name);
    } else if (op.op === "pass") {
      attribute("days", op.days);
      if (op.resting) attribute("resting", "yes");
    } else if (op.op === "rest") {
      attribute("rest", op.rest);
      if (op.dice) attribute("dice", op.dice);
      if (op.dice && op.pool) attribute("pool", op.pool);
      if (op.use) attribute("use", op.use);
      if (op.use && op.recover?.length)
        attribute("recover", op.recover.map((entry) => `${entry.pool}:${entry.count}`).join(", "));
    }
  }
  if (outcome.ok) {
    attribute("result", "ok");
    attribute("now", outcome.now, SHEET_COMMAND_NOW_MAX_LENGTH);
  } else {
    attribute("result", "refused");
    // Whole, as a result's is: what a refusal says it may do instead comes after its list (Vex's
    // "use \"Find Familiar (Pact of the Chain)\" for that", cut off at 120).
    attribute("reason", outcome.reason, SHEET_COMMAND_NOW_MAX_LENGTH);
  }
  return `[sheet: ${parts.join(" ")}]`;
}

/** Every `[sheet: ...]` tag removed, for display and for the history the next prompt carries. */
export function stripSheetCommandTags(text: string): string {
  return text.replace(createSheetCommandStripRegex(), (_match, before: string, after: string) =>
    before && after ? " " : "",
  );
}

export interface ResolvedSheetCommandTag {
  sheet?: string;
  who?: string;
  ok: boolean;
  reason?: string;
  now?: string;
  /** One line a client can show as-is. */
  summary: string;
}

/** The outcomes an already-resolved reply carries, for the client. Only tags the Engine has
 *  written a `result` onto are reported: anything else is a request nobody answered. */
export function readResolvedSheetCommandTags(text: string): ResolvedSheetCommandTag[] {
  const found: ResolvedSheetCommandTag[] = [];
  for (const match of text.matchAll(createSheetCommandTagRegex())) {
    const values = readAttributes(match[1] ?? "");
    const result = values.get("result")?.trim().toLowerCase();
    if (result !== "ok" && result !== "refused") continue;
    const sheet = values.get("sheet");
    const who = values.get("who")?.trim();
    const now = values.get("now")?.trim();
    const reason = values.get("reason")?.trim();
    const name = readOpName(values.get("op"));
    // `name` first, because a `use` tag carries the ability's name and may carry the pool it was
    // paid from; the ability is what the line is about.
    const target =
      values.get("name") ??
      values.get("pool") ??
      values.get("track") ??
      values.get("condition") ??
      // Only a state command names its state here: a condition's `state` is on or off, and it
      // has already answered above.
      (name === "state" ? values.get("state") : undefined) ??
      values.get("field") ??
      values.get("ability") ??
      values.get("skill") ??
      values.get("save") ??
      values.get("rest") ??
      (name === "pass" ? values.get("days") : undefined);
    const head = [sheet === "party" ? "party" : who, name ?? "sheet", target].filter(Boolean).join(" ");
    found.push({
      ...(sheet !== undefined ? { sheet } : {}),
      ...(who ? { who } : {}),
      ok: result === "ok",
      ...(reason ? { reason } : {}),
      ...(now ? { now } : {}),
      summary: result === "ok" ? `${head}${now ? ` -> ${now}` : ""}` : `${head} refused${reason ? ` (${reason})` : ""}`,
    });
  }
  return found;
}
