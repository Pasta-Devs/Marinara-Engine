import { describe, expect, it } from "vitest";
import { injectAtDepth, type PromptMessage } from "./prompt-injector";

describe("injectAtDepth", () => {
  it("anchors depth entries to provided chat history bounds", () => {
    const messages: PromptMessage[] = [
      { role: "system", content: "system prompt", contextKind: "prompt" },
      { role: "user", content: "history 1", contextKind: "history" },
      { role: "system", content: "context before latest user", contextKind: "prompt" },
      { role: "user", content: "history 2", contextKind: "history" },
      { role: "system", content: "post-history reminder", contextKind: "prompt" },
    ];

    const result = injectAtDepth(
      messages,
      [
        { role: "system", content: "depth 0", depth: 0 },
        { role: "system", content: "depth 1", depth: 1 },
        { role: "system", content: "too deep", depth: 99 },
      ],
      { minIndex: 1, anchorIndex: 4 },
    );

    expect(result.map((message) => message.content)).toEqual([
      "system prompt",
      "too deep",
      "history 1",
      "context before latest user",
      "depth 1",
      "history 2",
      "depth 0",
      "post-history reminder",
    ]);
  });

  it("falls back to the full prompt length when no bounds are provided", () => {
    const messages: PromptMessage[] = [
      { role: "system", content: "system prompt", contextKind: "prompt" },
      { role: "user", content: "history 1", contextKind: "history" },
      { role: "system", content: "post-history reminder", contextKind: "prompt" },
    ];

    const result = injectAtDepth(messages, [{ role: "system", content: "depth 0", depth: 0 }]);

    expect(result.map((message) => message.content)).toEqual([
      "system prompt",
      "history 1",
      "post-history reminder",
      "depth 0",
    ]);
  });
});
