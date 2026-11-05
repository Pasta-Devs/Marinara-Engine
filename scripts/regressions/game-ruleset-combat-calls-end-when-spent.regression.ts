/**
 * A call that ends once it is spent (Capability API 1.742): a Dancing Sword, which returns to hand
 * "after the hovering sword attacks for the fourth time".
 *
 *   - Tossed, the sword becomes the hovering sword; its fourth attack sends it away, back in hand.
 *   - Without `endsWhenSpent` it stays, with no attack left.
 *   - The install gate.
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
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCatalogEntriesById,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-calls-end-when-spent-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 742);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const hovering = {
    id: "hovering-sword",
    label: "Hovering Sword",
    creature: {
      health: 20,
      defense: 17,
      initiativeModifier: 0,
      speed: 0,
      tier: "cr_1",
      actions: [
        {
          id: "slash",
          name: "Slash",
          budget: "action",
          toHit: 6,
          damage: { dice: "1d8", flat: 3 },
          reach: 30,
          uses: { per: "encounter", count: 4 },
        },
      ],
    },
  };
  const toss = (spent: boolean) => ({
    creature: "creatures/hovering-sword",
    count: { flat: 1 },
    initiative: "after",
    becomesItem: true,
    ...(spent ? { endsWhenSpent: true } : {}),
  });
  const document = (spent = true) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hand", label: "Hand", count: 2 }] };
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push(structuredClone(hovering));
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "dancing-sword",
          label: "Dancing Sword",
          item: {
            category: "gear",
            stack: 1,
            slots: { hand: 1 },
            attack: { budget: "action", toHit: { bonus: 3 }, damage: { dice: "1d8", type: "slashing" } },
            use: { kind: "utility", targets: "self", budget: "bonus", label: "Toss", calls: toss(spent) },
          },
        },
      ],
    });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);

  const run = (spent: boolean) => {
    const definition = parsed(document(spent));
    const sword = (definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0] as RulesetCatalogEntry)
      .item!;
    const bestiary: RulesetCatalogEntriesById = {
      creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!,
    };
    let state: RulesetEncounterState = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary,
      combatants: [
        {
          id: "ada",
          name: "Ada",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
          }),
          live: {},
          items: [{ item: sword, quantity: 1, worn: true, name: "Dancing Sword" }],
        },
        {
          id: "ogre",
          name: "Ogre",
          side: "enemy",
          block: { health: 500, defense: 5, initiativeModifier: 0, speed: 30, actions: [] } as never,
        },
      ],
      board: {
        grid: { width: 12, height: 5, tiles: Array.from({ length: 5 }, () => Array(12).fill("plains")) },
        placements: { ada: { x: 3, y: 2 }, ogre: { x: 4, y: 2 } },
      },
    });
    state.order = ["ada", "ogre"];
    state.turn = 0;
    const use = rulesetCombatOptions(definition, state, "ada").find((one) => one.label.includes("Toss"))!;
    const tossed = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "ada", optionId: use.id, targetIds: [] },
      () => 10,
    );
    const id = of(tossed.events, "called")[0]!.ids[0]!;
    state = tossed.state;
    assert.ok(!rulesetCombatOptions(definition, state, "ada").some((one) => one.id === "item:0"), "out of hand");
    const sent: string[] = [];
    for (let n = 0; n < 4; n++) {
      state.turn = state.order.indexOf(id);
      rulesetCombatant(state, id)!.budgets.action = 1;
      const step = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: id, optionId: "slash", targetIds: ["ogre"] },
        () => 10,
      );
      assert.deepEqual(of(step.events, "refused"), [], JSON.stringify(step.events));
      sent.push(...of(step.events, "sentAway").map((one) => `${n + 1}:${one.reason}`));
      state = step.state;
    }
    state.turn = state.order.indexOf("ada");
    return {
      sent,
      inHand: rulesetCombatOptions(definition, state, "ada").some((one) => one.id === "item:0"),
    };
  };

  // ── Spent on its fourth attack, back in hand ──
  assert.deepEqual(run(true), { sent: ["4:spent"], inHand: true });
  // ── Without it, the sword hovers on ──
  assert.deepEqual(run(false), { sent: [], inHand: false });

  // ── The install gate ──
  const gate =
    "A ruleset with a call that ends once its creatures' counted actions are spent (calls.endsWhenSpent) requires schemaVersion 2 and capabilityApi 1.742 or newer";
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
  assert.equal(getCapabilityPackageInstallIssue(manifest(741) as never, document()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(742) as never, document()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(741) as never, document(false)), gate);

  console.log(
    "Calls end when spent: a Dancing Sword's hovering sword returns to hand after its fourth attack; gated at 1.742.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
