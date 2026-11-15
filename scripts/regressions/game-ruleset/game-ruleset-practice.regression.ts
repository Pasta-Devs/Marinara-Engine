/**
 * A practice meter on skills (Capability API 1.829): `sheet.progress` keeps 0 to 99 toward each
 * trained skill's next rank, moved by `op="practice"`.
 *
 * What is pinned here:
 *   - Practice adds up and stops at 99; `to` sets it; back at 0 the entry goes away.
 *   - Only a trained skill below the top rank, outside an excepted section, on a sheet with the meter,
 *     takes it.
 *   - A rank change by `op="advance"` starts that skill over; the same rank written again keeps it.
 *   - The command tag reads and writes back; the Game Master's sheet block shows the percent.
 *   - A packaged ruleset with the meter declares 1.829.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetSheetOp,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  parseSheetCommandTagBody,
  renderRulesetSheetBlock,
  serializeSheetCommandTag,
  type RulesetDefinition,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-practice-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const { getCapabilityPackageInstallIssue } =
    await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");
  const emberText = readFileSync(
    fileURLToPath(new URL("../../../docs/examples/rulesets/ember-roads.json", import.meta.url)),
    "utf8",
  );
  /** Ember Roads with a practice meter, rank-ups allowed, and Sway kept in a section with no meter. */
  const doc = (edit?: (doc: Record<string, any>) => void) => {
    const document = JSON.parse(emberText) as Record<string, any>;
    document.sheet.progress = { except: ["knacks"] };
    document.sheet.advancement = { ...(document.sheet.advancement ?? {}), skills: true };
    document.sheet.skills.find((skill: { id: string }) => skill.id === "sway").section = "knacks";
    edit?.(document);
    return document;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(doc());
  const build = {
    ...defaultRulesetSheetBuild(definition),
    skills: { scrap: "trained", tinker: "expert", sway: "trained" },
  };
  const practice = (stored: unknown, op: Record<string, unknown>, on = definition) =>
    applyRulesetSheetOp(on, build, stored, { op: "practice", ...op } as any);

  // Practice adds up, stops at 99, is set by `to`, and goes away at 0.
  const first = practice({}, { skill: "Scrap", by: 60 });
  assert.ok(first.ok && first.live.progress?.scrap === 60, JSON.stringify(first));
  const capped = practice(first.ok ? first.live : {}, { skill: "scrap", by: 75 });
  assert.ok(capped.ok && capped.live.progress?.scrap === 99, "practice stops at 99");
  const zeroed = practice(capped.ok ? capped.live : {}, { skill: "Scrap", to: 0 });
  assert.ok(zeroed.ok && zeroed.live.progress === undefined, "back at 0 the entry goes away");

  // Who takes it.
  for (const [skill, why] of [
    ["Sneak", "an untrained skill opens by a rank change"],
    ["Tinker", "the top rank has no next one"],
    ["Sway", "a section with no meter takes no practice"],
  ] as const) {
    const refused = practice({}, { skill, by: 5 });
    assert.ok(!refused.ok && refused.reason === "not-allowed", why);
  }
  const plain = parsed(doc((document) => delete document.sheet.progress));
  const noMeter = practice({}, { skill: "Scrap", by: 5 }, plain);
  assert.ok(!noMeter.ok && noMeter.reason === "not-allowed", "a ruleset without the meter refuses practice");
  const unknown = practice({}, { skill: "Juggling", by: 5 });
  assert.ok(!unknown.ok && unknown.reason === "unknown-skill");

  // A rank change starts it over; the same rank written again keeps it.
  const live = capped.ok ? capped.live : {};
  const same = applyRulesetSheetOp(definition, build, live, { op: "advance", skill: "Scrap", tier: "trained" });
  assert.ok(same.ok && same.live.progress?.scrap === 99, "the same rank written again keeps the practice");
  const up = applyRulesetSheetOp(definition, build, live, { op: "advance", skill: "Scrap", tier: "expert" });
  assert.ok(up.ok && up.live.progress?.scrap === undefined, "a rank-up starts it over");

  // A rank the ruleset no longer has reads as untrained, so it takes no practice.
  const stale = applyRulesetSheetOp(
    definition,
    { ...build, skills: { ...build.skills, scrap: "gone" } },
    {},
    {
      op: "practice",
      skill: "Scrap",
      by: 5,
    },
  );
  assert.ok(!stale.ok && stale.reason === "not-allowed", JSON.stringify(stale));

  // A skill a sheet migration renames keeps its practice, as it keeps its rank.
  const renamed = parsed(
    doc((document) => {
      document.sheet.version = 2;
      document.sheet.migrations = [{ from: 1, steps: [{ rename: "skill", from: "scrap", to: "salvage" }] }];
      document.sheet.skills.find((skill: { id: string }) => skill.id === "scrap").id = "salvage";
    }),
  );
  const moved = applyRulesetSheetOp(
    renamed,
    { ...build, skills: { salvage: "trained", tinker: "expert", sway: "trained" } },
    { progress: { scrap: 60 } },
    { op: "practice", skill: "salvage", by: 5 },
  );
  assert.ok(moved.ok && moved.live.progress?.salvage === 65, JSON.stringify(moved));
  assert.ok(moved.ok && moved.live.progress?.scrap === undefined, "the old id goes");
  // A reset under the new id stays reset: the old id's practice does not come back on the next read.
  const renamedBuild = { ...build, skills: { salvage: "trained", tinker: "expert", sway: "trained" } };
  const reset = applyRulesetSheetOp(
    renamed,
    renamedBuild,
    { progress: { scrap: 60 } },
    {
      op: "practice",
      skill: "salvage",
      to: 0,
    },
  );
  assert.ok(reset.ok && reset.live.progress === undefined, JSON.stringify(reset));
  const after = applyRulesetSheetOp(renamed, renamedBuild, reset.ok ? reset.live : {}, {
    op: "practice",
    skill: "salvage",
    by: 5,
  });
  assert.ok(after.ok && after.live.progress?.salvage === 5, JSON.stringify(after));
  // The Game Master reads the moved practice, not 0.
  assert.match(
    renderRulesetSheetBlock(renamed, { name: "Blake", build: renamedBuild }, { progress: { scrap: 60 } }),
    /Scrap [+-]?\d+ \(60%\)/,
  );

  // A section the meter leaves out must be one the sheet declares.
  const typo = parseRulesetDefinition(doc((document) => (document.sheet.progress = { except: ["knack"] })));
  assert.ok(!typo.ok && typo.issues.some((entry) => /Unknown section "knack"/.test(entry)), JSON.stringify(typo));

  // The command tag, both ways.
  const tag = parseSheetCommandTagBody('who="Blake" op="practice" skill="Scrap" by="5"');
  assert.deepEqual(tag.op, { op: "practice", skill: "Scrap", by: 5 });
  assert.deepEqual(
    parseSheetCommandTagBody('who="Blake" op="practice" skill="Scrap" to="65%"').op,
    { op: "practice", skill: "Scrap", to: 65 },
    "a percent sign is the number it says",
  );
  assert.deepEqual(parseSheetCommandTagBody('who="Blake" op="practice" skill="Scrap" to="40"').op, {
    op: "practice",
    skill: "Scrap",
    to: 40,
  });
  assert.equal(
    parseSheetCommandTagBody('who="Blake" op="practice" skill="Scrap" to="40" by="5"').op,
    null,
    "to and by together are not one command",
  );
  assert.equal(
    serializeSheetCommandTag({ who: "Blake", op: tag.op, raw: "" }, { ok: true, now: "Scrap 65%" }),
    `[sheet: who="Blake" op="practice" skill="Scrap" by="5" result="ok" now="Scrap 65%"]`,
  );

  // The Game Master reads it.
  const block = renderRulesetSheetBlock(definition, { name: "Blake", build }, { progress: { scrap: 60 } });
  assert.match(block, /Scrap [+-]?\d+ \(60%\)/, block);
  assert.doesNotMatch(block, /Tinker [+-]?\d+ \(/, "no meter at the top rank");
  assert.doesNotMatch(block, /Sway [+-]?\d+ \(/, "no meter where none is kept");

  // The Game Master is told a rank-up starts practice over only where op="advance" can change a rank.
  const { buildRulesetRoleplayReminder } = await import("../../../packages/server/src/services/game/gm-prompts.js");
  const practiceLine = (ruleset: RulesetDefinition) =>
    buildRulesetRoleplayReminder({ ruleset, sheetBlocks: ["Blake: Scrap +2 (60%)"] })
      .split("\n")
      .find((line) => line.includes('op="practice"'));
  assert.match(
    practiceLine(definition) ?? "",
    /op="advance", never practice, and it starts that skill's practice over at 0%/,
  );
  for (const advancement of [undefined, { saves: true }]) {
    const noRankUps = parsed(
      doc((document) => {
        if (advancement) document.sheet.advancement = advancement;
        else delete document.sheet.advancement;
      }),
    );
    const line = practiceLine(noRankUps);
    assert.match(line ?? "", /stops at 99%/, "the meter is still taught");
    assert.doesNotMatch(line ?? "", /over at 0%|op="advance"/, "no reset a ruleset without skill advances can make");
  }

  // The package gate.
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "ruleset-practice",
    name: "Practice",
    version: "0.1.0",
    description: "A packaged ruleset whose skills keep practice.",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  assert.match(getCapabilityPackageInstallIssue(manifest(828) as any, doc()) ?? "", /capabilityApi 1\.829/);
  assert.equal(getCapabilityPackageInstallIssue(manifest(829) as any, doc()), null);
} finally {
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  rmSync(dataDir, { recursive: true, force: true });
}
