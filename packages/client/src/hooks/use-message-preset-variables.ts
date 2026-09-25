import { useMemo } from "react";
import { parseChoiceOptions, resolveChoiceVariableValue, seededUnitRandom } from "@marinara-engine/shared";
import { useChatStore } from "../stores/chat.store";
import { parseChatMetadata } from "../lib/chat-display";
import { useConnection } from "./use-connections";
import { usePresetFull } from "./use-presets";

/** Resolve greetings at display time, including choices confirmed after the greeting was created. */
export function useMessagePresetVariables(randomSeed: string): Record<string, string> {
  const chat = useChatStore((state) => state.activeChat);
  const { data: connection } = useConnection(chat?.connectionId ?? null);
  const connectionPresetId =
    chat?.mode === "roleplay" && typeof connection?.promptPresetId === "string" ? connection.promptPresetId : null;
  const presetId = connectionPresetId || chat?.promptPresetId || null;
  const metadata = useChatStore((state) => state.activeChat?.metadata);
  const { data } = usePresetFull(presetId);
  return useMemo(() => {
    let defaults: Record<string, string | string[]> = {};
    try {
      const raw = data?.preset.defaultChoices;
      defaults = (typeof raw === "string" ? JSON.parse(raw) : raw) ?? {};
    } catch {
      /* Legacy presets can have malformed defaults. */
    }
    const choices =
      presetId !== chat?.promptPresetId ? defaults : { ...defaults, ...parseChatMetadata(metadata).presetChoices };
    return Object.fromEntries(
      (data?.choiceBlocks ?? []).map((block) => [
        block.variableName,
        resolveChoiceVariableValue({
          selected: choices[block.variableName],
          options: parseChoiceOptions(block.options),
          multiSelect: block.multiSelect,
          randomPick: block.randomPick,
          separator: block.separator,
          random: () => seededUnitRandom(`${randomSeed}:${block.variableName}`),
        }),
      ]),
    );
  }, [data?.choiceBlocks, data?.preset.defaultChoices, metadata, randomSeed, presetId, chat?.promptPresetId]);
}
