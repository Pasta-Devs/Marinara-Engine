import { describe, expect, it } from "vitest";
import { loadCharacterSprites } from "./sprite.service";

describe("game prompt sprite service", () => {
  it("separates expression sprites, custom full-body aliases, and automatic full-body poses", async () => {
    await expect(
      loadCharacterSprites(
        {
          listSprites: async () => [
            { expression: "neutral" },
            { expression: "joy_01" },
            { expression: "joy_blush" },
            { expression: "full_neutral" },
            { expression: "full_default" },
            { expression: "full_idle" },
            { expression: "full_walk" },
            { expression: "full_battle_stance" },
            { expression: "full_cape_flare" },
            { expression: "full_moonlit_pose" },
          ],
          listBackgrounds: async () => [],
        },
        [{ id: "char-1", name: "Marina" }],
      ),
    ).resolves.toEqual([
      {
        name: "Marina",
        expressions: ["neutral", "joy_01", "joy_blush"],
        expressionChoices: ["neutral", "joy"],
        fullBody: ["cape_flare", "moonlit_pose"],
        automaticFullBody: ["neutral", "default", "idle", "walk", "battle_stance"],
      },
    ]);
  });

  it("loads character sprite info through the visual asset gateway", async () => {
    await expect(
      loadCharacterSprites(
        {
          listSprites: async (ownerId) =>
            ownerId === "char-1"
              ? [{ expression: "smirk" }]
              : ownerId === "char-2"
                ? [{ expression: "full_idle" }]
                : [],
          listBackgrounds: async () => [],
        },
        [
          { id: "char-1", name: "Marina" },
          { id: "char-2", name: "Sol" },
        ],
      ),
    ).resolves.toEqual([
      {
        name: "Marina",
        expressions: ["smirk"],
        expressionChoices: ["smirk"],
        fullBody: [],
        automaticFullBody: [],
      },
    ]);
  });

  it("treats per-character sprite lookup failures as missing optional enrichment", async () => {
    await expect(
      loadCharacterSprites(
        {
          listSprites: async (ownerId) => {
            if (ownerId === "char-1") throw new Error("sprite folder unavailable");
            return [{ expression: "smirk" }];
          },
          listBackgrounds: async () => [],
        },
        [
          { id: "char-1", name: "Marina" },
          { id: "char-2", name: "Sol" },
        ],
      ),
    ).resolves.toEqual([
      {
        name: "Sol",
        expressions: ["smirk"],
        expressionChoices: ["smirk"],
        fullBody: [],
        automaticFullBody: [],
      },
    ]);
  });
});
