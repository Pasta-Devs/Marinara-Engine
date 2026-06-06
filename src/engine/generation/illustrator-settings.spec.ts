import { describe, expect, it } from "vitest";

import { BUILT_IN_AGENTS, getDefaultBuiltInAgentSettings } from "../contracts/types/agent";
import {
  illustratorAvatarReferenceMode,
  illustratorAvatarReferencesEnabled,
  serializeIllustratorAvatarReferenceSettings,
} from "./illustrator-settings";

describe("built-in agent parity defaults", () => {
  it("keeps Immersive HTML disabled by default", () => {
    expect(BUILT_IN_AGENTS.find((agent) => agent.id === "html")?.enabledByDefault).toBe(false);
  });

  it("does not default Illustrator avatar references on", () => {
    expect(getDefaultBuiltInAgentSettings("illustrator")).not.toHaveProperty("useAvatarReferences");
    expect(illustratorAvatarReferencesEnabled(getDefaultBuiltInAgentSettings("illustrator"))).toBe(false);
    expect(illustratorAvatarReferencesEnabled({})).toBe(false);
  });

  it("uses Illustrator avatar references only when explicitly enabled", () => {
    expect(illustratorAvatarReferencesEnabled({ useAvatarReferences: true })).toBe(true);
    expect(illustratorAvatarReferencesEnabled({ useAvatarReferences: false })).toBe(false);
  });

  it("keeps old chat-level avatar reference metadata working when agent setting is absent", () => {
    expect(illustratorAvatarReferencesEnabled({}, { illustrationUseAvatarReferences: true })).toBe(true);
  });

  it("does not let an untouched editor/default false save suppress chat metadata", () => {
    const savedSettings = serializeIllustratorAvatarReferenceSettings("inherit");
    expect(savedSettings).not.toHaveProperty("useAvatarReferences");
    expect(illustratorAvatarReferenceMode(savedSettings)).toBe("inherit");
    expect(illustratorAvatarReferencesEnabled(savedSettings, { illustrationUseAvatarReferences: true })).toBe(true);
  });

  it("keeps existing deliberate legacy false configs disabling chat metadata", () => {
    expect(illustratorAvatarReferenceMode({ useAvatarReferences: false })).toBe("disabled");
    expect(illustratorAvatarReferencesEnabled({ useAvatarReferences: false }, { illustrationUseAvatarReferences: true })).toBe(
      false,
    );
  });

  it("still lets newly saved deliberate agent-level false disable chat metadata", () => {
    const savedSettings = serializeIllustratorAvatarReferenceSettings("disabled");
    expect(
      illustratorAvatarReferencesEnabled(
        savedSettings,
        { illustrationUseAvatarReferences: true },
      ),
    ).toBe(false);
  });

  it("uses one resolver for agent-runner reference collection and retry image generation settings", () => {
    const rows: Array<{
      name: string;
      settings: Record<string, unknown>;
      chatMeta: Record<string, unknown>;
      expected: boolean;
    }> = [
      {
        name: "inherited chat metadata",
        settings: {},
        chatMeta: { illustrationUseAvatarReferences: true },
        expected: true,
      },
      {
        name: "untouched editor save",
        settings: serializeIllustratorAvatarReferenceSettings("inherit"),
        chatMeta: { illustrationUseAvatarReferences: true },
        expected: true,
      },
      {
        name: "existing deliberate legacy false",
        settings: { useAvatarReferences: false },
        chatMeta: { illustrationUseAvatarReferences: true },
        expected: false,
      },
      {
        name: "new explicit disable",
        settings: serializeIllustratorAvatarReferenceSettings("disabled"),
        chatMeta: { illustrationUseAvatarReferences: true },
        expected: false,
      },
    ];

    for (const row of rows) {
      expect(illustratorAvatarReferencesEnabled(row.settings, row.chatMeta), row.name).toBe(row.expected);
    }
  });
});
