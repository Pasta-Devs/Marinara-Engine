import { describe, expect, it } from "vitest";

import { buildGmSystemPrompt, type GmPromptContext } from "./gm-prompts";

function makeGmPromptContext(rating: GmPromptContext["rating"]): GmPromptContext {
  return {
    gameActiveState: "exploration",
    storyArc: null,
    plotTwists: null,
    map: null,
    npcs: [],
    sessionSummaries: [],
    sessionNumber: 1,
    partyNames: [],
    playerName: "Player",
    gmCharacterCard: null,
    difficulty: "normal",
    genre: "fantasy",
    setting: "test setting",
    tone: "adventurous",
    rating,
  };
}

describe("buildGmSystemPrompt", () => {
  it("preserves assault in the NSFW dark-actions guideline", () => {
    const prompt = buildGmSystemPrompt(makeGmPromptContext("nsfw"));

    expect(prompt).toContain("mutilate, assault, kill themselves or others");
  });

  it("keeps the dark-actions verb list out of the SFW guideline", () => {
    const prompt = buildGmSystemPrompt(makeGmPromptContext("sfw"));

    expect(prompt).not.toContain("mutilate, assault, kill themselves or others");
  });
});
