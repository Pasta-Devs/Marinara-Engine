/**
 * Targets that grow with the sheet, the same one more than once (Capability API 1.305).
 *
 *   - `targetsScale`: extra targets at each step of what it reads, as `scales` adds dice: 5e's
 *     eldritch blast, a beam more at 5th, 11th and 17th level.
 *   - `targetsRepeat`: the same target may be named again, each its own attack with its own roll,
 *     and each carries what amends the entry (Agonizing Blast's damage, Repelling Blast's push).
 *   - Import refusals and the install gate.
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
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-beams-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { createCombatDirector } = await import("../../packages/server/src/services/game/combat-director.service.js");
const { commandRulesetCombatDirector, createRulesetFight, rulesetDirectorStage, syncRulesetCombatants } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 300);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const beams = {
    targetsScale: {
      from: { field: "level" },
      table: [
        [1, 0],
        [5, 1],
        [11, 2],
        [17, 3],
      ],
    },
    targetsRepeat: true,
  };
  const spell = (id: string, label: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label,
      rows: [{ list: "spells", values: { name: label, level: 0, prepared: true } }],
      mechanics: {
        kind: "attack",
        range: 120,
        attackRoll: true,
        amount: { dice: "1d10" },
        damageType: "force",
        ...mechanics,
      },
    }) as unknown as RulesetCatalogEntry;
  const blast = spell("eldritch-blast", "Eldritch Blast", beams);
  // Grows, but never at the same one twice.
  const spread = spell("spread", "Spread", { targetsScale: beams.targetsScale });
  const invocation = (id: string, amend: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "features", values: { name: id[0]!.toUpperCase() + id.slice(1) } }],
      mechanics: { kind: "utility", amends: [{ entry: "spells/eldritch-blast", ...amend }] },
    }) as unknown as RulesetCatalogEntry;
  const agonizing = invocation("agonizing", { damageAdd: { abilityMod: "cha" } });
  const repelling = invocation("repelling", { push: 10 });
  const spells = [blast, spread];
  const invocations = [agonizing, repelling];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
    doc.catalogs.push({
      id: "invocations",
      label: "Invocations",
      feeds: ["features"],
      entries: structuredClone(invocations),
    });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refusedDoc = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(fiveE());
  const rows = (catalog: string, entries: RulesetCatalogEntry[]) =>
    entries.flatMap((entry) => rowsFromCatalogEntry(catalog, entry).map((row) => row.row));
  const fight = (level: number, held: RulesetCatalogEntry[] = []): RulesetEncounterState => {
    const foe = (id: string) => ({
      id,
      name: id.toUpperCase(),
      side: "enemy" as const,
      block: {
        health: 300,
        defense: 5,
        initiativeModifier: 0,
        speed: 30,
        actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
      },
    });
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 15,
      combatants: [
        {
          id: "lock",
          name: "Lock",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 16 },
            fields: { level, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "cha" },
            lists: { spells: rows("spells", spells), features: rows("invocations", held) },
          }),
          live: {},
          catalogs: { spells, invocations },
        },
        foe("a"),
        foe("b"),
      ],
      board: {
        grid: { width: 40, height: 10, tiles: Array.from({ length: 10 }, () => Array(40).fill("plains")) } as never,
        placements: { lock: { x: 2, y: 5 }, a: { x: 6, y: 5 }, b: { x: 6, y: 7 } },
      },
    });
    state.order = ["lock", "a", "b"];
    state.turn = 0;
    return state;
  };
  const optionOf = (state: RulesetEncounterState, label: string) => {
    const option = rulesetCombatOptions(definition, state, "lock").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    return option;
  };
  const cast = (state: RulesetEncounterState, label: string, targetIds: string[]): RulesetCombatStep =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "lock", optionId: optionOf(state, label).id, targetIds },
      () => 15,
    );
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const hits = (step: RulesetCombatStep) =>
    step.events.flatMap((one) => (one.type === "damage" ? [`${one.targetId}:${one.amount}`] : []));

  // ── A beam more at 5th, 11th and 17th level ──
  {
    for (const [level, count] of [
      [1, 1],
      [4, 1],
      [5, 2],
      [11, 3],
      [17, 4],
      [20, 4],
    ] as const) {
      const targets = optionOf(fight(level), "Eldritch Blast").targets;
      assert.deepEqual(targets, { side: "enemy", count, repeat: true }, `level ${level}`);
    }
    assert.deepEqual(optionOf(fight(11), "Spread").targets, { side: "enemy", count: 3 });
  }

  // ── Each beam its own attack, at the same one or another ──
  {
    const step = cast(fight(11), "Eldritch Blast", ["a", "a", "b"]);
    assert.equal(refused(step), undefined, JSON.stringify(step.events));
    const attacks = step.events.filter((one) => one.type === "attack");
    assert.equal(attacks.length, 3, "three attack rolls");
    const dealt = hits(step);
    assert.equal(dealt.filter((one) => one.startsWith("a:")).length, 2, "two beams at A");
    assert.equal(dealt.filter((one) => one.startsWith("b:")).length, 1, "one at B");
    // More than it has beams is refused, as is a second at the same one without targetsRepeat.
    assert.ok(refused(cast(fight(11), "Eldritch Blast", ["a", "a", "a", "b"])), "four beams at 11th level");
    const once = cast(fight(11), "Spread", ["a", "a", "b"]);
    assert.equal(hits(once).filter((one) => one.startsWith("a:")).length, 1, "the same one once");
  }

  // ── A beam at one an earlier beam dropped goes at the next still up, or nowhere (laptop playtest
  //    2026-10-25: Magic Missile darts landing on a downed foe) ──
  {
    const frail = fight(11);
    rulesetCombatant(frail, "a")!.health.value = 1;
    const step = cast(frail, "Eldritch Blast", ["a", "a", "b"]);
    assert.equal(refused(step), undefined, JSON.stringify(step.events));
    const dealt = hits(step);
    assert.equal(dealt.filter((one) => one.startsWith("a:")).length, 1, `one beam drops A: ${dealt}`);
    assert.equal(dealt.filter((one) => one.startsWith("b:")).length, 2, "the second goes at B");
    const alone = fight(11);
    rulesetCombatant(alone, "a")!.health.value = 1;
    assert.equal(hits(cast(alone, "Eldritch Blast", ["a", "a"])).length, 1, "with nobody else up, it goes nowhere");
  }

  // ── What amends it rides on every beam ──
  {
    const plain = hits(cast(fight(5), "Eldritch Blast", ["a", "a"]));
    const agonized = hits(cast(fight(5, [agonizing]), "Eldritch Blast", ["a", "a"]));
    assert.equal(agonized.length, 2);
    for (let index = 0; index < 2; index++) {
      const amount = (one: string) => Number(one.split(":")[1]);
      assert.equal(amount(agonized[index]!), amount(plain[index]!) + 3, `Charisma +3 on beam ${index + 1}`);
    }
    const pushed = cast(fight(5, [repelling]), "Eldritch Blast", ["a", "a"]);
    assert.equal(rulesetCombatant(pushed.state, "a")!.x, 10, "10 feet a beam, 20 in all");
  }

  // ── Played by the Engine, every beam goes at whom it picked ──
  {
    const bestiary = Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
      ),
    );
    const creatures = (definition.catalogs ?? []).find((catalog) => catalog.holds === "creatures")!;
    const build = rulesetSheetBuildSchema.parse({
      abilities: { str: 8, dex: 10, con: 14, int: 10, wis: 10, cha: 16 },
      fields: { level: 11, ac: 12, speed: 30, hp_max: 80, spellcasting_ability: "cha" },
      lists: { spells: rows("spells", [blast]) },
    });
    const built = createRulesetFight({
      definition,
      seed: 3,
      positioned: true,
      party: [{ id: "ada", name: "Ada" }],
      enemies: [{ id: "foe", name: "Foe", creature: `${creatures.id}/${creatures.entries![0]!.id}` }],
      cards: [{ name: "Ada", rulesetSheet: { v: 1, build } }],
      playerName: null,
      live: {},
      items: () => [],
      partyCatalogs: { spells },
      bestiary,
    } as never);
    assert.ok(built.ok, built.ok ? "" : (built as { error: string }).error);
    const unit = (id: string, name: string, side: "player" | "enemy") => ({
      id,
      name,
      side,
      hp: 30,
      maxHp: 30,
      attack: 8,
      defense: 6,
      speed: 6,
      level: 3,
      skills: [],
    });
    const state = createCombatDirector({
      id: "fight",
      anchor: "anchor",
      style: "ruleset",
      party: [unit("ada", "Ada", "player")],
      enemies: [unit("foe", "Foe", "enemy")],
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    state.rulesetFight = (built as { fight: never }).fight;
    syncRulesetCombatants(definition, state);
    state.stage = rulesetDirectorStage(state);
    assert.ok(commandRulesetCombatDirector(definition, state, { type: "control", unitId: "ada", controller: "ai" }).ok);
    for (
      let guard = 0;
      guard < 4 &&
      !state.rulesetFight!.events.some((entry) => entry.event.type === "attack" && entry.event.actorId === "ada");
      guard++
    ) {
      assert.ok(commandRulesetCombatDirector(definition, state, { type: "continue" }).ok);
    }
    const blasts = state.rulesetFight!.events.filter(
      (entry) => entry.event.type === "attack" && entry.event.actorId === "ada",
    );
    assert.equal(blasts.length, 3, "all three beams at the one foe");
  }

  // ── Refusals ──
  {
    const withSpell = (mechanics: Record<string, unknown>) =>
      fiveE((doc) => {
        doc.catalogs
          .find((catalog: { id: string }) => catalog.id === "spells")
          .entries.push(spell("odd", "Odd", mechanics));
      });
    refusedDoc(withSpell({ targets: "self", targetsRepeat: true }), /targetsRepeat/);
    refusedDoc(withSpell({ area: { shape: "burst", size: 10 }, targetsScale: beams.targetsScale }), /targetsScale/);
    refusedDoc(
      withSpell({ targetsScale: { from: { derived: "power" }, table: [[1, 0]] } }),
      /Unknown derived value "power"/,
    );
  }

  // ── The gate ──
  {
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      id: "fivee",
      name: "5e",
      version: "1.0.0",
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const gate =
      "A ruleset with targets that grow with the sheet, or the same target more than once, requires schemaVersion 2 and capabilityApi 1.305 or newer";
    for (const mechanics of [{ targetsRepeat: true }, { targetsScale: beams.targetsScale }]) {
      const doc = JSON.parse(fiveEText) as Record<string, any>;
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [spell("x", "X", mechanics)] });
      assert.equal(getCapabilityPackageInstallIssue(manifest(304) as never, doc), gate);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(305) as never, doc), gate);
    }
  }

  console.log(
    "Beams: eldritch blast's beams grow with level, each its own attack at the same target or another, every amend on each; refusals; gated at 1.305.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
