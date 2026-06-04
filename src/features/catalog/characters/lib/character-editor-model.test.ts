import { describe, expect, it } from "vitest";

import { formatCharacterEditorExtension, formatCharacterEditorField } from "./character-editor-model";

describe("character editor quote formatting", () => {
  it("applies configured quote formatting to advanced legacy-covered card fields", () => {
    expect(formatCharacterEditorField("creator_notes", `Creator says "draft".`, "typographic")).toBe(
      "Creator says \u201cdraft\u201d.",
    );
    expect(formatCharacterEditorField("system_prompt", `Stay in "character".`, "typographic")).toBe(
      "Stay in \u201ccharacter\u201d.",
    );
    expect(
      formatCharacterEditorField("post_history_instructions", `Afterward, write "quietly".`, "typographic"),
    ).toBe("Afterward, write \u201cquietly\u201d.");
  });

  it("preserves creator notes style blocks while formatting surrounding prose", () => {
    expect(
      formatCharacterEditorField(
        "creator_notes",
        `Prose says "yes".\n<style data-card-css>\n.bubble::before { content: "raw"; }\n</style>\nAfter says "done".`,
        "typographic",
      ),
    ).toBe(
      "Prose says \u201cyes\u201d.\n<style data-card-css>\n.bubble::before { content: \"raw\"; }\n</style>\nAfter says \u201cdone\u201d.",
    );
  });

  it("formats depth prompt text while preserving depth prompt metadata", () => {
    expect(
      formatCharacterEditorExtension(
        "depth_prompt",
        { prompt: `Remember "the signal".`, depth: 6, role: "assistant", extra: `Leave "raw".` },
        "typographic",
      ),
    ).toEqual({
      prompt: "Remember \u201cthe signal\u201d.",
      depth: 6,
      role: "assistant",
      extra: `Leave "raw".`,
    });
  });
});
