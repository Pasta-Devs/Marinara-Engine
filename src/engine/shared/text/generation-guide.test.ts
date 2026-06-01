import { describe, expect, it } from "vitest";
import {
  buildAmendGenerationInstructionMessage,
  stripGenerationGuideInstruction,
} from "./generation-guide";

describe("amend generation guide", () => {
  it("includes the previous response and revision instruction", () => {
    const guide = buildAmendGenerationInstructionMessage("Condense the prose.", "She walked into the bright room.");

    expect(guide).toContain("Revise the previous generated response");
    expect(guide).toContain("Previous generated response:\nShe walked into the bright room.");
    expect(guide).toContain("Revision instruction:\nCondense the prose.");
  });

  it("strips back to the user revision instruction for replay fallbacks", () => {
    const guide = buildAmendGenerationInstructionMessage("Make the dialogue sharper.", "Original response.");

    expect(stripGenerationGuideInstruction(guide)).toBe("Make the dialogue sharper.");
  });
});
