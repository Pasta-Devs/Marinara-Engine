import { describe, expect, it } from "vitest";
import { gameAssetNegativePrompt, sceneAssetPrompt } from "./game-asset-prompts";

describe("game asset image prompt safeguards", () => {
  it("uses per-kind negative prompts for generated game images", () => {
    expect(gameAssetNegativePrompt("portrait")).toContain("duplicated face");
    expect(gameAssetNegativePrompt("portrait")).toContain("four portraits");
    expect(gameAssetNegativePrompt("background")).toContain("people");
    expect(gameAssetNegativePrompt("background")).toContain("multiple frames");
    expect(gameAssetNegativePrompt("illustration")).toContain("unrelated character");
    expect(gameAssetNegativePrompt("illustration")).toContain("character sheet");
  });

  it("preserves explicit non-human NPC species in portrait prompts", () => {
    const prompt = sceneAssetPrompt(
      "portrait",
      "Mossbell",
      "ancient stone golem with glowing eyes and mossy shoulders",
      "painterly fantasy visual novel art",
      { format: "descriptive" },
    );

    expect(prompt).toContain("Preserve that exact species, body plan, age category, and silhouette");
    expect(prompt).toContain("do not turn it into a human or kemonomimi");
  });

  it("keeps human NPC portraits from drifting into animal subjects", () => {
    const prompt = sceneAssetPrompt(
      "portrait",
      "Raven",
      "black coat, sharp smile, silver earrings",
      "painterly fantasy visual novel art",
      { format: "descriptive" },
    );

    expect(prompt).toContain("depict this NPC as a human or humanoid person");
    expect(prompt).toContain("Do not infer an animal species from the name, mood, speech verbs, or setting");
  });

  it("still allows explicit non-human names when no description is available", () => {
    const prompt = sceneAssetPrompt("portrait", "Talking Cat", "", "storybook game art", {
      format: "descriptive",
      includeAppearances: false,
    });

    expect(prompt).toContain("Preserve that exact species");
  });

  it("keeps portrait species safeguards in tag-format prompts", () => {
    const prompt = sceneAssetPrompt(
      "portrait",
      "Amber",
      "small fox spirit wearing a travel satchel",
      "storybook game art",
      { format: "tags" },
    );

    expect(prompt).toContain("Preserve that exact species");
    expect(prompt).toContain("centered bust portrait");
  });
});
