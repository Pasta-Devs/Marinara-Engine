/**
 * The published JSON Schema for ruleset authors (`docs/extending/ruleset.schema.json`) is generated
 * from the shared zod schema. This pins that the committed file is current, so an editor never
 * flags a key the Engine accepts or misses one it refuses. Needs the shared package built, which
 * `pnpm regression:node` does first.
 *
 * It also pins that every shipped example is a file the schema describes: each one imports cleanly,
 * and the published schema carries a member for each resolution kind they are written in. A schema
 * that is current but has quietly lost a kind would put a red squiggle under a correct file, which
 * is exactly the help an author would learn to ignore.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { RULESET_RESOLUTION_KINDS, parseRulesetDefinition } from "../../packages/shared/src/index.js";

const script = fileURLToPath(new URL("../generate-ruleset-schema.mjs", import.meta.url));
const result = spawnSync(process.execPath, [script, "--check"], { encoding: "utf8" });
assert.equal(
  result.status,
  0,
  `${result.error ?? ""}${result.stdout ?? ""}${result.stderr ?? ""}\nRun: pnpm ruleset:schema`,
);

// ── Every shipped example is a file this schema describes ──
{
  const read = (path: string) => JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8"));

  for (const path of [
    "../../docs/development/ruleset-5e-2014.example.json",
    "../../docs/examples/rulesets/ember-roads.json",
    "../../docs/examples/rulesets/gravewatch.json",
  ]) {
    const parsed = parseRulesetDefinition(read(path));
    assert.ok(parsed.ok, `${path} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
  }

  // One example per resolution kind, so neither is left without a file an author can copy.
  const kinds = ["../../docs/examples/rulesets/ember-roads.json", "../../docs/examples/rulesets/gravewatch.json"].map(
    (path) => read(path).resolution.kind,
  );
  assert.deepEqual(kinds, ["dice-sum", "dice-pool"]);

  // And the published schema offers a member for every kind the Engine knows, so an editor can
  // read a pool ruleset as well as it reads a summed one.
  const schema = read("../../docs/extending/ruleset.schema.json");
  const members = (schema.properties?.resolution?.anyOf ?? []) as Array<{ properties?: { kind?: { const?: string } } }>;
  assert.deepEqual(
    members.map((member) => member.properties?.kind?.const),
    [...RULESET_RESOLUTION_KINDS],
  );

  // A refinement the generator cannot see has to be told to the editor by hand. A creature action's
  // damage is one: the Engine refuses an empty one, so the published schema must as well.
  const damageNodes: Array<{ anyOf?: unknown }> = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    const object = node as { properties?: Record<string, unknown>; anyOf?: unknown };
    const keys = Object.keys(object.properties ?? {}).filter((key) => key !== "$comment");
    if (keys.length === 3 && ["dice", "flat", "type"].every((key) => keys.includes(key))) damageNodes.push(object);
    Object.values(node).forEach(walk);
  };
  // The same for what a combat block measures in cells: the Engine refuses any of it in a block
  // that does not say what a cell is worth, so the published schema asks for `distance` beside it.
  const combatNode = schema.properties?.combat as {
    dependencies?: Record<string, string[]>;
    allOf?: Array<{ then?: { required?: string[] } }>;
  };
  for (const key of ["ranged", "cover", "opportunity"]) {
    assert.deepEqual(combatNode.dependencies?.[key], ["distance"], `"${key}" asks the editor for a cell size`);
  }
  assert.ok(
    combatNode.allOf?.some((rule) => rule.then?.required?.includes("distance")),
    "and so does a weapon list that gives its rows a reach or a range",
  );

  walk(schema);
  assert.ok(damageNodes.length > 0, "the schema describes a creature action's damage");
  for (const node of damageNodes) {
    assert.deepEqual(
      node.anyOf,
      [{ required: ["dice"] }, { required: ["flat"] }],
      "and asks for dice or a flat amount",
    );
  }
}

console.info("game ruleset JSON Schema regression passed.");
