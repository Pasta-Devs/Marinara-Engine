import { describe, expect, it } from "vitest";
import { runProfessorMariEntry, type MariGateway } from "./mari-entry";

const baseRequest = {
  userMessage: "Hello",
  messages: [],
  connectionId: "connection",
};

describe("Professor Mari entry", () => {
  it("rejects empty gateway responses", async () => {
    const gateway: MariGateway = {
      prompt: async () => ({
        content: "   ",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    };

    await expect(runProfessorMariEntry(baseRequest, gateway)).rejects.toThrow("empty response");
  });
});
