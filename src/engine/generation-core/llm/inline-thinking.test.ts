import { describe, expect, it } from "vitest";

import { createInlineThinkingStreamParser } from "./inline-thinking";

function parseInlineThinking(chunks: string[]): { content: string; thinking: string } {
  const parser = createInlineThinkingStreamParser();
  let content = "";
  let thinking = "";

  for (const chunk of chunks) {
    for (const part of parser.push(chunk)) {
      if (part.type === "content") content += part.text;
      else thinking += part.text;
    }
  }

  for (const part of parser.flush()) {
    if (part.type === "content") content += part.text;
    else thinking += part.text;
  }

  return { content, thinking };
}

describe("createInlineThinkingStreamParser", () => {
  it("keeps reply text after a closed thinking block as content", () => {
    expect(parseInlineThinking(["<thinking>\ninternal reasoning\n</thinking>\nThis is visible."])).toEqual({
      thinking: "\ninternal reasoning\n",
      content: "\nThis is visible.",
    });
  });

  it("handles think tags followed by visible content without whitespace", () => {
    expect(parseInlineThinking(["<think>reasoning</think>reply"])).toEqual({
      thinking: "reasoning",
      content: "reply",
    });
  });

  it("preserves content when closing tags are split across stream chunks", () => {
    expect(parseInlineThinking(["<thinking>reason", "ing</thin", "king>visible reply"])).toEqual({
      thinking: "reasoning",
      content: "visible reply",
    });
  });

  it("accepts mismatched thinking close tag forms", () => {
    expect(parseInlineThinking(["<thinking>reasoning</think>reply", "<think>more</thinking> text"])).toEqual({
      thinking: "reasoningmore",
      content: "reply text",
    });
  });

  it("drops orphan closing thinking tags while preserving following reply text", () => {
    expect(parseInlineThinking(["</thinking>reply"])).toEqual({
      thinking: "",
      content: "reply",
    });
  });

  it("waits for split orphan closing tags before emitting following content", () => {
    expect(parseInlineThinking(["</thin", "king>reply"])).toEqual({
      thinking: "",
      content: "reply",
    });
  });

  it("keeps unrelated tags as visible content", () => {
    expect(parseInlineThinking(["</not-thinking>reply <xml>visible</xml>"])).toEqual({
      thinking: "",
      content: "</not-thinking>reply <xml>visible</xml>",
    });
  });
});
