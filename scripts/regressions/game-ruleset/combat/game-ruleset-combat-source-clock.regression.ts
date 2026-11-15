/**
 * A condition on its source's clock (Capability API 1.119): 5e's Guiding Bolt.
 *
 *   - `duration: { rounds, of: "source" }` counts the turns of whoever put it on, from their next
 *     one: put on during the caster's turn, it lasts until the end of their NEXT turn, through the
 *     target's own turn between.
 *   - With `at: "turn-start"` it ends as the caster's next turn begins.
 *   - A source that has left the fight hands the clock back to the holder.
 *   - Import and the install gate (1.119).
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
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  type RulesetCatalogEntry,
  type RulesetCombatantInput,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-source-clock-"));
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
  const withGuided = (doc: Record<string, any>) => {
    doc.sheet.live.conditions.push({ id: "guided", label: "Guided" });
    doc.combat.conditions.push({ condition: "guided", effects: ["attacks-against-advantage"] });
  };
  const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
    const parsed = parseRulesetDefinition(document);
    assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
    return parsed.definition;
  };
  const definition = parsedOrThrow(fiveE(withGuided), "the 5e example with Guiding Bolt's condition");
  const dice = (...faces: number[]): RulesetCombatRoller => {
    let index = 0;
    return (sides) => {
      assert.ok(index < faces.length, `the script ran out of dice (a d${sides} was asked for)`);
      return faces[index++]!;
    };
  };

  const bolt = (duration: Record<string, unknown>): RulesetCatalogEntry =>
    ({
      id: "guiding-bolt",
      label: "Guiding Bolt",
      rows: [{ list: "spells", values: { name: "Guiding Bolt", level: 1, prepared: true } }],
      mechanics: {
        kind: "attack",
        autoHit: true,
        amount: { flat: 4 },
        damageType: "radiant",
        applies: [{ condition: "guided", duration, endsAfter: "attacked" }],
      },
    }) as unknown as RulesetCatalogEntry;
  const snag: RulesetStatBlock = {
    health: 60,
    defense: 13,
    initiativeModifier: -10,
    speed: 30,
    actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 6, flat: 0 } }],
  } as RulesetStatBlock;
  /** Corwin first, then Snag; Pell, when she is asked for, between them. */
  const fight = (duration: Record<string, unknown>, withPell = false): RulesetEncounterState => {
    const entry = bolt(duration);
    return createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "corwin",
          name: "Corwin",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 20, con: 10, int: 10, wis: 16, cha: 10 },
            fields: { level: 3, ac: 12, speed: 30, hp_max: 30 },
            lists: { spells: rowsFromCatalogEntry("spells", entry).map((row) => row.row) },
          }),
          live: {},
          catalogs: { spells: [entry] },
        },
        { id: "snag", name: "Snag", side: "enemy", block: snag } as RulesetCombatantInput,
        ...(withPell
          ? [
              {
                id: "pell",
                name: "Pell",
                side: "party" as const,
                build: rulesetSheetBuildSchema.parse({
                  abilities: { str: 10, dex: 1, con: 10, int: 10, wis: 10, cha: 10 },
                  fields: { level: 1, ac: 10, speed: 30, hp_max: 10 },
                }),
                live: {},
                catalogs: {},
              },
            ]
          : []),
      ],
    });
  };
  const guided = (state: RulesetEncounterState) =>
    rulesetCombatant(state, "snag")!.tracked.find((entry) => entry.condition === "guided");
  const cast = (state: RulesetEncounterState) => {
    const option = rulesetCombatOptions(definition, state, "corwin").find((one) => one.label === "Guiding Bolt");
    assert.ok(option, "Corwin may cast it");
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "corwin", optionId: option.id, targetIds: ["snag"] },
      dice(),
    ).state;
  };
  const endTurn = (state: RulesetEncounterState, actorId: string) => {
    assert.equal(state.order[state.turn], actorId, `it is ${actorId}'s turn`);
    return applyRulesetCombatChoice(definition, state, { actorId, optionId: "end-turn", targetIds: [] }, dice()).state;
  };

  // ── Until the end of the caster's next turn ──
  {
    let state = cast(fight({ rounds: 1, of: "source" }));
    assert.deepEqual(
      [guided(state)?.rounds, guided(state)?.clockOf, guided(state)?.source],
      [2, "source", "corwin"],
      "put on in Corwin's own turn, it counts from his next",
    );
    state = endTurn(state, "corwin");
    assert.equal(guided(state)?.rounds, 1, "the end of this turn counts");
    state = endTurn(state, "snag");
    assert.equal(guided(state)?.rounds, 1, "Snag's own turn does not");
    state = endTurn(state, "corwin");
    assert.equal(guided(state), undefined, "gone at the end of Corwin's next turn");

    // On the holder's clock, as before, it would have gone at the end of Snag's turn.
    let own = cast(fight({ rounds: 1 }));
    assert.equal(guided(own)?.clockOf, undefined);
    own = endTurn(endTurn(own, "corwin"), "snag");
    assert.equal(guided(own), undefined);
  }

  // ── Until the start of the caster's next turn ──
  {
    let state = cast(fight({ rounds: 1, at: "turn-start", of: "source" }));
    assert.equal(guided(state)?.rounds, 1, "the start of his next turn is already his next turn");
    state = endTurn(endTurn(state, "corwin"), "snag");
    assert.equal(guided(state), undefined, "gone as Corwin's next turn begins");
  }

  // ── A source gone from the fight hands the clock back ──
  {
    // Pell keeps the party in the fight once Corwin is down.
    let state = cast(fight({ rounds: 1, of: "source" }, true));
    state = endTurn(state, "corwin");
    rulesetCombatant(state, "corwin")!.defeated = true;
    state = endTurn(endTurn(state, "pell"), "snag");
    assert.equal(guided(state), undefined, "Snag's own turn counts once Corwin is gone");
  }

  // ── Import ──
  {
    const parsed = parseRulesetDefinition(
      fiveE((doc) => {
        withGuided(doc);
        doc.catalogs.push({
          id: "spells",
          label: "Spells",
          feeds: ["spells"],
          entries: [bolt({ rounds: 1, of: "target" })],
        });
      }),
    );
    assert.equal(parsed.ok, false, "a clock nobody keeps");
    parsedOrThrow(
      fiveE((doc) => {
        withGuided(doc);
        doc.catalogs.push({
          id: "spells",
          label: "Spells",
          feeds: ["spells"],
          entries: [bolt({ rounds: 1, of: "source" })],
        });
      }),
      "Guiding Bolt",
    );
  }

  // ── The install gate: 1.119 ──
  {
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-guiding",
      name: "Guiding",
      version: "0.1.0",
      description: "A packaged ruleset whose Guiding Bolt lasts the caster's turn.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const gate = /turns of whoever put them on.*capabilityApi 1\.119/;
    const issue = (minor: number, doc: Record<string, any>) =>
      getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
    const inCatalog = (doc: Record<string, any>) => {
      doc.catalogs.push({ id: "spells", label: "Spells", entries: [bolt({ rounds: 1, of: "source" })] });
    };
    const leftBehind = (doc: Record<string, any>) => {
      doc.combat.conditions.push({
        condition: "guided",
        onEnd: { applies: [{ condition: "prone", duration: { rounds: 1, of: "source" } }] },
      });
    };
    for (const [what, edit] of [
      ["a catalog entry", inCatalog],
      ["what a condition leaves behind", leftBehind],
    ] as const) {
      assert.match(issue(118, fiveE(edit)) ?? "", gate, what);
      assert.doesNotMatch(issue(119, fiveE(edit)) ?? "", gate, what);
    }
    assert.doesNotMatch(issue(118, fiveE()) ?? "", gate, "the example as shipped asks nothing new");
  }

  console.log("Source clock: Guiding Bolt lasts until the end of the caster's next turn, gated at 1.119.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
