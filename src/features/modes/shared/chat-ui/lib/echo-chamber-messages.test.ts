import { describe, expect, it, vi } from "vitest";
import { normalizeEchoMessages } from "./echo-chamber-messages";

describe("normalizeEchoMessages", () => {
  it("flattens persisted echo_message rows with nested resultData.reactions", () => {
    const createdAt = "2026-05-30T12:00:00.000Z";

    expect(
      normalizeEchoMessages([
        {
          resultType: "echo_message",
          createdAt,
          resultData: {
            reactions: [
              { characterName: "Ada", reaction: "That lands." },
              { characterName: "Bea", reaction: "I am not convinced." },
            ],
          },
        },
      ]),
    ).toEqual([
      { characterName: "Ada", reaction: "That lands.", timestamp: Date.parse(createdAt) },
      { characterName: "Bea", reaction: "I am not convinced.", timestamp: Date.parse(createdAt) },
    ]);
  });

  it("accepts stringified resultData and the legacy flat message shape", () => {
    expect(
      normalizeEchoMessages([
        {
          createdAt: "2026-05-30T12:00:00.000Z",
          resultData: JSON.stringify({
            reactions: [{ characterName: "Cy", reaction: "Nested from disk." }],
          }),
        },
        { characterName: "Dee", reaction: "Flat from older callers.", timestamp: 42 },
      ]),
    ).toEqual([
      { characterName: "Cy", reaction: "Nested from disk.", timestamp: Date.parse("2026-05-30T12:00:00.000Z") },
      { characterName: "Dee", reaction: "Flat from older callers.", timestamp: 42 },
    ]);
  });

  it("skips malformed and should-not-match rows without inventing messages", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-30T12:30:00.000Z"));

    expect(
      normalizeEchoMessages([
        null,
        "not json",
        { resultData: { reactions: "nope" } },
        { characterName: "", reaction: "missing name" },
        { characterName: "Missing reaction", reaction: "" },
        { resultData: { reactions: [{ characterName: "No reaction" }, { reaction: "No name" }] } },
      ]),
    ).toEqual([]);

    vi.useRealTimers();
  });
});
