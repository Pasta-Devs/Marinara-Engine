import { describe, expect, it } from "vitest";
import { formatAgentFailuresToast, toAgentFailure } from "./agent-failures";

describe("agent failure formatting", () => {
  it("names the failed agent and classified retry reason", () => {
    const failure = toAgentFailure({
      agentType: "world-state",
      agentName: "World State",
      error: "context_length_exceeded",
    });

    expect(formatAgentFailuresToast([failure])).toBe(
      "World State failed: Context limit. Use the retry button in the chat header to try again.",
    );
  });

  it("summarizes multiple failed agents with a visible cap", () => {
    const failures = ["World State", "Lorebook Keeper", "Continuity", "Haptic"].map((agentName) =>
      toAgentFailure({
        agentType: agentName.toLowerCase().replace(/\s+/g, "-"),
        agentName,
        error: null,
      }),
    );

    expect(formatAgentFailuresToast(failures)).toBe(
      "4 agents failed: World State, Lorebook Keeper, Continuity, +1 more. Use the retry button in the chat header to try again.",
    );
  });
});
