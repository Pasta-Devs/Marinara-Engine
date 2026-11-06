// ──────────────────────────────────────────────
// A ruleset's translation on screen (Capability API 1.811)
//
// A catalog ruleset may list a language pack per language, fetched in the Engine's language, and a
// ruleset package file may carry `locales/<language>.json`, of which its import keeps that language:
// its display strings, each keyed by its English word for word. The rules read the English and the Game
// Master is told the English; only what a player reads in a fight is swapped, here, as it is drawn.
// Anything with no translation stays English.
// ──────────────────────────────────────────────
import { createContext, useContext } from "react";
import type { DirectedRulesetView } from "@marinara-engine/shared";

/** A ruleset string in the player's language, or the string itself. */
export type RulesetText = (english: string) => string;

export const RULESET_TEXT_AS_IS: RulesetText = (english) => english;

/**
 * The lookup over one translation. A string with no entry of its own that ends in a number the fight
 * added ("Goblin 2") reads the translation of the rest; a list ("Goblin, Orc") reads each of its names;
 * and a line the Engine joined out of the ruleset's own words ("Languages: Common, Elvish", "Wish:
 * Fireball") reads its label on its own and each name after it on its own, since the translation is
 * keyed by each English string exactly as the ruleset wrote it and never by what was joined from them.
 * A name the fight gave a way of a spell ("Polymorph (unwilling) (Frog)") reads the spell and the way.
 */
export function rulesetTextLookup(strings: Readonly<Record<string, string>> | null | undefined): RulesetText {
  if (!strings || Object.keys(strings).length === 0) return RULESET_TEXT_AS_IS;
  const own = (english: string) =>
    Object.prototype.hasOwnProperty.call(strings, english) ? strings[english] : undefined;
  const one = (english: string): string => {
    const exact = own(english);
    if (exact !== undefined) return exact;
    const numbered = /^(.+?) (\d+)$/u.exec(english);
    const base = numbered ? own(numbered[1]!) : undefined;
    return base !== undefined ? `${base} ${numbered![2]}` : english;
  };
  const lookup = (english: string): string => {
    if (!english) return english;
    const whole = one(english);
    if (whole !== english) return whole;
    const colon = english.indexOf(": ");
    const comma = english.indexOf(", ");
    // A list of such lines ("Wish: Fireball, Languages: Elvish") is read line by line.
    if (comma >= 0 && (colon < 0 || comma < colon)) {
      return english
        .split(", ")
        .map((part) => (part.includes(": ") ? lookup(part) : one(part)))
        .join(", ");
    }
    // "<Spell> (<way>)": a way the fight named after the spell (True Polymorph (unwilling) (Frog),
    // Spanish playtest 2026-10-27), each part read on its own; the spell's own name may hold brackets.
    const bracketed = /^(.+) \(([^()]+)\)$/u.exec(english);
    if (bracketed && colon < 0) {
      const head = lookup(bracketed[1]!);
      const way = one(bracketed[2]!);
      if (head !== bracketed[1] || way !== bracketed[2]) return `${head} (${way})`;
    }
    // "<Label>: <name>, <name>": the label first, then what follows it, a list read name by name.
    if (colon > 0) {
      const head = english.slice(0, colon);
      const tail = english.slice(colon + 2);
      const label = one(head);
      const rest = lookup(tail);
      if (label !== head || rest !== tail) return `${label}: ${rest}`;
    }
    return whole;
  };
  return lookup;
}

/** Fields of a fight's view that are words for the Engine, never for a reader: never translated. */
const KEPT = new Set([
  "id",
  "ids",
  "type",
  "kind",
  "kinds",
  "side",
  "mode",
  "outcome",
  "result",
  "reason",
  "code",
  "budget",
  "budgets",
  "condition",
  "conditions",
  "damageType",
  "types",
  "pool",
  "track",
  "save",
  "check",
  "style",
  "tier",
  "controller",
  "scene",
  "art",
  "icon",
  "tile",
  "terrain",
  // The Engine's notes on how the fight was set up: read against their English templates, their names
  // swapped as each is drawn.
  "adjustments",
]);
const keptKey = (key: string) => KEPT.has(key) || /(?:Id|Ids|Key|Keys)$/u.test(key);

/** The fight's view with every display string in the player's language. The same object when there is
 *  no translation, so nothing downstream redraws for it. */
export function translateRulesetView(view: DirectedRulesetView, text: RulesetText): DirectedRulesetView {
  if (text === RULESET_TEXT_AS_IS) return view;
  const walk = (value: unknown, key: string): unknown => {
    if (typeof value === "string") return keptKey(key) ? value : text(value);
    if (Array.isArray(value)) return keptKey(key) ? value : value.map((item) => walk(item, key));
    if (!value || typeof value !== "object") return value;
    if (keptKey(key)) return value;
    const out: Record<string, unknown> = {};
    for (const [name, inner] of Object.entries(value as Record<string, unknown>)) out[name] = walk(inner, name);
    return out;
  };
  return walk(view, "") as DirectedRulesetView;
}

export const RulesetTextContext = createContext<RulesetText>(RULESET_TEXT_AS_IS);

/** The ruleset's own strings in the player's language, for whatever draws them. */
export function useRulesetText(): RulesetText {
  return useContext(RulesetTextContext);
}
