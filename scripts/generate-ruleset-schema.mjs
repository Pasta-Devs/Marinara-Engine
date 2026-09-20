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

// A creature action's damage names dice, a flat amount, or both: an empty one is refused by the
// Engine, and that too is a refinement. The node is found by its shape: `dice`, `flat` and `type`.
function requireDamageAmount(node) {
  if (Array.isArray(node)) return node.forEach(requireDamageAmount);
  if (!node || typeof node !== "object") return;
  Object.values(node).forEach(requireDamageAmount);
  const keys = Object.keys(node.properties ?? {});
  if (node.type === "object" && keys.length === 3 && ["dice", "flat", "type"].every((key) => keys.includes(key))) {
    node.anyOf = [{ required: ["dice"] }, { required: ["flat"] }];
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

const schema = zodToJsonSchema(rulesetDefinitionSchema, { $refStrategy: "none", target: "jsonSchema7" });
requireOneCatalogSource(schema);
requireOneEntryContent(schema);
requireCatalogFeeds(schema);
requireSaveEndsUntilSave(schema);
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
