/**
 * How big a combatant is, and what escaping a hold takes (Capability API 1.103).
 *
 *   - `combat.sizes` lists sizes smallest first; a sheet reads its size as a number off itself (1 for
 *     the first), a creature names its own, and whoever nothing says is the `default`, or no size.
 *   - A contest's `maxSizeAbove` keeps it off a target that many sizes larger or more: 5e's grapple
 *     reaches a Large ogre from a Medium fighter and not a Huge giant. No size is never too big.
 *   - `escapeDc` on a condition an action applies is what breaking free of it is rolled against: the
 *     holder throws nothing and the one held wins on meeting it, in the forecast and in the roll.
 *   - Import checks the names, and the install gate asks for 1.103, in a catalog file too.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  RULESET_PASS_OPTION,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  currentRulesetActor,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  type RulesetCombatantInput,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../../../packages/shared/src/index.js";

// Server modules read DATA_DIR once at load, so they are imported only after it points at scratch.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-combat-sizes-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
    const parsed = parseRulesetDefinition(document);
    assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
    return parsed.definition;
  };
  const refused = (document: unknown, pattern: RegExp, what: string) => {
    const parsed = parseRulesetDefinition(document);
    assert.equal(parsed.ok, false, `${what}: the file should be refused`);
    if (parsed.ok) return;
    assert.ok(
      parsed.issues.some((issue) => pattern.test(issue)),
      `${what}: expected ${pattern}, got ${parsed.issues.join("; ")}`,
    );
  };
  const creatureOf = (doc: Record<string, any>, entryId: string) =>
    doc.catalogs
      .find((one: { id: string }) => one.id === "creatures")
      .entries.find((one: { id: string }) => one.id === entryId).creature;
  const contestOf = (doc: Record<string, any>, id: string) =>
    doc.combat.contests.find((one: { id: string }) => one.id === id);
  const SIZES = ["tiny", "small", "medium", "large", "huge", "gargantuan"];
  /** 5e's sizes off a `size` field, grapples and shoves that reach one size up, a Large lurker whose
   *  claw grapples (escape DC 13) and acts first, and a Huge sentinel. The hound says nothing. */
  const sized = (doc: Record<string, any>) => {
    doc.sheet.fields.push({
      id: "size",
      label: "Size",
      type: "number",
      min: 1,
      max: 6,
      default: 3,
      section: "identity",
    });
    doc.combat.sizes = {
      order: SIZES.map((id) => ({ id, label: id[0]!.toUpperCase() + id.slice(1) })),
      sheet: { field: "size" },
      default: "medium",
    };
    contestOf(doc, "grapple").maxSizeAbove = 1;
    contestOf(doc, "shove_prone").maxSizeAbove = 1;
    const lurker = creatureOf(doc, "thorn-lurker");
    lurker.size = "large";
    lurker.initiativeModifier = 30;
    lurker.actions[0].applies = [{ condition: "grappled", duration: "instant", escapeDc: 13 }];
    creatureOf(doc, "hollow-sentinel").size = "huge";
  };

  // ── Import ──
  {
    parsedOrThrow(fiveE(sized), "5e with sizes");
    const sizedAnd = (edit: (doc: Record<string, any>) => void) =>
      fiveE((doc) => {
        sized(doc);
        edit(doc);
      });
    refused(
      fiveE((doc) => (contestOf(doc, "grapple").maxSizeAbove = 1)),
      /maxSizeAbove.*declares "sizes"/,
      "a size limit with no sizes",
    );
    refused(
      fiveE((doc) => (creatureOf(doc, "thorn-lurker").size = "large")),
      /size: This ruleset declares no sizes/,
      "a creature size with no sizes",
    );
    refused(
      sizedAnd((doc) => (creatureOf(doc, "thorn-lurker").size = "colossal")),
      /Unknown size "colossal"/,
      "size",
    );
    refused(
      sizedAnd((doc) => (doc.combat.sizes.default = "colossal")),
      /default: Unknown size "colossal"/,
      "default",
    );
    refused(
      sizedAnd((doc) => doc.combat.sizes.order.push({ id: "tiny", label: "Tiny" })),
      /Duplicate size/,
      "twice",
    );
    refused(
      sizedAnd((doc) => (doc.combat.sizes.sheet = { field: "girth" })),
      /sizes\.sheet/,
      "an unknown field",
    );
    refused(
      sizedAnd((doc) => (doc.combat.sizes.order = [{ id: "one", label: "One" }])),
      /order/,
      "one size",
    );
    refused(
      sizedAnd((doc) => (creatureOf(doc, "thorn-lurker").actions[0].applies[0].condition = "prone")),
      /escapeDc: No contest breaks free of "prone"/,
      "an escape DC nothing escapes with",
    );
    refused(
      sizedAnd((doc) => (creatureOf(doc, "thorn-lurker").actions[0].applies[0].escapeDc = 0)),
      /escapeDc/,
      "an escape DC of nothing",
    );
  }

  // ── A fight ──
  {
    /** The d20 lands on `face`; every other die on its highest face. */
    const rollerOf =
      (face: number): RulesetCombatRoller =>
      (sides) =>
        sides === 20 ? face : sides;
    const fight = (definition: RulesetDefinition, size: number | undefined): RulesetEncounterState => {
      const catalogs = Object.fromEntries((definition.catalogs ?? []).map((one) => [one.id, one.entries ?? []]));
      const brenna: RulesetCombatantInput = {
        id: "brenna",
        name: "Brenna",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
          fields: { level: 3, ac: 12, speed: 30, hp_max: 200, ...(size !== undefined ? { size } : {}) },
        }),
        catalogs: {},
      } as RulesetCombatantInput;
      const creature = (id: string, entryId: string): RulesetCombatantInput => ({
        id,
        name: id,
        side: "enemy",
        creature: { catalogId: "creatures", entryId },
      });
      return createRulesetEncounter({
        definition,
        seed: 3,
        bestiary: catalogs,
        roller: rollerOf(10),
        combatants: [
          brenna,
          creature("lurker", "thorn-lurker"),
          creature("sentinel", "hollow-sentinel"),
          creature("hound", "cinder-hound"),
        ],
      });
    };
    const grabbable = (definition: RulesetDefinition, state: RulesetEncounterState, contest = "grapple") =>
      rulesetOptionTargets(definition, state, "brenna", {
        id: `contest:${contest}`,
        targets: { side: "enemy", count: 1 },
      });
    const definition = parsedOrThrow(fiveE(sized), "5e with sizes");
    const sizeOf = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)?.size;

    // Sizes as the fight read them: Brenna's off her sheet, a creature's its own, the hound the default.
    const medium = fight(definition, 3);
    assert.deepEqual(
      ["brenna", "lurker", "sentinel", "hound"].map((id) => sizeOf(medium, id)),
      ["medium", "large", "huge", "medium"],
    );
    assert.equal(sizeOf(fight(definition, undefined), "brenna"), "medium", "the field's own default");
    assert.equal(sizeOf(fight(definition, 9), "brenna"), "gargantuan", "held to the list");

    // A Medium fighter grabs a Large lurker and a Medium hound, never the Huge sentinel; a shove the
    // same, and a shove away, with no limit, reaches everybody. A Large one grabs the sentinel too, a
    // Small one only the hound, and a Tiny one nobody here.
    assert.deepEqual(grabbable(definition, medium), ["lurker", "hound"]);
    assert.deepEqual(grabbable(definition, medium, "shove_prone"), ["lurker", "hound"]);
    assert.deepEqual(grabbable(definition, medium, "shove_away"), ["lurker", "sentinel", "hound"]);
    assert.deepEqual(grabbable(definition, fight(definition, 4)), ["lurker", "sentinel", "hound"]);
    assert.deepEqual(grabbable(definition, fight(definition, 2)), ["hound"]);
    assert.deepEqual(grabbable(definition, fight(definition, 1)), []);
    // Nobody's size is never too big: a ruleset without sizes, and one whose default is left out
    // for a creature that names none.
    const plain = parsedOrThrow(fiveE(), "the 5e example");
    assert.deepEqual(grabbable(plain, fight(plain, undefined)), ["lurker", "sentinel", "hound"]);
    const noDefault = parsedOrThrow(
      fiveE((doc) => {
        sized(doc);
        delete doc.combat.sizes.default;
        delete creatureOf(doc, "hollow-sentinel").size;
      }),
      "sizes with no default",
    );
    const unsure = fight(noDefault, 1);
    assert.equal(sizeOf(unsure, "sentinel"), undefined);
    assert.deepEqual(grabbable(noDefault, unsure), ["sentinel", "hound"], "a Tiny fighter, and two of no size");

    // ── The escape DC ──
    // The lurker's claw hits and grapples Brenna, escape DC 13, and her turn comes round.
    const grabbed = (state: RulesetEncounterState) => {
      assert.equal(currentRulesetActor(state)?.id, "lurker", "the lurker acts first");
      const claw = rulesetCombatOptions(definition, state, "lurker").find((one) => /Barbed claw/.test(one.label))!;
      let next = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "lurker", optionId: claw.id, targetIds: ["brenna"] },
        rollerOf(15),
      ).state;
      const held = rulesetCombatant(next, "brenna")!.tracked.find((entry) => entry.condition === "grappled");
      assert.deepEqual(held && { source: held.source, escapeDc: held.escapeDc }, { source: "lurker", escapeDc: 13 });
      // Everybody else lets their turn go, and any window between turns goes by unanswered.
      for (let turn = 0; turn < 8 && currentRulesetActor(next)?.id !== "brenna"; turn++) {
        const asked = next.window?.waiting[0];
        const step = asked
          ? applyRulesetCombatChoice(definition, next, { actorId: asked, optionId: RULESET_PASS_OPTION, targetIds: [] })
          : applyRulesetCombatChoice(definition, next, {
              actorId: currentRulesetActor(next)!.id,
              optionId: "end-turn",
              targetIds: [],
            });
        assert.ok(!step.events.some((event) => event.type === "refused"), JSON.stringify(step.events));
        next = step.state;
      }
      assert.equal(currentRulesetActor(next)?.id, "brenna", "Brenna's turn comes round");
      return next;
    };
    const held = grabbed(fight(definition, 3));
    // On her own turn the resolver holds a grab to the same list: the Huge sentinel is refused.
    const refusedGrab = applyRulesetCombatChoice(
      definition,
      held,
      { actorId: "brenna", optionId: "contest:grapple", targetIds: ["sentinel"] },
      rollerOf(10),
    ).events;
    assert.deepEqual(
      refusedGrab.map((event) => event.type),
      ["refused"],
      `a grab at the sentinel is refused: ${JSON.stringify(refusedGrab)}`,
    );
    const brenna = rulesetCombatant(held, "brenna")!;
    const best = Math.max(brenna.checks!.might!, brenna.checks!.agility!);
    const escape = rulesetCombatOptions(definition, held, "brenna").find((one) => one.id === "contest:escape");
    assert.ok(escape, "breaking free is on the menu while held");
    // Meeting 13 on a d20: the faces from 13 - best up.
    assert.equal(escape.forecast?.hitChance, Math.round(((21 - (13 - best)) / 20) * 1000) / 1000);
    const escapeWith = (face: number) => {
      const after = applyRulesetCombatChoice(
        definition,
        held,
        { actorId: "brenna", optionId: "contest:escape", targetIds: ["lurker"] },
        rollerOf(face),
      );
      const contest = after.events.find((event) => event.type === "contest") as
        Extract<RulesetCombatEvent, { type: "contest" }> | undefined;
      assert.ok(contest, "the escape is thrown");
      // Only the one held threw: one d20 and nothing for the lurker.
      assert.equal(contest.attacker.rolls.length, 1);
      assert.deepEqual(contest.defender, { check: "", rolls: [], modifier: 13, total: 13 });
      assert.equal(contest.escapeDc, 13);
      const stillHeld = rulesetCombatant(after.state, "brenna")!.tracked.some((e) => e.condition === "grappled");
      return { winner: contest.winner, stillHeld };
    };
    assert.deepEqual(escapeWith(13 - best), { winner: "actor", stillHeld: false }, "meeting the DC");
    assert.deepEqual(escapeWith(12 - best), { winner: "target", stillHeld: true }, "one short");
  }

  // ── The install gate: 1.103, in the ruleset file and in a catalog file ──
  {
    const manifest = (minor: number, paths = ["ruleset.json"]) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-combat-sizes",
      name: "Combat sizes",
      version: "0.1.0",
      description: "A packaged ruleset whose combatants have sizes.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths } },
      files: paths.map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
      permissions: [],
      restartRequired: false,
    });
    const gate = /have sizes or whose holds name an escape DC.*capabilityApi 1\.103/;
    const issue = (minor: number, doc: Record<string, any>, paths?: string[], files?: Map<string, unknown>) =>
      getCapabilityPackageInstallIssue(manifest(minor, paths) as any, doc, files);
    const sizesOnly = (doc: Record<string, any>) => {
      doc.combat.sizes = {
        order: [
          { id: "small", label: "Small" },
          { id: "big", label: "Big" },
        ],
      };
    };
    const limitOnly = (doc: Record<string, any>) => (contestOf(doc, "grapple").maxSizeAbove = 1);
    const sizeOnly = (doc: Record<string, any>) => (creatureOf(doc, "thorn-lurker").size = "large");
    const escapeOnly = (doc: Record<string, any>) =>
      (creatureOf(doc, "thorn-lurker").actions[0].applies = [
        { condition: "grappled", duration: "instant", escapeDc: 13 },
      ]);
    for (const [what, edit] of [
      ["sizes", sizesOnly],
      ["a size limit", limitOnly],
      ["a creature's size", sizeOnly],
      ["an escape DC", escapeOnly],
    ] as const) {
      assert.match(issue(102, fiveE(edit)) ?? "", gate, what);
      assert.doesNotMatch(issue(103, fiveE(edit)) ?? "", gate, what);
    }
    assert.doesNotMatch(issue(102, fiveE()) ?? "", gate, "the example as shipped asks nothing new");
    const document = fiveE(escapeOnly);
    const creatures = document.catalogs.find((one: { id: string }) => one.id === "creatures");
    const inFile = {
      ...document,
      catalogs: document.catalogs.map((one: { id: string }) =>
        one.id === "creatures" ? { ...one, entries: undefined, asset: "catalogs/creatures.json" } : one,
      ),
    };
    const paths = ["ruleset.json", "catalogs/creatures.json"];
    const files = new Map<string, unknown>([["catalogs/creatures.json", { entries: creatures.entries }]]);
    assert.match(issue(102, inFile, paths, files) ?? "", gate, "a catalog file");
    assert.doesNotMatch(issue(103, inFile, paths, files) ?? "", gate);
  }

  console.log("Combat sizes: who may be grabbed, and escapes rolled against a hold's own DC, gated at 1.103.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
