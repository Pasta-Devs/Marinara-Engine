/**
 * Charges and uses that come back after a wait counted in game time (Capability API 1.556).
 *
 *   - A figurine's one charge back 2 days after it ran out, and no rest bringing it back sooner.
 *   - Wings of Flying's 1d12 hours, rolled as the wait starts.
 *   - A further use's own uses waiting a day; a count given back meanwhile waits no more.
 *   - The wait kept on a saved stack; refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeGameInventoryStacks,
  parseRulesetDefinition,
  passRulesetItemTime,
  rechargeRulesetItems,
  rulesetItemBook,
  supportedCapabilityApi,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-item-waits-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 556);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const heal = { kind: "heal", targets: "self", budget: "action", amount: { dice: "1d4" } };
  const document = (edit: (entries: Record<string, any>[]) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = { categories: [{ id: "wondrous", label: "Wondrous" }] };
    const entries: Record<string, any>[] = [
      {
        id: "figurine",
        label: "Figurine",
        item: {
          category: "wondrous",
          stack: 1,
          charges: { max: 1, recharge: { rests: [], amount: "max", after: { days: 2 } } },
          use: { ...heal, label: "Wake", charges: 1 },
        },
      },
      {
        id: "wings",
        label: "Wings",
        item: {
          category: "wondrous",
          stack: 1,
          charges: { max: 1, recharge: { rests: [], amount: "max", after: { hours: { dice: "1d12" } } } },
          use: { ...heal, label: "Spread", charges: 1 },
        },
      },
      {
        id: "staff",
        label: "Staff",
        item: {
          category: "wondrous",
          stack: 1,
          charges: { max: 3, recharge: { rests: ["long"], amount: "max" } },
          use: { ...heal, label: "Mend", charges: 1 },
          moreUses: [
            {
              label: "Gust",
              use: { ...heal },
              uses: { max: 2, recharge: { rests: ["long"], amount: { flat: 1 }, after: { days: 1 } } },
            },
          ],
        },
      },
    ];
    edit(entries);
    doc.catalogs.push({ id: "gear", label: "Gear", holds: "items", entries });
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
  const book = rulesetItemBook(
    definition,
    Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.entries && catalog.holds === "items" ? [[catalog.id, catalog.entries as RulesetCatalogEntry[]]] : [],
      ),
    ),
  );
  const pass = (stacks: GameInventoryStack[], minutes: number, roll = (sides: number) => Math.min(sides, 5)) =>
    passRulesetItemTime({ definition, itemOf: book.itemOf, stacks, minutes, roll });
  const day = 24 * 60;

  // ── A figurine: back 2 days after it ran out, and never on a rest ──
  {
    const bag: GameInventoryStack[] = [{ id: "f", name: "Figurine", item: "gear/figurine", quantity: 1, charges: 0 }];
    const rested = rechargeRulesetItems({
      definition,
      itemOf: book.itemOf,
      stacks: bag,
      holder: undefined,
      rest: "long",
      roll: () => 1,
    });
    assert.deepEqual(rested.recharged, [], "no rest brings it back");
    const first = pass(bag, day);
    assert.equal(first.changed, true);
    assert.deepEqual(first.stacks[0]!.waits, { charges: { waited: day, for: 2 * day } });
    assert.equal(first.stacks[0]!.charges, 0);
    // Saved and read back, the wait is kept.
    assert.deepEqual(normalizeGameInventoryStacks(JSON.parse(JSON.stringify(first.stacks)))[0]!.waits, {
      charges: { waited: day, for: 2 * day },
    });
    const second = pass(first.stacks, day);
    assert.deepEqual(second.recharged, [{ item: "Figurine", now: 1, max: 1 }]);
    assert.equal(second.stacks[0]!.charges, undefined, "full again");
    assert.equal(second.stacks[0]!.waits, undefined);
    // A full one waits for nothing.
    const full = pass(second.stacks, day);
    assert.equal(full.changed, false);
  }

  // ── Wings: 1d12 hours, rolled as the wait starts ──
  {
    const bag: GameInventoryStack[] = [{ id: "w", name: "Wings", item: "gear/wings", quantity: 1, charges: 0 }];
    const started = pass(bag, 60, () => 7);
    assert.deepEqual(started.stacks[0]!.waits, { charges: { waited: 60, for: 7 * 60 } });
    const later = pass(started.stacks, 5 * 60, () => 1);
    assert.deepEqual(later.stacks[0]!.waits, { charges: { waited: 6 * 60, for: 7 * 60 } }, "the roll is kept");
    const back = pass(later.stacks, 60);
    assert.deepEqual(back.recharged, [{ item: "Wings", now: 1, max: 1 }]);
  }

  // ── A further use's own uses: a day, one back; given back meanwhile, no wait ──
  {
    const bag: GameInventoryStack[] = [
      { id: "s", name: "Staff", item: "gear/staff", quantity: 1, usesLeft: { "1": 0 } },
    ];
    const waiting = pass(bag, 600);
    assert.deepEqual(waiting.stacks[0]!.waits, { "1": { waited: 600, for: day } });
    const back = pass(waiting.stacks, day);
    assert.deepEqual(back.recharged, [{ item: "Staff: Gust", now: 1, max: 2, uses: true }]);
    assert.deepEqual(back.stacks[0]!.usesLeft, { "1": 1 });
    // Its rest still works, and a count given back waits no more.
    const rested = rechargeRulesetItems({
      definition,
      itemOf: book.itemOf,
      stacks: waiting.stacks,
      holder: undefined,
      rest: "long",
      roll: () => 1,
    });
    assert.deepEqual(rested.stacks[0]!.usesLeft, { "1": 1 });
    const settled = pass(rested.stacks, 60);
    assert.equal(settled.stacks[0]!.waits, undefined);
  }

  // ── Refusals ──
  refused(
    document((entries) => {
      entries[0]!.item.charges.recharge = { rests: [], amount: "max" };
    }),
    /Say when they come back/,
  );
  refused(
    document((entries) => {
      entries[0]!.item.charges.recharge.after = {};
    }),
    /Say how long it waits/,
  );
  refused(
    document((entries) => {
      entries[0]!.item.charges.recharge.after = { hours: { flat: 0 } };
    }),
    /A wait in hours/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose items' charges or uses come back after a wait in game time (recharge.after) requires schemaVersion 2 and capabilityApi 1.556 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(555) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(556) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(555) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Item waits: a figurine back 2 days after it ran out and never on a rest; Wings of Flying's rolled 1d12 hours kept; a further use's own uses back after a day, or sooner on its rest; gated at 1.556.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
