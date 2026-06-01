import { describe, expect, it } from "vitest";
import { readStoredThinking } from "./message-thinking";

describe("readStoredThinking", () => {
  it("prefers normalized app thinking metadata", () => {
    expect(
      readStoredThinking({
        thinking: "app thinking",
        reasoning_content: "provider reasoning",
        reasoning: "fallback reasoning",
      }),
    ).toBe("app thinking");
  });

  it("falls back to provider reasoning_content metadata", () => {
    expect(readStoredThinking({ reasoning_content: "ollama reasoning" })).toBe("ollama reasoning");
  });

  it("falls back to provider reasoning metadata", () => {
    expect(readStoredThinking({ reasoning: "provider reasoning" })).toBe("provider reasoning");
  });

  it("skips blank higher-priority fields", () => {
    expect(readStoredThinking({ thinking: "   ", reasoning_content: "provider reasoning" })).toBe(
      "provider reasoning",
    );
  });

  it("ignores non-string metadata", () => {
    expect(readStoredThinking({ reasoning_content: ["provider reasoning"] })).toBeNull();
  });
});
