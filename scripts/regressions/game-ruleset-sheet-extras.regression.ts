/**
 * Small sheet and prompt items from the ruleset gap report (issue #6657). Capability API 1.37.
 *
 * What is pinned here:
 *   - A plain track's `max` may be a value the sheet works out: the live state holds each character's
 *     own top, never below the floor, and a wound track's top is still its levels.
 *   - `hideWhen` on a plain track takes it off the sheet (and out of reach of the sheet command); a
 *     wound track may not be hidden.
 *   - `alwaysShow` prints a track in the sheet block at its default.
 *   - A summary list may be named by an enum column (by its label) and print up to three of its own
 *     columns after each name.
 *   - The reminder teaches the wound-track command and lists wound tracks apart from plain ones.
 *   - Every one of these needs Capability API 1.37 to install.
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
  readRulesetLive,
  renderRulesetSheetBlock,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../packages/shared/src/index.js";

// Server modules read DATA_DIR once at load, so they are imported only after it points at scratch.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-sheet-extras-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

const [{ buildGmFormatReminder }, { getCapabilityPackageInstallIssue }] = await Promise.all([
  import("../../packages/server/src/services/game/gm-prompts.js"),
  import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
]);

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const emberText = read("../../docs/examples/rulesets/ember-roads.json");
const gravewatchText = read("../../docs/examples/rulesets/gravewatch.json");

const parse = (text: string, edit: (doc: Record<string, any>) => void = () => {}) => {
  const doc = JSON.parse(text) as Record<string, any>;
  edit(doc);
  return parseRulesetDefinition(doc);
};
const accepted = (text: string, edit: (doc: Record<string, any>) => void = () => {}): RulesetDefinition => {
  const parsed = parse(text, edit);
  assert.ok(parsed.ok, `it should import: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
  return parsed.definition;
};
const refused = (text: string, edit: (doc: Record<string, any>) => void, pattern: RegExp, why: string) => {
  const parsed = parse(text, edit);
  assert.ok(!parsed.ok, `${why}: it should have been refused`);
  assert.ok(
    parsed.issues.some((issue) => pattern.test(issue)),
    `${why}\n  got: ${JSON.stringify(parsed.issues)}`,
  );
};
const heatOf = (doc: Record<string, any>) => doc.sheet.live.tracks.find((track: any) => track.id === "heat");
const withBuild = (definition: RulesetDefinition, edit: (build: RulesetSheetBuild) => void = () => {}) => {
  const build = structuredClone(defaultRulesetSheetBuild(definition));
  edit(build);
  return build;
};

try {
  const ember = accepted(emberText);
  const gravewatch = accepted(gravewatchText);

  // ── A track whose top the sheet sets ──
  {
    const rated = accepted(emberText, (doc) => (heatOf(doc).max = { field: "toughness" }));
    const tough = withBuild(rated, (build) => (build.fields = { ...build.fields, toughness: 3 }));
    const heat = () =>
      readRulesetLive(rated, tough, { tracks: { heat: 9 } }).tracks.find((track) => track.id === "heat")!;
    assert.deepEqual([heat().max, heat().value], [3, 3], "each character's own top, and the value held under it");
    const frail = withBuild(rated, (build) => (build.fields = { ...build.fields, toughness: -4 }));
    assert.equal(
      readRulesetLive(rated, frail, {}).tracks.find((track) => track.id === "heat")!.max,
      0,
      "a top below the floor is the floor, not a track that runs backwards",
    );
    // The sheet command holds a move inside the same top.
    const moved = applyRulesetSheetOp(rated, tough, {}, { op: "track", track: "heat", by: 10 });
    assert.ok(moved.ok);
    assert.equal(readRulesetLive(rated, tough, moved.live).tracks.find((track) => track.id === "heat")!.value, 3);

    refused(emberText, (doc) => (heatOf(doc).max = { field: "nope" }), /tracks\.0\.max/, "a reference to nothing");
    refused(
      emberText,
      (doc) => {
        heatOf(doc).max = { field: "toughness" };
        heatOf(doc).default = -1;
      },
      /default is below min/,
      "a default below the floor",
    );
    refused(
      gravewatchText,
      (doc) => (doc.sheet.live.tracks[0].max = { const: 4 }),
      /A wound track holds one mark per level, so its max is 4/,
      "a wound track's top is its levels",
    );
  }

  // ── A track a field takes off the sheet ──
  {
    const hideable = accepted(emberText, (doc) => (heatOf(doc).hideWhen = { field: "calling", equals: "Hermit" }));
    const hermit = withBuild(hideable, (build) => (build.fields = { ...build.fields, calling: "Hermit" }));
    const trader = withBuild(hideable, (build) => (build.fields = { ...build.fields, calling: "Trader" }));
    assert.equal(readRulesetLive(hideable, hermit, {}).tracks.length, 0, "hidden, like a hidden pool");
    assert.equal(readRulesetLive(hideable, trader, {}).tracks.length, 1);
    assert.equal(applyRulesetSheetOp(hideable, hermit, {}, { op: "track", track: "heat", by: 1 }).ok, false);
    assert.doesNotMatch(
      renderRulesetSheetBlock(
        accepted(emberText, (doc) => {
          heatOf(doc).hideWhen = { field: "calling", equals: "Hermit" };
          heatOf(doc).alwaysShow = true;
        }),
        { name: "Wren", build: hermit },
        {},
      ),
      /Heat/,
      "and out of the sheet block, however it asks to be shown",
    );
    refused(
      emberText,
      (doc) => (heatOf(doc).hideWhen = { field: "nope", equals: 1 }),
      /tracks\.0/,
      "a field the sheet does not have",
    );
    refused(
      gravewatchText,
      (doc) => (doc.sheet.live.tracks[0].hideWhen = { field: "post", equals: "x" }),
      /A wound track is read by rolls and fights, so it cannot be hidden/,
      "rolls and fights read a wound track whatever the sheet shows",
    );
  }

  // ── A track shown at its default ──
  {
    const build = withBuild(ember);
    assert.match(
      renderRulesetSheetBlock(ember, { name: "Wren", build }, {}),
      /Heat 0/,
      "Ember Roads always shows heat",
    );
    const quiet = accepted(emberText, (doc) => delete heatOf(doc).alwaysShow);
    assert.doesNotMatch(
      renderRulesetSheetBlock(quiet, { name: "Wren", build }, {}),
      /Heat/,
      "without it, default is silence",
    );
    const shown = accepted(gravewatchText, (doc) => (doc.sheet.live.tracks[0].alwaysShow = true));
    assert.match(
      renderRulesetSheetBlock(shown, { name: "Bram", build: withBuild(shown) }, {}),
      /Harm 0\/4/,
      "an unmarked wound track too",
    );
    assert.doesNotMatch(
      renderRulesetSheetBlock(gravewatch, { name: "Bram", build: withBuild(gravewatch) }, {}),
      /Harm/,
    );
  }

  // ── A summary list's columns, and a name out of an enum ──
  {
    const geared = withBuild(ember, (build) => {
      build.lists = {
        ...build.lists,
        gear: [{ name: "Crowbar", damage: "1d6", swing: "brawn" }, { name: "Lantern" }],
      };
    });
    assert.match(
      renderRulesetSheetBlock(ember, { name: "Wren", build: geared }, {}),
      /Gear: Crowbar 1d6, Lantern/,
      "a column after the name, and nothing where the row has none",
    );

    // An enum names the row by its label; a boolean column prints its label when it is set.
    const tricks = accepted(emberText, (doc) => {
      const list = doc.sheet.lists.find((entry: any) => entry.id === "tricks");
      list.columns.push({ id: "ready", label: "ready", type: "boolean" });
      const recharge = list.columns.find((column: any) => column.id === "recharge");
      recharge.valueLabels = Object.fromEntries(recharge.values.map((value: string) => [value, `On ${value}`]));
      doc.gm.sheetSummary.lists.push({ list: "tricks", nameColumn: "recharge", columns: ["uses", "ready"] });
    });
    const tricksList = tricks.sheet.lists.find((entry) => entry.id === "tricks")!;
    const firstValue = (tricksList.columns.find((column) => column.id === "recharge") as { values: string[] })
      .values[0]!;
    const block = renderRulesetSheetBlock(
      tricks,
      {
        name: "Wren",
        build: withBuild(tricks, (build) => {
          build.lists = { ...build.lists, tricks: [{ name: "Smoke", uses: 2, recharge: firstValue, ready: true }] };
        }),
      },
      {},
    );
    assert.match(block, new RegExp(`Limited tricks: On ${firstValue} 2 ready`));

    // A cell the row leaves out reads as its column's default, for a flag and for an enum name alike.
    const defaulted = accepted(emberText, (doc) => {
      const list = doc.sheet.lists.find((entry: any) => entry.id === "tricks");
      list.columns.push({ id: "ready", label: "ready", type: "boolean", default: true });
      doc.gm.sheetSummary.lists.push({ list: "tricks", nameColumn: "recharge", columns: ["ready"] });
    });
    assert.match(
      renderRulesetSheetBlock(
        defaulted,
        {
          name: "Wren",
          build: withBuild(defaulted, (build) => (build.lists = { ...build.lists, tricks: [{ name: "Smoke" }] })),
        },
        {},
      ),
      /Limited tricks: At camp ready/,
      "the default name and the default flag",
    );

    refused(
      emberText,
      (doc) => (doc.gm.sheetSummary.lists[0].columns = ["nope"]),
      /sheetSummary\.lists\.0\.columns\.0: Unknown column "nope"/,
      "a column the list does not have",
    );
    refused(
      emberText,
      (doc) => (doc.gm.sheetSummary.lists[0].columns = ["damage", "harm", "swing", "notes"]),
      /sheetSummary\.lists\.0\.columns/,
      "three at most",
    );
    refused(
      emberText,
      (doc) => (doc.gm.sheetSummary.lists = [{ list: "tricks", nameColumn: "uses" }]),
      /Must name a text or enum column/,
      "a number names nothing",
    );
  }

  // ── The reminder teaches the wound-track command ──
  {
    const base = { turnNumber: 2, gameActiveState: "exploration" as const, partyNames: [], playerName: "Mira" };
    const sheets = (definition: RulesetDefinition) =>
      buildGmFormatReminder({ ...base, ruleset: definition, rulesetSheetBlocks: ["[Mira]\nsheet"] });
    const wounded = sheets(gravewatch);
    assert.match(
      wounded,
      /- \[sheet: who="Name" op="damage" track="Track" kind="Kind" amount="N"\] - marks harm of that kind on a wound track; a negative amount heals it\./,
    );
    assert.match(wounded, /Wound tracks: Harm \(Scuffed to Down; knock, tear\)\./);
    assert.doesNotMatch(wounded, /^Tracks:/m, 'Gravewatch has no plain track for op="track" to move');

    const plain = sheets(ember);
    assert.match(plain, /Tracks: Heat \(0 to 5\)\./);
    assert.doesNotMatch(plain, /op="damage" track=/);
    assert.doesNotMatch(plain, /Wound tracks:/);
    const rated = sheets(accepted(emberText, (doc) => (heatOf(doc).max = { field: "toughness" })));
    assert.match(rated, /Tracks: Heat \(0 to the character's own maximum\)\./);
  }

  // ── Every one of these needs 1.37 to install ──
  {
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-test",
      name: "Test",
      version: "0.1.0",
      description: "A packaged ruleset.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const issue =
      /tracks read their maximum off the sheet, hide or always show, or whose sheet summary lists show columns or are named by an enum, requires schemaVersion 2 and capabilityApi 1\.37 or newer/;
    const track = (extra: Record<string, unknown>) => ({
      sheet: { live: { tracks: [{ id: "t", label: "T", min: 0, max: 3, ...extra }] } },
    });
    const documents = [
      track({ max: { field: "rating" } }),
      track({ hideWhen: { field: "f", equals: 1 } }),
      track({ alwaysShow: true }),
      {
        sheet: { lists: [] },
        gm: { sheetSummary: { lists: [{ list: "gear", nameColumn: "name", columns: ["damage"] }] } },
      },
      {
        sheet: { lists: [{ id: "gear", columns: [{ id: "kind", type: "enum", values: ["a"] }] }] },
        gm: { sheetSummary: { lists: [{ list: "gear", nameColumn: "kind" }] } },
      },
    ];
    for (const document of documents) {
      assert.match(
        getCapabilityPackageInstallIssue(manifest(36) as never, document) ?? "",
        issue,
        JSON.stringify(document),
      );
      assert.equal(getCapabilityPackageInstallIssue(manifest(37) as never, document), null);
    }
    // What every file before 1.37 wrote needs nothing new: a number for a top, a text column for a name.
    assert.equal(getCapabilityPackageInstallIssue(manifest(20) as never, track({})), null);
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(20) as never, {
        sheet: { lists: [{ id: "gear", columns: [{ id: "name", type: "text" }] }] },
        gm: { sheetSummary: { lists: [{ list: "gear", nameColumn: "name" }] } },
      }),
      null,
    );
  }

  console.info("game ruleset sheet-extras regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
}
