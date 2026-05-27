import { describe, expect, it } from "vitest";
import {
  DEFAULT_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH,
  MAX_CUSTOM_AGENT_ACTIVATION_KEYWORDS,
  MAX_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH,
  normalizeCustomAgentActivationKeywords,
  normalizeCustomAgentActivationScanDepth,
} from "./agent-activation";

describe("custom agent activation settings", () => {
  it("normalizes legacy keyword strings without duplicates", () => {
    expect(normalizeCustomAgentActivationKeywords("secret, Moonlit ritual\n SECRET \n")).toEqual([
      "secret",
      "Moonlit ritual",
    ]);
  });

  it("caps oversized persisted keyword lists", () => {
    const keywords = Array.from({ length: MAX_CUSTOM_AGENT_ACTIVATION_KEYWORDS + 25 }, (_, index) => `key-${index}`);

    expect(normalizeCustomAgentActivationKeywords(keywords)).toHaveLength(MAX_CUSTOM_AGENT_ACTIVATION_KEYWORDS);
  });

  it("normalizes malformed activation scan depths", () => {
    expect(normalizeCustomAgentActivationScanDepth("3")).toBe(3);
    expect(normalizeCustomAgentActivationScanDepth(0)).toBe(1);
    expect(normalizeCustomAgentActivationScanDepth(MAX_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH + 1)).toBe(
      MAX_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH,
    );
    expect(normalizeCustomAgentActivationScanDepth("")).toBe(DEFAULT_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH);
    expect(normalizeCustomAgentActivationScanDepth("nope")).toBe(DEFAULT_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH);
  });
});
