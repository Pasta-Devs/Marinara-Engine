import { describe, expect, it } from "vitest";

import { PERSONA_SUMMARY_FIELDS } from "../lib/persona-summary-fields";

describe("persona summaries", () => {
  it("includes fields used by panel token sorting", () => {
    expect(PERSONA_SUMMARY_FIELDS).toEqual(
      expect.arrayContaining(["description", "personality", "scenario", "backstory", "appearance"]),
    );
  });
});
