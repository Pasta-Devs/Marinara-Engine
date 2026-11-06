/**
 * An item's rolled call that lasts (Capability API 1.591): an Efreeti Bottle.
 *
 *   - `keepsRoll`: the first opening's roll is kept, and the same efreeti comes at the next ones.
 *   - `lifetimeUses: 3`: the fourth opening is the `pastLifetime` option, never rolled.
 *   - `spendsItem`: once the hostile efreeti, the wishes or the escape comes, the bottle is spent for
 *     good and never offered again.
 *   - An option's `rounds`: the hostile efreeti leaves after 5.
 *   - What it kept goes back to the stack after the fight and is read again.
 *   - Refusals and the install gate.
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
  normalizeGameInventoryStacks,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetFightItemChanges,
  rulesetItemBook,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntriesById,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetItemCallRoll,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-lasting-roll-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 591);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const efreeti = {
    id: "efreeti",
    label: "Efreeti",
    creature: {
      health: 200,
      defense: 17,
      initiativeModifier: 1,
      speed: 40,
      tier: "cr_1",
      actions: [{ id: "scimitar", name: "Scimitar", budget: "action", toHit: 10, damage: { flat: 13 }, reach: 5 }],
    },
  };
  const bottle = () => ({
    category: "bottle",
    stack: 1,
    use: {
      kind: "utility",
      targets: "self",
      budget: "action",
      calls: {
        rolled: true,
        keepsRoll: true,
        lifetimeUses: 3,
        rounds: 600,
        options: [
          {
            creature: "creatures/efreeti",
            count: { flat: 1 },
            weight: 1,
            hostile: true,
            rounds: 5,
            spendsItem: true,
            label: "It attacks you",
          },
          { creature: "creatures/efreeti", count: { flat: 1 }, weight: 8, label: "It serves you" },
          { none: true, weight: 1, label: "It grants three wishes", spendsItem: true },
          { none: true, label: "It escapes", pastLifetime: true, spendsItem: true },
        ],
      },
    },
  });
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = { categories: [{ id: "bottle", label: "Bottle" }] };
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push(structuredClone(efreeti));
    doc.catalogs.push({
      id: "gear",
      label: "Gear",
      holds: "items",
      entries: [{ id: "bottle", label: "Efreeti Bottle", item: bottle() }],
    });
    edit(doc);
    return doc;
  };
  const calls = (doc: Record<string, any>) => doc.catalogs.at(-1).entries[0].item.use.calls;
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
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const definition = parsed(document());
  const book = rulesetItemBook(definition, { gear: definition.catalogs!.find((one) => one.id === "gear")!.entries! });
  const bestiary: RulesetCatalogEntriesById = {
    creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!,
  };
  const held = (callRoll?: RulesetItemCallRoll) =>
    ({
      item: book.itemOf("gear/bottle")!.entry.item!,
      quantity: 1,
      name: "Efreeti Bottle",
      stack: { id: "s1", ref: "gear/bottle" },
      ...(callRoll ? { callRoll } : {}),
    }) as RulesetSheetItem;
  const fight = (callRoll?: RulesetItemCallRoll) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 3,
      bestiary,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 12, int: 10, wis: 16, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
          }),
          live: {},
          items: [held(callRoll)],
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
    state.order = ["hero", "foe"];
    state.turn = 0;
    return state;
  };
  const bottleOf = (state: ReturnType<typeof fight>) =>
    rulesetCombatOptions(definition, state, "hero").find((one) => one.label === "Efreeti Bottle");
  // The bottle's d10 comes up as asked (the three rolled options weigh 10); other dice 3.
  const open = (callRoll: RulesetItemCallRoll | undefined, face: number) => {
    const state = fight(callRoll);
    const option = bottleOf(state);
    assert.ok(option, "the bottle is offered");
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: option!.id, targetIds: [] } as RulesetCombatChoice,
      (sides) => (sides === 10 ? face : 3),
    );
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    const kept = rulesetCombatant(step.state, "hero")!.callRolls?.["0"];
    const efreet = step.state.combatants.filter((one) => one.calledBy === "hero");
    return { state, step, kept, efreet };
  };

  // ── First opening: it serves, and the roll is kept ──
  const first = open(undefined, 5);
  assert.deepEqual(
    of(first.step.events, "rolledTable").map((one) => one.result),
    ["It serves you"],
  );
  assert.deepEqual(first.kept, { kept: 2, ever: 1 });
  assert.equal(first.efreet.length, 1);

  // ── It goes back to the stack and is read again ──
  const changes = rulesetFightItemChanges(first.state, first.step.state);
  assert.deepEqual(changes[0]?.callRoll, { kept: 2, ever: 1 });
  const written = applyRulesetFightItemChanges(
    [{ id: "s1", name: "Efreeti Bottle", item: "gear/bottle", quantity: 1 }],
    changes,
  )!;
  const stack = normalizeGameInventoryStacks(JSON.parse(JSON.stringify(written.stacks)))[0]!;
  assert.deepEqual(stack.callRoll, { kept: 2, ever: 1 });

  // ── The next openings: the same, never rolled, whatever the die says ──
  const second = open(stack.callRoll, 1);
  assert.deepEqual(of(second.step.events, "rolledTable"), [], "kept, not rolled");
  assert.equal(second.efreet.length, 1);
  assert.equal(second.efreet[0]!.side, "party", "it serves again");
  assert.deepEqual(second.kept, { kept: 2, ever: 2 });
  const third = open(second.kept, 1);
  assert.deepEqual(third.kept, { kept: 2, ever: 3 });

  // ── The fourth: it escapes, and the bottle is spent for good ──
  const fourth = open(third.kept, 5);
  assert.equal(fourth.efreet.length, 0, "nobody called");
  assert.deepEqual(fourth.kept, { kept: 2, ever: 4, spent: true });
  assert.equal(bottleOf(fourth.step.state), undefined, "never offered again");
  assert.equal(bottleOf(fight(fourth.kept)), undefined, "nor in another fight");

  // ── It attacks: for 5 rounds, and the bottle loses its magic ──
  {
    const attacks = open(undefined, 1);
    const turned = attacks.efreet[0]!;
    assert.equal(turned.side, "enemy");
    assert.equal(turned.calledUntil, attacks.step.state.round + 5, "5 rounds, not the call's 600");
    assert.equal(attacks.kept?.spent, true);
    assert.equal(bottleOf(attacks.step.state), undefined);
  }
  // ── Wishes: nobody called, and spent ──
  {
    const wishes = open(undefined, 10);
    assert.equal(wishes.efreet.length, 0);
    assert.deepEqual(wishes.kept, { kept: 3, ever: 1, spent: true });
  }

  // ── Refusals ──
  refused(
    document((doc) => delete calls(doc).lifetimeUses),
    /"pastLifetime" comes past the call's "lifetimeUses"/,
  );
  refused(
    document((doc) => (calls(doc).options[3].pastLifetime = undefined)),
    /A call with "lifetimeUses" has one option that comes past them/,
  );
  refused(
    document((doc) => {
      const call = calls(doc);
      call.options = call.options
        .slice(0, 2)
        .map((one: Record<string, unknown>) => ({ ...one, weight: undefined, hostile: undefined }));
      delete call.rolled;
      delete call.lifetimeUses;
    }),
    /"keepsRoll" and "lifetimeUses" are for a "rolled" call|"rounds", "spendsItem" and "pastLifetime" are for an option/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a rolled call that keeps its roll, counts its uses or spends its item (keepsRoll, lifetimeUses, spendsItem, an option's rounds) requires schemaVersion 2 and capabilityApi 1.591 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(590) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(591) as never, document()), gate);
  }

  console.log(
    "Lasting roll: an Efreeti Bottle keeps its first roll, escapes at the fourth opening, attacks for 5 rounds, and is spent for good; kept on its stack; refusals; gated at 1.591.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
