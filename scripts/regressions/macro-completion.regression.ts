import assert from "node:assert/strict";
import { completeMacro, MACRO_COMPLETION_CANDIDATES } from "../../packages/client/src/lib/macro-completion";

const at = (value: string) => completeMacro(value, value.length);

// Plain macros close themselves, and the registry order decides ties ({{char}} before {{characters}}).
assert.equal(at("Hello {{ch"), "ar}}");
assert.equal(at("{{us"), "er}}");
assert.equal(at("{{CH"), "ar}}", "matching ignores case");
assert.equal(at("{{char}"), "}", "a half-typed closing brace still completes");

// Macros with arguments stop at their separator, block openers after the keyword.
assert.equal(at("{{getv"), "ar::");
assert.equal(at("{{ro"), "ll:");
assert.equal(at("{{#i"), "f ");
assert.equal(at("{{/i"), "f}}");
assert.equal(at("{{els"), "e}}");

// Nothing to add.
assert.equal(at("{{"), "", "an empty fragment matches everything");
assert.equal(at("{{char}}"), "", "a closed macro is finished");
assert.equal(at("{{getvar::"), "", "the separator is already typed");
assert.equal(at("{{#if char == "), "", "past the macro name");
assert.equal(at("{{zzz"), "", "unknown names get no guess");
assert.equal(at("plain ch"), "", "only text after {{ completes");

// Only at the end of a line, so the ghost never overlaps text after the caret.
assert.equal(completeMacro("{{ch and more", 4), "");
assert.equal(completeMacro("{{ch\nnext line", 4), "ar}}");

// Placeholders are not names to type.
assert.ok(!MACRO_COMPLETION_CANDIDATES.includes("NAME}}"));
assert.ok(!MACRO_COMPLETION_CANDIDATES.some((candidate) => candidate.includes("card-ID")));
assert.ok(!MACRO_COMPLETION_CANDIDATES.some((candidate) => candidate.startsWith("//")), "comments are skipped");
// Every candidate is unique, so the registry order is the only ranking.
assert.equal(new Set(MACRO_COMPLETION_CANDIDATES).size, MACRO_COMPLETION_CANDIDATES.length);

console.log("macro-completion regression passed");
