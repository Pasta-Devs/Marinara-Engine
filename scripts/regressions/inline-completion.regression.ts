import assert from "node:assert/strict";
import { completeInline } from "../../packages/client/src/lib/inline-completion.js";

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
console.log("Inline completion regression passed");
