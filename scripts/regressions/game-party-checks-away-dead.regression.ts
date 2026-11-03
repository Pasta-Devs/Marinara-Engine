/**
 * What the whole party does is done by those with it and alive. A card stays when its member is taken
 * out of the party, and a dead hero keeps theirs, so:
 *   - the check context a turn loads knows who left, off the game's party list, as a whole-party sheet
 *     command does, and a list it cannot read in full counts nobody away;
 *   - a group check (`who="party"`) rolls and counts only the members present and alive, in the tag
 *     pass and in a branch, so two removed members passing never carry a party that failed;
 *   - a story's exposure saves are rolled, and their failures marked, only for them, and only a shade
 *     one of them carries keeps an exposure off.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultRulesetSheetBuild, parseRulesetDefinition, type StoryTurn } from "../../packages/shared/src/index.js";

// Server modules read DATA_DIR once at load, so they are imported only after it points at scratch.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-party-checks-away-dead-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const [
  { loadSkillCheckModifierContext, resolveSkillCheckTagsInContent },
  { createGameTurnChanceSession, resolveGameTurnBranches },
  { rollStoryExposureSavesWith, storyPartyCarriesShade },
  { buildPartyNpcId },
  { getDB, closeDB },
  { createChatsStorage },
  { createGameRulesetsStorage },
] = await Promise.all([
  import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
  import("../../packages/server/src/services/game/one-request-dice.js"),
  import("../../packages/server/src/services/game/story-exposure-saves.service.js"),
  import("../../packages/server/src/services/generation/game-party-utils.js"),
  import("../../packages/server/src/db/connection.js"),
  import("../../packages/server/src/services/storage/chats.storage.js"),
  import("../../packages/server/src/services/storage/game-rulesets.storage.js"),
]);
const db = await getDB();

try {
  const document = JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
      "utf8",
    ),
  );
  document.id = "five-e-party-checks";
  const parsed = parseRulesetDefinition(document);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const fiveE = parsed.definition;
  const rulesetId = "local/five-e-party-checks";
  await createGameRulesetsStorage(db).put({
    rulesetId,
    version: fiveE.version,
    sourceKind: "local",
    definition: JSON.stringify(document),
  });
  const scripted = (values: number[]) => {
    let index = 0;
    return () => {
      assert.ok(index < values.length, "asked for more d20s than scripted");
      return values[index++]!;
    };
  };

  // Rook and Pip are with the party; Dagna and Mars were taken out of it; Wren is dead on her sheet.
  const names = ["Rook", "Pip", "Dagna", "Mars", "Wren"];
  const cards = names.map((name) => ({ name, rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(fiveE) } }));
  const chats = createChatsStorage(db);
  const chat = await chats.create({ name: "The ford", mode: "game", characterIds: [] });
  const meta = {
    gameRuleset: { id: rulesetId, version: fiveE.version, packageId: null, options: {} },
    gameCharacterCards: cards,
    gameNpcs: names.map((name) => ({ name })),
    gamePartyCharacterIds: ["Rook", "Pip", "Wren"].map((name) => buildPartyNpcId(name)),
  };
  await chats.patchMetadata(chat.id, meta);
  const live = { wren: { tracks: { death_save_failures: 3 } } };
  const context = await loadSkillCheckModifierContext(db, chat.id, live);
  assert.deepEqual([...(context.ruleset?.away ?? [])], ["dagna", "mars"], "the loader knows who left the party");

  // ── A group check: Rook and Pip fail, the removed two would pass, the dead one is not asked ──
  const group = await resolveSkillCheckTagsInContent(
    `They wade the ford. [skill_check: skill="Athletics" dc="12" who="party"]`,
    {
      loadContext: async () => context,
      rollD20: scripted([5, 6, 18, 18, 18]),
      rulesetPinned: true,
    },
  );
  const records = [...group.content.matchAll(/\[skill_check:[^\]]*\]/g)].map((match) => match[0]);
  assert.equal(records.length, 2, group.content);
  assert.match(records[0]!, /result="failure"[^\]]*who="Rook"/);
  assert.match(records[1]!, /result="failure"[^\]]*who="Pip"/);
  assert.ok(
    group.content.endsWith(`(Group Athletics check against 12: 0 of 2 passed, so the party fails.)`),
    group.content,
  );

  // ── The same in a branch: the party's half is theirs ──
  const branched = await resolveGameTurnBranches(
    [
      `[skill_check: skill="Athletics" dc="12" who="party" branch="ford"]`,
      "[branch: ford]",
      "[on success] Across.",
      "[on failure] Swept back.",
      "[/branch]",
    ].join("\n"),
    createGameTurnChanceSession({
      db: null as never,
      chatId: chat.id,
      roll: scripted([5, 6, 18, 18, 18]),
      loadModifierContext: async () => context,
      playerD20s: [],
    }),
  );
  assert.match(branched.content, /0 of 2 passed, so the party fails\.\)/);
  assert.match(branched.content, /Swept back\./);

  // ── A story's exposure: only those with the party and alive save, and only their failures cost ──
  const turn = {
    sheet: "",
    tells: [],
    saves: [
      {
        exposure: "ford",
        label: "The cold ford",
        times: 1,
        hours: 1,
        save: "con_save",
        difficulty: 12,
        tracks: [{ track: "exhaustion", by: 1 }],
        applies: [],
      },
    ],
  } as unknown as StoryTurn;
  const exposed = rollStoryExposureSavesWith(context, meta, turn, scripted([5, 18, 3, 3, 3]));
  assert.equal(exposed.sheet, '[sheet: who="Rook" op="track" track="exhaustion" by="1"]');
  assert.doesNotMatch(exposed.tells.join("\n"), /Dagna|Mars|Wren/, exposed.tells.join("\n"));

  // ── A shade lit spares the party only when one with it and alive carries it ──
  const lantern = {
    id: "lantern_of_dusk",
    name: "Lantern of Dusk",
    carried: { light: { bright: 0, dim: 15, shade: true } },
  };
  const holding = (key: string) => ({
    ...context,
    ruleset: { ...context.ruleset!, items: new Map([[key, [{ item: lantern, quantity: 1, worn: false } as never]]]) },
  });
  assert.equal(storyPartyCarriesShade(holding("rook")), true);
  assert.equal(storyPartyCarriesShade(holding("dagna")), false, "a removed member's lantern");
  assert.equal(storyPartyCarriesShade(holding("wren")), false, "a dead member's lantern");

  // ── A party list the Engine cannot read in full counts nobody away ──
  await chats.patchMetadata(chat.id, { gamePartyCharacterIds: [...meta.gamePartyCharacterIds, "missing-character"] });
  assert.equal((await loadSkillCheckModifierContext(db, chat.id, live)).ruleset?.away, undefined);

  console.log(
    "Party checks: removed and dead members neither roll nor count in group checks and exposure saves, nor carry a shade.",
  );
} finally {
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
