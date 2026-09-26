/**
 * Wound tracks that are more than a fixed list (issue #6654): numbered boxes as many as the track's
 * own `max`, a penalty table over boxes filled or remaining, marks placed on the box a command
 * names, tracks that refuse a mark when full, healing one kind of harm, and levels a list adds per
 * character. Capability API 1.40.
 *
 * What is pinned here:
 *   - A box track: its length off the sheet, its numbered boxes, the penalty table read by filled or
 *     remaining, including with nothing marked.
 *   - `fill: "indexed"`: `box=` lands on that box or the next free one above; a command that cannot
 *     land whole lands not at all (`no-box`); marks never move, and a heal clears the highest of the
 *     lightest.
 *   - `onFull: "refuse"` on a sequential track: a full track refuses rather than upgrading.
 *   - A heal that names a kind clears only that kind (overflow first); one that names none clears the
 *     lightest. A rest step with `kind` does the same.
 *   - `extra`: each row inserts its levels after the last level at least as good, named after it
 *     when the penalty matches; a hidden list adds none; marks past a track that shrank are overflow.
 *   - The penalty reader, the Game Master's sheet line, the reminder, the `box=` attribute, a fight
 *     (a box per point of damage, and a hit no box can take puts the target down), every refusal at
 *     import, and the 1.40 install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  applyRulesetSheetOp,
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  parseSheetCommandTagBody,
  readRulesetLive,
  readRulesetWoundPenalty,
  renderRulesetSheetBlock,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  serializeSheetCommandTag,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetLiveState,
  type RulesetSheetBuild,
  type RulesetSheetOp,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-wound-boxes-"));
const previousDataDir = process.env.DATA_DIR;
process.env.DATA_DIR = dataDir;

try {
  const [{ buildGmFormatReminder }, { getCapabilityPackageInstallIssue }] = await Promise.all([
    import("../../packages/server/src/services/game/gm-prompts.js"),
    import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
  ]);

  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const gravewatchText = read("../../docs/examples/rulesets/gravewatch.json");
  const emberText = read("../../docs/examples/rulesets/ember-roads.json");

  const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
    const parsed = parseRulesetDefinition(document);
    assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
    return parsed.definition;
  };
  const variant = (base: string, edit: (doc: Record<string, any>) => void, what = "the variant") => {
    const doc = JSON.parse(base) as Record<string, any>;
    edit(doc);
    return parsedOrThrow(doc, what);
  };
  const refuses = (base: string, edit: (doc: Record<string, any>) => void, pattern: RegExp, why: string) => {
    const doc = JSON.parse(base) as Record<string, any>;
    edit(doc);
    const parsed = parseRulesetDefinition(doc);
    assert.ok(!parsed.ok, `${why}: it should have been refused`);
    assert.ok(
      parsed.issues.some((issue) => pattern.test(issue)),
      `${why}\n  got: ${JSON.stringify(parsed.issues)}`,
    );
  };
  const gravewatch = parsedOrThrow(JSON.parse(gravewatchText), "the pool example");
  const ember = parsedOrThrow(JSON.parse(emberText), "the 2d6 example");
  const harmOf = (doc: Record<string, any>) => doc.sheet.live.tracks.find((track: any) => track.id === "harm");
  const strainOf = (doc: Record<string, any>) => doc.sheet.live.tracks.find((track: any) => track.id === "strain");

  /** One op, which must land. */
  const apply = (
    definition: RulesetDefinition,
    build: RulesetSheetBuild,
    live: RulesetLiveState,
    op: RulesetSheetOp,
  ) => {
    const result = applyRulesetSheetOp(definition, build, live, op);
    assert.ok(result.ok, `expected ${JSON.stringify(op)} to land, got ${result.ok ? "" : result.reason}`);
    return result;
  };
  const woundOf = (definition: RulesetDefinition, build: RulesetSheetBuild, live: unknown, id: string) => {
    const wound = readRulesetLive(definition, build, live).tracks.find((track) => track.id === id)?.wound;
    assert.ok(wound, `${id} is a wound track`);
    return wound;
  };

  // ── Refused at import ──
  {
    refuses(
      emberText,
      (doc) => delete strainOf(doc).boxes,
      /kinds needs levels or boxes beside it: there is nothing to mark/,
      "kinds with nothing to mark",
    );
    refuses(
      emberText,
      (doc) => (strainOf(doc).levels = [{ label: "A", penalty: 0 }]),
      /A wound track has levels or boxes, not both/,
      "levels and boxes both",
    );
    refuses(
      emberText,
      (doc) => delete strainOf(doc).kinds,
      /A track with boxes needs kinds beside it/,
      "boxes of nothing",
    );
    refuses(
      emberText,
      (doc) => (doc.sheet.live.tracks[0].fill = "indexed"),
      /fill is for a wound track, which has levels or boxes/,
      "a plain track filled by box",
    );
    refuses(
      emberText,
      (doc) => delete strainOf(doc).onFull,
      /An indexed track refuses a mark it has no box for, so its onFull is "refuse"/,
      "an indexed track that would upgrade",
    );
    refuses(emberText, (doc) => (strainOf(doc).max = 65), /A box track has from 0 to 64 boxes/, "too many boxes");
    refuses(
      emberText,
      (doc) => (strainOf(doc).boxes.penalty.table = [[0, 1]]),
      /boxes\.penalty\.table\.0\.1: Number must be less than or equal to 0/,
      "a penalty that helps",
    );
    refuses(
      emberText,
      (doc) =>
        (strainOf(doc).boxes.penalty.table = [
          [1, 0],
          [1, -1],
        ]),
      /boxes\.penalty\.table\.1\.0: Step table thresholds must be strictly ascending/,
      "a table whose second step could never be read",
    );
    refuses(
      emberText,
      (doc) => (strainOf(doc).extra = { list: "gear", countColumn: "bulk", penaltyColumn: "bulk" }),
      /A box track's length is its max; extra levels are for named levels/,
      "extra levels on boxes",
    );
    refuses(
      gravewatchText,
      (doc) => (harmOf(doc).extra.list = "wards"),
      /Unknown list "wards"/,
      "extra levels from a list the sheet does not have",
    );
    refuses(
      gravewatchText,
      (doc) => (harmOf(doc).extra.countColumn = "name"),
      /Column "name" is not a number/,
      "a count that is not a number",
    );
    refuses(
      gravewatchText,
      (doc) => (doc.rests[1].restore[0].kind = "burn"),
      /"harm" declares no kind "burn"/,
      "a rest healing a kind the track does not have",
    );
    refuses(
      emberText,
      (doc) => (doc.rests[0].restore[2].kind = "strain"),
      /"heat" is not a wound track, so it has no kinds/,
      "a rest healing a kind of a plain track",
    );
    refuses(
      emberText,
      (doc) => (doc.rests[0].restore[0].kind = "strain"),
      /"kind" only narrows a track/,
      "a kind on a pool step",
    );
    // A box track reads its penalty, and may be what a fight's health is.
    variant(emberText, (doc) =>
      doc.sheet.derived.push({ id: "p", label: "P", op: "sum", of: [{ liveTrack: "strain", read: "penalty" }] }),
    );
    variant(emberText, (doc) => (doc.resolution.penaltyFrom = "strain"), "a box track's penalty on every roll");
  }

  // ── A box track: its length off the sheet, numbered boxes, the table ──
  const hearty = defaultRulesetSheetBuild(ember);
  hearty.abilities = { ...hearty.abilities, heart: 2 };
  {
    const fresh = woundOf(ember, hearty, {}, "strain");
    assert.deepEqual(
      fresh.levels.map((level) => [level.label, level.penalty]),
      [
        ["1", 0],
        ["2", 0],
        ["3", 0],
        ["4", -1],
      ],
      "two plus Heart 2 is four boxes; the last one marked leaves none clear",
    );
    assert.deepEqual(
      [fresh.numbered, fresh.indexed, fresh.refusesWhenFull, fresh.filled, fresh.lowest, fresh.penalty],
      [true, true, true, 0, -1, 0],
    );
    assert.equal(woundOf(ember, defaultRulesetSheetBuild(ember), {}, "strain").levels.length, 2, "Heart 0 is two");
    // A table read by boxes filled, and one that costs something with nothing marked at all.
    const byFilled = variant(
      emberText,
      (doc) =>
        (strainOf(doc).boxes.penalty = {
          by: "filled",
          table: [
            [0, 0],
            [2, -1],
            [4, -2],
          ],
        }),
    );
    const twoIn = apply(byFilled, hearty, {}, { op: "damage", track: "strain", kind: "strain", amount: 2 }).live;
    assert.equal(woundOf(byFilled, hearty, twoIn, "strain").penalty, -1);
    const costly = variant(
      emberText,
      (doc) =>
        (strainOf(doc).boxes.penalty.table = [
          [0, -2],
          [9, 0],
        ]),
    );
    assert.equal(woundOf(costly, hearty, {}, "strain").penalty, -2, "the table is read even with nothing marked");
  }

  // ── Indexed fill: the box a command names, or the next free one above ──
  {
    const hit = (live: RulesetLiveState, box: number, amount = 1) =>
      applyRulesetSheetOp(ember, hearty, live, { op: "damage", track: "strain", kind: "strain", amount, box });
    const three = hit({}, 3);
    assert.ok(three.ok);
    assert.equal(three.now, "Strain 1/4", "the box number is not said as a level name");
    assert.deepEqual(woundOf(ember, hearty, three.live, "strain").marks, ["", "", "strain"]);
    const again = hit(three.live, 3);
    assert.ok(again.ok);
    assert.deepEqual(
      woundOf(ember, hearty, again.live, "strain").marks,
      ["", "", "strain", "strain"],
      "box 3 taken, so 4",
    );
    const none = hit(again.live, 3);
    assert.deepEqual(none, { ok: false, reason: "no-box" }, "nothing free at 3 or above, though 1 and 2 are");
    // Whole or not at all: two marks from box 1 with only box 1 free lands neither.
    const threeFull = apply(ember, hearty, again.live, {
      op: "damage",
      track: "strain",
      kind: "strain",
      amount: 1,
      box: 2,
    }).live;
    assert.deepEqual(hit(threeFull, 1, 2), { ok: false, reason: "no-box" });
    const full = hit(threeFull, 1);
    assert.ok(full.ok);
    const wound = woundOf(ember, hearty, full.live, "strain");
    assert.deepEqual([wound.filled, wound.lowest, wound.penalty], [4, 3, -1]);
    assert.equal(readRulesetWoundPenalty(ember, hearty, full.live, "strain"), -1, "the penalty reader takes the build");
    // A heal clears the highest box among the lightest marks, and the others stay where they are.
    const healed = apply(ember, hearty, full.live, { op: "damage", track: "strain", kind: "strain", amount: -1 }).live;
    assert.deepEqual(woundOf(ember, hearty, healed, "strain").marks, ["strain", "strain", "strain"]);
    const holed = apply(ember, hearty, three.live, {
      op: "damage",
      track: "strain",
      kind: "strain",
      amount: 1,
      box: 1,
    }).live;
    assert.deepEqual(
      woundOf(
        ember,
        hearty,
        apply(ember, hearty, holed, { op: "damage", track: "strain", kind: "", amount: -1 }).live,
        "strain",
      ).marks,
      ["strain"],
      "box 3 clears first; box 1 stays on box 1",
    );
    // A box that is not a whole number from 1 up is refused, not guessed.
    for (const box of [0, 65, 1.5]) assert.deepEqual(hit({}, box), { ok: false, reason: "bad-amount" });
  }

  // ── A sequential track that refuses when full ──
  {
    const refusing = variant(gravewatchText, (doc) => (harmOf(doc).onFull = "refuse"));
    const build = defaultRulesetSheetBuild(refusing);
    const knocks = (live: RulesetLiveState, amount: number) =>
      applyRulesetSheetOp(refusing, build, live, { op: "damage", track: "harm", kind: "knock", amount });
    const two = apply(refusing, build, {}, { op: "damage", track: "harm", kind: "knock", amount: 2 }).live;
    assert.deepEqual(knocks(two, 3), { ok: false, reason: "no-box" }, "three marks with two boxes free land none");
    const full = apply(refusing, build, two, { op: "damage", track: "harm", kind: "tear", amount: 2 }).live;
    assert.deepEqual(knocks(full, 1), { ok: false, reason: "no-box" }, "and a full one never upgrades");
    assert.deepEqual(woundOf(refusing, build, full, "harm").marks, ["tear", "tear", "knock", "knock"]);
  }

  // ── A heal that names a kind, and a rest that does ──
  {
    const build = defaultRulesetSheetBuild(gravewatch);
    const mixed = apply(
      gravewatch,
      build,
      apply(gravewatch, build, {}, { op: "damage", track: "harm", kind: "tear", amount: 1 }).live,
      { op: "damage", track: "harm", kind: "knock", amount: 2 },
    ).live;
    assert.deepEqual(woundOf(gravewatch, build, mixed, "harm").marks, ["tear", "knock", "knock"]);
    const heal = (live: RulesetLiveState, kind: string) =>
      woundOf(
        gravewatch,
        build,
        apply(gravewatch, build, live, { op: "damage", track: "harm", kind, amount: -1 }).live,
        "harm",
      );
    assert.deepEqual(heal(mixed, "tear").marks, ["knock", "knock"], "a tear, though knocks are lighter");
    assert.deepEqual(heal(mixed, "knock").marks, ["tear", "knock"]);
    assert.deepEqual(heal(mixed, "").marks, ["tear", "knock"], "no kind: the lightest");
    assert.deepEqual(heal(mixed, "whatever").marks, ["tear", "knock"], "a kind the track does not know: the lightest");
    // Overflow still clears first, whatever kind is named.
    const spilled = apply(gravewatch, build, {}, { op: "damage", track: "harm", kind: "tear", amount: 5 }).live;
    const once = heal(spilled, "tear");
    assert.deepEqual([once.marks.length, once.overflow], [4, 0]);
    // A breather clears the knocks and leaves the tear; standing down clears everything.
    const rested = apply(gravewatch, build, mixed, { op: "rest", rest: "breather" });
    assert.deepEqual(woundOf(gravewatch, build, rested.live, "harm").marks, ["tear"]);
    assert.match(rested.now, /Harm 1\/4/);
    assert.equal(
      woundOf(gravewatch, build, apply(gravewatch, build, mixed, { op: "rest", rest: "vigil" }).live, "harm").filled,
      0,
    );
  }

  // ── Levels a list adds ──
  {
    const scarred = (rows: unknown[], definition = gravewatch) => {
      const build = defaultRulesetSheetBuild(definition);
      build.lists = { ...build.lists, scars: rows as never };
      return build;
    };
    const labels = (build: RulesetSheetBuild, definition = gravewatch) =>
      woundOf(definition, build, {}, "harm").levels.map((level) => `${level.label}:${level.penalty}`);
    assert.deepEqual(labels(scarred([{ name: "Old cut", levels: 2, penalty: -1 }])), [
      "Scuffed:0",
      "Winded:-1",
      "Winded:-1",
      "Winded:-1",
      "Bleeding:-3",
      "Down:-99",
    ]);
    assert.deepEqual(
      labels(scarred([{ name: "Burn", levels: 1, penalty: -2 }])),
      ["Scuffed:0", "Winded:-1", "-2:-2", "Bleeding:-3", "Down:-99"],
      "a penalty no level has is named by its number",
    );
    assert.deepEqual(
      labels(scarred([{ name: "Graze", levels: 1, penalty: 0 }, { name: "Scratch" }])).slice(0, 4),
      ["Scuffed:0", "Scuffed:0", "Winded:-1", "Winded:-1"],
      "rows in order; an empty cell is its column's default (one level at -1)",
    );
    assert.equal(labels(scarred([{ name: "Huge", levels: 99, penalty: -1 }])).length, 4 + 16, "at most 16 a row");
    // Three knocks on the longer track stop on a -1 level, not on Bleeding.
    const long = scarred([{ name: "Old cut", levels: 2, penalty: -1 }]);
    const three = apply(gravewatch, long, {}, { op: "damage", track: "harm", kind: "knock", amount: 3 }).live;
    assert.equal(readRulesetWoundPenalty(gravewatch, long, three, "harm"), -1);
    assert.equal(readRulesetWoundPenalty(gravewatch, defaultRulesetSheetBuild(gravewatch), three, "harm"), -3);
    // The row deleted: six marks on a track of four keep the two that no longer fit, as overflow.
    const six = apply(gravewatch, long, {}, { op: "damage", track: "harm", kind: "knock", amount: 6 }).live;
    const shrunk = woundOf(gravewatch, defaultRulesetSheetBuild(gravewatch), six, "harm");
    assert.deepEqual([shrunk.filled, shrunk.overflow], [4, 2], "harm is not undone by editing the sheet");
    // A list the sheet hides adds nothing.
    const hideable = variant(gravewatchText, (doc) => {
      doc.sheet.fields.push({ id: "fresh", label: "Fresh", type: "boolean", default: true });
      doc.sheet.lists.find((list: any) => list.id === "scars").hideWhen = { field: "fresh", equals: true };
    });
    assert.equal(labels(scarred([{ name: "Old cut", levels: 2, penalty: -1 }], hideable), hideable).length, 4);
  }

  // ── The Game Master's sheet line, the reminder, and the command ──
  {
    // One box marked, however far along, leaves three clear and costs nothing; all four cost -1. A
    // box's number is never said as if it were the name of a level.
    const line = (box: number, amount: number) =>
      renderRulesetSheetBlock(
        ember,
        { name: "Juno", build: hearty },
        apply(ember, hearty, {}, { op: "damage", track: "strain", kind: "strain", amount, box }).live,
      );
    assert.match(line(4, 1), /Strain 1\/4(,|\n|$)/);
    assert.match(line(1, 4), /Strain 4\/4 -1 to rolls/);
    const reminder = buildGmFormatReminder({
      turnNumber: 2,
      gameActiveState: "exploration",
      partyNames: [],
      playerName: "Juno",
      ruleset: ember,
      rulesetSheetBlocks: ["[Juno]\nsheet"],
    });
    assert.match(reminder, /On a track that fills by box, add box="N" for the box the hit lands on/);
    assert.match(reminder, /Wound tracks: Strain \(numbered boxes, fills by box, refuses a mark when full; strain\)\./);
    const gravewatchReminder = buildGmFormatReminder({
      turnNumber: 2,
      gameActiveState: "exploration",
      partyNames: [],
      playerName: "Bram",
      ruleset: gravewatch,
      rulesetSheetBlocks: ["[Bram]\nsheet"],
    });
    assert.doesNotMatch(gravewatchReminder, /box="N"/, "only where a track fills by box");

    const parsed = parseSheetCommandTagBody(' op="damage" track="Strain" kind="strain" amount="1" box="3"');
    assert.deepEqual(parsed.op, { op: "damage", track: "Strain", kind: "strain", amount: 1, box: 3 });
    assert.match(serializeSheetCommandTag({ op: parsed.op, raw: "" }, { ok: true, now: "Strain 1/4" }), / box="3"/);
    assert.equal(parseSheetCommandTagBody(' op="damage" track="Strain" kind="strain" amount="1" box="high"').op, null);
    // A heal may leave the kind out, and then clears the lightest; a mark may not.
    const anyHeal = parseSheetCommandTagBody(' op="damage" track="Harm" amount="-1"');
    assert.deepEqual(anyHeal.op, { op: "damage", track: "Harm", kind: "", amount: -1 });
    assert.doesNotMatch(serializeSheetCommandTag({ op: anyHeal.op, raw: "" }, { ok: true, now: "Harm 0/4" }), /kind=/);
    assert.equal(parseSheetCommandTagBody(' op="damage" track="Harm" amount="1"').op, null);
  }

  // ── A fight: a box per point of damage, and a hit no box can take ──
  {
    const fought = variant(emberText, (doc) => {
      delete doc.layers;
      doc.combat.health = { track: "strain" };
      doc.combat.damageTypes = ["cut", "burn", "crush", "coldfire", "rust"];
      doc.combat.damageKinds = { default: "strain", marks: "per-point" };
      for (const catalog of doc.catalogs ?? []) {
        for (const entry of catalog.entries ?? []) if (entry.mechanics?.temporary) delete entry.mechanics.temporary;
      }
    });
    const dice = (...faces: number[]): RulesetCombatRoller => {
      let index = 0;
      return () => faces[index++] ?? 1;
    };
    const juno = { id: "juno", name: "Juno", side: "party" as const, build: hearty, live: {}, catalogs: {} };
    // Pell carries the knack that mends, so the case can bring Juno back up.
    const knacks = (JSON.parse(emberText).catalogs ?? []).find((catalog: any) => catalog.id === "knacks");
    const lastEmber = knacks.entries.find((entry: any) => entry.id === "last-ember");
    const pellBuild = defaultRulesetSheetBuild(fought);
    pellBuild.lists = {
      ...pellBuild.lists,
      knacks: [{ name: "Last Ember", notes: "Mend", _catalog: "knacks/last-ember" }],
    };
    const pell = {
      id: "pell",
      name: "Pell",
      side: "party" as const,
      build: pellBuild,
      live: {},
      catalogs: { knacks: [lastEmber] },
    };
    const hound = {
      id: "ash",
      name: "Ash-hound",
      side: "enemy" as const,
      block: {
        health: 20,
        defense: 6,
        initiativeModifier: 1,
        actions: [
          { id: "claw", name: "Claw", budget: "act", toHit: 6, damage: { count: 1, sides: 6, flat: 0, type: "cut" } },
        ],
      },
    };
    let state: RulesetEncounterState = createRulesetEncounter({
      definition: fought,
      seed: 4242,
      combatants: [juno, pell, hound],
      roller: dice(1, 1, 1, 1, 6, 6),
    });
    assert.equal(state.order[0], "ash");
    const swing = (at: RulesetEncounterState, damage: number) => {
      const claw = rulesetCombatOptions(fought, at, "ash").find((option) => option.label === "Claw")!;
      return applyRulesetCombatChoice(
        fought,
        at,
        { actorId: "ash", optionId: claw.id, targetIds: ["juno"] },
        dice(6, 6, damage),
      );
    };
    const round = (at: RulesetEncounterState) => {
      let next = at;
      for (let guard = 0; guard < 8; guard++) {
        const actor = next.order[next.turn]!;
        next = applyRulesetCombatChoice(
          fought,
          next,
          { actorId: actor, optionId: "end-turn", targetIds: [] },
          dice(1, 1, 1, 1),
        ).state;
        if (next.order[next.turn] === "ash") return next;
      }
      return assert.fail("the turn never came back round to the hound");
    };
    const strainOn = (at: RulesetEncounterState) => {
      const sheet = rulesetCombatant(at, "juno")!.sheet!;
      return woundOf(fought, sheet.build, sheet.live, "strain");
    };
    // A blow of two parts names its box by the whole blow: 2 + 2 marks box 4 and nothing else.
    const twoPart = {
      ...hound,
      id: "twin",
      name: "Twin-hound",
      block: {
        ...hound.block,
        actions: [
          {
            ...hound.block.actions[0]!,
            damage: { count: 1, sides: 6, flat: 0, type: "cut", plus: [{ count: 1, sides: 6, flat: 0, type: "cut" }] },
          },
        ],
      },
    };
    const twin = createRulesetEncounter({
      definition: fought,
      seed: 4242,
      combatants: [juno, pell, twoPart],
      roller: dice(1, 1, 1, 1, 6, 6),
    });
    const bite = rulesetCombatOptions(fought, twin, "twin").find((option) => option.label === "Claw")!;
    const bitten = applyRulesetCombatChoice(
      fought,
      twin,
      { actorId: "twin", optionId: bite.id, targetIds: ["juno"] },
      dice(6, 6, 2, 2),
    );
    const bittenSheet = rulesetCombatant(bitten.state, "juno")!.sheet!;
    assert.deepEqual(woundOf(fought, bittenSheet.build, bittenSheet.live, "strain").marks, ["", "", "", "strain"]);

    state = swing(state, 2).state;
    assert.deepEqual(strainOn(state).marks, ["", "strain"], "two damage marks box 2");
    assert.deepEqual(rulesetCombatHealth(fought, fought.combat!, rulesetCombatant(state, "juno")!), {
      value: 3,
      max: 4,
      temp: 0,
    });
    state = swing(round(state), 4).state;
    assert.deepEqual(strainOn(state).marks, ["", "strain", "", "strain"]);
    assert.equal(rulesetCombatant(state, "juno")!.down, false, "still two boxes clear");
    const taken = swing(round(state), 4);
    assert.deepEqual(
      strainOn(taken.state).marks,
      ["", "strain", "", "strain"],
      "box 4 is taken and nothing is above it, though 1 and 3 are clear",
    );
    assert.equal(rulesetCombatant(taken.state, "juno")!.down, true, "a hit no box can take puts them down");
    assert.ok(taken.events.some((event) => event.type === "down"));
    // Down with boxes still clear: another blow lands on one but does not put her down twice.
    const again = swing(round(taken.state), 1);
    assert.deepEqual(strainOn(again.state).marks, ["strain", "strain", "", "strain"]);
    assert.equal(again.events.filter((event) => event.type === "down").length, 0, "already down");
    assert.equal(rulesetCombatant(again.state, "juno")!.down, true);
    // A mending clears a mark, and that brings her back, though her health was never zero.
    let mending = again.state;
    for (let guard = 0; guard < 8 && mending.order[mending.turn] !== "pell"; guard++) {
      const actor = mending.order[mending.turn]!;
      mending = applyRulesetCombatChoice(
        fought,
        mending,
        { actorId: actor, optionId: "end-turn", targetIds: [] },
        dice(1, 1, 1, 1),
      ).state;
    }
    const ember = rulesetCombatOptions(fought, mending, "pell").find((option) => option.label === "Last Ember");
    assert.ok(ember, "Pell can mend");
    const mended = applyRulesetCombatChoice(
      fought,
      mending,
      { actorId: "pell", optionId: ember.id, targetIds: ["juno"] },
      dice(3, 3, 3, 3),
    );
    assert.equal(strainOn(mended.state).filled, 2, "one mark cleared");
    assert.equal(rulesetCombatant(mended.state, "juno")!.down, false, "and she is back up");
    assert.ok(mended.events.some((event) => event.type === "revived"));
  }

  // ── Every new key needs 1.40 to install ──
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
    const issue = /requires schemaVersion 2 and capabilityApi 1\.40 or newer/;
    const track = { id: "h", label: "H", min: 0, max: 3, kinds: [{ id: "k", label: "K", severity: 0 }] };
    const documents = [
      { sheet: { live: { tracks: [{ ...track, boxes: { penalty: { by: "filled", table: [[0, 0]] } } }] } } },
      { sheet: { live: { tracks: [{ ...track, fill: "indexed" }] } } },
      { sheet: { live: { tracks: [{ ...track, onFull: "refuse" }] } } },
      { sheet: { live: { tracks: [{ ...track, extra: { list: "l", countColumn: "c", penaltyColumn: "p" } }] } } },
      { rests: [{ id: "r", label: "R", restore: [{ track: "h", kind: "k", to: "min" }] }] },
    ];
    for (const document of documents) {
      assert.match(
        getCapabilityPackageInstallIssue(manifest(39) as never, document) ?? "",
        issue,
        JSON.stringify(document),
      );
      assert.equal(getCapabilityPackageInstallIssue(manifest(40) as never, document), null);
    }
    // A track with levels and a rest with no kind are what every file before 1.40 could say.
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(39) as never, {
        rests: [{ id: "r", label: "R", restore: [{ track: "h", to: "min" }] }],
      }),
      null,
    );
  }

  console.info("game ruleset wound-box regressions passed.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
}
