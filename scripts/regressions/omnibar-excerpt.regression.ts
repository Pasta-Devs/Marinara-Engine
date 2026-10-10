import assert from "node:assert/strict";
import { omnibarExcerptAroundMatch } from "../../packages/client/src/lib/omnibar-results.js";

// Slice 86: the excerpt starts at most 24 characters before the first match, at a word boundary, with a leading ….
const long = "The cellar door stayed shut all night, and nothing in the old lighthouse moved until the rain came back.";
const cut = omnibarExcerptAroundMatch(long, "rain");
assert.ok(cut.startsWith("…"), "a cut excerpt starts with a leading ellipsis");
const matchAt = cut.toLowerCase().indexOf("rain");
// The excerpt starts at most 24 characters before the match (the leading ellipsis counts once).
assert.ok(matchAt >= 8 && matchAt <= 25, `the match sits at most 24 characters in (got ${matchAt})`);
assert.ok(long.includes(` ${cut.slice(1, 13)}`), "the cut starts right after a space, not mid-word");

// A match already near the start keeps the snippet as it is.
assert.equal(omnibarExcerptAroundMatch("Rain again tonight.", "rain"), "Rain again tonight.");
// No match in the snippet leaves it alone too.
assert.equal(omnibarExcerptAroundMatch("  quiet   room  ", "rain"), "quiet room");
console.log("omnibar excerpt: OK");
