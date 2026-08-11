import assert from "node:assert/strict";
import {
  buildChatSearchSnippet,
  findChatSearchHits,
  sortChatSearchHits,
  toSearchableText,
  type ChatSearchMessage,
} from "../../packages/client/src/lib/chat-search.js";

// "Find in chat" is deliberately naive: literal text, always case-insensitive,
// no regex or operators. These checks pin that contract, and pin the two things
// the UI depends on being exactly right — the 1-based message number handed to
// /goto, and the snippet offsets used to mark the match.

const messages: ChatSearchMessage[] = [
  { id: "a", role: "assistant", content: "The bell over the door goes off." },
  { id: "b", role: "user", content: "Mira called last night. First time since the funeral." },
  { id: "c", role: "assistant", content: '"Then she means it." A pause. "*Mira* is careful with that word."' },
  { id: "d", role: "user", content: "Nothing happened today." },
  { id: "e", role: "user", content: "" },
  { id: "f", role: "assistant" },
];

// ── Basic matching, in chat order, with 1-based numbers ────────────────
const mira = findChatSearchHits(messages, "Mira");
assert.deepEqual(
  mira.map((hit) => hit.messageNumber),
  [2, 3],
  "message numbers are 1-based positions /goto can jump to",
);
assert.deepEqual(
  mira.map((hit) => hit.messageId),
  ["b", "c"],
);

// ── Case-insensitive in both directions, and no regex ─────────────────
assert.equal(findChatSearchHits(messages, "mira").length, 2, "lowercase query matches capitalised text");
assert.equal(findChatSearchHits(messages, "MIRA").length, 2, "uppercase query matches too");
assert.equal(findChatSearchHits(messages, "M.ra").length, 0, "'.' is literal, not a regex wildcard");
assert.equal(findChatSearchHits(messages, "Mira|bell").length, 0, "'|' is literal, not alternation");
assert.equal(findChatSearchHits(messages, "(Mira").length, 0, "an unbalanced paren must not throw or match");

// ── Empty and whitespace queries return nothing, never everything ──────
assert.deepEqual(findChatSearchHits(messages, ""), []);
assert.deepEqual(findChatSearchHits(messages, "   "), []);
assert.deepEqual(findChatSearchHits(undefined, "Mira"), []);
assert.deepEqual(findChatSearchHits([], "Mira"), []);

// Messages with empty or absent content must not match or crash.
assert.equal(
  findChatSearchHits(messages, "Mira").some((hit) => hit.messageId === "e" || hit.messageId === "f"),
  false,
);

// ── Formatting must not hide a match ──────────────────────────────────
// Message "c" wraps Mira in asterisks; the reader sees the word, so search must too.
assert.ok(
  mira.some((hit) => hit.messageId === "c"),
  "a word inside *emphasis* is still findable",
);
assert.equal(
  toSearchableText("*Mira*").length,
  "*Mira*".length,
  "stripping formatting must preserve length, or snippet offsets drift",
);

// ── Snippet offsets point at the match in the snippet, not the source ──
for (const hit of mira) {
  assert.equal(
    hit.snippet.slice(hit.matchStart, hit.matchStart + hit.matchLength).toLowerCase(),
    "mira",
    "matchStart/matchLength must select the query inside the snippet",
  );
}

// A match far into a long message is trimmed on the left, and the offset
// accounts for the leading ellipsis.
const long = "x".repeat(400) + "lighthouse" + "y".repeat(400);
const trimmed = buildChatSearchSnippet(long, 400, "lighthouse".length);
assert.ok(trimmed.snippet.startsWith("…"), "a mid-message match trims its left side");
assert.equal(
  trimmed.snippet.slice(trimmed.matchStart, trimmed.matchStart + trimmed.matchLength),
  "lighthouse",
  "the ellipsis is counted in matchStart",
);

// A short message is not trimmed at all.
const short = buildChatSearchSnippet("Mira called.", 0, 4);
assert.equal(short.snippet, "Mira called.");
assert.equal(short.matchStart, 0);

// ── Author metadata is carried through for the result row ─────────────
const withCharacter = findChatSearchHits(
  [{ id: "z", role: "assistant", characterId: "char-1", createdAt: "2026-01-01", content: "a lantern" }],
  "lantern",
);
assert.equal(withCharacter[0]?.characterId, "char-1");
assert.equal(withCharacter[0]?.role, "assistant");
assert.equal(withCharacter[0]?.createdAt, "2026-01-01");

// ── Display order is a view concern; matching stays chronological ──────
const chronological = findChatSearchHits(messages, "Mira");
assert.deepEqual(
  chronological.map((hit) => hit.messageNumber),
  [2, 3],
  "findChatSearchHits must keep chat order regardless of how results are shown",
);

assert.deepEqual(
  sortChatSearchHits(chronological, "newest").map((hit) => hit.messageNumber),
  [3, 2],
  "newest-first lists the latest match first",
);
assert.deepEqual(
  sortChatSearchHits(chronological, "oldest").map((hit) => hit.messageNumber),
  [2, 3],
  "oldest-first preserves chat order",
);

// Sorting must not mutate the caller's array — the panel keeps the
// chronological list around and re-sorts it whenever the toggle flips.
const untouched = findChatSearchHits(messages, "Mira");
sortChatSearchHits(untouched, "newest");
assert.deepEqual(
  untouched.map((hit) => hit.messageNumber),
  [2, 3],
  "sortChatSearchHits must return a new array, not reverse in place",
);

// Round-tripping both directions returns the original order.
assert.deepEqual(
  sortChatSearchHits(sortChatSearchHits(chronological, "newest"), "newest").map((h) => h.messageNumber),
  [2, 3],
  "reversing twice restores chat order",
);

assert.deepEqual(sortChatSearchHits([], "newest"), [], "empty results sort to empty");

console.info("Chat search regression checks passed.");
