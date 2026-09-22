#!/usr/bin/env node
// Writes docs/extending/ruleset.schema.json from the shared zod schema, so a ruleset author's
// editor can flag a misspelled key or a wrong type while they type. `--check` fails when the
// committed file is stale. Needs the shared package built first (`pnpm build:shared`).
//
// The JSON Schema is editor help, not the validator: the cross-reference checks (a skill naming an
// ability that exists) only run in `parseRulesetDefinition`, which the import uses.
import { readFile, writeFile } from "node:fs/promises";
import { zodToJsonSchema } from "zod-to-json-schema";
import { RULESET_SCALED_MAX_COLUMNS, rulesetDefinitionSchema } from "../packages/shared/dist/index.js";

const target = new URL("../docs/extending/ruleset.schema.json", import.meta.url);

// The Engine drops `$comment` from every object and `$schema` from the root before it validates
// (`stripRulesetComments`), so the editor schema has to allow them or it would flag a valid file.
function allowAnnotations(node, isRoot = true) {
  if (Array.isArray(node)) {
    for (const entry of node) allowAnnotations(entry, false);
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    // `properties` maps author-chosen names to schemas; its own keys are not schema keywords.
    if (key === "properties") for (const child of Object.values(value)) allowAnnotations(child, false);
    else allowAnnotations(value, false);
  }
  if (node.type === "object") {
    // Any value, not just text: the Engine drops the key whatever it holds.
    node.properties = { ...node.properties, $comment: {} };
    if (isRoot) node.properties.$schema = {};
  }
}

// "At least one of these keys" as its OWN constraint, kept in `allOf` rather than folded into the
// node's `anyOf`. A node may already carry an `anyOf` from the zod schema, and adding branches to
// that one would WIDEN it: a document matching an existing branch would satisfy the whole `anyOf`
// without carrying any of these keys at all.
function requireAnyOf(node, keys) {
  node.allOf = [...(node.allOf ?? []), { anyOf: keys.map((key) => ({ required: [key] })) }];
}

// A catalog carries its entries inline or names a package asset, never both. The zod schema says
// so in a refinement, which a JSON Schema generator cannot see, so the editor is told here.
function requireOneCatalogSource(node) {
  if (Array.isArray(node)) return node.forEach(requireOneCatalogSource);
  if (!node || typeof node !== "object") return;
  Object.values(node).forEach(requireOneCatalogSource);
  if (node.type === "object" && node.properties?.feeds && node.properties.entries && node.properties.asset) {
    node.oneOf = [{ required: ["entries"] }, { required: ["asset"] }];
  }
}

// An entry writes rows onto a sheet or it is a creature, never both and never neither, and a
// creature says what it does in its own actions rather than in `mechanics`. Refinements again, so
// the editor is told here. The node is found by its shape: `rows` beside `creature`.
function requireOneEntryContent(node) {
  if (Array.isArray(node)) return node.forEach(requireOneEntryContent);
  if (!node || typeof node !== "object") return;
  Object.values(node).forEach(requireOneEntryContent);
  if (node.type === "object" && node.properties?.rows && node.properties.creature) {
    node.oneOf = [{ required: ["rows"] }, { required: ["creature"], not: { required: ["mechanics"] } }];
  }
}

// And the header the entries sit in: a catalog of rows names the lists it feeds, a catalog of
// creatures names none. Found by its shape: `holds` beside `feeds`.
function requireCatalogFeeds(node) {
  if (Array.isArray(node)) return node.forEach(requireCatalogFeeds);
  if (!node || typeof node !== "object") return;
  Object.values(node).forEach(requireCatalogFeeds);
  if (node.type === "object" && node.properties?.holds && node.properties.feeds) {
    node.if = { properties: { holds: { const: "creatures" } }, required: ["holds"] };
    node.then = { not: { required: ["feeds"] } };
    node.else = { required: ["feeds"] };
  }
}

// How many columns of a row may be scaled is another refinement the generator cannot see. The node
// is found by its shape (a map whose values carry `from`), so the editor counts what the Engine counts.
function boundScaledColumns(node) {
  if (Array.isArray(node)) return node.forEach(boundScaledColumns);
  if (!node || typeof node !== "object") return;
  Object.values(node).forEach(boundScaledColumns);
  const column = node.additionalProperties;
  if (node.type === "object" && column?.properties?.from && column.properties.table) {
    // `$comment` is allowed in every object and the Engine drops it before it counts, so a map
    // that carries one may hold one key more.
    node.if = { required: ["$comment"] };
    node.then = { minProperties: 2, maxProperties: RULESET_SCALED_MAX_COLUMNS + 1 };
    node.else = { minProperties: 1, maxProperties: RULESET_SCALED_MAX_COLUMNS };
  }
}

