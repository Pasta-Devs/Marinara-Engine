// Professor Mari's Home composer stops growing at its CSS max-height, routes its keys through one helper, and keeps a
// failed send's prompt out of the box. Reads component source until a test can drive it.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createMariDraftPersist, onlyInsertedInto } from "../../../packages/client/src/lib/mari-composer-draft.js";
import {
  resolveContextCharacter,
  resolveContextLorebook,
} from "../../../packages/client/src/components/chat/mari/mari-chat-helpers.js";
import { runNamedCases } from "../fixtures/named-cases.js";

const professorMariHomeSource = readFileSync(
  new URL("../../../packages/client/src/components/chat/HomeProfessorMariChat.tsx", import.meta.url),
  "utf8",
);
// R11: the composer cap is its CSS max-height now (8 lines, 6 on touch), not a hard-coded 128 px.
assert.match(
  professorMariHomeSource,
  /const cap = Number\.parseFloat\(getComputedStyle\(textarea\)\.maxHeight\);\s*const to = Number\.isFinite\(cap\) \? Math\.min\(textarea\.scrollHeight, cap\)/u,
  "Professor Mari's composer must stop growing at its max-height",
);
// Her one composer routes its keys through composerKeyAction (#7913; ui/composer-triggers checks each case), and a
// failed or stopped send leaves the composer empty instead of putting the prompt back. Her chat's parts live in
// components/chat/mari/, so read them all.
const mariChatDir = new URL("../../../packages/client/src/components/chat/mari/", import.meta.url);
const mariChatAllSource = [
  professorMariHomeSource,
  ...readdirSync(mariChatDir).map((name) => readFileSync(new URL(name, mariChatDir), "utf8")),
].join("\n");
assert.equal(
  mariChatAllSource.match(/composerKeyAction\(\{/gu)?.length,
  1,
  "Professor Mari's composer must route its keys through composerKeyAction",
);
assert.doesNotMatch(
  mariChatAllSource,
  /catch \(error\) \{[^}]*setDraft\(/u,
  "A failed or stopped Professor Mari send must not restore the submitted prompt to the composer",
);

// #9340: her draft is saved to the shared drafts store after a pause in typing, not on every keystroke (each save
// re-rendered the chat list), and a long draft is measured for its height only when an edit can change its lines.
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

await runNamedCases([
  {
    name: "typing reaches the store once, after the pause",
    run: async () => {
      const saves: string[] = [];
      const persist = createMariDraftPersist("", (value) => saves.push(value), 20);
      for (const text of ["h", "he", "hel", "hello"]) persist.set(text);
      assert.equal(persist.current(), "hello");
      assert.deepEqual(saves, [], "no save while typing");
      await pause(40);
      assert.deepEqual(saves, ["hello"]);
    },
  },
  {
    name: "an emptied draft (a send) and a flush (unmount, pagehide) are saved at once",
    run: () => {
      const saves: string[] = [];
      const persist = createMariDraftPersist("old", (value) => saves.push(value), 10_000);
      persist.set("old and more");
      persist.flush();
      assert.deepEqual(saves, ["old and more"]);
      persist.set("");
      assert.deepEqual(saves, ["old and more", ""], "a sent draft must not come back after a reload");
      persist.flush();
      assert.equal(saves.length, 2, "nothing left to save");
    },
  },
  {
    name: "the omnibar's write replaces the draft and unsaved typing never overwrites it",
    run: async () => {
      const saves: string[] = [];
      const persist = createMariDraftPersist("", (value) => saves.push(value), 20);
      persist.set("typed");
      assert.equal(persist.stored(""), null, "a store change that is not her draft changes nothing");
      assert.equal(persist.current(), "typed", "and keeps the unsaved typing");
      assert.equal(persist.stored("from the omnibar"), "from the omnibar");
      assert.equal(persist.current(), "from the omnibar");
      await pause(40);
      assert.deepEqual(saves, [], "the cancelled save of the typing never lands");
      persist.set("from the omnibar, edited");
      persist.flush();
      assert.equal(persist.stored("from the omnibar, edited"), null, "its own save is not an outside write");
    },
  },
  {
    name: "only text put in at one place counts as growth",
    run: () => {
      assert.equal(onlyInsertedInto("hello", "hello!"), true);
      assert.equal(onlyInsertedInto("hello", "he-llo"), true);
      assert.equal(onlyInsertedInto("", "pasted"), true);
      assert.equal(onlyInsertedInto("hello", "hello"), false);
      assert.equal(onlyInsertedInto("hello", "hell"), false);
      assert.equal(onlyInsertedInto("one\ntwo\nthree", "one two three plus"), false, "a longer replacement");
    },
  },
  {
    name: "a missing record's stand-in is the same object on every render",
    run: () => {
      const context = { source: "home", resource: { kind: "character", id: "gone", label: "Gone" } } as never;
      const first = resolveContextCharacter(context, new Map(), "Character");
      assert.equal(resolveContextCharacter(context, new Map(), "Character"), first);
      assert.equal(first?.name, "Gone");
      const lorebook = { source: "home", resource: { kind: "lorebook", id: "lost" } } as never;
      const book = resolveContextLorebook(lorebook, new Map(), "Lorebook");
      assert.equal(resolveContextLorebook(lorebook, new Map(), "Lorebook"), book);
      assert.notEqual(resolveContextLorebook(lorebook, new Map(), "Lorebuch"), book, "a new fallback name is shown");
      assert.equal(resolveContextLorebook(lorebook, new Map(), "Lorebuch")?.name, "Lorebuch");
    },
  },
]);
