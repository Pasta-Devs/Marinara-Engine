import { describe, expect, it } from "vitest";
import { chatModeSchema, createChatSchema, generateRequestSchema } from "./chat.schema";

describe("chat schemas", () => {
  it("migrates legacy visual_novel chat modes to roleplay", () => {
    expect(chatModeSchema.parse("visual_novel")).toBe("roleplay");
    expect(createChatSchema.parse({ name: "Legacy VN", mode: "visual_novel" }).mode).toBe("roleplay");
  });

  it("preserves userTimeZone on generation requests", () => {
    const parsed = generateRequestSchema.parse({
      chatId: "chat-1",
      userTimeZone: "America/New_York",
    });

    expect(parsed.userTimeZone).toBe("America/New_York");
  });
});
