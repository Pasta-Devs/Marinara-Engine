import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentContext } from "../contracts/types/agent";
import { createAgentRuntimeDebug } from "./debug";

const baseContext: AgentContext = {
  chatId: "chat-1",
  chatMode: "roleplay",
  recentMessages: [],
  mainResponse: null,
  gameState: null,
  characters: [],
  persona: null,
  memory: {},
  activatedLorebookEntries: [],
  writableLorebookIds: null,
  chatSummary: null,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createAgentRuntimeDebug", () => {
  it("does not emit console or structured debug entries unless debug mode is enabled", () => {
    const sink = vi.fn();
    const consoleDebug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const logger = createAgentRuntimeDebug({ ...baseContext, debugMode: false, debugSink: sink });

    logger.debug("hidden");
    logger.emit({ level: "debug", phase: "pre_generation", message: "hidden" });

    expect(logger.enabled).toBe(false);
    expect(logger.isLevelEnabled("debug")).toBe(false);
    expect(consoleDebug).not.toHaveBeenCalled();
    expect(sink).not.toHaveBeenCalled();
  });

  it("emits console and structured debug entries when debug mode is enabled", () => {
    const sink = vi.fn();
    const consoleDebug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const logger = createAgentRuntimeDebug({ ...baseContext, debugMode: true, debugSink: sink });

    logger.debug("visible");
    logger.emit({ level: "debug", phase: "pre_generation", message: "visible" });

    expect(logger.enabled).toBe(true);
    expect(logger.isLevelEnabled("debug")).toBe(true);
    expect(consoleDebug).toHaveBeenCalledWith("visible");
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "debug",
        phase: "pre_generation",
        message: "visible",
        timestamp: expect.any(Number),
      }),
    );
  });
});
