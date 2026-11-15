/**
 * Entries that change another of their holder's each time it is used (Capability API 1.302).
 *
 *   - `amends`, held on a sheet's list: `damageAdd` to the named entry's damage on a hit, its
 *     `range`, and a `push` on whoever it hits, offered without it too where `pushOptional`. They
 *     stack: 5e's Agonizing Blast, Eldritch Spear and Repelling Blast on eldritch blast.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetCatalogFile,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-amends-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 297);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const blast = {
    id: "eldritch-blast",
    label: "Eldritch Blast",
    rows: [{ list: "spells", values: { name: "Eldritch Blast", level: 0, prepared: true } }],
    mechanics: { kind: "attack", range: 120, attackRoll: true, amount: { dice: "1d10" }, damageType: "force" },
  } as unknown as RulesetCatalogEntry;
  const other = {
    id: "fire-bolt",
    label: "Fire Bolt",
    rows: [{ list: "spells", values: { name: "Fire Bolt", level: 0, prepared: true } }],
    mechanics: { kind: "attack", range: 120, attackRoll: true, amount: { dice: "1d10" }, damageType: "fire" },
  } as unknown as RulesetCatalogEntry;
  const invocation = (id: string, amend: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "features", values: { name: id[0]!.toUpperCase() + id.slice(1) } }],
      mechanics: { kind: "utility", amends: [{ entry: "spells/eldritch-blast", ...amend }] },
    }) as unknown as RulesetCatalogEntry;
  const agonizing = invocation("agonizing", { damageAdd: { abilityMod: "cha" } });
  const spear = invocation("spear", { range: 300 });
  const repelling = invocation("repelling", { push: 10, pushOptional: true });
  const invocations = [agonizing, spear, repelling];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [blast, other] });
    doc.catalogs.push({
      id: "invocations",
      label: "Invocations",
      feeds: ["features"],
      entries: structuredClone(invocations),
    });
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
  const rows = (catalog: string, entries: RulesetCatalogEntry[]) =>
    entries.flatMap((entry) => rowsFromCatalogEntry(catalog, entry).map((row) => row.row));
  const warlock = (held: RulesetCatalogEntry[]) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 16 },
      fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "cha" },
      lists: { spells: rows("spells", [blast, other]), features: rows("invocations", held) },
    });
  const fight = (held: RulesetCatalogEntry[]): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 15,
      combatants: [
        {
          id: "lock",
          name: "Lock",
          side: "party",
          build: warlock(held),
          live: {},
          catalogs: { spells: [blast, other], invocations },
        },
        {
          id: "a",
          name: "A",
          side: "enemy",
          block: {
            health: 200,
            defense: 5,
            initiativeModifier: 0,
            speed: 30,
            actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
          },
        },
      ],
      board: {
        grid: { width: 80, height: 10, tiles: Array.from({ length: 10 }, () => Array(80).fill("plains")) } as never,
        placements: { lock: { x: 2, y: 5 }, a: { x: 12, y: 5 } },
      },
    });
    state.order = ["lock", "a"];
    state.turn = 0;
    return state;
  };
  const actionOf = (state: RulesetEncounterState, label: string) =>
    rulesetCombatant(state, "lock")!.actions.find((one) => one.label === label)!;
  const cast = (state: RulesetEncounterState, label: string) => {
    const option = rulesetCombatOptions(definition, state, "lock").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "lock", optionId: option.id, targetIds: ["a"] },
      () => 15,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step;
  };

  // ── Each on its own, and all three at once ──
  {
    const plain = fight([]);
    assert.equal(actionOf(plain, "Eldritch Blast").damage!.flat, 0);
    assert.equal(actionOf(plain, "Eldritch Blast").range!.normal, 24, "120 feet");
    assert.equal(actionOf(plain, "Eldritch Blast").push, undefined);
    assert.equal(actionOf(fight([agonizing]), "Eldritch Blast").damage!.flat, 3, "Charisma +3");
    assert.equal(actionOf(fight([spear]), "Eldritch Blast").range!.normal, 60, "300 feet");
    const all = fight([agonizing, spear, repelling]);
    const amended = actionOf(all, "Eldritch Blast");
    assert.deepEqual([amended.damage!.flat, amended.range!.normal, amended.push], [3, 60, 2]);
    // Offered without the push, with everything else.
    const still = actionOf(all, "Eldritch Blast (no push)");
    assert.deepEqual([still.damage!.flat, still.range!.normal, still.push], [3, 60, undefined]);
    // The invocations themselves are nothing to take.
    assert.ok(!rulesetCombatOptions(definition, all, "lock").some((one) => one.label === "Agonizing"));
    // Another spell is left alone.
    assert.equal(actionOf(all, "Fire Bolt").damage!.flat, 0);
    assert.equal(actionOf(all, "Fire Bolt").range!.normal, 24);
  }

  // ── A hit pushes, or not ──
  {
    const pushed = cast(fight([repelling]), "Eldritch Blast");
    assert.ok(
      pushed.events.some((one) => one.type === "damage" && one.targetId === "a"),
      "it hit",
    );
    assert.equal(rulesetCombatant(pushed.state, "a")!.x, 14, "10 feet away");
    const kept = cast(fight([repelling]), "Eldritch Blast (no push)");
    assert.equal(rulesetCombatant(kept.state, "a")!.x, 12, "left where it was");
  }

  // ── Refusals ──
  {
    const withAmend = (amend: Record<string, unknown>) =>
      fiveE((doc) => {
        doc.catalogs
          .find((catalog: { id: string }) => catalog.id === "invocations")
          .entries.push(invocation("odd", amend));
      });
    refusedDoc(withAmend({}), /An amend changes something/);
    refusedDoc(withAmend({ pushOptional: true, range: 30 }), /pushOptional/);
    refusedDoc(
      fiveE((doc) => {
        doc.catalogs
          .find((catalog: { id: string }) => catalog.id === "invocations")
          .entries.push({
            ...invocation("odd", {}),
            mechanics: { kind: "utility", amends: [{ entry: "spells/nothing", range: 30 }] },
          });
      }),
      /Unknown entry "spells\/nothing"/,
    );
  }

  // ── Catalogs kept in their own files: the entry is checked once every file is read ──
  {
    const { readRulesetPackageFile } = await import("../../../../packages/server/src/services/game/ruleset-package-file.js");
    const { createGameRulesetsStorage } =
      await import("../../../../packages/server/src/services/storage/game-rulesets.storage.js");
    const { getDB, closeDB } = await import("../../../../packages/server/src/db/connection.js");
    const storage = createGameRulesetsStorage(await getDB());
    try {
      for (const fault of [false, true]) {
        const doc = fiveE();
        if (fault) doc.catalogs.at(-2).entries.shift();
        const files: Record<string, string> = {};
        for (const header of doc.catalogs.slice(-2)) {
          files[header.id] = JSON.stringify({ schemaVersion: 1, catalog: header.id, entries: header.entries });
          delete header.entries;
          header.asset = `catalogs/${header.id}.json`;
        }
        // Read on its own, the invocations' file cannot see the spells' and takes the name on trust.
        assert.ok(parseRulesetCatalogFile(parsed(doc), "invocations", JSON.parse(files.invocations!)).ok);
        const documents = {
          "ruleset.json": JSON.stringify(doc),
          ...Object.fromEntries(Object.entries(files).map(([id, text]) => [`catalogs/${id}.json`, text])),
        };
        const declared = {
          schemaVersion: 2,
          capabilityApi: { major: 1, minor: 302 },
          builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
          id: "ruleset-amends",
          name: "Amends",
          version: "0.1.0",
          description: "Invocations.",
          engine: { min: "2.4.6", maxExclusive: "4.0.0" },
          kind: ["ruleset"],
          entrypoints: {},
          contributions: { assets: { paths: Object.keys(documents) } },
          files: Object.entries(documents).map(([path, text]) => ({
            path,
            bytes: Buffer.byteLength(text),
            sha256: createHash("sha256").update(text).digest("hex"),
          })),
          permissions: [],
          restartRequired: false,
        };
        const result = readRulesetPackageFile({
          format: "marinara-ruleset",
          version: 1,
          manifest: declared,
          files: Object.fromEntries(
            Object.entries(documents).map(([path, text]) => [path, Buffer.from(text).toString("base64")]),
          ),
        });
        assert.equal(result.ok, !fault, JSON.stringify(result));
        const input = {
          rulesetId: `local/${doc.id}`,
          version: doc.version,
          sourceKind: "local" as const,
          definition: JSON.stringify(doc),
          catalogs: files,
        };
        if (!fault) assert.equal((await storage.put(input)).status, "added");
        else {
          if (!result.ok) assert.match(result.issues.join("; "), /Unknown entry "spells\/eldritch-blast"/);
          await assert.rejects(storage.put(input), /Unknown entry "spells\/eldritch-blast"/);
        }
      }
    } finally {
      await closeDB();
    }
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
      "A ruleset with entries that change another entry each time it is used requires schemaVersion 2 and capabilityApi 1.302 or newer";
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "invocations", label: "Invocations", feeds: ["features"], entries: [agonizing] });
    assert.equal(getCapabilityPackageInstallIssue(manifest(301) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(302) as never, doc), gate);
  }

  console.log(
    "Amends: Agonizing Blast, Eldritch Spear and Repelling Blast on eldritch blast, alone and stacked, the push offered or left off; refusals; gated at 1.302.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
