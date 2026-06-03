import { describe, expect, it } from "vitest";

import { MODEL_LISTS } from "./model-lists";

describe("Claude subscription model catalog", () => {
  it("matches the Claude Code subscription selector order", () => {
    expect(MODEL_LISTS.claude_subscription.map((model) => model.id)).toEqual([
      "claude-opus-4-8",
      "claude-opus-4-8[1m]",
      "claude-sonnet-4-6",
      "claude-haiku-4-5",
      "claude-opus-4-7",
      "claude-opus-4-7[1m]",
      "claude-opus-4-6",
    ]);
  });

  it("does not surface retired 4.5 subscription aliases", () => {
    const ids = MODEL_LISTS.claude_subscription.map((model) => model.id);

    expect(ids).not.toContain("claude-opus-4-5");
    expect(ids).not.toContain("claude-sonnet-4-5");
  });
});
