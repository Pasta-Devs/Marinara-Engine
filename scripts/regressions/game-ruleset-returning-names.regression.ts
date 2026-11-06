/**
 * A foe that got away is named to the Game Master that sets up the next fight (cheap-GM playtest
 * 2026-10-26: one that fled the first fight came back renamed, a tier higher and at full health).
 *
 *   - Only a name written again brings a kept foe back as it left, so the encounter prompt lists the
 *     names the game keeps, each once, and asks for exactly that name.
 *   - A game that keeps none is asked exactly as before.
 *   - Kept under that name, it comes back with what it got away without, and the tier it had.
 *   - A Dash spends the turn's action: an opponent with one attack has none left after it.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatOptions,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-returning-names-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

try {
  const { buildInitPrompt, encounterRulesetBrief, encounterReturningNames } =
    await import("../../packages/server/src/routes/encounter.routes.js");
  const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8");
  const parsed = parseRulesetDefinition(JSON.parse(read("docs/development/ruleset-5e-2014.example.json")));
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition = parsed.definition;

  // ── The names a game keeps, each once ──
  const kept = {
    "captain voss": { name: "Captain Voss", tier: "cr_3", taken: 20 },
    "cult thug": { name: "Cult Thug" },
    "cult thug#2": { name: "Cult Thug" },
    junk: { tier: "cr_1" },
  };
  assert.deepEqual(encounterReturningNames(kept), ["Captain Voss", "Cult Thug"]);
  assert.deepEqual(encounterReturningNames(undefined), []);
  assert.deepEqual(encounterReturningNames([]), []);

  // ── The prompt names them, and asks for exactly those names ──
  const brief = await encounterRulesetBrief(definition, null);
  assert.ok(brief);
  const prompt = (withBrief: typeof brief) =>
    buildInitPrompt("Ada", "persona", "cards", [], "", "", false, undefined, withBrief)
      .map((message) => message.content)
      .join("\n");
  const before = prompt(brief);
  assert.doesNotMatch(before, /got away from an earlier fight/, "a game keeping none is asked as before");
  const text = prompt({ ...brief!, returning: encounterReturningNames(kept) });
  assert.match(
    text,
    /- Enemies that got away from an earlier fight, which the Engine keeps as they left it: Captain Voss, Cult Thug\. One of them back in this fight is written under exactly that name, never a new one or a new title;/,
  );
  // The route hands the game's kept foes to the brief.
  const route = read("packages/server/src/routes/encounter.routes.ts");
  assert.match(route, /const returning = encounterReturningNames\(chatMeta\.gameReturningFoes\);/);

  // ── Kept under that name, it comes back as it left ──
  {
    const { rulesetBringBackFoe } =
      await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");
    const block = {
      health: 40,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      abilities: { str: 14, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      actions: [{ id: "club", name: "Club", budget: "action", toHit: 4, damage: { dice: "1d6", flat: 2 } }],
    } as unknown as RulesetStatBlock;
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "voss", name: "Captain Voss", side: "enemy", block },
        { id: "ada", name: "Ada", side: "party", block },
      ],
    });
    const voss = state.combatants.find((one) => one.id === "voss")!;
    rulesetBringBackFoe(definition, voss, { name: "Captain Voss", health: 40, taken: 25 }, undefined);
    assert.equal(voss.health?.value, 15, "still missing what it got away without");
    // A night's rest since it got away gives it back.
    const rested = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [{ id: "voss", name: "Captain Voss", side: "enemy", block }],
    }).combatants[0]!;
    rulesetBringBackFoe(definition, rested, { name: "Captain Voss", health: 40, taken: 25, clock: 0 }, 9 * 60);
    assert.equal(rested.health?.value, 40);

    // ── Dash spends the action: nothing to attack with after it ──
    state.order = ["voss", "ada"];
    state.turn = 0;
    const dashed = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "voss", optionId: "standard:dash", targetIds: [] },
      () => 10,
    );
    assert.ok(!dashed.events.some((event) => event.type === "refused"));
    assert.deepEqual(
      rulesetCombatOptions(definition, dashed.state, "voss").map((option) => option.kind),
      ["end-turn"],
    );
  }

  console.log(
    "Returning names: the foes a game keeps are named to the encounter's Game Master and come back as they left; a Dash leaves no attack.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
