// ──────────────────────────────────────────────
// Chat: Conversation Input — Discord-style
// ──────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect, useMemo, type FormEvent } from "react";
import {
  Send,
  Smile,
  StopCircle,
  X,
  Paperclip,
  Keyboard,
  AtSign,
  Languages,
  Loader2,
  FileText,
  RefreshCw,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useChatStore } from "../../stores/chat.store";
import { useAgentStore } from "../../stores/agent.store";
import { useUIStore } from "../../stores/ui.store";
import { useConversationGamesStore } from "../../stores/conversation-games.store";
import { useGenerate } from "../../hooks/use-generate";
import { useApplyRegex } from "../../hooks/use-apply-regex";
import { useCreateMessage, useDeleteMessage, useUpdateMessageExtra, useChat, chatKeys } from "../../hooks/use-chats";
import { characterKeys } from "../../hooks/use-characters";
import {
  matchSlashCommand,
  shouldExecuteQuickPostAsCommand,
  getSlashCompletions,
  type ConversationGameSlashContribution,
  type SlashCommand,
  type SlashCommandContext,
} from "../../lib/slash-commands";
import { createInputMacroResolverForChat, isPromptPreviewMacro } from "../../lib/chat-macros";
import { parseChatMetadata } from "../../lib/chat-display";
import { cn, type AvatarCropValue } from "../../lib/utils";
import { applyTextareaQuoteFormat } from "../../lib/textarea-quotes";
import { translateDraftText } from "../../lib/draft-translation";
import { prepareImageAttachment } from "../../lib/chat-attachment-images";
import { CARD_ASSET_INSERT_EVENT, type CardAssetInsertDetail } from "../../lib/card-asset-links";
import { requestChatScrollToBottom } from "../../lib/chat-scroll-events";
import { searchStandardEmojiShortcodes, type StandardEmojiShortcode } from "../../lib/emoji-shortcodes";
import { QuickConnectionSwitcher } from "./QuickConnectionSwitcher";
import { QuickPersonaSwitcher } from "./QuickPersonaSwitcher";
import { QuickSwitcherMobile } from "./QuickSwitcherMobile";
import { showChoiceDialog } from "../../lib/app-dialogs";
import { useConversationCustomEmojis, type ConversationCustomEmoji } from "../../hooks/use-conversation-custom-emojis";
import { SpeechToTextButton } from "../ui/SpeechToTextButton";
import { SlashCommandFeedback } from "./SlashCommandFeedback";
import { QuickReplyMenu, type QuickReplyAction } from "./QuickReplyMenu";
import { getChatInputShellClass } from "./chat-input-styles";
import { MariSuggestionChips } from "./MariSuggestionChips";
import {
  ConversationMediaPickerPanel,
  type ConversationMediaPickerTab,
  type ConversationMediaPickerTabId,
} from "./ConversationMediaPickerPanel";
import { useInstalledCapabilityPackages } from "../../hooks/use-capability-packages";
import {
  formatTextQuotes,
  includesTextForMatch,
  MARI_STARTER_CHIPS,
  normalizeTextForMatch,
  PROFESSOR_MARI_ID,
  startsWithTextForMatch,
  type MariSuggestionChip,
  type Message,
  isInstalledCapabilityReady,
} from "@marinara-engine/shared";

interface Attachment {
  type: string;
  data: string;
  name: string;
}

type EmojiCompletion =
  | ({ kind: "custom" } & ConversationCustomEmoji)
  | ({ kind: "standard"; source: "Standard" } & StandardEmojiShortcode);

const TEXT_ATTACHMENT_EXTENSIONS = new Set([
  "csv",
  "json",
  "jsonl",
  "log",
  "markdown",
  "md",
  "txt",
  "xml",
  "yaml",
  "yml",
]);
const PDF_ATTACHMENT_MIME_TYPE = "application/pdf";