// A layer's `hide` compares a catalog filter exactly one way. That too is a refinement, so the
// editor is told here. The node is found by its shape: `filter` beside the four comparisons.
function requireOneHideComparison(node) {
  if (Array.isArray(node)) return node.forEach(requireOneHideComparison);
  if (!node || typeof node !== "object") return;
  Object.values(node).forEach(requireOneHideComparison);
  const keys = ["above", "below", "equals", "notIn"];
  if (node.type === "object" && node.properties?.filter && keys.every((key) => node.properties[key])) {
    node.oneOf = keys.map((key) => ({ required: [key] }));
  }
}

// A condition that lasts until a save needs the save that ends it, or nothing would ever take it
// off. That is a refinement too, so the editor is told here. The node is found by its shape.
function requireSaveEndsUntilSave(node) {
  if (Array.isArray(node)) return node.forEach(requireSaveEndsUntilSave);
  if (!node || typeof node !== "object") return;
  Object.values(node).forEach(requireSaveEndsUntilSave);
  if (node.type === "object" && node.properties?.condition && node.properties.duration && node.properties.saveEnds) {
    node.if = { properties: { duration: { const: "until-save" } }, required: ["duration"] };
    node.then = { required: ["saveEnds"] };
  }
}

// Only a reaction that waits for something ABOUT to happen may call it off: a moment that has
// already happened cannot be undone. That is a refinement as well, so the editor is told here. The
// node is found by its shape, which is the three keys a named moment carries and nothing else.
function cancelOnlyWhenAimed(node) {
  if (Array.isArray(node)) return node.forEach(cancelOnlyWhenAimed);
  if (!node || typeof node !== "object") return;
  Object.values(node).forEach(cancelOnlyWhenAimed);
  const keys = Object.keys(node.properties ?? {}).filter((key) => key !== "$comment");
  if (node.type === "object" && keys.length === 3 && ["on", "at", "cancels"].every((key) => keys.includes(key))) {
    node.if = { required: ["cancels"] };
    node.then = { properties: { on: { const: "aimed" } }, required: ["on"] };
  }
}

// A creature action's damage, and every clause beside it, names dice, a flat amount, or both: an
// empty one is refused by the Engine, and that too is a refinement. The node is found by its shape:
// `dice`, `flat` and `type`, and nothing but the keys a blow or a clause carries.
const DAMAGE_KEYS = ["dice", "flat", "type", "plus", "save"];
function requireDamageAmount(node) {
  if (Array.isArray(node)) return node.forEach(requireDamageAmount);
  if (!node || typeof node !== "object") return;
  Object.values(node).forEach(requireDamageAmount);
  const keys = Object.keys(node.properties ?? {}).filter((key) => key !== "$comment");
  const damageShaped =
    ["dice", "flat", "type"].every((key) => keys.includes(key)) && keys.every((key) => DAMAGE_KEYS.includes(key));
  // A rider's amount carries no type of its own, so its keys alone look like every other pair of
  // dice and flat in the file, a creature's health included. The schema marks it by name instead.
  const riderAmountShaped = node.description === "rider-amount";
  if (node.type === "object" && (damageShaped || riderAmountShaped)) {
    requireAnyOf(node, ["dice", "flat"]);
  }
}

// Everything a combat block measures in cells needs the block to say what a cell is worth. The
// Engine refuses one without it, which is a cross-check the generator cannot see, so the editor is
// told here. The node is found by its shape: `distance` beside `opportunity` and `attacks`.
function requireDistanceForMeasured(node) {
  if (Array.isArray(node)) return node.forEach(requireDistanceForMeasured);
  if (!node || typeof node !== "object") return;
  Object.values(node).forEach(requireDistanceForMeasured);
  const properties = node.properties;
  if (node.type !== "object" || !properties?.distance || !properties.opportunity || !properties.attacks) return;
  node.dependencies = {
    ...(node.dependencies ?? {}),
    ranged: ["distance"],
    cover: ["distance"],
    opportunity: ["distance"],
  };
  // A weapon list that gives its rows a reach or a range is measured in cells too.
  node.allOf = [
    ...(node.allOf ?? []),
    {
      if: {
        required: ["attacks"],
        properties: { attacks: { contains: { anyOf: [{ required: ["reach"] }, { required: ["range"] }] } } },
      },
      then: { required: ["distance"] },
    },
  ];
}

/**
 * Two rules a catalog entry's mechanics keep that the shape alone does not say: an entry of the
 * kind `rider` has to carry the `rider` that describes it, and something `free` spends no budget so
 * it names none. Zod refuses both at import; an author's editor should refuse them while typing.
 */
