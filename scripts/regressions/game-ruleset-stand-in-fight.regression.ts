/**
 * A persona-less party's fight (2026-10-23 playtest, B2).
 *
 *   - With no persona the first character card plays as the player. A battle setup that still names
 *     a sheetless "User" in the party fights that card in its place, and says so, instead of refusing
 *     the whole fight.
 *   - A card the party already holds is never doubled, and with a persona nothing is swapped.
 *   - The encounter routes read the same stand-in, and a battle that cannot be read has a way out.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { defaultRulesetSheetBuild, parseRulesetDefinition } from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-stand-in-fight-"));
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
  const cards = [
    { name: "Ada", rulesetSheet: sheet },
    { name: "Brannoc", rulesetSheet: sheet },
  ];
  const fight = (party: Array<{ id: string; name: string }>, playerName: string | null) =>
    createRulesetFight({
      definition,
      seed: 3,
      party,
      enemies: [{ id: "rats", name: "Grave-rat swarm", creature: "night/grave-rats" }],
      cards,
      playerName,
      live: null,
      partyCatalogs: {},
      bestiary,
    });

  // "User" is the first card, said in the fight's adjustments.
  {
    const built = fight(
      [
        { id: "user", name: "User" },
        { id: "brannoc", name: "Brannoc" },
      ],
      null,
    );
    assert.ok(built.ok, built.ok ? "" : built.error);
    const party = built.fight.encounter.combatants.filter((one) => one.side === "party");
    assert.deepEqual(
      party.map((one) => [one.id, one.name]),
      [
        ["user", "Ada"],
        ["brannoc", "Brannoc"],
      ],
    );
    assert.ok(built.fight.adjustments.includes("User fights as Ada, the character the player plays."));
  }

  // Ada already in the party: nobody else becomes her, and the sheetless member sits out.
  {
    const built = fight(
      [
        { id: "ada", name: "Ada" },
        { id: "user", name: "User" },
      ],
      null,
    );
    assert.ok(built.ok, built.ok ? "" : built.error);
    assert.deepEqual(
      built.fight.encounter.combatants.filter((one) => one.side === "party").map((one) => one.name),
      ["Ada"],
    );
    assert.ok(built.fight.adjustments.includes("User has no ruleset sheet and stays out of the fight."));
  }

  // With a persona the player is the persona, never a card: a party with no sheet at all is refused.
  {
    const built = fight([{ id: "user", name: "User" }], "Mia");
    assert.equal(built.ok, false);
    if (!built.ok) assert.match(built.error, /^Nobody in this party has a ruleset sheet/);
  }

  // The routes and the screen.
  const encounter = read("../../packages/server/src/routes/encounter.routes.ts");
  assert.equal(
    (encounter.match(/withStandIn\(/g) ?? []).length >= 4,
    true,
    "every encounter call site reads the stand-in",
  );
  const screen = read("../../packages/client/src/components/game/DirectedCombatUI.tsx");
  assert.match(screen, /props\.onCombatEnd\("flee", \{ outcome: "flee", rounds: 0, party: \[\], enemies: \[\] \}\)/);
  assert.match(screen, /game\.combat\.director\.leave/);
  // S4: the reply's own wear tags count before its sheet commands are read.
  const route = read("../../packages/server/src/routes/generate.routes.ts");
  assert.match(
    route,
    /input\.regenerateMessageId,\s*\/\/ What the reply puts on[^\n]*\n\s*\{\s*content: fullResponse,\s*party: \{ player: gameStandIn/,
  );

  console.log(
    "Stand-in fight: a persona-less party's User fights as the first card, never doubled, with a way out of a broken battle.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
