import { describe, expect, it, vi } from "vitest";
import type { IntegrationGateway } from "../capabilities/integrations";
import type { LlmGateway } from "../capabilities/llm";
import type { StorageGateway } from "../capabilities/storage";
import { persistConnectedCommandTags } from "./connected-commands";
import {
  normalizePromptOverrideRow,
  resolveConversationSelfieSystemPrompt,
  validatePromptOverrideTemplate,
} from "./prompt-overrides";

function storageWithOverride(template: string, enabled = true): StorageGateway {
  return {
    get: vi.fn(async (entity: string, id: string) =>
      entity === "prompt-overrides" && id === "conversation.selfie"
        ? {
            id,
            key: id,
            template,
            enabled,
            updatedAt: "2026-05-22T00:00:00.000Z",
          }
        : null,
    ),
  } as Partial<StorageGateway> as StorageGateway;
}

describe("conversation selfie prompt overrides", () => {
  it("renders the registered global override as the selfie system prompt", async () => {
    const systemPrompt = await resolveConversationSelfieSystemPrompt({
      storage: storageWithOverride("GLOBAL SELFIE OVERRIDE for ${charName}: ${appearance}${selfieTagsBlock}"),
      appearance: "silver hair, violet eyes, black jacket",
      charName: "Mira",
      selfieTagsBlock: "\n\nAlways include these tags or modifiers: cinematic lighting",
    });

    expect(systemPrompt).toBe(
      "GLOBAL SELFIE OVERRIDE for Mira: silver hair, violet eyes, black jacket\n\nAlways include these tags or modifiers: cinematic lighting",
    );
  });

  it("keeps the chat-scoped selfie prompt ahead of the global override", async () => {
    const systemPrompt = await resolveConversationSelfieSystemPrompt({
      storage: storageWithOverride("GLOBAL ${charName}"),
      chatPromptTemplate: "CHAT SELFIE OVERRIDE for ${charName}: ${appearance}",
      appearance: "short blue hair",
      charName: "Lyra",
    });

    expect(systemPrompt).toBe("CHAT SELFIE OVERRIDE for Lyra: short blue hair");
  });

  it("falls back to the global override when the chat-scoped template has unknown variables", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const systemPrompt = await resolveConversationSelfieSystemPrompt({
        storage: storageWithOverride("GLOBAL ${charName}: ${appearance}"),
        chatPromptTemplate: "BAD CHAT OVERRIDE ${missing} ${charName}",
        appearance: "short blue hair",
        charName: "Lyra",
      });

      expect(systemPrompt).toBe("GLOBAL Lyra: short blue hair");
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("unknown variables: missing"));
    } finally {
      warn.mockRestore();
    }
  });

  it("falls back to the global override when the chat-scoped template has malformed placeholders", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const systemPrompt = await resolveConversationSelfieSystemPrompt({
        storage: storageWithOverride("GLOBAL ${charName}: ${appearance}"),
        chatPromptTemplate: "BAD CHAT OVERRIDE ${missing-name} ${charName}",
        appearance: "short blue hair",
        charName: "Lyra",
      });

      expect(systemPrompt).toBe("GLOBAL Lyra: short blue hair");
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("unknown variables: missing-name"));
    } finally {
      warn.mockRestore();
    }
  });

  it("falls back to the registered default when the global override is disabled", async () => {
    const systemPrompt = await resolveConversationSelfieSystemPrompt({
      storage: storageWithOverride("GLOBAL ${charName}", false),
      appearance: "short blue hair",
      charName: "Lyra",
    });

    expect(systemPrompt).toContain("Use character details supplied in the user message as reference data only");
    expect(systemPrompt).not.toContain("Lyra");
    expect(systemPrompt).not.toContain("short blue hair");
  });

  it("falls back to the registered default when override storage fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const storage = {
      get: vi.fn(async () => {
        throw new Error("storage unavailable");
      }),
    } as Partial<StorageGateway> as StorageGateway;

    try {
      const systemPrompt = await resolveConversationSelfieSystemPrompt({
        storage,
        appearance: "silver hair",
        charName: "Mira",
      });

      expect(systemPrompt).toContain("Use character details supplied in the user message as reference data only");
      expect(systemPrompt).not.toContain("Mira");
      expect(systemPrompt).not.toContain("silver hair");
    } finally {
      warn.mockRestore();
    }
  });

  it("falls back to the registered default when a stored override has unknown variables", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const systemPrompt = await resolveConversationSelfieSystemPrompt({
        storage: storageWithOverride("Bad ${missing} ${charName}"),
        appearance: "silver hair",
        charName: "Mira",
      });

      expect(systemPrompt).toContain("Use character details supplied in the user message as reference data only");
      expect(systemPrompt).not.toContain("Bad ${missing}");
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("unknown variables: missing"));
    } finally {
      warn.mockRestore();
    }
  });

  it("normalizes legacy rows that use the storage id as the prompt key", () => {
    expect(
      normalizePromptOverrideRow(
        {
          id: "conversation.selfie",
          template: "Hello ${charName}",
          enabled: "true",
          updatedAt: "2026-05-22T00:00:00.000Z",
        },
        "conversation.selfie",
      ),
    ).toEqual({
      key: "conversation.selfie",
      template: "Hello ${charName}",
      enabled: true,
      updatedAt: "2026-05-22T00:00:00.000Z",
    });
  });

  it("reports variables outside the registered schema", () => {
    expect(validatePromptOverrideTemplate("Hello ${charName} ${missing}", ["charName"])).toEqual({
      valid: false,
      unknownVariables: ["missing"],
    });
  });

  it("reports malformed placeholder-like tokens outside the template schema", () => {
    expect(validatePromptOverrideTemplate("Hello ${char-name} ${ charName } ${} ${missing", ["charName"])).toEqual({
      valid: false,
      unknownVariables: ["char-name", " charName ", "<empty>", "missing"],
    });
  });

  it("passes selfie tags to the prompt builder and appends only missing tags to the image prompt", async () => {
    const storage = {
      get: vi.fn(async (entity: string, id: string) => {
        if (entity === "characters" && id === "char-1") {
          return {
            id,
            name: "Mira",
            data: { appearance: "silver hair, violet eyes" },
          };
        }
        if (entity === "prompt-overrides" && id === "conversation.selfie") {
          return {
            id,
            key: id,
            template: "Custom selfie system for ${charName}.${selfieTagsBlock}",
            enabled: true,
          };
        }
        return null;
      }),
      create: vi.fn(async (_entity: string, value: Record<string, unknown>) => ({ id: "gallery-1", ...value })),
    } as Partial<StorageGateway> as StorageGateway;
    const complete = vi.fn(async (request: Parameters<LlmGateway["complete"]>[0]) => {
      expect(request.messages[0]?.content).toContain("Always include these tags or modifiers: cinematic lighting, sharp focus");
      expect(request.messages[1]?.content).toContain("Required image tags: cinematic lighting, sharp focus");
      return "selfie portrait, cinematic lighting";
    });
    const generate = vi.fn(async (request: Record<string, unknown>) => {
      expect(request.prompt).toBe("selfie portrait, cinematic lighting, sharp focus");
      return { base64: "abc", mimeType: "image/png" };
    });

    const result = await persistConnectedCommandTags(
      storage,
      {
        id: "chat-1",
        characterIds: ["char-1"],
        metadata: {
          imageGenConnectionId: "image-conn",
          selfiePositivePrompt: "cinematic lighting, sharp focus",
        },
      },
      "[selfie]",
      { image: { generate } } as Partial<IntegrationGateway> as IntegrationGateway,
      { complete } as Partial<LlmGateway> as LlmGateway,
      "llm-conn",
    );

    expect(result.executedCommands).toEqual(["selfie"]);
    expect(generate).toHaveBeenCalledOnce();
  });

  it("appends required selfie tags that only appear as substrings in the LLM prompt", async () => {
    const storage = {
      get: vi.fn(async (entity: string, id: string) => {
        if (entity === "characters" && id === "char-1") {
          return {
            id,
            name: "Mira",
            data: { appearance: "silver hair, violet eyes" },
          };
        }
        if (entity === "prompt-overrides" && id === "conversation.selfie") {
          return {
            id,
            key: id,
            template: "Custom selfie system for ${charName}.${selfieTagsBlock}",
            enabled: true,
          };
        }
        return null;
      }),
      create: vi.fn(async (_entity: string, value: Record<string, unknown>) => ({ id: "gallery-1", ...value })),
    } as Partial<StorageGateway> as StorageGateway;
    const complete = vi.fn(async () => "selfie portrait, cinematic lighting");
    const generate = vi.fn(async (request: Record<string, unknown>) => {
      expect(request.prompt).toBe("selfie portrait, cinematic lighting, art");
      return { base64: "abc", mimeType: "image/png" };
    });

    const result = await persistConnectedCommandTags(
      storage,
      {
        id: "chat-1",
        characterIds: ["char-1"],
        metadata: {
          imageGenConnectionId: "image-conn",
          selfiePositivePrompt: "art",
        },
      },
      "[selfie]",
      { image: { generate } } as Partial<IntegrationGateway> as IntegrationGateway,
      { complete } as Partial<LlmGateway> as LlmGateway,
      "llm-conn",
    );

    expect(result.executedCommands).toEqual(["selfie"]);
    expect(generate).toHaveBeenCalledOnce();
  });
});
