import { describe, expect, it } from "vitest";

import { effectiveMaxContext } from "./context-window";

describe("effectiveMaxContext", () => {
  it("uses known model context when useMaxContext is enabled", () => {
    expect(
      effectiveMaxContext(
        { provider: "openai", model: "gpt-4.1", maxContext: 2_000_000 },
        { maxContext: 128_000, useMaxContext: true },
      ),
    ).toBe(1_047_576);
  });

  it("falls back to connection context when useMaxContext is enabled for an unknown model", () => {
    expect(
      effectiveMaxContext(
        { provider: "nanogpt", model: "external-model", maxContext: 256_000 },
        { maxContext: 128_000, useMaxContext: true },
      ),
    ).toBe(256_000);
  });

  it("clamps to the smallest positive context limit", () => {
    expect(
      effectiveMaxContext(
        { provider: "openai", model: "gpt-4.1", maxContext: 80_000 },
        { maxContext: 128_000, useMaxContext: true },
      ),
    ).toBe(80_000);

    expect(
      effectiveMaxContext(
        { provider: "openai", model: "gpt-4.1", maxContext: 2_000_000 },
        { maxContext: 64_000, useMaxContext: false },
      ),
    ).toBe(64_000);
  });

  it("ignores null, undefined, zero, and negative limits", () => {
    expect(effectiveMaxContext(null, { maxContext: 0, useMaxContext: false })).toBe(0);
    expect(effectiveMaxContext(undefined, { maxContext: -1, useMaxContext: false })).toBe(0);
    expect(
      effectiveMaxContext(
        { provider: "openai", model: "gpt-4.1", maxContext: null },
        { maxContext: undefined, useMaxContext: true },
      ),
    ).toBe(1_047_576);
  });
});
