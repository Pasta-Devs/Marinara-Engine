import { describe, expect, it } from "vitest";
import { worldStatePatchFromAgentData } from "./world-state-agent-result";

describe("worldStatePatchFromAgentData", () => {
  it("uses explicit narration facts over vague or missing agent output", () => {
    const patch = worldStatePatchFromAgentData(
      {
        date: null,
        time: "Late evening",
        temperature: "Cool",
      },
      {
        sourceText: "It is Monday at 7:30 PM, and the apartment thermometer reads 68\u00b0F.",
        previousWorldState: {
          date: "Sunday",
          time: "6:00 PM",
          temperature: "72\u00b0F",
        },
      },
    );

    expect(patch).toEqual({
      date: "Monday",
      time: "7:30 PM",
      temperature: "68\u00b0F",
    });
  });

  it("preserves prior day, time, and temperature when the latest narration is silent", () => {
    const patch = worldStatePatchFromAgentData(
      {
        date: "Tuesday",
        time: "Morning",
        temperature: "Mild",
      },
      {
        sourceText: "They keep talking in the apartment, neither checking the clock nor mentioning the weather.",
        previousWorldState: {
          date: "Monday",
          time: "7:30 PM",
          temperature: "68\u00b0F",
        },
      },
    );

    expect(patch).toEqual({
      date: "Monday",
      time: "7:30 PM",
      temperature: "68\u00b0F",
    });
  });

  it("allows agent updates when the latest narration mentions the field changing", () => {
    const patch = worldStatePatchFromAgentData(
      {
        date: "Monday",
        time: "10:30 PM",
        temperature: "Chilly",
      },
      {
        sourceText: "Hours later, the air turns chilly as they keep watch near the open window.",
        previousWorldState: {
          date: "Monday",
          time: "7:30 PM",
          temperature: "68\u00b0F",
        },
      },
    );

    expect(patch).toEqual({
      date: "Monday",
      time: "10:30 PM",
      temperature: "Chilly",
    });
  });
});
