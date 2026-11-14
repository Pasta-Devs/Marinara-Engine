/**
 * Seeing (Capability API 1.178).
 *
 *   - `zone.obscures`: nobody sees into, out of or through it but by a sense it names, in range
 *     (Fog Cloud, Darkness); a `utility` entry that only leaves such an area is on the menu.
 *   - `combat.senses`: a character's range off its sheet, a creature's off its block; `blind` ones
 *     work without eyes (`combat.sight.eyes`).
 *   - A condition's `unseen` hides its holder (invisible) but from the senses it names.
 *   - `combat.sight.unseenAttacks`: advantage at whoever cannot see you, disadvantage at whoever you
 *     cannot see.
 *   - `mechanics.seen`: only targets its maker can see.
 *   - `area.copies`: Fire Storm's cubes, each touching another; the choice's `also`.
 *   - Import refusals, and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetAimCells,
  rulesetAttackMode,
  rulesetCanSee,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  rulesetZonesShown,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatCell,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-sight-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 173);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  // The 5e example with senses: darkvision off a sheet field, blindsight that works blind, truesight;
  // blinded takes the eyes away and invisible hides its holder but from blindsight and truesight.
  const sighted = (doc: Record<string, any>) => {
    doc.sheet.fields.push({ id: "darkvision", label: "Darkvision", type: "number", min: 0, max: 300, default: 0 });
    doc.combat.senses = [
      { id: "darkvision", label: "Darkvision", sheet: { field: "darkvision" } },
      { id: "blindsight", label: "Blindsight", blind: true },
      { id: "truesight", label: "Truesight" },
    ];
    doc.combat.sight = { unseenAttacks: true, eyes: "sight" };
    for (const entry of doc.combat.conditions) {
      if (entry.condition === "blinded") entry.lacks = ["sight"];
      if (entry.condition === "invisible") entry.unseen = { pierced: ["blindsight", "truesight"] };
    }
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE(sighted));
  const combat = definition.combat!;

  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 1, prepared: true } }],
      mechanics: { kind: "attack", autoHit: true, damageType: "fire", ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  // Fog Cloud: a 20-ft sphere nobody sees into. Darkness: 15 ft, pierced by blindsight and truesight
  // (and, here, by darkvision too, so the sheet's range is what decides).
  const fog = spell("fog", {
    kind: "utility",
    area: { shape: "burst", size: 10 },
    range: 120,
    zone: { rounds: 10, triggers: [], obscures: {} },
  });
  const dark = spell("dark", {
    kind: "utility",
    area: { shape: "burst", size: 5 },
    range: 60,
    zone: { rounds: 10, triggers: [], obscures: { pierced: ["darkvision", "blindsight"] } },
  });
  // A bolt at a creature you can see.
  const bolt = spell("bolt", { range: 120, amount: { flat: 5 }, seen: true });
  // Fire Storm, small: up to three 10-ft cubes, each touching another.
  const storm = spell("storm", { area: { shape: "box", size: 10, copies: 3 }, range: 150, amount: { flat: 7 } });
  // Murk: pierced only by truesight, which needs eyes.
  const murk = spell("murk", {
    kind: "utility",
    area: { shape: "burst", size: 5 },
    range: 60,
    zone: { rounds: 10, triggers: [], obscures: { pierced: ["truesight"] } },
  });
  const spells = [fog, dark, bolt, storm, murk];
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
    health: 100,
    defense: 5,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
    ...extra,
  });
  const grid = (): TacticalGrid => ({
    width: 20,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(20).fill("plains")),
  });
  const fight = (
    options: {
      placements?: Record<string, { x: number; y: number }>;
      darkvision?: number;
      a?: Partial<RulesetStatBlock>;
      board?: boolean;
      mageLive?: Record<string, unknown>;
    } = {},
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary: { spells },
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: {
              level: 5,
              ac: 12,
              speed: 30,
              hp_max: 60,
              spellcasting_ability: "wis",
              slots_max_1: 9,
              darkvision: options.darkvision ?? 0,
            },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: (options.mageLive ?? {}) as never,
          catalogs: { spells },
        },
        { id: "a", name: "A", side: "enemy", block: block(options.a) },
        { id: "b", name: "B", side: "enemy", block: block() },
      ],
      ...(options.board === false
        ? {}
        : {
            board: {
              grid: grid(),
              placements: { mage: { x: 2, y: 7 }, a: { x: 10, y: 7 }, b: { x: 16, y: 7 }, ...options.placements },
            },
          }),
    });
    state.order = ["mage", "a", "b"];
    state.turn = 0;
    return state;
  };
  const roll = () => 10;
  const optionOf = (state: RulesetEncounterState, actorId: string, label: string) => {
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(option, `${actorId} has no ${label}`);
    return option;
  };
  const cast = (state: RulesetEncounterState, label: string, at: RulesetCombatCell, also?: RulesetCombatCell[]) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: optionOf(state, "mage", label).id, targetIds: [], at, ...(also ? { also } : {}) },
      roll,
    );
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const sees = (state: RulesetEncounterState, viewer: string, seen: string) =>
    rulesetCanSee(definition, state, who(state, viewer), who(state, seen));
  const hp = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, combat, who(state, id)).value;
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const keys = (cells: RulesetCombatCell[]) => cells.map((cell) => `${cell.x},${cell.y}`).sort();
  const mode = (state: RulesetEncounterState, actor: string, target: string) => {
    // The fighter's first action, on or off its turn: only its reach is read for this.
    const optionId = who(state, actor).actions[0]!.id;
    return rulesetAttackMode(definition, combat, who(state, actor), who(state, target), { state, optionId });
  };

  // ── Fog: an obscuring area set down by a utility spell ──
  {
    const before = fight();
    assert.equal(sees(before, "mage", "a"), true);
    const step = cast(before, "Fog", { x: 10, y: 7 });
    assert.equal(refused(step), undefined, "a utility spell that leaves an area is on the menu");
    const state = step.state;
    assert.equal(rulesetZonesShown(state).length, 1);
    assert.equal(sees(state, "mage", "a"), false, "nobody sees into it");
    assert.equal(sees(state, "a", "mage"), false, "nor out of it");
    assert.equal(sees(state, "mage", "b"), false, "nor through it");
    assert.equal(sees(state, "b", "a"), false);
    // Off its line, it hides nothing.
    const aside = cast(fight({ placements: { b: { x: 2, y: 13 } } }), "Fog", { x: 10, y: 7 }).state;
    assert.equal(sees(aside, "mage", "b"), true);
    // Not seeing: the mage's foe in the fog strikes at a disadvantage and is struck at an advantage,
    // which cancel; struck at from outside by somebody it cannot see, its blow is the one hampered.
    assert.equal(mode(state, "a", "mage"), "normal", "neither sees the other");
    // The fog may be put where nobody stands.
    const anywhere = rulesetAimCells(fight(), "mage", optionOf(fight(), "mage", "Fog").id);
    assert.ok(
      anywhere.some((aim) => aim.targetIds.length === 0),
      "an empty aim is offered for something that stays",
    );
  }

  // ── Darkness, darkvision and blindsight ──
  {
    // A creature with blindsight 10 ft sees into darkness only within its range.
    const near = fight({ placements: { a: { x: 4, y: 7 } }, a: { senses: { blindsight: 10 } } });
    const dim = cast(near, "Dark", { x: 4, y: 7 }).state;
    assert.equal(sees(dim, "a", "mage"), true, "two cells: within its blindsight");
    assert.equal(sees(dim, "mage", "a"), false, "no darkvision on the mage's sheet");
    // A's unseen attack at a mage who cannot see it: advantage.
    assert.equal(mode(dim, "a", "mage"), "advantage");
    const far = fight({ placements: { a: { x: 5, y: 7 } }, a: { senses: { blindsight: 10 } } });
    const farDim = cast(far, "Dark", { x: 5, y: 7 }).state;
    assert.equal(sees(farDim, "a", "mage"), false, "three cells: out of its range");
    assert.equal(mode(farDim, "a", "mage"), "normal", "neither sees: they cancel");
    // Darkvision read off the sheet, in feet, as cells.
    const seer = cast(fight({ darkvision: 60, placements: { a: { x: 5, y: 7 } } }), "Dark", { x: 5, y: 7 }).state;
    assert.equal(who(seer, "mage").senses?.darkvision, 12);
    assert.equal(sees(seer, "mage", "a"), true, "darkvision pierces this darkness");
    assert.equal(mode(seer, "mage", "a"), "advantage", "A cannot see the mage");
    // Fog is pierced by nothing: darkvision does not help there.
    const fogged = cast(fight({ darkvision: 60 }), "Fog", { x: 10, y: 7 }).state;
    assert.equal(sees(fogged, "mage", "a"), false);
  }

  // ── A creature you can see ──
  {
    const open = fight();
    const bolt = optionOf(open, "mage", "Bolt");
    assert.ok(rulesetOptionTargets(definition, open, "mage", bolt).includes("a"));
    // Round to the mage's next turn: the fog still stands and A is in it.
    let fogged = cast(open, "Fog", { x: 10, y: 7 }).state;
    for (let turn = 0; turn < 3; turn++) fogged = advanceRulesetTurn(definition, fogged, roll).state;
    assert.equal(fogged.order[fogged.turn], "mage");
    const targets = rulesetOptionTargets(definition, fogged, "mage", optionOf(fogged, "mage", "Bolt"));
    assert.ok(!targets.includes("a"), "A in the fog is not a creature the mage can see");
    const pick = applyRulesetCombatChoice(
      definition,
      fogged,
      { actorId: "mage", optionId: optionOf(fogged, "mage", "Bolt").id, targetIds: ["a"] },
      roll,
    );
    assert.ok(refused(pick), "picking it anyway is refused");
  }

  // ── Invisible, and blinded ──
  {
    const invisible = fight({ mageLive: { conditions: ["invisible"] } });
    assert.equal(sees(invisible, "a", "mage"), false, "nobody sees an invisible mage");
    assert.equal(sees(invisible, "mage", "a"), true);
    const trueSeer = fight({ mageLive: { conditions: ["invisible"] }, a: { senses: { truesight: 120 } } });
    assert.equal(sees(trueSeer, "a", "mage"), true, "truesight does");
    const offBoard = fight({ board: false, mageLive: { conditions: ["invisible"] } });
    assert.equal(sees(offBoard, "a", "mage"), false, "off a board too");
    // Blinded: the eyes are gone, so only blindsight sees, and only so far.
    const blind = fight({ mageLive: { conditions: ["blinded"] } });
    assert.equal(sees(blind, "mage", "a"), false);
    assert.ok(
      !rulesetOptionTargets(definition, blind, "mage", optionOf(blind, "mage", "Bolt")).includes("a"),
      "a blinded caster picks no creature it can see",
    );
    assert.equal(sees(blind, "a", "mage"), true, "A still sees the mage");
    const blindsight = fight({
      placements: { a: { x: 4, y: 7 } },
      a: { senses: { blindsight: 10, truesight: 120 }, conditionImmunities: [] },
    });
    who(blindsight, "a").tracked.push({ condition: "blinded", source: "mage" } as never);
    assert.equal(sees(blindsight, "a", "mage"), true, "blindsight works blind, within range");
    // Off a board too, a blind viewer's blindsight finds only what its own sense pierces.
    const offBlind = fight({
      board: false,
      mageLive: { conditions: ["invisible"] },
      a: { senses: { blindsight: 10 }, conditionImmunities: [] },
    });
    who(offBlind, "a").tracked.push({ condition: "blinded", source: "mage" } as never);
    assert.equal(sees(offBlind, "a", "mage"), true, "off a board, blindsight finds the invisible");
    const truesightOnly: RulesetDefinition = {
      ...definition,
      combat: {
        ...combat,
        conditions: combat.conditions!.map((entry) =>
          entry.condition === "invisible" ? { ...entry, unseen: { pierced: ["truesight"] } } : entry,
        ),
      },
    };
    assert.equal(
      rulesetCanSee(truesightOnly, offBlind, who(offBlind, "a"), who(offBlind, "mage")),
      false,
      "off a board, a blind viewer does not see what only truesight pierces",
    );
    const tooFar = fight({ placements: { a: { x: 10, y: 7 } }, a: { senses: { blindsight: 10, truesight: 120 } } });
    who(tooFar, "a").tracked.push({ condition: "blinded", source: "mage" } as never);
    assert.equal(sees(tooFar, "a", "mage"), false, "truesight needs eyes; blindsight does not reach");
    // Within its blindsight, a blinded creature still does not see into murk only truesight pierces.
    const murky = cast(
      fight({ placements: { a: { x: 4, y: 7 } }, a: { senses: { blindsight: 10, truesight: 120 } } }),
      "Murk",
      { x: 2, y: 7 },
    ).state;
    assert.equal(sees(murky, "a", "mage"), true, "with eyes, truesight sees through it");
    who(murky, "a").tracked.push({ condition: "blinded", source: "mage" } as never);
    assert.equal(sees(murky, "a", "mage"), false, "blind, truesight is gone and blindsight does not pierce it");
    // A bestiary creature carries its senses onto its block.
    const batFight = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary: {
        spells,
        beasts: [
          {
            id: "bat",
            label: "Bat",
            creature: {
              health: 5,
              defense: 12,
              initiativeModifier: 0,
              speed: 30,
              tier: "cr_0",
              actions: [],
              senses: { blindsight: 60 },
            },
          } as unknown as RulesetCatalogEntry,
        ],
      },
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({ fields: { level: 1, hp_max: 10 } }),
          live: { conditions: ["invisible"] } as never,
          catalogs: {},
        },
        { id: "bat", name: "Bat", side: "enemy", creature: { catalogId: "beasts", entryId: "bat" } },
      ],
      board: { grid: grid(), placements: { mage: { x: 2, y: 7 }, bat: { x: 8, y: 7 } } },
    });
    assert.deepEqual(who(batFight, "bat").block?.senses, { blindsight: 60 });
    assert.equal(sees(batFight, "bat", "mage"), true, "the bat's blindsight finds the invisible mage");
  }

  // ── Fire Storm: copies, each touching another ──
  {
    const state = fight({ placements: { a: { x: 10, y: 7 }, b: { x: 14, y: 7 } } });
    // Cubes on 10,7 (covering 10-11 by 7-8 here), then 12,7 and 14,7: each touches the last.
    const step = cast(state, "Storm", { x: 10, y: 7 }, [
      { x: 12, y: 7 },
      { x: 14, y: 7 },
    ]);
    assert.equal(refused(step), undefined);
    assert.equal(hp(step.state, "a"), 93);
    assert.equal(hp(step.state, "b"), 93, "caught by the third cube");
    const area = step.events.find((one) => one.type === "area");
    assert.ok(area && area.type === "area" && area.cells.length === 12, "three cubes of four cells");
    // One copy fewer: B stands clear.
    const two = cast(fight({ placements: { a: { x: 10, y: 7 }, b: { x: 14, y: 7 } } }), "Storm", { x: 10, y: 7 }, [
      { x: 12, y: 7 },
    ]);
    assert.equal(hp(two.state, "b"), 100);
    // Refused: one that touches nothing set down before it, one too many, the same cell twice.
    assert.ok(refused(cast(fight(), "Storm", { x: 10, y: 7 }, [{ x: 16, y: 7 }])), "apart");
    assert.ok(
      refused(
        cast(fight(), "Storm", { x: 10, y: 7 }, [
          { x: 12, y: 7 },
          { x: 14, y: 7 },
          { x: 16, y: 7 },
        ]),
      ),
      "too many",
    );
    assert.ok(refused(cast(fight(), "Storm", { x: 10, y: 7 }, [{ x: 10, y: 7 }])), "twice");
    assert.ok(refused(cast(fight(), "Fog", { x: 10, y: 7 }, [{ x: 12, y: 7 }])), "an area with no copies");
    // The menu says how many.
    assert.equal(optionOf(fight(), "mage", "Storm").area?.copies, 3);
    assert.deepEqual(
      keys(
        (() => {
          const shown = cast(fight(), "Storm", { x: 10, y: 7 }, [{ x: 12, y: 7 }]).events.find(
            (one) => one.type === "area",
          );
          return shown && shown.type === "area" ? shown.cells : [];
        })(),
      ),
      keys([10, 11, 12, 13].flatMap((x) => [7, 8].map((y) => ({ x, y })))),
    );
  }

  // ── Import refusals ──
  {
    const refusedDoc = (edit: (doc: Record<string, any>) => void, pattern: RegExp) => {
      const result = parseRulesetDefinition(fiveE(edit));
      assert.equal(result.ok, false, `must refuse ${pattern}`);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    };
    const withSpell = (mechanics: Record<string, unknown>) => (doc: Record<string, any>) => {
      sighted(doc);
      doc.catalogs.push({ id: "x", label: "X", feeds: ["spells"], entries: [{ ...spell("x", {}), mechanics }] });
    };
    refusedDoc(
      withSpell({
        kind: "utility",
        area: { shape: "burst", size: 5 },
        zone: { rounds: 1, triggers: [], obscures: { pierced: ["tremors"] } },
      }),
      /Unknown sense "tremors"/,
    );
    refusedDoc((doc) => {
      doc.catalogs.push({
        id: "x",
        label: "X",
        feeds: ["spells"],
        entries: [
          {
            ...spell("x", {}),
            mechanics: {
              kind: "utility",
              area: { shape: "burst", size: 5 },
              zone: { rounds: 1, triggers: [], obscures: { pierced: ["blindsight"] } },
            },
          },
        ],
      });
    }, /declares no combat senses/);
    refusedDoc(withSpell({ kind: "attack", area: { shape: "cone", size: 15, copies: 2 } }), /Only a burst or a box/);
    refusedDoc(
      withSpell({
        kind: "attack",
        area: { shape: "burst", size: 5, copies: 2 },
        zone: { rounds: 1, triggers: ["enter"], drift: { distance: 10 } },
      }),
      /set down several times stays/,
    );
    refusedDoc(withSpell({ kind: "attack", area: { shape: "burst", size: 5, copies: 11 } }), /copies/);
    refusedDoc((doc) => {
      sighted(doc);
      doc.combat.senses.push({ id: "darkvision", label: "Again" });
    }, /Duplicate sense/);
    refusedDoc((doc) => {
      sighted(doc);
      for (const entry of doc.combat.conditions)
        if (entry.condition === "invisible") entry.unseen = { pierced: ["smell"] };
    }, /Unknown sense "smell"/);
    refusedDoc((doc) => {
      sighted(doc);
      doc.combat.senses[0].sheet = { field: "nothing" };
    }, /Unknown field "nothing"/);
    refusedDoc((doc) => {
      sighted(doc);
      delete doc.combat.distance;
    }, /A sense reaches a distance/);
    refusedDoc((doc) => {
      sighted(doc);
      doc.catalogs.push({
        id: "beasts",
        label: "Beasts",
        kind: "creatures",
        entries: [
          {
            id: "bat",
            label: "Bat",
            creature: { health: 1, defense: 12, tier: "minion", actions: [], senses: { echolocation: 60 } },
          },
        ],
      });
    }, /Unknown sense "echolocation"/);
    // Fog needs no trigger of its own.
    parsed(
      fiveE(
        withSpell({
          kind: "utility",
          area: { shape: "burst", size: 20 },
          range: 120,
          zone: { rounds: 10, triggers: [], obscures: {} },
        }),
      ),
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
      "A ruleset with combat senses or sight, obscuring zones, hiding conditions, targets that must be seen or areas set down several times requires schemaVersion 2 and capabilityApi 1.178 or newer";
    const withEntry = (entry: RulesetCatalogEntry) =>
      fiveE((doc) => {
        doc.catalogs.push({ id: "x", label: "X", entries: [entry] });
      });
    for (const entry of [fog, bolt, storm]) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(177) as never, withEntry(entry)), gate, entry.id);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(178) as never, withEntry(entry)), gate, entry.id);
    }
    const senses = fiveE((doc) => {
      doc.combat.senses = [{ id: "darkvision", label: "Darkvision" }];
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(177) as never, senses), gate, "combat senses");
    const sight = fiveE((doc) => {
      doc.combat.sight = { unseenAttacks: true };
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(177) as never, sight), gate, "combat sight");
    const hidden = fiveE((doc) => {
      for (const entry of doc.combat.conditions) if (entry.condition === "invisible") entry.unseen = {};
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(177) as never, hidden), gate, "a hiding condition");
    const plain = fiveE((doc) => {
      doc.catalogs.push({
        id: "x",
        label: "X",
        entries: [spell("ball", { area: { shape: "burst", size: 20 }, range: 150, amount: { flat: 5 } })],
      });
    });
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(177) as never, plain), gate, "a burst alone");
  }

  console.log(
    "Sight: fog and darkness hide what is in and beyond them but from the senses that pierce them, in range; darkvision comes off the sheet, blindsight works blind; invisible hides; unseen attacks get advantage or disadvantage; a creature you can see is one you can; Fire Storm lays touching cubes; gated at 1.178.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
