/**
 * Lay on Hands (Capability API 1.251).
 *
 *   - An entry's `usesChosen`: its option offers an `amount` up to the uses left, the choice spends
 *     that many and heals that many times over.
 *   - Left out, it spends what heals the first target fully, never more than is left.
 *   - More than is left, or none, is refused and spends nothing.
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
  readRulesetLive,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-lay-on-hands-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 246);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const layOnHands = {
    id: "lay-on-hands",
    label: "Lay on Hands",
    rows: [
      { list: "features", values: { name: "Lay on Hands" } },
      { list: "counters", values: { name: "Lay on Hands Pool", max: 25, recharge: "long" } },
    ],
    mechanics: {
      kind: "heal",
      budget: "action",
      targets: "ally",
      amount: { flat: 1 },
      usesOf: "Lay on Hands Pool",
      usesChosen: true,
    },
  };
  const features = [layOnHands] as unknown as RulesetCatalogEntry[];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({
      id: "oath",
      label: "Oath",
      feeds: ["features", "counters"],
      entries: structuredClone(features),
    });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const roll = () => 3;
  const rows = (list: string) =>
    features.flatMap((entry) =>
      rowsFromCatalogEntry("oath", entry).flatMap((one) => (one.list === list ? [one.row] : [])),
    );
  const sheet = (name: string, hp: number) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 16, dex: 10, con: 14, int: 8, wis: 10, cha: 16 },
      fields: { level: 5, ac: 18, speed: 30, hp_max: hp, name },
      lists: { features: rows("features"), counters: rows("counters") },
    });
  const fight = (friendHp = 12): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "paladin",
          name: "Paladin",
          side: "party",
          build: sheet("Paladin", 44),
          live: {},
          catalogs: { oath: features },
        },
        {
          id: "friend",
          name: "Friend",
          side: "party",
          build: sheet("Friend", 40),
          live: { pools: { hp: { value: friendHp } } },
        },
        {
          id: "foe",
          name: "Foe",
          side: "enemy",
          block: {
            health: 50,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [],
          } as unknown as RulesetStatBlock,
        },
      ],
    });
    state.order = ["paladin", "friend", "foe"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const hp = (state: RulesetEncounterState) =>
    rulesetCombatHealth(definition, definition.combat!, who(state, "friend")).value;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const option = (state: RulesetEncounterState) => {
    const found = rulesetCombatOptions(definition, state, "paladin").find((one) => one.label === "Lay on Hands");
    assert.ok(found, "the paladin has Lay on Hands");
    return found;
  };
  const pool = (state: RulesetEncounterState) => {
    const paladin = who(state, "paladin");
    return readRulesetLive(definition, paladin.sheet!.build, paladin.sheet!.live).pools.find(
      (one) => one.key === "counters:lay on hands pool",
    )?.value;
  };
  const lay = (state: RulesetEncounterState, amount?: number) =>
    applyRulesetCombatChoice(
      definition,
      state,
      {
        actorId: "paladin",
        optionId: option(state).id,
        targetIds: ["friend"],
        ...(amount !== undefined ? { amount } : {}),
      },
      roll,
    );

  // ── The amount chosen: that many points spent, that many hit points back ──
  {
    const state = fight();
    assert.equal(pool(state), 25);
    assert.deepEqual(option(state).amount, { max: 25 }, "the menu offers up to the whole pool");
    const step = lay(state, 7);
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    assert.equal(hp(step.state), 19, "seven points heal seven");
    assert.equal(pool(step.state), 18, "and spend seven");
  }

  // ── Left out: just enough to fill the target, never more than is left ──
  {
    const state = fight();
    const step = lay(state);
    assert.equal(hp(step.state), 37, "28 missing: 25 is all there is");
    assert.equal(pool(step.state), 0);
    const near = fight(36);
    const topped = lay(near);
    assert.equal(hp(topped.state), 40, "four missing heals four");
    assert.equal(pool(topped.state), 21, "and spends only four");
    who(topped.state, "paladin").budgets.action = 1;
    assert.deepEqual(option(topped.state).amount, { max: 21 }, "the menu offers what is left");
  }

  // ── More than is left, or none, spends nothing ──
  {
    for (const amount of [26, 0, 2.5]) {
      const state = fight();
      const step = lay(state, amount);
      assert.equal(of(step.events, "refused").length, 1, `${amount} is refused`);
      assert.equal(pool(step.state), 25);
      assert.equal(hp(step.state), 12);
    }
  }

  // ── Import refusals ──
  {
    const refused = (edit: (doc: Record<string, any>) => void) => {
      const result = parseRulesetDefinition(fiveE(edit));
      assert.equal(result.ok, false);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => /"usesChosen" heals as many times over/.test(issue)),
          result.issues.join("; "),
        );
    };
    const entry = (doc: Record<string, any>) =>
      doc.catalogs.find((one: { id: string }) => one.id === "oath").entries[0].mechanics;
    refused((doc) => (entry(doc).kind = "buff"));
    refused((doc) => (entry(doc).usesSpent = 2));
  }

  // ── The install gate ──
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
      "A ruleset with heals that spend as many uses as their user chooses requires schemaVersion 2 and capabilityApi 1.251 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, document: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, document, files as never);
    const document = structuredClone(without);
    document.extra = { entry: { mechanics: { usesChosen: true } } };
    assert.equal(issue(250, document), gate);
    assert.notEqual(issue(251, document), gate);
    assert.notEqual(issue(250, without), gate);
    assert.equal(issue(250, without, new Map([["oath.json", { entries: [layOnHands] }]])), gate);
  }

  console.log(
    "Ruleset Lay on Hands: the paladin chooses how many points to spend, one hit point each, or just enough to fill the target; more than is left is refused; gated at 1.251.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