function requireMechanicsPairs(node) {
  if (Array.isArray(node)) return node.forEach(requireMechanicsPairs);
  if (!node || typeof node !== "object") return;
  Object.values(node).forEach(requireMechanicsPairs);
  const properties = node.properties;
  if (node.type !== "object" || !properties?.kind || !properties.rider || !properties.free) return;
  node.allOf = [
    ...(node.allOf ?? []),
    { if: { properties: { kind: { const: "rider" } }, required: ["kind"] }, then: { required: ["rider"] } },
    { not: { required: ["free", "budget"] } },
  ];
}

// A track's `kinds` say what a mark may BE, so they need the `levels` a mark sits on, and the other
// way round a track with levels needs kinds. That is a cross-check the generator cannot see, so the
// editor is told here. The node is found by its shape: `levels` beside `kinds` and `min`.
function requireLevelsWithKinds(node) {
  if (Array.isArray(node)) return node.forEach(requireLevelsWithKinds);
  if (!node || typeof node !== "object") return;
  Object.values(node).forEach(requireLevelsWithKinds);
  const properties = node.properties;
  if (node.type !== "object" || !properties?.levels || !properties.kinds || !properties.min) return;
  node.dependencies = { ...(node.dependencies ?? {}), kinds: ["levels"], levels: ["kinds"] };
}

/**
 * A purchase on a check buys successes or dice, so an entry that names neither buys nothing. Zod
 * refuses that at import; the published schema has to say it too, or an author's editor calls a
 * useless entry valid.
 */
function requireSpendBuysSomething(node) {
  if (Array.isArray(node)) return node.forEach(requireSpendBuysSomething);
  if (!node || typeof node !== "object") return;
  Object.values(node).forEach(requireSpendBuysSomething);
  const properties = node.properties;
  if (node.type !== "object" || !properties?.pool || !properties.perCheck) return;
  if (!properties.successes && !properties.dice) return;
  requireAnyOf(node, ["successes", "dice"]);
}

/**
 * And the other half of that: a charm's `check` throws dice again, adds dice, adds successes or
 * moves the target, so one that says none of them spends a resource for nothing. Zod refuses it at
 * import; without this the editor calls the empty object valid. Found by its shape: all four keys.
 */
function requireCheckEffectDoesSomething(node) {
  if (Array.isArray(node)) return node.forEach(requireCheckEffectDoesSomething);
  if (!node || typeof node !== "object") return;
  Object.values(node).forEach(requireCheckEffectDoesSomething);
  const keys = ["reroll", "dice", "successes", "threshold"];
  if (node.type !== "object" || !keys.every((key) => node.properties?.[key])) return;
  requireAnyOf(node, keys);
}

/**
 * Only a pool counts successes, so only a `dice-pool` resolution may declare a `spend`. Zod refuses
 * it on a sum at import; the published schema must not offer it there.
 */
function spendOnlyOnAPool(node) {
  if (Array.isArray(node)) return node.forEach(spendOnlyOnAPool);
  if (!node || typeof node !== "object") return;
  Object.values(node).forEach(spendOnlyOnAPool);
  const properties = node.properties;
  if (node.type !== "object" || !properties?.spend || !properties.kind) return;
  const kind = properties.kind.const ?? properties.kind.enum?.[0];
  if (kind !== undefined && kind !== "dice-pool") delete properties.spend;
}

const schema = zodToJsonSchema(rulesetDefinitionSchema, { $refStrategy: "none", target: "jsonSchema7" });
requireLevelsWithKinds(schema);
requireSpendBuysSomething(schema);
requireCheckEffectDoesSomething(schema);
spendOnlyOnAPool(schema);
requireMechanicsPairs(schema);
requireOneCatalogSource(schema);
requireOneEntryContent(schema);
requireCatalogFeeds(schema);
requireSaveEndsUntilSave(schema);
cancelOnlyWhenAimed(schema);
requireDamageAmount(schema);
requireDistanceForMeasured(schema);
boundScaledColumns(schema);
requireOneHideComparison(schema);
allowAnnotations(schema);
const text = `${JSON.stringify(
  {
    $schema: schema.$schema,
    title: "Marinara Engine Game Mode ruleset",
    description:
      "Generated by scripts/generate-ruleset-schema.mjs from packages/shared/src/schemas/ruleset.schema.ts. Do not edit by hand.",
    ...schema,
  },
  null,
  2,
)}\n`;

if (process.argv.includes("--check")) {
  // A Windows checkout may hold the file with CRLF line endings; that is not staleness.
  const current = (await readFile(target, "utf8").catch(() => "")).replaceAll("\r\n", "\n");
  if (current !== text) {
    console.error("docs/extending/ruleset.schema.json is stale. Run: pnpm ruleset:schema");
    process.exit(1);
  }
  console.log("docs/extending/ruleset.schema.json is up to date.");
} else {
  await writeFile(target, text);
  console.log("Wrote docs/extending/ruleset.schema.json");
}
