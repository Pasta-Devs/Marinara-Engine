// ──────────────────────────────────────────────
// Chat: Main chat area — mode-aware rendering
// ──────────────────────────────────────────────
import { useEffect, useLayoutEffect, useRef, useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  useChatMessages,
  useChat,
  useDeleteMessage,
  useDeleteMessages,
  useUpdateMessage,
  useUpdateMessageExtra,
  usePeekPrompt,
  useCreateChat,
  useSetActiveSwipe,
  useUpdateChatMetadata,
  useBranchChat,
  useChats,
} from "../../hooks/use-chats";

import { useChatStore } from "../../stores/chat.store";
import { useGenerate } from "../../hooks/use-generate";
import { useCharacters, usePersonas } from "../../hooks/use-characters";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ChatSettingsDrawer } from "./ChatSettingsDrawer";
import { ChatFilesDrawer } from "./ChatFilesDrawer";
import { ChatGalleryDrawer } from "./ChatGalleryDrawer";
import { ChatSetupWizard } from "./ChatSetupWizard";
import { PeekPromptModal } from "./PeekPromptModal";
import { RoleplayHUD } from "./RoleplayHUD";
import { WeatherEffects } from "./WeatherEffects";
import { useGameStateStore } from "../../stores/game-state.store";
import { api } from "../../lib/api-client";
import { SpriteOverlay } from "./SpriteOverlay";
import { SpriteSidebar } from "./SpriteSidebar";
import { AgentThoughtBubbles } from "../agents/AgentThoughtBubbles";
import { EchoChamberPanel } from "./EchoChamberPanel";
import { CyoaChoices } from "./CyoaChoices";

import { PinnedImageOverlay } from "./PinnedImageOverlay";
import {
  MessageSquare,
  BookOpen,
  Theater,
  Settings2,
  FolderOpen,
  Image,
  Swords,
  ChevronUp,
  Loader2,
  ScrollText,
  FlipHorizontal2,
  HelpCircle,
  MoreHorizontal,
  Globe,
  X,
  ArrowRightLeft,
  Trash2,
  PenLine,
} from "lucide-react";
import type { Message } from "@marinara-engine/shared";
import { useUIStore } from "../../stores/ui.store";
import { useAgentStore } from "../../stores/agent.store";
import { cn } from "../../lib/utils";
import { EncounterModal } from "./EncounterModal";
import { EndSceneBar } from "./SceneBanner";
import { useEncounter } from "../../hooks/use-encounter";
import { useScene } from "../../hooks/use-scene";
import { useEncounterStore } from "../../stores/encounter.store";
import { SummaryPopover } from "./SummaryPopover";
import { ConversationView } from "./ConversationView";
import { useActiveLorebookEntries } from "../../hooks/use-lorebooks";
import { APP_VERSION } from "@marinara-engine/shared";
import { BUILT_IN_AGENTS } from "@marinara-engine/shared";
import { useTranslationStore } from "../../hooks/use-translate";

/** Map characterId → { name, avatarUrl, colors, avatarCrop } */
export type CharacterMap = Map<
  string,
  {
    name: string;
    avatarUrl: string | null;
    nameColor?: string;
    dialogueColor?: string;
    boxColor?: string;
    avatarCrop?: { zoom: number; offsetX: number; offsetY: number } | null;
    conversationStatus?: "online" | "idle" | "dnd" | "offline";
  }
>;

/** Weather effects connected to the game state store. */
function WeatherEffectsConnected() {
  const gs = useGameStateStore((s) => s.current);
  return <WeatherEffects weather={gs?.weather ?? null} timeOfDay={gs?.time ?? null} />;
}

