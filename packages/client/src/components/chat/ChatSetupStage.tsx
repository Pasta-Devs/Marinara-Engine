import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ComponentProps,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { useQueries } from "@tanstack/react-query";
import { Trans, useTranslation } from "react-i18next";
import {
  BookOpen,
  Bookmark,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Cpu,
  Feather,
  ImageIcon,
  MessageSquare,
  Play,
  Sparkles,
  Users,
  CircleAlert,
} from "lucide-react";
import {
  BUILT_IN_AGENTS,
  estimateTextTokens,
  readChatModelOverride,
  type Chat,
  type Lorebook,
  type LorebookEntry,
} from "@marinara-engine/shared";
import { api } from "../../lib/api-client";
import { extractColorsFromImage } from "../../lib/avatar-color-extraction";
import { useReducedAmbientEffects } from "../../hooks/use-reduced-ambient-effects";
import { useChatStore } from "../../stores/chat.store";
import { useMatchMedia } from "../../hooks/use-match-media";
import { useUpdateChat, useUpdateChatMetadata } from "../../hooks/use-chats";
import { useConnections } from "../../hooks/use-connections";
import { usePresetFull, usePresets } from "../../hooks/use-presets";
import { lorebookKeys, useLorebooks } from "../../hooks/use-lorebooks";
import { useAgentConfigs } from "../../hooks/use-agents";
import { useChatPresets } from "../../hooks/use-chat-presets";
import { useCharacter, usePersonas } from "../../hooks/use-characters";
import {
  deriveActiveLorebookViews,
  getChatActiveLorebookIds,
  getChatExcludedLorebookIds,
} from "../../lib/chat-lorebooks";
import { ChatSetupStageMemoryNote } from "./ChatSetupStageMemoryNote";
import {
  parseData,
  readCreatorNotes,
  StageAvatar,
  StageEditor,
  type StageAvatarProps,
  type StageEditorSection,
} from "./ChatSetupStageEditors";
import { ChatSetupStageScene } from "./ChatSetupStageScene";
import { isConnectionFlagTrue } from "../../lib/connection-filters";
import {
  backgroundLabel,
  presetChoiceSummary,
  shouldShowSetupStage,
  stageAccent,
  stageTagline,
  chatTurnTaken,
  focusChatComposer,
  setupStageClosedChats,
} from "../../lib/chat-setup-stage";
import { readCardWithQuestions } from "../../lib/onboarding-add-card";
import { cn } from "../../lib/utils";
import type { CharacterMap, MessageWithSwipes, PersonaInfo } from "./chat-area.types";

/** A card with character questions starts in the setup wizard, never on the stage (same rule as chat creation). */
function cardAsksQuestions(row: unknown): boolean {
  try {
    const data = (row as { data?: unknown }).data;
    return readCardWithQuestions(typeof data === "string" ? JSON.parse(data) : data) !== null;
  } catch {
    return false;
  }
}

/**
 * Whether a new roleplay or conversation chat shows its setup stage, and the Begin action that ends it.
 * Sending the first message ends it too, the same way.
 */
