/**
 * How a fight was built, in the reader's language (2026-10-26, Alyssa: the fight's English-only lines
 * are translated).
 *
 *   - Every line the Engine writes into a fight's adjustments is one of RULESET_FIGHT_NOTES, word for
 *     word: read off the code that writes them, so a sentence changed in one place and not the other
 *     fails here.
 *   - en.json holds each template as `game.combat.ruleset.note.<key>`, the same words.
 *   - A line reads back into its template and values, one said of an opponent ("Goblin: ...") too,
 *     and the screen shows the template's translation with the values as they were; a line that is
 *     no template, or one with no translation, is shown as written.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  readRulesetFightNote,
  rulesetFightNote,
  RULESET_FIGHT_NOTES,
  type RulesetFightNoteKey,
} from "../../packages/shared/src/index.js";
import {
  rulesetCombatEventLine,
  rulesetCombatNames,
  rulesetFightNoteText,
} from "../../packages/client/src/lib/ruleset-combat-log.js";

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8");
const keys = Object.keys(RULESET_FIGHT_NOTES) as RulesetFightNoteKey[];

// ── en.json holds the same words ──
const en = JSON.parse(read("packages/client/src/localization/locales/en.json")) as Record<string, string>;
for (const key of keys) assert.equal(en[`game.combat.ruleset.note.${key}`], RULESET_FIGHT_NOTES[key], key);
assert.equal(en["game.combat.ruleset.note.of"], "{{name}}: {{line}}");

// ── Each template reads back into itself, and into no other ──
for (const key of keys) {
  const names = [...RULESET_FIGHT_NOTES[key].matchAll(/\{\{(\w+)\}\}/g)].map((found) => found[1]!);
  const params = Object.fromEntries(names.map((name, index) => [name, `Value${String.fromCharCode(65 + index)}`]));
  const line = rulesetFightNote(key, params);
  assert.doesNotMatch(line, /\{\{/, key);
  const note = readRulesetFightNote(line);
  assert.equal(note?.key, key, `${key}: ${line} read as ${note?.key}`);
  assert.deepEqual(note?.params, params, key);
  assert.equal(note?.of, undefined);
}

// ── Every sentence the code writes is a template ──
// What a `${...}` in the code may come out as: each side of a choice it makes (the same side
// wherever the same choice is made again), and anything else.
const expand = (literal: string, chosen: Record<string, number> = {}): string[] => {
  const at = literal.indexOf("${");
  if (at < 0) return [literal];
  let depth = 0;
  let end = at + 2;
  for (; end < literal.length; end++) {
    if (literal[end] === "{") depth++;
    else if (literal[end] === "}") {
      if (depth === 0) break;
      depth--;
    }
  }
  const expression = literal.slice(at + 2, end).trim();
  const choice = /^([^?]+)\?\s*"([^"]*)"\s*:\s*"([^"]*)"$/.exec(expression);
  const sides =
    expression === "back"
      ? ["", " with its Reset set back to the ruleset's default"]
      : choice
        ? [choice[2]!, choice[3]!]
        : ["Value"];
  const asked = choice ? choice[1]!.trim() : expression === "back" ? "back" : undefined;
  return sides.flatMap((side, index) => {
    if (asked !== undefined && chosen[asked] !== undefined && chosen[asked] !== index) return [];
    const now = asked !== undefined ? { ...chosen, [asked]: index } : chosen;
    return expand(literal.slice(end + 1), now).map((tail) => literal.slice(0, at) + side + tail);
  });
};
const sources = [
  "packages/server/src/services/game/ruleset-combat-director.service.ts",
  "packages/server/src/routes/combat-director.routes.ts",
  "packages/shared/src/features/ruleset-combat/creatures.ts",
  "packages/shared/src/features/ruleset-combat/hold.ts",
  "packages/shared/src/features/ruleset-combat/resolve.ts",
];
let checked = 0;
for (const path of sources) {
  const lines = read(path).split("\n");
  lines.forEach((text, index) => {
    // A sentence pushed onto the adjustments, or one side of a choice of two sentences pushed there.
    const near = lines.slice(Math.max(0, index - 3), index + 1).join("\n");
    const pushed = /(adjustments|adjusted|skipped)\.push\(|said\(|adjusted: \[/.test(near);
    if (!pushed) return;
    for (const found of text.matchAll(/`((?:[^`\\]|\\.)*)`|(?<=push\(|said\()"((?:[^"\\]|\\.)*)"/g)) {
      const literal = found[1] ?? found[2]!;
      // Not a sentence: a prefix put before a line already written, or a reference.
      if (/^\$\{[^}]+\}: \$\{line\}$/.test(literal) || literal.startsWith(" ") || !/[a-z] [a-z]/i.test(literal))
        continue;
      for (const sentence of expand(literal)) {
        checked++;
        const note = readRulesetFightNote(sentence);
        assert.ok(note, `${path}:${index + 1} writes a line no template matches: ${sentence}`);
      }
    }
  });
}
assert.ok(checked >= 100, `read ${checked} sentences`);

// ── Shown in the reader's language ──
const russian: Record<string, string> = {
  "game.combat.ruleset.note.deadOut": "{{name}} мёртв и не участвует в бою.",
  "game.combat.ruleset.note.saveLowered": "Спасбросок против «{{action}}» снижен до {{to}}.",
  "game.combat.ruleset.note.of": "{{name}}: {{line}}",
};
const t = ((key: string, options: Record<string, unknown> = {}) => {
  const template = russian[key];
  if (template === undefined) return (options.defaultValue as string | undefined) ?? key;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name]));
}) as never;
const goblin = (text: string) => (text === "Goblin" ? "Гоблин" : text === "Scimitar" ? "Скимитар" : text);
assert.equal(rulesetFightNoteText("Brom is dead and stays out of the fight.", t), "Brom мёртв и не участвует в бою.");
assert.equal(
  rulesetFightNoteText('Goblin: The save against "Scimitar" was lowered to 12.', t, goblin),
  "Гоблин: Спасбросок против «Скимитар» снижен до 12.",
);
// No translation yet, or no template: as written.
assert.equal(
  rulesetFightNoteText("Goblin was built from the numbers of CR 1.", t),
  "Goblin was built from the numbers of CR 1.",
);
assert.equal(
  rulesetFightNoteText("Something nobody wrote a template for.", t),
  "Something nobody wrote a template for.",
);

// ── A spend line counts what it spent in the pool's own words (laptop level-4 pass 2026-10-26: "The
//    Pale Master spends 1 1st-level slots") ──
{
  const english = ((key: string, options: Record<string, unknown> = {}) => {
    const template = en[key];
    if (template === undefined) return key;
    return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name]));
  }) as never;
  const definition = {
    sheet: {
      live: {
        pools: [{ id: "slots_1", label: "1st-level slots", unit: "1st-level slot", units: "1st-level slots" }],
        conditions: [],
        tracks: [],
      },
      saves: [],
      derived: [],
      fields: [],
      abilities: [],
      skills: [],
    },
    resolution: { kind: "d20" },
  } as never;
  const names = rulesetCombatNames(
    definition,
    { combatants: [{ id: "pale", name: "The Pale Master" }] } as never,
    english,
  );
  const spend = (amount: number) =>
    rulesetCombatEventLine(
      {
        type: "spend",
        actorId: "pale",
        pool: "slots_1",
        label: "1st-level slots",
        amount,
        on: "Magic Missile",
      } as never,
      names,
      english,
    );
  assert.equal(spend(1), "The Pale Master spends 1 1st-level slot on Magic Missile.");
  assert.equal(spend(2), "The Pale Master spends 2 1st-level slots on Magic Missile.");
}

console.log(`game-ruleset-fight-notes: ok (${keys.length} templates, ${checked} sentences in the code)`);
