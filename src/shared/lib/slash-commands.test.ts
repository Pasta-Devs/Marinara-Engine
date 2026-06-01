import { describe, expect, it, vi } from "vitest";
import { matchSlashCommand, type SlashCommandContext } from "./slash-commands";

type Generate = SlashCommandContext["generate"];

function createGenerateMock() {
  return vi.fn<Generate>(async () => true);
}

function baseContext(generate: Generate = createGenerateMock()): SlashCommandContext {
  return {
    chatId: "chat-1",
    mode: "roleplay",
    generate,
    createMessage: vi.fn(),
    invalidate: vi.fn(),
    characterNames: ["Marinara"],
    latestAssistantMessage: {
      id: "message-2",
      content: "The party waits in another empty office floor.",
    },
  };
}

describe("slash commands", () => {
  it("runs /amend against the latest assistant response as a regeneration", async () => {
    const generate = createGenerateMock();
    const matched = matchSlashCommand("/amend The party should reach the rooftop instead.");

    expect(matched?.command.name).toBe("amend");
    const result = await matched!.command.execute(matched!.args, baseContext(generate));

    expect(result).toEqual({ handled: true });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "chat-1",
        connectionId: null,
        regenerateMessageId: "message-2",
        generationGuideSource: "amend",
      }),
    );
    const firstCall = generate.mock.calls[0];
    expect(firstCall).toBeDefined();
    const guide = firstCall![0].generationGuide;
    expect(guide).toContain("The party waits in another empty office floor.");
    expect(guide).toContain("The party should reach the rooftop instead.");
  });

  it("keeps /amend local when no assistant response exists", async () => {
    const generate = createGenerateMock();
    const matched = matchSlashCommand("/amend Make it shorter.");

    const result = await matched!.command.execute(matched!.args, {
      ...baseContext(generate),
      latestAssistantMessage: null,
    });

    expect(result).toEqual({
      handled: true,
      feedback: "There is no assistant response to amend yet.",
    });
    expect(generate).not.toHaveBeenCalled();
  });
});
