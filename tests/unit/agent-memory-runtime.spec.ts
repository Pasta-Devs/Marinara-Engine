import { describe, expect, it } from "vitest";
import type { AgentResult } from "../../src/engine/contracts/types/agent";
import type { StorageGateway } from "../../src/engine/capabilities/storage";
import {
  persistSecretPlotAgentMemory,
  secretPlotPromptGuidanceFromData,
} from "../../src/engine/generation/agent-memory-runtime";

function memoryStorage(rows: Array<Record<string, unknown>>): StorageGateway {
  return {
    async list(collection, options) {
      if (collection !== "agent-memory") return [] as never;
      const filters = (options?.filters ?? {}) as Record<string, unknown>;
      return rows.filter((row) =>
        Object.entries(filters).every(([key, value]) => value === undefined || row[key] === value),
      ) as never;
    },
    async update(collection, id, patch) {
      if (collection !== "agent-memory") return null as never;
      const row = rows.find((entry) => entry.id === id);
      if (row) Object.assign(row, patch);
      return row as never;
    },
    async create(collection, value) {
      if (collection !== "agent-memory") return value as never;
      const row = { id: `row-${rows.length + 1}`, ...(value as Record<string, unknown>) };
      rows.push(row);
      return row as never;
    },
  } as StorageGateway;
}

function secretPlotResult(data: Record<string, unknown>): AgentResult {
  return {
    agentId: "secret-plot-config",
    agentType: "secret-plot-driver",
    type: "secret_plot",
    data,
    tokensUsed: 0,
    durationMs: 0,
    success: true,
    error: null,
  };
}

describe("secret plot memory runtime", () => {
  it("formats active arc and scene directions as hidden main-prompt guidance", () => {
    const guidance = secretPlotPromptGuidanceFromData({
      overarchingArc: { description: "A lost treaty resurfaces.", protagonistArc: "Trust becomes costly." },
      sceneDirections: [
        { direction: "Let the clue surface quietly.", fulfilled: false },
        { direction: "Resolve the old detour.", fulfilled: true },
      ],
    });

    expect(guidance).toContain("<overarching_arc>");
    expect(guidance).toContain("- Let the clue surface quietly.");
    expect(
      secretPlotPromptGuidanceFromData({
        sceneDirections: [{ direction: "Resolve the old detour.", fulfilled: true }],
      }),
    ).toBeNull();
  });

  it("allows full reroll to clear an explicit empty arc", async () => {
    const rows = [
      {
        id: "arc-row",
        agentConfigId: "secret-plot-config",
        chatId: "chat-1",
        key: "overarchingArc",
        value: JSON.stringify({ description: "Existing arc" }),
      },
    ];
    const storage = memoryStorage(rows);

    await persistSecretPlotAgentMemory(storage, "chat-1", [
      secretPlotResult({ overarchingArc: null, sceneDirections: [] }),
    ]);

    expect(rows[0]?.value).toBe("null");
  });

  it("preserves the existing arc on turn-only reroll", async () => {
    const rows = [
      {
        id: "arc-row",
        agentConfigId: "secret-plot-config",
        chatId: "chat-1",
        key: "overarchingArc",
        value: JSON.stringify({ description: "Existing arc" }),
      },
    ];
    const storage = memoryStorage(rows);

    await persistSecretPlotAgentMemory(
      storage,
      "chat-1",
      [secretPlotResult({ overarchingArc: null, sceneDirections: [] })],
      { rerollMode: "turn_only" },
    );

    expect(rows[0]?.value).toBe(JSON.stringify({ description: "Existing arc" }));
  });
});
