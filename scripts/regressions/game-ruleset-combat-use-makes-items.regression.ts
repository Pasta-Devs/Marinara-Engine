/**
 * Items made by an item's use (Capability API 1.745): a scroll of Goodberry, whose spell makes ten
 * berries.
 *
 *   - In a fight: read, the scroll is spent and ten berries land in its reader's hand, each one's use
 *     offered there; written to their bag as the fight ends.
 *   - Outside a fight: the berries go straight into the bag beside it.
 *   - A refusal, and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  applyRulesetFightItemChanges,
  createRulesetEncounter,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetFightItemChanges,
  rulesetItemBook,
  rulesetItemUseLine,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  useRulesetItemOutsideFight,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-use-makes-items-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 745);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (made: unknown = "kit/berry") => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "scroll",
          label: "Scroll of Goodberry",
          item: {
            category: "gear",
            stack: 10,
            use: {
              kind: "utility",
              budget: "action",
              label: "Read",
              targets: "self",
              consumes: true,
              ...(made ? { makesItems: { item: made, count: 10 } } : {}),
            },
          },
        },
        {
          id: "berry",
          label: "Goodberry",
          item: {
            category: "gear",
            stack: 10,
            use: { kind: "heal", budget: "action", label: "Eat", targets: "self", consumes: true, amount: { flat: 1 } },
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
  const definition = parsed(document());
  const entries = definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries!;
  const scroll = entries[0]!.item!;
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 14, cha: 10 },
    fields: { level: 5, ac: 14, speed: 30, hp_max: 30 },
  });
  const start = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "druid",
          name: "Druid",
          side: "party",
          build,
          holder: null,
          items: [
            { item: scroll, quantity: 1, name: "Scroll of Goodberry", stack: { id: "s-scroll", ref: "kit/scroll" } },
          ],
        },
        {
          id: "wolf",
          name: "Wolf",
          side: "enemy",
          block: {
            health: 20,
            defense: 12,
            initiativeModifier: 0,
            speed: 40,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
      ],
    });
    state.order = ["druid", "wolf"];
    state.turn = 0;
    return state;
  };
  const options = (state: RulesetEncounterState) => {
    const working = structuredClone(state);
    rulesetCombatant(working, "druid")!.budgets.action = 1;
    return { working, options: rulesetCombatOptions(definition, working, "druid") };
  };

  // ── In a fight ──
  {
    const before = start();
    const { working, options: offered } = options(before);
    assert.equal(
      offered.some((one) => /Eat/.test(one.label)),
      false,
      "no berries yet",
    );
    const read = offered.find((one) => /Read/.test(one.label));
    assert.ok(read, offered.map((one) => one.label).join(", "));
    const step = applyRulesetCombatChoice(
      definition,
      working,
      { actorId: "druid", optionId: read.id, targetIds: ["druid"] },
      () => 10,
    );
    const made = step.events.find((one) => one.type === "itemsMade");
    assert.ok(made && made.type === "itemsMade" && made.count === 10, JSON.stringify(step.events));
    assert.ok(
      options(step.state).options.some((one) => /Eat/.test(one.label)),
      "a berry's use is offered",
    );
    const stacks: GameInventoryStack[] = [
      { id: "s-scroll", name: "Scroll of Goodberry", item: "kit/scroll", quantity: 1 },
    ];
    const written = applyRulesetFightItemChanges(stacks, rulesetFightItemChanges(before, step.state));
    assert.ok(written);
    assert.deepEqual(
      written.stacks.map((one) => [one.item, one.quantity]),
      [["kit/berry", 10]],
    );
  }

  // ── Outside a fight ──
  {
    const book = rulesetItemBook(definition, { kit: entries as RulesetCatalogEntry[] });
    const used = useRulesetItemOutsideFight({
      definition,
      itemOf: book.itemOf,
      stacks: [{ id: "s-scroll", name: "Scroll of Goodberry", item: "kit/scroll", quantity: 2 }],
      stackId: "s-scroll",
      user: { name: "Druid", build, live: {} },
      roll: () => 1,
    });
    assert.ok(used.ok, used.ok ? "" : used.reason);
    assert.deepEqual(used.stacks.map((one) => [one.item, one.quantity]).sort(), [
      ["kit/berry", 10],
      ["kit/scroll", 1],
    ]);
    assert.deepEqual(used.said.made, { name: "Goodberry", count: 10 });
    assert.match(rulesetItemUseLine(used.said), /makes 10 Goodberry/);
  }

  // ── Refused: a made thing that is no item ──
  {
    const result = parseRulesetDefinition(document("kit/nothing"));
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.issues.join("; "), /Unknown entry "kit\/nothing"/);
  }

  // ── The install gate ──
  const gate =
    "A ruleset with an item whose use makes items (use.makesItems) requires schemaVersion 2 and capabilityApi 1.745 or newer";
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
  assert.equal(getCapabilityPackageInstallIssue(manifest(744) as never, document()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(745) as never, document()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(744) as never, document(null)), gate);

  console.log(
    "Use makes items: a scroll of Goodberry read in a fight puts ten berries in hand, written to the bag; outside one, into the bag; gated at 1.745.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
