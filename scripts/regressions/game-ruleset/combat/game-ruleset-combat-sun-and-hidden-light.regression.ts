/**
 * A creature's light hidden under a condition, and light that is sunlight (Capability API 1.298).
 *
 *   - A creature's `lightOutWhile`: its own light sheds nothing while one of those conditions is on
 *     it, and comes back when it ends: a will-o'-wisp invisible, its light with it.
 *   - A light's `sunlight`: its bright light is the sun's, for what holds only in sunlight (a sun
 *     blade against Sunlight Sensitivity), over a dark board or a bright one.
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
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  rulesetLightAt,
  rulesetLightOf,
  supportedCapabilityApi,
  type RulesetBoardLight,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-sun-hidden-light-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 293);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const claw = { id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { dice: "1d4" }, reach: 5 };
  const creature = (id: string, extra: Record<string, unknown>, actions: unknown[] = []) => ({
    id,
    label: id[0]!.toUpperCase() + id.slice(1),
    creature: {
      health: 20,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      tier: "cr_1_2",
      actions: [claw, ...actions],
      ...extra,
    },
  });
  const wisp = creature("wisp", { light: { bright: 20, dim: 20 }, lightOutWhile: ["invisible"] }, [
    { id: "small", name: "Glow 5", budget: "bonus", sheds: { bright: 5, dim: 5 } },
  ]);
  // A sun blade's bearer: 15 feet of sunlight, 15 more of dim light.
  const sunlit = creature("sunlit", { light: { bright: 15, dim: 15, sunlight: true } });
  // A plain torch-bearer.
  const torch = creature("torch", { light: { bright: 20, dim: 20 } });
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.senses = [{ id: "darkvision", label: "Darkvision" }];
    doc.combat.sight = { unseenAttacks: true, eyes: "sight", darkness: { seeIn: ["darkvision"] } };
    doc.catalogs.find((catalog: { id: string }) => catalog.id === "creatures").entries.push(wisp, sunlit, torch);
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
  const entries = definition.catalogs!.find((catalog) => catalog.id === "creatures")!.entries!;
  const blockOf = (id: string): RulesetStatBlock =>
    rulesetCreatureBlock(
      definition,
      entries.find((entry) => entry.id === id),
    )!;
  const fight = (
    placements: Record<string, { x: number; y: number }>,
    light: RulesetBoardLight = "dark",
  ): RulesetEncounterState => {
    const ids = Object.keys(placements);
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: ids.map((id) => ({ id, name: id, side: "enemy" as const, block: blockOf(id) })),
      board: {
        grid: {
          width: 30,
          height: 10,
          tiles: Array.from({ length: 10 }, () => Array.from({ length: 30 }, () => "plains")),
        } as never,
        placements,
        light,
      },
    });
    state.order = ids;
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const lightAt = (state: RulesetEncounterState, x: number, y = 5) => rulesetLightAt(definition, state, { x, y });

  // ── A will-o'-wisp invisible, its light with it ──
  {
    assert.deepEqual(blockOf("wisp").lightOutWhile, ["invisible"], "the block keeps it");
    const state = fight({ wisp: { x: 10, y: 5 } });
    assert.ok(rulesetLightOf(definition, who(state, "wisp"), state), "lit while seen");
    assert.equal(lightAt(state, 12), "bright");
    who(state, "wisp").tracked.push({ condition: "invisible", rounds: null } as never);
    assert.equal(rulesetLightOf(definition, who(state, "wisp"), state), null, "its light hidden with it");
    assert.equal(lightAt(state, 12), "dark");
    // Its own light set smaller while invisible, still hidden.
    const option = rulesetCombatOptions(definition, state, "wisp").find((one) => one.label === "Glow 5");
    assert.ok(option);
    const glowing = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "wisp", optionId: option.id, targetIds: [] },
      () => 10,
    );
    assert.equal(rulesetLightOf(definition, who(glowing.state, "wisp"), glowing.state), null);
    // Visible again, back.
    who(glowing.state, "wisp").tracked = who(glowing.state, "wisp").tracked.filter(
      (one) => one.condition !== "invisible",
    );
    assert.equal(rulesetLightOf(definition, who(glowing.state, "wisp"), glowing.state)?.bright, 1, "back, as last set");
    // Another condition leaves it be.
    const prone = fight({ wisp: { x: 10, y: 5 } });
    who(prone, "wisp").tracked.push({ condition: "prone", rounds: null } as never);
    assert.ok(rulesetLightOf(definition, who(prone, "wisp"), prone), "lit while prone");
    // A creature without it keeps its light whatever is on it.
    const plain = fight({ torch: { x: 10, y: 5 } });
    who(plain, "torch").tracked.push({ condition: "invisible", rounds: null } as never);
    assert.ok(rulesetLightOf(definition, who(plain, "torch"), plain), "a torch-bearer's torch stays lit");
  }

  // ── Light that is sunlight ──
  {
    const state = fight({ sunlit: { x: 10, y: 5 } });
    assert.equal(rulesetLightOf(definition, who(state, "sunlit"), state)?.sunlight, 3);
    assert.equal(lightAt(state, 10), "sunlight", "where it stands");
    assert.equal(lightAt(state, 13), "sunlight", "15 feet off");
    assert.equal(lightAt(state, 14), "dim", "20 feet off");
    assert.equal(lightAt(state, 17), "dark", "past it");
    // Beside a plain bright light it still is the sun's.
    const both = fight({ torch: { x: 12, y: 5 }, sunlit: { x: 10, y: 5 } });
    assert.equal(lightAt(both, 12), "sunlight", "the sun outshines a torch");
    assert.equal(lightAt(both, 16), "bright", "the torch alone");
    // Over a board already bright, only its own reach is sunlight.
    const day = fight({ sunlit: { x: 10, y: 5 } }, "bright");
    assert.equal(lightAt(day, 12), "sunlight");
    assert.equal(lightAt(day, 20), "bright");
    // A plain light over a bright board changes nothing.
    assert.equal(lightAt(fight({ torch: { x: 10, y: 5 } }, "bright"), 12), "bright");
    // Its sunlight is no farther than its bright light.
    const dim = fight({ sunlit: { x: 10, y: 5 } }, "dim");
    assert.equal(lightAt(dim, 14), "dim");
    // A spell zone's sunlight.
    const doc = fiveE((document) => {
      document.catalogs.push({
        id: "spells",
        label: "Spells",
        feeds: ["spells"],
        entries: [
          {
            id: "sunbeam",
            label: "Sunbeam",
            rows: [{ list: "spells", values: { name: "Sunbeam", level: 0, prepared: true } }],
            mechanics: {
              kind: "utility",
              area: { shape: "burst", size: 5 },
              range: 60,
              zone: { rounds: 1, triggers: [], lights: { bright: 5, dim: 0, sunlight: true } },
            },
          },
        ],
      });
    });
    const withSpell = parsed(doc);
    const spell = withSpell.catalogs!.find((catalog) => catalog.id === "spells")!.entries![0]!;
    assert.equal((spell.mechanics as any).zone.lights.sunlight, true);
  }

  // ── Refusals ──
  {
    refusedDoc(
      fiveE((doc) =>
        doc.catalogs
          .find((catalog: { id: string }) => catalog.id === "creatures")
          .entries.push(creature("odd", { light: { bright: 5, dim: 5 }, lightOutWhile: ["nowhere"] })),
      ),
      /Unknown condition "nowhere"/,
    );
    refusedDoc(
      fiveE((doc) =>
        doc.catalogs
          .find((catalog: { id: string }) => catalog.id === "creatures")
          .entries.push(creature("odd", { lightOutWhile: ["invisible"] })),
      ),
      /sheds a light/,
    );
    refusedDoc(
      fiveE((doc) =>
        doc.catalogs
          .find((catalog: { id: string }) => catalog.id === "creatures")
          .entries.push(creature("odd", { light: { bright: 5, dim: 5, sunlight: "yes" } })),
      ),
      /sunlight/,
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
      "A ruleset with creatures whose light goes out under a condition, or light that is sunlight, requires schemaVersion 2 and capabilityApi 1.298 or newer";
    for (const thing of [
      creature("a", { lightOutWhile: ["invisible"] }),
      creature("b", { light: { bright: 1, dim: 1, sunlight: true } }),
    ]) {
      const doc = JSON.parse(fiveEText) as Record<string, any>;
      doc.catalogs.find((catalog: { id: string }) => catalog.id === "creatures").entries.push(thing);
      assert.equal(getCapabilityPackageInstallIssue(manifest(297) as never, doc), gate, thing.id);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(298) as never, doc), gate, thing.id);
    }
  }

  console.log(
    "Sun and hidden light: a will-o'-wisp's light hidden while it is invisible and back after, a sun blade's sunlight over dark and bright boards; refusals; gated at 1.298.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
