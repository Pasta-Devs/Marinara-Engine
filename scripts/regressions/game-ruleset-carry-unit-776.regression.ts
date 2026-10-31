/**
 * What a ruleset's weights are counted in (Capability API 1.791), and the playtest's polish around
 * carrying of 2026-10-23:
 *
 *   - `items.carry.unit` ("lb") is said after a weight: the inventory's load, the starting gear
 *     picker's weights, and each kit option's own weight.
 *   - The picker says what a kit weighs even where nobody has a limit.
 *   - Past the most they can carry (Free edit's heavy starting gear), the inventory and the sheet say
 *     "Over limit"; encumbered, the sheet says so too.
 *   - Refused where too long, and gated at 1.791.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  gameInventoryBearerStatus,
  gameInventoryOverLimit,
  gameInventoryWeightText,
  parseRulesetDefinition,
  rulesetItemBook,
  supportedCapabilityApi,
  type GameInventoryStack,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-carry-unit-776-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

try {
  assert.ok(supportedCapabilityApi.minor >= 791);
  const document = (unit?: string) => {
    const doc = JSON.parse(read("../../docs/development/ruleset-5e-2014.example.json")) as Record<string, any>;
    doc.sheet.fields.push({ id: "carry_max", label: "Carry", type: "number", min: 0, max: 9999, default: 150 });
    doc.items = {
      categories: [{ id: "gear", label: "Gear" }],
      stats: [{ id: "weight", label: "Weight", type: "number", min: 0, max: 9999, integer: false }],
      carry: {
        stat: "weight",
        encumberedAbove: { const: 75 },
        limit: { field: "carry_max" },
        ...(unit !== undefined ? { unit } : {}),
      },
    };
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [{ id: "anvil", label: "Anvil", item: { category: "gear", stats: { weight: 100 } } }],
    });
    return doc;
  };

  // ── The key ──
  const parsed = parseRulesetDefinition(document("lb"));
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition = parsed.definition;
  assert.equal(definition.items?.carry?.unit, "lb");
  const book = rulesetItemBook(
    definition,
    Object.fromEntries((definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []])),
  );
  assert.equal(book.weightUnit, "lb");
  const plain = parseRulesetDefinition(document());
  assert.ok(plain.ok);
  assert.equal(rulesetItemBook(plain.definition, {}).weightUnit, undefined, "no unit, none said");
  assert.equal(parseRulesetDefinition(document("pounds and more")).ok, false, "at most 12 letters");

  // ── Said after a weight ──
  assert.equal(gameInventoryWeightText(12.345, "lb"), "12.35 lb");
  assert.equal(gameInventoryWeightText(0.25), "0.25");

  // ── Over limit ──
  const stacks: GameInventoryStack[] = [{ id: "a", name: "Anvil", item: "kit/anvil", quantity: 2 }];
  const status = gameInventoryBearerStatus(stacks, undefined, book);
  assert.equal(status.load, 200);
  assert.equal(status.limit, 150);
  assert.ok(status.encumbered);
  assert.ok(gameInventoryOverLimit(status));
  assert.ok(!gameInventoryOverLimit({ load: 150, limit: 150 }), "at the limit is not past it");
  assert.ok(!gameInventoryOverLimit({ load: 900 }), "no limit, never over it");

  // ── Where it is shown ──
  const picker = read("../../packages/client/src/components/game/StartingGearPicker.tsx");
  assert.match(picker, /gameInventoryWeightText\(value, book\.weightUnit\)/u);
  assert.match(picker, /weightText\(linesWeight\(option\.lines\)\)/u, "each option's own weight");
  assert.match(picker, /"game\.ruleset\.startingGear\.weighs"/u, "a kit's weight with nobody limited");
  const inventory = read("../../packages/client/src/components/game/GameInventory.tsx");
  assert.match(inventory, /gameInventoryOverLimit\(status\) && /u);
  assert.match(inventory, /unit=\{itemBook\?\.weightUnit\}/u);
  const surface = read("../../packages/client/src/components/game/GameSurface.tsx");
  assert.match(surface, /over: gameInventoryOverLimit\(bearer\)/u);
  const sheet = read("../../packages/client/src/components/game/GameRulesetSheet.tsx");
  assert.match(
    sheet,
    /carrying\.over \? "ui\.game\.gameinventory\.overLimit" : "ui\.game\.gameinventory\.encumbered"/u,
  );
  const messages = JSON.parse(read("../../packages/client/src/localization/locales/en.json")) as Record<string, string>;
  for (const key of ["game.ruleset.startingGear.weighs", "ui.game.gameinventory.overLimit"])
    assert.ok(messages[key], `en.json is missing ${key}`);

  // ── The install gate ──
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
    "A ruleset that names what its weights are counted in (items.carry.unit) requires schemaVersion 2 and capabilityApi 1.791 or newer";
  assert.equal(getCapabilityPackageInstallIssue(manifest(379) as never, document("lb")), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(791) as never, document("lb")), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(379) as never, document()), gate);

  console.log(
    "Carry unit 1.791: said after every weight, each kit option's weight, Over limit on the bag and the sheet, gated at 1.791.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
