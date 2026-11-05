/**
 * A cost for using an item again before a rest (Capability API 1.744): 5e's Ring of X-ray Vision,
 * "if you use the ring again before taking a long rest, you must succeed on a DC 15 Constitution
 * saving throw or gain one level of exhaustion".
 *
 *   - In a fight: the first use costs nothing; each after it asks the save, failed a level of
 *     exhaustion. The count is written back to the ring's stack.
 *   - Out of a fight the same, the count read off and kept on the stack.
 *   - A long rest clears the count; a short one does not.
 *   - Refusals, and the install gate.
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
  rechargeRulesetItems,
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-again-before-rest-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 744);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (again: Record<string, unknown> | null = {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "xray", label: "X-ray vision" });
    doc.combat.conditions.push({ condition: "xray", effects: [] });
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "ring",
          label: "Ring of X-ray Vision",
          item: {
            category: "gear",
            stack: 1,
            use: {
              kind: "buff",
              budget: "action",
              label: "Peer",
              targets: "self",
              applies: [{ condition: "xray", duration: { rounds: 10 } }],
              ...(again
                ? {
                    againBeforeRest: {
                      rests: ["long"],
                      save: { save: "con_save", difficulty: 15 },
                      tracks: [{ track: "exhaustion", by: 1 }],
                      ...again,
                    },
                  }
                : {}),
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
  const definition = parsed(document());
  const ring = definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0]!.item!;
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 14, speed: 30, hp_max: 30 },
  });
  const fight = (held: { usesLeft?: Record<string, number> } = {}): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "seer",
          name: "Seer",
          side: "party",
          build,
          items: [
            {
              item: ring,
              quantity: 1,
              name: "Ring of X-ray Vision",
              stack: { id: "s-ring", ref: "kit/ring" },
              ...held,
            },
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
    state.order = ["seer", "wolf"];
    state.turn = 0;
    return state;
  };
  const seer = (state: RulesetEncounterState) => rulesetCombatant(state, "seer")!;
  /** Uses the ring, its d20 coming up `d20`; the step. */
  const peer = (state: RulesetEncounterState, d20 = 10) => {
    const working = structuredClone(state);
    rulesetCombatant(working, "seer")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, working, "seer").find((one) => /Peer/.test(one.label));
    assert.ok(option, "the ring's use is offered");
    const step = applyRulesetCombatChoice(
      definition,
      working,
      { actorId: "seer", optionId: option.id, targetIds: ["seer"] },
      () => d20,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step;
  };
  const saves = (step: ReturnType<typeof peer>) => step.events.filter((one) => one.type === "save");
  const tracks = (step: ReturnType<typeof peer>) =>
    step.events.flatMap((one) => (one.type === "track" ? [`${one.track} ${one.from}->${one.to}`] : []));

  // ── In a fight: the first use free, then the save each time ──
  {
    const start = fight();
    let step = peer(start, 2);
    assert.equal(saves(step).length, 0, "the first use asks nothing");
    assert.equal(seer(step.state).usesLeft?.["0:a"], 1);
    // Again, a 2 + 1 against 15: a level of exhaustion.
    step = peer(step.state, 2);
    assert.equal(saves(step).length, 1);
    assert.deepEqual(tracks(step), ["exhaustion 0->1"]);
    assert.equal(seer(step.state).usesLeft?.["0:a"], 2);
    // Again, a 20 + 1: made, nothing more.
    step = peer(step.state, 20);
    assert.equal(saves(step).length, 1);
    assert.deepEqual(tracks(step), []);
    assert.equal(seer(step.state).usesLeft?.["0:a"], 3);
    // Written back onto the ring's stack.
    const stacks: GameInventoryStack[] = [
      { id: "s-ring", name: "Ring of X-ray Vision", item: "kit/ring", quantity: 1 },
    ];
    const written = applyRulesetFightItemChanges(stacks, rulesetFightItemChanges(start, step.state));
    assert.ok(written);
    assert.deepEqual(written.stacks[0]!.usesLeft, { a: 3 });
    // The next fight reads it: its first use already asks the save.
    assert.equal(saves(peer(fight({ usesLeft: { a: 1 } }), 2)).length, 1);
  }

  // ── Out of a fight ──
  const entries = Object.fromEntries(
    (definition.catalogs ?? []).flatMap((catalog) =>
      catalog.entries && catalog.holds !== "rows" ? [[catalog.id, catalog.entries as RulesetCatalogEntry[]]] : [],
    ),
  );
  const book = rulesetItemBook(definition, entries);
  const outside = (usesLeft: Record<string, number> | undefined, d20: number) => {
    const used = useRulesetItemOutsideFight({
      definition,
      itemOf: book.itemOf,
      stacks: [
        {
          id: "s-ring",
          name: "Ring of X-ray Vision",
          item: "kit/ring",
          quantity: 1,
          ...(usesLeft ? { usesLeft } : {}),
        },
      ],
      stackId: "s-ring",
      user: { name: "Seer", build, live: {} },
      roll: () => d20,
    });
    assert.ok(used.ok, used.ok ? "" : used.reason);
    return used;
  };
  {
    const first = outside(undefined, 2);
    assert.equal(first.said.again, undefined, "the first use asks nothing");
    assert.deepEqual(first.stacks[0]!.usesLeft, { a: 1 });
    const failed = outside({ a: 1 }, 2);
    assert.equal(failed.said.again?.success, false);
    assert.equal(failed.said.again?.difficulty, 15);
    assert.equal(failed.said.again?.harms.length, 1);
    assert.match(
      rulesetItemUseLine(failed.said),
      /used again before a rest, .* save 3 against 15, failed \(Exhaustion/,
    );
    assert.equal((failed.live as { tracks?: Record<string, number> }).tracks?.exhaustion, 1);
    assert.deepEqual(failed.stacks[0]!.usesLeft, { a: 2 });
    const made = outside({ a: 2 }, 20);
    assert.equal(made.said.again?.success, true);
    assert.equal((made.live as { tracks?: Record<string, number> }).tracks?.exhaustion, undefined);
  }

  // ── A long rest clears the count; a short one does not ──
  {
    const stacks: GameInventoryStack[] = [
      { id: "s-ring", name: "Ring of X-ray Vision", item: "kit/ring", quantity: 1, usesLeft: { a: 2 } },
    ];
    const rest = (id: string) =>
      rechargeRulesetItems({ definition, itemOf: book.itemOf, stacks, holder: undefined, rest: id, roll: () => 1 });
    const long = rest("long");
    assert.equal(long.reset, true);
    assert.equal(long.stacks[0]!.usesLeft, undefined);
    const short = rest("short");
    assert.equal(short.reset, false);
    assert.deepEqual(short.stacks[0]!.usesLeft, { a: 2 });
  }

  // ── Refusals ──
  refused(document({ save: { save: "luck_save", difficulty: 15 } }), /Unknown save "luck_save"/);
  refused(document({ rests: ["nap"] }), /Unknown rest "nap"/);
  refused(document({ tracks: [{ track: "grit", by: 1 }] }), /Unknown track "grit"/);
  refused(document({ conditions: ["dazed"] }), /Unknown condition "dazed"/);
  refused(document({ tracks: undefined }), /moves tracks, puts on conditions, or both/);

  // ── The install gate ──
  const gate =
    "A ruleset with an item that costs something used again before a rest (use.againBeforeRest) requires schemaVersion 2 and capabilityApi 1.744 or newer";
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
  assert.equal(getCapabilityPackageInstallIssue(manifest(743) as never, document()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(744) as never, document()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(743) as never, document(null)), gate);

  console.log(
    "Again before rest: a Ring of X-ray Vision's second use before a long rest asks a DC 15 Constitution save, failed a level of exhaustion, in a fight and out; the count kept on its stack and cleared by a long rest; gated at 1.744.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
