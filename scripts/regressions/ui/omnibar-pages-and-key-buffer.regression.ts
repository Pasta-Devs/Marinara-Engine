// QC Nov 21 batch 4: Ctrl+K finds every Library page by name, keeps Create rows for "new <kind>", and never
// loses keys typed before its field exists.
import assert from "node:assert/strict";
import { createSystemCommandDefinitions } from "../../../packages/client/src/lib/command-center-system-commands.js";
import { LIBRARY_SECTION_COMMANDS } from "../../../packages/client/src/lib/library-section-commands.js";
import { applyOmnibarBufferedKeys } from "../../../packages/client/src/lib/omnibar-key-buffer.js";
import { searchOmnibar } from "../../../packages/client/src/lib/omnibar-search.js";

const commands = createSystemCommandDefinitions({});
const ids = new Set(commands.map((command) => command.id));

// Every Library section has exactly one page command.
for (const [section, entry] of Object.entries(LIBRARY_SECTION_COMMANDS)) {
  assert.ok(ids.has(entry.commandId), `Library section ${section} has its command ${entry.commandId}`);
}
assert.equal(ids.size, commands.length, "no command id twice");

const search = (query: string) =>
  searchOmnibar(query, {
    commands,
    chats: [],
    resources: [
      { kind: "preset", id: "p1", name: "Universal Preset" },
      { kind: "character", id: "c1", name: "Wren Halloway" },
    ],
    connections: [],
    askProfessorTitle: "Ask",
  });
const top = (query: string) => search(query)[0]?.id;

// IA14: typing a page's name (or "open <page>") puts that page first.
assert.equal(top("presets"), "library-section:presets");
assert.equal(top("regex"), "library-section:regex");
assert.equal(top("open presets"), "library-section:presets");
assert.equal(top("custom tools"), "library-section:tools");
assert.equal(top("settings profiles"), "library-section:profiles");
assert.equal(top("agents"), "library-section:agents");
assert.equal(top("characters"), "character-library");
assert.equal(search("presets")[0]?.group, "top-hit", "a named page is the Top hit");

// IA13: "new character" / "create preset" keep their Create rows.
assert.equal(top("new character"), "create-character");
assert.equal(top("create preset"), "create-preset");
assert.ok(
  search("new character").some((row) => row.id === "character:c1"),
  "the characters still list under it",
);

// A11Y10: keys typed before the field showed up.
assert.deepEqual(
  applyOmnibarBufferedKeys("", [
    { kind: "text", value: "w" },
    { kind: "text", value: "r" },
  ]),
  {
    query: "wr",
    enter: false,
  },
);
// A reopened Search shows its last text selected: the first key replaces it, Backspace clears it.
assert.deepEqual(applyOmnibarBufferedKeys("old", [{ kind: "text", value: "x" }]), { query: "x", enter: false });
assert.deepEqual(applyOmnibarBufferedKeys("old", [{ kind: "backspace" }, { kind: "text", value: "y" }]), {
  query: "y",
  enter: false,
});
assert.deepEqual(
  applyOmnibarBufferedKeys("", [
    { kind: "text", value: "a" },
    { kind: "text", value: "b" },
    { kind: "backspace" },
    { kind: "enter" },
    { kind: "text", value: "z" },
  ]),
  { query: "a", enter: true },
  "Enter ends the typing; it runs once the results are in",
);

console.log("omnibar pages and key buffer regression passed");
