import { describe, expect, it } from "vitest";
import { getDefaultBuiltInAgentSettings } from "../../engine/contracts/types/agent";
import { getAgentRunIntervalMeta } from "./agent-cadence";

describe("agent cadence metadata", () => {
  it("exposes Illustrator assistant-message run interval parity", () => {
    expect(getDefaultBuiltInAgentSettings("illustrator")).toMatchObject({ runInterval: 5 });
    expect(getAgentRunIntervalMeta("illustrator", true)).toEqual({
      label: "Run Interval",
      unit: "assistant messages",
      help: "How many assistant messages should pass before the Illustrator is allowed to create another image.",
      defaultValue: 5,
      max: 100,
    });
  });
});
