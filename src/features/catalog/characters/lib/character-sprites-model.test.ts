import { describe, expect, it } from "vitest";

import { displaySpriteExpressionForCategory, normalizeSpriteExpressionForCategory } from "./character-sprites-model";

describe("character sprites model", () => {
  it("normalizes expression sprite names", () => {
    expect(normalizeSpriteExpressionForCategory(" Happy Face! ", "expressions")).toBe("happy_face_");
    expect(normalizeSpriteExpressionForCategory("full_idle", "expressions")).toBe("idle");
  });

  it("normalizes full-body sprite names", () => {
    expect(normalizeSpriteExpressionForCategory("Battle Stance", "full-body")).toBe("full_battle_stance");
    expect(normalizeSpriteExpressionForCategory("full_idle", "full-body")).toBe("full_idle");
  });

  it("displays category-specific sprite names", () => {
    expect(displaySpriteExpressionForCategory("full_idle", "full-body")).toBe("idle");
    expect(displaySpriteExpressionForCategory("happy", "expressions")).toBe("happy");
  });
});
