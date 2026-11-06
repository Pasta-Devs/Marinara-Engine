/**
 * Charges found at a rolled count (Capability API 1.573): a Rod of Absorption's 1d10.
 *
 *   - `charges.rolled`: each stack starts with that many, rolled once and the same at every reading
 *     after, never past `max`; a count the stack keeps wins over it.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseRulesetDefinition,
  rulesetChargesStart,
  rulesetItemBook,
  rulesetSheetItems,
  supportedCapabilityApi,
  type GameInventoryStack,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-item-rolled-charges-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 573);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (charges: Record<string, unknown> = { max: 10, rolled: "1d10" }) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs.push({
      id: "gear",
      label: "Gear",
      holds: "items",
      entries: [
        {
          id: "rod",
          label: "Rod",
          item: {
            category: "gear",
            stack: 1,
            use: { label: "Zap", kind: "heal", budget: "action", amount: { dice: "1d4" }, charges: 1 },
            charges,
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
  const definition = parsed(document());
  const book = rulesetItemBook(definition, { gear: definition.catalogs!.find((one) => one.id === "gear")!.entries! });

  // ── Rolled once for each stack, within the dice, and the same again ──
  const counts = Array.from({ length: 40 }, (_, at) => rulesetChargesStart({ rolled: "1d10" }, 10, `st-${at}`));
  assert.ok(
    counts.every((one) => one >= 1 && one <= 10),
    JSON.stringify(counts),
  );
  assert.ok(new Set(counts).size > 3, "different stacks come up differently");
  assert.equal(rulesetChargesStart({ rolled: "1d10" }, 10, "st-7"), counts[7]);
  assert.equal(rulesetChargesStart({}, 10, "st-1"), 10, "nothing rolled, full");
  assert.ok(
    Array.from({ length: 30 }, (_, at) => rulesetChargesStart({ rolled: "1d6-1" }, 5, `s${at}`)).some((n) => n === 0),
    "a 1d6 - 1 can come up empty",
  );

  // ── What a sheet reads: the stack's rolled count, or what it keeps ──
  const stacks: GameInventoryStack[] = [
    { id: "st-7", name: "Rod", item: "gear/rod", quantity: 1 },
    { id: "st-8", name: "Rod", item: "gear/rod", quantity: 1, charges: 9 },
  ];
  const held = rulesetSheetItems(book, stacks, undefined);
  assert.equal(held[0]!.charges, counts[7], "found holding its roll");
  assert.equal(held[1]!.charges, 9, "a kept count wins");

  // ── Refusals ──
  const refused = parseRulesetDefinition(document({ max: 10, rolled: "2d10" }));
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.match(refused.issues.join("; "), /A rolled count never comes up past its max/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an item found holding a rolled count of charges (charges.rolled) requires schemaVersion 2 and capabilityApi 1.573 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(572) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(573) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(572) as never, document({ max: 10 })), gate);
  }

  console.log(
    "Rolled charges: each stack is found holding its own roll, never past max, a kept count wins; gated at 1.573.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
