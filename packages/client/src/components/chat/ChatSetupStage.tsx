import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactElement, type ReactNode } from "react";
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
} from "lucide-react";
import { BUILT_IN_AGENTS, type Chat, type Lorebook } from "@marinara-engine/shared";
import { useChatStore } from "../../stores/chat.store";
import { useUpdateChat, useUpdateChatMetadata } from "../../hooks/use-chats";
import { useConnections } from "../../hooks/use-connections";
import { usePresetFull, usePresets } from "../../hooks/use-presets";
import { useLorebooks } from "../../hooks/use-lorebooks";
import { useAgentConfigs } from "../../hooks/use-agents";
import { useChatPresets } from "../../hooks/use-chat-presets";
import { usePersonas } from "../../hooks/use-characters";
import {
  deriveActiveLorebookViews,
  getChatActiveLorebookIds,
  getChatExcludedLorebookIds,
} from "../../lib/chat-lorebooks";
import { StageEditor, type StageEditorSection } from "./ChatSetupStageEditors";
import { isConnectionFlagTrue } from "../../lib/connection-filters";
import {
  backgroundLabel,
  presetChoiceSummary,
  shouldShowSetupStage,
  stageTagline,
  chatTurnTaken,
} from "../../lib/chat-setup-stage";
import { cn } from "../../lib/utils";
import type { CharacterMap, MessageWithSwipes, PersonaInfo } from "./chat-area.types";

/**
 * Whether a new roleplay or conversation chat shows its setup stage, and the Begin action that ends it.
 * Sending the first message ends it too, the same way.
 */
export function useChatSetupStage(input: {
  chat: Chat | null | undefined;
  chatMeta: Record<string, unknown>;
  messages: ReadonlyArray<{ role: string; chatId: string }> | undefined;
  characterNames: string[];
}) {
  const { chat, chatMeta, messages, characterNames } = input;
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
      const draft = store.pendingNewChatSetups[chat.id];
      store.setSetupStageChatId(null);
      store.clearPendingNewChatSetup(chat.id);
      if (focusComposer) document.querySelector<HTMLTextAreaElement>(".mari-chat-input-textarea")?.focus();
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
}

type ConnectionRow = { id: string; name?: string; model?: string; isDefault?: unknown; promptPresetId?: unknown };

const SERIF = { fontFamily: 'ui-serif, Georgia, "Times New Roman", serif' };
const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";

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
  const personaName = personaInfo?.name || null;
  const canPickPersona = (personas?.length ?? 0) >= 2;

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
  const profile = chatPresets?.find((p) => p.id === chatMeta.appliedChatPresetId && !p.isDefault) ?? null;

  const [editor, setEditor] = useState<{ section: StageEditorSection; anchor: HTMLElement } | null>(null);
  const closeEditor = useCallback(() => setEditor(null), []);
  const open = (section: StageEditorSection) => (event: MouseEvent<HTMLElement>) => {
    const anchor = event.currentTarget;
    setEditor((current) => (current?.anchor === anchor ? null : { section, anchor }));
  };
  const openGreeting = open(first ? "opening" : "characters");

  const word = (onClick: (event: MouseEvent<HTMLElement>) => void, label: string) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "inline cursor-pointer bg-transparent p-0 italic text-[var(--foreground)] underline decoration-[color-mix(in_srgb,var(--primary)_75%,transparent)] decoration-[1.5px] underline-offset-[5px] hover:decoration-[var(--primary)]",
        FOCUS,
        "rounded-sm",
      )}
    />
  );
  const sentenceComponents: Record<string, ReactElement> = {
    persona: canPickPersona ? (
      word(open("persona"), t("chat.setupStage.a11y.persona", { value: personaName }))
    ) : (
      <span />
    ),
    cast: word(
      open("characters"),
      t("chat.setupStage.a11y.cast", { value: castNames ?? t("chat.setupStage.chooseCharacter") }),
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
      onClick={onBegin}
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
      aria-label={t("chat.setupStage.a11y.region")}
      className={cn(
        "relative z-[2] mx-auto mb-2 w-full max-w-[600px]",
        calm
          ? "px-4 pt-6 md:pt-10"
          : "px-2 pt-[clamp(1rem,22vh,9rem)] md:mx-0 md:px-0 md:ml-[max(0px,calc(50%-20rem))] md:pt-16",
      )}
    >
      {/* Scrim: keeps the text readable over the roleplay background and sprites. */}
      {!calm && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-[50vw] -bottom-6 -top-[20vh] -z-10 bg-[linear-gradient(180deg,transparent_0%,color-mix(in_srgb,var(--background)_55%,transparent)_30%,color-mix(in_srgb,var(--background)_70%,transparent)_100%)] md:right-auto md:w-[min(100vw,1100px)] md:bg-[linear-gradient(90deg,color-mix(in_srgb,var(--background)_82%,transparent)_0%,color-mix(in_srgb,var(--background)_58%,transparent)_55%,transparent_100%)]"
        />
      )}
      <h1
        style={SERIF}
        className={cn(
          "m-0 font-normal tracking-[-0.02em] text-[var(--foreground)]",
          calm ? "text-[32px] md:text-[40px]" : "text-[42px] [text-shadow:0_2px_30px_rgba(0,0,0,.45)] md:text-[66px]",
          // Last, so the size classes above do not drop it in tailwind-merge.
          "leading-[1.02]",
        )}
      >
        {title}
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
          i18nKey={personaName ? "chat.setupStage.sentenceWho" : "chat.setupStage.sentenceWhoNoPersona"}
          values={{ persona: personaName, cast: castNames ?? t("chat.setupStage.chooseCharacter") }}
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
      </p>

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
                <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[11px] bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-[var(--primary)] [&>svg]:h-[17px] [&>svg]:w-[17px]">
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
                    "inline-flex min-h-11 max-w-full items-center gap-[7px] rounded-md hover:text-[var(--foreground)] md:min-h-8 [&>svg]:h-[15px] [&>svg]:w-[15px] [&>svg]:flex-none [&>svg]:text-[var(--primary)] [&>svg]:opacity-90",
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
            {toggleButton}
          </div>
        </>
      )}

      {first && (
        <p className="mb-0 mt-8 flex items-center gap-2 text-[12.5px] text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]">
          <MessageSquare size="0.8rem" aria-hidden className="text-[var(--primary)]" />
          {t("chat.setupStage.firstMessage")}
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
