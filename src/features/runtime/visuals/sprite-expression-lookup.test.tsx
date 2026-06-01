import { describe, expect, it } from "vitest";
import {
  getSpriteExpressionForCharacter,
  getSpriteExpressionForOwnerKey,
  getSpriteExpressionForPersona,
  normalizeSpriteExpressionMap,
} from "./sprite-expression-lookup";

describe("sprite expression lookup", () => {
  it("normalizes only non-empty string expressions", () => {
    expect(
      normalizeSpriteExpressionMap({
        " character:alice ": " happy ",
        bob: "",
        clara: 42,
      }),
    ).toEqual({ "character:alice": "happy" });
  });

  it("resolves character owner keys before raw ids and names", () => {
    const expressions = {
      "character:alice": "smirk",
      alice: "sad",
      Alice: "happy",
    };

    expect(getSpriteExpressionForCharacter(expressions, "alice", "Alice")).toBe("smirk");
    expect(getSpriteExpressionForOwnerKey(expressions, "character:alice", "Alice")).toBe("smirk");
  });

  it("falls back through raw ids and names for legacy expression maps", () => {
    expect(getSpriteExpressionForCharacter({ Alice: "thinking" }, "alice", "Alice")).toBe("thinking");
    expect(getSpriteExpressionForCharacter({ alice: "worried" }, "alice", "Alice")).toBe("worried");
  });

  it("resolves persona owner keys before legacy persona ids and names", () => {
    const expressions = {
      "persona:hero": "determined",
      hero: "sad",
      Hero: "happy",
    };

    expect(getSpriteExpressionForPersona(expressions, "hero", "Hero")).toBe("determined");
  });
});
