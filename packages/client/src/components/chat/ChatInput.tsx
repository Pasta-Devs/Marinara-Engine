// ──────────────────────────────────────────────
// Chat: Input — mode-aware styling
// ──────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect, useMemo, memo } from "react";
import {
  Send,
  Paperclip,
  StopCircle,
  X,
  Smile,
  Users,
  UserCheck,
  Languages,
  Loader2,
  FileText,
  WandSparkles,
  Swords,
} from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore } from "../../stores/ui.store";
import { useGenerate } from "../../hooks/use-generate";
import { useApplyRegex } from "../../hooks/use-apply-regex";
import { useCreateMessage, useDeleteMessage, useUpdateMessageExtra, chatKeys } from "../../hooks/use-chats";
import { characterKeys } from "../../hooks/use-characters";
import { buildGuidedGenerationInstructionMessage, formatTextQuotes, type Message } from "@marinara-engine/shared";
import {
  matchSlashCommand,
  getSlashCompletions,
  type SlashCommand,
  type SlashCommandContext,
} from "../../lib/slash-commands";
import { createInputMacroResolverForChat, isPromptPreviewMacro } from "../../lib/chat-macros";
import { parseChatMetadata } from "../../lib/chat-display";
import { cn, getAvatarCropStyle, type AvatarCropValue } from "../../lib/utils";
import { applyTextareaQuoteFormat } from "../../lib/textarea-quotes";
import { translateDraftText } from "../../lib/draft-translation";
import { prepareImageAttachment } from "../../lib/chat-attachment-images";
import { CARD_ASSET_INSERT_EVENT, type CardAssetInsertDetail } from "../../lib/card-asset-links";
import { requestChatScrollToBottom } from "../../lib/chat-scroll-events";
import { EmojiPicker } from "../ui/EmojiPicker";
import { SpeechToTextButton } from "../ui/SpeechToTextButton";
import { QuickConnectionSwitcher } from "./QuickConnectionSwitcher";
import { QuickPersonaSwitcher } from "./QuickPersonaSwitcher";
import { QuickSwitcherMobile } from "./QuickSwitcherMobile";
import { SlashCommandFeedback } from "./SlashCommandFeedback";
import { QuickReplyMenu, type QuickReplyAction } from "./QuickReplyMenu";
import { getChatInputShellClass } from "./chat-input-styles";

interface Attachment {
  type: string; // MIME type
  data: string; // base64 data URL
  name: string;
}

const EMPTY_RESPONSE_QUEUE: string[] = [];

type NarrativeDirectorMode = "natural" | "random";

const ROLEPLAY_AGENT_ACTION_BUTTON_CLASS =
  "flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs transition-all disabled:cursor-not-allowed disabled:opacity-50";

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

interface ChatInputProps {
  mode?: "conversation" | "roleplay";
  characterNames?: string[];
  groupResponseOrder?: string;
  chatCharacters?: Array<{
    id: string;
    name: string;
    avatarUrl: string | null;
    avatarCrop?: AvatarCropValue | null;
  }>;
  onExpressionChange?: (
    characterId: string,
    expression: string,
    options?: { immediate?: boolean },
  ) => void | Promise<void>;
  onPeekPrompt?: () => void;
  combatAgentEnabled?: boolean;
  onStartEncounter?: () => void;
}