const CONVERSATION_HIDDEN_SLASH_COMMANDS = new Set(["impersonate", "impersonate_prompt"]);
const QUOTE_INPUT_TRIGGER_RE = /["'\u2018\u2019\u201a\u201b\u201c\u201d\u201e\u201f]/;

type MobilePickerTab = ConversationMediaPickerTabId;

type ConversationSlashCompletion = {
  key: string;
  label: string;
  description?: string;
  insertValue: string;
  cursor: number;
  kind: "command" | "status" | "character";
};

const CONVERSATION_STATUS_COMPLETIONS = [
  { value: "online", description: "Set a character to online" },
  { value: "idle", description: "Set a character to away" },
  { value: "dnd", description: "Set a character to busy" },
  { value: "offline", description: "Set a character to offline" },
  { value: "clear", description: "Clear a manual status override" },
] as const;

function isConversationHiddenSlashCommand(command: SlashCommand): boolean {
  return CONVERSATION_HIDDEN_SLASH_COMMANDS.has(command.name);
}

function shouldFormatQuoteInput(event: FormEvent<HTMLTextAreaElement> | undefined, value: string): boolean {
  const inputEvent = event?.nativeEvent as InputEvent | undefined;
  const inputType = typeof inputEvent?.inputType === "string" ? inputEvent.inputType : "";
  if (inputType.startsWith("delete")) return false;
  return QUOTE_INPUT_TRIGGER_RE.test(value);
}

function quoteSlashArgument(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!/[\s"\\]/u.test(trimmed)) return trimmed;
  return `"${trimmed.replace(/["\\]/g, "\\$&")}"`;
}

function buildSlashCommandPrefill(
  command: SlashCommand,
  characters?: Array<{ id: string; name: string }>,
): { value: string; cursor: number } {
  if (command.name === "status") {
    const firstCharacter = characters?.[0]?.name;
    const value = firstCharacter ? `/status online ${quoteSlashArgument(firstCharacter)}` : "/status online ";
    const cursor = value.length;
    return { value, cursor };
  }

  const value = `/${command.name} `;
  return { value, cursor: value.length };
}

function stripLeadingQuote(value: string): string {
  if (value.startsWith('"') || value.startsWith("'") || value.startsWith("\u201c") || value.startsWith("\u2018")) {
    return value.slice(1);
  }
  return value;
}

function buildConversationSlashCompletions(
  input: string,
  characters: Array<{ id: string; name: string }> | undefined,
  availableCapabilityIds: ReadonlySet<string>,
  conversationGames: readonly ConversationGameSlashContribution[],
): ConversationSlashCompletion[] {
  if (!input.startsWith("/")) return [];

  const lowerInput = normalizeTextForMatch(input);
  if (lowerInput.startsWith("/status")) {
    const rest = input.slice("/status".length);
    if (rest.length === 0 || /^\s+$/.test(rest)) {
      return CONVERSATION_STATUS_COMPLETIONS.map((status) => ({
        key: `status:${status.value}`,
        label: status.value,
        description: status.description,
        insertValue: `/status ${status.value} `,
        cursor: `/status ${status.value} `.length,
        kind: "status",
      }));
    }

    if (!/^\s/.test(rest)) return [];

    const trimmedRest = rest.trimStart();
    const firstSpace = trimmedRest.indexOf(" ");
    const action = normalizeTextForMatch(firstSpace === -1 ? trimmedRest : trimmedRest.slice(0, firstSpace));

    if (firstSpace === -1) {
      return CONVERSATION_STATUS_COMPLETIONS.filter((status) => status.value.startsWith(action)).map((status) => ({
        key: `status:${status.value}`,
        label: status.value,
        description: status.description,
        insertValue: `/status ${status.value} `,
        cursor: `/status ${status.value} `.length,
        kind: "status",
      }));
    }

    if (!CONVERSATION_STATUS_COMPLETIONS.some((status) => status.value === action)) return [];

    const rawNameQuery = trimmedRest.slice(firstSpace + 1);
    const nameQuery = normalizeTextForMatch(stripLeadingQuote(rawNameQuery));
    return (characters ?? [])
      .filter((character) => {
        if (!nameQuery) return true;
        return startsWithTextForMatch(character.name, nameQuery) || includesTextForMatch(character.name, nameQuery);
      })
      .map((character) => {
        const insertValue = `/status ${action} ${quoteSlashArgument(character.name)}`;
        return {
          key: `character:${action}:${character.id}`,
          label: character.name,
          description: `Set ${character.name} to ${action}`,
          insertValue,
          cursor: insertValue.length,
          kind: "character" as const,
        };
      });
  }

  return getSlashCompletions(input, { mode: "conversation", availableCapabilityIds, conversationGames })
    .filter((command) => !isConversationHiddenSlashCommand(command))
    .map((command) => {
      const { value, cursor } = buildSlashCommandPrefill(command, characters);
      return {
        key: `command:${command.name}`,
        label: `/${command.name}`,
        description:
          command.name === "status"
            ? `${command.description}. Use online, idle, dnd, offline, or clear, then a character name.`
            : command.description,
        insertValue: value,
        cursor,
        kind: "command" as const,
      };
    });
}

function getFileExtension(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function inferAttachmentType(file: File): string {
  const extension = getFileExtension(file.name);
  if (extension === "pdf") return PDF_ATTACHMENT_MIME_TYPE;
  if (file.type) return file.type;
  if (extension === "json" || extension === "jsonl") return "application/json";
  if (extension === "csv") return "text/csv";
  if (extension === "md" || extension === "markdown") return "text/markdown";
  if (extension === "xml") return "application/xml";
  if (extension === "yaml" || extension === "yml") return "application/yaml";
  if (extension === "txt" || extension === "log") return "text/plain";
  return "application/octet-stream";
}

function isSupportedChatAttachment(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  if (file.type.startsWith("text/")) return true;
  const type = inferAttachmentType(file);
  if (type === PDF_ATTACHMENT_MIME_TYPE) return true;
  if (
    type === "application/json" ||
    type === "application/xml" ||
    type === "application/yaml" ||
    type === "application/x-yaml"
  ) {
    return true;
  }
  return TEXT_ATTACHMENT_EXTENSIONS.has(getFileExtension(file.name));
}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function useIsMobileComposerViewport() {
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(max-width: 767px)").matches,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobileViewport(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isMobileViewport;
}

interface ConversationInputProps {
  mobileHistoryCollapsed?: boolean;
  onMobileHistoryCollapsedChange?: (collapsed: boolean) => void;
  characterNames?: string[];
  chatCharacters?: Array<{
    id: string;
    name: string;
    avatarUrl: string | null;
    avatarCrop?: AvatarCropValue | null;
    conversationStatus?: "online" | "idle" | "dnd" | "offline";
    conversationActivity?: string;
  }>;
  onPeekPrompt?: () => void;
  onIllustrate?: () => void | Promise<void>;
  onGenerateSelfie?: (characterId?: string) => void | Promise<void>;
}

export function ConversationInput({
  mobileHistoryCollapsed = false,
  onMobileHistoryCollapsedChange,
  characterNames = [],
  chatCharacters,
  onPeekPrompt,
  onIllustrate,
  onGenerateSelfie,
}: ConversationInputProps) {
  const [hasInput, setHasInput] = useState(false);
  const [completions, setCompletions] = useState<ConversationSlashCompletion[]>([]);
  const [selectedCompletion, setSelectedCompletion] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingAttachmentReadsByChat, setPendingAttachmentReadsByChat] = useState<Record<string, number>>({});
  const [isTranslatingDraft, setIsTranslatingDraft] = useState(false);
  const [mobilePickerOpen, setMobilePickerOpen] = useState(false);
  const [mobilePickerTab, setMobilePickerTab] = useState<MobilePickerTab>("emoji");
  const isMobileComposerViewport = useIsMobileComposerViewport();
  const [isDragging, setIsDragging] = useState(false);
  // @mention autocomplete
  const [_mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionCompletions, setMentionCompletions] = useState<string[]>([]);
  const [selectedMention, setSelectedMention] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState(0);
  // :emoji: autocomplete
  const [emojiCompletions, setEmojiCompletions] = useState<EmojiCompletion[]>([]);
  const [selectedEmojiCompletion, setSelectedEmojiCompletion] = useState(0);
  const [emojiStartPos, setEmojiStartPos] = useState(0);
  const { list: customEmojiList } = useConversationCustomEmojis();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputBarRef = useRef<HTMLDivElement>(null);
  const focusAfterMobileRestoreRef = useRef(false);
  const attachmentsRef = useRef<Attachment[]>([]);
  const pendingAttachmentDraftsRef = useRef<Map<string, Attachment[]>>(new Map());
  const currentInputFrameRef = useRef<number | null>(null);
  const pendingCurrentInputRef = useRef("");
  const activeChatId = useChatStore((s) => s.activeChatId);
  const mariChips = useAgentStore((s) => s.mariChips);
  const mariChipsChatId = useAgentStore((s) => s.mariChipsChatId);
  const clearMariChips = useAgentStore((s) => s.clearMariChips);
  const professorMariSuggestionsEnabled = useUIStore((s) => s.professorMariSuggestionsEnabled);
  const { data: activeChat } = useChat(activeChatId);
  const { data: installedCapabilities = [] } = useInstalledCapabilityPackages();
  const availableCapabilityIds = useMemo(
    () => new Set(installedCapabilities.filter((item) => item.status === "active").map((item) => item.id)),
    [installedCapabilities],
  );
  const availableConversationGames = useMemo(
    () => installedCapabilities.filter(
      (item) =>
        isInstalledCapabilityReady(item) &&
        item.manifest.kind.includes("turn-game") &&
        item.manifest.entrypoints.client &&
        item.manifest.contributions?.conversationGame,
    ),
    [installedCapabilities],
  );
  const conversationGameSlashContributions = useMemo<ConversationGameSlashContribution[]>(
    () => availableConversationGames.map((game) => ({
      packageId: game.id,
      packageName: game.manifest.name,
      command: game.manifest.contributions!.conversationGame!.command,
      aliases: game.manifest.contributions!.conversationGame!.aliases,
    })),
    [availableConversationGames],
  );
  const chatName = activeChat?.name;
  const streamingChatId = useChatStore((s) => s.streamingChatId);
  const isStreamingGlobal = useChatStore((s) => s.isStreaming);
  const isStreaming = isStreamingGlobal && streamingChatId === activeChatId;
  const delayedCharacterInfo = useChatStore((s) => s.delayedCharacterInfo);
  // Show stop button only during actual generation, not during busy delay
  const isActuallyGenerating = isStreaming && !delayedCharacterInfo;
  const setInputDraft = useChatStore((s) => s.setInputDraft);
  const clearInputDraft = useChatStore((s) => s.clearInputDraft);
  const setCurrentInput = useChatStore((s) => s.setCurrentInput);
  const { generate } = useGenerate();
  const { applyToUserInput } = useApplyRegex();
  const enterToSend = useUIStore((s) => s.enterToSendConvo);
  const showQuickRepliesMenu = useUIStore((s) => s.showQuickRepliesMenu);
  const showQuickReplyPostOnly = useUIStore((s) => s.showQuickReplyPostOnly);
  const showQuickReplyGuide = useUIStore((s) => s.showQuickReplyGuide);
  const speechToTextEnabled = useUIStore((s) => s.speechToTextEnabled);
  const quoteFormat = useUIStore((s) => s.quoteFormat);
  const createMessage = useCreateMessage(activeChatId);
  const deleteMessage = useDeleteMessage(activeChatId);
  const updateMessageExtra = useUpdateMessageExtra(activeChatId);
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingAttachmentReads = activeChatId ? (pendingAttachmentReadsByChat[activeChatId] ?? 0) : 0;
  const isReadingAttachments = pendingAttachmentReads > 0;
  const hasPendingAttachments = isReadingAttachments || attachments.length > 0;
  const shouldShowMobileCollapsedComposer =
    isMobileComposerViewport &&
    mobileHistoryCollapsed &&
    !hasInput &&
    attachments.length === 0 &&
    !isReadingAttachments &&
    !isStreaming &&
    !mobilePickerOpen;
  const chatMetadata = useMemo(() => parseChatMetadata(activeChat?.metadata), [activeChat?.metadata]);
  const inactiveCharacterIds = useMemo(
    () =>
      new Set(
        Array.isArray(chatMetadata.inactiveCharacterIds)
          ? chatMetadata.inactiveCharacterIds.filter((id): id is string => typeof id === "string")
          : [],
      ),
    [chatMetadata.inactiveCharacterIds],
  );
  const activeChatCharacters = useMemo(
    () => chatCharacters?.filter((character) => !inactiveCharacterIds.has(character.id)),
    [chatCharacters, inactiveCharacterIds],
  );
  const activeCharacterNames = useMemo(
    () => (activeChatCharacters ? activeChatCharacters.map((character) => character.name) : characterNames),
    [activeChatCharacters, characterNames],
  );
  const inputPlaceholder = useMemo(() => {
    if (isMobileComposerViewport) return "Message… /cmds";
    if (activeCharacterNames.length > 1 && chatName) return `Message ${chatName}, / for commands`;
    if (activeCharacterNames.length > 0) return `Message @${activeCharacterNames[0]}, / for commands`;
    return "Message...";
  }, [activeCharacterNames, chatName, isMobileComposerViewport]);

  // Read from the existing infinite-message cache so an empty Send can retry
  // after a failed generation without adding a second user message.
  const [, bumpMessagesTick] = useState(0);
  useEffect(() => {
    if (!activeChatId) return;
    const targetKey = JSON.stringify(chatKeys.messages(activeChatId));
    return qc.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && JSON.stringify(event.query.queryKey) === targetKey) {
        bumpMessagesTick((n) => n + 1);
      }
    });
  }, [activeChatId, qc]);
  const messagesData = qc.getQueryData<InfiniteData<Message[]>>(chatKeys.messages(activeChatId ?? ""));
  const isProfessorMariChat = activeChatCharacters?.some((character) => character.id === PROFESSOR_MARI_ID) ?? false;
  const hasMessages = (messagesData?.pages ?? []).some((page) => page.length > 0);
  const visibleMariChips =
    isProfessorMariChat && professorMariSuggestionsEnabled
      ? mariChipsChatId === activeChatId && mariChips.length > 0
        ? mariChips
        : !hasMessages
          ? MARI_STARTER_CHIPS
          : []
      : [];
  const lastMessage = useMemo(() => {
    const firstPage = messagesData?.pages?.[0];
    return firstPage?.[firstPage.length - 1] ?? null;
  }, [messagesData]);
  const latestAssistantMessage = useMemo(() => {
    for (const page of messagesData?.pages ?? []) {
      for (let i = page.length - 1; i >= 0; i--) {
        const message = page[i];
        if (message?.role === "assistant") return message;
      }
    }
    return null;
  }, [messagesData]);
  const lastMessageRole = lastMessage?.role ?? null;
  const canRetry = !isStreaming && lastMessageRole === "user";
  const canSubmit = hasInput || attachments.length > 0 || canRetry;
  const showRetrySendState = canRetry && !hasInput && attachments.length === 0;
  const sendButtonTitle = isActuallyGenerating ? "Stop generating" : showRetrySendState ? "Retry generation" : "Send";

  const syncInputState = useCallback(
    (value: string) => {
      const nextHasInput = value.trim().length > 0;
      setHasInput((current) => (current === nextHasInput ? current : nextHasInput));
      pendingCurrentInputRef.current = value;
      if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
        setCurrentInput(value);
        return;
      }
      if (currentInputFrameRef.current !== null) return;
      currentInputFrameRef.current = window.requestAnimationFrame(() => {
        currentInputFrameRef.current = null;
        setCurrentInput(pendingCurrentInputRef.current);
      });
    },
    [setCurrentInput],
  );

  useEffect(
    () => () => {
      if (currentInputFrameRef.current !== null) {
        window.cancelAnimationFrame(currentInputFrameRef.current);
        currentInputFrameRef.current = null;
        setCurrentInput(pendingCurrentInputRef.current);
      }
    },
    [setCurrentInput],
  );

  const replaceAttachments = useCallback((next: Attachment[]) => {
    attachmentsRef.current = next;
    setAttachments(next);
  }, []);

  const insertTextAtCursor = useCallback(
    (text: string) => {
      const el = textareaRef.current;
      if (!el || !activeChatId) return;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? start;
      const nextValue = `${el.value.slice(0, start)}${text}${el.value.slice(end)}`;
      const cursor = start + text.length;
      el.value = nextValue;
      el.selectionStart = el.selectionEnd = cursor;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
      syncInputState(nextValue);
      setInputDraft(activeChatId, nextValue);
      el.focus();
    },
    [activeChatId, setInputDraft, syncInputState],
  );

  const mariPlan = useAgentStore((s) => s.mariPlan);
  const mariPlanChatId = useAgentStore((s) => s.mariPlanChatId);
  const mariPlanCursor = useAgentStore((s) => s.mariPlanCursor);
  const recordMariPlanAnswer = useAgentStore((s) => s.recordMariPlanAnswer);
  const clearMariPlan = useAgentStore((s) => s.clearMariPlan);
  const activeGuidedPlan = professorMariSuggestionsEnabled && mariPlanChatId === activeChatId ? mariPlan : null;
  const guidedPlanStep = activeGuidedPlan ? (activeGuidedPlan[mariPlanCursor] ?? null) : null;
  const chipRowChips = guidedPlanStep ? guidedPlanStep.chips : visibleMariChips;
  const chipRowHint = guidedPlanStep
    ? `${guidedPlanStep.question} Suggestions only; you can type your own answer.`
    : chipRowChips.length > 0
      ? "Suggestions only. Pick one, or type your own."
      : null;

  const handleMariChipSelect = useCallback(
    (chip: MariSuggestionChip) => {
      if (guidedPlanStep) {
        const result = recordMariPlanAnswer(guidedPlanStep.fieldKey, chip.prompt);
        if (result === "complete") {
          const answers = useAgentStore.getState().mariPlanAnswers;
          const summary = Object.entries(answers)
            .map(([key, value]) => `${key}: ${value}`)
            .join("; ");
          clearMariPlan();
          const el = textareaRef.current;
          if (el && activeChatId) {
            const text = `Create it - ${summary}`;
            el.value = text;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
            syncInputState(text);
            setInputDraft(activeChatId, text);
            el.focus();
          }
        }
        return;
      }
      const el = textareaRef.current;
      if (!el || !activeChatId) return;
      const current = el.value;
      const next = current.trim() ? `${current.trimEnd()} ${chip.prompt}` : chip.prompt;
      el.value = next;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
      syncInputState(next);
      setInputDraft(activeChatId, next);
      el.focus();
    },
    [activeChatId, setInputDraft, syncInputState, guidedPlanStep, recordMariPlanAnswer, clearMariPlan],
  );
  useEffect(() => {
    if (professorMariSuggestionsEnabled) return;
    clearMariChips();
    clearMariPlan();
  }, [clearMariChips, clearMariPlan, professorMariSuggestionsEnabled]);

  useEffect(() => {
    const handleCardAssetInsert = (event: Event) => {
      const detail = (event as CustomEvent<CardAssetInsertDetail>).detail;
      if (!detail?.markdown) return;
      if (detail.chatId && detail.chatId !== activeChatId) return;
      insertTextAtCursor(detail.markdown);
    };

    window.addEventListener(CARD_ASSET_INSERT_EVENT, handleCardAssetInsert);
    return () => window.removeEventListener(CARD_ASSET_INSERT_EVENT, handleCardAssetInsert);
  }, [activeChatId, insertTextAtCursor]);

  const updateAttachments = useCallback((updater: (current: Attachment[]) => Attachment[]) => {
    setAttachments((current) => {
      const next = updater(current);
      attachmentsRef.current = next;
      return next;
    });
  }, []);

  const adjustPendingAttachmentReads = useCallback((chatId: string, delta: number) => {
    setPendingAttachmentReadsByChat((current) => {
      const nextCount = Math.max(0, (current[chatId] ?? 0) + delta);
      const next = { ...current };
      if (nextCount === 0) {
        delete next[chatId];
      } else {
        next[chatId] = nextCount;
      }
      return next;
    });
  }, []);

  const appendAttachmentForChat = useCallback(
    (chatId: string, attachment: Attachment) => {
      if (useChatStore.getState().activeChatId === chatId) {
        updateAttachments((prev) => [...prev, attachment]);
        return;
      }
      const pendingAttachments = pendingAttachmentDraftsRef.current.get(chatId) ?? [];
      pendingAttachmentDraftsRef.current.set(chatId, [...pendingAttachments, attachment]);
    },
    [updateAttachments],
  );

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  // Restore draft
  const prevChatIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevChatIdRef.current !== activeChatId) {
      if (prevChatIdRef.current && textareaRef.current) {
        const prevText = textareaRef.current.value;
        if (prevText.trim()) {
          setInputDraft(prevChatIdRef.current, prevText);
        } else {
          clearInputDraft(prevChatIdRef.current);
        }
        const prevAttachments = attachmentsRef.current;
        if (prevAttachments.length > 0) {
          pendingAttachmentDraftsRef.current.set(prevChatIdRef.current, prevAttachments);
        } else {
          pendingAttachmentDraftsRef.current.delete(prevChatIdRef.current);
        }
      }
      prevChatIdRef.current = activeChatId;
      if (textareaRef.current) {
        const draft = activeChatId ? (useChatStore.getState().inputDrafts.get(activeChatId) ?? "") : "";
        textareaRef.current.value = draft;
        syncInputState(draft);
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
      }
      if (activeChatId) {
        const restoredAttachments = pendingAttachmentDraftsRef.current.get(activeChatId) ?? [];
        replaceAttachments(restoredAttachments);
        pendingAttachmentDraftsRef.current.delete(activeChatId);
      } else {
        replaceAttachments([]);
      }
    }
  }, [activeChatId, setInputDraft, clearInputDraft, syncInputState, replaceAttachments]);

  // Save draft on unmount
  useEffect(() => {
    const el = textareaRef.current;
    const chatId = activeChatId;
    return () => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      if (chatId && el) {
        const text = el.value;
        if (text.trim()) {
          useChatStore.getState().setInputDraft(chatId, text);
        } else {
          useChatStore.getState().clearInputDraft(chatId);
        }
      }
    };
  }, [activeChatId]);

  // Flush immediately when the page is being closed or discarded.
  useEffect(() => {
    const flushDraft = () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      const chatId = useChatStore.getState().activeChatId;
      const text = textareaRef.current?.value ?? "";
      if (!chatId) return;
      if (text.trim()) {
        useChatStore.getState().setInputDraft(chatId, text);
      } else {
        useChatStore.getState().clearInputDraft(chatId);
      }
    };
    window.addEventListener("pagehide", flushDraft);
    return () => window.removeEventListener("pagehide", flushDraft);
  }, []);

  const handleFileUpload = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files) return;
      const originChatId = useChatStore.getState().activeChatId;
      if (!originChatId) return;

      const MAX_SIZE = 20 * 1024 * 1024;
      const acceptedFiles = Array.from(files).filter((file) => {
        if (file.size > MAX_SIZE) {
          toast.error(`${file.name} exceeds 20 MB limit`);
          return false;
        }
        if (!isSupportedChatAttachment(file)) {
          toast.error(
            `${file.name || "That file"} is not supported in chat. Attach images, PDFs, or text files like JSON, TXT, Markdown, or CSV.`,
          );
          return false;
        }
        return true;
      });

      if (acceptedFiles.length === 0) return;
      adjustPendingAttachmentReads(originChatId, acceptedFiles.length);

      for (const file of acceptedFiles) {
        const displayName = file.name || "pasted-file";
        if (file.type.startsWith("image/")) {
          try {
            appendAttachmentForChat(originChatId, await prepareImageAttachment(file, displayName));
          } catch {
            toast.error(`Failed to prepare ${displayName}`);
          } finally {
            adjustPendingAttachmentReads(originChatId, -1);
          }
          continue;
        }

        try {
          const data = await readFileAsDataUrl(file);
          appendAttachmentForChat(originChatId, { type: inferAttachmentType(file), data, name: displayName });
        } catch {
          toast.error(`Failed to read ${displayName}`);
        } finally {
          adjustPendingAttachmentReads(originChatId, -1);
        }
      }
    },
    [adjustPendingAttachmentReads, appendAttachmentForChat],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items || !activeChatId) return;
      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        handleFileUpload(files);
      }
    },
    [activeChatId, handleFileUpload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (!activeChatId) return;
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFileUpload(files);
      }
    },
    [activeChatId, handleFileUpload],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  /** Extract @mentioned character names from a message string. */
  const extractMentions = useCallback(
    (text: string): string[] => {
      if (!activeCharacterNames.length) return [];
      const mentioned: string[] = [];
      // Sort names longest-first so "Mary Jane" matches before "Mary"
      const sorted = [...activeCharacterNames].sort((a, b) => b.length - a.length);
      for (const name of sorted) {
        // Match @Name (case-insensitive) — name may contain spaces
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(`@${escaped}(?=$|[\\s\\p{P}\\p{S}])`, "giu");
        if (re.test(text) && !mentioned.some((m) => normalizeTextForMatch(m) === normalizeTextForMatch(name))) {
          mentioned.push(name);
        }
      }
      return mentioned;
    },
    [activeCharacterNames],
  );

  /** Insert a mention completion into the textarea, replacing the @query. */
  const insertMention = useCallback(
    (name: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const before = el.value.slice(0, mentionStartPos);
      const after = el.value.slice(el.selectionStart);
      el.value = `${before}@${name} ${after}`;
      const cursorPos = before.length + name.length + 2; // +2 for @ and space
      el.selectionStart = el.selectionEnd = cursorPos;
      syncInputState(el.value);
      if (activeChatId) setInputDraft(activeChatId, el.value);
      setMentionQuery(null);
      setMentionCompletions([]);
      el.focus();
    },
    [activeChatId, mentionStartPos, setInputDraft, syncInputState],
  );

  /** Insert an emoji completion into the textarea, replacing the :query. */
  const insertEmoji = useCallback(
    (completion: EmojiCompletion) => {
      const el = textareaRef.current;
      if (!el) return;
      const before = el.value.slice(0, emojiStartPos);
      const after = el.value.slice(el.selectionStart);
      const inserted = completion.kind === "standard" ? completion.emoji : `:${completion.name}:`;
      el.value = `${before}${inserted} ${after}`;
      const cursorPos = before.length + inserted.length + 1;
      el.selectionStart = el.selectionEnd = cursorPos;
      syncInputState(el.value);
      if (activeChatId) setInputDraft(activeChatId, el.value);
      setEmojiCompletions([]);
      el.focus();
    },
    [activeChatId, emojiStartPos, setInputDraft, syncInputState],
  );

  const handleSend = useCallback(async () => {
    if (!activeChatId) return;
    if (isReadingAttachments) {
      toast.info("Still reading attached files. Send will be ready in a moment.");
      return;
    }
    const raw = textareaRef.current?.value.trim() ?? "";
    if (!raw && attachments.length === 0) {
      if (canRetry) {
        try {
          await generate({ chatId: activeChatId, connectionId: null });
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Generation failed";
          toast.error(msg);
        }
      }
      return;
    }

    if (isPromptPreviewMacro(raw)) {
      if (textareaRef.current) {
        textareaRef.current.value = "";
        textareaRef.current.style.height = "auto";
      }
      clearInputDraft(activeChatId);
      syncInputState("");
      replaceAttachments([]);
      onPeekPrompt?.();
      return;
    }

    // If already generating for this chat, just save the message without
    // triggering another generation — the in-progress generation will see
    // it (server re-reads messages after any busy delay).
    if (isStreaming) {
      const activeChatData = useChatStore.getState().activeChat;
      const cachedCharacters = qc.getQueryData<Array<{ id: string; data: unknown }>>(characterKeys.list());
      const cachedPersonas = qc.getQueryData<Array<Record<string, unknown>>>(characterKeys.personas);
      const resolveInputMacros = createInputMacroResolverForChat(activeChatData, cachedCharacters, cachedPersonas, raw);
      const streamMeta = parseChatMetadata(activeChatData?.metadata);
      // First pass: resolve macros against raw input, so {{input}} uses the pre-translation text.
      let message = applyToUserInput(raw, {
        resolveMacros: resolveInputMacros,
        scopedMode: streamMeta.scopedRegexMode,
      });
      // Input translation for streaming path too
      if (streamMeta.translateInput && message.trim()) {
        try {
          const { translateText } = await import("../../lib/translate-text");
          const translated = await translateText(message);
          if (translated.trim()) message = translated;
        } catch {
          toast.error("Failed to translate message — sending original");
        }
      }
      // Final pass: resolve macros introduced by translation while {{input}} still points to raw.
      message = resolveInputMacros(message);
      if (textareaRef.current) {
        textareaRef.current.value = "";
        textareaRef.current.style.height = "auto";
      }
      clearInputDraft(activeChatId);
      syncInputState("");
      const currentAttachments = attachments.map((a) => ({
        type: a.type,
        data: a.data,
        filename: a.name,
        name: a.name,
      }));
      replaceAttachments([]);
      const created = await createMessage.mutateAsync({
        role: "user",
        content: message,
        characterId: null,
      });
      if (currentAttachments.length) {
        await updateMessageExtra.mutateAsync({
          messageId: created.id,
          extra: { attachments: currentAttachments },
        });
      }
      return;
    }

    // Slash command check
    const matched = matchSlashCommand(raw, {
      mode: "conversation",
      availableCapabilityIds,
      conversationGames: conversationGameSlashContributions,
    });
    if (matched) {
      if (isConversationHiddenSlashCommand(matched.command)) {
        setFeedback("Impersonate is not available in Conversation mode.");
        return;
      }
      const slashCtx: SlashCommandContext = {
        chatId: activeChatId,
        mode: "conversation",
        generate,
        createMessage: async (data) => {
          await createMessage.mutateAsync(data);
          requestChatScrollToBottom({ chatId: activeChatId, behavior: "auto" });
        },
        invalidate: () => qc.invalidateQueries({ queryKey: chatKeys.all }),
        characterNames: activeCharacterNames,
        characters: activeChatCharacters?.map((character) => ({ id: character.id, name: character.name })),
        latestAssistantMessageId: latestAssistantMessage?.id ?? null,
        lastMessageRole,
        illustrate: onIllustrate,
        selfie: onGenerateSelfie,
        availableCapabilityIds,
        conversationGames: conversationGameSlashContributions,
      };
      const submittedDraft = textareaRef.current?.value ?? "";
      const submittedHeight = textareaRef.current?.style.height ?? "auto";
      const submittedAttachments = attachments;
      const submittedCompletions = completions;
      const submittedMentionQuery = _mentionQuery;
      const submittedMentionCompletions = mentionCompletions;
      if (textareaRef.current) {
        textareaRef.current.value = "";
        textareaRef.current.style.height = "auto";
      }
      clearInputDraft(activeChatId);
      syncInputState("");
      replaceAttachments([]);
      setCompletions([]);
      setMentionQuery(null);
      setMentionCompletions([]);
      try {
        const result = await matched.command.execute(matched.args, slashCtx);
        if (result.feedback) {
          setFeedback(result.feedback);
        }
      } catch (error) {
        const activeChatIdAfterFailure = useChatStore.getState().activeChatId;
        const currentValue = textareaRef.current?.value ?? "";
        const canRestoreVisibleDraft = activeChatIdAfterFailure === activeChatId && currentValue.length === 0;
        if (canRestoreVisibleDraft && textareaRef.current) {
          textareaRef.current.value = submittedDraft;
          textareaRef.current.style.height = submittedHeight;
          syncInputState(submittedDraft);
          setCompletions(submittedCompletions);
          setMentionQuery(submittedMentionQuery);
          setMentionCompletions(submittedMentionCompletions);
        }
        if (submittedAttachments.length > 0) {
          if (activeChatIdAfterFailure === activeChatId) {
            updateAttachments((current) => (current.length === 0 ? submittedAttachments : current));
          } else {
            pendingAttachmentDraftsRef.current.set(activeChatId, submittedAttachments);
          }
        }
        if (submittedDraft && (canRestoreVisibleDraft || activeChatIdAfterFailure !== activeChatId)) {
          setInputDraft(activeChatId, submittedDraft);
        }
        const msg = error instanceof Error ? error.message : "Command failed";
        toast.error(msg);
      }
      return;
    }

    // Downloaded games contribute their own aliases. The message still sends so characters can react.
    {
      const normalized = raw.toLocaleLowerCase();
      if (/\b(?:play|start|deal|rack)\b/i.test(normalized)) {
        const matchedGame = availableConversationGames.find((game) => {
          const contribution = game.manifest.contributions!.conversationGame!;
          const aliases = [
            game.manifest.name,
            contribution.command.slice(1),
            ...contribution.aliases,
          ].map((alias) => alias.toLocaleLowerCase());
          return aliases.some((alias) => normalized.includes(alias));
        });
        if (matchedGame) {
          useConversationGamesStore.getState().openSetup(matchedGame.id, activeChatId);
        }
      }
    }

    const activeChat = useChatStore.getState().activeChat;
    const cachedCharacters = qc.getQueryData<Array<{ id: string; data: unknown }>>(characterKeys.list());
    const cachedPersonas = qc.getQueryData<Array<Record<string, unknown>>>(characterKeys.personas);
    const resolveInputMacros = createInputMacroResolverForChat(activeChat, cachedCharacters, cachedPersonas, raw);
    const chatMeta = parseChatMetadata(activeChat?.metadata);
    // First pass: resolve macros against raw input, so {{input}} uses the pre-translation text.
    let message = applyToUserInput(raw, {
      resolveMacros: resolveInputMacros,
      scopedMode: chatMeta.scopedRegexMode,
    });

    // Input translation: translate user's message before sending
    if (chatMeta.translateInput && message.trim()) {
      try {
        const { translateText } = await import("../../lib/translate-text");
        const translated = await translateText(message);
        if (translated.trim()) message = translated;
      } catch {
        toast.error("Failed to translate message — sending original");
      }
    }

    // Final pass: resolve macros introduced by translation while {{input}} still points to raw.
    message = resolveInputMacros(message);

    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.style.height = "auto";
    }
    clearInputDraft(activeChatId);
    syncInputState("");

    const pendingAttachments = attachments.map((a) => ({ type: a.type, data: a.data, filename: a.name, name: a.name }));
    replaceAttachments([]);

    // Extract @mentions from the raw message (before regex transforms)
    const mentioned = extractMentions(raw);

    await generate({
      chatId: activeChatId,
      connectionId: null,
      userMessage: message,
      ...(pendingAttachments.length ? { attachments: pendingAttachments } : {}),
      ...(mentioned.length ? { mentionedCharacterNames: mentioned } : {}),
    });
  }, [
    activeChatId,
    availableConversationGames,
    activeChatCharacters,
    lastMessageRole,
    attachments,
    canRetry,
    isReadingAttachments,
    isStreaming,
    generate,
    applyToUserInput,
    extractMentions,
    clearInputDraft,
    createMessage,
    updateMessageExtra,
    activeCharacterNames,
    completions,
    _mentionQuery,
    mentionCompletions,
    latestAssistantMessage,
    qc,
    syncInputState,
    setInputDraft,
    replaceAttachments,
    updateAttachments,
    onPeekPrompt,
    onIllustrate,
    onGenerateSelfie,
    availableCapabilityIds,
    conversationGameSlashContributions,
  ]);

  const runQuickSlashCommand = useCallback(
    async (commandLine: string, fallbackError: string) => {
      if (!activeChatId) return;
      const submittingChatId = activeChatId;
      const matched = matchSlashCommand(commandLine, {
        mode: "conversation",
        availableCapabilityIds,
        conversationGames: conversationGameSlashContributions,
      });
      if (!matched) return;
      if (isConversationHiddenSlashCommand(matched.command)) {
        toast.info("Impersonate is not available in Conversation mode.");
        return;
      }
      const generationStatus: { succeeded?: boolean } = {};
      const slashCtx: SlashCommandContext = {
        chatId: submittingChatId,
        mode: "conversation",
        generate: async (params) => {
          const succeeded = await generate(params);
          if (succeeded !== undefined) generationStatus.succeeded = succeeded;
          return succeeded;
        },
        createMessage: async (data) => {
          await createMessage.mutateAsync(data);
          requestChatScrollToBottom({ chatId: submittingChatId, behavior: "auto" });
        },
        invalidate: () => qc.invalidateQueries({ queryKey: chatKeys.all }),
        characterNames: activeCharacterNames,
        characters: activeChatCharacters?.map((character) => ({ id: character.id, name: character.name })),
        latestAssistantMessageId: latestAssistantMessage?.id ?? null,
        lastMessageRole,
        illustrate: onIllustrate,
        selfie: onGenerateSelfie,
        availableCapabilityIds,
        conversationGames: conversationGameSlashContributions,
      };

      const previousDraft = textareaRef.current?.value ?? "";
      const previousHeight = textareaRef.current?.style.height ?? "auto";
      const previousCompletions = completions;
      const previousMentionQuery = _mentionQuery;
      const previousMentionCompletions = mentionCompletions;
      const restoreSubmittedDraft = () => {
        const currentValue = textareaRef.current?.value ?? "";
        const canRestoreVisibleDraft =
          useChatStore.getState().activeChatId === submittingChatId && currentValue.length === 0;
        if (canRestoreVisibleDraft && textareaRef.current) {
          textareaRef.current.value = previousDraft;
          textareaRef.current.style.height = previousHeight;
          syncInputState(previousDraft);
          setCompletions(previousCompletions);
          setMentionQuery(previousMentionQuery);
          setMentionCompletions(previousMentionCompletions);
        }
        if (previousDraft && (canRestoreVisibleDraft || useChatStore.getState().activeChatId !== submittingChatId)) {
          setInputDraft(submittingChatId, previousDraft);
        }
      };
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current);
        draftTimerRef.current = null;
      }
      if (textareaRef.current) {
        textareaRef.current.value = "";
        textareaRef.current.style.height = "auto";
      }
      clearInputDraft(submittingChatId);
      syncInputState("");
      setCompletions([]);
      setMentionQuery(null);
      setMentionCompletions([]);

      try {
        const result = await matched.command.execute(matched.args, slashCtx);
        if (result.feedback) {
          setFeedback(result.feedback);
        }
        if (generationStatus.succeeded === false) {
          restoreSubmittedDraft();
        }
      } catch (error) {
        restoreSubmittedDraft();
        const msg = error instanceof Error ? error.message : fallbackError;
        toast.error(msg);
      }
    },
    [
      activeChatId,
      activeChatCharacters,
      activeCharacterNames,
      lastMessageRole,
      clearInputDraft,
      completions,
      _mentionQuery,
      mentionCompletions,
      createMessage,
      generate,
      latestAssistantMessage,
      onIllustrate,
      onGenerateSelfie,
      availableCapabilityIds,
      conversationGameSlashContributions,
      qc,
      setInputDraft,
      syncInputState,
    ],
  );

  const handlePostOnlyButton = useCallback(async () => {
    if (!activeChatId || isStreaming) return;
    const submittingChatId = activeChatId;
    if (isReadingAttachments) {
      toast.info("Still reading attached files. Post will be ready in a moment.");
      return;
    }
    const raw = textareaRef.current?.value.trim() ?? "";
    const hasText = raw.length > 0;
    const hasFiles = attachments.length > 0;
    if (!hasText && !hasFiles) return;

    if (shouldExecuteQuickPostAsCommand(raw, {
      mode: "conversation",
      availableCapabilityIds,
      conversationGames: conversationGameSlashContributions,
    })) {
      await handleSend();
      return;
    }

    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }

    const activeChatData = useChatStore.getState().activeChat;
    const cachedCharacters = qc.getQueryData<Array<{ id: string; data: unknown }>>(characterKeys.list());
    const cachedPersonas = qc.getQueryData<Array<Record<string, unknown>>>(characterKeys.personas);
    const resolveInputMacros = createInputMacroResolverForChat(activeChatData, cachedCharacters, cachedPersonas, raw);
    const chatMeta = parseChatMetadata(activeChatData?.metadata);
    let message = applyToUserInput(raw, {
      resolveMacros: resolveInputMacros,
      scopedMode: chatMeta.scopedRegexMode,
    });

    if (chatMeta.translateInput && message.trim()) {
      try {
        const { translateText } = await import("../../lib/translate-text");
        const translated = await translateText(message);
        if (translated.trim()) message = translated;
      } catch {
        toast.error("Failed to translate message; posting original");
      }
    }

    message = resolveInputMacros(message);
    const submittedDraft = raw;
    const submittedHeight = textareaRef.current?.style.height ?? "auto";
    const submittedAttachments = attachments;
    const submittedCompletions = completions;
    const submittedMentionQuery = _mentionQuery;
    const submittedMentionCompletions = mentionCompletions;
    const pendingAttachments = submittedAttachments.map((a) => ({
      type: a.type,
      data: a.data,
      filename: a.name,
      name: a.name,
    }));

    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.style.height = "auto";
    }
    clearInputDraft(submittingChatId);
    syncInputState("");
    replaceAttachments([]);
    setCompletions([]);
    setMentionQuery(null);
    setMentionCompletions([]);

    let createdMessageId: string | null = null;
    try {
      const created = await createMessage.mutateAsync({
        role: "user",
        content: message,
        characterId: null,
      });
      createdMessageId = created.id;
      if (pendingAttachments.length) {
        await updateMessageExtra.mutateAsync({
          messageId: created.id,
          extra: { attachments: pendingAttachments },
        });
      }
    } catch (error) {
      let rollbackFailed = false;
      if (createdMessageId) {
        try {
          await deleteMessage.mutateAsync(createdMessageId);
        } catch {
          rollbackFailed = true;
        }
      }
      const activeChatIdAfterFailure = useChatStore.getState().activeChatId;
      const currentValue = textareaRef.current?.value ?? "";
      const canRestoreVisibleDraft = activeChatIdAfterFailure === submittingChatId && currentValue.length === 0;
      if (canRestoreVisibleDraft && textareaRef.current) {
        textareaRef.current.value = submittedDraft;
        textareaRef.current.style.height = submittedHeight;
        syncInputState(submittedDraft);
        setCompletions(submittedCompletions);
        setMentionQuery(submittedMentionQuery);
        setMentionCompletions(submittedMentionCompletions);
      }
      if (submittedAttachments.length > 0) {
        if (activeChatIdAfterFailure === submittingChatId) {
          updateAttachments((current) => (current.length === 0 ? submittedAttachments : current));
        } else {
          pendingAttachmentDraftsRef.current.set(submittingChatId, submittedAttachments);
        }
      }
      if (submittedDraft && (canRestoreVisibleDraft || activeChatIdAfterFailure !== submittingChatId)) {
        setInputDraft(submittingChatId, submittedDraft);
      }
      const msg = error instanceof Error ? error.message : "Failed to post message";
      toast.error(rollbackFailed ? `${msg}; the partial message may need to be removed before retrying.` : msg);
    }
  }, [
    activeChatId,
    isStreaming,
    isReadingAttachments,
    attachments,
    completions,
    _mentionQuery,
    mentionCompletions,
    applyToUserInput,
    qc,
    clearInputDraft,
    syncInputState,
    setInputDraft,
    replaceAttachments,
    updateAttachments,
    createMessage,
    deleteMessage,
    updateMessageExtra,
    handleSend,
    availableCapabilityIds,
    conversationGameSlashContributions,
  ]);

  const handleGuidedGenerationButton = useCallback(async () => {
    if (!activeChatId || isStreaming) return;
    if (hasPendingAttachments) {
      toast.info("Clear or send attachments before using guided generation.");
      return;
    }
    const text = textareaRef.current?.value?.trim() ?? "";
    if (!text) return;
    await runQuickSlashCommand(`/guided ${text}`, "Guided generation failed");
  }, [activeChatId, isStreaming, hasPendingAttachments, runQuickSlashCommand]);

  const quickReplyActions = useMemo<QuickReplyAction[]>(() => {
    const actions: QuickReplyAction[] = [];
    const getPostOnlyDisabledReason = () => {
      if (!activeChatId) return "Select or create a chat first.";
      if (isStreaming) return "Wait for the current stream to finish.";
      if (isReadingAttachments) return "Still reading attached files.";
      if (!hasInput && attachments.length === 0) return "Type a draft first.";
      return undefined;
    };
    const getGuideDisabledReason = () => {
      if (!activeChatId) return "Select or create a chat first.";
      if (isStreaming) return "Wait for the current stream to finish.";
      if (hasPendingAttachments) return "Clear or post attachments first.";
      if (!hasInput) return "Type a direction first.";
      return undefined;
    };
    if (showQuickReplyPostOnly) {
      actions.push({
        id: "post-only",
        label: "Post only",
        description: "Add your message without a reply",
        icon: <FileText size="0.875rem" />,
        disabled: !activeChatId || isStreaming || isReadingAttachments || (!hasInput && attachments.length === 0),
        disabledReason: getPostOnlyDisabledReason(),
        onSelect: handlePostOnlyButton,
      });
    }
    if (showQuickReplyGuide) {
      actions.push({
        id: "guide-reply",
        label: "Guide reply",
        description: "Send as /guided direction",
        icon: <WandSparkles size="0.875rem" />,
        disabled: !activeChatId || isStreaming || !hasInput || hasPendingAttachments,
        disabledReason: getGuideDisabledReason(),
        onSelect: handleGuidedGenerationButton,
      });
    }
    return actions;
  }, [
    activeChatId,
    isStreaming,
    isReadingAttachments,
    hasInput,
    attachments.length,
    hasPendingAttachments,
    showQuickReplyPostOnly,
    showQuickReplyGuide,
    handlePostOnlyButton,
    handleGuidedGenerationButton,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // @mention completions navigation
      if (mentionCompletions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedMention((p) => (p + 1) % mentionCompletions.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedMention((p) => (p - 1 + mentionCompletions.length) % mentionCompletions.length);
          return;
        }
        if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault();
          const name = mentionCompletions[selectedMention];
          if (name) insertMention(name);
          return;
        }
        if (e.key === "Escape") {
          setMentionQuery(null);
          setMentionCompletions([]);
          return;
        }
      }

      // :emoji: completions navigation
      if (emojiCompletions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedEmojiCompletion((p) => (p + 1) % emojiCompletions.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedEmojiCompletion((p) => (p - 1 + emojiCompletions.length) % emojiCompletions.length);
          return;
        }
        if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault();
          const em = emojiCompletions[selectedEmojiCompletion];
          if (em) insertEmoji(em);
          return;
        }
        if (e.key === "Escape") {
          setEmojiCompletions([]);
          return;
        }
      }

      // Slash completions navigation
      if (completions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedCompletion((p) => (p + 1) % completions.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedCompletion((p) => (p - 1 + completions.length) % completions.length);
          return;
        }
        if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault();
          const completion = completions[selectedCompletion];
          if (completion && textareaRef.current) {
            textareaRef.current.value = completion.insertValue;
            textareaRef.current.setSelectionRange(completion.cursor, completion.cursor);
            syncInputState(completion.insertValue);
            if (activeChatId) setInputDraft(activeChatId, completion.insertValue);
            setCompletions([]);
          }
          return;
        }
        if (e.key === "Escape") {
          setCompletions([]);
          return;
        }
      }

      const shouldSend = enterToSend ? e.key === "Enter" && !e.shiftKey : e.key === "Enter" && (e.metaKey || e.ctrlKey);
      if (shouldSend) {
        e.preventDefault();
        handleSend();
      }
    },
    [
      completions,
      activeChatId,
      selectedCompletion,
      mentionCompletions,
      selectedMention,
      insertMention,
      emojiCompletions,
      selectedEmojiCompletion,
      insertEmoji,
      enterToSend,
      handleSend,
      setInputDraft,
      syncInputState,
    ],
  );

  const handleInput = useCallback(
    (event: FormEvent<HTMLTextAreaElement>) => {
      const el = textareaRef.current;
      if (!el) return;
      const formatted = shouldFormatQuoteInput(event, el.value) ? applyTextareaQuoteFormat(el, quoteFormat) : el.value;
      // Debounced resize to reduce layout reflows during fast typing
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
      }, 150);
      syncInputState(formatted);

      if (activeChatId) {
        if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
        const chatId = activeChatId;
        const draft = formatted;
        draftTimerRef.current = setTimeout(() => {
          if (draft.trim()) {
            setInputDraft(chatId, draft);
          } else {
            clearInputDraft(chatId);
          }
        }, 300);
      }

      // Slash completions
      if (formatted.startsWith("/")) {
        const results = buildConversationSlashCompletions(
          formatted,
          activeChatCharacters,
          availableCapabilityIds,
          conversationGameSlashContributions,
        );
        setCompletions(results);
        setSelectedCompletion(0);
      } else {
        setCompletions((current) => (current.length > 0 ? [] : current));
      }

      // @mention detection — look backwards from cursor for an @ trigger
      const cursor = el.selectionStart;
      const textBefore = formatted.slice(0, cursor);
      // Find the last @ that isn't preceded by a word character
      const atMatch = textBefore.match(/(^|[^\p{L}\p{N}_])@([^\n@]*)$/u);
      if (atMatch && activeCharacterNames.length > 0) {
        const queryText = atMatch[2] ?? "";
        const query = normalizeTextForMatch(queryText);
        const startPos = (atMatch.index ?? textBefore.length - atMatch[0].length) + (atMatch[1]?.length ?? 0);
        const matches = activeCharacterNames.filter((name) => startsWithTextForMatch(name, query));
        if (matches.length > 0) {
          setMentionQuery(query);
          setMentionCompletions(matches);
          setSelectedMention(0);
          setMentionStartPos(startPos);
        } else {
          setMentionQuery((current) => (current === null ? current : null));
          setMentionCompletions((current) => (current.length > 0 ? [] : current));
        }
      } else {
        setMentionQuery((current) => (current === null ? current : null));
        setMentionCompletions((current) => (current.length > 0 ? [] : current));
      }

      // :emoji: detection — a `:partial` at a word boundary, just before the cursor
      const emojiMatch = textBefore.match(/(?:^|\s):([a-z0-9_]+)$/i);
      if (emojiMatch) {
        const eq = emojiMatch[1]!.toLowerCase();
        const customMatches: EmojiCompletion[] = (customEmojiList ?? [])
          .filter((em) => em.name.includes(eq))
          .sort((a, b) => Number(b.name.startsWith(eq)) - Number(a.name.startsWith(eq)))
          .map((em) => ({ ...em, kind: "custom" as const }));
        const customNames = new Set(customMatches.map((em) => em.name));
        const standardMatches: EmojiCompletion[] = searchStandardEmojiShortcodes(eq, 10)
          .filter((em) => !customNames.has(em.name))
          .map((em) => ({ ...em, kind: "standard" as const, source: "Standard" as const }));
        const matches = [...customMatches, ...standardMatches].slice(0, 10);
        if (matches.length > 0) {
          setEmojiCompletions(matches);
          setSelectedEmojiCompletion(0);
          setEmojiStartPos(cursor - eq.length - 1);
        } else {
          setEmojiCompletions((current) => (current.length > 0 ? [] : current));
        }
      } else {
        setEmojiCompletions((current) => (current.length > 0 ? [] : current));
      }
    },
    [
      activeChatId,
      activeCharacterNames,
      activeChatCharacters,
      customEmojiList,
      clearInputDraft,
      quoteFormat,
      setInputDraft,
      syncInputState,
      availableCapabilityIds,
      conversationGameSlashContributions,
    ],
  );

  useEffect(() => {
    if (hasInput && feedback) setFeedback(null);
  }, [hasInput, feedback]);

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      if (!textareaRef.current) return;
      const el = textareaRef.current;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const value = el.value;
      el.value = value.slice(0, start) + emoji + value.slice(end);
      el.selectionStart = el.selectionEnd = start + emoji.length;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
      syncInputState(el.value);
      if (activeChatId) setInputDraft(activeChatId, el.value);
      el.focus();
    },
    [activeChatId, setInputDraft, syncInputState],
  );

  const insertStickerToken = useCallback(
    (name: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const value = el.value;
      const before = value.slice(0, start);
      const after = value.slice(end);
      // Put the sticker on its own line: a leading newline unless we're already at a line start,
      // and a trailing newline so the user types their message on the line below it.
      const lead = before.length === 0 || before.endsWith("\n") ? "" : "\n";
      const insertText = `${lead}sticker:${name}:\n`;
      el.value = before + insertText + after;
      const cursor = before.length + insertText.length;
      el.selectionStart = el.selectionEnd = cursor;
      // Grow the textarea now — programmatic value changes don't fire the input-event auto-resize,
      // so without this the newline'd sticker line stays hidden until the user types.
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
      syncInputState(el.value);
      if (activeChatId) setInputDraft(activeChatId, el.value);
      el.focus();
    },
    [activeChatId, setInputDraft, syncInputState],
  );

  const handleGifSelect = useCallback(
    async (gifUrl: string) => {
      if (!activeChatId) return;

      // Fetch the GIF and convert to PNG so all providers can handle it
      let gifAttachments: Array<{ type: string; data: string }> | undefined;
      try {
        const resp = await fetch(gifUrl);
        const blob = await resp.blob();
        const prepared = await prepareImageAttachment(blob, "gif.gif");
        gifAttachments = [{ type: prepared.type, data: prepared.data }];
      } catch {
        // If fetch fails (CORS etc.), send without attachment — still shows as image in chat
      }

      // If already streaming for this chat, just save the message
      if (isStreaming) {
        createMessage.mutate({ role: "user", content: gifUrl, characterId: null });
        return;
      }

      await generate({
        chatId: activeChatId,
        connectionId: null,
        userMessage: gifUrl,
        ...(gifAttachments ? { attachments: gifAttachments } : {}),
      });
    },
    [activeChatId, isStreaming, generate, createMessage],
  );

  const handleStickerSelect = useCallback(
    async (name: string) => {
      if (!activeChatId) return;
      const token = `sticker:${name}:`;
      // Let the user choose: send it now (triggering a reply) or drop it into the composer to keep typing.
      const choice = await showChoiceDialog({
        title: "Send sticker",
        message: "Send the sticker now and let the character reply, or add it to your message so you can keep typing?",
        choices: [
          { key: "send", label: "Send & reply" },
          { key: "insert", label: "Add to message" },
        ],
      });
      if (choice === "insert") {
        insertStickerToken(name); // drops the sticker on its own line so the user types below it
        return;
      }
      if (choice !== "send") return; // dismissed

      // "Send & reply" — post the sticker as its own message (mirror the GIF send guards).
      if (isStreaming) {
        createMessage.mutate({ role: "user", content: token, characterId: null });
        return;
      }
      await generate({ chatId: activeChatId, connectionId: null, userMessage: token });
    },
    [activeChatId, isStreaming, generate, createMessage, insertStickerToken],
  );
  const showDraftTranslateButton = chatMetadata.showInputTranslateButton === true;
  const showMobileToolsTab =
    showDraftTranslateButton ||
    speechToTextEnabled ||
    (showQuickRepliesMenu && quickReplyActions.length > 0);
  const mobilePickerTabs = useMemo<ConversationMediaPickerTab[]>(() => {
    const tabs: ConversationMediaPickerTab[] = [
      { id: "emoji", label: "Emoji" },
      { id: "gifs", label: "GIFs" },
      { id: "stickers", label: "Stickers" },
    ];
    if (showMobileToolsTab) tabs.push({ id: "tools", label: "Tools" });
    return tabs;
  }, [showMobileToolsTab]);

  useEffect(() => {
    if (!showMobileToolsTab && mobilePickerTab === "tools") setMobilePickerTab("emoji");
  }, [mobilePickerTab, showMobileToolsTab]);

  const handleTranslateDraft = useCallback(async () => {
    if (!activeChatId || isTranslatingDraft) return;
    const raw = textareaRef.current?.value ?? "";
    if (!raw.trim()) return;

    setIsTranslatingDraft(true);
    try {
      const translated = await translateDraftText(raw);
      if (!translated || !textareaRef.current) return;
      const formatted = formatTextQuotes(translated, quoteFormat);
      textareaRef.current.value = formatted;
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
      syncInputState(formatted);
      setInputDraft(activeChatId, formatted);
      textareaRef.current.focus();
    } finally {
      setIsTranslatingDraft(false);
    }
  }, [activeChatId, isTranslatingDraft, quoteFormat, setInputDraft, syncInputState]);

  const handleSpeechTranscript = useCallback(
    (transcript: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? start;
      const before = el.value.slice(0, start);
      const after = el.value.slice(end);
      const prefix = before && !/\s$/.test(before) ? " " : "";
      const suffix = after && !/^\s/.test(after) ? " " : "";
      const nextValue = formatTextQuotes(`${before}${prefix}${transcript}${suffix}${after}`, quoteFormat);
      const nextCursor = before.length + prefix.length + transcript.length;

      el.value = nextValue;
      el.setSelectionRange(nextCursor, nextCursor);
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
      syncInputState(nextValue);
      if (activeChatId) setInputDraft(activeChatId, nextValue);
      el.focus();
    },
    [activeChatId, quoteFormat, setInputDraft, syncInputState],
  );

  const ensureInputVisible = useCallback(() => {
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 767px)").matches) return;
    const scroll = () => {
      const inputBar = inputBarRef.current;
      const viewport = window.visualViewport;
      if (!inputBar || !viewport) return;
      const rect = inputBar.getBoundingClientRect();
      const viewportTop = viewport.offsetTop;
      const viewportBottom = viewportTop + viewport.height;
      if (rect.top >= viewportTop + 8 && rect.bottom <= viewportBottom - 8) return;
      inputBar.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    requestAnimationFrame(scroll);
  }, []);

  useEffect(() => {
    if (mobileHistoryCollapsed || !focusAfterMobileRestoreRef.current) return;
    focusAfterMobileRestoreRef.current = false;
    const focus = () => {
      textareaRef.current?.focus({ preventScroll: true });
      ensureInputVisible();
    };
    requestAnimationFrame(focus);
    window.setTimeout(focus, 120);
  }, [ensureInputVisible, mobileHistoryCollapsed]);

  const mediaPickerToolsContent =
    mobilePickerTab === "tools" ? (
      <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
        <div className="grid gap-2">
          {showDraftTranslateButton && (
            <button
              type="button"
              onClick={() => {
                setMobilePickerOpen(false);
                void handleTranslateDraft();
              }}
              disabled={!activeChatId || !hasInput || isTranslatingDraft}
              className={cn(
                "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors",
                activeChatId && hasInput && !isTranslatingDraft
                  ? "text-foreground/80 hover:bg-foreground/10"
                  : "cursor-not-allowed text-foreground/25",
              )}
            >
              {isTranslatingDraft ? (
                <Loader2 size="1rem" className="shrink-0 animate-spin" />
              ) : (
                <Languages size="1rem" className="shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-medium">Translate draft</span>
            </button>
          )}

          {speechToTextEnabled && (
            <div className="flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground/80">Voice input</span>
              <SpeechToTextButton
                disabled={!activeChatId}
                onTranscript={(transcript) => {
                  setMobilePickerOpen(false);
                  handleSpeechTranscript(transcript);
                }}
                className="h-10 w-10 rounded-lg"
                iconSize={16}
              />
            </div>
          )}

          {showQuickRepliesMenu &&
            quickReplyActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  if (action.disabled) return;
                  setMobilePickerOpen(false);
                  void action.onSelect();
                }}
                disabled={action.disabled}
                title={action.disabled ? (action.disabledReason ?? action.description) : action.description}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors",
                  action.disabled
                    ? "cursor-not-allowed text-foreground/25"
                    : "text-foreground/80 hover:bg-foreground/10",
                )}
              >
                <span className="shrink-0">{action.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{action.label}</span>
                  <span className="block truncate text-xs text-foreground/45">
                    {action.disabledReason ?? action.description}
                  </span>
                </span>
              </button>
            ))}
        </div>
      </div>
    ) : null;

  if (shouldShowMobileCollapsedComposer) {
    return (
      <div className="mari-chat-input chat-input-container relative px-2 pb-3 sm:px-3 md:hidden">
        <button
          type="button"
          onClick={() => {
            focusAfterMobileRestoreRef.current = true;
            onMobileHistoryCollapsedChange?.(false);
          }}
          className={cn(
            getChatInputShellClass({ dragging: false, hasContent: false, layout: "conversation" }),
            "min-h-10 w-full justify-start text-left text-sm text-foreground/55",
          )}
          aria-label="Show message input"
        >
          <span className="truncate">Message… /cmds</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mari-chat-input chat-input-container relative px-2 sm:px-3 pb-3">
      {/* Slash command autocomplete */}
      {completions.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 z-40 mb-1 max-h-[min(18rem,45dvh)] overflow-y-auto rounded-lg border border-foreground/10 bg-[var(--card)] shadow-lg [-webkit-overflow-scrolling:touch]">
          {completions.map((cmd, i) => (
            <button
              key={cmd.key}
              onMouseDown={(e) => {
                e.preventDefault();
                if (textareaRef.current) {
                  textareaRef.current.value = cmd.insertValue;
                  textareaRef.current.setSelectionRange(cmd.cursor, cmd.cursor);
                  syncInputState(cmd.insertValue);
                  if (activeChatId) setInputDraft(activeChatId, cmd.insertValue);
                  setCompletions([]);
                  textareaRef.current.focus();
                }
              }}
              className={cn(
                "flex w-full min-w-0 items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                i === selectedCompletion ? "bg-foreground/10 text-foreground" : "hover:bg-foreground/10",
              )}
            >
              <span
                className={cn(
                  "shrink-0 whitespace-nowrap text-xs",
                  cmd.kind === "character" ? "font-medium" : "font-mono",
                )}
              >
                {cmd.label}
              </span>
              {cmd.description && (
                <span className="min-w-0 flex-1 text-[0.6875rem] leading-snug text-foreground/45 [overflow-wrap:anywhere]">
                  {cmd.description}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* @mention autocomplete */}
      {mentionCompletions.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 overflow-hidden rounded-lg border border-foreground/10 bg-[var(--card)] shadow-lg">
          {mentionCompletions.map((name, i) => (
            <button
              key={name}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(name);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                i === selectedMention ? "bg-foreground/10 text-foreground" : "hover:bg-foreground/10",
              )}
            >
              <AtSign size="0.75rem" className="shrink-0 text-foreground/45" />
              <span className="font-medium">{name}</span>
            </button>
          ))}
        </div>
      )}

      {/* :emoji: autocomplete */}
      {emojiCompletions.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 max-h-56 overflow-y-auto rounded-lg border border-foreground/10 bg-[var(--card)] shadow-lg sm:left-[2%] sm:right-[2%]">
          {emojiCompletions.map((em, i) => (
            <button
              key={em.name}
              onMouseDown={(e) => {
                e.preventDefault();
                insertEmoji(em);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
                i === selectedEmojiCompletion ? "bg-foreground/10 text-foreground" : "hover:bg-foreground/10",
              )}
            >
              {em.kind === "custom" ? (
                <img src={em.url} alt={`:${em.name}:`} className="h-5 w-5 shrink-0 object-contain" />
              ) : (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center text-base" aria-hidden="true">
                  {em.emoji}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate font-medium">:{em.name}:</span>
              <span className="hidden shrink-0 text-xs text-foreground/40 sm:inline">{em.source}</span>
            </button>
          ))}
        </div>
      )}

      {/* Multipurpose picker sheet — Emoji / GIFs / Stickers / Tools */}
      {mobilePickerOpen && (
        <ConversationMediaPickerPanel
          tabs={mobilePickerTabs}
          activeTab={mobilePickerTab}
          onActiveTabChange={setMobilePickerTab}
          onClose={() => setMobilePickerOpen(false)}
          onEmojiSelect={handleEmojiSelect}
          onGifSelect={handleGifSelect}
          onStickerSelect={handleStickerSelect}
          className="absolute bottom-full left-0 right-0 z-20 mb-3 sm:hidden"
          toolsContent={mediaPickerToolsContent}
        />
      )}

      {/* Feedback toast */}
      {feedback && (
        <div className="absolute bottom-full left-3 right-3 z-50 mb-2">
          <SlashCommandFeedback feedback={feedback} onDismiss={() => setFeedback(null)} />
        </div>
      )}

      {/* Attachment preview */}
      {(attachments.length > 0 || isReadingAttachments) && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((att, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded-lg bg-foreground/10 px-2.5 py-1.5 text-xs ring-1 ring-foreground/10"
            >
              {att.type.startsWith("image/") ? null : (
                <FileText
                  size="0.875rem"
                  className={cn(
                    "shrink-0",
                    att.type === PDF_ATTACHMENT_MIME_TYPE ? "text-[var(--primary)]" : "text-foreground/45",
                  )}
                />
              )}
              <span className="max-w-[120px] truncate">{att.name}</span>
              <button
                onClick={() => updateAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                className="rounded p-0.5 text-foreground/45 hover:text-[var(--destructive)]"
              >
                <X size="0.625rem" />
              </button>
            </div>
          ))}
          {isReadingAttachments && (
            <div className="flex items-center gap-1.5 rounded-lg bg-foreground/10 px-2.5 py-1.5 text-xs text-foreground/60 ring-1 ring-foreground/10">
              <Loader2 size="0.875rem" className="animate-spin" />
              Reading file...
            </div>
          )}
        </div>
      )}

      {chipRowHint && (
        <p className="mb-1 flex items-center gap-1.5 px-0.5 text-xs text-[var(--muted-foreground)]">
          <Sparkles size="0.75rem" className="shrink-0 text-[var(--primary)]" />
          <span>{chipRowHint}</span>
        </p>
      )}
      <MariSuggestionChips chips={chipRowChips} onSelect={handleMariChipSelect} disabled={isStreaming} />

      {/* Input bar */}
      <div
        ref={inputBarRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={getChatInputShellClass({
          dragging: isDragging,
          hasContent: hasInput || attachments.length > 0,
          layout: "conversation",
        })}
      >
        {/* Attach button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf,.pdf,.txt,.md,.markdown,.json,.jsonl,.csv,.log,.xml,.yaml,.yml"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFileUpload(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all active:scale-90 sm:h-8 sm:w-8",
            attachments.length
              ? "bg-foreground/10 text-foreground/75 ring-1 ring-foreground/20"
              : "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70",
          )}
          title="Attach file"
        >
          <Paperclip size="1rem" />
        </button>

        {/* Quick Switchers — desktop: inline, mobile: chevron */}
        <div className="hidden shrink-0 items-center gap-1 sm:flex">
          <QuickConnectionSwitcher />
          <QuickPersonaSwitcher />
        </div>
        <div className="flex shrink-0 sm:hidden">
          <QuickSwitcherMobile />
        </div>

        {/* Textarea */}

        <textarea
          ref={textareaRef}
          placeholder={inputPlaceholder}
          rows={1}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => {
            if (mobilePickerOpen) setMobilePickerOpen(false);
            ensureInputVisible();
          }}
          className="max-h-[12.5rem] min-h-9 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-[1rem] leading-tight text-foreground outline-none placeholder:text-foreground/30 sm:min-h-0 sm:px-0 sm:py-0 sm:leading-normal"
        />

        {/* Right actions */}
        <div className="ml-0 flex shrink-0 flex-nowrap items-center justify-end gap-0 sm:ml-auto sm:gap-0.5">
          {/* Mobile: one multipurpose button → Emoji/GIFs/Stickers/Tools sheet */}
          <button
            type="button"
            onClick={() => {
              const next = !mobilePickerOpen;
              setMobilePickerOpen(next);
              if (next) textareaRef.current?.blur();
              else textareaRef.current?.focus();
            }}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-colors sm:hidden",
              mobilePickerOpen
                ? "bg-foreground/10 text-foreground/75 ring-1 ring-foreground/20"
                : "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70",
            )}
            title={
              mobilePickerOpen
                ? "Show keyboard"
                : showMobileToolsTab
                  ? "Emoji, GIFs, stickers & tools"
                  : "Emoji, GIFs & stickers"
            }
            aria-label={
              mobilePickerOpen
                ? "Show keyboard"
                : showMobileToolsTab
                  ? "Emoji, GIFs, stickers, and tools"
                  : "Emoji, GIFs and stickers"
            }
          >
            {mobilePickerOpen ? <Keyboard size="1.25rem" /> : <Smile size="1.25rem" />}
          </button>

          <div className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => {
                setMobilePickerOpen((value) => !value);
              }}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                mobilePickerOpen
                  ? "bg-foreground/10 text-foreground/75 ring-1 ring-foreground/20"
                  : "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70",
              )}
              title={showMobileToolsTab ? "Emoji, GIFs, stickers & tools" : "Emoji, GIFs & stickers"}
              aria-label={showMobileToolsTab ? "Emoji, GIFs, stickers, and tools" : "Emoji, GIFs and stickers"}
              aria-expanded={mobilePickerOpen}
            >
              <Smile size="1.25rem" />
            </button>
            {mobilePickerOpen && (
              <ConversationMediaPickerPanel
                tabs={mobilePickerTabs}
                activeTab={mobilePickerTab}
                onActiveTabChange={setMobilePickerTab}
                onClose={() => setMobilePickerOpen(false)}
                onEmojiSelect={handleEmojiSelect}
                onGifSelect={handleGifSelect}
                onStickerSelect={handleStickerSelect}
                className="absolute bottom-full right-0 z-30 mb-4 w-[min(24rem,calc(100vw-1.5rem))]"
                toolsContent={mediaPickerToolsContent}
              />
            )}
          </div>

          {showDraftTranslateButton && (
            <button
              type="button"
              onClick={() => void handleTranslateDraft()}
              disabled={!activeChatId || !hasInput || isTranslatingDraft}
              className={cn(
                "hidden h-11 w-11 items-center justify-center rounded-full transition-colors sm:flex sm:h-8 sm:w-8",
                hasInput && !isTranslatingDraft
                  ? "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70"
                  : "text-foreground/25",
              )}
              title="Translate draft"
            >
              {isTranslatingDraft ? <Loader2 size="1rem" className="animate-spin" /> : <Languages size="1rem" />}
            </button>
          )}

          {speechToTextEnabled && (
            <SpeechToTextButton
              disabled={!activeChatId}
              onTranscript={handleSpeechTranscript}
              className="hidden rounded-full sm:flex"
              iconSize={16}
            />
          )}

          {showQuickRepliesMenu && quickReplyActions.length > 0 && (
            <div className="hidden sm:block">
              <QuickReplyMenu
                actions={quickReplyActions}
                disabled={!activeChatId || isReadingAttachments || (!hasInput && attachments.length === 0)}
              />
            </div>
          )}

          <button
            onClick={
              isActuallyGenerating
                ? () => useChatStore.getState().stopGeneration(activeChatId ?? undefined)
                : handleSend
            }
            disabled={!isActuallyGenerating && (isReadingAttachments || !activeChatId || !canSubmit)}
            aria-label={sendButtonTitle}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 sm:h-8 sm:w-8",
              isActuallyGenerating
                ? "text-foreground/75 hover:bg-foreground/10 hover:text-foreground/90"
                : canSubmit && !isReadingAttachments
                  ? "text-foreground/75 hover:bg-foreground/10 hover:text-foreground/90 active:scale-90"
                  : "text-foreground/20",
            )}
            title={sendButtonTitle}
          >
            {isActuallyGenerating ? (
              <StopCircle size="1rem" />
            ) : showRetrySendState ? (
              <RefreshCw size="0.9375rem" />
            ) : (
              <Send size="0.9375rem" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
