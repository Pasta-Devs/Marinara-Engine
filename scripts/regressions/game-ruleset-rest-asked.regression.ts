/**
 * A rest the player asks for by name is named in the turn's reminder (laptop playtest 2026-10-25: a
 * long rest the player asked for was told with no rest command, and nothing came back).
 *
 *   - `rulesetRestAskedFor` finds the rest by its label or its id, the longest name when several
 *     match, and never a bare "rest".
 *   - The turn part of the reminder tells the Game Master to write its command; the stable part
 *     never does.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRulesetDefinition } from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-rest-asked-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { buildGmFormatReminder, rulesetRestAskedFor } =
  await import("../../packages/server/src/services/game/gm-prompts.js");

try {
  const doc = JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
      "utf8",
    ),
  );
  const parsed = parseRulesetDefinition(doc);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition = parsed.definition;
  const long = definition.rests.find((rest) => rest.id === "long")!.label;
  const short = definition.rests.find((rest) => rest.id === "short")!.label;

  assert.equal(rulesetRestAskedFor(definition, "We make camp and take a LONG REST."), long);
  assert.equal(rulesetRestAskedFor(definition, "A short rest first, then on."), short);
  assert.equal(rulesetRestAskedFor(definition, "The rest of us keep watch."), undefined);
  assert.equal(rulesetRestAskedFor(definition, "I rest my hand on the hilt."), undefined);
  assert.equal(rulesetRestAskedFor(definition, "longest rest"), undefined, "a word inside another is not it");
  // A rest named only "Rest" is never looked for.
  assert.equal(
    rulesetRestAskedFor({ rests: [{ ...definition.rests[0]!, id: "rest", label: "Rest" }] }, "We rest."),
    undefined,
  );

  const reminder = (part: "turn" | "stable", playerAsksRest?: string) =>
    buildGmFormatReminder({
      hasSceneModel: true,
      ruleset: definition,
      part,
      ...(playerAsksRest ? { playerAsksRest } : {}),
    } as never);
  const asked = reminder("turn", long);
  assert.match(asked, /THE PLAYER ASKS TO REST:/);
  assert.ok(asked.includes(`[sheet: who="party" op="rest" rest="${long}"]`));
  assert.doesNotMatch(reminder("turn"), /ASKS TO REST/);
  assert.doesNotMatch(reminder("stable", long), /ASKS TO REST/);

  console.log(
    "Rest asked: a rest the player names is found by label or id, never a bare rest or a word inside another, and the turn's reminder tells the Game Master to write its command.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
