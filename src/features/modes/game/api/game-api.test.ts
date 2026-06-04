import { describe, expect, it } from "vitest";
import { gameAssetNegativePrompt, gameImageGenerationRequest, sceneAssetPrompt } from "./game-asset-prompts";

describe("game asset image prompt safeguards", () => {
  it("uses per-kind negative prompts for generated game images", () => {
    expect(gameAssetNegativePrompt("portrait")).toContain("duplicated face");
    expect(gameAssetNegativePrompt("portrait")).toContain("four portraits");
    expect(gameAssetNegativePrompt("background")).toContain("people");
    expect(gameAssetNegativePrompt("background")).toContain("multiple frames");
    expect(gameAssetNegativePrompt("illustration")).toContain("unrelated character");
    expect(gameAssetNegativePrompt("illustration")).toContain("character sheet");
  });

  it("builds image generation request payloads with negative prompts and illustration references", () => {
    expect(
      gameImageGenerationRequest("image-connection", {
        kind: "portrait",
        prompt: "Portrait of Raven",
        negativePrompt: gameAssetNegativePrompt("portrait"),
        width: 768,
        height: 1024,
      }),
    ).toEqual({
      connectionId: "image-connection",
      prompt: "Portrait of Raven",
      negativePrompt: gameAssetNegativePrompt("portrait"),
      width: 768,
      height: 1024,
    });

    expect(
      gameImageGenerationRequest("image-connection", {
        kind: "illustration",
        prompt: "Scene illustration",
        negativePrompt: gameAssetNegativePrompt("illustration"),
        width: 1024,
        height: 768,
        referenceImages: ["ref-a", "ref-b"],
      }),
    ).toEqual({
      connectionId: "image-connection",
      prompt: "Scene illustration",
      negativePrompt: gameAssetNegativePrompt("illustration"),
      width: 1024,
      height: 768,
      referenceImages: ["ref-a", "ref-b"],
    });
  });

  it("preserves explicit non-human NPC species in portrait prompts", () => {
    const golemPrompt = sceneAssetPrompt(
      "portrait",
      "Mossbell",
      "ancient stone golem with glowing eyes and mossy shoulders",
      "painterly fantasy visual novel art",
      { format: "descriptive" },
    );
    const catPrompt = sceneAssetPrompt(
      "portrait",
      "Whisk",
      "black cat with green eyes and a brass collar",
      "painterly fantasy visual novel art",
      { format: "descriptive" },
    );
    const foxPrompt = sceneAssetPrompt(
      "portrait",
      "Copper",
      "red fox wearing a tiny travel satchel",
      "painterly fantasy visual novel art",
      { format: "descriptive" },
    );

    expect(golemPrompt).toContain("Preserve that exact species, body plan, age category, and silhouette");
    expect(catPrompt).toContain("Preserve that exact species, body plan, age category, and silhouette");
    expect(foxPrompt).toContain("Preserve that exact species, body plan, age category, and silhouette");
    expect(golemPrompt).toContain("do not turn it into a human or kemonomimi");
  });

  it("keeps human NPC portraits from drifting into animal subjects", () => {
    const ravenPrompt = sceneAssetPrompt(
      "portrait",
      "Raven",
      "black coat, sharp smile, silver earrings",
      "painterly fantasy visual novel art",
      { format: "descriptive" },
    );
    const foxPrompt = sceneAssetPrompt(
      "portrait",
      "Mira",
      "fox-masked scout with raven-haired bangs and a crimson cloak",
      "painterly fantasy visual novel art",
      { format: "descriptive" },
    );
    const cloakPrompt = sceneAssetPrompt(
      "portrait",
      "Toma",
      "ranger in a wolf cloak and owl-feather brooch",
      "painterly fantasy visual novel art",
      { format: "descriptive" },
    );
    const spiritPrompt = sceneAssetPrompt(
      "portrait",
      "Spirit",
      "quiet bard with a weathered lute",
      "painterly fantasy visual novel art",
      { format: "descriptive" },
    );

    expect(ravenPrompt).toContain("depict this NPC as a human or humanoid person");
    expect(ravenPrompt).toContain("Do not infer an animal species from the name, mood, speech verbs, or setting");
    expect(foxPrompt).toContain("depict this NPC as a human or humanoid person");
    expect(foxPrompt).toContain("Do not infer an animal species from the name, mood, speech verbs, or setting");
    expect(cloakPrompt).toContain("depict this NPC as a human or humanoid person");
    expect(spiritPrompt).toContain("depict this NPC as a human or humanoid person");
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
