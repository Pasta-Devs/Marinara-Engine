import { describe, expect, it } from "vitest";
import { chatSummaryFingerprintMatches, fingerprintChatSummary } from "./chat-summary-fingerprint";

describe("chat summary fingerprints", () => {
  it("matches the legacy v1.6.1 whitespace normalization and base36 hash format", () => {
    expect(fingerprintChatSummary("The user met Nia at the market.")).toBe("176fv69");
    expect(fingerprintChatSummary("  The\nuser\tmet  Nia at the market.  ")).toBe("176fv69");
  });

  it("uses legacy stale-summary matching semantics", () => {
    const current = fingerprintChatSummary("The user met Nia at the market.");

    expect(chatSummaryFingerprintMatches({ chatSummaryFingerprint: current }, current)).toBe(true);
    expect(chatSummaryFingerprintMatches({ chatSummaryFingerprint: "different" }, current)).toBe(false);
    expect(chatSummaryFingerprintMatches({}, current)).toBe(false);
  });
});
