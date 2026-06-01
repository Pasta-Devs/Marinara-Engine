import { describe, expect, it } from "vitest";
import { mergeCharacterDetailIntoCharacterJson } from "./character-detail-merge";

describe("mergeCharacterDetailIntoCharacterJson", () => {
  it("adds Chub detail fields and provider extensions to wrapped card JSON without dropping existing metadata", () => {
    const merged = mergeCharacterDetailIntoCharacterJson(
      {
        spec: "chara_card_v2",
        spec_version: "2.0",
        data: {
          name: "Detail Bot",
          extensions: {
            existing: true,
          },
        },
      },
      {
        systemPrompt: "System detail",
        postHistoryInstructions: "Post detail",
        characterVersion: "2.1",
        providerExtensions: {
          chub: { id: "creator/detail-bot" },
          existing: false,
        },
      },
    );

    expect(merged).toMatchObject({
      data: {
        system_prompt: "System detail",
        post_history_instructions: "Post detail",
        character_version: "2.1",
        extensions: {
          chub: { id: "creator/detail-bot" },
          existing: true,
        },
      },
    });
  });
});
