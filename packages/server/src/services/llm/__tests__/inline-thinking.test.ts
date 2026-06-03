// Unit tests for extractLeadingThinkingBlocks
// Uses the built-in node:test runner (same framework as the rest of the suite).

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { extractLeadingThinkingBlocks } from "../inline-thinking.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function extract(text: string) {
  return extractLeadingThinkingBlocks(text);
}

// ─────────────────────────────────────────────────────────────────────────────
// Basic happy-path cases (regression guard)
// ─────────────────────────────────────────────────────────────────────────────
describe("extractLeadingThinkingBlocks — basic cases", () => {
  it("passes plain text through unchanged", () => {
    const r = extract("Hello, world!");
    assert.equal(r.content, "Hello, world!");
    assert.equal(r.thinking, "");
    assert.equal(r.stripped, false);
  });

  it("extracts a <thinking> block, preserves content after it", () => {
    const r = extract("<thinking>reason</thinking>final answer");
    assert.equal(r.thinking, "reason");
    assert.equal(r.content, "final answer");
    assert.equal(r.stripped, true);
  });

  it("extracts a <think> block", () => {
    const r = extract("<think>reason</think>answer");
    assert.equal(r.thinking, "reason");
    assert.equal(r.content, "answer");
    assert.equal(r.stripped, true);
  });

  it("extracts a <thought> block", () => {
    const r = extract("<thought>reason</thought>answer");
    assert.equal(r.thinking, "reason");
    assert.equal(r.content, "answer");
    assert.equal(r.stripped, true);
  });

  it("extracts multiple consecutive thinking blocks", () => {
    const r = extract("<thinking>first</thinking><thinking>second</thinking>content");
    assert.equal(r.thinking, "first\n\nsecond");
    assert.equal(r.content, "content");
    assert.equal(r.stripped, true);
  });

  it("content is empty when nothing follows the thinking block", () => {
    const r = extract("<thinking>only thinking</thinking>");
    assert.equal(r.thinking, "only thinking");
    assert.equal(r.content, "");
    assert.equal(r.stripped, true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fix 2 & 3: mismatched tag names + attributes
// ─────────────────────────────────────────────────────────────────────────────
describe("extractLeadingThinkingBlocks — mismatched tags & attributes", () => {
  it("handles <think> closed by </thinking>", () => {
    const r = extract("<think>reason</thinking>answer");
    assert.equal(r.thinking, "reason");
    assert.equal(r.content, "answer");
    assert.equal(r.stripped, true);
  });

  it("handles <thinking> closed by </think>", () => {
    const r = extract("<thinking>reason</think>answer");
    assert.equal(r.thinking, "reason");
    assert.equal(r.content, "answer");
    assert.equal(r.stripped, true);
  });

  it("tolerates attributes in the opening tag", () => {
    const r = extract('<thinking type="internal">reason</thinking>answer');
    assert.equal(r.thinking, "reason");
    assert.equal(r.content, "answer");
    assert.equal(r.stripped, true);
  });

  it("tolerates whitespace-only attributes", () => {
    const r = extract("<thinking >reason</thinking>answer");
    assert.equal(r.thinking, "reason");
    assert.equal(r.content, "answer");
    assert.equal(r.stripped, true);
  });

  it("tolerates whitespace inside the closing tag", () => {
    const r = extract("<thinking>reason</think >answer");
    assert.equal(r.thinking, "reason");
    assert.equal(r.content, "answer");
    assert.equal(r.stripped, true);
  });

  it("is case-insensitive for tag names", () => {
    const r = extract("<THINKING>reason</THINKING>answer");
    assert.equal(r.thinking, "reason");
    assert.equal(r.content, "answer");
    assert.equal(r.stripped, true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fix 4: orphan closing tag
// ─────────────────────────────────────────────────────────────────────────────
describe("extractLeadingThinkingBlocks — orphan closing tag", () => {
  it("treats text before an orphan </thinking> as thinking", () => {
    const r = extract("reasoning here\n</thinking>\nfinal answer");
    assert.equal(r.thinking, "reasoning here");
    assert.equal(r.content, "final answer");
    assert.equal(r.stripped, true);
  });

  it("handles bare orphan </think> with nothing before it", () => {
    const r = extract("</think>answer");
    assert.equal(r.thinking, "");
    assert.equal(r.content, "answer");
    assert.equal(r.stripped, true);
  });

  it("handles orphan </thought>", () => {
    const r = extract("some thoughts\n</thought>\nfinal");
    assert.equal(r.thinking, "some thoughts");
    assert.equal(r.content, "final");
    assert.equal(r.stripped, true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fix 1 & 5: content preservation / unclosed tag guard
// ─────────────────────────────────────────────────────────────────────────────
describe("extractLeadingThinkingBlocks — unclosed tag guard", () => {
  it("does not consume text when the opening tag has no matching close", () => {
    const text = "<thinking>truncated response with no closing tag";
    const r = extract(text);
    // The unclosed open tag must NOT swallow the whole text into thinking.
    assert.equal(r.content, text);
    assert.equal(r.thinking, "");
    assert.equal(r.stripped, false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pipe and channel formats (regression guard)
// ─────────────────────────────────────────────────────────────────────────────
describe("extractLeadingThinkingBlocks — pipe / channel formats", () => {
  it("extracts a pipe-style thinking block", () => {
    const r = extract("<|think|>reason<|/think|>answer");
    assert.equal(r.thinking, "reason");
    assert.equal(r.content, "answer");
    assert.equal(r.stripped, true);
  });

  it("extracts a channel-style thinking block", () => {
    const r = extract("<|channel>thought\nreason\n<channel|>answer");
    assert.equal(r.thinking, "reason");
    assert.equal(r.content, "answer");
    assert.equal(r.stripped, true);
  });
});