export const ChatInput = memo(function ChatInput({
  mode = "conversation",
  characterNames = [],
  groupResponseOrder,
  chatCharacters,
  onExpressionChange,
  onPeekPrompt,
  combatAgentEnabled,
  onStartEncounter,
}: ChatInputProps) {
  const [hasInput, setHasInput] = useState(false);
  const [completions, setCompletions] = useState<SlashCommand[]>([]);
  const [selectedCompletion, setSelectedCompletion] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingAttachmentReadsByChat, setPendingAttachmentReadsByChat] = useState<Record<string, number>>({});
  const [isTranslatingDraft, setIsTranslatingDraft] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pushStoryArmed, setPushStoryArmed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [charPickerOpen, setCharPickerOpen] = useState(false);
  const charPickerBtnRef = useRef<HTMLButtonElement>(null);
  const charPickerMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const inputBarRef = useRef<HTMLDivElement>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attachmentsRef = useRef<Attachment[]>([]);
  const pendingAttachmentDraftsRef = useRef<Map<string, Attachment[]>>(new Map());
  const activeChatId = useChatStore((s) => s.activeChatId);
  const streamingChatId = useChatStore((s) => s.streamingChatId);
  const isStreamingGlobal = useChatStore((s) => s.isStreaming);
  const isStreaming = isStreamingGlobal && streamingChatId === activeChatId;
  const responseQueue = useChatStore((s) =>
    activeChatId ? (s.responseQueues.get(activeChatId) ?? EMPTY_RESPONSE_QUEUE) : EMPTY_RESPONSE_QUEUE,
  );
  const setInputDraft = useChatStore((s) => s.setInputDraft);
  const clearInputDraft = useChatStore((s) => s.clearInputDraft);
  const setCurrentInput = useChatStore((s) => s.setCurrentInput);
  const removeFromResponseQueue = useChatStore((s) => s.removeFromResponseQueue);
  const clearResponseQueue = useChatStore((s) => s.clearResponseQueue);
  const activeChat = useChatStore((s) => s.activeChat);
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
  const queuedResponseOrder = useMemo(
    () => new Map(responseQueue.map((characterId, index) => [characterId, index + 1])),
    [responseQueue],
  );
  const { generate } = useGenerate();
  const { applyToUserInput } = useApplyRegex();
  const enterToSend = useUIStore((s) => s.enterToSendRP);
  const guideGenerations = useUIStore((s) => s.guideGenerations);
  const showQuickRepliesMenu = useUIStore((s) => s.showQuickRepliesMenu);
  const showQuickReplyPostOnly = useUIStore((s) => s.showQuickReplyPostOnly);
  const showQuickReplyGuide = useUIStore((s) => s.showQuickReplyGuide);
  const showQuickReplyImpersonate = useUIStore((s) => s.showQuickReplyImpersonate);
  const speechToTextEnabled = useUIStore((s) => s.speechToTextEnabled);
  const quoteFormat = useUIStore((s) => s.quoteFormat);
  const createMessage = useCreateMessage(activeChatId);
  const deleteMessage = useDeleteMessage(activeChatId);
  const updateMessageExtra = useUpdateMessageExtra(activeChatId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resizeRafRef = useRef<number>(0);
  const qc = useQueryClient();
  const activeAgentIds = useMemo(
    () =>
      Array.isArray(chatMetadata.activeAgentIds)
        ? chatMetadata.activeAgentIds.filter((id): id is string => typeof id === "string")
        : [],
    [chatMetadata.activeAgentIds],
  );
  const narrativeDirectorActive =
    mode === "roleplay" && chatMetadata.enableAgents === true && activeAgentIds.includes("director");
  const combatActionActive =
    mode === "roleplay" && combatAgentEnabled === true && typeof onStartEncounter === "function";
  const showRoleplayAgentActions = narrativeDirectorActive || combatActionActive;
  const narrativeDirectorMode: NarrativeDirectorMode =
    chatMetadata.narrativeDirectorMode === "random" ? "random" : "natural";
  const consumeNarrativeDirectorMode = useCallback((): NarrativeDirectorMode | undefined => {
    if (!pushStoryArmed || !narrativeDirectorActive) return undefined;
    setPushStoryArmed(false);
    return narrativeDirectorMode;
  }, [narrativeDirectorActive, narrativeDirectorMode, pushStoryArmed]);
  const generateWithNarrativeDirector = useCallback(
    (params: Parameters<typeof generate>[0]) => {
      const directorMode = consumeNarrativeDirectorMode();
      return generate(directorMode ? { ...params, narrativeDirectorMode: directorMode } : params);
    },
    [consumeNarrativeDirectorMode, generate],
  );

  const syncInputState = useCallback(
    (value: string) => {
      setHasInput(value.trim().length > 0);
      setCurrentInput(value);
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
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
      syncInputState(nextValue);
      setInputDraft(activeChatId, nextValue);
      el.focus();
    },
    [activeChatId, setInputDraft, syncInputState],
  );

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

  // Restore draft when mounting or switching chats
  const prevChatIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevChatIdRef.current !== activeChatId) {
      // Save draft from the previous chat before switching
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
    }
    // Restore draft for the new active chat
    if (activeChatId && textareaRef.current) {
      const draft = useChatStore.getState().inputDrafts.get(activeChatId) ?? "";
      textareaRef.current.value = draft;
      syncInputState(draft);
      // Resize textarea to fit content
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
      const restoredAttachments = pendingAttachmentDraftsRef.current.get(activeChatId) ?? [];
      replaceAttachments(restoredAttachments);
      pendingAttachmentDraftsRef.current.delete(activeChatId);
    } else if (!activeChatId) {
      replaceAttachments([]);
    }
  }, [activeChatId, setInputDraft, clearInputDraft, syncInputState, replaceAttachments]);

  // Save draft when component unmounts (e.g. navigating to editor)
  useEffect(() => {
    const textarea = textareaRef.current;
    const chatId = useChatStore.getState().activeChatId;
    return () => {
      // Cancel pending debounce timers
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      // Cancel pending resize rAF
      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
      // Flush draft synchronously
      if (chatId && textarea) {
        const text = textarea.value;
        if (text.trim()) {
          useChatStore.getState().setInputDraft(chatId, text);
        } else {
          useChatStore.getState().clearInputDraft(chatId);
        }
      }
    };
  }, []);

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

  // Reactively derive the last message's role from the query cache.
  // Read directly from the cache to avoid creating a useQuery observer that
  // conflicts with the useInfiniteQuery observer in useChatMessages (mixing
  // useQuery and useInfiniteQuery on the same query key corrupts query state).
  // Subscribe to cache updates for the active chat so the send button enables
  // as soon as messages land (e.g. right after branching) without needing the
  // user to type to trigger a re-render.
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
  const canContinue =
    !isStreaming && mode === "roleplay" && groupResponseOrder !== "manual" && lastMessageRole === "assistant";
  const pendingAttachmentReads = activeChatId ? (pendingAttachmentReadsByChat[activeChatId] ?? 0) : 0;
  const isReadingAttachments = pendingAttachmentReads > 0;
  const hasPendingAttachments = isReadingAttachments || attachments.length > 0;
  const requiresManualGuideTarget = groupResponseOrder === "manual" && activeCharacterNames.length > 1;

  const removeAttachment = (idx: number) => {
    updateAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const originChatId = useChatStore.getState().activeChatId;
      if (!originChatId) return;

      const acceptedFiles = Array.from(files).filter((file) => {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 20 MB)`);
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !activeChatId) return;

    void addFiles(files);
    e.target.value = "";
  };

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
        void addFiles(files);
      }
    },
    [activeChatId, addFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (!activeChatId) return;
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) void addFiles(files);
    },
    [activeChatId, addFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only leave if we exit the container (not just enter a child)
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  // Get the current textarea value (always from the DOM directly)
  const getValue = () => textareaRef.current?.value ?? "";

  const buildContext = useCallback((): SlashCommandContext | null => {
    if (!activeChatId) return null;
    return {
      chatId: activeChatId,
      mode,
      generate: generateWithNarrativeDirector,
      createMessage: (data) => createMessage.mutate(data),
      invalidate: () => qc.invalidateQueries({ queryKey: chatKeys.all }),
      characterNames: activeCharacterNames,
      characters: activeChatCharacters,
      latestAssistantMessageId: latestAssistantMessage?.id ?? null,
      lastMessageRole,
      setSpriteExpression: onExpressionChange
        ? (characterId, expression) => onExpressionChange(characterId, expression, { immediate: true })
        : undefined,
    };
  }, [
    activeChatId,
    mode,
    generateWithNarrativeDirector,
    createMessage,
    activeCharacterNames,
    activeChatCharacters,
    latestAssistantMessage,
    lastMessageRole,
    onExpressionChange,
    qc,
  ]);

  const handleTogglePushStory = useCallback(() => {
    if (!narrativeDirectorActive || isStreaming) return;
    setPushStoryArmed((current) => {
      const next = !current;
      if (next) {
        toast.success(
          `The next time a character responds, they will push the story forward ${
            narrativeDirectorMode === "random" ? "randomly" : "naturally"
          }!`,
        );
      } else {
        toast.info("Push Story disarmed.");
      }
      return next;
    });
  }, [isStreaming, narrativeDirectorActive, narrativeDirectorMode]);

  const handleSend = useCallback(async () => {
    const raw = getValue();
    if (!activeChatId || isStreaming) return;
    if (isReadingAttachments) {
      toast.info("Still reading attached files. Send will be ready in a moment.");
      return;
    }
    // Cancel pending draft debounce so clearInputDraft isn't overwritten
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);

    const hasText = raw.trim().length > 0;
    const hasFiles = attachments.length > 0;

    // If input is empty, check if we should retry or continue
    if (!hasText && !hasFiles) {
      // Manual mode: no auto-retry/continue — use the character picker instead
      if (groupResponseOrder === "manual") return;
      const queuedCharacterId = groupResponseOrder === "smart" ? responseQueue[0] : null;
      if (queuedCharacterId) {
        removeFromResponseQueue(activeChatId, queuedCharacterId);
        try {
          await generateWithNarrativeDirector({
            chatId: activeChatId,
            connectionId: null,
            forCharacterId: queuedCharacterId,
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Generation failed";
          toast.error(msg);
        }
        return;
      }
      const cached = qc.getQueryData<InfiniteData<Message[]>>(chatKeys.messages(activeChatId));
      const firstPage = cached?.pages?.[0];
      const lastMsg = firstPage?.[firstPage.length - 1];
      if (lastMsg?.role === "user" || (mode === "roleplay" && lastMsg?.role === "assistant")) {
        // User-tail retries and assistant-tail empty sends both create a new reply.
        // Appending onto the previous assistant message remains explicit via /continue.
        try {
          await generateWithNarrativeDirector({
            chatId: activeChatId,
            connectionId: null,
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Generation failed";
          toast.error(msg);
        }
      }
      return;
    }

    const normalized = formatTextQuotes(raw.trim(), quoteFormat);

    if (isPromptPreviewMacro(normalized)) {
      if (textareaRef.current) {
        textareaRef.current.value = "";
        textareaRef.current.style.height = "auto";
      }
      syncInputState("");
      setCompletions([]);
      replaceAttachments([]);
      clearInputDraft(activeChatId);
      onPeekPrompt?.();
      return;
    }

    // Check for slash command
    const match = matchSlashCommand(normalized);
    if (match) {
      const ctx = buildContext();
      if (!ctx) return;

      const submittedDraft = textareaRef.current?.value ?? "";
      const submittedHeight = textareaRef.current?.style.height ?? "auto";
      const submittedAttachments = attachments;
      const submittedCompletions = completions;
      if (textareaRef.current) {
        textareaRef.current.value = "";
        textareaRef.current.style.height = "auto";
      }
      syncInputState("");
      setCompletions([]);
      replaceAttachments([]);
      clearInputDraft(activeChatId);

      try {
        const result = await match.command.execute(match.args, ctx);
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

    // Check if the chat has a connection configured
    const chat = useChatStore.getState().activeChat;
    if (chat && !chat.connectionId) {
      toast.error(
        "It looks like you haven't connected any model yet. Please head to Chat Settings in the top right corner to do that first!",
      );
      return;
    }

    const cachedCharacters = qc.getQueryData<Array<{ id: string; data: unknown }>>(characterKeys.list());
    const cachedPersonas = qc.getQueryData<Array<Record<string, unknown>>>(characterKeys.personas);
    const resolveInputMacros = createInputMacroResolverForChat(chat, cachedCharacters, cachedPersonas, normalized);
    const chatMeta = parseChatMetadata(chat?.metadata);
    let message = applyToUserInput(normalized, {
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

    message = resolveInputMacros(message);

    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.style.height = "auto";
    }
    syncInputState("");
    setCompletions([]);
    const pendingAttachments = attachments.map((a) => ({ type: a.type, data: a.data, filename: a.name, name: a.name }));
    replaceAttachments([]);
    clearInputDraft(activeChatId);
    clearResponseQueue(activeChatId);

    // Manual mode: only create the user message, no auto-generation
    if (groupResponseOrder === "manual") {
      try {
        const created = await createMessage.mutateAsync({
          role: "user",
          content: message,
          characterId: null,
        });
        requestChatScrollToBottom({ chatId: activeChatId, behavior: "auto" });
        if (pendingAttachments.length) {
          await updateMessageExtra.mutateAsync({
            messageId: created.id,
            extra: { attachments: pendingAttachments },
          });
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Failed to send message";
        toast.error(msg);
      }
      return;
    }

    try {
      await generateWithNarrativeDirector({
        chatId: activeChatId,
        connectionId: null,
        userMessage: message,
        ...(pendingAttachments.length ? { attachments: pendingAttachments } : {}),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Generation failed";
      toast.error(msg);
      console.error("Send failed:", error);
    }
  }, [
    activeChatId,
    mode,
    isStreaming,
    generateWithNarrativeDirector,
    applyToUserInput,
    buildContext,
    qc,
    clearInputDraft,
    attachments,
    isReadingAttachments,
    groupResponseOrder,
    responseQueue,
    removeFromResponseQueue,
    clearResponseQueue,
    createMessage,
    updateMessageExtra,
    syncInputState,
    replaceAttachments,
    updateAttachments,
    setInputDraft,
    completions,
    onPeekPrompt,
    quoteFormat,
  ]);

  const runQuickSlashCommand = useCallback(
    async (commandLine: string, fallbackError: string) => {
      if (!activeChatId) return;
      const submittingChatId = activeChatId;
      const match = matchSlashCommand(commandLine);
      const baseCtx = buildContext();
      if (!match || !baseCtx) return;
      const generationStatus: { succeeded?: boolean } = {};
      const ctx: SlashCommandContext = {
        ...baseCtx,
        generate: async (params) => {
          const succeeded = await baseCtx.generate(params);
          if (succeeded !== undefined) generationStatus.succeeded = succeeded;
          return succeeded;
        },
      };

      const previousDraft = textareaRef.current?.value ?? "";
      const previousHeight = textareaRef.current?.style.height ?? "auto";
      const previousCompletions = completions;
      const restoreSubmittedDraft = () => {
        const currentValue = textareaRef.current?.value ?? "";
        const canRestoreVisibleDraft =
          useChatStore.getState().activeChatId === submittingChatId && currentValue.length === 0;
        if (canRestoreVisibleDraft && textareaRef.current) {
          textareaRef.current.value = previousDraft;
          textareaRef.current.style.height = previousHeight;
          syncInputState(previousDraft);
          setCompletions(previousCompletions);
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
      syncInputState("");
      setCompletions([]);
      clearInputDraft(submittingChatId);

      try {
        const result = await match.command.execute(match.args, ctx);
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
    [activeChatId, buildContext, clearInputDraft, completions, setInputDraft, syncInputState],
  );

  const handleImpersonateQuickButton = useCallback(async () => {
    if (!activeChatId || isStreaming) return;
    if (hasPendingAttachments) {
      toast.info("Clear or send attachments before using quick impersonate.");
      return;
    }
    const text = textareaRef.current?.value?.trim() ?? "";
    if (!text) return;
    await runQuickSlashCommand(`/impersonate ${text}`, "Impersonate failed");
  }, [activeChatId, isStreaming, hasPendingAttachments, runQuickSlashCommand]);

  const handlePostOnlyButton = useCallback(async () => {
    if (!activeChatId || isStreaming) return;
    const submittingChatId = activeChatId;
    if (isReadingAttachments) {
      toast.info("Still reading attached files. Post will be ready in a moment.");
      return;
    }
    const raw = textareaRef.current?.value ?? "";
    const hasText = raw.trim().length > 0;
    const hasFiles = attachments.length > 0;
    if (!hasText && !hasFiles) return;

    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }

    const normalized = formatTextQuotes(raw.trim(), quoteFormat);
    const chat = useChatStore.getState().activeChat;
    const cachedCharacters = qc.getQueryData<Array<{ id: string; data: unknown }>>(characterKeys.list());
    const cachedPersonas = qc.getQueryData<Array<Record<string, unknown>>>(characterKeys.personas);
    const resolveInputMacros = createInputMacroResolverForChat(chat, cachedCharacters, cachedPersonas, normalized);
    const chatMeta = parseChatMetadata(chat?.metadata);
    let message = applyToUserInput(normalized, {
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
    syncInputState("");
    setCompletions([]);
    replaceAttachments([]);
    clearInputDraft(submittingChatId);
    clearResponseQueue(submittingChatId);

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
    applyToUserInput,
    qc,
    syncInputState,
    clearInputDraft,
    setInputDraft,
    replaceAttachments,
    updateAttachments,
    createMessage,
    deleteMessage,
    updateMessageExtra,
    clearResponseQueue,
    quoteFormat,
  ]);

  const handleGuidedGenerationButton = useCallback(async () => {
    if (!activeChatId || isStreaming) return;
    if (requiresManualGuideTarget) {
      toast.info("Choose a character from the reply picker to guide a specific reply.");
      return;
    }
    if (hasPendingAttachments) {
      toast.info("Clear or send attachments before using guided generation.");
      return;
    }
    const text = textareaRef.current?.value?.trim() ?? "";
    if (!text) return;
    await runQuickSlashCommand(`/guided ${text}`, "Guided generation failed");
  }, [activeChatId, isStreaming, requiresManualGuideTarget, hasPendingAttachments, runQuickSlashCommand]);

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
      if (requiresManualGuideTarget) return "Choose a character from the reply picker.";
      if (hasPendingAttachments) return "Clear or post attachments first.";
      if (!hasInput) return "Type a direction first.";
      return undefined;
    };
    const getImpersonateDisabledReason = () => {
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
        disabled: !activeChatId || isStreaming || requiresManualGuideTarget || !hasInput || hasPendingAttachments,
        disabledReason: getGuideDisabledReason(),
        onSelect: handleGuidedGenerationButton,
      });
    }
    if (showQuickReplyImpersonate) {
      actions.push({
        id: "impersonate",
        label: "Impersonate",
        description: "Generate as your persona",
        icon: <UserCheck size="0.875rem" />,
        disabled: !activeChatId || isStreaming || !hasInput || hasPendingAttachments,
        disabledReason: getImpersonateDisabledReason(),
        onSelect: handleImpersonateQuickButton,
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
    requiresManualGuideTarget,
    showQuickReplyPostOnly,
    showQuickReplyGuide,
    showQuickReplyImpersonate,
    handlePostOnlyButton,
    handleGuidedGenerationButton,
    handleImpersonateQuickButton,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Autocomplete navigation
    if (completions.length > 0) {
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        const cmd = completions[selectedCompletion];
        if (cmd && textareaRef.current) {
          textareaRef.current.value = `/${cmd.name} `;
          handleInput();
        }
        setCompletions([]);
        setSelectedCompletion(0);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCompletion((prev) => (prev > 0 ? prev - 1 : completions.length - 1));
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCompletion((prev) => (prev < completions.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === "Escape") {
        setCompletions([]);
        setSelectedCompletion(0);
        return;
      }
    }

    if (enterToSend && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    const fixed = applyTextareaQuoteFormat(el, quoteFormat);
    const nowHasInput = fixed.trim().length > 0;
    setHasInput((prev) => (prev === nowHasInput ? prev : nowHasInput));

    // Keep draft in sync so it survives remounts (debounced to avoid store churn)
    if (activeChatId) {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      const chatId = activeChatId;
      const text = fixed;
      setCurrentInput(text);
      draftTimerRef.current = setTimeout(() => {
        if (text.trim()) {
          setInputDraft(chatId, text);
        } else {
          clearInputDraft(chatId);
        }
      }, 300);
    }

    // Auto-resize textarea — batched via rAF to avoid layout thrashing on
    // every keystroke while still responding within the same visual frame.
    if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
    resizeRafRef.current = requestAnimationFrame(() => {
      if (!el) return;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    });

    // Slash command autocomplete
    const trimmed = fixed.trim();
    if (trimmed.startsWith("/") && !trimmed.includes(" ")) {
      const matches = getSlashCompletions(trimmed);
      setCompletions(matches);
      setSelectedCompletion(0);
    } else {
      setCompletions((prev) => (prev.length === 0 ? prev : []));
    }
  };

  // Dismiss feedback on new input
  useEffect(() => {
    if (hasInput && feedback) setFeedback(null);
  }, [hasInput, feedback]);

  const _isRP = mode === "roleplay";

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      if (!textareaRef.current) return;
      const el = textareaRef.current;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const value = el.value;
      el.value = value.slice(0, start) + emoji + value.slice(end);
      el.selectionStart = el.selectionEnd = start + emoji.length;
      syncInputState(el.value);
      el.focus();
    },
    [syncInputState],
  );

  // Character picker: trigger a response from a specific character (manual mode)
  const handleCharacterResponse = useCallback(
    async (characterId: string) => {
      if (!activeChatId || isStreaming) return;
      setCharPickerOpen(false);
      setCharPickerPos(null);
      if (responseQueue.includes(characterId)) {
        removeFromResponseQueue(activeChatId, characterId);
      }
      const guideText = getValue();
      try {
        await generateWithNarrativeDirector(
          guideGenerations && hasInput
            ? {
                chatId: activeChatId,
                connectionId: null,
                forCharacterId: characterId,
                generationGuide: buildGuidedGenerationInstructionMessage(guideText),
                generationGuideSource: "guide",
              }
            : { chatId: activeChatId, connectionId: null, forCharacterId: characterId },
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Generation failed";
        toast.error(msg);
      }
    },
    [
      activeChatId,
      isStreaming,
      generateWithNarrativeDirector,
      hasInput,
      guideGenerations,
      responseQueue,
      removeFromResponseQueue,
    ],
  );

  // Close character picker on outside click
  useEffect(() => {
    if (!charPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        charPickerMenuRef.current &&
        !charPickerMenuRef.current.contains(e.target as Node) &&
        charPickerBtnRef.current &&
        !charPickerBtnRef.current.contains(e.target as Node)
      ) {
        setCharPickerOpen(false);
        setCharPickerPos(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [charPickerOpen]);

  // Position character picker above button
  const [charPickerPos, setCharPickerPos] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!charPickerOpen || !charPickerBtnRef.current) return;
    const rect = charPickerBtnRef.current.getBoundingClientRect();
    const inputBox = charPickerBtnRef.current.closest(".rounded-2xl") as HTMLElement | null;
    const anchorTop = inputBox ? inputBox.getBoundingClientRect().top : rect.top;
    requestAnimationFrame(() => {
      const menuEl = charPickerMenuRef.current;
      const menuHeight = menuEl?.offsetHeight || 300;
      const menuWidth = menuEl?.offsetWidth || 220;
      // Right-align the dropdown with the right edge of the button
      let left = rect.right - menuWidth;
      if (left < 8) left = 8;
      setCharPickerPos({ left, top: Math.max(8, anchorTop - menuHeight - 4) });
    });
  }, [charPickerOpen]);

  const showCharPicker = !!activeChatCharacters && activeChatCharacters.length > 1 && !!groupResponseOrder;
  const showDraftTranslateButton = chatMetadata.showInputTranslateButton === true;

  const handleTranslateDraft = useCallback(async () => {
    if (!activeChatId || isTranslatingDraft) return;
    const raw = getValue();
    if (!raw.trim()) return;

    setIsTranslatingDraft(true);
    try {
      const translated = await translateDraftText(raw);
      if (!translated || !textareaRef.current) return;
      const formatted = formatTextQuotes(translated, quoteFormat);
      textareaRef.current.value = formatted;
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
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
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
      syncInputState(nextValue);
      if (activeChatId) setInputDraft(activeChatId, nextValue);
      el.focus();
    },
    [activeChatId, quoteFormat, setInputDraft, syncInputState],
  );

  const ensureInputVisible = useCallback(() => {
    const scroll = () => inputBarRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    requestAnimationFrame(scroll);
    window.setTimeout(scroll, 260);
  }, []);

  return (
    <div className="mari-chat-input chat-input-container px-3 pb-3">
      {/* Slash command autocomplete popup */}
      {completions.length > 0 && (
        <div className="mb-2 max-h-[min(18rem,45dvh)] overflow-y-auto rounded-xl border border-foreground/10 bg-[var(--card)] shadow-xl backdrop-blur-xl [-webkit-overflow-scrolling:touch]">
          {completions.map((cmd, i) => (
            <button
              key={cmd.name}
              onMouseDown={(e) => {
                e.preventDefault();
                if (textareaRef.current) {
                  textareaRef.current.value = `/${cmd.name} `;
                  handleInput();
                  textareaRef.current.focus();
                }
                setCompletions([]);
              }}
              className={cn(
                "flex w-full min-w-0 items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                i === selectedCompletion
                  ? "bg-foreground/10 text-foreground"
                  : "text-foreground/70 hover:bg-foreground/5",
              )}
            >
              <span className="shrink-0 whitespace-nowrap font-mono font-semibold text-foreground/80">/{cmd.name}</span>
              <span className="min-w-0 flex-1 text-xs leading-snug opacity-60 [overflow-wrap:anywhere]">
                {cmd.description}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Feedback toast */}
      {feedback && <SlashCommandFeedback feedback={feedback} onDismiss={() => setFeedback(null)} className="mb-2" />}

      {showRoleplayAgentActions && (
        <div className="flex flex-wrap justify-center gap-2 py-1">
          {narrativeDirectorActive && (
            <button
              type="button"
              onClick={handleTogglePushStory}
              disabled={isStreaming}
              aria-pressed={pushStoryArmed}
              className={cn(
                ROLEPLAY_AGENT_ACTION_BUTTON_CLASS,
                pushStoryArmed
                  ? "bg-foreground/10 text-foreground ring-1 ring-foreground/25"
                  : "text-foreground/50 hover:bg-foreground/10 hover:text-foreground/80",
              )}
              title={
                narrativeDirectorMode === "random"
                  ? "Arm a random Narrative Director event for the next response"
                  : "Arm a natural Narrative Director push for the next response"
              }
            >
              <WandSparkles size="0.875rem" />
              <span>Push Story</span>
            </button>
          )}
          {combatActionActive && (
            <button
              type="button"
              onClick={() => onStartEncounter?.()}
              disabled={isStreaming}
              className={cn(
                ROLEPLAY_AGENT_ACTION_BUTTON_CLASS,
                "text-foreground/50 hover:bg-foreground/10 hover:text-foreground/80 disabled:hover:bg-transparent disabled:hover:text-foreground/50",
              )}
              title="Start Combat Encounter"
            >
              <Swords size="0.875rem" />
              <span>Encounter</span>
            </button>
          )}
        </div>
      )}

      {/* Attachment previews */}
      {(attachments.length > 0 || isReadingAttachments) && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((att, i) => (
            <div
              key={i}
              className="group relative flex items-center gap-1.5 rounded-lg bg-foreground/10 px-2 py-1 text-xs text-foreground/70 ring-1 ring-foreground/10"
            >
              {att.type.startsWith("image/") ? (
                <img src={att.data} alt={att.name} className="h-8 w-8 rounded object-cover" />
              ) : (
                <FileText
                  size="1rem"
                  className={cn(
                    "shrink-0",
                    att.type === PDF_ATTACHMENT_MIME_TYPE ? "text-[var(--primary)]" : "text-foreground/50",
                  )}
                />
              )}
              <span className="max-w-[7.5rem] truncate">{att.name}</span>
              <button
                onClick={() => removeAttachment(i)}
                className="ml-0.5 rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100"
              >
                <X size="0.75rem" />
              </button>
            </div>
          ))}
          {isReadingAttachments && (
            <div className="flex items-center gap-1.5 rounded-lg bg-foreground/10 px-2 py-1 text-xs text-foreground/60 ring-1 ring-foreground/10">
              <Loader2 size="0.875rem" className="animate-spin" />
              Reading file...
            </div>
          )}
        </div>
      )}

      {/* Main input container */}
      <div
        ref={inputBarRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={getChatInputShellClass({
          dragging: isDragging,
          hasContent: hasInput || attachments.length > 0,
          layout: "roleplay",
        })}
      >
        {/* Attachment button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf,.pdf,.txt,.md,.markdown,.json,.jsonl,.csv,.log,.xml,.yaml,.yml"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!activeChatId}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl transition-all active:scale-90 disabled:cursor-not-allowed disabled:text-foreground/25 disabled:opacity-50 sm:h-8 sm:w-8",
            attachments.length
              ? "bg-foreground/10 text-foreground/75 ring-1 ring-foreground/20"
              : "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70",
          )}
          title="Attach files"
        >
          <Paperclip size="1rem" />
        </button>

        {/* Quick Switchers — desktop: inline, mobile: chevron */}
        <QuickConnectionSwitcher className="hidden sm:flex" />
        <QuickPersonaSwitcher className="hidden sm:flex" />
        <div className="sm:hidden">
          <QuickSwitcherMobile />
        </div>

        {/* Text input */}
        <textarea
          ref={textareaRef}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={ensureInputVisible}
          placeholder={
            activeChatId
              ? mode === "roleplay"
                ? "Write your response, / for commands"
                : activeCharacterNames.length > 0
                  ? activeCharacterNames.length > 1
                    ? `Message @${activeCharacterNames.join(", @")}, / for commands`
                    : `Message @${activeCharacterNames[0]}, / for commands`
                  : "Type here, / for commands."
              : "Select a chat first"
          }
          disabled={!activeChatId}
          rows={1}
          spellCheck
          autoCorrect="on"
          className="mari-chat-input-textarea max-h-[12.5rem] min-w-0 flex-1 resize-none bg-transparent py-0 text-sm leading-normal text-foreground/90 placeholder:text-foreground/30 outline-none disabled:cursor-not-allowed disabled:opacity-40"
        />

        {/* Emoji picker */}
        <div className="relative shrink-0">
          <button
            ref={emojiButtonRef}
            onClick={() => setEmojiOpen((v) => !v)}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl transition-colors active:scale-90 sm:h-8 sm:w-8 sm:rounded-full",
              emojiOpen
                ? "bg-foreground/10 text-foreground/75 ring-1 ring-foreground/20"
                : "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70",
            )}
            title="Emoji"
            aria-label="Emoji"
          >
            <Smile size="1.125rem" />
          </button>
          <EmojiPicker
            open={emojiOpen}
            onClose={() => setEmojiOpen(false)}
            onSelect={handleEmojiSelect}
            anchorRef={emojiButtonRef}
            containerRef={inputBarRef}
          />
        </div>

        {/* Character picker — shown in group chats for manual response triggering */}
        {showCharPicker && (
          <button
            ref={charPickerBtnRef}
            onClick={() => setCharPickerOpen((v) => !v)}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full transition-colors sm:h-8 sm:w-8",
              guideGenerations && hasInput
                ? "bg-foreground/10 text-foreground/75 ring-1 ring-foreground/20 hover:bg-foreground/15"
                : charPickerOpen
                  ? "bg-foreground/10 text-foreground/75 ring-1 ring-foreground/20"
                  : "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70",
            )}
            title={guideGenerations && hasInput ? "Trigger character response (guided)" : "Trigger character response"}
          >
            <Users size="1rem" />
          </button>
        )}

        {showDraftTranslateButton && (
          <button
            type="button"
            onClick={() => void handleTranslateDraft()}
            disabled={!activeChatId || !hasInput || isStreaming || isTranslatingDraft}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-200 sm:h-8 sm:w-8",
              hasInput && !isStreaming && !isTranslatingDraft
                ? "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70 active:scale-90"
                : "text-foreground/25",
            )}
            title="Translate draft"
          >
            {isTranslatingDraft ? <Loader2 size="0.9375rem" className="animate-spin" /> : <Languages size="1rem" />}
          </button>
        )}

        {speechToTextEnabled && (
          <SpeechToTextButton
            disabled={!activeChatId}
            onTranscript={handleSpeechTranscript}
            className="rounded-full"
            iconSize={16}
          />
        )}

        {showQuickRepliesMenu && quickReplyActions.length > 0 && (
          <QuickReplyMenu
            actions={quickReplyActions}
            disabled={!activeChatId || isReadingAttachments}
          />
        )}

        {/* Send / Stop button */}

        <button
          onClick={isStreaming ? () => useChatStore.getState().stopGeneration(activeChatId ?? undefined) : handleSend}
          disabled={
            (!isStreaming && isReadingAttachments) ||
            (!hasInput && !attachments.length && !isStreaming && !canRetry && !canContinue) ||
            !activeChatId
          }
          className={cn(
            "mari-chat-send-btn flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-200 sm:h-8 sm:w-8",
            isStreaming
              ? "text-foreground/75 hover:bg-foreground/10 hover:text-foreground/90"
              : (hasInput || attachments.length || canRetry || canContinue) && activeChatId && !isReadingAttachments
                ? "text-foreground/75 hover:bg-foreground/10 hover:text-foreground/90 active:scale-90"
                : "text-foreground/20",
          )}
        >
          {isStreaming ? (
            <StopCircle size="1rem" />
          ) : (
            <Send size="0.9375rem" className={cn(hasInput && "translate-x-[1px]")} />
          )}
        </button>
      </div>

      {/* Character picker dropdown (portal) */}
      {charPickerOpen &&
        showCharPicker &&
        createPortal(
          <div
            ref={charPickerMenuRef}
            className="fixed z-[9999] flex min-w-[220px] max-w-[280px] max-h-[320px] flex-col overflow-hidden rounded-xl border border-foreground/10 bg-[var(--card)] shadow-2xl"
            style={
              charPickerPos ? { left: charPickerPos.left, top: charPickerPos.top } : { visibility: "hidden" as const }
            }
          >
            <div className="flex items-center justify-center border-b border-foreground/10 px-3 py-2 text-[0.6875rem] font-semibold">
              Trigger Response
            </div>
            <div className="overflow-y-auto p-1">
              {activeChatCharacters!.map((char) => {
                const queuedOrder = queuedResponseOrder.get(char.id);
                return (
                  <button
                    key={char.id}
                    onClick={() => handleCharacterResponse(char.id)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-foreground/10"
                  >
                    {char.avatarUrl ? (
                      <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full">
                        <img
                          src={char.avatarUrl}
                          alt={char.name}
                          className="h-full w-full object-cover"
                          style={getAvatarCropStyle(char.avatarCrop)}
                        />
                      </span>
                    ) : (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-[0.6875rem] font-semibold text-foreground/45">
                        {(char.name || "?")[0].toUpperCase()}
                      </div>
                    )}
                    <span className="min-w-0 flex-1 truncate text-xs">{char.name}</span>
                    {queuedOrder && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-foreground/15 bg-foreground/10 px-1 text-[0.625rem] font-semibold text-foreground/70">
                        {queuedOrder}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
});
