// ──────────────────────────────────────────────
// React Query: Chat Preset hooks
// ──────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { chatPresetKeys } from "../query-keys";
import { chatPresetSettingsSchema } from "../../../../engine/contracts/schemas/chat-preset.schema";
import { boolish } from "../../../../engine/generation/runtime-records";
import { storageApi } from "../../../../shared/api/storage-api";
import { storageCommandsApi } from "../../../../shared/api/storage-commands-api";
import { chatKeys } from "../../chats/query-keys";
import type { Chat, ChatMode } from "../../../../engine/contracts/types/chat";
import {
  CHAT_PRESET_EXCLUDED_METADATA_KEYS,
  type ChatPreset,
  type ChatPresetSettings,
} from "../../../../engine/contracts/types/chat-preset";

export { chatPresetKeys } from "../query-keys";

const EXCLUDED_METADATA_KEYS = new Set<string>(CHAT_PRESET_EXCLUDED_METADATA_KEYS);

type RawChatPreset = ChatPreset & {
  default?: unknown;
  active?: unknown;
};

export function normalizeChatPresetFlags<T extends RawChatPreset>(preset: T): T & ChatPreset {
  return {
    ...preset,
    isDefault: boolish(preset.isDefault ?? preset.default, false),
    isActive: boolish(preset.isActive ?? preset.active, false),
  };
}

export async function listChatPresets(mode?: ChatMode | null): Promise<ChatPreset[]> {
  const presets = (await storageApi.list<RawChatPreset>("chat-presets")).map(normalizeChatPresetFlags);
  return mode ? presets.filter((preset) => preset.mode === mode) : presets;
}

export function findUserStarredChatPreset(
  presets: readonly RawChatPreset[] | null | undefined,
  mode: ChatMode | null,
): ChatPreset | null {
  if (!mode) return null;
  return (
    presets
      ?.map(normalizeChatPresetFlags)
      .find((preset) => preset.mode === mode && preset.isActive && !preset.isDefault) ?? null
  );
}

export function sanitizeChatPresetSettings(settings: ChatPresetSettings | null | undefined): ChatPresetSettings {
  const clean: ChatPresetSettings = {};
  if (!settings) return clean;

  if ("connectionId" in settings) clean.connectionId = settings.connectionId ?? null;
  if ("promptPresetId" in settings) clean.promptPresetId = settings.promptPresetId ?? null;

  if (settings.metadata && typeof settings.metadata === "object" && !Array.isArray(settings.metadata)) {
    const metadata = Object.fromEntries(
      Object.entries(settings.metadata).filter(([key]) => !EXCLUDED_METADATA_KEYS.has(key)),
    );
    if (Object.keys(metadata).length > 0) clean.metadata = metadata;
  }

  return chatPresetSettingsSchema.parse(clean);
}

async function setOnlyActivePreset(id: string): Promise<ChatPreset> {
  const selected = await storageApi.get<RawChatPreset>("chat-presets", id);
  if (!selected) throw new Error(`Chat preset ${id} was not found`);
  const presets = (await storageApi.list<RawChatPreset>("chat-presets")).map(normalizeChatPresetFlags);
  await Promise.all(
    presets
      .filter((preset) => preset.mode === selected.mode)
      .map((preset) =>
        storageApi.update<ChatPreset>("chat-presets", preset.id, {
          isActive: preset.id === id,
          active: preset.id === id,
        }),
      ),
  );
  return { ...normalizeChatPresetFlags(selected), isActive: true, active: true } as ChatPreset;
}

export function useChatPresets(mode?: ChatMode | null) {
  return useQuery({
    queryKey: chatPresetKeys.list(mode ?? null),
    queryFn: () => listChatPresets(mode),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useUpdateChatPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; settings?: ChatPresetSettings }) =>
      storageApi.update<ChatPreset>("chat-presets", id, {
        ...data,
        ...(data.settings ? { settings: sanitizeChatPresetSettings(data.settings) } : {}),
      } as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatPresetKeys.all }),
  });
}

export function useSaveChatPresetSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, settings }: { id: string; settings: ChatPresetSettings }) =>
      storageApi.update<ChatPreset>("chat-presets", id, {
        settings: sanitizeChatPresetSettings(settings) as unknown as Record<string, unknown>,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatPresetKeys.all }),
  });
}

export function useDuplicateChatPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name?: string }) => {
      const duplicated = await storageCommandsApi.duplicate<ChatPreset>("chat-presets", id);
      return name?.trim()
        ? storageApi.update<ChatPreset>("chat-presets", duplicated.id, { name: name.trim() })
        : duplicated;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chatPresetKeys.all }),
  });
}

export function useSetActiveChatPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => setOnlyActivePreset(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatPresetKeys.all }),
  });
}

export function useDeleteChatPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => storageApi.delete("chat-presets", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatPresetKeys.all }),
  });
}

export function useImportChatPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (envelope: unknown) =>
      storageApi.create<ChatPreset>("chat-presets", envelope as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatPresetKeys.all }),
  });
}

/** Apply a preset's settings to an existing chat. Refetches the chat afterward. */
export function useApplyChatPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ presetId, chatId }: { presetId: string; chatId: string }) => {
      const [preset, chat] = await Promise.all([
        storageApi.get<ChatPreset>("chat-presets", presetId),
        storageApi.get<Chat>("chats", chatId),
      ]);
      if (!preset) throw new Error(`Chat preset ${presetId} was not found`);
      if (!chat) throw new Error(`Chat ${chatId} was not found`);

      const settings = sanitizeChatPresetSettings(preset.settings);
      const currentMetadata =
        chat.metadata && typeof chat.metadata === "object" && !Array.isArray(chat.metadata) ? chat.metadata : {};
      const patch: Record<string, unknown> = {
        chatPresetId: presetId,
        metadata: {
          ...currentMetadata,
          ...(settings.metadata ?? {}),
          appliedChatPresetId: presetId,
        },
      };
      if ("connectionId" in settings) patch.connectionId = settings.connectionId ?? null;
      if (chat.mode === "conversation") {
        patch.promptPresetId = null;
      } else if ("promptPresetId" in settings) {
        patch.promptPresetId = settings.promptPresetId ?? null;
      }
      return storageApi.update<Chat>("chats", chatId, patch);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.chatId) });
      qc.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}
