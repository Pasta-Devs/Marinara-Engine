import { describe, expect, it } from "vitest";
import { applyCachedContextInjectionsToRegenerateInput } from "../../src/engine/generation/generation-replay";
import type { StartGenerationInput } from "../../src/engine/generation/start-generation-input";

describe("applyCachedContextInjectionsToRegenerateInput", () => {
  it("reuses cached target injections on regeneration and filters Secret Plot", () => {
    const input = { chatId: "chat-1", regenerateMessageId: "msg-2" } as StartGenerationInput;

    const applied = applyCachedContextInjectionsToRegenerateInput(input, [
      "Avoid repeated phrasing.",
      { agentType: "knowledge-router", agentName: "Knowledge Router", text: "Use selected entry." },
      { agentType: "secret-plot-driver", agentName: "Secret Plot Driver", text: "Hidden plot" },
      { agentType: "director", text: "  Let the scene breathe.  " },
    ]);

    expect(applied).toBe(true);
    expect(input.agentInjectionOverrides).toEqual([
      { agentType: "prose-guardian", text: "Avoid repeated phrasing." },
      { agentType: "knowledge-router", agentName: "Knowledge Router", text: "Use selected entry." },
      { agentType: "director", text: "Let the scene breathe." },
    ]);
  });

  it("does not replace explicit review overrides", () => {
    const input = {
      chatId: "chat-1",
      regenerateMessageId: "msg-2",
      agentInjectionOverrides: [{ agentType: "director", text: "Reviewer-approved override." }],
    } as StartGenerationInput;

    const applied = applyCachedContextInjectionsToRegenerateInput(input, [
      { agentType: "director", text: "Cached target text." },
    ]);

    expect(applied).toBe(false);
    expect(input.agentInjectionOverrides).toEqual([{ agentType: "director", text: "Reviewer-approved override." }]);
  });
});
