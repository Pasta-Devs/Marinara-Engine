import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { Persona } from "../../../../engine/contracts/types/persona";
import { characterKeys } from "../../../catalog/characters/index";
import { personaKeys } from "../../../catalog/personas/index";
import {
  resolveTrackerCardColorTargets,
  updateCachedTrackerCardColorTargetConfig,
  type TrackerCardColorTarget,
} from "./tracker-card-color-manager";
import { TRACKER_CARD_COLOR_PREVIEW_BASE_FIELD } from "../../../../shared/lib/tracker-card-colors";

function makeTarget(kind: TrackerCardColorTarget["kind"], id: string): TrackerCardColorTarget {
  const entityLabel = kind === "persona" ? "Persona" : "Character";
  return {
    key: `${kind}:${id}`,
    id,
    kind,
    entityLabel,
    name: entityLabel,
    optionLabel: entityLabel,
    chatColors: { nameColor: "", dialogueColor: "", boxColor: "" },
    config: { mode: "chat" },
    serializedConfig: '{"mode":"chat"}',
    savedConfig: { mode: "chat" },
    savedSerializedConfig: '{"mode":"chat"}',
    ...(kind === "character" ? { characterData: { name: entityLabel, extensions: {} } } : {}),
  };
}

function makePersona(id: string, name: string, isActive: boolean, trackerCardColors?: string): Persona {
  return {
    id,
    name,
    comment: "",
    description: "",
    personality: "",
    scenario: "",
    backstory: "",
    appearance: "",
    avatarPath: null,
    isActive,
    nameColor: "#111111",
    dialogueColor: "#222222",
    boxColor: "#333333",
    trackerCardColors,
    createdAt: "",
    updatedAt: "",
  };
}

describe("tracker card color manager", () => {
  it("patches persona tracker card color cache previews and clears the preview base on save", () => {
    const queryClient = new QueryClient();
    const target = makeTarget("persona", "persona-1");
    queryClient.setQueryData(personaKeys.list, [
      {
        id: "persona-1",
        trackerCardColors: "old",
        [TRACKER_CARD_COLOR_PREVIEW_BASE_FIELD]: "old-base",
      },
      { id: "persona-2", trackerCardColors: "untouched" },
    ]);

    updateCachedTrackerCardColorTargetConfig(queryClient, target, "preview", "saved");

    expect(queryClient.getQueryData<Record<string, unknown>[]>(personaKeys.list)?.[0]).toMatchObject({
      trackerCardColors: "preview",
      [TRACKER_CARD_COLOR_PREVIEW_BASE_FIELD]: "saved",
    });
    expect(queryClient.getQueryData<Record<string, unknown>[]>(personaKeys.list)?.[1]?.trackerCardColors).toBe(
      "untouched",
    );

    updateCachedTrackerCardColorTargetConfig(queryClient, target, "saved");

    const savedPersona = queryClient.getQueryData<Record<string, unknown>[]>(personaKeys.list)?.[0];
    expect(savedPersona?.trackerCardColors).toBe("saved");
    expect(savedPersona).not.toHaveProperty(TRACKER_CARD_COLOR_PREVIEW_BASE_FIELD);
  });

  it("patches character tracker card color cache previews inside character data extensions", () => {
    const queryClient = new QueryClient();
    const target = makeTarget("character", "character-1");
    queryClient.setQueryData(characterKeys.list(), [
      {
        id: "character-1",
        data: {
          name: "Rina",
          extensions: {
            trackerCardColors: "old",
            [TRACKER_CARD_COLOR_PREVIEW_BASE_FIELD]: "old-base",
            nameColor: "#111111",
          },
        },
      },
      { id: "character-2", data: { name: "Unaffected", extensions: { trackerCardColors: "untouched" } } },
    ]);

    updateCachedTrackerCardColorTargetConfig(queryClient, target, "preview", "saved");

    const previewCharacters = queryClient.getQueryData<Array<{ data: Record<string, unknown> }>>(characterKeys.list());
    const previewCharacter = previewCharacters?.[0];
    expect(previewCharacter?.data.extensions).toMatchObject({
      trackerCardColors: "preview",
      [TRACKER_CARD_COLOR_PREVIEW_BASE_FIELD]: "saved",
      nameColor: "#111111",
    });
    expect(previewCharacters?.[1]).toEqual({
      id: "character-2",
      data: { name: "Unaffected", extensions: { trackerCardColors: "untouched" } },
    });

    updateCachedTrackerCardColorTargetConfig(queryClient, target, "saved");

    const savedCharacters = queryClient.getQueryData<Array<{ data: Record<string, unknown> }>>(characterKeys.list());
    const savedCharacter = savedCharacters?.[0];
    expect(savedCharacter?.data.extensions).toMatchObject({
      trackerCardColors: "saved",
      nameColor: "#111111",
    });
    expect(savedCharacter?.data.extensions).not.toHaveProperty(TRACKER_CARD_COLOR_PREVIEW_BASE_FIELD);
    expect(savedCharacters?.[1]).toEqual({
      id: "character-2",
      data: { name: "Unaffected", extensions: { trackerCardColors: "untouched" } },
    });
  });

  it("resolves the active chat persona before the global active persona and includes chat characters", () => {
    const targets = resolveTrackerCardColorTargets({
      activeChat: { personaId: "persona-chat", characterIds: JSON.stringify(["character-1"]) },
      charactersData: [
        {
          id: "character-1",
          data: {
            name: "Rina",
            extensions: {
              nameColor: "#111111",
              dialogueColor: "#222222",
              boxColor: "#333333",
              trackerCardColors: '{"mode":"custom","nameColor":"#abcdef"}',
            },
          },
        },
      ],
      currentPresentCharacters: [],
      personasData: [
        makePersona("persona-active", "Active", true, '{"mode":"default"}'),
        makePersona("persona-chat", "Chat Persona", false, '{"mode":"custom","nameColor":"#123456"}'),
      ],
    });

    expect(targets.map((target) => target.key)).toEqual(["persona:persona-chat", "character:character-1"]);
    expect(targets[0]?.config.nameColor).toBe("#123456");
    expect(targets[1]?.chatColors).toEqual({
      nameColor: "#111111",
      dialogueColor: "#222222",
      boxColor: "#333333",
    });
  });

  it("does not fall back to the global active persona without active chat context", () => {
    const targets = resolveTrackerCardColorTargets({
      activeChat: null,
      charactersData: [],
      currentPresentCharacters: [],
      personasData: [makePersona("persona-active", "Active", true, '{"mode":"custom","nameColor":"#123456"}')],
    });

    expect(targets).toEqual([]);
  });

  it("does not fall back to the global active persona when the chat persona is missing", () => {
    const targets = resolveTrackerCardColorTargets({
      activeChat: { personaId: "missing-persona", characterIds: [] },
      charactersData: [],
      currentPresentCharacters: [],
      personasData: [makePersona("persona-active", "Active", true, '{"mode":"custom","nameColor":"#123456"}')],
    });

    expect(targets).toEqual([]);
  });
});
