// #8391: a handbook Mari read stays in her prompt while she works on its surface, drops after 3 quiet turns
// (2 at most), and the read-first gate re-arms for a dropped one. The rules are pinned through the pure helpers,
// the gate through the real WorkspaceCommands against a file-native store.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const storageDir = mkdtempSync(join(tmpdir(), "marinara-sticky-handbooks-"));
const previousStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageDir;
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
try {
  const db = await getDB();
  const { activeHandbookIds, handbookTurnFromResults, parseHandbookTurn, renderActiveHandbooksPrompt } =
    await import("../../../packages/server/src/services/professor-mari/sticky-handbooks.js");
  const { WorkspaceCommands, handbooksForAction } =
    await import("../../../packages/server/src/services/professor-mari/workspace-commands.js");
  const { buildWorkspaceContinuitySnapshot } =
    await import("../../../packages/server/src/services/professor-mari/workspace-agent.service.js");
  const { mariWorkspaceSessionId } = await import("../../../packages/shared/src/utils/mari-review-session.js");

  // --- Which handbooks one turn read and touched.
  type Result = Parameters<typeof handbookTurnFromResults>[0][number];
  const call = (input: Record<string, unknown>, success = true): Result => ({
    id: "c",
    name: "app_data",
    input,
    output: "",
    success,
  });
  assert.deepEqual(
    handbookTurnFromResults([
      call({ action: "skill.get", id: "builtin-characters" }),
      call({ action: "skill.get", id: "my-own-skill" }),
      call({ action: "skill.get", id: "builtin-themes" }, false),
      call({ action: "character.update", characterId: "a", patch: {}, apply: true }),
      call({ action: "lorebook.create", data: {} }, false),
      { ...call({ action: "skill.get", id: "builtin-presets" }), name: "bash" as never },
    ]),
    { read: ["builtin-characters"], touched: ["builtin-characters", "builtin-onboarding"] },
    "only successful app_data calls count, and only built-in skills are read",
  );
  // A call held for approval was written on its surface, so it touches (Manual mode, #8392 review).
  assert.deepEqual(
    handbookTurnFromResults(
      [call({ action: "lorebook.link_character", lorebookId: "l", characterId: "c" }, false)],
      [
        {
          id: "h",
          name: "app_data",
          arguments: { action: "lorebook.link_character", lorebookId: "l", characterId: "c" },
        },
      ],
    ).touched.sort(),
    ["builtin-characters", "builtin-lorebook"],
  );
  assert.deepEqual(handbooksForAction("lorebook.link_character").sort(), ["builtin-characters", "builtin-lorebook"]);
  assert.deepEqual(
    handbooksForAction("lorebook.update", { data: { content: '{{#if decision:"stay"}}x{{/if}}' } }).sort(),
    ["builtin-decisions", "builtin-lorebook"],
  );
  assert.deepEqual(handbooksForAction("chat.list"), []);
  assert.deepEqual(parseHandbookTurn(undefined), { read: [], touched: [] }, "rows from before #8391");
  assert.deepEqual(parseHandbookTurn({ read: ["a", 3, ""], touched: "b" }), { read: ["a"], touched: [] });

  // --- The active set.
  const quiet = { read: [], touched: [] };
  const read = (...ids: string[]) => ({ read: ids, touched: [] });
  const touch = (...ids: string[]) => ({ read: [], touched: ids });
  const C = "builtin-characters";
  assert.deepEqual(activeHandbookIds([read(C)]), [C]);
  assert.deepEqual(activeHandbookIds([read(C), quiet, quiet]), [C], "still there after 2 quiet turns");
  assert.deepEqual(activeHandbookIds([read(C), quiet, quiet, quiet]), [], "dropped after the 3rd quiet turn");
  assert.deepEqual(activeHandbookIds([read(C), quiet, touch(C), quiet, quiet]), [C], "a write keeps it");
  assert.deepEqual(activeHandbookIds([touch(C), quiet]), [], "a write alone never adds one");
  assert.deepEqual(
    activeHandbookIds([read(C), touch(C), touch(C), touch(C), touch(C)]),
    [C],
    "held proposals in a row keep it, like any write",
  );
  assert.deepEqual(activeHandbookIds([read(C), quiet, quiet, quiet, touch(C)]), [], "nor brings back a dropped one");
  assert.deepEqual(
    activeHandbookIds([read(C), read("builtin-onboarding"), read("builtin-lorebook")]),
    ["builtin-onboarding", "builtin-lorebook"],
    "at most 2: the oldest drops",
  );
  assert.deepEqual(
    activeHandbookIds([read(C), read("builtin-onboarding"), read(C), read("builtin-lorebook")]),
    [C, "builtin-lorebook"],
    "reading one again makes it the newest",
  );
  assert.deepEqual(
    activeHandbookIds([read(C), read("builtin-onboarding"), touch(C), read("builtin-lorebook")]),
    [C, "builtin-lorebook"],
    "the limit drops the one idle longest, not the one read first",
  );

  // --- The block: whole text, names can't break the tag, nothing when empty.
  assert.equal(renderActiveHandbooksPrompt([]), null);
  assert.equal(renderActiveHandbooksPrompt([{ id: C, name: "x", content: "  " }]), null);
  const block = renderActiveHandbooksPrompt([
    { id: C, name: 'Cards "and" <more>', content: "# Characters\nAll of it." },
  ])!;
  assert.match(block, /^<active_handbooks>\n/);
  assert.match(
    block,
    /<handbook id="builtin-characters" name="Cards &quot;and&quot; &lt;more&gt;">\n# Characters\nAll of it.\n<\/handbook>/,
  );
  assert.match(block, /drops after 3 turns without it/);
  assert.match(block, /<\/active_handbooks>$/);

  // --- The continuity line points at the block instead of asking for a fresh read every turn.
  const snapshot = JSON.stringify(
    buildWorkspaceContinuitySnapshot({
      userText: "make me a card",
      assistantText: "Done.",
      commandResults: [call({ action: "skill.get", id: C })],
    }),
  );
  assert.match(snapshot, /stays in <active_handbooks>; if it is not there, call skill.get again/);

  // --- The gate: armed from the active set each turn.
  const chatId = "sticky";
  const commands = new WorkspaceCommands({ db } as never, () => ({
    permissionsMode: "auto",
    manualSilentMutationBlocked: false,
    askLatchSilentMutationBlocked: false,
    acceptedHeldCalls: false,
    decisionContext: { chatId } as never,
  }));
  let n = 0;
  const run = (args: Record<string, unknown>) =>
    commands.executeWorkspaceCommand(
      { id: `call-${++n}`, name: "app_data", arguments: args },
      new AbortController().signal,
      [],
      () => {},
      [],
    );
  const create = (name: string) => run({ action: "character.create", data: { name }, apply: true });
  const session = mariWorkspaceSessionId(chatId);

  // A turn with the handbook in <active_handbooks>: the first write goes straight through.
  commands.armSkillGate(session, [C]);
  const kept = await create("Morag");
  assert.equal(kept.success, true, kept.output);
  // It dropped, so the next turn's first write is refused again...
  commands.armSkillGate(session, []);
  const rearmed = await create("Edmund");
  assert.equal(rearmed.success, false);
  assert.match(rearmed.output, /read skill `builtin-characters` first/);
  assert.match(rearmed.output, /this check runs once per turn./);
  // ...once: the same turn's resend passes, so a disabled or unreadable handbook can't lock the surface.
  const resent = await create("Edmund");
  assert.equal(resent.success, true, resent.output);
} finally {
  await closeDB();
  if (previousStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousStorageDir;
  rmSync(storageDir, { recursive: true, force: true });
}

console.log("Professor Mari sticky handbooks regression passed.");
