/**
 * What a blow carries past a resistance, off a spell and off a creature (Capability API 1.101).
 *
 *   - `qualities` on a catalog entry's mechanics and on a creature action's damage are the ruleset's
 *     own item tags, checked at import exactly as a resistance's `except` is.
 *   - In a fight they are carried the way a weapon's tags are: a resistance that names one of them in
 *     `except` takes nothing off, an immunity that does lets the harm through, and harm without them
 *     is resisted as before. 5e's "resistance to slashing from nonmagical attacks" is
 *     `{ type: "slashing", except: ["magical"] }`, with spells and a deva's mace `["magical"]`.
 *   - The install gate asks for 1.101, in the ruleset file and in a catalog file.
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
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  type RulesetCombatantInput,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../../packages/shared/src/index.js";

// Server modules read DATA_DIR once at load, so they are imported only after it points at scratch.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-blow-qualities-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  const gravewatchText = readFileSync(
    fileURLToPath(new URL("../../../docs/examples/rulesets/gravewatch.json", import.meta.url)),
    "utf8",
  );
  const variant = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(gravewatchText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
    const parsed = parseRulesetDefinition(document);
    assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
    return parsed.definition;
  };
  const refused = (edit: (doc: Record<string, any>) => void, pattern: RegExp, what: string) => {
    const parsed = parseRulesetDefinition(variant(edit));
    assert.equal(parsed.ok, false, `${what}: the file should be refused`);
    if (parsed.ok) return;
    assert.ok(
      parsed.issues.some((issue) => pattern.test(issue)),
      `${what}: expected ${pattern}, got ${parsed.issues.join("; ")}`,
    );
  };
  const catalog = (doc: Record<string, any>, id: string) => doc.catalogs.find((one: { id: string }) => one.id === id);
  const entry = (doc: Record<string, any>, catalogId: string, id: string) =>
    catalog(doc, catalogId).entries.find((one: { id: string }) => one.id === id);
  /** The lantern flare is a charm that burns; the rats gnaw, which tears. */
  const silverFlare = (doc: Record<string, any>) =>
    (entry(doc, "charms", "lantern-flare").mechanics.qualities = ["silver"]);
  const silverGnaw = (doc: Record<string, any>) =>
    (entry(doc, "night", "grave-rats").creature.actions[0].damage.qualities = ["silver"]);

  // ── Import ──
  {
    parsedOrThrow(variant(silverFlare), "a charm that carries silver");
    parsedOrThrow(variant(silverGnaw), "a bite that carries silver");
    refused(
      (doc) => (entry(doc, "charms", "lantern-flare").mechanics.qualities = ["gold"]),
      /mechanics\.qualities\.0: Unknown item tag "gold"/,
      "a charm that names an unknown tag",
    );
    refused(
      (doc) => (entry(doc, "night", "grave-rats").creature.actions[0].damage.qualities = ["gold"]),
      /actions\.0\.damage\.qualities\.0: Unknown item tag "gold"/,
      "a bite that names an unknown tag",
    );
    refused(
      (doc) => (entry(doc, "charms", "lantern-flare").mechanics.qualities = []),
      /qualities/,
      "qualities that name nothing",
    );
  }

  // ── A fight ──
  {
    const definitionOf = (edit: (doc: Record<string, any>) => void) => parsedOrThrow(variant(edit), "Gravewatch");
    const catalogsOf = (definition: RulesetDefinition) =>
      Object.fromEntries((definition.catalogs ?? []).map((one) => [one.id, one.entries ?? []]));
    /** Ada knows the lantern flare; the foe is a plain block whose hide is the case's. */
    const fight = (definition: RulesetDefinition, hide: Record<string, unknown>): RulesetEncounterState => {
      const catalogs = catalogsOf(definition);
      const flare = (catalogs.charms ?? []).find((one) => one.id === "lantern-flare")!;
      const ada: RulesetCombatantInput = {
        id: "ada",
        name: "Ada",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { sinew: 3, nerve: 2, warmth: 2 },
          skills: { dig: "rating_1", wrestle: "rating_2", ward: "rating_2" },
          lists: { charms: rowsFromCatalogEntry("charms", flare).map((row) => row.row) },
        }),
        catalogs,
      } as RulesetCombatantInput;
      return createRulesetEncounter({
        definition,
        seed: 5,
        bestiary: catalogs,
        roller: () => 8,
        combatants: [
          ada,
          {
            id: "foe",
            name: "Foe",
            side: "enemy",
            block: { health: 40, defense: 1, initiativeModifier: -5, actions: [], ...hide },
          } as RulesetCombatantInput,
        ],
      });
    };
    const adjustOf = (definition: RulesetDefinition, hide: Record<string, unknown>) => {
      const state = fight(definition, hide);
      const option = rulesetCombatOptions(definition, state, "ada").find((one) => /lantern/i.test(one.label));
      assert.ok(option, "Ada has the lantern flare");
      const after = applyRulesetCombatChoice(
        definition,
        state,
        { actorId: "ada", optionId: option.id, targetIds: ["foe"] },
        () => 8,
      );
      const damage = after.events.find((event) => event.type === "damage") as
        Extract<RulesetCombatEvent, { type: "damage" }> | undefined;
      assert.ok(damage, `the flare lands: ${JSON.stringify(after.events.map((event) => event.type))}`);
      return damage.adjust;
    };
    const plain = definitionOf(() => {});
    const silvered = definitionOf((doc) => {
      silverFlare(doc);
      silverGnaw(doc);
    });
    const resistBurning = { resist: [{ type: "burning", except: ["silver"] }] };
    // A spell that carries silver goes through; the same spell without it is halved.
    assert.equal(adjustOf(silvered, resistBurning), "none", "a silver flare gets through");
    assert.equal(adjustOf(plain, resistBurning), "resist", "a plain flare does not");
    assert.equal(adjustOf(silvered, { resist: ["burning"] }), "resist", "a resistance with no exception holds");
    assert.equal(adjustOf(silvered, { immune: [{ type: "burning", except: ["silver"] }] }), "none");
    assert.equal(adjustOf(plain, { immune: [{ type: "burning", except: ["silver"] }] }), "immune");
    // And a creature's own bite carries them onto its action, where the same blow reads them: only
    // the enemy side fights from blocks, so the bite is read off the block a fight builds.
    const biteOf = (definition: RulesetDefinition) => {
      const state = createRulesetEncounter({
        definition,
        seed: 5,
        bestiary: catalogsOf(definition),
        roller: () => 8,
        combatants: [
          { id: "rats", name: "Rats", side: "enemy", creature: { catalogId: "night", entryId: "grave-rats" } },
        ],
      });
      return state.combatants.find((one) => one.id === "rats")?.block?.actions[0]?.damage?.qualities;
    };
    assert.deepEqual(biteOf(silvered), ["silver"], "a silver bite carries silver");
    assert.equal(biteOf(plain), undefined, "a plain bite carries nothing");
  }

  // ── The install gate: 1.101, in the ruleset file and in a catalog file ──
  {
    const manifest = (minor: number, paths = ["ruleset.json"]) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-blow-qualities",
      name: "Blow qualities",
      version: "0.1.0",
      description: "A packaged ruleset whose spells and creatures carry qualities.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths } },
      files: paths.map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
      permissions: [],
      restartRequired: false,
    });
    const gate = /carry qualities past a resistance.*capabilityApi 1\.101/;
    const issue = (minor: number, doc: Record<string, any>, paths?: string[], files?: Map<string, unknown>) =>
      getCapabilityPackageInstallIssue(manifest(minor, paths) as any, doc, files);
    assert.match(issue(100, variant(silverFlare)) ?? "", gate, "a charm");
    assert.match(issue(100, variant(silverGnaw)) ?? "", gate, "a creature");
    assert.equal(issue(101, variant(silverFlare)), null);
    assert.equal(issue(101, variant(silverGnaw)), null);
    assert.doesNotMatch(issue(100, variant()) ?? "", gate, "the example as shipped asks nothing new");
    const document = variant(silverGnaw);
    const night = catalog(document, "night");
    const inFile = {
      ...document,
      catalogs: document.catalogs.map((one: { id: string }) =>
        one.id === "night" ? { ...one, entries: undefined, asset: "catalogs/night.json" } : one,
      ),
    };
    const paths = ["ruleset.json", "catalogs/night.json"];
    const files = new Map<string, unknown>([["catalogs/night.json", { entries: night.entries }]]);
    assert.match(issue(100, inFile, paths, files) ?? "", gate, "a catalog file");
    assert.equal(issue(101, inFile, paths, files), null);
  }

  console.log("Blow qualities: spells and creatures carry what gets through a resistance, checked and gated at 1.101.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
