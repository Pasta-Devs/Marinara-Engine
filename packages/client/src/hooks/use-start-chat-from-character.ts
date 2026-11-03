import { useCallback } from "react";
import type { Chat } from "@marinara-engine/shared";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { useChatStore } from "../stores/chat.store";
import { chatKeys, useCreateChat } from "./use-chats";
import { characterKeys } from "./use-characters";
import { agentKeys } from "./use-agents";
import { lorebookKeys } from "./use-lorebooks";
import { presetKeys } from "./use-presets";
import { useApplyChatPreset, useChatPresets } from "./use-chat-presets";
import { connectionListQuery } from "./use-connections";
import { postGreetingWithSwipes } from "../lib/message-swipes";
import { readCardWithQuestions } from "../lib/onboarding-add-card";
import { keepExistingSetup, pickSetupSource, readSetupFields, setupMemoryFrom } from "../lib/chat-setup-memory";

type ChatMode = "roleplay" | "conversation" | "game";

interface StartChatFromCharacterOptions {
  characterId: string;
  characterName: string;
  mode: ChatMode;
  firstMessage?: string;
  alternateGreetings?: string[];
  onSuccess?: (chatId: string) => void;
}

export function useStartChatFromCharacter() {
  const createChat = useCreateChat();
  const queryClient = useQueryClient();
  const { data: chatPresetsData } = useChatPresets();
  const applyChatPreset = useApplyChatPreset();

  const startChatFromCharacter = useCallback(
    async ({
      characterId,
      characterName,
      mode,
      firstMessage,
      alternateGreetings,
      onSuccess,
    }: StartChatFromCharacterOptions) => {
      // Same gate as the other new-chat paths: with no connection yet, the connection setup opens instead.
      const connections = await queryClient.fetchQuery(connectionListQuery).catch(() => []);
      if ((connections as Array<{ id?: string }>).filter((connection) => !!connection.id).length === 0) {
        useChatStore.getState().setPendingNewChatMode(mode, "home");
        return;
      }

      // Roleplay previews the card greeting on the setup stage. A card with character questions keeps the
      // wizard, which asks them and fills the greeting with the answers, so its raw greeting is never posted.
      let greeting = firstMessage;
      let alternates = alternateGreetings;
      let askQuestions = false;
      if (mode === "roleplay") {
        try {
          const character = await api.get<{ data: unknown }>(`/characters/${characterId}`);
          const data = typeof character.data === "string" ? JSON.parse(character.data) : character.data;
          askQuestions = readCardWithQuestions(data) !== null;
          const card = data as { first_mes?: string; alternate_greetings?: string[] } | null;
          greeting ??= card?.first_mes;
          alternates ??= card?.alternate_greetings;
        } catch {
          /* non-fatal: the chat still opens, without a greeting preview */
        }
      }
      const useWizard = mode === "game" || askQuestions;

      // Stage modes remember the last solo chat with this character: copy its setup fields only.
      let source: Chat | null = null;
      if (!useWizard) {
        const chats = await queryClient
          .fetchQuery({ queryKey: chatKeys.list(), queryFn: () => api.get<Chat[]>("/chats"), staleTime: 10_000 })
          .catch(() => [] as Chat[]);
        source = pickSetupSource(chats, characterId, mode);
      }
      const label = mode === "conversation" ? "Conversation" : mode === "game" ? "Game" : "Roleplay";
      const presets = chatPresetsData ?? [];
      const presetMode = mode === "conversation" || mode === "roleplay" ? mode : null;
      const starred = presetMode
        ? (presets.find((preset) => preset.mode === presetMode && preset.isActive && !preset.isDefault) ?? null)
        : null;

      createChat.mutate(
        {
          name: characterName ? `${characterName} - ${label}` : `New ${label}`,
          mode,
          characterIds: [characterId],
          connectionId: starred?.settings.connectionId ?? undefined,
          promptPresetId: starred?.settings.promptPresetId ?? undefined,
        },
        {
          onSuccess: (chat) => {
            const store = useChatStore.getState();
            store.setActiveChatId(chat.id);
            // Roleplay and conversation open straight into the chat with its setup stage.
            if (!useWizard) {
              // With a remembered setup the stage opens once the copy has landed.
              if (!source) store.setSetupStageChatId(chat.id);
            }
            else {
              store.setShouldOpenSettings(true);
              store.setShouldOpenWizard(true);
            }
            onSuccess?.(chat.id);

            void (async () => {
              if (source) {
                try {
                  const defaults = readSetupFields(chat);
                  const fetchIds = async (queryKey: readonly unknown[], path: string, field = "id") => {
                    const rows = await queryClient
                      .ensureQueryData({ queryKey, queryFn: () => api.get<Array<Record<string, unknown>>>(path), staleTime: 60_000 })
                      .catch(() => null);
                    return rows ? new Set(rows.map((row) => String(row[field]))) : null;
                  };
                  const [personas, promptPresets, lorebooks, agents] = await Promise.all([
                    fetchIds(characterKeys.personas, "/characters/personas/list"),
                    fetchIds(presetKeys.list(), "/prompts"),
                    fetchIds(lorebookKeys.list(), "/lorebooks"),
                    fetchIds(agentKeys.all, "/agents", "type"),
                  ]);
                  // A list that failed to load is treated as empty, so nothing unverifiable is copied.
                  const none = new Set<string>();
                  const memory = {
                    sourceName: source.name,
                    ...keepExistingSetup(setupMemoryFrom(source), defaults, {
                      personas: personas ?? none,
                      promptPresets: promptPresets ?? none,
                      lorebooks: lorebooks ?? none,
                      agents: agents ?? none,
                      chatPresets: new Set((chatPresetsData ?? []).map((preset) => preset.id)),
                      connections: new Set((connections as Array<{ id: string }>).map((c) => c.id)),
                    }),
                  };
                  await api.patch(`/chats/${chat.id}`, {
                    personaId: memory.personaId,
                    connectionId: memory.connectionId,
                    promptPresetId: memory.promptPresetId,
                  });
                  await api.patch(`/chats/${chat.id}/metadata`, memory.metadata);
                  void queryClient.invalidateQueries({ queryKey: chatKeys.detail(chat.id) });
                  void queryClient.invalidateQueries({ queryKey: chatKeys.list() });
                  store.setSetupMemory({
                    chatId: chat.id,
                    sourceName: memory.sourceName,
                    defaults,
                    starredProfileId: starred?.id ?? null,
                  });
                } catch {
                  /* non-fatal: the chat keeps its normal defaults */
                } finally {
                  store.setSetupStageChatId(chat.id);
                }
              } else if (starred) {
                try {
                  await applyChatPreset.mutateAsync({ presetId: starred.id, chatId: chat.id });
                } catch {
                  /* non-fatal: chat still opens with system defaults */
                }
              }

              if (mode !== "roleplay" || useWizard || !greeting?.trim()) return;
              try {
                await postGreetingWithSwipes(chat.id, characterId, greeting, alternates);
                queryClient.invalidateQueries({ queryKey: chatKeys.messages(chat.id) });
              } catch {
                /* non-fatal: don't block the new chat if greeting injection fails */
              }
            })();
          },
        },
      );
    },
    [applyChatPreset, chatPresetsData, createChat, queryClient],
  );

  return { startChatFromCharacter, isStartingChat: createChat.isPending };
}