/** Crossfade background — smoothly transitions between background images using two alternating layers. */
function CrossfadeBackground({ url, className }: { url: string | null; className?: string }) {
  const [bgA, setBgA] = useState<string | null>(url);
  const [bgB, setBgB] = useState<string | null>(null);
  const [aActive, setAActive] = useState(true);
  const activeSlot = useRef<"a" | "b">("a");

  useEffect(() => {
    const currentUrl = activeSlot.current === "a" ? bgA : bgB;
    if (url === currentUrl) return;

    // Validate background URL exists before applying (prevents 404s from stale/hallucinated filenames)
    if (url && url.startsWith("/api/backgrounds/")) {
      fetch(url, { method: "HEAD" })
        .then((res) => {
          if (res.ok) {
            applyUrl(url);
          } else {
            console.warn(`[Background] "${url}" not found — clearing`);
            useUIStore.getState().setChatBackground(null);
          }
        })
        .catch(() => {
          // Network error — apply optimistically so the background still shows on
          // page refresh when the HEAD check fails due to timing. CSS background-image
          // degrades gracefully if the file is truly missing.
          applyUrl(url);
        });
      return;
    }

    applyUrl(url);

    function applyUrl(u: string | null) {
      if (activeSlot.current === "a") {
        setBgB(u);
        setAActive(false);
        activeSlot.current = "b";
      } else {
        setBgA(u);
        setAActive(true);
        activeSlot.current = "a";
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <>
      <div
        className={cn(
          "mari-background absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700 ease-in-out",
          className,
        )}
        style={{ backgroundImage: bgA ? `url(${bgA})` : "none", opacity: aActive ? 1 : 0 }}
      />
      <div
        className={cn(
          "mari-background absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700 ease-in-out",
          className,
        )}
        style={{ backgroundImage: bgB ? `url(${bgB})` : "none", opacity: aActive ? 0 : 1 }}
      />
    </>
  );
}

/**
 * Self-contained streaming indicator — subscribes to the hot `streamBuffer`
 * selector so ChatArea itself doesn't re-render on every token.
 */
function StreamingIndicator({
  activeChatId,
  chatCharIds,
  characterMap,
  personaInfo,
  chatMode,
  groupChatMode,
}: {
  activeChatId: string;
  chatCharIds: string[];
  characterMap: CharacterMap;
  personaInfo?: { name?: string; avatarUrl?: string; nameColor?: string; dialogueColor?: string; boxColor?: string };
  chatMode: string;
  groupChatMode?: string;
}) {
  const streamBuffer = useChatStore((s) => s.streamBuffer);
  const streamingCharacterId = useChatStore((s) => s.streamingCharacterId);

  return (
    <div className="animate-message-in">
      <ChatMessage
        message={{
          id: "__streaming__",
          chatId: activeChatId,
          role: "assistant",
          characterId: streamingCharacterId ?? chatCharIds[0] ?? null,
          content: streamBuffer || "",
          activeSwipeIndex: 0,
          extra: { displayText: null, isGenerated: true, tokenCount: 0, generationInfo: null },
          createdAt: new Date().toISOString(),
        }}
        isStreaming
        characterMap={characterMap}
        personaInfo={personaInfo}
        chatMode={chatMode}
        groupChatMode={groupChatMode}
        chatCharacterIds={chatCharIds}
      />
    </div>
  );
}

/**
 * Wrapper that subscribes to `streamBuffer` only for the message being
 * regenerated, keeping the rest of the message list re-render-free.
 */
function RegeneratingMessageContent({
  msg,
  ...rest
}: {
  msg: Message & { swipes?: Array<{ id: string; content: string }> };
} & Omit<React.ComponentProps<typeof ChatMessage>, "message" | "isStreaming">) {
  const streamBuffer = useChatStore((s) => s.streamBuffer);
  return <ChatMessage message={{ ...msg, content: streamBuffer || "" }} isStreaming {...rest} />;
}

export function ChatArea() {
  const activeChatId = useChatStore((s) => s.activeChatId);
  const streamingChatId = useChatStore((s) => s.streamingChatId);
  const isStreamingGlobal = useChatStore((s) => s.isStreaming);
  const isStreaming = isStreamingGlobal && streamingChatId === activeChatId;
  const regenerateMessageId = useChatStore((s) => s.regenerateMessageId);
  const chatBackground = useUIStore((s) => s.chatBackground);
  const weatherEffects = useUIStore((s) => s.weatherEffects);
  const messagesPerPage = useUIStore((s) => s.messagesPerPage);
  const centerCompact = useUIStore((s) => s.centerCompact);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef(0);
  const isLoadingMoreRef = useRef(false);
  // Tracks whether the initial load stagger animation has played.
  // After the first render with messages, new/re-mounted messages
  // skip the entry animation to avoid a visible flash on refetch.
  const hasAnimatedRef = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Delete dialog & multi-select state
  const [deleteDialogMessageId, setDeleteDialogMessageId] = useState<string | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());

  const { data: chat } = useChat(activeChatId);
  const { data: allChats } = useChats();
  const {
    data: msgData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useChatMessages(activeChatId, messagesPerPage);
  const messages = useMemo(() => (msgData ? [...msgData.pages].reverse().flat() : undefined), [msgData]);
  const { data: allCharacters } = useCharacters();
  const { data: allPersonas } = usePersonas();
  const deleteMessage = useDeleteMessage(activeChatId);
  const deleteMessages = useDeleteMessages(activeChatId);
  const updateMessage = useUpdateMessage(activeChatId);
  const updateMessageExtra = useUpdateMessageExtra(activeChatId);
  const peekPrompt = usePeekPrompt();
  const createChat = useCreateChat();
  const branchChat = useBranchChat();
  const { generate, retryAgents } = useGenerate();
  const setActiveSwipe = useSetActiveSwipe(activeChatId);
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const failedAgentTypes = useAgentStore((s) => s.failedAgentTypes);
  const agentProcessing = useAgentStore((s) => s.isProcessing);

  const handleQuickStart = useCallback(
    (mode: "conversation" | "roleplay") => {
      const label = mode === "conversation" ? "Conversation" : "Roleplay";
      createChat.mutate(
        { name: `New ${label}`, mode, characterIds: [] },
        {
          onSuccess: (chat) => {
            useChatStore.getState().setActiveChatId(chat.id);
            useChatStore.getState().setShouldOpenSettings(true);
            useChatStore.getState().setShouldOpenWizard(true);
          },
        },
      );
    },
    [createChat],
  );

  // Build character lookup map
  const characterMap: CharacterMap = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        avatarUrl: string | null;
        nameColor?: string;
        dialogueColor?: string;
        boxColor?: string;
        avatarCrop?: { zoom: number; offsetX: number; offsetY: number } | null;
        conversationStatus?: "online" | "idle" | "dnd" | "offline";
      }
    >();
    if (!allCharacters) return map;
    for (const char of allCharacters as Array<{ id: string; data: string; avatarPath: string | null }>) {
      try {
        const parsed = typeof char.data === "string" ? JSON.parse(char.data) : char.data;
        map.set(char.id, {
          name: parsed.name ?? "Unknown",
          avatarUrl: char.avatarPath ?? null,
          nameColor: parsed.extensions?.nameColor || undefined,
          dialogueColor: parsed.extensions?.dialogueColor || undefined,
          boxColor: parsed.extensions?.boxColor || undefined,
          avatarCrop: parsed.extensions?.avatarCrop || null,
          conversationStatus: parsed.extensions?.conversationStatus || undefined,
        });
      } catch {
        map.set(char.id, { name: "Unknown", avatarUrl: null });
      }
    }
    return map;
  }, [allCharacters]);

  // Character IDs in the active chat
  const chatCharIds: string[] = useMemo(
    () =>
      chat
        ? typeof (chat as unknown as { characterIds: unknown }).characterIds === "string"
          ? JSON.parse((chat as unknown as { characterIds: string }).characterIds)
          : (chat.characterIds ?? [])
        : [],
    [chat],
  );

  const characterNames = useMemo(
    () => chatCharIds.map((id) => characterMap.get(id)?.name).filter((n): n is string => !!n),
    [characterMap, chatCharIds],
  );

  // Active persona info (for user message styling: name, avatar, colors)
  const personaInfo = useMemo(() => {
    if (!allPersonas) return undefined;
    const personas = allPersonas as Array<{
      id: string;
      isActive: string | boolean;
      name: string;
      avatarPath?: string | null;
      nameColor?: string;
      dialogueColor?: string;
      boxColor?: string;
    }>;
    // Prefer per-chat personaId, fall back to globally active persona
    const chatPersonaId = (chat as unknown as { personaId?: string | null })?.personaId;
    const persona =
      (chatPersonaId ? personas.find((p) => p.id === chatPersonaId) : null) ??
      personas.find((p) => p.isActive === "true" || p.isActive === true);
    if (!persona) return undefined;
    return {
      name: persona.name,
      avatarUrl: persona.avatarPath || undefined,
      nameColor: persona.nameColor || undefined,
      dialogueColor: persona.dialogueColor || undefined,
      boxColor: persona.boxColor || undefined,
    };
  }, [allPersonas, chat]);

  const chatMode = (chat as unknown as { mode?: string })?.mode ?? "conversation";
  const isRoleplay = chatMode === "roleplay" || chatMode === "visual_novel";
  const { startEncounter } = useEncounter();
  const { concludeScene, abandonScene } = useScene();
  const encounterActive = useEncounterStore((s) => s.active || s.showConfigModal);

  // Sprite sidebar settings from chat metadata
  const chatMeta = useMemo(() => {
    if (!chat) return {};
    const raw = (chat as unknown as { metadata?: string | Record<string, unknown> }).metadata;
    return typeof raw === "string" ? JSON.parse(raw) : (raw ?? {});
  }, [chat]);
  const spriteCharacterIds: string[] = chatMeta.spriteCharacterIds ?? [];
  const spritePosition: "left" | "right" = chatMeta.spritePosition ?? "left";
  // Prefer per-swipe expressions from the last assistant message's extra (survives swipe switching),
  // falling back to chat-level metadata for backward compatibility.
  const spriteExpressions: Record<string, string> = useMemo(() => {
    if (messages?.length) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i]!;
        if (m.role === "assistant") {
          const extra = typeof m.extra === "string" ? JSON.parse(m.extra) : (m.extra ?? {});
          if (extra.spriteExpressions && Object.keys(extra.spriteExpressions).length > 0) {
            return extra.spriteExpressions as Record<string, string>;
          }
          break; // only check the last assistant message
        }
      }
    }
    return chatMeta.spriteExpressions ?? {};
  }, [messages, chatMeta.spriteExpressions]);
  const groupChatMode: string | undefined = chatCharIds.length > 1 ? (chatMeta.groupChatMode ?? "merged") : undefined;

  const updateMeta = useUpdateChatMetadata();

  // Sync translation config from chat metadata to the translation store
  useEffect(() => {
    useTranslationStore.getState().setConfig({
      provider: chatMeta.translationProvider ?? "google",
      targetLanguage: chatMeta.translationTargetLang ?? "en",
      connectionId: chatMeta.translationConnectionId,
      deeplApiKey: chatMeta.translationDeeplApiKey,
      deeplxUrl: chatMeta.translationDeeplxUrl,
    });
    // Clear cached translations on chat switch
    useTranslationStore.getState().clearAll();
  }, [
    chat?.id,
    chatMeta.translationProvider,
    chatMeta.translationTargetLang,
    chatMeta.translationConnectionId,
    chatMeta.translationDeeplApiKey,
    chatMeta.translationDeeplxUrl,
  ]);

  // Restore per-chat background from metadata when switching chats.
  // If the new chat has a saved background, apply it; otherwise keep the current
  // background so newly-created chats don't flash to black.
  useEffect(() => {
    const bg = chatMeta.background as string | undefined;
    if (bg) {
      useUIStore.getState().setChatBackground(`/api/backgrounds/file/${encodeURIComponent(bg)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id]);

  // Persist background choice to chat metadata so it survives page refresh.
  // Catches all sources: manual picker, background agent, scene commands, slash commands.
  // Only persist non-null backgrounds — never write null to metadata (avoids wiping
  // the user's background when opening a new chat that hasn't had one set yet).
  const bgPersistTimer = useRef<ReturnType<typeof setTimeout>>(null);
  useEffect(() => {
    if (!chat?.id || !chatBackground) return;
    const filename = decodeURIComponent(chatBackground.replace(/^\/api\/backgrounds\/file\//, ""));
    // Skip if metadata already matches (avoids pointless writes on restore)
    if (filename === (chatMeta.background ?? null)) return;
    if (bgPersistTimer.current) clearTimeout(bgPersistTimer.current);
    bgPersistTimer.current = setTimeout(() => {
      updateMeta.mutate({ id: chat!.id, background: filename });
    }, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatBackground, chat?.id]);
  useEffect(() => {
    return () => {
      if (bgPersistTimer.current) clearTimeout(bgPersistTimer.current);
    };
  }, []);

  const expressionSaveTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const pendingExpressions = useRef<Record<string, string>>(spriteExpressions);

  useEffect(() => {
    pendingExpressions.current = spriteExpressions;
  }, [spriteExpressions]);

  // Clean up expression save timer on unmount
  useEffect(() => {
    return () => {
      if (expressionSaveTimer.current) clearTimeout(expressionSaveTimer.current);
    };
  }, []);

  const handleExpressionChange = useCallback(
    (characterId: string, expression: string) => {
      if (!chat?.id) return;
      pendingExpressions.current = { ...pendingExpressions.current, [characterId]: expression };
      if (expressionSaveTimer.current) clearTimeout(expressionSaveTimer.current);
      expressionSaveTimer.current = setTimeout(() => {
        updateMeta.mutate({ id: chat!.id, spriteExpressions: pendingExpressions.current });
        // Also persist to the last assistant message's extra so it's per-swipe
        if (messages?.length) {
          for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i]!;
            if (m.role === "assistant") {
              updateMessageExtra.mutate({
                messageId: m.id,
                extra: { spriteExpressions: pendingExpressions.current },
              });
              break;
            }
          }
        }
      }, 1000);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chat?.id, updateMeta, messages, updateMessageExtra],
  );

  const handleToggleSpritePosition = useCallback(() => {
    if (!chat?.id) return;
    const newSide = spritePosition === "left" ? "right" : "left";
    updateMeta.mutate({ id: chat.id, spritePosition: newSide });
  }, [chat?.id, spritePosition, updateMeta]);

  // Set of enabled agent type IDs (respects both global enableAgents toggle and per-chat agent list)
  const enabledAgentTypes = useMemo(() => {
    const set = new Set<string>();
    if (!chatMeta.enableAgents) return set;
    const activeAgentIds: string[] = Array.isArray(chatMeta.activeAgentIds) ? chatMeta.activeAgentIds : [];
    // Only show widgets for agents explicitly added to this chat
    for (const id of activeAgentIds) set.add(id);
    return set;
  }, [chatMeta.enableAgents, chatMeta.activeAgentIds]);

  const combatAgentEnabled = enabledAgentTypes.has("combat");
  const expressionAgentEnabled = enabledAgentTypes.has("expression");

  const handleDelete = useCallback((messageId: string) => {
    setDeleteDialogMessageId(messageId);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (deleteDialogMessageId) {
      deleteMessage.mutate(deleteDialogMessageId);
    }
    setDeleteDialogMessageId(null);
  }, [deleteDialogMessageId, deleteMessage]);

  const handleDeleteMore = useCallback(() => {
    if (deleteDialogMessageId) {
      setSelectedMessageIds(new Set([deleteDialogMessageId]));
    }
    setDeleteDialogMessageId(null);
    setMultiSelectMode(true);
  }, [deleteDialogMessageId]);

  const handleToggleSelectMessage = useCallback((messageId: string) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }, []);

  const handleBulkDelete = useCallback(() => {
    if (selectedMessageIds.size > 0) {
      deleteMessages.mutate([...selectedMessageIds]);
    }
    setMultiSelectMode(false);
    setSelectedMessageIds(new Set());
  }, [selectedMessageIds, deleteMessages]);

  const handleCancelMultiSelect = useCallback(() => {
    setMultiSelectMode(false);
    setSelectedMessageIds(new Set());
  }, []);

  const handleRegenerate = useCallback(
    async (messageId: string) => {
      if (!activeChatId || isStreaming) return;
      // On touch devices, confirm to prevent accidental taps
      if (matchMedia("(pointer: coarse)").matches && !confirm("Regenerate this message?")) return;
      try {
        // Regenerate as a new swipe on the existing message
        await generate({ chatId: activeChatId, connectionId: null, regenerateMessageId: messageId });
      } catch {
        // Error toast is shown by the generate hook
      }
    },
    [activeChatId, isStreaming, generate],
  );

  const _handleRetryAgents = useCallback(async () => {
    if (!activeChatId || isStreaming || agentProcessing || failedAgentTypes.length === 0) return;
    await retryAgents(activeChatId, failedAgentTypes);
  }, [activeChatId, isStreaming, agentProcessing, failedAgentTypes, retryAgents]);

  const handleRerunTrackers = useCallback(async () => {
    if (!activeChatId || isStreaming || agentProcessing) return;
    const trackerIds = new Set(BUILT_IN_AGENTS.filter((a) => a.category === "tracker").map((a) => a.id));
    const types = Array.from(enabledAgentTypes).filter((t) => trackerIds.has(t));
    if (types.length === 0) return;
    await retryAgents(activeChatId, types);
  }, [activeChatId, isStreaming, agentProcessing, enabledAgentTypes, retryAgents]);

  const handleSetActiveSwipe = useCallback(
    (messageId: string, index: number) => {
      setActiveSwipe.mutate(
        { messageId, index },
        {
          onSuccess: () => {
            // Refetch game state so the HUD shows trackers for the active swipe
            if (activeChatId) {
              api
                .get<import("@marinara-engine/shared").GameState | null>(`/chats/${activeChatId}/game-state`)
                .then((gs) => {
                  useGameStateStore.getState().setGameState(gs ?? null);
                })
                .catch(() => {});
            }
          },
        },
      );
    },
    [setActiveSwipe, activeChatId],
  );

  const handleEdit = useCallback(
    (messageId: string, content: string) => {
      updateMessage.mutate({ messageId, content });
    },
    [updateMessage],
  );

  const handleToggleConversationStart = useCallback(
    (messageId: string, current: boolean) => {
      updateMessageExtra.mutate({ messageId, extra: { isConversationStart: !current } });
    },
    [updateMessageExtra],
  );

  const handleBranch = useCallback(
    (messageId: string) => {
      if (!activeChatId) return;
      branchChat.mutate(
        { chatId: activeChatId, upToMessageId: messageId },
        {
          onSuccess: (newChat) => {
            if (newChat) useChatStore.getState().setActiveChatId(newChat.id);
          },
        },
      );
    },
    [activeChatId, branchChat],
  );

  // Peek prompt state
  const [peekPromptData, setPeekPromptData] = useState<{
    messages: Array<{ role: string; content: string }>;
    parameters: unknown;
    generationInfo?: {
      model?: string;
      provider?: string;
      temperature?: number | null;
      maxTokens?: number | null;
      showThoughts?: boolean | null;
      reasoningEffort?: string | null;
      verbosity?: string | null;
      tokensPrompt?: number | null;
      tokensCompletion?: number | null;
      durationMs?: number | null;
      finishReason?: string | null;
    } | null;
    agentNote?: string;
  } | null>(null);

  const handlePeekPrompt = useCallback(() => {
    if (!activeChatId) return;
    peekPrompt.mutate(activeChatId, {
      onSuccess: (data) => setPeekPromptData(data),
    });
  }, [activeChatId, peekPrompt]);

  // Find the last assistant message for peek-prompt eligibility
  const lastAssistantMessageId = useMemo(() => {
    if (!messages) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.role === "assistant") return messages[i]!.id;
    }
    return null;
  }, [messages]);

  useEffect(() => {
    if (chat) useChatStore.getState().setActiveChat(chat);
  }, [chat]);

  // Reset stagger animation flag when switching chats
  useEffect(() => {
    hasAnimatedRef.current = false;
  }, [activeChatId]);

  // Auto-open settings drawer for newly created chats
  const shouldOpenSettings = useChatStore((s) => s.shouldOpenSettings);
  const shouldOpenWizard = useChatStore((s) => s.shouldOpenWizard);
  useEffect(() => {
    if (shouldOpenSettings && activeChatId) {
      if (shouldOpenWizard) {
        setWizardOpen(true);
        useChatStore.getState().setShouldOpenWizard(false);
      } else {
        setSettingsOpen(true);
      }
      useChatStore.getState().setShouldOpenSettings(false);
    }
  }, [shouldOpenSettings, shouldOpenWizard, activeChatId]);

  // Auto-scroll on new messages / streaming (but not on "load more")
  // Only scroll if user is already near the bottom (within 150px).
  // During streaming, if the user scrolls (wheel, touch, or upward scroll),
  // stop auto-scrolling until they manually scroll back to the bottom.
  const isNearBottomRef = useRef(true);
  const userScrolledAwayRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const nearBottom = distFromBottom < 150;

      // Detect intentional upward scroll during streaming
      if (isStreaming && el.scrollTop < lastScrollTopRef.current - 10) {
        userScrolledAwayRef.current = true;
      }
      // Re-engage auto-scroll when the user returns to the bottom
      if (nearBottom) {
        userScrolledAwayRef.current = false;
      }

      lastScrollTopRef.current = el.scrollTop;
      isNearBottomRef.current = nearBottom;
    };

    // Wheel / touch: immediately disengage auto-scroll during streaming
    // so the user can read without being dragged to the bottom.
    const onUserScroll = () => {
      if (isStreaming && !userScrolledAwayRef.current) {
        userScrolledAwayRef.current = true;
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", onUserScroll, { passive: true });
    el.addEventListener("touchmove", onUserScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onUserScroll);
      el.removeEventListener("touchmove", onUserScroll);
    };
  }, [isStreaming]);

  // Reset scroll-away flag when streaming ends
  useEffect(() => {
    if (!isStreaming) userScrolledAwayRef.current = false;
  }, [isStreaming]);

  const newestMsgId = msgData?.pages[0]?.[msgData.pages[0].length - 1]?.id;
  const newestMsgSwipeIndex = msgData?.pages[0]?.[msgData.pages[0].length - 1]?.activeSwipeIndex;
  const isOptimistic = newestMsgId?.startsWith("__optimistic_");
  useEffect(() => {
    if (isLoadingMoreRef.current) return;
    // Always scroll when the user just sent a message (optimistic msg)
    if (isOptimistic || (isNearBottomRef.current && !userScrolledAwayRef.current)) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [newestMsgId, newestMsgSwipeIndex, isStreaming, isOptimistic]);

  // Auto-scroll on streamBuffer changes without causing ChatArea re-render.
  // Uses a store subscription so the hot per-token updates bypass React.
  useEffect(() => {
    let prev = useChatStore.getState().streamBuffer;
    const unsub = useChatStore.subscribe((state) => {
      if (state.streamBuffer !== prev) {
        prev = state.streamBuffer;
        if (!isLoadingMoreRef.current && isNearBottomRef.current && !userScrolledAwayRef.current) {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      }
    });
    return unsub;
  }, []);

  // Preserve scroll position when older messages are prepended
  const pageCount = msgData?.pages.length ?? 0;
  useLayoutEffect(() => {
    if (isLoadingMoreRef.current && scrollRef.current && !isFetchingNextPage) {
      const newScrollHeight = scrollRef.current.scrollHeight;
      scrollRef.current.scrollTop += newScrollHeight - prevScrollHeightRef.current;
      isLoadingMoreRef.current = false;
    }
  }, [pageCount, isFetchingNextPage]);

  const handleLoadMore = useCallback(() => {
    if (!scrollRef.current || !hasNextPage || isFetchingNextPage) return;
    prevScrollHeightRef.current = scrollRef.current.scrollHeight;
    isLoadingMoreRef.current = true;
    fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // ═══════════════════════════════════════════════
  // Empty state (no active chat)
  // ═══════════════════════════════════════════════
  if (!activeChatId) {
    return (
      <div
        data-component="ChatArea.EmptyState"
        className="flex flex-1 flex-col items-center overflow-y-auto p-4 sm:p-8"
      >
        <div className="flex w-full max-w-md flex-col items-center gap-6 my-auto py-4">
          {/* Central hero */}
          <div className="relative">
            <div className="animate-pulse-ring bunny-glow flex h-20 w-20 items-center justify-center rounded-2xl shadow-xl shadow-orange-500/20 overflow-hidden">
              <img src="/logo-splash.gif" alt="Marinara Engine" className="h-full w-full object-cover" />
            </div>
          </div>

          <div className="text-center">
            <h3 className="retro-glow-text text-xl font-bold tracking-tight">✧ Marinara Engine ✧</h3>
            <p className="mt-2 max-w-xs text-sm text-[var(--muted-foreground)]">
              To get started, choose the type of chat you'd like to have with the AI
            </p>
          </div>

          <div className="stagger-children flex flex-wrap justify-center gap-3">
            <QuickStartCard
              icon={<MessageSquare size="1.125rem" />}
              label="Conversation"
              bg="linear-gradient(135deg, #4de5dd, #3ab8b1)"
              shadowColor="rgba(77,229,221,0.15)"
              tooltip="General chat with one or more characters, or a model itself"
              onClick={() => handleQuickStart("conversation")}
            />
            <QuickStartCard
              icon={<BookOpen size="1.125rem" />}
              label="Roleplay"
              bg="linear-gradient(135deg, #eb8951, #d97530)"
              shadowColor="rgba(235,137,81,0.15)"
              tooltip="For roleplaying or creative writing with one or more characters"
              onClick={() => handleQuickStart("roleplay")}
            />
            <QuickStartCard
              icon={<Theater size="1.125rem" />}
              label="Game"
              bg="linear-gradient(135deg, #e15c8c, #c94776)"
              shadowColor="rgba(225,92,140,0.15)"
              tooltip="Coming soon"
              comingSoon
            />
          </div>

          <div className="retro-divider w-48" />

          {/* Footer */}
          <div className="mt-2 flex flex-col items-center gap-3">
            <p className="text-xs text-[var(--muted-foreground)]/60">
              Created by{" "}
              <a
                href="https://spicymarinara.github.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-[var(--muted-foreground)]/30 hover:text-[var(--primary)] hover:decoration-[var(--primary)]/40 transition-colors"
              >
                Marinara
              </a>
            </p>
            <p className="text-[0.625rem] text-[var(--muted-foreground)]/50">
              Partnered with{" "}
              <a
                href="https://linkapi.ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-[var(--muted-foreground)]/30 hover:text-[var(--primary)] hover:decoration-[var(--primary)]/40 transition-colors"
              >
                LinkAPI
              </a>
            </p>
            <p className="text-[0.625rem] text-[var(--muted-foreground)]/50">
              Art and logo by{" "}
              <a
                href="https://huntercolliex.carrd.co/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-[var(--muted-foreground)]/30 hover:text-[var(--primary)] hover:decoration-[var(--primary)]/40 transition-colors"
              >
                Huntercolliex
              </a>
            </p>
            <div className="flex gap-2">
              <a
                href="https://discord.com/invite/KdAkTg94ME"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/60 px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
              >
                <svg width="0.875rem" height="0.875rem" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
                </svg>
                Discord
              </a>
              <a
                href="https://ko-fi.com/marinara_spaghetti"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/60 px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
              >
                <svg width="0.875rem" height="0.875rem" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                Support
              </a>
            </div>

            {/* Special thanks */}
            <p className="mt-1 max-w-xs text-center text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]/40">
              Special thanks to LukaTheHero, Coxde, JorgeLTE, Seele The Seal King, Loungemeister, Kale, Tabris, GREGOR
              OVECH, Coins, Tacoman, Jorge, Promansis, Kitsumiro, Sheep, Pod042, Prolix, PlutoMayhem, Mezzeh, Kuc0,
              Exalted, Yang Best Girl, MidnightSleeper, Geechan, TheLonelyDevil, Artus, and you!
            </p>

            {/* Restart tutorial */}
            <button
              onClick={() => useUIStore.getState().setHasCompletedOnboarding(false)}
              className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.625rem] text-[var(--muted-foreground)]/40 transition-colors hover:text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/60"
              title="Replay tutorial"
            >
              <HelpCircle size="0.75rem" />
              Replay Tutorial
            </button>

            <p className="mt-2 text-[0.625rem] tracking-wide text-[var(--muted-foreground)]/30">v{APP_VERSION}</p>
          </div>
        </div>
      </div>
    );
  }

  // Helper: is this message grouped with the previous one?
  const isGrouped = (i: number) => {
    if (i === 0 || !messages) return false;
    const prev = messages[i - 1];
    const curr = messages[i];
    return prev.role === curr.role && prev.characterId === curr.characterId;
  };

  // ═══════════════════════════════════════════════
  // Unified layout — mode-aware rendering
  // ═══════════════════════════════════════════════
  const msgPayload = (messages ?? []).map((m) => ({ role: m.role, characterId: m.characterId, content: m.content }));

  // ═══════════════════════════════════════════════
  // Conversation mode — Discord-style layout
  // ═══════════════════════════════════════════════
  if (chatMode === "conversation") {
    return (
      <div data-component="ChatArea.Conversation" className="flex flex-1 overflow-hidden">
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <ConversationView
            chatId={activeChatId}
            messages={messages}
            isLoading={isLoading}
            hasNextPage={hasNextPage ?? false}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
            pageCount={pageCount}
            characterMap={characterMap}
            characterNames={characterNames}
            personaInfo={personaInfo}
            chatCharIds={chatCharIds}
            onDelete={handleDelete}
            onRegenerate={handleRegenerate}
            onEdit={handleEdit}
            onPeekPrompt={handlePeekPrompt}
            lastAssistantMessageId={lastAssistantMessageId}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenFiles={() => setFilesOpen(true)}
            onOpenGallery={() => setGalleryOpen(true)}
            multiSelectMode={multiSelectMode}
            selectedMessageIds={selectedMessageIds}
            onToggleSelectMessage={handleToggleSelectMessage}
            connectedChatName={
              chat?.connectedChatId ? (allChats ?? []).find((c: any) => c.id === chat.connectedChatId)?.name : undefined
            }
            onSwitchChat={chat?.connectedChatId ? () => setActiveChatId(chat.connectedChatId!) : undefined}
            sceneInfo={
              chatMeta.activeSceneChatId && (allChats ?? []).some((c: any) => c.id === chatMeta.activeSceneChatId)
                ? { variant: "origin" as const, sceneChatId: chatMeta.activeSceneChatId }
                : chatMeta.sceneStatus === "active"
                  ? {
                      variant: "scene" as const,
                      sceneChatId: activeChatId,
                      originChatId: chatMeta.sceneOriginChatId,
                      description: chatMeta.sceneDescription,
                    }
                  : undefined
            }
            onConcludeScene={chatMeta.sceneStatus === "active" ? concludeScene : undefined}
            onAbandonScene={chatMeta.sceneStatus === "active" ? abandonScene : undefined}
          />

          {/* Drawers */}
          {chat && <ChatSettingsDrawer chat={chat} open={settingsOpen} onClose={() => setSettingsOpen(false)} />}
          {chat && <ChatFilesDrawer chat={chat} open={filesOpen} onClose={() => setFilesOpen(false)} />}
          {chat && <ChatGalleryDrawer chat={chat} open={galleryOpen} onClose={() => setGalleryOpen(false)} />}
          {chat && wizardOpen && (
            <ChatSetupWizard
              chat={chat}
              onFinish={() => {
                setWizardOpen(false);
                setSettingsOpen(true);
              }}
            />
          )}
        </div>

        {/* Pinned gallery images */}
        <PinnedImageOverlay activeChatId={activeChatId} />

        {/* Peek Prompt Modal */}
        {peekPromptData && <PeekPromptModal data={peekPromptData} onClose={() => setPeekPromptData(null)} />}

        {/* Delete confirmation dialog */}
        {deleteDialogMessageId && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setDeleteDialogMessageId(null)}
          >
            <div
              className="mx-4 w-full max-w-xs rounded-xl bg-[var(--card)] p-5 shadow-2xl ring-1 ring-[var(--border)]"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-4 text-sm font-semibold text-center">How to proceed?</p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleDeleteConfirm}
                  className="rounded-lg bg-[var(--destructive)] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--destructive)]/80"
                >
                  Delete this message
                </button>
                <button
                  onClick={handleDeleteMore}
                  className="rounded-lg bg-[var(--secondary)] px-4 py-2 text-xs font-medium transition-colors hover:bg-[var(--accent)]"
                >
                  Delete more
                </button>
                <button
                  onClick={() => setDeleteDialogMessageId(null)}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Multi-select floating bar */}
        {multiSelectMode && (
          <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-[var(--card)] px-5 py-3 shadow-2xl ring-1 ring-[var(--border)]">
            <span className="text-xs font-medium text-[var(--muted-foreground)]">
              {selectedMessageIds.size} selected
            </span>
            <button
              onClick={handleBulkDelete}
              disabled={selectedMessageIds.size === 0}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--destructive)] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--destructive)]/80 disabled:opacity-40"
            >
              <Trash2 size="0.75rem" />
              Delete selected
            </button>
            <button
              onClick={handleCancelMultiSelect}
              className="rounded-lg px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // Roleplay / Visual Novel mode — existing layout
  // ═══════════════════════════════════════════════

  return (
    <div data-component="ChatArea.Roleplay" className="flex flex-1 overflow-hidden">
      {/* Sprite sidebar — left (only if expression agent enabled) */}
      {expressionAgentEnabled && spritePosition === "left" && spriteCharacterIds.length > 0 && (
        <SpriteSidebar
          characterIds={spriteCharacterIds}
          messages={msgPayload}
          characterMap={characterMap}
          isRoleplay={isRoleplay}
        />
      )}

      <div className="relative flex flex-1 flex-col overflow-hidden mari-chat-area rpg-chat-area">
        {/* ── Background layers ── */}
        <CrossfadeBackground url={chatBackground} />
        <div className="absolute inset-0 rpg-overlay" />
        <div className="absolute inset-0 rpg-vignette pointer-events-none" />
        {weatherEffects && <WeatherEffectsConnected />}
        {expressionAgentEnabled && (
          <SpriteOverlay
            characterIds={chatCharIds}
            messages={msgPayload}
            side={spritePosition}
            spriteExpressions={spriteExpressions}
            onExpressionChange={handleExpressionChange}
          />
        )}

        {/* ── Outer flex for HUD ── */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* ── Header / Toolbar area ── */}
            <>
              {/* Desktop top bar — hidden on mobile AND when compact */}
              <div
                className={cn(
                  "pointer-events-none relative z-40 items-center px-4 py-2 max-md:hidden",
                  centerCompact ? "hidden" : "flex",
                )}
              >
                {chat && chatMeta.enableAgents && (
                  <div className="pointer-events-auto flex-1 overflow-x-auto">
                    <RoleplayHUD
                      chatId={chat.id}
                      characterCount={chatCharIds.length}
                      layout="top"
                      onRetriggerTrackers={handleRerunTrackers}
                      enabledAgentTypes={enabledAgentTypes}
                      manualTrackers={!!chatMeta.manualTrackers}
                    />
                  </div>
                )}
                <div className="pointer-events-auto flex shrink-0 items-center gap-1.5 ml-auto">
                  <ToolbarMenu>
                    <SummaryButton chatId={chat?.id ?? null} summary={chatMeta.summary ?? null} />
                    <WorldInfoButton chatId={chat?.id ?? null} />
                    <AuthorNotesButton chatId={chat?.id ?? null} chatMeta={chatMeta} />
                    <RpToolbarButton
                      icon={<FolderOpen size="0.875rem" />}
                      title="Manage Chat Files"
                      onClick={() => setFilesOpen(true)}
                    />
                    {expressionAgentEnabled && chatCharIds.length > 0 && (
                      <RpToolbarButton
                        icon={<FlipHorizontal2 size="0.875rem" />}
                        title={`Sprite: ${spritePosition} side`}
                        onClick={handleToggleSpritePosition}
                      />
                    )}
                    <RpToolbarButton
                      icon={<Image size="0.875rem" />}
                      title="Gallery"
                      onClick={() => setGalleryOpen(true)}
                    />
                    {chat?.connectedChatId &&
                      (() => {
                        const linked = (allChats ?? []).find((c: any) => c.id === chat.connectedChatId);
                        return (
                          <RpToolbarButton
                            icon={<ArrowRightLeft size="0.875rem" />}
                            title={linked ? `Switch to ${linked.name}` : "Connected chat"}
                            onClick={() => setActiveChatId(chat.connectedChatId!)}
                          />
                        );
                      })()}
                    <RpToolbarButton
                      icon={<Settings2 size="0.875rem" />}
                      title="Chat Settings"
                      onClick={() => setSettingsOpen(true)}
                    />
                  </ToolbarMenu>
                </div>
              </div>
              {/* Compact / mobile top bar */}
              <div
                className={cn(
                  "pointer-events-auto relative z-40 w-full flex-col",
                  centerCompact ? "flex" : "flex md:hidden",
                )}
              >
                {chat && chatMeta.enableAgents && (
                  <div className="flex w-full items-center justify-between px-2 pt-2 pb-1">
                    <RoleplayHUD
                      chatId={chat.id}
                      characterCount={chatCharIds.length}
                      layout="top"
                      onRetriggerTrackers={handleRerunTrackers}
                      enabledAgentTypes={enabledAgentTypes}
                      manualTrackers={!!chatMeta.manualTrackers}
                      mobileCompact
                    />
                    <ToolbarMenu>
                      <SummaryButton chatId={chat?.id ?? null} summary={chatMeta.summary ?? null} />
                      <WorldInfoButton chatId={chat?.id ?? null} />
                      <AuthorNotesButton chatId={chat?.id ?? null} chatMeta={chatMeta} />
                      <RpToolbarButton
                        icon={<FolderOpen size="0.875rem" />}
                        title="Manage Chat Files"
                        onClick={() => setFilesOpen(true)}
                      />
                      {expressionAgentEnabled && chatCharIds.length > 0 && (
                        <RpToolbarButton
                          icon={<FlipHorizontal2 size="0.875rem" />}
                          title={`Sprite: ${spritePosition} side`}
                          onClick={handleToggleSpritePosition}
                        />
                      )}
                      <RpToolbarButton
                        icon={<Image size="0.875rem" />}
                        title="Gallery"
                        onClick={() => setGalleryOpen(true)}
                      />
                      {chat?.connectedChatId &&
                        (() => {
                          const linked = (allChats ?? []).find((c: any) => c.id === chat.connectedChatId);
                          return (
                            <RpToolbarButton
                              icon={<ArrowRightLeft size="0.875rem" />}
                              title={linked ? `Switch to ${linked.name}` : "Connected chat"}
                              onClick={() => setActiveChatId(chat.connectedChatId!)}
                            />
                          );
                        })()}
                      <RpToolbarButton
                        icon={<Settings2 size="0.875rem" />}
                        title="Chat Settings"
                        onClick={() => setSettingsOpen(true)}
                      />
                    </ToolbarMenu>
                  </div>
                )}
                {chat && !chatMeta.enableAgents && (
                  <div className="flex w-full items-center justify-end gap-1.5 px-2 pt-2 pb-1">
                    <ToolbarMenu>
                      <SummaryButton chatId={chat?.id ?? null} summary={chatMeta.summary ?? null} />
                      <WorldInfoButton chatId={chat?.id ?? null} />
                      <AuthorNotesButton chatId={chat?.id ?? null} chatMeta={chatMeta} />
                      <RpToolbarButton
                        icon={<FolderOpen size="0.875rem" />}
                        title="Manage Chat Files"
                        onClick={() => setFilesOpen(true)}
                      />
                      <RpToolbarButton
                        icon={<Image size="0.875rem" />}
                        title="Gallery"
                        onClick={() => setGalleryOpen(true)}
                      />
                      {chat?.connectedChatId &&
                        (() => {
                          const linked = (allChats ?? []).find((c: any) => c.id === chat.connectedChatId);
                          return (
                            <RpToolbarButton
                              icon={<ArrowRightLeft size="0.875rem" />}
                              title={linked ? `Switch to ${linked.name}` : "Connected chat"}
                              onClick={() => setActiveChatId(chat.connectedChatId!)}
                            />
                          );
                        })()}
                      <RpToolbarButton
                        icon={<Settings2 size="0.875rem" />}
                        title="Chat Settings"
                        onClick={() => setSettingsOpen(true)}
                      />
                    </ToolbarMenu>
                  </div>
                )}
              </div>
            </>

            {/* Combat Encounter Modal */}
            {encounterActive && <EncounterModal />}

            {/* ── Messages scroll area ── */}
            <div className={cn("relative flex-1 overflow-hidden z-10")}>
              <div
                ref={scrollRef}
                className={cn(
                  "mari-messages-scroll h-full overflow-y-auto overflow-x-hidden pt-4 pb-1 rpg-chat-messages-mobile relative",
                  centerCompact ? "px-3" : "px-3 md:px-[15%]",
                )}
              >
                {/* Load More */}
                {hasNextPage && (
                  <div className="mb-3 flex justify-center">
                    <button
                      onClick={handleLoadMore}
                      disabled={isFetchingNextPage}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/10 bg-black/40 px-3 py-1.5 text-xs font-medium text-foreground/70 backdrop-blur-sm transition-all hover:bg-foreground/10 hover:text-foreground/90 disabled:opacity-50"
                    >
                      {isFetchingNextPage ? (
                        <Loader2 size="0.75rem" className="animate-spin" />
                      ) : (
                        <ChevronUp size="0.75rem" />
                      )}
                      Load More
                    </button>
                  </div>
                )}

                {isLoading && (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
                  </div>
                )}

                {(() => {
                  // Only animate entry on the very first render with messages;
                  // skip on subsequent refetches to avoid a visible flash when
                  // optimistic messages are replaced by real server data.
                  const shouldAnimate = !hasAnimatedRef.current;
                  if (messages?.length) hasAnimatedRef.current = true;
                  return messages?.map((msg, i) => {
                    const isRegenerating = isStreaming && regenerateMessageId === msg.id;
                    return (
                      <div
                        key={msg.id}
                        className={shouldAnimate ? "animate-message-in" : undefined}
                        style={
                          shouldAnimate
                            ? { animationDelay: `${Math.min(i * 30, 200)}ms`, animationFillMode: "backwards" }
                            : undefined
                        }
                      >
                        {isRegenerating ? (
                          <RegeneratingMessageContent
                            msg={msg}
                            onDelete={handleDelete}
                            onRegenerate={handleRegenerate}
                            onEdit={handleEdit}
                            onSetActiveSwipe={handleSetActiveSwipe}
                            onToggleConversationStart={handleToggleConversationStart}
                            onPeekPrompt={handlePeekPrompt}
                            onBranch={handleBranch}
                            isLastAssistantMessage={msg.id === lastAssistantMessageId}
                            characterMap={characterMap}
                            personaInfo={personaInfo}
                            chatMode={chatMode}
                            messageDepth={messages ? messages.length - 1 - i : undefined}
                            isGrouped={isGrouped(i)}
                            groupChatMode={groupChatMode}
                            chatCharacterIds={chatCharIds}
                            multiSelectMode={multiSelectMode}
                            isSelected={selectedMessageIds.has(msg.id)}
                            onToggleSelect={handleToggleSelectMessage}
                          />
                        ) : (
                          <ChatMessage
                            message={msg}
                            isStreaming={false}
                            onDelete={handleDelete}
                            onRegenerate={handleRegenerate}
                            onEdit={handleEdit}
                            onSetActiveSwipe={handleSetActiveSwipe}
                            onToggleConversationStart={handleToggleConversationStart}
                            onPeekPrompt={handlePeekPrompt}
                            onBranch={handleBranch}
                            isLastAssistantMessage={msg.id === lastAssistantMessageId}
                            characterMap={characterMap}
                            personaInfo={personaInfo}
                            chatMode={chatMode}
                            messageDepth={messages ? messages.length - 1 - i : undefined}
                            isGrouped={isGrouped(i)}
                            groupChatMode={groupChatMode}
                            chatCharacterIds={chatCharIds}
                            multiSelectMode={multiSelectMode}
                            isSelected={selectedMessageIds.has(msg.id)}
                            onToggleSelect={handleToggleSelectMessage}
                          />
                        )}
                      </div>
                    );
                  });
                })()}

                {/* CYOA choice buttons */}
                {!isStreaming && <CyoaChoices messages={messages} />}

                {/* Streaming indicator */}
                {isStreaming && !regenerateMessageId && (
                  <StreamingIndicator
                    activeChatId={activeChatId}
                    chatCharIds={chatCharIds}
                    characterMap={characterMap}
                    personaInfo={personaInfo}
                    chatMode={chatMode}
                    groupChatMode={groupChatMode}
                  />
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* ── Input area ── */}
            <div className="relative z-20">
              <div className={cn("relative", centerCompact ? "px-3" : "px-3 md:px-[12%]")}>
                {chatMeta.sceneStatus === "active" && (
                  <EndSceneBar
                    sceneChatId={activeChatId}
                    originChatId={chatMeta.sceneOriginChatId}
                    onConclude={concludeScene}
                    onAbandon={abandonScene}
                  />
                )}
                {combatAgentEnabled && (
                  <div className="flex justify-center py-1">
                    <button
                      onClick={() => startEncounter()}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs text-foreground/50 transition-all hover:bg-foreground/10 hover:text-orange-300"
                      title="Start Combat Encounter"
                    >
                      <Swords size="0.875rem" />
                      <span>Encounter</span>
                    </button>
                  </div>
                )}
                <ChatInput mode={isRoleplay ? "roleplay" : "conversation"} characterNames={characterNames} />
              </div>
            </div>

            {/* Drawers */}
            {chat && <ChatSettingsDrawer chat={chat} open={settingsOpen} onClose={() => setSettingsOpen(false)} />}
            {chat && <ChatFilesDrawer chat={chat} open={filesOpen} onClose={() => setFilesOpen(false)} />}
            {chat && <ChatGalleryDrawer chat={chat} open={galleryOpen} onClose={() => setGalleryOpen(false)} />}
            {chat && wizardOpen && (
              <ChatSetupWizard
                chat={chat}
                onFinish={() => {
                  setWizardOpen(false);
                  setSettingsOpen(true);
                }}
              />
            )}
          </div>

          {/* Right HUD sidebar removed — widgets always use top position */}
        </div>

        {/* Echo Chamber — positioned absolutely within the chat area */}
        <EchoChamberPanel />
      </div>

      {/* Sprite sidebar — right (only if expression agent enabled) */}
      {expressionAgentEnabled && spritePosition === "right" && spriteCharacterIds.length > 0 && (
        <SpriteSidebar
          characterIds={spriteCharacterIds}
          messages={msgPayload}
          characterMap={characterMap}
          isRoleplay={isRoleplay}
        />
      )}

      {/* Agent thought bubbles (conversation only) */}
      {!isRoleplay && <AgentThoughtBubbles enabledAgentTypes={enabledAgentTypes} />}

      {/* Pinned gallery images */}
      <PinnedImageOverlay activeChatId={activeChatId} />

      {/* Peek Prompt Modal */}
      {peekPromptData && <PeekPromptModal data={peekPromptData} onClose={() => setPeekPromptData(null)} />}

      {/* Delete confirmation dialog */}
      {deleteDialogMessageId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setDeleteDialogMessageId(null)}
        >
          <div
            className="mx-4 w-full max-w-xs rounded-xl bg-[var(--card)] p-5 shadow-2xl ring-1 ring-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-4 text-sm font-semibold text-center">How to proceed?</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleDeleteConfirm}
                className="rounded-lg bg-[var(--destructive)] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--destructive)]/80"
              >
                Delete this message
              </button>
              <button
                onClick={handleDeleteMore}
                className="rounded-lg bg-[var(--secondary)] px-4 py-2 text-xs font-medium transition-colors hover:bg-[var(--accent)]"
              >
                Delete more
              </button>
              <button
                onClick={() => setDeleteDialogMessageId(null)}
                className="rounded-lg px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-select floating bar */}
      {multiSelectMode && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-[var(--card)] px-5 py-3 shadow-2xl ring-1 ring-[var(--border)]">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">{selectedMessageIds.size} selected</span>
          <button
            onClick={handleBulkDelete}
            disabled={selectedMessageIds.size === 0}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--destructive)] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--destructive)]/80 disabled:opacity-40"
          >
            <Trash2 size="0.75rem" />
            Delete selected
          </button>
          <button
            onClick={handleCancelMultiSelect}
            className="rounded-lg px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

/** Animated typing indicator — three bouncing dots (currently unused, kept for future) */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="flex items-center gap-1 rounded-xl bg-[var(--secondary)] px-4 py-2.5">
        <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted-foreground)]/60 [animation-delay:0ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted-foreground)]/60 [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted-foreground)]/60 [animation-delay:300ms]" />
      </div>
    </div>
  );
}

/** Glassmorphism toolbar button for roleplay mode */
function RpToolbarButton({
  icon,
  title,
  onClick,
  size,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  size?: "sm";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center rounded-full bg-foreground/5 border border-foreground/10 text-foreground/60 backdrop-blur-md transition-all hover:bg-foreground/10 hover:text-foreground",
        size === "sm" ? "p-1" : "p-1.5",
      )}
      title={title}
    >
      {icon}
    </button>
  );
}

function QuickStartCard({
  icon,
  label,
  bg,
  shadowColor,
  onClick,
  comingSoon,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  bg: string;
  shadowColor?: string;
  onClick?: () => void;
  comingSoon?: boolean;
  tooltip?: string;
}) {
  const [showComingSoon, setShowComingSoon] = useState(false);

  const handleClick = () => {
    if (comingSoon && !onClick) {
      setShowComingSoon(true);
      setTimeout(() => setShowComingSoon(false), 1500);
      return;
    }
    onClick?.();
  };

  return (
    <div
      onClick={handleClick}
      title={tooltip}
      className={cn(
        "group card-3d-tilt btn-scanlines relative flex w-24 sm:w-28 flex-col items-center justify-center gap-2 rounded-xl border-2 border-[var(--border)] bg-[var(--card)] p-3 sm:p-4 text-center transition-all",
        "cursor-pointer hover:-translate-y-1 hover:border-[var(--primary)]/40 hover:shadow-lg",
      )}
      style={shadowColor ? { ["--tw-shadow-color" as string]: shadowColor } : undefined}
    >
      {showComingSoon && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--secondary)] px-2 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] shadow-md animate-fade-in-up">
          Coming Soon
        </span>
      )}
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm transition-transform group-hover:scale-110"
        style={{ background: bg }}
      >
        {icon}
      </div>
      <span className="text-xs font-medium text-[var(--muted-foreground)]">{label}</span>
    </div>
  );
}

/** Summary button with popover — lives in the chat header */

/**
 * ToolbarMenu — a "..." button on mobile that reveals all toolbar icons in a popover.
 * On desktop, the icons are rendered inline normally.
 */
function ToolbarMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const compact = useUIStore((s) => s.centerCompact);
  const btnRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || popRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <>
      {/* Desktop: show children inline — hidden on mobile */}
      <div className={cn("items-center gap-1.5 max-md:hidden", compact ? "hidden" : "flex")}>{children}</div>
      {/* Compact / mobile: show ... button + popover */}
      <div className={cn("relative shrink-0", compact ? "block" : "block md:hidden")} ref={btnRef}>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex w-9 items-center justify-center rounded-xl border backdrop-blur-md transition-all p-1.5",
            "bg-black/40 border-foreground/10 text-foreground/60 hover:bg-black/60 hover:text-foreground",
            open && "bg-black/60 border-foreground/20 text-foreground",
          )}
          title="More options"
        >
          <MoreHorizontal size="0.9375rem" />
        </button>
        {open &&
          createPortal(
            <div
              ref={popRef}
              className="fixed z-[9999] flex w-9 flex-col items-center gap-0.5 rounded-xl border border-foreground/10 bg-black/80 p-1 shadow-xl backdrop-blur-xl animate-message-in"
              style={{ top: pos.top, right: pos.right }}
              onClick={() => setOpen(false)}
            >
              {children}
            </div>,
            document.body,
          )}
      </div>
    </>
  );
}

function SummaryButton({ chatId, summary }: { chatId: string | null; summary: string | null }) {
  const [open, setOpen] = useState(false);
  const compact = useUIStore((s) => s.centerCompact);
  if (!chatId) return null;
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center justify-center rounded-full border backdrop-blur-md transition-all",
          compact ? "p-1" : "p-1.5",
          open
            ? "bg-foreground/15 border-foreground/20 text-foreground/90"
            : summary
              ? "bg-foreground/10 border-foreground/25 text-foreground/80 hover:bg-foreground/15 hover:text-foreground"
              : "bg-foreground/5 border-foreground/10 text-foreground/60 hover:bg-foreground/10 hover:text-foreground",
        )}
        title="Chat Summary"
      >
        <ScrollText size="0.875rem" />
      </button>
      {open && <SummaryPopover chatId={chatId} summary={summary} onClose={() => setOpen(false)} />}
    </div>
  );
}

function WorldInfoButton({ chatId }: { chatId: string | null }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useActiveLorebookEntries(chatId, true);
  const ref = useRef<HTMLDivElement>(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const compact = useUIStore((s) => s.centerCompact);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  if (!chatId) return null;
  const entries = data?.entries ?? [];
  const hasEntries = entries.length > 0;

  const panelContent = (
    <>
      <h3 className="mb-2 text-xs font-semibold text-[var(--foreground)] flex items-center gap-1.5">
        <Globe size="0.75rem" />
        Active World Info
        {isMobile && (
          <button
            onClick={() => setOpen(false)}
            className="ml-auto rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          >
            <X size="0.75rem" />
          </button>
        )}
      </h3>
      {isLoading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-[var(--muted-foreground)]">
          <Loader2 size="0.75rem" className="animate-spin" />
          Scanning entries…
        </div>
      ) : entries.length === 0 ? (
        <p className="py-3 text-center text-xs text-[var(--muted-foreground)]">No active entries for this chat</p>
      ) : (
        <>
          <p className="mb-2 text-[0.625rem] text-[var(--muted-foreground)]">
            {entries.length} active • ~{(data?.totalTokens ?? 0).toLocaleString()} tokens
          </p>
          <div className="space-y-1.5">
            {entries.map((entry) => (
              <WorldInfoEntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        </>
      )}
    </>
  );

  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center justify-center rounded-full border backdrop-blur-md transition-all",
          compact ? "p-1" : "p-1.5",
          open
            ? "bg-foreground/15 border-foreground/20 text-foreground/90"
            : hasEntries && !isLoading
              ? "bg-foreground/10 border-foreground/25 text-foreground/80 hover:bg-foreground/15 hover:text-foreground"
              : "bg-foreground/5 border-foreground/10 text-foreground/60 hover:bg-foreground/10 hover:text-foreground",
        )}
        title="Active World Info"
      >
        <Globe size="0.875rem" />
      </button>
      {open &&
        (isMobile ? (
          createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 max-md:pt-[max(1rem,env(safe-area-inset-top))]">
              <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
              <div className="relative w-full max-w-sm max-h-[calc(100dvh-4rem)] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-2xl shadow-black/40 animate-message-in">
                {panelContent}
              </div>
            </div>,
            document.body,
          )
        ) : (
          <div className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] max-h-[60vh] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-2xl shadow-black/40 animate-message-in">
            {panelContent}
          </div>
        ))}
    </div>
  );
}

function AuthorNotesButton({ chatId, chatMeta }: { chatId: string | null; chatMeta: Record<string, any> }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState((chatMeta.authorNotes as string) ?? "");
  const [depthStr, setDepthStr] = useState(String((chatMeta.authorNotesDepth as number) ?? 4));
  const updateMeta = useUpdateChatMetadata();
  const ref = useRef<HTMLDivElement>(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const compact = useUIStore((s) => s.centerCompact);

  // Sync from metadata when it changes externally
  useEffect(() => {
    setNotes((chatMeta.authorNotes as string) ?? "");
    setDepthStr(String((chatMeta.authorNotesDepth as number) ?? 4));
  }, [chatMeta.authorNotes, chatMeta.authorNotesDepth]);

  const depth = parseInt(depthStr, 10) || 0;

  // Close on outside click (desktop)
  useEffect(() => {
    if (!open || isMobile) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open, isMobile]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  if (!chatId) return null;

  const hasNotes = !!notes.trim();

  const handleSave = () => {
    updateMeta.mutate({ id: chatId, authorNotes: notes, authorNotesDepth: depth });
  };

  const panelContent = (
    <>
      <h3 className="mb-2 text-xs font-semibold text-[var(--foreground)] flex items-center gap-1.5">
        <PenLine size="0.75rem" />
        Author's Notes
        {isMobile && (
          <button
            onClick={() => setOpen(false)}
            className="ml-auto rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          >
            <X size="0.75rem" />
          </button>
        )}
      </h3>
      <p className="mb-2 text-[0.625rem] text-[var(--muted-foreground)]">
        Text here is injected into the prompt at the chosen depth every generation.
      </p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={handleSave}
        placeholder="e.g. Keep the tone dark and suspenseful. The villain is secretly an ally."
        className="w-full rounded-lg bg-[var(--secondary)] border border-[var(--border)] px-2.5 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none resize-none focus:ring-2 focus:ring-[var(--ring)] transition-colors"
        rows={4}
      />
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[0.625rem] text-[var(--muted-foreground)] shrink-0">Injection Depth</span>
        <input
          type="text"
          inputMode="numeric"
          value={depthStr}
          onChange={(e) => setDepthStr(e.target.value.replace(/[^0-9]/g, ""))}
          onBlur={() => {
            const val = Math.max(0, parseInt(depthStr, 10) || 0);
            setDepthStr(String(val));
            updateMeta.mutate({ id: chatId, authorNotes: notes, authorNotesDepth: val });
          }}
          className="w-14 rounded-md bg-[var(--secondary)] border border-[var(--border)] px-2 py-0.5 text-[0.625rem] text-[var(--foreground)] outline-none text-center focus:ring-2 focus:ring-[var(--ring)] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      <p className="mt-1 text-[0.5625rem] text-[var(--muted-foreground)]/60">
        Depth 0 = end of conversation, 4 = four messages from the end.
      </p>
    </>
  );

  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center justify-center rounded-full border backdrop-blur-md transition-all",
          compact ? "p-1" : "p-1.5",
          open
            ? "bg-foreground/15 border-foreground/20 text-foreground/90"
            : hasNotes
              ? "bg-foreground/10 border-foreground/25 text-foreground/80 hover:bg-foreground/15 hover:text-foreground"
              : "bg-foreground/5 border-foreground/10 text-foreground/60 hover:bg-foreground/10 hover:text-foreground",
        )}
        title="Author's Notes"
      >
        <PenLine size="0.875rem" />
      </button>
      {open &&
        (isMobile ? (
          createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 max-md:pt-[max(1rem,env(safe-area-inset-top))]">
              <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
              <div className="relative w-full max-w-sm max-h-[calc(100dvh-4rem)] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-2xl shadow-black/40 animate-message-in">
                {panelContent}
              </div>
            </div>,
            document.body,
          )
        ) : (
          <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-2xl shadow-black/40 animate-message-in">
            {panelContent}
          </div>
        ))}
    </div>
  );
}

function WorldInfoEntryRow({
  entry,
}: {
  entry: { name: string; keys: string[]; content: string; constant: boolean; order: number };
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="rounded-lg bg-[var(--secondary)] p-2 text-xs cursor-pointer transition-colors hover:bg-[var(--accent)]"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
        <span className="font-medium text-[var(--foreground)]/80 truncate">{entry.name}</span>
        {entry.constant && (
          <span className="rounded bg-amber-400/15 px-1 py-0.5 text-[0.5rem] font-medium text-amber-400 shrink-0">
            CONST
          </span>
        )}
        <span className="ml-auto text-[0.625rem] text-[var(--muted-foreground)] shrink-0">#{entry.order}</span>
      </div>
      {entry.keys.length > 0 && (
        <p className="mt-0.5 truncate text-[0.625rem] text-[var(--muted-foreground)]">
          Keys: {entry.keys.slice(0, 5).join(", ")}
          {entry.keys.length > 5 && ` +${entry.keys.length - 5}`}
        </p>
      )}
      {expanded && (
        <p className="mt-1.5 whitespace-pre-wrap text-[0.6875rem] text-[var(--muted-foreground)] leading-relaxed border-t border-[var(--border)] pt-1.5 max-h-40 overflow-y-auto">
          {entry.content || "(empty)"}
        </p>
      )}
    </div>
  );
}
