/**
 * A missile caught and kept (Capability API 1.626): 5e's Gloves of Missile Snaring, "If you reduce the
 * damage to 0, you can catch the missile if it is small enough for you to hold in that hand."
 *
 *   - A creature's arrow cut to nothing opens the "caught" moment; the gloves' catch keeps the
 *     `otherwise` item, a new stack in the catcher's bag after the fight, or one more on theirs.
 *   - An archer's own arrow is the arrow kept, and no longer won back by them.
 *   - Refusals; the install gate.
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
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  type GameInventoryStack,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-keeps-caught-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 626);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (keeps: unknown = { otherwise: "kit/arrow" }, on = "caught") => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = {
      categories: [{ id: "gear", label: "Gear" }],
      tags: [{ id: "arrow", label: "Arrow" }],
      slots: [{ id: "hand", label: "Hand", count: 2 }],
    };
    doc.sheet.live.conditions.push({ id: "deflecting", label: "Deflecting" });
    doc.combat.conditions.push({
      condition: "deflecting",
      effects: [],
      modifiers: [{ to: "damage-taken", blow: "ranged", dice: "4d10", minus: true }],
    });
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "gloves",
          label: "Gloves of Missile Snaring",
          item: {
            category: "gear",
            use: {
              kind: "utility",
              label: "Snare",
              targets: "self",
              free: true,
              reaction: { on, freeSlot: "hand" },
              keepsCaught: keeps,
            },
          },
        },
        { id: "arrow", label: "Arrow", item: { category: "gear", tags: ["arrow"] } },
        {
          id: "longbow",
          label: "Longbow",
          item: {
            category: "gear",
            slots: { hand: 2 },
            attack: {
              budget: "action",
              toHit: { bonus: 20 },
              damage: { dice: "1d8", bonus: 2, type: "piercing" },
              range: { normal: 80 },
              ammo: { tag: "arrow", recover: 0.5 },
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
  const kit = (id: string) =>
    definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries!.find((entry) => entry.id === id)!.item!;
  const sheet = () =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
      fields: { level: 5, ac: 14, speed: 30, hp_max: 30 },
    });
  const gloves = (): RulesetSheetItem => ({
    item: kit("gloves"),
    quantity: 1,
    worn: false,
    name: "Gloves of Missile Snaring",
    stack: { id: "s-gloves", ref: "kit/gloves" },
  });
  const arrows = (id: string, quantity: number): RulesetSheetItem => ({
    item: kit("arrow"),
    quantity,
    worn: false,
    name: "Arrow",
    stack: { id, ref: "kit/arrow" },
  });
  const faces = (sides: number) => (sides === 20 ? 15 : 4);
  const fight = (options: { archerSheet?: boolean; monkItems?: RulesetSheetItem[] } = {}): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 7,
      roller: faces,
      combatants: [
        options.archerSheet
          ? {
              id: "archer",
              name: "Archer",
              // A sheet's own fighter, turned on the monk (charmed, say).
              side: "party",
              build: sheet(),
              items: [{ item: kit("longbow"), quantity: 1, worn: true, name: "Longbow" }, arrows("s-quiver", 10)],
            }
          : {
              id: "archer",
              name: "Archer",
              side: "enemy",
              block: {
                health: 40,
                defense: 12,
                initiativeModifier: 0,
                speed: 30,
                actions: [
                  {
                    id: "arrow",
                    name: "Arrow",
                    budget: "action",
                    toHit: 20,
                    damage: { count: 1, sides: 8, flat: 2, type: "piercing" },
                    range: { normal: 80 },
                  },
                ],
              } as unknown as RulesetStatBlock,
            },
        {
          id: "monk",
          name: "Monk",
          side: "party",
          build: sheet(),
          items: options.monkItems ?? [gloves()],
        },
      ],
    });
    state.order = ["archer", "monk"];
    state.turn = 0;
    if (options.archerSheet) rulesetCombatant(state, "monk")!.side = "enemy";
    rulesetCombatant(state, "monk")!.tracked.push({ condition: "deflecting", rounds: null } as never);
    return state;
  };
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const shootAndSnare = (state: RulesetEncounterState) => {
    const option = rulesetCombatOptions(definition, state, "archer").find((one) => /Arrow|Longbow/.test(one.label));
    assert.ok(
      option,
      rulesetCombatOptions(definition, state, "archer")
        .map((one) => one.label)
        .join(", "),
    );
    const shot = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "archer", optionId: option.id, targetIds: ["monk"] },
      faces,
    );
    assert.deepEqual(
      of(shot.events, "damage").map((one) => one.dealt),
      [0],
      JSON.stringify(shot.events),
    );
    const window = shot.state.window;
    assert.equal(window?.trigger.kind, "caught", JSON.stringify(shot.events));
    const snare = rulesetWindowOptions(definition, shot.state, "monk").find((one) => /Snare/.test(one.label));
    assert.ok(snare, "the catch is offered");
    const step = applyRulesetCombatChoice(
      definition,
      shot.state,
      { actorId: "monk", optionId: snare.id, targetIds: ["monk"], window: window!.id },
      faces,
    );
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(step.events));
    return { shot, step };
  };

  // ── A creature's arrow: the `otherwise` item, a new stack in the catcher's bag ──
  {
    const start = fight();
    const { step } = shootAndSnare(start);
    assert.deepEqual(of(step.events, "missileKept"), [{ type: "missileKept", actorId: "monk", label: "Arrow" }]);
    const monk = rulesetCombatant(step.state, "monk")!;
    assert.equal(monk.sheet!.items!.length, 2);
    assert.equal(monk.sheet!.items![1]!.stack?.ref, "kit/arrow");
    const stacks: GameInventoryStack[] = [
      { id: "s-gloves", name: "Gloves of Missile Snaring", item: "kit/gloves", quantity: 1 },
    ];
    const written = applyRulesetFightItemChanges(stacks, rulesetFightItemChanges(start, step.state));
    assert.ok(written);
    assert.deepEqual(
      written.stacks.map((stack) => [stack.item, stack.quantity]),
      [
        ["kit/gloves", 1],
        ["kit/arrow", 1],
      ],
    );
  }
  // ── One more on the catcher's own stack of them ──
  {
    const start = fight({ monkItems: [gloves(), arrows("s-mine", 3)] });
    const { step } = shootAndSnare(start);
    const changes = rulesetFightItemChanges(start, step.state);
    assert.deepEqual(
      changes.map((change) => [change.stack.id, change.taken]),
      [["s-mine", -1]],
    );
  }
  // ── An archer's own arrow: kept, and no longer won back by them ──
  {
    const start = fight({ archerSheet: true });
    const { shot, step } = shootAndSnare(start);
    const archerBefore = rulesetCombatant(shot.state, "archer")!;
    assert.equal(archerBefore.recoverable?.[1], 0.5, "half an arrow to win back once shot");
    assert.equal(rulesetCombatant(step.state, "archer")!.recoverable?.[1], 0, "caught, not won back");
    assert.equal(of(step.events, "missileKept")[0]?.label, "Arrow");
  }

  // ── Refusals ──
  refused(document({ otherwise: "kit/bolt" }), /Unknown item "kit\/bolt"/);
  refused(document(true, "hit"), /"keepsCaught" is taken at a "caught" moment/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a missile caught and kept (keepsCaught) requires schemaVersion 2 and capabilityApi 1.626 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(625) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(626) as never, document()), gate);
  }

  console.log(
    "keepsCaught: a creature's arrow caught is kept as the otherwise item, onto the catcher's stack or a new one; an archer's own arrow kept and not won back; refusals; gated at 1.626.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
