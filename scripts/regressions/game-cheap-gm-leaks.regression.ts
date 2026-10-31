/**
 * Cheap-model Game Master playtest, 2026-10-26 (5e SRD game): what leaks into the story, world setup
 * that dies quietly, wasted companion turns, and hurt that never reached the board.
 *
 *   - A leading first-person plan ("The combat report leaves ... I'm carrying that damage ...") is
 *     lifted off the narration, also when it is glued to the scene with no space; a story line that
 *     starts with "I" or "Let me" stays.
 *   - A line of markdown marks alone (`---`, `**`, `* * *`) is no beat of the story; an OOC answer shows.
 *   - A Game generation whose stream was aborted fails with why, rather than coming back as an empty or
 *     half reply; a setup reply cut off before its JSON closed is not asked for twice.
 *   - Companion AI: an area blast never catches its own maker and never goes off over nobody; a teleport
 *     paid for is not spent closing in where a walk would do; a walk out through an opponent's reach
 *     weighs the blows it draws against the health left.
 *   - An opponent the story hurt before the fight begins the fight hurt.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  parseGameNarrationSegments,
  parseRulesetDefinition,
  rulesetAimCells,
  rulesetCombatant,
  type RulesetCatalogEntriesById,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-cheap-gm-leaks-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const [{ extractLeadingGmPlanning }, { runGameChatComplete }, { createCombatDirector }, director] = await Promise.all([
  import("../../packages/server/src/services/game/gm-planning.js"),
  import("../../packages/server/src/routes/game.routes.js"),
  import("../../packages/server/src/services/game/combat-director.service.js"),
  import("../../packages/server/src/services/game/ruleset-combat-director.service.js"),
]);
const { createRulesetFight, rankRulesetChoices, rulesetClosingMove } = director;

try {
  // ── A first-person plan ahead of the scene ──
  {
    const lifted: Array<[string, string, RegExp]> = [
      [
        "The hunter is down, and the battle report leaves the party back in exploration with Ilyra badly hurt but conscious. I'm carrying the consequences forward without spending any healing or changing the recorded sheets, then returning control at the reef with the divers still unresolved.The water closes over the salt-scaled hunter.",
        "The water closes over the salt-scaled hunter.",
        /returning control/,
      ],
      [
        "The combat report leaves the party standing, with Mara badly hurt and both maintenance frames disabled. I'm carrying that damage into the aftermath and using the wreckage to open the next investigation rather than inventing any further combat actions.The last maintenance frame collapses against the junction cabinet.",
        "The last maintenance frame collapses against the junction cabinet.",
        /inventing any further/,
      ],
      [
        "I'm reconciling the rest against the supplied sheets before resolving it: both recovery features restore only two spell levels at level 4, while Pell's two d8 Hit Dice are valid. I'll secure the prisoners and refuge, record the memory panel, then apply the short-rest commands and report the exact slot changes without fabricating Pell's rolled healing.Pell Orro wedges his fingers into the seam.",
        "Pell Orro wedges his fingers into the seam.",
        /short-rest commands/,
      ],
      [
        'The player wants to slip past the guards. I\'ll call for a Stealth check and describe the courtyard.\n\nTorchlight pools on the flagstones.\n\n[Mira] [main]: "Quiet now."',
        'Torchlight pools on the flagstones.\n\n[Mira] [main]: "Quiet now."',
        /The player wants/,
      ],
      [
        "Let me resolve the Perception roll first, then narrate the ambush.\nThe reeds part, and three shapes rise from the water.",
        "The reeds part, and three shapes rise from the water.",
        /narrate the ambush/,
      ],
    ];
    for (const [reply, content, planned] of lifted) {
      const out = extractLeadingGmPlanning(reply);
      assert.equal(out.content, content, reply);
      assert.match(out.planning, planned);
    }
    // Story, however it opens, stays: the first person, "Let me", a speaker, a quote, a plan with
    // nothing after it.
    for (const reply of [
      "I need to get out of here. The door is locked.\n\nRain hammers the roof.",
      "I'll never forgive you, Mara thinks. The tide turns.\n\nRain.",
      "Let me through. The guard steps aside.\n\nThe gate creaks.",
      "I am the last of the wardens. My sheets of parchment are all I have left.\n\nWind.",
      "I'll take the player's side, says Bram. \"Narrate it however you like.\"\n\nHe grins.",
      "Mira: I'll check the sheets later.\n\nShe leaves.",
      "I'm carrying the damage forward without changing the recorded sheets.",
      "(OOC: The player asked about Defense. I'll answer plainly: it adds 1 to AC.)\n\nThe fire crackles.",
      "OOC: I'll narrate the rest once you pick a door.\n\nThe corridor waits.",
      "She nodded.Then she left, and I'll say no more of the sheets.",
    ]) {
      assert.deepEqual(extractLeadingGmPlanning(reply), { content: reply, planning: "" }, reply);
    }
    // The labelled plan blocks the earlier pass lifts are lifted still.
    const labelled = extractLeadingGmPlanning(
      "Location: Cooper's Row, late afternoon.\nNPCs present: Bex, Pip.\nHidden: the map is a genuine proof.\n\nCoal drizzle hisses on the cobbles.",
    );
    assert.equal(labelled.content, "Coal drizzle hisses on the cobbles.");
  }

  // ── Markdown marks with nothing to mark ──
  {
    const beats = (content: string) =>
      parseGameNarrationSegments({ id: "m", content }).map((segment) => [segment.type, segment.content]);
    assert.deepEqual(beats("**[Note: The bridge is out.]**\n\nThe fire crackles."), [
      ["readable", "You find a note..."],
      ["narration", "The fire crackles."],
    ]);
    assert.deepEqual(beats("The fire.\n\n**\n\n---\n\n* * *\n\n__\n\nMore."), [
      ["narration", "The fire."],
      ["narration", "More."],
    ]);
    // Emphasis around words, an em dash and an ellipsis are kept.
    assert.deepEqual(beats("**Run.**\n\n—\n\n..."), [
      ["narration", "**Run.**"],
      ["narration", "—"],
      ["narration", "..."],
    ]);
    // An OOC answer is shown, not dropped.
    assert.ok(beats("[OOC: Yes, Defense adds 1.]\n\n---\n\nRain.").some(([, text]) => /\(OOC: Yes/.test(text!)));
  }

  // ── An aborted generation fails at once, with why ──
  {
    // A provider that ends its stream quietly when the request is aborted, as the OpenAI-compatible one
    // does: with what it had, here nothing.
    const quiet = {
      chatComplete: (_messages: unknown, options: { signal?: AbortSignal }) =>
        new Promise<{ content: string }>((resolve) => {
          options.signal?.addEventListener("abort", () => resolve({ content: "" }), { once: true });
        }),
    };
    const parent = new AbortController();
    const started = Date.now();
    const call = runGameChatComplete(
      quiet as never,
      [{ role: "user", content: "Set up the game." }],
      { model: "any", signal: parent.signal } as never,
      "Game setup",
      60_000,
    ).then(
      () => null,
      (error: Error) => error,
    );
    setTimeout(() => parent.abort(new Error("Game setup timed out after 1 seconds")), 50);
    const error = await call;
    assert.ok(error, "an aborted call is no reply");
    assert.match(error!.message, /timed out/);
    assert.ok(Date.now() - started < 5_000, "and fails at once");
    // A finished one is unchanged.
    const done = await runGameChatComplete(
      { chatComplete: async () => ({ content: "{}" }) } as never,
      [{ role: "user", content: "Set up the game." }],
      { model: "any" } as never,
      "Game setup",
      60_000,
    );
    assert.equal(done.content, "{}");
    const routes = readFileSync(
      fileURLToPath(new URL("../../packages/server/src/routes/game.routes.ts", import.meta.url)),
      "utf8",
    );
    assert.match(
      routes,
      /if \(isLikelyTruncatedJsonResponse\(responseText, setupFinishReason\)\) break;/,
      "a setup cut off is not asked for twice",
    );
    assert.match(routes, /World generation stopped before the setup JSON completed/);
  }

  // ── Companion AI ──
  const fiveE = JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
      "utf8",
    ),
  ) as Record<string, unknown>;
  const parsed = parseRulesetDefinition(fiveE);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition: RulesetDefinition = parsed.definition;
  const block = (actions: unknown[], extra: Record<string, unknown> = {}): RulesetStatBlock =>
    ({
      health: 60,
      defense: 12,
      initiativeModifier: 0,
      speed: 30,
      size: "medium",
      abilities: { str: 10, dex: 10, con: 10, int: 12, wis: 10, cha: 10 },
      saves: { wis_save: -10, con_save: -10 },
      actions,
      ...extra,
    }) as unknown as RulesetStatBlock;
  const smash = {
    id: "smash",
    name: "Smash",
    budget: "action",
    toHit: 6,
    reach: 5,
    damage: { count: 2, sides: 8, flat: 4 },
  };
  type Placed = {
    id: string;
    side: "party" | "enemy";
    block: RulesetStatBlock;
    at: { x: number; y: number };
    health?: number;
  };
  const unit = (id: string, side: "player" | "enemy") => ({
    id,
    name: id,
    side,
    hp: 20,
    maxHp: 20,
    attack: 8,
    defense: 6,
    speed: 6,
    level: 5,
    skills: [],
    aiHints: { proficiency: "master", mind: "tactical" },
  });
  const fight = (placed: Placed[]) => {
    const encounter: RulesetEncounterState = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: placed.map((one) => ({ id: one.id, name: one.id, side: one.side, block: one.block })),
      board: {
        grid: { width: 24, height: 10, tiles: Array.from({ length: 10 }, () => Array(24).fill("plains")) },
        placements: Object.fromEntries(placed.map((one) => [one.id, one.at])),
      } as never,
    });
    for (const one of placed) {
      if (one.health === undefined) continue;
      const combatant = rulesetCombatant(encounter, one.id)!;
      combatant.health = { ...combatant.health!, value: one.health };
    }
    encounter.order = placed.map((one) => one.id);
    encounter.turn = 0;
    const state = createCombatDirector({
      id: "fight",
      anchor: "anchor",
      style: "ruleset",
      party: placed.filter((one) => one.side === "party").map((one) => unit(one.id, "player")),
      enemies: placed.filter((one) => one.side === "enemy").map((one) => unit(one.id, "enemy")),
      gm: false,
      difficulty: "normal",
      seed: 3,
    } as never);
    state.rulesetFight = { encounter, events: [], eventSeq: 0, controllers: {}, bosses: [], adjustments: [] } as never;
    return { encounter, state };
  };
  const ranked = (scene: ReturnType<typeof fight>, actorId: string) =>
    rankRulesetChoices(definition, scene.state, scene.encounter, actorId, 400);

  // An area blast never over its own maker, and never over nobody (a Shatter that caught the bard; a
  // Fireball that hit nothing).
  {
    const blast = {
      id: "blast",
      name: "Blast",
      budget: "action",
      range: { normal: 60 },
      targets: "any",
      area: { shape: "burst", size: 10 },
      save: { save: "con_save", difficulty: 15 },
      saveDifficulty: 15,
      damage: { count: 4, sides: 6, flat: 0 },
    };
    const weak = (id: string, at: { x: number; y: number }): Placed => ({
      id,
      side: "enemy",
      block: block([smash], { health: 10 }),
      at,
    });
    const scene = fight([
      { id: "bard", side: "party", block: block([smash, blast], { health: 400 }), at: { x: 4, y: 5 } },
      weak("o1", { x: 5, y: 5 }),
      weak("o2", { x: 5, y: 4 }),
      weak("o3", { x: 5, y: 6 }),
      weak("far", { x: 16, y: 5 }),
    ]);
    const aims = new Map(
      rulesetAimCells(scene.encounter, "bard", "blast", 2000).map((aim) => [`${aim.x},${aim.y}`, aim.targetIds]),
    );
    assert.ok(
      [...aims.values()].some((ids) => ids.includes("bard") && ids.filter((id) => id.startsWith("o")).length === 3),
      "the board offers an aim over the bard and all three beside her",
    );
    const blasts = ranked(scene, "bard").filter((one) => one.candidate.action.option.id === "blast");
    assert.ok(blasts.length > 0, "it still blasts somebody");
    for (const one of blasts) {
      const at = one.candidate.action.choice.at!;
      const caught = aims.get(`${at.x},${at.y}`) ?? [];
      assert.ok(!caught.includes("bard"), `never over its maker: ${JSON.stringify(at)} ${caught}`);
      assert.ok(
        caught.some((id) => id !== "bard"),
        `never over nobody: ${JSON.stringify(at)}`,
      );
    }
  }

  // A teleport paid for is not spent closing in where its walk would do; a free one, or one past the
  // walk, still is (Misty Step cast with nobody near).
  {
    const misty = (extra: Record<string, unknown>) => ({
      id: "misty",
      name: "Misty Step",
      budget: "bonus",
      teleport: { distance: 40 },
      ...extra,
    });
    const closes = (extra: Record<string, unknown>, gap: number) => {
      const scene = fight([
        { id: "duelist", side: "party", block: block([smash, misty(extra)]), at: { x: 2, y: 5 } },
        { id: "orc", side: "enemy", block: block([smash]), at: { x: 2 + gap, y: 5 } },
      ]);
      return ranked(scene, "duelist").some((one) => one.candidate.action.option.id === "misty");
    };
    assert.equal(closes({ uses: { per: "encounter", count: 1 } }, 4), false, "paid, and a walk away: walked");
    assert.equal(closes({}, 4), true, "free, it may still blink in");
    assert.equal(closes({ uses: { per: "encounter", count: 1 } }, 9), true, "paid, past its walk: blinked");
  }

  // A walk out through an opponent's reach that would likely drop it is not taken to close on somebody
  // else (a companion at 5 health walked out of melee and was struck down); whole, it still goes.
  {
    const knife = {
      id: "knife",
      name: "Knife",
      budget: "action",
      toHit: 6,
      reach: 5,
      damage: { count: 1, sides: 4, flat: 3 },
    };
    const closes = (health: number) => {
      const scene = fight([
        { id: "scout", side: "party", block: block([knife], { health: 30 }), at: { x: 4, y: 5 }, health },
        { id: "brute", side: "enemy", block: block([smash], { health: 60 }), at: { x: 5, y: 5 } },
        { id: "mage", side: "enemy", block: block([knife], { health: 20 }), at: { x: 4, y: 9 } },
      ]);
      const move = rulesetClosingMove(definition, scene.encounter, "scout", undefined, "mage");
      return (move?.to as { x: number; y: number } | undefined) ?? null;
    };
    // Out of the brute's reach is a cell more than one from it.
    const leaves = (to: { x: number; y: number } | null) =>
      !!to && Math.max(Math.abs(to.x - 5), Math.abs(to.y - 5)) > 1;
    assert.ok(leaves(closes(30)), `whole, it goes for the mage past the brute: ${JSON.stringify(closes(30))}`);
    assert.ok(!leaves(closes(5)), `at 5 health it keeps within the brute's reach: ${JSON.stringify(closes(5))}`);
  }

  // ── Hurt before the fight, hurt on the board ──
  {
    const bestiary: RulesetCatalogEntriesById = Object.fromEntries(
      (definition.catalogs ?? []).filter((one) => one.holds === "creatures").map((one) => [one.id, one.entries ?? []]),
    );
    const seed = (hurt?: number) => {
      const built = createRulesetFight({
        definition,
        seed: 7,
        party: [{ id: "ada", name: "Ada" }],
        enemies: [{ id: "thing", name: "Nameless Thing", tier: "cr_2", ...(hurt !== undefined ? { hurt } : {}) }],
        cards: [{ name: "Ada", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(definition) } }],
        playerName: null,
        live: null,
        partyCatalogs: {},
        bestiary,
      });
      assert.ok(built.ok, built.ok ? "" : built.error);
      return rulesetCombatant(built.fight.encounter, "thing")!.health!;
    };
    const whole = seed();
    assert.equal(whole.value, whole.max, "unhurt, it begins whole");
    const half = seed(0.5);
    assert.equal(half.value, Math.round(half.max * 0.5), "hurt by half in the story, half on the board");
    assert.equal(seed(0.001).value, 1, "never below 1");
    const route = readFileSync(
      fileURLToPath(new URL("../../packages/server/src/routes/combat-director.routes.ts", import.meta.url)),
      "utf8",
    );
    assert.match(route, /hurt: enemy\.hp \/ enemy\.maxHp/, "the route carries the Game Master's hp under its maxHp");
  }

  console.log(
    "Cheap-GM leaks: first-person plans lifted, bare markup dropped, aborted generations fail at once, companions waste no blasts or blinks and weigh parting blows, story hurt reaches the board.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
