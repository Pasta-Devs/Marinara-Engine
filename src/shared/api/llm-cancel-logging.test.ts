import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ignoreLlmStreamCancelFailure, reportLlmStreamCancelFailure } from "./llm-cancel-logging";

describe("LLM stream cancel logging", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("logs sanitized cancel failure details", () => {
    const error = Object.assign(new Error("native cancel failed"), { status: 500 });

    reportLlmStreamCancelFailure("tauri", "stream-1", error);

    expect(warn).toHaveBeenCalledWith("[llm] Stream cancel failed", {
      area: "llm-stream-cancel",
      transport: "tauri",
      streamId: "stream-1",
      error: {
        name: "Error",
        message: "native cancel failed",
        status: 500,
      },
    });
  });

  it("swallows cancel rejections after logging them", async () => {
    await expect(
      ignoreLlmStreamCancelFailure("remote", "stream-2", Promise.reject("remote cancel failed")),
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith("[llm] Stream cancel failed", {
      area: "llm-stream-cancel",
      transport: "remote",
      streamId: "stream-2",
      error: {
        message: "remote cancel failed",
      },
    });
  });

  it("does not log successful cancel requests", async () => {
    await ignoreLlmStreamCancelFailure("remote", "stream-3", Promise.resolve());

    expect(warn).not.toHaveBeenCalled();
  });
});