export function useChatSetupStage(input: {
  chat: Chat | null | undefined;
  chatMeta: Record<string, unknown>;
  messages: ReadonlyArray<{ role: string; chatId: string }> | undefined;
  characterNames: string[];
  /** The chat's messages are still being fetched; the stage never opens by itself meanwhile. */
  isLoading: boolean;
}) {
  const { chat, chatMeta, messages, characterNames, isLoading } = input;
  const stageChatId = useChatStore((s) => s.setupStageChatId);
  const updateMeta = useUpdateChatMetadata();
  const updateChat = useUpdateChat();
  const visible = shouldShowSetupStage({
    chatId: chat?.id,
    mode: chat?.mode,
    stageChatId,
    setupComplete: chatMeta.conversationSetupComplete,
    messages,
  });

  const complete = useCallback(
    (focusComposer: boolean) => {
      const store = useChatStore.getState();
      if (!chat || store.setupStageChatId !== chat.id) return;
      setupStageClosedChats.add(chat.id);
      const draft = store.pendingNewChatSetups[chat.id];
      store.setSetupStageChatId(null);
      store.clearPendingNewChatSetup(chat.id);
      if (focusComposer) focusChatComposer();
      // What the setup wizard wrote on finish: the cast name for an untouched draft name, and the setup flag.
      if (draft && chat.name === draft.name && characterNames.length) {
        updateChat.mutate({ id: chat.id, name: characterNames.join(", ") });
      }
      // Wizard parity: only conversation chats get the setup flag, with the defaults its finish wrote
      // for a chat that has no starred preset. Roleplay needs no flag, the stage id alone shows the stage.
      if (chat.mode === "conversation") {
        updateMeta.mutate({
          id: chat.id,
          conversationSetupComplete: true,
          autonomousMessages: chatMeta.autonomousMessages !== false,
          ...(chatMeta.characterCommands === undefined
            ? { characterCommands: typeof chatMeta.appliedChatPresetId === "string" }
            : {}),
          ...(chatMeta.conversationSchedulesEnabled === undefined ? { conversationSchedulesEnabled: false } : {}),
        });
      }
    },
    [chat, chatMeta, characterNames, updateChat, updateMeta],
  );

  // Any turn or generation ends setup, so the untouched-draft discard never deletes a chat with replies.
  const turnTaken = chatTurnTaken(messages, chat?.id, chat?.mode);
  const generating = useChatStore((s) => !!chat?.id && s.streamingChatId === chat.id);
  useEffect(() => {
    if ((turnTaken || generating) && stageChatId === chat?.id) complete(false);
  }, [turnTaken, generating, stageChatId, chat?.id, complete]);

  // A chat that has not started shows its stage when opened, not only right after creation. The
  // stage owns the chat from then on, so every `setupStageChatId === chat.id` rule stays shared.
  // Games, hosted rooms and cards whose questions open the wizard keep their own setup.
  const chatId = chat?.id;
  const mayAsk = chat?.mode === "roleplay" && !isLoading && messages !== undefined;
  const card = useCharacter(mayAsk ? (chat?.characterIds?.[0] ?? null) : null);
  const eligible =
    !isLoading &&
    messages !== undefined &&
    !!chatId &&
    !setupStageClosedChats.has(chatId) &&
    !chatMeta.multiplayer &&
    chatMeta.multiplayerSetup !== true &&
    !card.isLoading &&
    !(card.data && cardAsksQuestions(card.data)) &&
    shouldShowSetupStage({
      chatId,
      mode: chat?.mode,
      stageChatId: chatId,
      setupComplete: chatMeta.conversationSetupComplete,
      messages,
    });
  const decided = !isLoading && messages !== undefined && !card.isLoading;
  useEffect(() => {
    if (!chatId || !decided) return;
    const store = useChatStore.getState();
    if (eligible) {
      if (store.setupStageChatId !== chatId) store.setSetupStageChatId(chatId);
    } else if (store.setupStageChatId && store.setupStageChatId !== chatId) {
      store.setSetupStageChatId(null);
    }
  }, [chatId, decided, eligible]);

  return { visible, complete };
}

interface ChatSetupStageProps {
  variant: "roleplay" | "conversation";
  onBegin: () => void;
  chat: Chat;
  chatMeta: Record<string, unknown>;
  chatCharIds: string[];
  characterMap: CharacterMap;
  personaInfo?: PersonaInfo;
  messages: MessageWithSwipes[] | undefined;
  chatBackground: string | null;
  onSetActiveSwipe: (messageId: string, index: number) => void;
  /** Sprites already show the character; without them the stage shows a large avatar. */
  hasSprite?: boolean;
}

type ConnectionRow = {
  id: string;
  name?: string;
  model?: string;
  maxContext?: number;
  isDefault?: unknown;
  promptPresetId?: unknown;
};

const accentCache = new Map<string, string | null>();

/** The first character's avatar colour, read once per image; null keeps --primary. */
function useAvatarAccent(src: string | null | undefined) {
  const [read, setRead] = useState<{ src: string; color: string | null } | null>(null);
  useEffect(() => {
    if (!src || accentCache.has(src)) return;
    let live = true;
    void extractColorsFromImage(src)
      .then(
        ([color]) => stageAccent(color),
        () => null,
      )
      .then((color) => {
        accentCache.set(src, color);
        if (live) setRead({ src, color });
      });
    return () => {
      live = false;
    };
  }, [src]);
  if (!src) return null;
  return accentCache.get(src) ?? (read?.src === src ? read.color : null);
}

