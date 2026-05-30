import { describe, expect, it, vi } from "vitest";
import type { LlmGateway, LlmRequest } from "../capabilities/llm";
import type { StorageGateway } from "../capabilities/storage";
import { reviewPromptPreset, type PromptReviewEvent } from "./prompt-reviewer";

function storageGateway(preset: Record<string, unknown> | null = { id: "preset-1", name: "Test Preset" }) {
  return {
    get: vi.fn(async (entity: string, id: string) => (entity === "prompts" && id === "preset-1" ? preset : null)),
    promptFull: vi.fn(async () => ({
      preset,
      groups: [],
      choiceBlocks: [],
      sections: [
        {
          id: "section-1",
          name: "System",
          role: "system",
          enabled: true,
          content: "Stay in character.",
        },
      ],
    })),
    list: vi.fn(async () => []),
  } as Partial<StorageGateway> as StorageGateway;
}

function llmGateway(response: string, requests: LlmRequest[] = []): LlmGateway {
  return {
    complete: vi.fn(async (request: LlmRequest) => {
      requests.push(request);
      return response;
    }),
    async *stream() {},
    listModels: vi.fn(async () => []),
  };
}

async function collectReviewEvents(storage: StorageGateway, llm: LlmGateway): Promise<PromptReviewEvent[]> {
  const events: PromptReviewEvent[] = [];
  for await (const event of reviewPromptPreset({ storage, llm }, { presetId: "preset-1", connectionId: "conn-1" })) {
    events.push(event);
  }
  return events;
}

describe("reviewPromptPreset", () => {
  it("requests JSON mode and emits normalized JSON for valid prompt reviews", async () => {
    const review = {
      overall_score: 8,
      summary: "Clear and focused.",
      sections: [{ area: "clarity", score: 8, findings: "Direct.", suggestions: ["Keep it concise."] }],
      token_estimate: 1200,
      warnings: [],
      best_practices: ["Uses clear roles."],
    };
    const requests: LlmRequest[] = [];

    const events = await collectReviewEvents(storageGateway(), llmGateway(JSON.stringify(review), requests));

    const normalized = JSON.stringify(review, null, 2);
    expect(events).toEqual([
      { type: "token", data: normalized },
      { type: "done", data: normalized },
    ]);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      connectionId: "conn-1",
      parameters: {
        temperature: 0.7,
        maxTokens: 8192,
        responseFormat: "json_object",
      },
    });
    expect(requests[0]?.messages.map((message) => message.content).join("\n")).toContain("Stay in character.");
  });

  it("emits a clear error event when the reviewer returns malformed JSON", async () => {
    const events = await collectReviewEvents(storageGateway(), llmGateway("{ invalid json"));

    expect(events).toEqual([
      {
        type: "error",
        data: "Prompt Reviewer returned malformed JSON. Try again or use a model/provider with JSON mode support.",
      },
    ]);
    expect(events.some((event) => event.type === "done")).toBe(false);
  });

  it("emits a clear error event when the reviewer returns non-object JSON", async () => {
    const events = await collectReviewEvents(storageGateway(), llmGateway("null"));

    expect(events).toEqual([
      {
        type: "error",
        data: "Prompt Reviewer returned malformed JSON. Try again or use a model/provider with JSON mode support.",
      },
    ]);
    expect(events.some((event) => event.type === "done")).toBe(false);
  });

  it("throws when the preset is missing", async () => {
    await expect(collectReviewEvents(storageGateway(null), llmGateway("{}"))).rejects.toThrow(
      "Prompt preset not found.",
    );
  });
});
