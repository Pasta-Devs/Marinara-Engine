import assert from "node:assert/strict";

import {
  createSubmittedDraftHold,
  runHeldSlashCommand,
} from "../../../packages/client/src/components/chat/slash-draft-hold.js";
import { matchSlashCommand, type SlashCommandContext } from "../../../packages/client/src/lib/slash-commands.js";

// The text typed for /impersonate or /guided comes back when the run fails: on a throw, and when the run reports an
// unsaved turn (`false`, as a run that settled in the background without saving its reply does). The stored draft
// keeps the text until the command succeeds, so a reload or a killed app cannot lose it.

const CHAT = "chat-1";
const stored = new Map<string, string>();
const drafts = createSubmittedDraftHold({
  get: (chatId) => stored.get(chatId),
  set: (chatId, text) => void stored.set(chatId, text),
  clear: (chatId) => void stored.delete(chatId),
});

type Outcome = { kind: "returns"; value: boolean | void } | { kind: "throws" };

async function run(commandLine: string, outcome: Outcome, duringRun?: () => void) {
  stored.clear();
  const match = matchSlashCommand(commandLine, { mode: "roleplay" });
  assert.ok(match, `${commandLine} is a command`);
  const generated: Array<Parameters<SlashCommandContext["generate"]>[0]> = [];
  const ctx: SlashCommandContext = {
    chatId: CHAT,
    mode: "roleplay",
    characterNames: [],
    invalidate: () => {},
    createMessage: () => assert.fail("a generating command posts nothing itself"),
    prepareUserMessage: async (text) => text,
    generate: async (params) => {
      generated.push(params);
      assert.equal(stored.get(CHAT), commandLine, "the stored draft keeps the text while the command runs");
      duringRun?.();
      if (outcome.kind === "throws") throw new Error("network down");
      return outcome.value;
    },
  };
  let restored = 0;
  let thrown: unknown;
  try {
    await runHeldSlashCommand({
      drafts,
      chatId: CHAT,
      text: commandLine,
      ctx,
      execute: (trackedCtx) => match.command.execute(match.args, trackedCtx),
      restore: () => {
        restored += 1;
      },
    });
  } catch (error) {
    thrown = error;
  }
  assert.equal(generated.length, 1, `${commandLine} starts one generation`);
  return { restored, thrown, generated };
}

for (const commandLine of ["/impersonate she opens the door", "/guided the storm breaks"]) {
  const unsaved = await run(commandLine, { kind: "returns", value: false });
  assert.equal(unsaved.restored, 1, `${commandLine}: an unsaved turn hands the text back`);
  assert.equal(unsaved.thrown, undefined);
  assert.equal(stored.get(CHAT), commandLine, `${commandLine}: an unsaved turn keeps the stored draft`);

  const failed = await run(commandLine, { kind: "throws" });
  assert.equal(failed.restored, 1, `${commandLine}: a failed run hands the text back`);
  assert.equal((failed.thrown as Error | undefined)?.message, "network down", "the error still reaches the caller");
  assert.equal(stored.get(CHAT), commandLine, `${commandLine}: a failed run keeps the stored draft`);

  const succeeded = await run(commandLine, { kind: "returns", value: true });
  assert.equal(succeeded.restored, 0, `${commandLine}: a success hands nothing back`);
  assert.equal(stored.has(CHAT), false, `${commandLine}: a success clears the stored draft`);

  const noVerdict = await run(commandLine, { kind: "returns", value: undefined });
  assert.equal(noVerdict.restored, 0, `${commandLine}: a generate with no verdict counts as a success`);
  assert.equal(stored.has(CHAT), false);
}

const impersonated = await run("/impersonate she opens the door", { kind: "returns", value: true });
assert.equal(impersonated.generated[0]?.impersonate, true);
assert.equal(impersonated.generated[0]?.userMessage, "she opens the door");

// While the command runs, the box is empty: storing that empty box keeps the held text, and reopening the chat does
// not put the held text back in the box.
await run("/impersonate wait for me", { kind: "returns", value: false }, () => {
  drafts.storeEmpty(CHAT);
  assert.equal(stored.get(CHAT), "/impersonate wait for me", "an empty box does not clear a held draft");
  assert.equal(drafts.shownDraft(CHAT, stored.get(CHAT) ?? ""), "", "a held draft stays out of the box");
  assert.equal(drafts.shownDraft(CHAT, "something else"), "something else");
});
drafts.storeEmpty(CHAT);
assert.equal(stored.has(CHAT), false, "once the command ends, an empty box clears the draft again");

// A success keeps a new draft the user typed while the command ran.
await run("/guided go north", { kind: "returns", value: true }, () => {
  stored.set(CHAT, "a new thought");
});
assert.equal(stored.get(CHAT), "a new thought", "a success clears only the text it sent");

// A command sent with only blank text holds nothing.
stored.set(CHAT, "old");
drafts.hold(CHAT, "   ");
assert.equal(stored.has(CHAT), false);
drafts.storeEmpty(CHAT);
assert.equal(stored.has(CHAT), false);

console.info("Slash-command drafts survive a failed run.");
