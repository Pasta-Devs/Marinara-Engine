import assert from "node:assert/strict";
import { completeInline, completeInlineAt } from "../../../packages/client/src/lib/inline-completion.js";

const candidates = ["dc simulator", "Duke Gunterlie", "Celeste"];
assert.equal(completeInline("DC", candidates), " simulator");
assert.equal(completeInline("dc ", candidates), "simulator");
assert.equal(completeInline("dc sim", candidates), "ulator");
assert.equal(completeInline("tell me about DC ", candidates), "simulator");
assert.equal(completeInline("tell me about Duke G", candidates), "unterlie");
assert.equal(completeInline("tell me about cel", candidates), "este");
assert.equal(completeInline("Hello ", candidates), "");
assert.equal(completeInline("dc simulator ", candidates), "");
assert.equal(completeInline("dc\n", candidates), "");
assert.equal(completeInline(" ", candidates), "");
assert.equal(completeInline("d ", candidates), "");
assert.equal(completeInline("c", candidates), "");
assert.equal(completeInline("DC", ["dc", "dc simulator"]), " simulator");
assert.equal(completeInline("dc ", ["dc simulation", "dc simulator"]), "simulation");
// A leading @ or @" is masked: `@Jes` suggests what `Jes` does
const names = ["Jessica", "Jessica Rabbit", "Alice in Wonderland"];
assert.equal(completeInline("Jes", names), "sica");
assert.equal(completeInline("@Jes", names), "sica");
assert.equal(completeInline('@"Jes', names), "sica");
assert.equal(completeInline("tell me about @Jes", names), "sica");
assert.equal(completeInline('see @"Jessica R', names), "abbit");
assert.equal(completeInline('@"Alice in', names), " Wonderland");
assert.equal(completeInline("@Jel", names), "");
assert.equal(completeInline("@Je", names), "ssica");
assert.equal(completeInline("@J", names), "");
assert.equal(completeInline("@", names), "");
assert.equal(completeInline('@"', names), "");
assert.equal(completeInline("@Jessica", names), " Rabbit");
// not a trigger inside a word
assert.equal(completeInline("me@Jes", names), "");
{
  const places = ["Haunted Mansion", "MARINARASIM"];
  assert.deepEqual(completeInlineAt("OK so in @MARINARASIM  since I ha", places), {
    suffix: "unted Mansion",
    start: 31,
  });
  assert.deepEqual(completeInlineAt("see @Haun", places), { suffix: "ted Mansion", start: 4 });
  assert.equal(completeInlineAt("nothing", places), null);
}
console.log("Inline completion regression passed");
