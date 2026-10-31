/**
 * A fight's party is the game's whole party (cheap-GM playtest 2026-10-26: combat:init listed one of
 * three heroes, the fight was accepted without a word, and he fought alone).
 *
 *   - With the game's party list read (`roster`), every card with a sheet the setup left out joins
 *     the fight, in the cards' order, and the fight says who joined.
 *   - One who left the party, or never fights, stays out and the fight says why; one dead on their
 *     sheet is listed and left out as the dead are (rulesetSheetDead). The card a sheetless "User" fights as is never doubled.
 *   - Without a roster (a test, a preview, a game with no party list) the party is as it was sent.
 *   - The route reads the roster and hands it to the fight.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { defaultRulesetSheetBuild, parseRulesetDefinition } from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-whole-party-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { createRulesetFight } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const parsed = parseRulesetDefinition(JSON.parse(read("../../docs/examples/rulesets/gravewatch.json")));
  assert.ok(parsed.ok);
  const definition = parsed.definition;
  const bestiary = Object.fromEntries(
    (definition.catalogs ?? []).flatMap((catalog) =>
      catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
    ),
  );
  const sheet = { v: 1, build: defaultRulesetSheetBuild(definition) };
  const cards = ["Ada", "Brannoc", "Cyra", "Dell", "Eve"].map((name) => ({ name, rulesetSheet: sheet }));
  const roster = {
    away: ["Dell"],
    sitsOut: ["Eve"],
    idFor: (name: string) => (name === "Cyra" ? "char-cyra" : ""),
  };
  const fight = (party: Array<{ id: string; name: string }>, playerName: string | null, withRoster: boolean) =>
    createRulesetFight({
      definition,
      seed: 3,
      party,
      enemies: [{ id: "rats", name: "Grave-rat swarm", creature: "night/grave-rats" }],
      cards,
      playerName,
      ...(withRoster ? { roster } : {}),
      live: null,
      partyCatalogs: {},
      bestiary,
    });
  const partyOf = (built: ReturnType<typeof createRulesetFight>) => {
    assert.ok(built.ok, built.ok ? "" : built.error);
    return built.fight.encounter.combatants.filter((one) => one.side === "party").map((one) => [one.id, one.name]);
  };

  // One of the party listed: the rest who can fight join it, and the fight says who and why not.
  {
    const built = fight([{ id: "ada", name: "Ada" }], "Ada", true);
    assert.deepEqual(partyOf(built), [
      ["ada", "Ada"],
      ["party-brannoc", "Brannoc"],
      ["char-cyra", "Cyra"],
    ]);
    assert.ok(built.ok);
    for (const line of [
      "Brannoc was left out of the fight's party and joins it.",
      "Cyra was left out of the fight's party and joins it.",
      "Dell has left the party and stays out of the fight.",
      "Eve does not fight and stays out of the fight.",
    ])
      assert.ok(built.fight.adjustments.includes(line), line);
    // The player still plays Ada; the joined companions fight on their own only where the game says so.
    assert.equal(built.fight.lead, "ada");
  }

  // Without a roster the party is as it was sent, as before.
  assert.deepEqual(partyOf(fight([{ id: "ada", name: "Ada" }], "Ada", false)), [["ada", "Ada"]]);

  // A sheetless "User" fighting as the first card keeps that card: it is not added a second time.
  {
    const built = fight([{ id: "user", name: "User" }], null, true);
    const party = partyOf(built);
    assert.deepEqual(party[0], ["user", "Ada"]);
    assert.equal(party.filter(([, name]) => name === "Ada").length, 1);
    assert.deepEqual(
      party.map(([, name]) => name),
      ["Ada", "Brannoc", "Cyra"],
    );
  }

  // The route reads the game's party list and hands it to the fight.
  const route = read("../../packages/server/src/routes/combat-director.routes.ts");
  assert.match(route, /const roster = await gamePartyRoster\(app\.db, input\.chatId, meta,/);
  assert.match(route, /\.\.\.\(partyRoster \? \{ roster: partyRoster \} : \{\}\)/);

  console.log(
    "Whole party: a member the setup left out joins the fight and is named; one who left, never fights or is dead stays out.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
