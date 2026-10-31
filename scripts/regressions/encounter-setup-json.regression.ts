/**
 * A fight's setup is JSON a model wrote. One that broke a line inside a string (laptop playtest
 * 2026-10-30: "Shape Dru" / "id", and the first Start combat failed) is read with the break escaped,
 * and nothing else about the reading changes.
 */
import assert from "node:assert/strict";

const { parseJSON, escapeRawStringBreaks } = await import("../../packages/server/src/routes/encounter.routes.js");

const broken = '```json\n{"party":[{"name":"Shape Dru\nid","note":"a\ttab"}],"enemies":[]}\n```';
assert.deepEqual(parseJSON(broken), { party: [{ name: "Shape Dru\nid", note: "a\ttab" }], enemies: [] });
// Breaks between values are JSON's own whitespace and stay as they are.
assert.equal(escapeRawStringBreaks('{\n  "a": "b\\"\n"\n}'), '{\n  "a": "b\\"\\n"\n}');
assert.deepEqual(parseJSON('{\n"a": 1\n}'), { a: 1 });
// What is wrong for another reason is still refused.
assert.throws(() => parseJSON('{"a": tru}'));
assert.throws(() => parseJSON("no json here"));

console.log("Encounter setup JSON: raw line breaks inside strings read, everything else unchanged.");
