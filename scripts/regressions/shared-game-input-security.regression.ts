import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseRulesetDefinition, rowsFromCatalogEntry } from "../../packages/shared/src/schemas/ruleset.schema.js";
import { defaultRulesetSheetBuild } from "../../packages/shared/src/features/rulesets/sheet-math.js";
import { renderRulesetSheetBlock } from "../../packages/shared/src/features/rulesets/sheet-prompt.js";
import { placeSpawns } from "../../packages/shared/src/features/tactical-combat/grid-gen.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

test("a sheet's scaled-spend hint accepts pool identifiers without changing ordinary prose", () => {
  const parsed = parseRulesetDefinition(
    JSON.parse(readFileSync(new URL("../../docs/examples/rulesets/gravewatch.json", import.meta.url), "utf8")),
  );
  assert.ok(parsed.ok);
  const definition = parsed.definition;
  const charm = definition.catalogs
    ?.find((catalog) => catalog.id === "charms")
    ?.entries?.find((entry) => entry.id === "steady-hand");
  assert.ok(charm?.mechanics?.perCostStep);
  const build = defaultRulesetSheetBuild(definition);
  build.lists.charms = rowsFromCatalogEntry("charms", charm).map((entry) => entry.row);
  const render = (pool: string) =>
    renderRulesetSheetBlock(definition, { name: `Bram "the Quiet" & friends`, build }, null, {
      charms: [{ ...charm, mechanics: { ...charm.mechanics!, cost: [{ pool, amount: 1 }] } }],
    });
  assert.match(render("resolve"), /stronger use: spend="resolve:N"/);
  assert.match(render("resolve"), /^Bram "the Quiet" & friends\n/);
  // Imported catalogs already validate IDs; direct shared-library callers must not
  // turn malformed data into another quoted command attribute either.
  for (const pool of ['resolve" who="another', "resolve&other", "<resolve>", "resolve\n", "a".repeat(41)]) {
    assert.doesNotMatch(render(pool), /stronger use: spend=/, JSON.stringify(pool));
  }
});

test("grid placement never coerces a coordinate into a prototype property", () => {
  const grid: TacticalGrid = {
    width: 4,
    height: 4,
    tiles: Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => "wall")),
  };
  // Exercise the public library API with a hostile coordinate accessor. App-created
  // units use plain integer coordinates; this hardens callers outside that path.
  const coordinate = {
    [Symbol.toPrimitive](hint: string) {
      return hint === "string" ? "__proto__" : 0;
    },
  };
  const unit = {
    side: "party" as const,
    x: 0,
    get y(): number {
      return coordinate as unknown as number;
    },
    set y(_value: number) {},
  };
  const original = Object.getOwnPropertyDescriptor(Array.prototype, "0");
  const originalLength = Array.prototype.length;
  let after: PropertyDescriptor | undefined;
  try {
    placeSpawns(grid, [unit]);
    after = Object.getOwnPropertyDescriptor(Array.prototype, "0");
  } finally {
    if (original) Object.defineProperty(Array.prototype, "0", original);
    else Reflect.deleteProperty(Array.prototype, "0");
    Array.prototype.length = originalLength;
  }
  assert.deepEqual(after, original, "coordinate coercion must never write to Array.prototype");
});
