/**
 * A call that ends with its caller, on an entry or an item (Capability API 1.733): a Feather Token's
 * whip.
 *
 *   - An item's `calls.endsWithCaller`: those it called leave as soon as their caller is out.
 *   - `"incapacitated"`: also as soon as their caller is down or holds anything that `cannot-act`.
 *   - Import and the install gate.
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
  rulesetItemUseSchema,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogItem,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-call-ends-with-caller-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 733);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const whip = {
    id: "feather-whip",
    label: "Feather Whip",
    filters: { challenge: "CR 1", kind: "Construct", places: ["Anywhere"] },
    creature: {
      health: 10,
      defense: 16,
      initiativeModifier: 0,
      speed: 0,
      tier: "cr_1",
      actions: [{ id: "lash", name: "Lash", budget: "action", toHit: 9, damage: { dice: "1d6", flat: 5 }, reach: 10 }],
    },
  };
  const tokenUse = (endsWithCaller: unknown = "incapacitated") => ({
    kind: "utility",
    targets: "self",
    budget: "bonus",
    consumes: true,
    calls: { creature: "creatures/feather-whip", count: { flat: 1 }, initiative: "after", rounds: 600, endsWithCaller },
  });
  const document = (use: Record<string, unknown> = tokenUse()) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push(structuredClone(whip));
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hands", label: "Hands", count: 2 }] };
    doc.catalogs.push({
      id: "magic_items",
      label: "Magic items",
      holds: "items",
      entries: [{ id: "feather-token-whip", label: "Feather Token (Whip)", item: { category: "gear", use } }],
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
  assert.ok(rulesetItemUseSchema.safeParse(tokenUse()).success);
  assert.ok(rulesetItemUseSchema.safeParse(tokenUse(true)).success);
  assert.equal(rulesetItemUseSchema.safeParse(tokenUse("asleep")).success, false);

  const brute: RulesetStatBlock = {
    health: 50,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [
      {
        id: "stun",
        name: "Stunning Blow",
        budget: "action",
        autoHit: true,
        damage: { count: 0, sides: 0, flat: 1 },
        applies: [{ condition: "incapacitated", duration: { rounds: 1 } }],
      },
      { id: "flat", name: "Flatten", budget: "action", autoHit: true, damage: { count: 0, sides: 0, flat: 100 } },
    ],
  } as unknown as RulesetStatBlock;
  /** The druid reads the token and the whip appears; then the brute strikes her with `blow`. */
  const run = (endsWithCaller: unknown, blow: string) => {
    const use = tokenUse(endsWithCaller);
    const definition = parsed(document(use));
    const state: RulesetEncounterState = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary: { creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries! },
      combatants: [
        {
          id: "druid",
          name: "Druid",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 12, con: 10, int: 10, wis: 18, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
          }),
          live: {},
          items: [
            {
              name: "Feather Token (Whip)",
              quantity: 1,
              worn: false,
              item: { category: "gear", use } as unknown as RulesetCatalogItem,
            },
          ],
        },
        { id: "brute", name: "Brute", side: "enemy", block: brute },
      ],
    });
    state.order = ["druid", "brute"];
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "druid").find((one) => one.label.includes("Feather Token"));
    assert.ok(option, "the token may be read");
    const read = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "druid", optionId: option.id, targetIds: [] },
      () => 10,
    );
    const [called] = of(read.events, "called");
    assert.equal(called?.ids.length, 1, JSON.stringify(read.events));
    const next = read.state;
    next.turn = next.order.indexOf("brute");
    const struck = applyRulesetCombatChoice(
      definition,
      next,
      { actorId: "brute", optionId: blow, targetIds: ["druid"] },
      () => 10,
    );
    return {
      gone: of(struck.events, "sentAway").some((one) => one.reason === "caller" && one.ids.includes(called!.ids[0]!)),
      dismissed: !!rulesetCombatant(struck.state, called!.ids[0]!)?.dismissed,
    };
  };

  // ── Incapacitated: the whip vanishes ──
  assert.deepEqual(run("incapacitated", "stun"), { gone: true, dismissed: true });
  // ── Down: it vanishes too ──
  assert.deepEqual(run("incapacitated", "flat").gone, true);
  // ── Bound only to its caller being out, it stays while she is merely stunned ──
  assert.deepEqual(run(true, "stun"), { gone: false, dismissed: false });

  // ── The install gate ──
  const gate =
    "A ruleset with a catalog entry's or an item's call that ends with its caller (calls.endsWithCaller) requires schemaVersion 2 and capabilityApi 1.733 or newer";
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
  assert.equal(getCapabilityPackageInstallIssue(manifest(732) as never, document()), gate);
  assert.equal(getCapabilityPackageInstallIssue(manifest(732) as never, document(tokenUse(true))), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(733) as never, document()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(732) as never, JSON.parse(fiveEText)), gate);

  console.log(
    "Feather Token whip: an item's call ends with its caller, out or (with incapacitated) down or unable to act; gated at 1.733.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
