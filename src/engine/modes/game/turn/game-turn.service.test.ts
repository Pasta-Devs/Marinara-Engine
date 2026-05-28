import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerationEngineDeps, StartGenerationInput } from "../../../generation/start-generation";
import { startGeneration } from "../../../generation/start-generation";
import { startGameTurnGeneration } from "./game-turn.service";

vi.mock("../../../generation/start-generation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../generation/start-generation")>();
  return {
    ...actual,
    startGeneration: vi.fn(async function* (_deps: GenerationEngineDeps, input: StartGenerationInput) {
      yield { type: "phase" as const, data: input.generationGuideSource };
    }),
  };
});

function gameDeps() {
  const storageGet = vi.fn(async () => ({
    id: "chat-1",
    mode: "game",
    metadata: { gameSessionStatus: "active" },
  }));
  return {
    deps: {
      storage: { get: storageGet },
      llm: {},
      integrations: {},
    } as unknown as GenerationEngineDeps,
    storageGet,
  };
}

async function drain(stream: AsyncGenerator<unknown>) {
  const events: unknown[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

describe("startGameTurnGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no-ops explicit whitespace-only player turns before storage or model work", async () => {
    const { deps, storageGet } = gameDeps();

    const events = await drain(startGameTurnGeneration(deps, { chatId: "chat-1", kind: "turn", userMessage: " \n\t " }));

    expect(events).toEqual([]);
    expect(storageGet).not.toHaveBeenCalled();
    expect(startGeneration).not.toHaveBeenCalled();
  });

  it("still allows passive game turn retries when no player message was supplied", async () => {
    const { deps, storageGet } = gameDeps();

    const events = await drain(startGameTurnGeneration(deps, { chatId: "chat-1", kind: "turn" }));

    expect(events).toEqual([{ type: "phase", data: "game_turn" }]);
    expect(storageGet).toHaveBeenCalledWith("chats", "chat-1");
    expect(startGeneration).toHaveBeenCalledWith(
      deps,
      expect.objectContaining({ chatId: "chat-1", kind: "turn", generationGuideSource: "game_turn" }),
      undefined,
    );
  });

  it("allows attachment-only player turns", async () => {
    const { deps } = gameDeps();

    const events = await drain(
      startGameTurnGeneration(deps, {
        chatId: "chat-1",
        kind: "turn",
        userMessage: " ",
        attachments: [{ type: "image/png", data: "data:image/png;base64,abc" }],
      }),
    );

    expect(events).toEqual([{ type: "phase", data: "game_turn" }]);
    expect(startGeneration).toHaveBeenCalledWith(
      deps,
      expect.objectContaining({ chatId: "chat-1", kind: "turn", generationGuideSource: "game_turn" }),
      undefined,
    );
  });
});
