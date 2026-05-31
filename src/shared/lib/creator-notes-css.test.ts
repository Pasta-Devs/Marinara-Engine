import { describe, expect, it } from "vitest";
import { extractCreatorNotesCss } from "./creator-notes-css";

describe("extractCreatorNotesCss", () => {
  it("extracts style blocks and leaves non-style creator notes text", () => {
    const result = extractCreatorNotesCss(
      "Intro\n<style>.card { color: red; }</style>\nMiddle\n<style data-card>.name { color: blue; }</style>\nOutro",
    );

    expect(result.css).toBe(".card { color: red; }\n.name { color: blue; }");
    expect(result.text).toBe("Intro\n\nMiddle\n\nOutro");
  });
});
