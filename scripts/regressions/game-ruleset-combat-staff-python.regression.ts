/**
 * An item that becomes the creature it calls, and a catalog entry's or an item's call its user may
 * dismiss (Capability API 1.613): a Staff of the Python, "The staff becomes a giant constrictor
 * snake under your control ... By using a bonus action to speak the command word again, you return
 * the staff to its normal form".
 *
 *   - Thrown down: the snake stands, and the staff's blow and its use are offered no more.
 *   - Turned back on a bonus action: the snake leaves and the staff is in hand again.
 *   - The snake killed: the staff is spent for good.
 *   - Refusals; the install gate.
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
  type RulesetCatalogEntriesById,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-staff-python-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 613);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const snake = {
    id: "snake",
    label: "Giant Constrictor Snake",
    creature: {
      health: 20,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      tier: "cr_2",
      actions: [{ id: "bite", name: "Bite", budget: "action", toHit: 6, damage: { flat: 11 }, reach: 10 }],
    },
  };
  const python: Record<string, unknown> = {
    creature: "creatures/snake",
    count: { flat: 1 },
    becomesItem: true,
    dismissible: { budget: "bonus" },
    spendsItemOnDeath: true,
  };
  const document = (calls: Record<string, unknown> = python, edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = {
      categories: [{ id: "gear", label: "Gear" }],
      slots: [{ id: "hand", label: "Hand", count: 2 }],
    };
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push(structuredClone(snake));
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "staff",
          label: "Staff of the Python",
          item: {
            category: "gear",
            stack: 1,
            slots: { hand: 1 },
            attack: { budget: "action", toHit: { bonus: 2 }, damage: { dice: "1d6", type: "bludgeoning" } },
            use: { kind: "utility", targets: "self", budget: "action", label: "Throw down", calls },
          },
        },
      ],
    });
    edit(doc);
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
  const staff = (definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0] as RulesetCatalogEntry)
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
          items: [{ item: staff, quantity: 1, worn: true, name: "Staff of the Python" }],
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
        placements: { ada: { x: 3, y: 2 }, brute: { x: 4, y: 2 } },
      },
    });
    state.order = ["ada", "brute"];
    state.turn = 0;
    return state;
  };
  const labels = (state: RulesetEncounterState) =>
    rulesetCombatOptions(definition, state, "ada").map((one) => one.label);
  const thrown = () => {
    const state = fight();
    const before = rulesetCombatOptions(definition, state, "ada");
    assert.ok(
      before.some((one) => one.id === "item:0"),
      "the staff's blow",
    );
    const use = before.find((one) => /Throw down/.test(one.label));
    assert.ok(use, before.map((one) => one.label).join(", "));
    const taken = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "ada", optionId: use.id, targetIds: [] },
      roll,
    );
    const ids = of(taken.events, "called")[0]?.ids ?? [];
    assert.equal(ids.length, 1, JSON.stringify(taken.events));
    return { state: taken.state, snake: ids[0]!, use: use.id };
  };

  // ── Thrown down: no blow and no use while the snake stands ──
  {
    const { state, use } = thrown();
    rulesetCombatant(state, "ada")!.budgets.action = 1;
    const now = rulesetCombatOptions(definition, state, "ada");
    assert.ok(!now.some((one) => one.id === "item:0"), "no blow with a staff out of hand");
    assert.ok(!now.some((one) => one.id === use), "and no second snake");
    // ── Turned back on a bonus action ──
    const back = now.find((one) => one.id === `dismiss-called:${use}`);
    assert.ok(back?.dismiss, labels(state).join(", "));
    const sent = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "ada", optionId: back.id, targetIds: [] },
      roll,
    );
    assert.deepEqual(
      of(sent.events, "sentAway").map((one) => one.reason),
      ["dismissed"],
    );
    const ada = rulesetCombatant(sent.state, "ada")!;
    assert.equal(ada.budgets.bonus, 0, "on the bonus action");
    assert.equal(ada.budgets.action, 1, "not the action");
    const again = rulesetCombatOptions(definition, sent.state, "ada");
    assert.ok(
      again.some((one) => one.id === "item:0"),
      "the staff in hand again",
    );
    assert.ok(again.some((one) => one.id === use));
    assert.equal(ada.callRolls?.[0]?.spent, undefined, "and whole");
  }
  // ── The snake killed: the staff shatters ──
  {
    const { state, snake: called, use } = thrown();
    state.turn = state.order.indexOf("brute");
    const smash = rulesetCombatOptions(definition, state, "brute").find((one) => one.label === "Smash");
    assert.ok(smash, "the brute's smash");
    const hit = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "brute", optionId: smash.id, targetIds: [called] },
      roll,
    );
    assert.equal(of(hit.events, "itemSpent").length, 1);
    hit.state.turn = hit.state.order.indexOf("ada");
    rulesetCombatant(hit.state, "ada")!.budgets.action = 1;
    assert.ok(!rulesetCombatOptions(definition, hit.state, "ada").some((one) => one.id === use), "spent");
  }

  // ── Refusals ──
  refused(document({ ...python, dismissible: { budget: "nope" } }), /Unknown budget "nope"/);
  refused(
    document(python, (doc) =>
      doc.catalogs.push({
        id: "spells",
        label: "Spells",
        feeds: ["spells"],
        entries: [
          {
            id: "call",
            label: "Call",
            rows: [{ list: "spells", values: { name: "Call", level: 0, prepared: true } }],
            mechanics: { kind: "utility", targets: "self", budget: "action", calls: { ...python } },
          },
        ],
      }),
    ),
    /"spendsItemOnDeath" and "becomesItem" are for an item's call/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an item that becomes the creature it calls (calls.becomesItem), or a catalog entry's or an item's call its user may send away (calls.dismissible), requires schemaVersion 2 and capabilityApi 1.613 or newer";
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
    const plain = { creature: "creatures/snake", count: { flat: 1 } };
    assert.equal(getCapabilityPackageInstallIssue(manifest(612) as never, document()), gate);
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(612) as never, document({ ...plain, dismissible: true })),
      gate,
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(613) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(612) as never, document(plain)), gate);
  }

  console.log(
    "Staff of the Python: the staff becomes the snake, turned back on a bonus action, shattered with it; gated at 1.613.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
