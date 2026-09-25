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
import {
  RULESET_CREATURE_PLAIN_NEEDS,
  RULESET_CREATURE_SHEET_REPLACES,
  RULESET_RESOLUTION_KINDS,
  parseRulesetDefinition,
} from "../../packages/shared/src/index.js";

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
  type Constrained = { allOf?: Array<{ anyOf?: unknown }> };
  const damageNodes: Constrained[] = [];
  // And a charm's `check`, which is the same rule one step along: an effect that throws no dice
  // again, adds no dice, adds no successes and moves no target spends a resource for nothing.
  const checkNodes: Constrained[] = [];
  const checkKeys = ["reroll", "dice", "successes", "threshold"];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    const object = node as { properties?: Record<string, unknown> } & Constrained;
    const keys = Object.keys(object.properties ?? {}).filter((key) => key !== "$comment");
    // A blow and every clause beside it: the three an amount always carries, plus the two a blow or
    // a clause may carry and nothing else.
    const damageShaped =
      ["dice", "flat", "type"].every((key) => keys.includes(key)) &&
      keys.every((key) => ["dice", "flat", "type", "plus", "save"].includes(key));
    if (damageShaped) damageNodes.push(object);
    if (checkKeys.every((key) => keys.includes(key))) checkNodes.push(object);
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
  // Each of these is carried in `allOf` rather than merged into a node's own `anyOf`: a node that
  // already had one would be WIDENED by the extra branches instead of narrowed, and the editor
  // would call an empty object valid.
  assert.ok(damageNodes.length > 0, "the schema describes a creature action's damage");
  for (const node of damageNodes) {
    assert.ok(
      node.allOf?.some(
        (rule) => JSON.stringify(rule.anyOf) === JSON.stringify([{ required: ["dice"] }, { required: ["flat"] }]),
      ),
      "and asks for dice or a flat amount",
    );
  }
  assert.ok(checkNodes.length > 0, "the schema describes what an entry does to a check");
  for (const node of checkNodes) {
    assert.ok(
      node.allOf?.some(
        (rule) => JSON.stringify(rule.anyOf) === JSON.stringify(checkKeys.map((key) => ({ required: [key] }))),
      ),
      "and asks that it do one of the four things it can do",
    );
  }
}

console.info("game ruleset JSON Schema regression passed.");

// ── The rule that only a moment about to happen may be called off, in the published schema too ──
{
  // A refinement the generator cannot see, patched in by hand, which means a test rather than
  // trust: an editor that accepted `cancels` on a moment that has already happened would send an
  // author to the Engine to find out, which is exactly what the published file exists to prevent.
  const schema = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../docs/extending/ruleset.schema.json", import.meta.url)), "utf8"),
  ) as Record<string, never>;
  const path = ["catalogs", "items", "properties", "entries", "items", "properties", "mechanics"];
  let node: Record<string, never> = (schema.properties as Record<string, never>).catalogs;
  for (const step of path.slice(1)) node = node[step];
  const reaction = (node.properties as Record<string, never>).reaction;
  const named = (reaction.anyOf as Array<Record<string, never>>).find((member) => !!member.properties?.cancels);
  assert.ok(named, "the published schema has lost the moment a reaction names");
  assert.deepEqual(named.if, { required: ["cancels"] });
  assert.deepEqual(named.then, { properties: { on: { const: "aimed" } }, required: ["on"] });
}

// ── One source for each of a creature's numbers, in the published schema too ──
{
  // A creature with a sheet takes its health, defense and the rest from it; one without a sheet has
  // to give them. The editor has to say both halves, or an author finds out from the Engine.
  const schema = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../docs/extending/ruleset.schema.json", import.meta.url)), "utf8"),
  ) as Record<string, never>;
  const path = ["catalogs", "items", "properties", "entries", "items", "properties", "creature"];
  let node: Record<string, never> = (schema.properties as Record<string, never>).catalogs;
  for (const step of path.slice(1)) node = node[step];
  assert.ok((node.properties as Record<string, unknown>).sheet, "the published schema has lost a creature's sheet");
  const rule = (node.allOf as Array<Record<string, never>> | undefined)?.find(
    (member) => JSON.stringify(member.if) === JSON.stringify({ required: ["sheet"] }),
  );
  assert.ok(rule, "the published schema no longer says where a creature's numbers come from");
  // Read off the shared lists the Engine's own refinement uses, so the three never drift apart.
  assert.deepEqual(rule.then, {
    not: { anyOf: RULESET_CREATURE_SHEET_REPLACES.map((key) => ({ required: [key] })) },
  });
  assert.deepEqual(rule.else, {
    required: [...RULESET_CREATURE_PLAIN_NEEDS, "actions"],
    properties: { actions: { minItems: 1 } },
  });
  // And the three numbers are not required outright, or a creature with a sheet could never be valid.
  assert.deepEqual(node.required, ["tier"]);
}
