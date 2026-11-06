// An approved Professor Mari change refetched while the Character editor had
// unsaved edits was dropped, and the next Save wrote the old values back.
// The editor now three-way merges the refetch onto its unsaved form.
import assert from "node:assert/strict";
import { rebaseForm } from "../../packages/client/src/lib/form-rebase.js";

const base = { name: "Shrek", description: "Likes his privacy.", extensions: { backstory: "Swamp.", tags: ["ogre"] } };
// The user edits the name and the backstory without saving.
const mine = { ...base, name: "Shrek the Ogre", extensions: { ...base.extensions, backstory: "Old swamp." } };
// Mari changes the description and the backstory on the server.
const server = {
  ...base,
  description: "Guards his privacy.",
  extensions: { ...base.extensions, backstory: "Ancient swamp." },
};

const { merged, conflicts } = rebaseForm(base, mine, server);
assert.equal(merged.name, "Shrek the Ogre", "unsaved user edit stays");
assert.equal(merged.description, "Guards his privacy.", "server change lands");
assert.equal(merged.extensions.backstory, "Old swamp.", "conflict keeps the user's value");
assert.deepEqual(merged.extensions.tags, ["ogre"]);
assert.deepEqual(conflicts, ["extensions.backstory"]);

// "Use the new version" swaps sides: conflicts take the server value, the rest stays merged.
const theirs = rebaseForm(base, server, merged).merged;
assert.equal(theirs.extensions.backstory, "Ancient swamp.");
assert.equal(theirs.name, "Shrek the Ogre");
assert.equal(theirs.description, "Guards his privacy.");

// Nothing unsaved differs from base: the refetch wins as a whole, with no conflicts.
assert.deepEqual(rebaseForm(base, base, server), { merged: server, conflicts: [] });

// Both sides made the same edit: no conflict.
assert.deepEqual(rebaseForm(base, server, server).conflicts, []);

console.log("character form rebase regression passed");