/** One quiet line when the first reply would fail or degrade, and the editor that fixes it. */
function useStageReadiness(
  narrator: ConnectionRow | null | undefined,
  chat: Chat | null | undefined,
  lorebookIds: string[],
) {
  const override = chat ? readChatModelOverride(chat) : null;
  const model = override?.model || narrator?.model;
  const maxContext = override?.maxContext || narrator?.maxContext || 0;
  const entries = useQueries({
    queries: (maxContext > 0 ? lorebookIds : []).map((id) => ({
      queryKey: lorebookKeys.entries(id),
      queryFn: () => api.get<LorebookEntry[]>(`/lorebooks/${id}/entries`),
    })),
  });
  // undefined: connections are still loading.
  if (narrator === undefined) return null;
  if (!narrator || !model) {
    return {
      text: "chat.setupStage.polish.noModel",
      fix: "chat.setupStage.polish.fixModel",
      section: "connection" as const,
      percent: 0,
    };
  }
  if (!maxContext) return null;
  // ponytail: counts always-on entries only; keyword entries depend on the chat, so they cannot be priced up front.
  const tokens = entries
    .flatMap((query) => query.data ?? [])
    .filter((entry) => entry.enabled && entry.constant)
    .reduce((sum, entry) => sum + estimateTextTokens(entry.content), 0);
  const percent = Math.round((tokens / maxContext) * 100);
  return percent > 50
    ? {
        text: "chat.setupStage.polish.lorebookHeavy",
        fix: "chat.setupStage.polish.fixLorebooks",
        section: "lorebooks" as const,
        percent,
      }
    : null;
}

export const SERIF = { fontFamily: 'ui-serif, Georgia, "Times New Roman", serif' };
export const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";

