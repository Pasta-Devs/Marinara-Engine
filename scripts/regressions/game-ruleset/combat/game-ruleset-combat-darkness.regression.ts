/**
 * The dark keeping eyes from seeing (Capability API 1.294).
 *
 *   - `combat.sight.darkness`: in darkness nobody is seen, in dim light nobody clearly, but by a
 *     sense of `seeIn` (darkvision, one step brighter) or a blind or `pierced` sense (whatever the
 *     light), within its range.
 *   - Light: `carried` by everybody fighting from a sheet who does not see in the dark (a torch),
 *     `light` on a condition (the Light cantrip), an item's effect, or a creature's block; walls
 *     keep it out.
 *   - What reads the light: hiding, attacks at the unseen, standing obscured, creature modes.
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
  rulesetAttackMode,
  rulesetCanSee,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  rulesetLightAt,
  rulesetLightOf,
  rulesetLightlyObscured,
  rulesetSheetBuildSchema,
  rulesetStandsObscured,
  supportedCapabilityApi,
  type RulesetBoardLight,
  type RulesetCombatChoice,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-darkness-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 289);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const darkness = { seeIn: ["darkvision"], pierced: ["truesight"], carried: { bright: 20, dim: 20 } };
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.senses = [
      { id: "darkvision", label: "Darkvision" },
      { id: "blindsight", label: "Blindsight", blind: true },
      { id: "truesight", label: "Truesight" },
    ];
    doc.combat.sight = { unseenAttacks: true, eyes: "sight", darkness: structuredClone(darkness) };
    for (const entry of doc.combat.conditions) if (entry.condition === "blinded") entry.lacks = ["sight"];
    doc.combat.checks.push(
      { id: "sneak", label: "Stealth", value: { skillMod: "stealth" } },
      { id: "look", label: "Perception", value: { skillMod: "perception" } },
    );
    doc.combat.hiding = { stealth: "sneak", perception: "look" };
    doc.sheet.live.conditions.push({ id: "darksighted", label: "Darksighted" }, { id: "lit", label: "Lit" });
    doc.combat.conditions.push(
      { condition: "darksighted", senses: { darkvision: 60 } },
      { condition: "lit", light: { bright: 20, dim: 20 } },
    );
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

  // Dexterity 14: Stealth +2, Perception +0.
  const hero = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
    fields: { level: 1, ac: 12, speed: 30, hp_max: 30 },
    lists: { attacks: [{ name: "Dagger", ability: "dex", proficient: true, bonus: 0, damage: "1d4", reach: 5 }] },
  });
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock =>
    ({
      health: 20,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      checks: { look: 0, sneak: 2 },
      actions: [{ name: "Claw", budget: "action", toHit: 4, reach: 5, damage: { count: 1, sides: 4, flat: 0 } }],
      ...extra,
    }) as RulesetStatBlock;
  const beasts: Record<string, RulesetStatBlock> = {
    goblin: block({ senses: { darkvision: 60 } }),
    orc: block(),
    torchbearer: block({ light: { bright: 20, dim: 20 } }),
    bat: block({ senses: { blindsight: 30 } }),
    devil: block({ senses: { truesight: 120 } }),
    owl: block({ attackModes: [{ mode: "disadvantage", sight: true, light: ["bright"] }] }),
    shadow: block({
      actions: [
        { name: "Claw", budget: "action", toHit: 4, reach: 5, damage: { count: 1, sides: 4, flat: 0 } },
        { name: "Shadow Stealth", budget: "bonus", standard: { actions: ["hide"], while: "obscured" } },
      ] as never,
    }),
  };
  type Who = { id: string; at: [number, number] };
  // A wall at x = 10, y = 0..4, unless there are no walls.
  const fight = (who: Who[], light?: RulesetBoardLight, walls = false): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: who.map((one) =>
        beasts[one.id]
          ? { id: one.id, name: one.id, side: "enemy" as const, block: structuredClone(beasts[one.id]!) }
          : { id: one.id, name: one.id, side: "party" as const, build: hero, live: {} },
      ),
      board: {
        grid: {
          width: 24,
          height: 10,
          tiles: Array.from({ length: 10 }, (_, y) =>
            Array.from({ length: 24 }, (_, x) => (walls && x === 10 && y <= 4 ? "wall" : "plains")),
          ),
        } as never,
        placements: Object.fromEntries(who.map((one) => [one.id, { x: one.at[0], y: one.at[1] }])),
        ...(light ? { light } : {}),
      },
    });
    state.order = who.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const give = (state: RulesetEncounterState, id: string, condition: string) => {
    who(state, id).tracked.push({ condition, rounds: null } as never);
    return state;
  };
  const sees = (state: RulesetEncounterState, a: string, b: string) =>
    rulesetCanSee(definition, state, who(state, a), who(state, b));
  const dimly = (state: RulesetEncounterState, a: string, b: string) =>
    rulesetLightlyObscured(definition, state, who(state, a), who(state, b));

  // ── Who sheds light ──
  {
    // At night: nobody lights a torch in daylight (1.319 fix).
    const state = give(
      fight(
        [
          { id: "hero", at: [2, 5] },
          { id: "dwarf", at: [4, 5] },
          { id: "orc", at: [9, 5] },
        ],
        "dark",
      ),
      "dwarf",
      "darksighted",
    );
    assert.deepEqual(rulesetLightOf(definition, who(state, "hero"), state), { bright: 4, dim: 4 }, "a torch");
    assert.equal(rulesetLightOf(definition, who(state, "dwarf"), state), null, "sees in the dark: no torch");
    assert.equal(rulesetLightOf(definition, who(state, "orc"), state), null, "a creature carries none");
    give(state, "dwarf", "lit");
    assert.deepEqual(
      rulesetLightOf(definition, who(state, "dwarf"), state),
      { bright: 4, dim: 4, magic: { bright: 4, dim: 4 } },
      "the Light cantrip",
    );
    // A lantern, worn: an item's light, the farther-reaching of the two.
    who(state, "hero").sheet!.items = [
      {
        name: "Lantern",
        quantity: 1,
        worn: true,
        item: { category: "gear", worn: { light: { bright: 30, dim: 30 } } },
      },
    ] as never;
    assert.deepEqual(rulesetLightOf(definition, who(state, "hero"), state), { bright: 6, dim: 6 }, "a lantern");
    const bearer = fight([{ id: "torchbearer", at: [2, 5] }]);
    assert.deepEqual(rulesetLightOf(definition, who(bearer, "torchbearer"), bearer), { bright: 4, dim: 4 });
    // Nobody sheds light where the dark is not real.
    const plain = parsed(
      fiveE((doc) => {
        delete doc.combat.sight.darkness;
        doc.combat.conditions = doc.combat.conditions.filter((one: { condition: string }) => one.condition !== "lit");
      }),
    );
    assert.equal(rulesetLightOf(plain, who(state, "hero"), state), null);
  }

  // ── The light on a cell ──
  {
    const state = fight([{ id: "hero", at: [6, 5] }], "dark", true);
    const at = (x: number, y: number) => rulesetLightAt(definition, state, { x, y });
    assert.equal(at(6, 5), "bright");
    assert.equal(at(10, 5), "bright", "four cells off");
    assert.equal(at(11, 5), "dim", "five cells off");
    assert.equal(at(14, 5), "dim", "eight cells off");
    assert.equal(at(15, 5), "dark", "nine cells off");
    assert.equal(at(12, 2), "dark", "behind the wall");
    assert.equal(rulesetLightAt(definition, fight([{ id: "hero", at: [6, 5] }], "dim"), { x: 20, y: 5 }), "dim");
    assert.equal(rulesetLightAt(definition, fight([{ id: "hero", at: [6, 5] }]), { x: 20, y: 5 }), "bright");
    // A torchbearer struck down sheds no more.
    const fallen = fight([{ id: "torchbearer", at: [6, 5] }], "dark");
    who(fallen, "torchbearer").defeated = true;
    assert.equal(rulesetLightAt(definition, fallen, { x: 6, y: 5 }), "dark");
  }

  // ── Seeing in the dark ──
  {
    const night = (orcAt: [number, number], light: RulesetBoardLight = "dark") =>
      fight(
        [
          { id: "hero", at: [2, 5] },
          { id: "orc", at: orcAt },
        ],
        light,
      );
    // In the torch's bright light, clearly; in its dim light, not clearly; past it, not at all.
    assert.equal(sees(night([5, 5]), "hero", "orc"), true);
    assert.equal(dimly(night([5, 5]), "hero", "orc"), false);
    assert.equal(sees(night([9, 5]), "hero", "orc"), true);
    assert.equal(dimly(night([9, 5]), "hero", "orc"), true, "in dim light");
    assert.equal(sees(night([12, 5]), "hero", "orc"), false, "in the dark");
    // The hero, holding the torch, is seen from out there.
    assert.equal(sees(night([12, 5]), "orc", "hero"), true);
    assert.equal(dimly(night([12, 5]), "orc", "hero"), false);
    // A board in dim light: past the torch, seen but not clearly.
    assert.equal(sees(night([12, 5], "dim"), "hero", "orc"), true);
    assert.equal(dimly(night([12, 5], "dim"), "hero", "orc"), true);
    // In bright light nothing is in the dark.
    assert.equal(dimly(night([20, 5], "bright"), "hero", "orc"), false);

    // Darkvision: darkness as dim light, dim light as bright, within 12 cells.
    const dark = (gobAt: [number, number], light: RulesetBoardLight = "dark") =>
      give(
        fight(
          [
            { id: "dwarf", at: [2, 5] },
            { id: "goblin", at: gobAt },
          ],
          light,
        ),
        "dwarf",
        "darksighted",
      );
    assert.equal(sees(dark([12, 5]), "dwarf", "goblin"), true);
    assert.equal(dimly(dark([12, 5]), "dwarf", "goblin"), true, "darkness as dim light");
    assert.equal(sees(dark([16, 5]), "dwarf", "goblin"), false, "past its darkvision");
    assert.equal(dimly(dark([12, 5], "dim"), "dwarf", "goblin"), false, "dim light as bright");
    assert.equal(dimly(dark([16, 5], "dim"), "dwarf", "goblin"), true, "dim past its darkvision");
    // Both see in the dark, and neither carries a light.
    assert.equal(sees(dark([12, 5]), "goblin", "dwarf"), true);
    assert.equal(sees(dark([16, 5]), "goblin", "dwarf"), false);

    // Blindsight and truesight see whatever the light, within their range.
    const blind = (id: string, at: [number, number]) =>
      give(
        fight(
          [
            { id: "dwarf", at: [2, 5] },
            { id, at },
          ],
          "dark",
        ),
        "dwarf",
        "darksighted",
      );
    assert.equal(sees(blind("bat", [8, 5]), "bat", "dwarf"), true);
    assert.equal(dimly(blind("bat", [8, 5]), "bat", "dwarf"), false);
    assert.equal(sees(blind("bat", [9, 5]), "bat", "dwarf"), false, "past its blindsight");
    assert.equal(sees(blind("devil", [20, 5]), "devil", "dwarf"), true, "truesight");
    assert.equal(sees(blind("orc", [8, 5]), "orc", "dwarf"), false, "eyes only");
    // Lit by the Light cantrip, the dwarf is seen.
    assert.equal(sees(give(blind("orc", [20, 5]), "dwarf", "lit"), "orc", "dwarf"), true);
    // A creature's own torch lights its way.
    const bearer = fight(
      [
        { id: "hero", at: [2, 5] },
        { id: "torchbearer", at: [16, 5] },
      ],
      "dark",
    );
    assert.equal(sees(bearer, "hero", "torchbearer"), true);
    assert.equal(dimly(bearer, "hero", "torchbearer"), false);
  }

  // ── What reads it ──
  {
    // Attacking into the dark: disadvantage, and advantage on the one who cannot see.
    const night = fight(
      [
        { id: "hero", at: [2, 5] },
        { id: "goblin", at: [12, 5] },
      ],
      "dark",
    );
    const mode = (state: RulesetEncounterState, from: string, to: string) =>
      rulesetAttackMode(definition, definition.combat!, who(state, from), who(state, to), {
        state,
        optionId: who(state, from).actions[0]!.id,
      });
    assert.equal(mode(night, "hero", "goblin"), "disadvantage", "at somebody in the dark");
    assert.equal(mode(night, "goblin", "hero"), "advantage", "at somebody who cannot see you");
    // Obscured where they stand: in the dark, not in the torchlight.
    assert.equal(rulesetStandsObscured(night, who(night, "goblin"), definition), true);
    assert.equal(rulesetStandsObscured(night, who(night, "hero"), definition), false);
    // Without the definition, the board's own light as before (1.291).
    assert.equal(rulesetStandsObscured(night, who(night, "hero")), true);
    // A creature's mode in bright light reads the light where it stands.
    const owl = (at: [number, number]) =>
      fight(
        [
          { id: "hero", at: [2, 5] },
          { id: "owl", at },
        ],
        "dark",
      );
    assert.equal(mode(owl([3, 5]), "owl", "hero"), "disadvantage", "in the torchlight");
    // Out in the dark it sees the lit hero and attacks as ever.
    assert.equal(mode(owl([12, 5]), "owl", "hero"), "advantage", "unseen in the dark");

    // Shadow Stealth: only out in the dark, not in the torchlight.
    const shade = (at: [number, number]) => {
      const state = fight(
        [
          { id: "hero", at: [2, 5] },
          { id: "shadow", at },
        ],
        "dark",
      );
      state.turn = 1;
      return rulesetCombatOptions(definition, state, "shadow").map((option) => option.id);
    };
    assert.ok(shade([14, 5]).includes("standard:hide@bonus"), shade([14, 5]).join());
    assert.ok(!shade([4, 5]).includes("standard:hide@bonus"), "in the torchlight");
    // Hiding: from out in the dark, from the hero; in the torchlight, from nobody.
    const hide = (at: [number, number]) => {
      const state = fight(
        [
          { id: "hero", at: [2, 5] },
          { id: "goblin", at },
        ],
        "dark",
      );
      state.turn = 1;
      const choice: RulesetCombatChoice = { actorId: "goblin", optionId: "standard:hide", targetIds: [] };
      const step = applyRulesetCombatChoice(definition, state, choice, () => 10);
      assert.equal(
        step.events.find((one) => one.type === "refused"),
        undefined,
        JSON.stringify(step.events),
      );
      return who(step.state, "goblin").hiding?.from ?? [];
    };
    assert.deepEqual(hide([12, 5]), ["hero"]);
    assert.deepEqual(hide([4, 5]), []);
  }

  // ── Refusals ──
  {
    refusedDoc(
      fiveE((doc) => {
        doc.combat.sight.darkness.seeIn = ["nightsight"];
      }),
      /Unknown sense "nightsight"/,
    );
    refusedDoc(
      fiveE((doc) => {
        doc.combat.sight.darkness.pierced = ["xray"];
      }),
      /Unknown sense "xray"/,
    );
    refusedDoc(
      fiveE((doc) => {
        doc.combat.sight.darkness.carried = { bright: 0, dim: 0 };
      }),
      /A light reaches somewhere/,
    );
    refusedDoc(
      fiveE((doc) => {
        delete doc.combat.sight.darkness;
      }),
      /Light is read where combat.sight.darkness makes the dark real/,
    );
    const withBeast = (creature: Record<string, unknown>, edit: (doc: Record<string, any>) => void = () => {}) =>
      fiveE((doc) => {
        doc.catalogs
          .find((catalog: { id: string }) => catalog.id === "creatures")
          .entries.push({
            id: "glow",
            label: "Glow",
            creature: {
              health: 10,
              defense: 10,
              initiativeModifier: 0,
              tier: "cr_1_2",
              actions: [{ id: "touch", name: "Touch", budget: "action", toHit: 2, damage: { dice: "1d4" }, reach: 5 }],
              ...creature,
            },
          });
        edit(doc);
      });
    const glowing = parsed(withBeast({ light: { bright: 10, dim: 10 } }));
    const glow = glowing
      .catalogs!.find((catalog) => catalog.id === "creatures")!
      .entries!.find((one) => one.id === "glow");
    assert.deepEqual(rulesetCreatureBlock(glowing, glow)?.light, { bright: 10, dim: 10 }, "read off the bestiary");
    refusedDoc(
      withBeast({ light: { bright: 10, dim: 10 } }, (doc) => {
        delete doc.combat.sight.darkness;
        doc.combat.conditions = doc.combat.conditions.filter((one: { condition: string }) => one.condition !== "lit");
      }),
      /Light is read where combat.sight.darkness makes the dark real/,
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
      "A ruleset whose fights are kept dark, or with things that shed light, requires schemaVersion 2 and capabilityApi 1.294 or newer";
    const dark = JSON.parse(fiveEText) as Record<string, any>;
    dark.combat.sight = { darkness: { seeIn: ["darkvision"] } };
    assert.equal(getCapabilityPackageInstallIssue(manifest(293) as never, dark), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(294) as never, dark), gate);
    const torch = JSON.parse(fiveEText) as Record<string, any>;
    torch.combat.conditions.push({ condition: "prone", light: { bright: 20, dim: 20 } });
    assert.equal(getCapabilityPackageInstallIssue(manifest(293) as never, torch), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(293) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Darkness: nobody seen in the dark and nobody clearly in dim light but by darkvision, blindsight or truesight within range; torches carried, the Light cantrip, a creature's own light, walls keeping it out; attacks, hiding, standing obscured and creature modes read it; refusals; gated at 1.294.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
