import { describe, expect, it } from "vitest";
import type { LlmGateway } from "../capabilities/llm";
import type { MariMessage } from "./mari-entry";
import {
  EMPTY_MARI_COMPACTION,
  compactProfessorMariHistory,
  isMariResetCommand,
  mariContextMessages,
  shouldCompactMariHistory,
} from "./mari-history";

function message(index: number, content = `message ${index}`): MariMessage {
  return {
    id: `message-${index}`,
    role: index % 2 === 0 ? "assistant" : "user",
    content,
    createdAt: new Date(2026, 0, 1, 12, index).toISOString(),
  };
}

describe("Professor Mari history", () => {
  it("recognizes only the explicit reset command", () => {
    expect(isMariResetCommand("/reset")).toBe(true);
    expect(isMariResetCommand(" /RESET ")).toBe(true);
    expect(isMariResetCommand("/reset please")).toBe(false);
    expect(isMariResetCommand("reset")).toBe(false);
  });

  it("uses the compacted summary boundary for context messages", () => {
    const messages = [message(1), message(2), message(3)];

    expect(
      mariContextMessages(messages, {
        compactedSummary: "Earlier events.",
        compactedAt: "2026-01-01T00:00:00.000Z",
        compactedThroughMessageId: "message-2",
      }),
    ).toEqual([messages[2]]);
  });

  it("compacts old messages and keeps recent messages outside the summary", async () => {
    const messages = Array.from({ length: 30 }, (_, index) =>
      message(index + 1, `Long turn ${index + 1}. ${"detail ".repeat(80)}`),
    );
    const llm: LlmGateway = {
      complete: async () => "Compacted notes about the earlier conversation.",
      stream: async function* () {},
      listModels: async () => [],
    };

    expect(shouldCompactMariHistory(messages, EMPTY_MARI_COMPACTION, { maxContext: 1800 })).toBe(true);

    const result = await compactProfessorMariHistory({
      messages,
      compaction: EMPTY_MARI_COMPACTION,
      connection: { id: "conn", model: "model", maxContext: 1800 },
      llm,
    });

    expect(result.compacted).toBe(true);
    expect(result.compaction.compactedSummary).toBe("Compacted notes about the earlier conversation.");
    expect(result.compaction.compactedThroughMessageId).not.toBeNull();
    expect(mariContextMessages(messages, result.compaction).length).toBeGreaterThan(0);
    expect(mariContextMessages(messages, result.compaction).at(-1)?.id).toBe("message-30");
  });
});
