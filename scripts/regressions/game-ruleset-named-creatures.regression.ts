/**
 * What the Game Master said a foe is, and the bestiary's own creatures named in the story
 * (laptop 2026-10-26).
 *
 *   - A foe said to be undead keeps that type on the board whatever it was built on: a bestiary creature
 *     standing in for it, a type written loosely ("undead (skeleton)"), or a proposed block that said
 *     humanoid. An effect for undead reaches it, one for humanoids does not, and the mind it was given
 *     (mindless, which never loses heart) is the one it fights with. A budget's lesser ones of its kind
 *     are of the kind it was said to be.
 *   - The bestiary's creatures named in some words, as whole words with case aside and the longest name
 *     first ("the Giant Crocodile" is not also the Crocodile), at most a few; a leading "the" never keeps
 *     a name from being found; the blueprint and the Game Master's turn are told.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  defaultRulesetSheetBuild,
  findRulesetCreature,
  parseRulesetDefinition,
  rulesetBestiaryNamedIn,
  rulesetBudgetStandIns,
  rulesetCombatant,
  rulesetCombatantMind,
  rulesetCreatureKind,
  rulesetSaidCreatureType,
  rulesetTargetIs,
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-named-creatures-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { createRulesetFight } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");
const { encounterRulesetBrief, buildInitPrompt } = await import("../../packages/server/src/routes/encounter.routes.js");
const { buildGmSceneState, buildGmFormatReminder } =
  await import("../../packages/server/src/services/game/gm-prompts.js");

try {
  const doc = JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
      "utf8",
    ),
  ) as Record<string, any>;
  doc.combat.creatureTypes = {
    types: ["beast", "humanoid", "undead"].map((id) => ({ id, label: id[0]!.toUpperCase() + id.slice(1) })),
    default: "humanoid",
  };
  // What each rung is worth, for an encounter budget's lesser ones.
  const worths = [10, 25, 50, 100, 200, 450, 700, 1100, 1800];
  doc.combat.threat.tiers.forEach((tier: { worth?: number }, index: number) => (tier.worth = worths[index]));
  const creatures = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures");
  for (const entry of creatures.entries) entry.creature.type = "humanoid";
  creatures.entries.push(
    { ...structuredClone(creatures.entries[1]), id: "crocodile", label: "Crocodile" },
    { ...structuredClone(creatures.entries[3]), id: "giant-crocodile", label: "Giant Crocodile" },
  );
  for (const entry of creatures.entries.slice(-2)) entry.creature.type = "beast";
  const parsed = parseRulesetDefinition(doc);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition: RulesetDefinition = parsed.definition;
  const bestiary: RulesetCatalogEntriesById = {
    [creatures.id]: definition.catalogs!.find((catalog) => catalog.id === creatures.id)!
      .entries as RulesetCatalogEntry[],
  };

  // ── The type said ──
  assert.equal(rulesetSaidCreatureType(definition, "undead"), "undead");
  assert.equal(rulesetSaidCreatureType(definition, "Undead"), "undead", "by its label");
  assert.equal(rulesetSaidCreatureType(definition, "undead (skeleton)"), "undead", "a word among others");
  assert.equal(rulesetSaidCreatureType(definition, "a skeletal shell"), undefined, "none named");

  // ── A skeletal husk said to be undead, however it was built ──
  {
    const built = createRulesetFight({
      definition,
      seed: 3,
      party: [{ id: "ada", name: "Ada" }],
      enemies: [
        // Built on a bestiary humanoid, standing in for it.
        { id: "husk", name: "Skeletal Husk", creature: "Toll Sergeant", creatureType: "undead", mind: "mindless" },
        // A type written loosely.
        { id: "husk-2", name: "Skeletal Husk 2", tier: "cr_1", creatureType: "undead (skeleton)", mind: "mindless" },
        // A proposed block that said humanoid.
        {
          id: "husk-3",
          name: "Skeletal Husk 3",
          creatureType: "Undead",
          proposed: {
            tier: "cr_1",
            type: "humanoid",
            health: 20,
            defense: 12,
            initiativeModifier: 1,
            actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 3, damage: { dice: "1d6" } }],
          },
        },
        // Nothing said: what its bestiary entry is.
        { id: "sergeant", name: "Toll Sergeant" },
      ],
      cards: [{ name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(definition) } }],
      playerName: null,
      live: {},
      items: () => [],
      partyCatalogs: {},
      bestiary,
    } as never);
    assert.ok(built.ok, built.ok ? "" : (built as { error: string }).error);
    const fight = (built as { fight: any }).fight;
    for (const id of ["husk", "husk-2", "husk-3"]) {
      const husk = rulesetCombatant(fight.encounter, id)!;
      assert.equal(rulesetCreatureKind(definition, husk).type, "undead", `${id} is undead on the board`);
      assert.ok(rulesetTargetIs(definition, husk, { types: ["undead"] }), `${id}: turned as the undead are`);
      assert.equal(rulesetTargetIs(definition, husk, { types: ["humanoid"] }), false, `${id}: held as no humanoid`);
    }
    for (const id of ["husk", "husk-2"])
      assert.equal(
        rulesetCombatantMind(definition, rulesetCombatant(fight.encounter, id)!),
        "mindless",
        `${id} never loses heart, so never gives itself up`,
      );
    const sergeant = rulesetCombatant(fight.encounter, "sergeant")!;
    assert.equal(rulesetCreatureKind(definition, sergeant).type, "humanoid", "the bestiary's own type, unsaid");
    // The stand-in's numbers are the sergeant's still.
    assert.equal(rulesetCombatant(fight.encounter, "husk")!.maxHealth, sergeant.maxHealth);
    assert.ok(
      (fight.adjustments as string[]).includes(
        "Skeletal Husk was said to be Undead, so it fights as one, on the numbers of the Toll Sergeant.",
      ),
      JSON.stringify(fight.adjustments),
    );
  }

  // ── A budget's lesser ones are of the kind the foe was said to be ──
  {
    const swapped = rulesetBudgetStandIns(
      definition,
      bestiary,
      [{ id: "boss", name: "Bone Tyrant", creature: "Toll Sergeant", creatureType: "beast" }],
      { worth: 500, bossWorth: 500, members: 1, step: { label: "Low" }, bossStep: { label: "Low" } } as never,
    );
    const said = swapped.enemies.map((one) => findRulesetCreature(bestiary, one.creature!)?.entry.creature?.type);
    assert.ok(swapped.lines.length === 1 && said.every((type) => type === "beast"), JSON.stringify(swapped));
    // Unsaid, they are of the bestiary creature's own kind.
    const own = rulesetBudgetStandIns(
      definition,
      bestiary,
      [{ id: "boss", name: "Bone Tyrant", creature: "Toll Sergeant" }],
      { worth: 500, bossWorth: 500, members: 1, step: { label: "Low" }, bossStep: { label: "Low" } } as never,
    );
    assert.ok(
      own.lines.length === 1 &&
        own.enemies.every((one) => findRulesetCreature(bestiary, one.creature!)?.entry.creature?.type === "humanoid"),
      JSON.stringify(own),
    );
  }

  // ── The bestiary's creatures named in the story ──
  {
    const named = (...texts: string[]) => rulesetBestiaryNamedIn(bestiary, texts).map((one) => one.label);
    assert.deepEqual(named("I want to fight the Giant Crocodile from the river, the real beast itself."), [
      "Giant Crocodile",
    ]);
    assert.deepEqual(named("Two GIANT CROCODILES and a crocodile"), ["Giant Crocodile", "Crocodile"], "plural, case");
    assert.deepEqual(named("Crocodiles everywhere"), ["Crocodile"]);
    assert.deepEqual(named("A crocodilian shape"), [], "whole words only");
    assert.deepEqual(named(""), []);
    assert.equal(
      named("Thorn Lurker, Cinder Hound, Grave Piper, Hollow Sentinel and a Toll Sergeant").length,
      3,
      "a few at most",
    );
    assert.equal(rulesetBestiaryNamedIn(bestiary, ["the Giant Crocodile"])[0]?.tier, "cr_3");
    // Looked up by name, a leading "the" is no part of it.
    assert.equal(findRulesetCreature(bestiary, "The Giant Crocodile")?.entry.id, "giant-crocodile");
    assert.equal(findRulesetCreature(bestiary, "the giant crocodile [cr_5]")?.entry.id, "giant-crocodile");
    assert.equal(findRulesetCreature(bestiary, "Enraged River Queen"), null, "an invented name stays invented");

    // The blueprint is told, under the brief's line.
    const brief = await encounterRulesetBrief(definition, null, undefined, [
      "We go after the Giant Crocodile, the real beast itself.",
      "The water stirs.",
    ]);
    assert.deepEqual(brief?.named, [{ label: "Giant Crocodile", tier: "cr_3" }]);
    const prompt = buildInitPrompt("Ada", "", "", [], "", "", false, undefined, brief)
      .map((message) => message.content)
      .join("\n");
    assert.match(prompt, /- Named in the story and in the bestiary: Giant Crocodile \[cr_3\]\.\n/);
    assert.match(prompt, /When the story or a player names a creature the bestiary holds, use that entry/);
    const quiet = await encounterRulesetBrief(definition, null, undefined, ["We rest by the fire."]);
    assert.equal(quiet?.named, undefined, "nothing named, nothing said");

    // And so is the Game Master's turn.
    assert.match(
      buildGmSceneState({ bestiaryNamed: ["Giant Crocodile"] } as never),
      /Engine: Giant Crocodile is in the bestiary; use that entry rather than inventing one\./,
    );
    assert.match(
      buildGmSceneState({ bestiaryNamed: ["Giant Crocodile", "Crocodile"] } as never),
      /Giant Crocodile and Crocodile are in the bestiary/,
    );
    assert.doesNotMatch(buildGmSceneState({} as never), /bestiary/);
    // The Game Master's brief says so, beside the sheets, for a ruleset with a bestiary.
    const gmBrief = (ruleset?: RulesetDefinition) =>
      buildGmFormatReminder({
        turnNumber: 2,
        gameActiveState: "exploration",
        partyNames: ["Ada"],
        playerName: "Ada",
        ...(ruleset ? { ruleset, rulesetSheetBlocks: ["Ada: HP 10/10"] } : {}),
      } as never);
    const rule =
      "- When the story or a player names a creature the bestiary holds, use that entry rather than inventing one.";
    assert.ok(gmBrief(definition).includes(rule));
    assert.equal(gmBrief().includes(rule), false);
  }

  console.log("game-ruleset-named-creatures regression passed");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