/** A tappable sentence word. Trans replaces its children with the word, so the avatars live here. */
function StageWord({
  avatars,
  children,
  ...button
}: { avatars?: StageAvatarProps[]; children?: ReactNode } & Omit<ComponentProps<"button">, "children">) {
  // When the value changes, the old text slides up and the new one rises in (globals.css).
  const label = button["aria-label"];
  const reducedMotion = useMatchMedia("(prefers-reduced-motion: reduce)");
  const [shown, setShown] = useState({ label, children });
  const [swap, setSwap] = useState<{ key: number; old: ReactNode } | null>(null);
  if (shown.label !== label) {
    setShown({ label, children });
    if (!reducedMotion) setSwap((current) => ({ key: (current?.key ?? 0) + 1, old: shown.children }));
  }
  return (
    <button type="button" {...button} className={cn(button.className, swap && "stage-word-swapping")}>
      {avatars?.length ? (
        <span aria-hidden="true" className="mr-[0.3em] inline-flex -space-x-[0.3em] align-[-0.14em]">
          {avatars.slice(0, 3).map((avatar, index) => (
            <StageAvatar key={index} {...avatar} className="h-[0.9em] w-[0.9em] text-[0.4em] not-italic" />
          ))}
        </span>
      ) : null}
      {swap ? (
        <span
          key={swap.key}
          className="stage-word-swap"
          onAnimationEnd={(event) => event.target === event.currentTarget && setSwap(null)}
        >
          <span aria-hidden="true" className="stage-word-old">
            {swap.old}
          </span>
          <span className="stage-word-new">{children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

/** The setup stage a new roleplay chat shows above its greeting: a sentence of fast controls plus All settings. */
export function ChatSetupStage({
  variant,
  onBegin,
  chat,
  chatMeta,
  chatCharIds,
  characterMap,
  personaInfo,
  messages,
  chatBackground,
  onSetActiveSwipe,
  hasSprite,
}: ChatSetupStageProps) {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const calm = variant === "conversation";
  const { data: connectionsData } = useConnections();
  const { data: presets } = usePresets();
  const { data: lorebooksData } = useLorebooks();
  const { data: agentConfigs } = useAgentConfigs();
  const { data: chatPresets } = useChatPresets(variant);
  const { data: personas } = usePersonas();

  const connections = (connectionsData ?? []) as ConnectionRow[];
  const chatConnection = connections.find((c) => c.id === chat.connectionId) ?? null;
  const mainConnection = connections.find((c) => isConnectionFlagTrue(c.isDefault)) ?? null;
  const followsMain = !chatConnection;
  const narrator = chatConnection ?? mainConnection;
  // A roleplay connection can carry its own prompt preset, which wins (same rule as the message variables).
  const presetId =
    (typeof narrator?.promptPresetId === "string" && narrator.promptPresetId) || chat.promptPresetId || null;
  const { data: presetFull } = usePresetFull(presetId);
  const presetName = presets?.find((p) => p.id === presetId)?.name ?? null;
  const styleSummary = useMemo(() => {
    let defaults: Record<string, unknown> = {};
    try {
      const raw = presetFull?.preset.defaultChoices;
      defaults = (typeof raw === "string" ? JSON.parse(raw) : raw) ?? {};
    } catch {
      /* legacy presets can carry malformed defaults */
    }
    const chosen = presetId === chat.promptPresetId ? (chatMeta.presetChoices as Record<string, unknown>) : null;
    return presetChoiceSummary(presetFull?.choiceBlocks ?? [], { ...defaults, ...(chosen ?? {}) });
  }, [presetFull, presetId, chat.promptPresetId, chatMeta.presetChoices]);

  const characters = chatCharIds.map((id) => ({ id, name: characterMap.get(id)?.name })).filter((c) => c.name);
  const listFormat = new Intl.ListFormat(i18n.language, { style: "long", type: "conjunction" });
  const castNames = characters.length ? listFormat.format(characters.map((c) => c.name!)) : null;
  const title = characters.length ? listFormat.format(characters.map((c) => c.name!)) : t("chat.setupStage.untitled");
  const tagline = characters.length === 1 ? stageTagline(characterMap.get(characters[0]!.id)?.description) : null;
  // Group chats show the first character's card.
  const { data: leadRow } = useCharacter(characters[0]?.id ?? null);
  const leadCard = parseData((leadRow as { data?: unknown } | undefined)?.data);
  const tags = (Array.isArray(leadCard?.tags) ? leadCard.tags : [])
    .filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
    .slice(0, 3)
    .map((tag) => tag.trim());
  const hasCreatorNotes = readCreatorNotes(leadCard).length > 0;
  const personaName = personaInfo?.name || null;
  const canPickPersona = (personas?.length ?? 0) >= 2;
  // With one persona the wizard never picked it, so an unset persona stays out of the sentence.
  const personaWord = personaName ?? (canPickPersona ? t("chat.setupStage.choosePersona") : null);

  const first = messages?.[0]?.role === "assistant" && messages[0].chatId === chat.id ? messages[0] : null;
  const greetingCount = Math.max(1, first?.swipeCount ?? first?.swipes?.length ?? 1);
  const greetingIndex = first?.activeSwipeIndex ?? 0;
  const greetingWord =
    greetingCount > 1
      ? t("chat.setupStage.greetingNumbered", { index: greetingIndex + 1, count: greetingCount })
      : t("chat.setupStage.greetingSingle");

  const lorebooks = useMemo(() => {
    const views = deriveActiveLorebookViews({
      activeLorebookIds: getChatActiveLorebookIds(chat),
      excludedLorebookIds: getChatExcludedLorebookIds(chat),
      chat,
      lorebooks: (lorebooksData ?? []) as Lorebook[],
      dropExcluded: true,
    });
    return views.filter((view) => view.activeReasons.some((reason) => reason !== "Global"));
  }, [chat, lorebooksData]);
  const linkedBook = lorebooks.find((book) => book.activeReasons.includes("Character"));
  const linkedCharacter = linkedBook
    ? characters.find((c) => c.id === linkedBook.characterId || linkedBook.characterIds?.includes(c.id))?.name
    : null;
  const lorebookText =
    lorebooks.length > 2
      ? t("chat.setupStage.lorebookCount", { count: lorebooks.length })
      : lorebooks.length
        ? listFormat.format(lorebooks.map((book) => book.name))
        : null;

  const helperNames = useMemo(() => {
    if (chatMeta.enableAgents !== true || !Array.isArray(chatMeta.activeAgentIds)) return [];
    return (chatMeta.activeAgentIds as unknown[])
      .filter((id): id is string => typeof id === "string")
      .map(
        (id) =>
          agentConfigs?.find((config) => config.type === id)?.name ??
          BUILT_IN_AGENTS.find((agent) => agent.id === id)?.name ??
          id,
      );
  }, [agentConfigs, chatMeta.activeAgentIds, chatMeta.enableAgents]);
  const helperText = helperNames.length ? listFormat.format(helperNames) : null;
  const look = backgroundLabel(chatBackground);
  const accent = useAvatarAccent(characters[0] ? characterMap.get(characters[0].id)?.avatarUrl : null);
  const readiness = useStageReadiness(
    connectionsData ? narrator : undefined,
    chat,
    lorebooks.map((book) => book.id),
  );
  const sectionRef = useRef<HTMLElement>(null);
  const [leaving, setLeaving] = useState(false);
  const reduced = useReducedAmbientEffects();
  const beginTimer = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(beginTimer.current), []);
  // Start: the title lifts away, the rest fades and the stage folds so the greeting slides up. The composer gets
  // focus at once; the stage closes when the curtain is down.
  const begin = () => {
    if (leaving) return;
    focusChatComposer(sectionRef.current);
    setEditor(null);
    setLeaving(true);
    const section = sectionRef.current;
    if (section && !reduced) {
      section.style.height = `${section.offsetHeight}px`;
      requestAnimationFrame(() => {
        section.style.height = "0px";
      });
    }
    beginTimer.current = window.setTimeout(onBegin, reduced ? 200 : 560);
  };
  const profile = chatPresets?.find((p) => p.id === chatMeta.appliedChatPresetId && !p.isDefault) ?? null;

  const [editor, setEditor] = useState<{ section: StageEditorSection; anchor: HTMLElement } | null>(null);
  const closeEditor = useCallback(() => setEditor(null), []);
  const open = (section: StageEditorSection) => (event: MouseEvent<HTMLElement>) => {
    const anchor = event.currentTarget;
    setEditor((current) => (current?.anchor === anchor ? null : { section, anchor }));
  };
  const openGreeting = open(first ? "opening" : "characters");

  const word = (onClick: (event: MouseEvent<HTMLElement>) => void, label: string, avatars?: StageAvatarProps[]) => (
    <StageWord
      avatars={avatars}
      onClick={onClick}
      aria-label={label}
      className={cn(
        "inline cursor-pointer bg-transparent p-0 text-left italic text-[var(--foreground)] underline decoration-[color-mix(in_srgb,var(--stage-accent,var(--primary))_75%,transparent)] decoration-[1.5px] underline-offset-[5px] hover:decoration-[var(--stage-accent,var(--primary))]",
        FOCUS,
        "rounded-sm",
      )}
    />
  );
  // No model yet: the sentence says so in amber, and the word opens the connection editor.
  const noModel = readiness?.section === "connection";
  const modelWord = (
    <StageWord
      onClick={open("connection")}
      aria-haspopup="dialog"
      aria-label={t("chat.setupStage.a11y.model")}
      className={cn(
        "inline cursor-pointer bg-transparent p-0 text-left italic text-amber-700 underline decoration-amber-500/70 decoration-[1.5px] underline-offset-[5px] hover:decoration-amber-500 dark:text-amber-300",
        FOCUS,
        "rounded-sm",
      )}
    />
  );
  const personaAvatars = personaName
    ? [{ src: personaInfo?.avatarUrl, crop: personaInfo?.avatarCrop, name: personaName }]
    : undefined;
  const castAvatars = characters.map((c) => {
    const known = characterMap.get(c.id);
    return { src: known?.avatarUrl, crop: known?.avatarCrop, name: c.name ?? "" };
  });
  const sentenceComponents: Record<string, ReactElement> = {
    persona: canPickPersona ? (
      word(open("persona"), t("chat.setupStage.a11y.persona", { value: personaWord }), personaAvatars)
    ) : (
      <span />
    ),
    cast: word(
      open("characters"),
      t("chat.setupStage.a11y.cast", { value: castNames ?? t("chat.setupStage.chooseCharacter") }),
      castAvatars,
    ),
    greeting: word(openGreeting, t("chat.setupStage.a11y.greeting", { value: greetingWord })),
    preset: word(
      open("prompt-preset"),
      t("chat.setupStage.a11y.preset", { value: presetName ?? t("chat.setupStage.defaultPreset") }),
    ),
  };

  const lineItems: Array<{ key: string; icon: ReactNode; text: string | null; section: StageEditorSection }> = [
    { key: "model", icon: <Cpu />, text: narrator?.name ?? null, section: "connection" },
    { key: "world", icon: <BookOpen />, text: lorebookText, section: "lorebooks" },
    { key: "helpers", icon: <Sparkles />, text: helperText, section: "agents" },
    { key: "look", icon: <ImageIcon />, text: look, section: "background" },
    { key: "profile", icon: <Bookmark />, text: profile?.name ?? null, section: "profile" },
  ];

  const none = t("chat.setupStage.none");
  const allRows: Array<{
    key: string;
    icon: ReactNode;
    label: string;
    value: string;
    onClick: (event: MouseEvent<HTMLElement>) => void;
  }> = [
    {
      key: "cast",
      icon: <Users />,
      label: t("chat.setupStage.row.cast"),
      value: castNames
        ? personaName
          ? t("chat.setupStage.row.castWithPersona", { cast: castNames, persona: personaName })
          : castNames
        : t("chat.setupStage.chooseCharacterRow"),
      onClick: open("characters"),
    },
    {
      key: "opening",
      icon: <MessageSquare />,
      label: t("chat.setupStage.row.opening"),
      value: !first
        ? t("chat.setupStage.row.noGreeting")
        : greetingCount > 1
          ? t("chat.setupStage.row.openingValue", { index: greetingIndex + 1, count: greetingCount })
          : t("chat.setupStage.row.openingSingle"),
      onClick: openGreeting,
    },
    {
      key: "style",
      icon: <Feather />,
      label:
        styleSummary && presetName
          ? t("chat.setupStage.row.styleFrom", { preset: presetName })
          : t("chat.setupStage.row.style"),
      value:
        calm && typeof chatMeta.customSystemPrompt === "string" && chatMeta.customSystemPrompt.trim()
          ? t("chat.setupStage.row.customPrompt")
          : (styleSummary ?? presetName ?? t("chat.setupStage.row.defaultPreset")),
      onClick: open("prompt-preset"),
    },
    {
      key: "world",
      icon: <BookOpen />,
      label: linkedCharacter
        ? t("chat.setupStage.row.worldLinked", { character: linkedCharacter })
        : t("chat.setupStage.row.world"),
      value: lorebookText ?? none,
      onClick: open("lorebooks"),
    },
    {
      key: "narrator",
      icon: <Cpu />,
      label: followsMain ? t("chat.setupStage.row.narratorMain") : t("chat.setupStage.row.narrator"),
      value: narrator?.name ?? none,
      onClick: open("connection"),
    },
    {
      key: "helpers",
      icon: <Sparkles />,
      label: t("chat.setupStage.row.helpers"),
      value: helperText ?? none,
      onClick: open("agents"),
    },
    {
      key: "look",
      icon: <ImageIcon />,
      label: t("chat.setupStage.row.look"),
      value: look ?? t("chat.setupStage.row.defaultLook"),
      onClick: open("background"),
    },
    {
      key: "profile",
      icon: <Bookmark />,
      label: profile?.isActive ? t("chat.setupStage.row.profileFavourite") : t("chat.setupStage.row.profile"),
      value: profile?.name ?? none,
      onClick: open("profile"),
    },
  ];

  const rows = allRows.filter((row) => !(calm && row.key === "look" && !look));

  const beginButton = (
    <button
      type="button"
      onClick={begin}
      className={cn(
        "inline-flex h-[46px] min-w-11 items-center gap-2 rounded-full bg-[var(--primary)] px-[26px] text-[15px] font-semibold text-[var(--primary-foreground)] shadow-[0_10px_30px_color-mix(in_srgb,var(--primary)_40%,transparent)] transition-[filter] duration-150 hover:brightness-110",
        FOCUS,
        "focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
      )}
    >
      <Play size="0.875rem" aria-hidden />
      {t("chat.setupStage.start")}
    </button>
  );
  // The first message ends the stage too; on phones the row has no room for it.
  const typingHint = (
    <span className="font-serif text-[13.5px] italic text-[color-mix(in_srgb,var(--foreground)_55%,transparent)] max-sm:hidden">
      {t("chat.setupStage.typingHint")}
    </span>
  );
  const toggleButton = (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      aria-expanded={expanded}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm text-[color-mix(in_srgb,var(--foreground)_85%,transparent)] hover:text-[var(--foreground)]",
        FOCUS,
      )}
    >
      {expanded ? <ChevronUp size="0.9rem" aria-hidden /> : <ChevronDown size="0.9rem" aria-hidden />}
      {expanded ? t("chat.setupStage.less") : t("chat.setupStage.allSettings")}
    </button>
  );

  return (
    <section
      data-component="ChatSetupStage"
      ref={sectionRef}
      data-leaving={leaving || undefined}
      style={
        accent
          ? ({ "--stage-accent": `color-mix(in oklab, ${accent} 72%, var(--foreground))` } as CSSProperties)
          : undefined
      }
      aria-label={t("chat.setupStage.a11y.region")}
      className={cn(
        "mari-setup-stage relative z-[2] mx-auto mb-2 w-full max-w-[600px]",
        calm
          ? "px-4 pt-6 md:pt-10"
          : "px-2 pt-[clamp(1rem,22vh,9rem)] md:mx-0 md:px-0 md:ml-[max(0px,calc(50%-20rem))] md:pt-16",
      )}
    >
      {/* Scrim: keeps the text readable over the roleplay background and sprites. */}
      {!calm && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-[50vw] -bottom-6 -top-[20vh] -z-10 [mask-image:linear-gradient(to_bottom,#000_75%,transparent)] bg-[linear-gradient(180deg,transparent_0%,color-mix(in_srgb,var(--background)_55%,transparent)_30%,color-mix(in_srgb,var(--background)_70%,transparent)_100%)] md:right-auto md:w-[min(100vw,1100px)] md:bg-[linear-gradient(90deg,color-mix(in_srgb,var(--background)_82%,transparent)_0%,color-mix(in_srgb,var(--background)_58%,transparent)_55%,transparent_100%)]"
        />
      )}
      {!hasSprite && castAvatars.length > 0 ? (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={open("characters")}
          className="mb-4 flex cursor-pointer -space-x-4 bg-transparent p-0 md:mb-5"
        >
          {castAvatars.slice(0, 3).map((avatar, index) => (
            <StageAvatar
              key={index}
              {...avatar}
              className="h-16 w-16 border-2 border-[color-mix(in_srgb,var(--stage-accent,var(--primary))_55%,transparent)] text-2xl shadow-[0_8px_30px_rgba(0,0,0,.35)] md:h-[76px] md:w-[76px]"
            />
          ))}
        </button>
      ) : null}
      {(tags.length > 0 || hasCreatorNotes) && (
        <p className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] text-[color-mix(in_srgb,var(--foreground)_58%,transparent)] md:text-xs">
          {tags.length > 0 && (
            <span className="font-semibold uppercase tracking-[0.18em]">
              {[t(`chat.setupStage.tags.${variant}`), ...tags].join(" · ")}
            </span>
          )}
          {hasCreatorNotes && (
            <button
              type="button"
              onClick={open("creator-notes")}
              aria-haspopup="dialog"
              className={cn(
                "-my-2 inline-flex min-h-11 cursor-pointer items-center bg-transparent p-0 italic underline decoration-[color-mix(in_srgb,var(--foreground)_30%,transparent)] underline-offset-4 hover:text-[var(--foreground)] md:my-0 md:min-h-0",
                FOCUS,
                "rounded-sm",
              )}
            >
              {t("chat.setupStage.creatorNotes")}
            </button>
          )}
        </p>
      )}
      <h1
        style={SERIF}
        className={cn(
          "m-0 font-normal tracking-[-0.02em] text-[var(--foreground)]",
          calm
            ? "text-[32px] md:text-[40px]"
            : "text-[42px] [text-shadow:0_2px_30px_rgba(0,0,0,.45),0_0_46px_color-mix(in_srgb,var(--stage-accent,var(--primary))_26%,transparent)] md:text-[66px]",
          // Last, so the size classes above do not drop it in tailwind-merge.
          "leading-[1.02]",
        )}
      >
        <button
          type="button"
          onClick={open("characters")}
          aria-haspopup="dialog"
          className={cn("cursor-pointer bg-transparent p-0 text-left", FOCUS, "rounded-md")}
        >
          {title}
        </button>
      </h1>
      {tagline && (
        <p className="mt-3 text-sm text-[color-mix(in_srgb,var(--foreground)_72%,transparent)] md:text-[15px]">
          {tagline}
        </p>
      )}
      <p
        style={SERIF}
        className="mt-5 text-[22px] leading-[1.42] text-[color-mix(in_srgb,var(--foreground)_66%,transparent)] [text-wrap:pretty] md:mt-7 md:text-[27px]"
      >
        <Trans
          t={t}
          i18nKey={personaWord ? "chat.setupStage.sentenceWho" : "chat.setupStage.sentenceWhoNoPersona"}
          values={{ persona: personaWord, cast: castNames ?? t("chat.setupStage.chooseCharacter") }}
          components={sentenceComponents}
        />{" "}
        {first ? (
          <Trans
            t={t}
            i18nKey="chat.setupStage.sentenceBegins"
            values={{ greeting: greetingWord, preset: presetName ?? t("chat.setupStage.defaultPreset") }}
            components={sentenceComponents}
          />
        ) : (
          <Trans
            t={t}
            i18nKey="chat.setupStage.sentenceUses"
            values={{ preset: presetName ?? t("chat.setupStage.defaultPreset") }}
            components={sentenceComponents}
          />
        )}
        {noModel && (
          <>
            {" "}
            <Trans
              t={t}
              i18nKey={castNames ? "chat.setupStage.sentenceModel" : "chat.setupStage.sentenceModelNoCast"}
              count={characters.length}
              values={{ cast: castNames }}
              components={{ model: modelWord }}
            />
          </>
        )}
      </p>

      <ChatSetupStageMemoryNote chatId={chat.id} />

      {!calm && !chatMeta.multiplayer && chatMeta.multiplayerSetup !== true && (
        <ChatSetupStageScene chat={chat} first={first} onSetActiveSwipe={onSetActiveSwipe} />
      )}
      {expanded ? (
        <div
          className={cn(
            "mt-6 rounded-[22px] border p-2 md:mt-[26px]",
            calm
              ? "border-[var(--border)] bg-[var(--card)]"
              : "border-[color-mix(in_srgb,var(--foreground)_11%,transparent)] bg-[color-mix(in_srgb,var(--background)_66%,transparent)] shadow-[0_20px_50px_rgba(0,0,0,.35)] backdrop-blur-[20px] backdrop-saturate-[1.25]",
          )}
        >
          <div className="grid grid-cols-1 gap-0.5 md:grid-cols-2">
            {rows.map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={row.onClick}
                className={cn(
                  "flex min-h-14 min-w-0 items-center gap-3 rounded-[14px] px-2.5 py-[9px] text-left hover:bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)]",
                  FOCUS,
                )}
              >
                <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[11px] bg-[color-mix(in_srgb,var(--stage-accent,var(--primary))_15%,transparent)] text-[var(--stage-accent,var(--primary))] [&>svg]:h-[17px] [&>svg]:w-[17px]">
                  {row.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <small className="block truncate text-xs leading-[1.3] text-[var(--muted-foreground)]">
                    {row.label}
                  </small>
                  <b className="block truncate text-[14.5px] font-medium leading-[1.35] text-[var(--foreground)]">
                    {row.value}
                  </b>
                </span>
                <ChevronRight size="1rem" aria-hidden className="flex-none text-[var(--muted-foreground)] opacity-55" />
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-[18px] border-t border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] px-1.5 pb-1.5 pt-3">
            {beginButton}
            {typingHint}
            {toggleButton}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-[18px] flex flex-wrap gap-x-4 text-[13.5px] text-[color-mix(in_srgb,var(--foreground)_82%,transparent)] md:mt-[22px] md:gap-x-[22px] md:gap-y-1 md:text-sm">
            {lineItems
              .filter((item) => item.text)
              .map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={open(item.section)}
                  className={cn(
                    "inline-flex min-h-11 max-w-full items-center gap-[7px] rounded-md hover:text-[var(--foreground)] md:min-h-8 [&>svg]:h-[15px] [&>svg]:w-[15px] [&>svg]:flex-none [&>svg]:text-[var(--stage-accent,var(--primary))] [&>svg]:opacity-90",
                    FOCUS,
                  )}
                >
                  {item.icon}
                  <span className="truncate">{item.text}</span>
                </button>
              ))}
          </div>
          <div className="mt-[18px] flex items-center gap-[18px] md:mt-[22px]">
            {beginButton}
            {typingHint}
            {toggleButton}
          </div>
        </>
      )}

      {readiness && !noModel && (
        <p className="mt-6 flex flex-wrap items-center gap-x-2 text-[12.5px] text-[color-mix(in_srgb,var(--foreground)_62%,transparent)]">
          <CircleAlert size="0.85rem" aria-hidden="true" className="flex-none" />
          <span>{t(readiness.text, { percent: readiness.percent })}</span>
          <button
            type="button"
            onClick={open(readiness.section)}
            aria-haspopup="dialog"
            className={cn(
              "-my-2 inline-flex min-h-11 cursor-pointer items-center bg-transparent p-0 font-semibold text-[var(--foreground)] underline decoration-[color-mix(in_srgb,var(--stage-accent,var(--primary))_60%,transparent)] underline-offset-4 md:my-0 md:min-h-0",
              FOCUS,
              "rounded-sm",
            )}
          >
            {t(readiness.fix)}
          </button>
        </p>
      )}
      {first && (
        <p className="mb-0 mt-8 flex items-center gap-2 text-[12.5px] text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]">
          <button
            type="button"
            onClick={open("opening")}
            aria-haspopup="dialog"
            className={cn(
              "-my-2 inline-flex min-h-11 cursor-pointer items-center gap-2 bg-transparent p-0 hover:text-[var(--foreground)] md:my-0 md:min-h-0",
              FOCUS,
              "rounded-sm",
            )}
          >
            <MessageSquare size="0.8rem" aria-hidden className="text-[var(--stage-accent,var(--primary))]" />
            {t("chat.setupStage.firstMessage")}
          </button>
        </p>
      )}
      {editor && chat && (
        <StageEditor
          section={editor.section}
          anchor={editor.anchor}
          onClose={closeEditor}
          ctx={{ variant, chat, chatMeta, chatCharIds, characterMap, personaInfo, first, onSetActiveSwipe }}
        />
      )}
    </section>
  );
}
