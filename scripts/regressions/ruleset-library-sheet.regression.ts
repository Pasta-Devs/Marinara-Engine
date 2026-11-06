/**
 * A ruleset sheet outside a game (playtest of 2026-10-23):
 *
 *   - The library's sheet shows what it has to spend at its most (spell slots, ki), from the same
 *     pools a game's sheet starts with, and only where no game's live state is given.
 *   - Where the ruleset has starting gear, it says armour waits on a game's Starting gear.
 *   - A builder card's stat line takes a row's short words only: a race's Speed feature, the first
 *     row of every race, is prose, not a stat line.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultRulesetSheetBuild,
  listRulesetLivePools,
  parseRulesetDefinition,
} from "../../packages/shared/src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readSource = (path: string) => readFileSync(join(root, path), "utf8");

// ── The pools a sheet has, at their most ──
{
  const parsed = parseRulesetDefinition(JSON.parse(readSource("docs/development/ruleset-5e-2014.example.json")));
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const build = defaultRulesetSheetBuild(parsed.definition);
  build.fields = { ...build.fields, hp_max: 31 };
  const hp = listRulesetLivePools(parsed.definition, build).find((pool) => pool.key === "hp");
  assert.equal(hp?.max, 31, "hit points at their most");
}

// ── The editor shows them outside a game, and the gear note ──
{
  const editor = readSource("packages/client/src/components/rulesets/RulesetSheetEditor.tsx");
  assert.match(editor, /live === undefined \? listRulesetLivePools\(definition, build\) : \[\]/u);
  assert.match(editor, /"ui\.rulesets\.sheet\.pools"/u);
  assert.match(editor, /items === undefined && \(definition\.items\?\.startingGear\?\.length \?\? 0\) > 0/u);
  const messages = JSON.parse(readSource("packages/client/src/localization/locales/en.json")) as Record<string, string>;
  for (const key of ["ui.rulesets.sheet.pools", "ui.rulesets.sheet.poolStartsEmpty", "ui.rulesets.sheet.gearInGame"])
    assert.ok(messages[key], `en.json is missing ${key}`);
  // In a game the note is not shown: the party sheet and a card read without an item book are still
  // in a game, where gear is worn.
  assert.doesNotMatch(
    readSource("packages/client/src/components/game/GameRulesetSheet.tsx"),
    /ui\.rulesets\.sheet\.gearInGame/u,
  );
}

// ── A stat line of short words ──
{
  const builder = readSource("packages/client/src/components/rulesets/RulesetSheetBuilder.tsx");
  const line = builder.slice(builder.indexOf("const entryStatLine"), builder.indexOf("const [rolling"));
  assert.match(line, /column\.type === "text" && column\.id !== nameColumn/u);
  assert.doesNotMatch(line, /longtext/u, "a feature's prose is not a stat line");
}

console.log("Ruleset library sheet: pools at their most outside a game, the gear note, a stat line of short words.");
