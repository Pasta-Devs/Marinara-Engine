/**
 * An item spent as the creature it called dies, and a wait that starts at that creature's departure
 * (Capability API 1.612): a Ring of Djinni Summoning, "After the djinni departs, it can't be summoned
 * again for 24 hours, and the ring becomes nonmagical if the djinni dies".
 *
 *   - Rubbed, the ring keeps the djinni's stay (`outRounds`) as it counts down, and its last
 *     charge is spent.
 *   - The djinni killed: the ring is spent for good and offered no more; its stay ends.
 *   - Game time: a stay past the fight is waited out first (with `combat.roundSeconds`), then the
 *     24 hours.
 *   - Refusal without `roundSeconds`; the install gate.
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
  passRulesetItemTime,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetItemBook,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type GameInventoryStack,
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ring-djinni-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 612);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const djinni = {
    id: "djinni",
    label: "Djinni",
    creature: {
      health: 20,
      defense: 17,
      initiativeModifier: 0,
      speed: 30,
      tier: "cr_5",
      actions: [{ id: "scimitar", name: "Scimitar", budget: "action", toHit: 9, damage: { flat: 12 }, reach: 5 }],
    },
  };
  const document = (roundSeconds: number | null = 6) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    if (roundSeconds !== null) doc.combat.roundSeconds = roundSeconds;
    doc.items = { categories: [{ id: "wondrous", label: "Wondrous" }] };
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push(structuredClone(djinni));
    doc.catalogs.push({
      id: "gear",
      label: "Gear",
      holds: "items",
      entries: [
        {
          id: "ring",
          label: "Ring of Djinni Summoning",
          item: {
            category: "wondrous",
            stack: 1,
            charges: {
              max: 1,
              recharge: { rests: [], amount: "max", after: { hours: { flat: 24 }, fromDeparture: true } },
            },
            use: {
              kind: "utility",
              targets: "self",
              budget: "action",
              label: "Rub",
              charges: 1,
              calls: { creature: "creatures/djinni", count: { flat: 1 }, rounds: 600, spendsItemOnDeath: true },
            },
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
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const roll = (sides: number) => Math.min(sides, 10);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(document());
  const ring = (definition.catalogs!.find((catalog) => catalog.id === "gear")!.entries![0] as RulesetCatalogEntry)
    .item!;
  const bestiary: RulesetCatalogEntriesById = {
    creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!,
  };
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
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
          items: [{ item: ring, quantity: 1, worn: true, name: "Ring of Djinni Summoning" }],
        },
        {
          id: "brute",
          name: "Brute",
          side: "enemy",
          block: {
            health: 100,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [
              {
                id: "smash",
                name: "Smash",
                kind: "attack",
                budget: "action",
                toHit: 30,
                reach: 60,
                damage: { flat: 100, type: "bludgeoning" },
              },
            ],
          },
        },
      ],
      board: {
        grid: { width: 12, height: 5, tiles: Array.from({ length: 5 }, () => Array(12).fill("plains")) },
        placements: { ada: { x: 3, y: 2 }, brute: { x: 9, y: 2 } },
      },
    });
    state.order = ["ada", "brute"];
    state.turn = 0;
    return state;
  };
  const rub = () => {
    const state = fight();
    const option = rulesetCombatOptions(definition, state, "ada").find((one) => /Rub/.test(one.label));
    assert.ok(
      option,
      rulesetCombatOptions(definition, state, "ada")
        .map((one) => one.label)
        .join(", "),
    );
    const taken = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "ada", optionId: option.id, targetIds: [] },
      roll,
    );
    const ids = of(taken.events, "called")[0]?.ids ?? [];
    assert.equal(ids.length, 1, JSON.stringify(taken.events));
    return { state: taken.state, djinni: ids[0]! };
  };

  // ── Rubbed: the djinni's stay kept on the ring, counting down ──
  {
    const { state } = rub();
    assert.equal(rulesetCombatant(state, "ada")!.callRolls?.[0]?.outRounds, 600);
    const next = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "ada", optionId: "end-turn", targetIds: [] },
      roll,
    );
    let after = next.state;
    for (let guard = 0; guard < 6 && after.order[after.turn] !== "ada"; guard += 1) {
      after = applyRulesetCombatChoice(
        definition,
        after,
        { actorId: after.order[after.turn]!, optionId: "end-turn", targetIds: [] },
        roll,
      ).state;
    }
    assert.equal(rulesetCombatant(after, "ada")!.callRolls?.[0]?.outRounds, 599, "a round less");
  }
  // ── The djinni killed: the ring spent for good ──
  {
    const { state, djinni } = rub();
    state.turn = state.order.indexOf("brute");
    const smash = rulesetCombatOptions(definition, state, "brute").find((one) => one.label === "Smash");
    assert.ok(smash, "the brute's smash");
    const hit = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "brute", optionId: smash.id, targetIds: [djinni] },
      roll,
    );
    assert.deepEqual(
      of(hit.events, "itemSpent").map((one) => one.label),
      ["Ring of Djinni Summoning"],
    );
    const ada = rulesetCombatant(hit.state, "ada")!;
    assert.equal(ada.callRolls?.[0]?.spent, true);
    assert.equal(ada.callRolls?.[0]?.outRounds, undefined, "it has left");
    // Its charge back, it is still offered no more.
    ada.charges = { "0": 1 };
    hit.state.turn = hit.state.order.indexOf("ada");
    assert.ok(!rulesetCombatOptions(definition, hit.state, "ada").some((one) => /Rub/.test(one.label)));
  }

  // ── Game time: the stay waited out first, then the 24 hours ──
  {
    const book = rulesetItemBook(definition, {
      gear: definition.catalogs!.find((catalog) => catalog.id === "gear")!.entries! as RulesetCatalogEntry[],
    });
    const pass = (stacks: GameInventoryStack[], minutes: number) =>
      passRulesetItemTime({ definition, itemOf: book.itemOf, stacks, minutes, roll });
    // 600 rounds of 6 seconds: an hour still to stay.
    const bag: GameInventoryStack[] = [
      { id: "r", name: "Ring", item: "gear/ring", quantity: 1, charges: 0, callRoll: { outRounds: 600 } },
    ];
    const half = pass(bag, 30);
    assert.deepEqual(half.stacks[0]!.callRoll, { outRounds: 300 });
    assert.equal(half.stacks[0]!.waits, undefined, "not waiting yet");
    const day = pass(half.stacks, 24 * 60);
    assert.equal(day.stacks[0]!.callRoll, undefined, "it has left");
    assert.deepEqual(day.stacks[0]!.waits, { charges: { waited: 24 * 60 - 30, for: 24 * 60 } });
    assert.deepEqual(day.recharged, []);
    const back = pass(day.stacks, 30);
    assert.equal(back.recharged.length, 1, "24 hours after the djinni left");
  }

  // ── Refusal ──
  refused(document(null), /the fight says its "roundSeconds"/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an item spent as what it called dies (calls.spendsItemOnDeath), a wait from a called creature's departure (recharge.after.fromDeparture) or a round's length (combat.roundSeconds) requires schemaVersion 2 and capabilityApi 1.612 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(611) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(612) as never, document()), gate);
    const onlyRound = JSON.parse(fiveEText);
    onlyRound.combat.roundSeconds = 6;
    assert.equal(getCapabilityPackageInstallIssue(manifest(611) as never, onlyRound), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(611) as never, JSON.parse(fiveEText)), gate);
  }

  console.log("Ring of Djinni: spent as its djinni dies; its wait from the djinni's departure; gated at 1.612.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
