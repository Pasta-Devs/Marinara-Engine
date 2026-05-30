import { describe, expect, it } from "vitest";
import { normalizeChatPresetFlags, sanitizeChatPresetSettings } from "./use-chat-presets";

describe("sanitizeChatPresetSettings", () => {
  it("removes chat-specific summary metadata from saved presets", () => {
    const sanitized = sanitizeChatPresetSettings({
      connectionId: "conn",
      promptPresetId: "prompt",
      metadata: {
        enableAgents: true,
        daySummaries: { "01.01.2026": { summary: "Old chat", keyDetails: [] } },
        weekSummaries: { "29.12.2025": { summary: "Old week", keyDetails: [] } },
        summaryEntries: [],
        lastRoleplaySceneSummary: "Old scene",
      },
    });

    expect(sanitized).toEqual({
      connectionId: "conn",
      promptPresetId: "prompt",
      metadata: { enableAgents: true },
    });
  });
});

describe("normalizeChatPresetFlags", () => {
  it("coerces imported text boolean flags before UI code reads them", () => {
    const preset = normalizeChatPresetFlags({
      id: "preset-1",
      name: "Named Preset",
      mode: "roleplay",
      isDefault: "false" as unknown as boolean,
      isActive: "true" as unknown as boolean,
      settings: {},
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(preset.isDefault).toBe(false);
    expect(preset.isActive).toBe(true);
  });

  it("uses legacy default and active aliases when canonical flags are missing", () => {
    const preset = normalizeChatPresetFlags({
      id: "preset-2",
      name: "Legacy Preset",
      mode: "conversation",
      isDefault: undefined as unknown as boolean,
      isActive: undefined as unknown as boolean,
      default: "1" as unknown as boolean,
      active: "0" as unknown as boolean,
      settings: {},
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(preset.isDefault).toBe(true);
    expect(preset.isActive).toBe(false);
  });
});
