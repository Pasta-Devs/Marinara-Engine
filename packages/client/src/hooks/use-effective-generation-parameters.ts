import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { useChatStore } from "../stores/chat.store";
import { useConnection } from "./use-connections";
import { usePresetFull } from "./use-presets";

export type EffectiveGenerationParameters = Record<string, { value: unknown; source: string; enabled: boolean }>;

export function useEffectiveGenerationParameters(connectionId: string | null, enabled = true) {
  const canPreview = enabled && !!connectionId && connectionId !== "random" && connectionId !== "__local_sidecar__";
  const chat = useChatStore((state) => state.activeChat);
  const { data: connection } = useConnection(canPreview ? connectionId : null);
  const presetId = (chat?.mode === "roleplay" ? connection?.promptPresetId : null) || chat?.promptPresetId || null;
  const { data: preset } = usePresetFull(canPreview && typeof presetId === "string" ? presetId : null);
  const query = useQuery({
    queryKey: [
      "effective-generation-parameters",
      connectionId,
      presetId,
      chat?.id,
      chat?.metadata,
      chat?.mode,
      connection?.updatedAt,
      preset?.preset.updatedAt,
    ],
    enabled: canPreview,
    queryFn: () =>
      api.post<{
        chatName: string | null;
        inheritedParameters: Record<string, unknown>;
        parameters: EffectiveGenerationParameters;
      }>("/generate/parameters", {
        connectionId,
        ...(chat?.id ? { chatId: chat.id } : {}),
      }),
    staleTime: 0,
  });
  return { ...query, canPreview };
}
