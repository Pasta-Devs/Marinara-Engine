// ──────────────────────────────────────────────
// Chat: Message — mode-aware rendering
// ──────────────────────────────────────────────
import {
  cn,
  copyToClipboard,
  getAvatarCropStyle,
  parseAvatarCropJson,
  type AvatarCropValue,
} from "../../../../../shared/lib/utils";
import { applyInlineMarkdown, renderMarkdownBlocks, applyInlineMarkdownHTML } from "../../../../../shared/lib/markdown";
import {
  User,
  Bot,
  Copy,
  RefreshCw,
  Trash2,
  GitBranch,
  Pencil,
  Check,
  X,
  Flag,
  Eye,
  EyeOff,
  Search,
  ChevronRight,
  ScrollText,
  Brain,
  Languages,
  Volume2,
  VolumeX,
  Loader2,
  Pause,
  Play,
  Timer,
} from "lucide-react";
import type { Message, MessageExtra, MessageSwipe } from "../../../../../engine/contracts/types/chat";
import {
  memo,
  useState,
  useMemo,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { chatKeys } from "../../../../catalog/chats/index";
import { useShallow } from "zustand/react/shallow";
import { useChatStore } from "../../../../../shared/stores/chat.store";
import { createMessageMacroResolver } from "../../../../../shared/lib/chat-macros";
import { useApplyRegex } from "../../../../catalog/agents/regex-application";
import { useUIStore } from "../../../../../shared/stores/ui.store";
import { playTextBlip } from "../../../../../shared/lib/text-blip-sound";
import { useTranslate } from "../../../../../shared/hooks/use-translate";
import { storageApi } from "../../../../../shared/api/storage-api";
import { ttsService } from "../../../../../shared/lib/tts-service";
import { useCachedTTSConfig } from "../../../../../shared/hooks/use-tts";
import { isStreamingTTSActive, stopStreamingTTS, subscribeStreamingTTSActive } from "../hooks/use-streaming-tts";
import { buildTTSVoiceRequests, clientSidePlaybackRate } from "../../../../../shared/lib/tts-dialogue";
import {
  DIALOGUE_QUOTE_PATTERN_SOURCE,
  HTML_SAFE_DIALOGUE_QUOTE_PATTERN_SOURCE,
  formatTextQuotes,
  type QuoteFormat,
} from "../../../../../shared/lib/dialogue-quotes";
import DOMPurify from "dompurify";
import type {
  CharacterMap,
  ExpressionAvatarResolver,
  MessageSelectionToggle,
  PeekPromptOptions,
  PersonaInfo,
  RegenerateOptions,
} from "../types";
import { GenerationReplayDetailsModal, hasGenerationReplayDetails } from "./GenerationReplayDetailsModal";
import { ImagePromptPanel } from "./ImagePromptPanel";
import { SwipeJumpControl } from "./SwipeJumpControl";
import { readStoredThinking } from "../lib/message-thinking";
import {
  isImageMessageAttachment,
  messageAttachmentImageAlt,
  messageAttachmentImageSource,
  messageAttachmentsFromExtra,
} from "../lib/message-attachments";
import { resolvePromptSnapshotFromExtra } from "../lib/prompt-snapshot";
import { ResolvedAvatarImage } from "./ResolvedAvatarImage";
import { resolveAvatarFileUrl } from "../../../../../shared/api/local-file-api";

const MESSAGE_ACTION_ICON_SIZE = "1em";
const MESSAGE_SWIPE_ICON_SIZE = "1.15em";
const MESSAGE_EDIT_GESTURE_IGNORE_SELECTOR =
  "button, a, textarea, input, select, label, [role='button'], [contenteditable='true'], .mari-message-actions";
type ChatMessageExtra = Partial<MessageExtra> & { hiddenFromAi?: unknown };
const EMPTY_CHAT_MESSAGE_EXTRA: ChatMessageExtra = {};

function formatEditableMessageText(value: string, quoteFormat: QuoteFormat): string {
  return formatTextQuotes(value, quoteFormat);
}

type GenerationLabelRecord = Record<string, unknown>;

function generationRecord(value: unknown): GenerationLabelRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as GenerationLabelRecord) : null;
}

function generationString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function generationNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstGenerationString(records: readonly GenerationLabelRecord[], keys: readonly string[]): string | null {
  for (const record of records) {
    for (const key of keys) {
      const value = generationString(record[key]);
      if (value) return value;
    }
  }
  return null;
}

function firstGenerationNumber(records: readonly GenerationLabelRecord[], keys: readonly string[]): number | null {
  for (const record of records) {
    for (const key of keys) {
      const value = generationNumber(record[key]);
      if (value != null) return value;
    }
    const usage = generationRecord(record.usage);
    if (!usage) continue;
    for (const key of keys) {
      const value = generationNumber(usage[key]);
      if (value != null) return value;
    }
  }
  return null;
}

function generationRecordsForMessage(message: Message): GenerationLabelRecord[] {
  const extra = generationRecord(message.extra);
  const snapshot = generationRecord(extra?.generationPromptSnapshot);
  return [
    generationRecord(extra?.generationInfo),
    generationRecord(snapshot?.generationInfo),
    generationRecord((message as Message & { generationInfo?: unknown }).generationInfo),
  ].filter((record): record is GenerationLabelRecord => !!record);
}

function formatGenerationDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, durationMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
  const roundedSeconds = Math.round(totalSeconds);
  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function generationDurationMsForMessage(message: Message): number | null {
  if (message.role === "user") return null;
  const records = generationRecordsForMessage(message);
  if (records.length === 0) return null;
  const durationMs = firstGenerationNumber(records, ["durationMs", "duration_ms"]);
  return durationMs != null && durationMs > 0 ? durationMs : null;
}

function formatGenerationLabelForMessage(
  message: Message,
  showModelName: boolean,
  showTokenUsage: boolean,
): string | null {
  if (message.role === "user" || (!showModelName && !showTokenUsage)) return null;
  const records = generationRecordsForMessage(message);
  if (records.length === 0) return null;

  const parts: string[] = [];
  if (showModelName) {
    const model = firstGenerationString(records, ["model", "modelName"]);
    if (model) parts.push(model);
  }
  if (showTokenUsage) {
    const tokensPrompt = firstGenerationNumber(records, [
      "tokensPrompt",
      "promptTokens",
      "prompt_tokens",
      "inputTokens",
      "input_tokens",
    ]);
    const tokensCompletion = firstGenerationNumber(records, [
      "tokensCompletion",
      "completionTokens",
      "completion_tokens",
      "outputTokens",
      "output_tokens",
    ]);
    const tokensCachedPrompt = firstGenerationNumber(records, [
      "tokensCachedPrompt",
      "cachedPromptTokens",
      "cached_prompt_tokens",
      "cacheReadInputTokens",
      "cache_read_input_tokens",
    ]);
    const tokensCacheWritePrompt = firstGenerationNumber(records, [
      "tokensCacheWritePrompt",
      "cacheWritePromptTokens",
      "cache_write_prompt_tokens",
      "cacheCreationInputTokens",
      "cache_creation_input_tokens",
    ]);
    const durationMs = firstGenerationNumber(records, ["durationMs", "duration_ms"]);

    if (tokensPrompt != null || tokensCompletion != null) {
      parts.push(
        tokensPrompt != null ? `${tokensPrompt}\u2192${tokensCompletion ?? "?"} tok` : `${tokensCompletion} tok`,
      );
    }
    if ((tokensCachedPrompt ?? 0) > 0) parts.push(`cache hit ${tokensCachedPrompt!.toLocaleString()}`);
    if ((tokensCacheWritePrompt ?? 0) > 0) parts.push(`cache write ${tokensCacheWritePrompt!.toLocaleString()}`);
    if (durationMs != null) parts.push(`${(durationMs / 1000).toFixed(1)}s`);
  }

  return parts.length > 0 ? parts.join(" \u00b7 ") : null;
}

function HiddenFromAIBadge({
  roleplay,
  canCollapse,
  isExpanded,
  onToggle,
}: {
  roleplay?: boolean;
  canCollapse: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const className = cn(
    "inline-flex items-center gap-1 rounded px-1 py-0.5 text-[0.625rem] font-medium text-amber-500/80",
    roleplay && "text-amber-200/60",
    canCollapse && "transition-colors hover:bg-amber-500/10 hover:text-amber-400",
  );
  if (!canCollapse) {
    return (
      <span className={className} title="Hidden from AI">
        <EyeOff size="0.7rem" />
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={className}
      title={isExpanded ? "Collapse hidden from AI message" : "Expand hidden from AI message"}
      aria-label={isExpanded ? "Collapse hidden from AI message" : "Expand hidden from AI message"}
    >
      <ChevronRight size="0.7rem" className={cn("transition-transform", isExpanded && "rotate-90")} />
      <EyeOff size="0.7rem" />
    </button>
  );
}

/** Isolated edit textarea — uncontrolled to avoid React re-renders on every keystroke. */
const EditTextarea = memo(function EditTextarea({
  initialContent,
  fontSize,
  quoteFormat,
  onSave,
  onCancel,
}: {
  initialContent: string;
  fontSize: string | number | undefined;
  quoteFormat: QuoteFormat;
  onSave: (content: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoResize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // Find the nearest scrollable ancestor so we can freeze its scroll
    // position while we re-measure the textarea height.
    const scroller = el.closest("[data-chat-scroll]") as HTMLElement | null;
    const scrollTop = scroller?.scrollTop ?? 0;
    el.style.height = "0";
    el.style.height = el.scrollHeight + "px";
    if (scroller) scroller.scrollTop = scrollTop;
  }, []);

  useLayoutEffect(() => {
    if (ref.current) {
      autoResize();
      ref.current.focus({ preventScroll: true });
    }
  }, [autoResize]);

  const handleSave = useCallback(async () => {
    if (!ref.current || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(formatEditableMessageText(ref.current.value, quoteFormat));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save edit.");
    } finally {
      setSaving(false);
    }
  }, [onSave, quoteFormat, saving]);

  const handleInput = useCallback(
    (event: FormEvent<HTMLTextAreaElement>) => {
      const el = event.currentTarget;
      const raw = el.value;
      const normalized = formatEditableMessageText(raw, quoteFormat);
      if (normalized !== raw) {
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const direction = el.selectionDirection;
        el.value = normalized;
        el.setSelectionRange(start, end, direction);
      }
      autoResize();
    },
    [autoResize, quoteFormat],
  );

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={ref}
        defaultValue={formatEditableMessageText(initialContent, quoteFormat)}
        rows={1}
        onInput={handleInput}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleSave();
          if (e.key === "Escape" && !saving) onCancel();
        }}
        disabled={saving}
        className="w-full resize-none overflow-y-hidden rounded-lg bg-black/30 px-3 py-2 text-white outline-none ring-1 ring-white/20 focus:ring-blue-400/50"
        style={{ fontSize, lineHeight: 1.5 }}
      />
      {error && <div className="text-[0.6875rem] text-red-300/90">{error}</div>}
      <div className="flex items-center gap-1.5 justify-end">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel edit"
          disabled={saving}
          className="rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white/70"
          title="Cancel (Esc)"
        >
          <X size="0.8125rem" />
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          aria-label="Save edit"
          disabled={saving}
          className="rounded-md p-1 text-emerald-400/70 hover:bg-emerald-400/10 hover:text-emerald-400"
          title="Save (Cmd+Enter)"
        >
          {saving ? <Loader2 size="0.8125rem" className="animate-spin" /> : <Check size="0.8125rem" />}
        </button>
      </div>
    </div>
  );
});

/** Props for a single rendered chat message, including optional scene fork actions. */
interface ChatMessageProps {
  message: Message & {
    swipes?: Array<{ id?: string; content: string; characterId?: string | null; extra?: MessageSwipe["extra"] }>;
  };
  isStreaming?: boolean;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string, options?: RegenerateOptions) => void;
  onEdit?: (messageId: string, content: string) => void | Promise<void>;
  onSetActiveSwipe?: (messageId: string, index: number) => void;
  onToggleConversationStart?: (messageId: string, current: boolean) => void;
  onToggleHiddenFromAI?: (messageId: string, current: boolean) => void;
  onPeekPrompt?: (options?: PeekPromptOptions) => void;
  onBranch?: (messageId: string) => void;
  onCloneSceneFromHere?: (messageId: string) => void;
  isCloneSceneFromHereDisabled?: boolean;
  isLastAssistantMessage?: boolean;
  characterMap?: CharacterMap;
  chatMode?: string;
  isGrouped?: boolean;
  personaInfo?: PersonaInfo;
  groupChatMode?: string;
  chatCharacterIds?: string[];
  expressionAvatarResolver?: ExpressionAvatarResolver;
  /** Distance from the latest message (0 = newest). Used for depth-range regex filtering. */
  messageDepth?: number;
  /** 1-based ordinal position in the message list. Shown under avatar when actions visible. */
  messageIndex?: number;
  messageOrderIndex?: number;
  multiSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (toggle: MessageSelectionToggle) => void;
}

type MergedAvatar = {
  key: string;
  url: string;
  crop: AvatarCropValue | null | undefined;
  avatarFilePath: string | null;
  avatarFilename: string | null;
};

/** Regex to match a plain image URL as the entire content. */
const IMAGE_URL_RE = /^https?:\/\/\S+\.(?:gif|png|jpe?g|webp)(?:\?[^\s]*)?$/i;

/** Regex to match <speaker>dialogue</speaker> and <speaker="name">dialogue</speaker> tags. */
const SPEAKER_TAG_RE = /<speaker(?:="([^"]*)")?>([\s\S]*?)<\/speaker>/g;
const INLINE_MARKDOWN_CONTAINER_RE =
  /\*\*\*[\s\S]+?\*\*\*|\*\*[\s\S]+?\*\*|__[\s\S]+?__|(?<!\*)\*(?!\*)[\s\S]+?(?<!\*)\*(?!\*)|==[\s\S]+?==|~~[\s\S]+?~~|(?<![_\w])_[^_]+?_(?![_\w])/g;

/**
 * Process speaker tags into ReactNodes with per-character dialogue coloring.
 * Non-speaker text gets the default dialogueColor.
 */
function renderWithSpeakerTags(
  text: string,
  defaultDialogueColor: string | undefined,
  speakerColorMap: Map<string, string> | undefined,
  boldDialogue = true,
): ReactNode[] {
  const renderLine = (line: string, color = defaultDialogueColor) => highlightDialogue(line, color, boldDialogue);

  // Tag stripping is a side-effect of the loop, not the colour logic, so the loop
  // must run whenever tags are present — otherwise `<speaker="…">` renders as text.
  if (!SPEAKER_TAG_RE.test(text)) {
    return renderLine(text, defaultDialogueColor);
  }
  SPEAKER_TAG_RE.lastIndex = 0;

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = SPEAKER_TAG_RE.exec(text)) !== null) {
    // Text before the speaker tag — use default color
    if (match.index > lastIndex) {
      nodes.push(...renderLine(text.slice(lastIndex, match.index), defaultDialogueColor));
    }
    const speakerName = match[1]?.trim() ?? "";
    const dialogue = match[2]!;
    const speakerColor = speakerName
      ? (speakerColorMap?.get(speakerName) ?? defaultDialogueColor)
      : defaultDialogueColor;
    // Render the dialogue content (without the tags) using the speaker's color
    nodes.push(<span key={`s${key++}`}>{renderLine(dialogue, speakerColor)}</span>);
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last speaker tag
  if (lastIndex < text.length) {
    nodes.push(...renderLine(text.slice(lastIndex), defaultDialogueColor));
  }

  return nodes;
}

function collectInlineMarkdownRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const regex = new RegExp(INLINE_MARKDOWN_CONTAINER_RE.source, INLINE_MARKDOWN_CONTAINER_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}

/**
 * Highlight quoted dialogue — text in supported dialogue quote pairs
 * like "", «», 「」, and 『』 gets bold + colored.
 *
 * Single quotes ('') are intentionally excluded because after curly-quote
 * normalization (' → ') they are indistinguishable from apostrophes,
 * causing false positives like "it's nice, isn't it" being partially bolded.
 *
 * Detects quote pairs on the RAW text first, then applies inline markdown
 * within each segment. This ensures that markdown syntax inside dialogue
 * (e.g. "A *long* day") doesn't split the quote across multiple nodes
 * and prevent dialogue bolding.
 *
 * Code spans (`…`), images (![…](…)), and links ([…](…)) are treated as
 * protected zones — quotes inside them are not matched as dialogue.
 */
function highlightDialogue(text: string, dialogueColor?: string, boldDialogue = true): ReactNode[] {
  // Step 1: Find protected zones where quotes should NOT trigger dialogue detection.
  // Code spans, images, and links may legitimately contain quotation marks.
  const protectedRanges: Array<[number, number]> = [];
  const protectedRe = /`[^`\n]+`|!?\[[^\]]*\]\([^)]+\)/g;
  let pm: RegExpExecArray | null;
  while ((pm = protectedRe.exec(text)) !== null) {
    protectedRanges.push([pm.index, pm.index + pm[0].length]);
  }
  const isProtected = (pos: number) => protectedRanges.some(([s, e]) => pos >= s && pos < e);
  const markdownRanges = collectInlineMarkdownRanges(text);
  const isInsideInlineMarkdown = (start: number, end: number) => markdownRanges.some(([s, e]) => start > s && end < e);

  // Step 2: Find quote pairs, skipping protected zones and quotes already enclosed by inline markdown.
  const quoteRe = new RegExp(`(?:${DIALOGUE_QUOTE_PATTERN_SOURCE})`, "g");
  const quotePairs: Array<{ start: number; end: number }> = [];
  let qm: RegExpExecArray | null;
  while ((qm = quoteRe.exec(text)) !== null) {
    const start = qm.index;
    const end = qm.index + qm[0].length;
    if (!isProtected(start) && !isInsideInlineMarkdown(start, end)) {
      quotePairs.push({ start, end });
    }
  }

  // No dialogue quotes found — just apply markdown and return.
  if (quotePairs.length === 0) {
    return applyInlineMarkdown(text, "m");
  }

  // Step 3: Split text into quoted / non-quoted segments and render.
  const result: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const q of quotePairs) {
    // Non-quoted text before this pair — apply markdown only
    if (q.start > lastIndex) {
      result.push(...applyInlineMarkdown(text.slice(lastIndex, q.start), `m${key}`));
    }

    const raw = text.slice(q.start, q.end);
    const openQuote = raw[0];
    const closeQuote = raw[raw.length - 1];
    const inner = raw.slice(1, -1);
    const DialogueTag = boldDialogue ? "strong" : "span";

    // Apply markdown inside the quoted text, then wrap in a dialogue span/strong.
    const innerNodes = applyInlineMarkdown(inner, `mq${key}`);
    result.push(
      <DialogueTag
        key={`d${key++}`}
        style={dialogueColor ? { color: dialogueColor } : undefined}
        className={!dialogueColor ? "text-black dark:text-white" : undefined}
      >
        {openQuote}
        {innerNodes}
        {closeQuote}
      </DialogueTag>,
    );

    lastIndex = q.end;
  }

  // Remaining text after the last quote pair
  if (lastIndex < text.length) {
    result.push(...applyInlineMarkdown(text.slice(lastIndex), `mt${key}`));
  }

  return result;
}

/** Check whether text contains meaningful HTML tags. */
const HTML_TAG_RE =
  /<(?:div|span|style|table|p|br|img|a|ul|ol|li|h[1-6]|em|strong|b|i|pre|code|section|article|header|footer|nav|button|input|form|label|select|option|textarea|canvas|svg|video|audio|source|iframe|hr|blockquote|details|summary|figure|figcaption|main|aside|mark|small|sub|sup|del|ins|abbr|time|progress|meter|output|dialog|template|slot|ruby|rt|rp|bdi|bdo|wbr|area|map|track|embed|object|param|picture|portal|datalist|fieldset|legend|optgroup|caption|col|colgroup|thead|tbody|tfoot|th|td|dl|dt|dd|kbd|samp|var|cite|dfn|q|s|u|font|center)\b[^>]*>/i;

const CHAT_HTML_ALLOWED_TAGS = [
  "a",
  "abbr",
  "aside",
  "b",
  "bdi",
  "bdo",
  "blockquote",
  "br",
  "caption",
  "center",
  "cite",
  "code",
  "col",
  "colgroup",
  "dd",
  "del",
  "details",
  "dfn",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "font",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "i",
  "img",
  "ins",
  "kbd",
  "li",
  "main",
  "mark",
  "nav",
  "ol",
  "p",
  "pre",
  "q",
  "s",
  "samp",
  "section",
  "small",
  "span",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "time",
  "tr",
  "u",
  "ul",
  "var",
] as const;

const CHAT_HTML_ALLOWED_ATTR = [
  "alt",
  "class",
  "color",
  "colspan",
  "data-spk",
  "decoding",
  "href",
  "id",
  "loading",
  "rel",
  "rowspan",
  "src",
  "style",
  "target",
  "title",
] as const;

const CHAT_STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
const CSS_SELECTOR_RE = /(^|[{}])\s*([^@{}][^{]*)\{/g;
const STYLE_ATTR_RE = /\sstyle=(["'])([\s\S]*?)\1/gi;

const CHAT_CSS_LAYOUT_ESCAPE_PROPERTIES = new Set([
  "all",
  "animation",
  "animation-delay",
  "animation-direction",
  "animation-duration",
  "animation-fill-mode",
  "animation-iteration-count",
  "animation-name",
  "animation-play-state",
  "animation-timing-function",
  "backdrop-filter",
  "bottom",
  "clip-path",
  "contain",
  "content",
  "filter",
  "inset",
  "inset-block",
  "inset-block-end",
  "inset-block-start",
  "inset-inline",
  "inset-inline-end",
  "inset-inline-start",
  "left",
  "perspective",
  "position",
  "right",
  "rotate",
  "scale",
  "top",
  "transform",
  "transform-origin",
  "translate",
  "z-index",
]);

const CHAT_CSS_SIZE_PROPERTIES = new Set(["height", "max-height", "max-width", "min-height", "min-width", "width"]);
const CHAT_CSS_VIEWPORT_UNIT_RE =
  /(?:^|[-\s(:])(?:\d+(?:\.\d+)?|calc\()[^;)]*(?:dvh|dvw|lvh|lvw|svh|svw|vh|vmax|vmin|vw)\b/i;
const CHAT_CSS_RUNAWAY_PX_RE = /(?:^|[-\s(:])\d{5,}px\b/i;

function normalizeCssProperty(property: string): string {
  return property
    .trim()
    .toLowerCase()
    .replace(/^-\w+-/, "");
}

function isRunawaySizeValue(value: string): boolean {
  return CHAT_CSS_VIEWPORT_UNIT_RE.test(value) || CHAT_CSS_RUNAWAY_PX_RE.test(value);
}

function sanitizeChatStyleDeclarations(style: string): string {
  return style
    .split(";")
    .map((declaration) => {
      const separatorIndex = declaration.indexOf(":");
      if (separatorIndex <= 0) return "";
      const property = declaration.slice(0, separatorIndex).trim();
      const normalizedProperty = normalizeCssProperty(property);
      if (!normalizedProperty || CHAT_CSS_LAYOUT_ESCAPE_PROPERTIES.has(normalizedProperty)) return "";
      const value = declaration
        .slice(separatorIndex + 1)
        .replace(/!important/gi, "")
        .trim();
      if (!value) return "";
      if (CHAT_CSS_SIZE_PROPERTIES.has(normalizedProperty) && isRunawaySizeValue(value)) return "";
      if (/url\s*\(\s*(['"]?)(?!data:image\/|https?:\/\/)[^)]+\)/i.test(value)) return "";
      return `${property}: ${value}`;
    })
    .filter(Boolean)
    .join("; ");
}

function sanitizeChatCssDeclarationBlocks(css: string): string {
  return css.replace(/\{([^{}]*)\}/g, (_match, declarations: string) => {
    const sanitized = sanitizeChatStyleDeclarations(declarations);
    return sanitized ? `{${sanitized}}` : "{}";
  });
}

function sanitizeInlineStyleAttributes(html: string): string {
  return html.replace(STYLE_ATTR_RE, (_match, quote: string, style: string) => {
    const sanitized = sanitizeChatStyleDeclarations(style);
    return sanitized ? ` style=${quote}${sanitized}${quote}` : "";
  });
}

function sanitizeChatHtml(html: string, options: { allowStyle?: boolean } = {}) {
  const allowedAttr = options.allowStyle
    ? [...CHAT_HTML_ALLOWED_ATTR]
    : CHAT_HTML_ALLOWED_ATTR.filter((attr) => attr !== "style");
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...CHAT_HTML_ALLOWED_TAGS],
    ALLOWED_ATTR: allowedAttr,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    FORBID_TAGS: ["animate", "embed", "foreignObject", "iframe", "math", "object", "script", "svg", "style"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "srcdoc"],
  });
}

function extractChatStyleBlocks(html: string): { html: string; css: string } {
  const cssBlocks: string[] = [];
  const withoutStyles = html.replace(CHAT_STYLE_BLOCK_RE, (_match, css: string) => {
    cssBlocks.push(css);
    return "";
  });
  return { html: withoutStyles, css: cssBlocks.join("\n") };
}

function sanitizeChatCss(css: string): string {
  return sanitizeChatCssDeclarationBlocks(
    css
      .replace(/<\/?style\b[^>]*>/gi, "")
      .replace(/@import\s+[^;]+;?/gi, "")
      .replace(/@namespace\s+[^;]+;?/gi, "")
      .replace(/expression\s*\([^)]*\)/gi, "")
      .replace(/javascript\s*:/gi, "")
      .replace(/vbscript\s*:/gi, "")
      .replace(/behavior\s*:/gi, "x-behavior:")
      .replace(/-moz-binding\s*:/gi, "x-moz-binding:")
      .replace(/url\s*\(\s*(['"]?)(?!data:image\/|https?:\/\/)[^)]+\)/gi, "none")
      .replace(/!important/gi, "")
      .replace(/<\/style/gi, "<\\/style"),
  ).trim();
}

function scopeChatCss(css: string, scopeSelector: string): string {
  const sanitized = sanitizeChatCss(css);
  if (!sanitized) return "";
  return sanitized.replace(CSS_SELECTOR_RE, (_match, boundary: string, selectors: string) => {
    const scopedSelectors = selectors
      .split(",")
      .map((selector) => {
        const trimmed = selector.trim();
        if (!trimmed) return "";
        if (/^(from|to|\d+(?:\.\d+)?%)$/i.test(trimmed)) return trimmed;
        if (trimmed.startsWith(scopeSelector)) return trimmed;
        if (trimmed === ":root" || trimmed === "html" || trimmed === "body") return scopeSelector;
        return `${scopeSelector} ${trimmed}`;
      })
      .filter(Boolean)
      .join(", ");
    return `${boundary} ${scopedSelectors}{`;
  });
}

/**
 * Render message content, handling both plain text with dialogue highlighting
 * and HTML blocks that should be rendered as actual HTML.
 */
function renderContent(
  text: string,
  dialogueColor?: string,
  speakerColorMap?: Map<string, string>,
  boldDialogue = true,
  htmlScopeClass = "mari-html-message-content",
  quoteFormat: QuoteFormat = "straight",
): ReactNode {
  const normalized = formatTextQuotes(text, quoteFormat);

  // Strip speaker tags before HTML detection (they aren't real HTML)
  const withoutSpeakerTags = normalized.replace(/<\/?speaker(?:="[^"]*")?>/g, "");

  if (!HTML_TAG_RE.test(withoutSpeakerTags)) {
    // renderWithHeadings handles headings, *** and --- horizontal rules,
    // and delegates the rest to speaker-tag / dialogue rendering.
    return renderMarkdownBlocks(normalized, (seg, _kp) =>
      renderWithSpeakerTags(seg, dialogueColor, speakerColorMap, boldDialogue),
    );
  }

  // For HTML content, replace speaker tags with color-annotated spans (preserves per-character colors)
  const stripped = speakerColorMap
    ? normalized.replace(SPEAKER_TAG_RE, (_, name, dialogue) => {
        const speakerName = typeof name === "string" ? name.trim() : "";
        const color = speakerName ? speakerColorMap.get(speakerName) : undefined;
        return color ? `<span data-spk="${color}">${dialogue as string}</span>` : (dialogue as string);
      })
    : normalized.replace(SPEAKER_TAG_RE, "$2");

  const { html: strippedWithoutStyleBlocks, css: rawStyleBlocks } = extractChatStyleBlocks(stripped);

  // Convert newlines to <br> with compact spacing for HTML content,
  // but preserve newlines inside <svg> blocks — injecting <br> into SVG
  // foreign content breaks the HTML parser's namespace handling.
  // Also skip newlines that sit between HTML tags (source formatting only).
  // First, protect newlines inside attribute values (e.g. multi-line style="")
  // by temporarily replacing them with a placeholder.
  const ATTR_NL_PLACEHOLDER = "\x00ATTRNL\x00";
  const attrProtected = strippedWithoutStyleBlocks.replace(
    /(<[^>]*?)("[^"]*"|'[^']*')([^>]*>)/g,
    (_m, before: string, attr: string, after: string) => before + attr.replace(/\n/g, ATTR_NL_PLACEHOLDER) + after,
  );
  const withBreaks = attrProtected
    .replace(/(<svg[\s\S]*?<\/svg>)|(>\s*)\n(\s*<)|\n/gi, (_m, svgBlock, pre, post) =>
      svgBlock ? svgBlock : pre ? `${pre}${post}` : '<br style="display:block;margin:0.2em 0">',
    )
    .replace(new RegExp(ATTR_NL_PLACEHOLDER, "g"), "\n");

  // Convert markdown images to <img> before sanitization so DOMPurify validates them.
  // Keep tags minimal (no class/loading) — styling is via .mari-message-content img in CSS
  // to avoid the dialogue-bolding regex mangling attribute quotes.
  const withImages = withBreaks.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g,
    (_m, alt: string, url: string) => `<img src="${url}" alt="${alt || "image"}" loading="lazy" decoding="async">`,
  );

  const clean = sanitizeChatHtml(withImages, { allowStyle: true });

  // Apply dialogue bolding inside sanitised HTML with per-speaker color support.
  const withDialogue = (() => {
    // Sanitize a CSS color value — only allow safe color formats
    const safeColor = (c: string) =>
      /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|rgba?\([\d,.\s%]+\)|hsla?\([\d,.\s%]+\))$/.test(c) ? c : "inherit";
    // Helper: check if an offset is inside an HTML tag (attribute context)
    const insideTag = (text: string, offset: number) => {
      const before = text.slice(0, offset);
      return before.lastIndexOf("<") > before.lastIndexOf(">");
    };
    const dialogueTag = boldDialogue ? "strong" : "span";
    // Pass 1: color quotes inside speaker-annotated spans with their specific colors
    const afterSpeaker = clean.replace(
      /<span[^>]*\bdata-spk="([^"]*)"[^>]*>([\s\S]*?)<\/span>/g,
      (_m: string, color: string, content: string) => {
        const validColor = safeColor(color);
        const speakerQuoteRe = new RegExp(`(?<![=\\w])(?:${HTML_SAFE_DIALOGUE_QUOTE_PATTERN_SOURCE})`, "g");
        return content.replace(speakerQuoteRe, (match: string, offset: number) => {
          if (insideTag(content, offset)) return match;
          return `<${dialogueTag} style="color:${validColor}">${match}</${dialogueTag}>`;
        });
      },
    );
    // Pass 2: color remaining quotes with default dialogue color, skipping already-wrapped text
    const remainingQuoteRe = new RegExp(`(?<![=\\w])(?:${HTML_SAFE_DIALOGUE_QUOTE_PATTERN_SOURCE})`, "g");
    return afterSpeaker.replace(remainingQuoteRe, (match, offset) => {
      if (insideTag(afterSpeaker, offset)) return match;
      const before = afterSpeaker.slice(0, offset);
      if (/<(?:strong|span)[^>]*>\s*$/.test(before.slice(Math.max(0, before.length - 300)))) return match;
      // Skip if inside a <font> tag (author-specified colors take priority)
      const lastFontOpen = before.lastIndexOf("<font ");
      if (lastFontOpen !== -1) {
        const lastFontClose = before.lastIndexOf("</font>");
        if (lastFontClose < lastFontOpen) return match;
      }
      const highlightColor = dialogueColor ?? "white";
      return `<${dialogueTag} style="color:${highlightColor}">${match}</${dialogueTag}>`;
    });
  })();

  // Convert *** and --- horizontal rules to <hr> tags in HTML path
  const withHr = withDialogue.replace(
    /(?:^|(?<=<br[^>]*>))\s*(?:\*{3,}|-{3,})\s*(?:$|(?=<br[^>]*>))/g,
    '<hr style="margin:0.75em 0;border:0;border-top:1px solid var(--border)">',
  );

  // Apply markdown-style bold/italic in HTML path
  const withMarkdown = applyInlineMarkdownHTML(withHr);
  const finalHtml = sanitizeInlineStyleAttributes(sanitizeChatHtml(withMarkdown, { allowStyle: true }));
  const scopedCss = scopeChatCss(rawStyleBlocks, `.${htmlScopeClass}`);
  const html = scopedCss ? `<style>${scopedCss}</style>${finalHtml}` : finalHtml;

  return (
    <div
      className={cn("max-w-full overflow-hidden", htmlScopeClass)}
      style={{ contain: "layout paint" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** Build style object for name color (supports gradients). */
function nameColorStyle(color?: string): React.CSSProperties | undefined {
  if (!color) return undefined;
  if (color.startsWith("linear-gradient")) {
    return {
      background: color,
      backgroundRepeat: "no-repeat",
      backgroundSize: "100% 100%",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
      color: "transparent",
      display: "inline-block",
    };
  }
  return { color };
}

export const ChatMessage = memo(function ChatMessage({
  message,
  isStreaming,
  onDelete,
  onRegenerate,
  onEdit,
  onSetActiveSwipe,
  onToggleConversationStart,
  onToggleHiddenFromAI,
  onPeekPrompt,
  onBranch,
  onCloneSceneFromHere,
  isCloneSceneFromHereDisabled,
  characterMap,
  chatMode,
  isGrouped,
  personaInfo,
  groupChatMode,
  chatCharacterIds,
  expressionAvatarResolver,
  messageDepth,
  messageIndex,
  messageOrderIndex,
  multiSelectMode,
  isSelected,
  onToggleSelect,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isNarrator = message.role === "narrator";
  const isRoleplay = chatMode === "roleplay";
  const {
    chatFontSize,
    chatFontColor,
    chatFontOpacity,
    roleplayAvatarStyle,
    roleplayAvatarScale,
    textStrokeWidth,
    textStrokeColor,
    showModelName,
    showTokenUsage,
    showMessageNumbers,
    guideGenerations,
    boldDialogue,
    theme,
    collapseHiddenMessages,
    editMessagesOnDoubleClick,
    quoteFormat,
    textBlipMode,
    customTextBlipSound,
  } = useUIStore(
    useShallow((s) => ({
      chatFontSize: s.chatFontSize,
      chatFontColor: s.chatFontColor,
      chatFontOpacity: s.chatFontOpacity,
      roleplayAvatarStyle: s.roleplayAvatarStyle,
      roleplayAvatarScale: s.roleplayAvatarScale,
      textStrokeWidth: s.textStrokeWidth,
      textStrokeColor: s.textStrokeColor,
      showModelName: s.showModelName,
      showTokenUsage: s.showTokenUsage,
      showMessageNumbers: s.showMessageNumbers,
      guideGenerations: s.guideGenerations,
      boldDialogue: s.boldDialogue ?? true,
      theme: s.theme,
      collapseHiddenMessages: s.summaryPopoverSettings.collapseHiddenMessages,
      editMessagesOnDoubleClick: s.editMessagesOnDoubleClick,
      quoteFormat: s.quoteFormat,
      textBlipMode: s.textBlipMode,
      customTextBlipSound: s.customTextBlipSound,
    })),
  );
  const isGuided = guideGenerations;
  const regenerateButtonTitle = isGuided ? "Regenerate (guided)" : "Regenerate";
  const regenerateGuidedClass = isGuided
    ? "text-[var(--primary)] bg-[var(--primary)]/15 ring-1 ring-[var(--primary)]/30 hover:text-[var(--primary)]"
    : undefined;

  // Build reusable text style objects (memoized to avoid unnecessary DOM updates)
  const textStrokeStyle = useMemo<React.CSSProperties>(
    () =>
      textStrokeWidth > 0
        ? { WebkitTextStroke: `${textStrokeWidth}px ${textStrokeColor}`, paintOrder: "stroke fill" }
        : {},
    [textStrokeWidth, textStrokeColor],
  );
  const messageTextStyle = useMemo<React.CSSProperties>(
    () => ({
      fontSize: chatFontSize,
      lineHeight: 1.5,
      ...(chatFontColor ? { color: chatFontColor } : {}),
      ...textStrokeStyle,
    }),
    [chatFontSize, chatFontColor, textStrokeStyle],
  );
  const roleplayAvatarScaleStyle = useMemo<React.CSSProperties>(
    () => ({ "--roleplay-avatar-scale": roleplayAvatarScale }) as React.CSSProperties,
    [roleplayAvatarScale],
  );

  // Compute message bubble background with user-controlled opacity.
  // Dark theme: neutral-900 (23,23,23) on dark bg → translucent dark bubble.
  // Light theme: slightly grayer than --background (#faf8ff) so bubbles stay visible on light bg.
  const { userBubbleBg, assistantBubbleBg } = useMemo(() => {
    const o = chatFontOpacity / 100;
    if (theme === "light") {
      // Higher base opacity in light mode so the bubble actually contrasts the page
      return {
        userBubbleBg: `rgba(225,220,235,${Math.min(1, 0.85 * o).toFixed(3)})`,
        assistantBubbleBg: `rgba(238,234,245,${Math.min(1, 0.9 * o).toFixed(3)})`,
      };
    }
    return {
      userBubbleBg: `rgba(23,23,23,${(0.7 * o).toFixed(3)})`,
      assistantBubbleBg: `rgba(23,23,23,${(0.6 * o).toFixed(3)})`,
    };
  }, [chatFontOpacity, theme]);

  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [showGenerationReplay, setShowGenerationReplay] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [manuallyExpandedHidden, setManuallyExpandedHidden] = useState(false);
  const [avatarLightbox, setAvatarLightbox] = useState<string | null>(null);
  const [avatarLightboxPrompt, setAvatarLightboxPrompt] = useState<string | null>(null);
  const scrollRestoreRef = useRef<{ el: HTMLElement; top: number } | null>(null);
  const lastMessageTapAtRef = useRef(0);
  const msgRef = useRef<HTMLDivElement>(null);
  const blipContentRef = useRef<{ messageId: string; length: number }>({ messageId: message.id, length: 0 });
  const openImageLightbox = useCallback((url: string, prompt?: unknown) => {
    setAvatarLightbox(url);
    setAvatarLightboxPrompt(typeof prompt === "string" ? prompt.trim() : null);
  }, []);
  const closeImageLightbox = useCallback(() => {
    setAvatarLightbox(null);
    setAvatarLightboxPrompt(null);
  }, []);

  useEffect(() => {
    const previous = blipContentRef.current;
    const nextLength = message.content.length;
    blipContentRef.current = { messageId: message.id, length: nextLength };

    if (previous.messageId !== message.id) return;
    if (!isStreaming || isUser || isSystem || editing) return;
    if (nextLength <= previous.length) return;
    if (!message.content.slice(previous.length).trim()) return;

    playTextBlip({ mode: textBlipMode, customSound: customTextBlipSound });
  }, [customTextBlipSound, editing, isStreaming, isSystem, isUser, message.content, message.id, textBlipMode]);

  // Translation
  const { translate, translations, translating } = useTranslate();
  const translatedText = translations[message.id];
  const isTranslating = !!translating[message.id];

  // TTS
  const { data: ttsConfig } = useCachedTTSConfig();
  const ttsEnabled = ttsConfig?.enabled ?? false;
  const ttsSpeakerName = message.characterId ? characterMap?.get(message.characterId)?.name : undefined;
  const ttsVoiceRequests = useMemo(
    () =>
      ttsConfig
        ? buildTTSVoiceRequests(message.content, ttsConfig, ttsSpeakerName, message.characterId).filter((request) =>
            request.text.trim(),
          )
        : [],
    [message.characterId, message.content, ttsConfig, ttsSpeakerName],
  );
  const hasTTSContent = ttsVoiceRequests.length > 0;
  const [ttsState, setTTSState] = useState(ttsService.getState());
  const [ttsActiveId, setTTSActiveId] = useState<string | null>(ttsService.getActiveId());
  useEffect(
    () =>
      ttsService.subscribe((state, id) => {
        setTTSState(state);
        setTTSActiveId(id);
      }),
    [],
  );
  const ttsBusy = ttsState === "loading" || ttsState === "playing" || ttsState === "paused";
  const isSpeakingThis = ttsActiveId === message.id;
  const isLoadingThis = isSpeakingThis && ttsState === "loading";
  const isPausedThis = isSpeakingThis && ttsState === "paused";
  const [streamingTTSActive, setStreamingTTSActive] = useState<boolean>(() => isStreamingTTSActive());
  useEffect(() => subscribeStreamingTTSActive(setStreamingTTSActive), []);

  const handleSpeak = useCallback(() => {
    if (isStreamingTTSActive()) {
      stopStreamingTTS();
      return;
    }
    // Read directly from the singleton so we never act on stale React state
    const liveState = ttsService.getState();
    const liveActiveId = ttsService.getActiveId();
    const liveBusy = liveState === "loading" || liveState === "playing" || liveState === "paused";
    const liveIsThis = liveActiveId === message.id;
    if (liveBusy && !liveIsThis) return;
    if (liveIsThis) {
      ttsService.stop();
    } else {
      if (!hasTTSContent) return;
      void ttsService.speakSequence(ttsVoiceRequests, message.id, {
        playbackRate: clientSidePlaybackRate(ttsConfig),
      });
    }
  }, [hasTTSContent, message.id, ttsConfig, ttsVoiceRequests]);

  const handlePauseResumeTTS = useCallback(() => {
    if (ttsService.getActiveId() !== message.id) return;
    if (ttsService.getState() === "paused") {
      ttsService.resume();
    } else {
      ttsService.pause();
    }
  }, [message.id]);

  const handleRestartTTS = useCallback(() => {
    if (ttsService.getActiveId() === message.id) {
      ttsService.restart();
    }
  }, [message.id]);

  // Dismiss actions when tapping outside on mobile
  useEffect(() => {
    if (!showActions) return;
    const handleTouch = (e: TouchEvent) => {
      if (msgRef.current && !msgRef.current.contains(e.target as Node)) {
        setShowActions(false);
      }
    };
    document.addEventListener("touchstart", handleTouch);
    return () => document.removeEventListener("touchstart", handleTouch);
  }, [showActions]);

  // Parse message extra for conversation start flag
  const extra = useMemo<ChatMessageExtra>(() => {
    return message.extra && typeof message.extra === "object" && !Array.isArray(message.extra)
      ? (message.extra as ChatMessageExtra)
      : EMPTY_CHAT_MESSAGE_EXTRA;
  }, [message.extra]);
  const attachments = useMemo(() => messageAttachmentsFromExtra(extra), [extra]);
  const isConversationStart = !!extra.isConversationStart;
  const isHiddenFromAI = extra.hiddenFromAI === true || extra.hiddenFromAi === true;
  const thinking = readStoredThinking(extra);
  const generationReplay = hasGenerationReplayDetails(extra.generationReplay) ? extra.generationReplay : null;
  const activePromptSnapshot = resolvePromptSnapshotFromExtra(extra, message.activeSwipeIndex);
  const isHiddenExpanded =
    isHiddenFromAI && (!collapseHiddenMessages || manuallyExpandedHidden || editing || !!isStreaming);
  const isHiddenCollapsed = isHiddenFromAI && collapseHiddenMessages && !isHiddenExpanded;
  const hiddenFromAIHeader = isHiddenFromAI ? (
    <HiddenFromAIBadge
      roleplay={isRoleplay}
      canCollapse={collapseHiddenMessages}
      isExpanded={isHiddenExpanded}
      onToggle={() => setManuallyExpandedHidden((value) => !value)}
    />
  ) : null;

  useEffect(() => {
    setManuallyExpandedHidden(false);
  }, [message.id]);

  useEffect(() => {
    if (!isHiddenFromAI || !collapseHiddenMessages) setManuallyExpandedHidden(false);
  }, [collapseHiddenMessages, isHiddenFromAI]);

  useEffect(() => {
    if (!generationReplay) setShowGenerationReplay(false);
  }, [generationReplay]);

  // Remove an attachment from this message (keeps it in gallery)
  const qc = useQueryClient();
  const handleRemoveAttachment = useCallback(
    async (index: number) => {
      const updated = attachments.filter((_, i) => i !== index);
      // Optimistic: update the infinite query cache immediately so the image disappears
      const msgKey = chatKeys.messages(message.chatId);
      qc.setQueryData<InfiniteData<Message[]>>(msgKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.map((m) => {
              if (m.id !== message.id) return m;
              const ex = typeof m.extra === "string" ? JSON.parse(m.extra) : (m.extra ?? {});
              return { ...m, extra: { ...ex, attachments: updated } } as Message;
            }),
          ),
        };
      });
      await storageApi.patchChatMessageExtra(message.id, {
        attachments: updated,
      });
      qc.invalidateQueries({ queryKey: msgKey });
    },
    [attachments, message.chatId, message.id, qc],
  );

  const genLabel = useMemo(
    () => formatGenerationLabelForMessage(message, showModelName, showTokenUsage),
    [message, showModelName, showTokenUsage],
  );
  const generationDurationMs = useMemo(() => generationDurationMsForMessage(message), [message]);
  const generationDurationLabel = generationDurationMs != null ? formatGenerationDuration(generationDurationMs) : null;
  const generationDurationTitle = generationDurationLabel
    ? `Response generated in ${generationDurationLabel}`
    : "Response generation time";
  // useLayoutEffect runs after DOM mutation but before browser paint — prevents visible scroll jump
  useLayoutEffect(() => {
    // Restore scroll position saved before the state change
    if (scrollRestoreRef.current) {
      scrollRestoreRef.current.el.scrollTop = scrollRestoreRef.current.top;
      scrollRestoreRef.current = null;
    }
  }, [editing]);

  const startEditing = useCallback(() => {
    const sp = msgRef.current?.closest("[class*='overflow-y']") as HTMLElement | null;
    if (sp) scrollRestoreRef.current = { el: sp, top: sp.scrollTop };
    setEditing(true);
  }, []);

  const startEditingFromMessageGesture = useCallback(
    (event: React.MouseEvent) => {
      if (!editMessagesOnDoubleClick || !onEdit || editing) return false;
      const target = event.target as HTMLElement | null;
      if (target?.closest(MESSAGE_EDIT_GESTURE_IGNORE_SELECTOR)) return false;
      event.preventDefault();
      event.stopPropagation();
      startEditing();
      return true;
    },
    [editMessagesOnDoubleClick, editing, onEdit, startEditing],
  );

  const handleMessageDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      startEditingFromMessageGesture(event);
    },
    [startEditingFromMessageGesture],
  );

  const handleMobileTap = useCallback(
    (e: React.MouseEvent) => {
      // In multi-select mode, clicking toggles selection on any device.
      if (multiSelectMode) {
        onToggleSelect?.({
          messageId: message.id,
          orderIndex: messageOrderIndex ?? 0,
          checked: !isSelected,
          shiftKey: e.shiftKey,
        });
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target?.closest(MESSAGE_EDIT_GESTURE_IGNORE_SELECTOR)) return;

      // Only toggle/interpret taps on touch devices. Desktop double-click is handled separately.
      if (typeof window === "undefined" || !window.matchMedia("(pointer: coarse)").matches) return;

      const now = Date.now();
      const isDoubleTap = now - lastMessageTapAtRef.current <= 350;
      lastMessageTapAtRef.current = now;
      if (isDoubleTap && startEditingFromMessageGesture(e)) return;

      setShowActions((v) => !v);
    },
    [isSelected, message.id, messageOrderIndex, multiSelectMode, onToggleSelect, startEditingFromMessageGesture],
  );

  useEffect(() => {
    if (!onEdit) return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ messageId?: string }>).detail;
      if (detail?.messageId === message.id) startEditing();
    };
    window.addEventListener("marinara:start-edit-message", handler);
    return () => window.removeEventListener("marinara:start-edit-message", handler);
  }, [message.id, onEdit, startEditing]);

  const handleSaveEdit = useCallback(
    async (content: string) => {
      const nextContent = content.trim();
      if (nextContent !== message.content) {
        await onEdit?.(message.id, nextContent);
      }
      setEditing(false);
    },
    [message.content, message.id, onEdit],
  );

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  // Apply regex scripts to AI output (assistant/narrator roles)
  const { applyToAIOutput } = useApplyRegex(chatCharacterIds);
  const scopedRegexMode = useChatStore((s) => {
    const meta = s.activeChat?.metadata;
    return (meta as Record<string, unknown> | undefined)?.scopedRegexMode as
      | "disabled"
      | "exclusive"
      | "chat"
      | undefined;
  });

  const scopedCharacterMap = useMemo(() => {
    if (!characterMap) return null;
    if (!chatCharacterIds) return characterMap;
    const allowedIds = new Set(chatCharacterIds);
    return new Map(Array.from(characterMap).filter(([id]) => allowedIds.has(id)));
  }, [characterMap, chatCharacterIds]);

  // Resolve character info from characters that actually belong to this chat.
  const charInfo = message.characterId && scopedCharacterMap ? scopedCharacterMap.get(message.characterId) : null;
  const primaryCharInfo =
    charInfo ??
    (scopedCharacterMap
      ? (Array.from(scopedCharacterMap.values()).find(
          (candidate): candidate is NonNullable<typeof candidate> => !!candidate,
        ) ?? null)
      : null);

  // For user messages, prefer per-message persona snapshot (stored when message was sent)
  // to preserve the correct persona name/avatar even after switching personas.
  // Fall back to the current personaInfo prop for older messages without snapshots.
  const msgPersona = isUser && extra.personaSnapshot ? extra.personaSnapshot : null;
  const userName = msgPersona?.name ?? personaInfo?.name ?? "You";
  const charName = primaryCharInfo?.name ?? "Assistant";
  const personaDescription = msgPersona?.description ?? personaInfo?.description;
  const personaPersonality = msgPersona?.personality ?? personaInfo?.personality;
  const personaBackstory = msgPersona?.backstory ?? personaInfo?.backstory;
  const personaAppearance = msgPersona?.appearance ?? personaInfo?.appearance;
  const personaScenario = msgPersona?.scenario ?? personaInfo?.scenario;
  const macroCharacters = useMemo(() => {
    if (scopedCharacterMap?.size) {
      const candidates = Array.from(scopedCharacterMap.values()).filter(
        (candidate): candidate is NonNullable<typeof candidate> => !!candidate,
      );
      if (candidates.length > 0) return candidates;
    }
    return charName ? [{ name: charName }] : [];
  }, [charName, scopedCharacterMap]);

  const displayContent = useMemo(() => {
    const macroContext = {
      userName,
      persona: {
        name: userName,
        description: personaDescription,
        personality: personaPersonality,
        backstory: personaBackstory,
        appearance: personaAppearance,
        scenario: personaScenario,
      },
      primaryCharacter: primaryCharInfo ?? { name: charName },
      characters: macroCharacters,
    };
    const resolveDisplayMacros = createMessageMacroResolver(macroContext);
    const text =
      isUser || isSystem
        ? message.content
        : applyToAIOutput(message.content, {
            depth: messageDepth,
            resolveMacros: resolveDisplayMacros,
            scopedMode: scopedRegexMode,
            characterId: message.characterId,
          });
    return resolveDisplayMacros(text);
  }, [
    applyToAIOutput,
    charName,
    isSystem,
    isUser,
    macroCharacters,
    message.content,
    message.characterId,
    messageDepth,
    personaAppearance,
    personaBackstory,
    personaDescription,
    personaPersonality,
    personaScenario,
    primaryCharInfo,
    scopedRegexMode,
    userName,
  ]);

  const displayName = isUser ? userName : charName;
  const baseAvatarUrl = isUser
    ? (msgPersona?.avatarUrl ?? personaInfo?.avatarUrl ?? null)
    : (charInfo?.avatarUrl ?? null);
  const expressionAvatarUrl =
    !isUser && message.characterId ? (expressionAvatarResolver?.(message, message.characterId) ?? null) : null;
  const avatarUrl = expressionAvatarUrl ?? baseAvatarUrl;
  const avatarFilePath = !isUser && !expressionAvatarUrl ? (charInfo?.avatarFilePath ?? null) : null;
  const avatarFilename = !isUser && !expressionAvatarUrl ? (charInfo?.avatarFilename ?? null) : null;
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setResolvedAvatarUrl(null);
    if (!avatarFilePath && !avatarFilename) return undefined;
    resolveAvatarFileUrl(avatarFilename, avatarFilePath)
      .then((url) => {
        if (!cancelled) setResolvedAvatarUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [avatarFilePath, avatarFilename, avatarUrl]);
  const avatarLightboxUrl = resolvedAvatarUrl ?? avatarUrl;
  const handleResolvedAvatarSrc = useCallback((src: string | null) => {
    setResolvedAvatarUrl(src);
  }, []);
  const personaAvatarCrop = isUser
    ? (parseAvatarCropJson(msgPersona?.avatarCrop) ?? personaInfo?.avatarCrop ?? null)
    : null;
  const avatarCropStyle = expressionAvatarUrl
    ? {}
    : isUser
      ? getAvatarCropStyle(personaAvatarCrop)
      : getAvatarCropStyle(charInfo?.avatarCrop);

  // Resolve colors: character colors for assistant, persona colors for user
  // Prefer per-message persona snapshot colors over current persona
  const msgColors = isUser
    ? msgPersona
      ? {
          nameColor: msgPersona.nameColor,
          dialogueColor: msgPersona.dialogueColor,
          boxColor: msgPersona.boxColor,
        }
      : personaInfo
    : charInfo;
  const dialogueColor = msgColors?.dialogueColor ?? undefined;
  const boxBgColor = msgColors?.boxColor ?? undefined;
  const msgNameColor = msgColors?.nameColor ?? undefined;
  const roleplayBubbleBg = boxBgColor ? boxBgColor : isUser ? userBubbleBg : assistantBubbleBg;

  // Build speaker → dialogueColor map for group chat speaker tag coloring
  const speakerColorMap = useMemo(() => {
    if (!scopedCharacterMap || scopedCharacterMap.size <= 1) return undefined;
    const map = new Map<string, string>();
    for (const [, info] of scopedCharacterMap) {
      if (info.name && info.dialogueColor) {
        map.set(info.name, info.dialogueColor);
      }
    }
    if (personaInfo?.name && personaInfo.dialogueColor) {
      map.set(personaInfo.name, personaInfo.dialogueColor);
    }
    return map.size > 0 ? map : undefined;
  }, [personaInfo?.dialogueColor, personaInfo?.name, scopedCharacterMap]);

  // Merged group chat: cycling avatars + cycling name color
  const isMergedGroup = groupChatMode === "merged" && !isUser && chatCharacterIds && chatCharacterIds.length > 1;
  const mergedAvatars = useMemo<MergedAvatar[]>(() => {
    if (!isMergedGroup || !characterMap || !chatCharacterIds) return [];
    return chatCharacterIds
      .map((id) => {
        const info = characterMap.get(id);
        const expressionUrl = expressionAvatarResolver?.(message, id) ?? null;
        const url = expressionUrl ?? info?.avatarUrl;
        if (!url) return null;
        return {
          key: id,
          url,
          crop: expressionUrl ? null : info?.avatarCrop,
          avatarFilePath: expressionUrl ? null : (info?.avatarFilePath ?? null),
          avatarFilename: expressionUrl ? null : (info?.avatarFilename ?? null),
        };
      })
      .filter((avatar): avatar is MergedAvatar => avatar !== null);
  }, [isMergedGroup, characterMap, chatCharacterIds, expressionAvatarResolver, message]);
  const mergedNameColors = useMemo(() => {
    if (!isMergedGroup || !characterMap || !chatCharacterIds) return [];
    const fallbackPalette = ["#c084fc", "#f472b6", "#fb923c", "#4ade80", "#60a5fa", "#facc15"];
    return chatCharacterIds.map((id, i) => {
      const raw = characterMap.get(id)?.nameColor;
      return raw || fallbackPalette[i % fallbackPalette.length]!;
    });
  }, [isMergedGroup, characterMap, chatCharacterIds]);
  // Cycle index for merged group avatars/names — driven by a ref + RAF to avoid re-renders
  const cycleIndexRef = useRef(0);
  const cycleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mergedNameRef = useRef<HTMLSpanElement>(null);
  const mergedAvatarRefs = useRef<(HTMLImageElement | null)[]>([]);
  const mergedAvatarTailRefs = useRef<(HTMLImageElement | null)[]>([]);
  const resolvedMergedAvatarUrlsRef = useRef(new Map<string, string>());
  useEffect(() => {
    let cancelled = false;
    resolvedMergedAvatarUrlsRef.current.clear();
    for (const avatar of mergedAvatars) {
      if (!avatar.avatarFilePath && !avatar.avatarFilename) {
        resolvedMergedAvatarUrlsRef.current.set(avatar.key, avatar.url);
        continue;
      }
      resolveAvatarFileUrl(avatar.avatarFilename, avatar.avatarFilePath)
        .then((url) => {
          if (!cancelled && url) resolvedMergedAvatarUrlsRef.current.set(avatar.key, url);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [mergedAvatars]);
  const rememberMergedAvatarSrc = useCallback((key: string, src: string | null) => {
    if (src) {
      resolvedMergedAvatarUrlsRef.current.set(key, src);
    } else {
      resolvedMergedAvatarUrlsRef.current.delete(key);
    }
  }, []);
  const openMergedAvatarLightbox = useCallback(
    (avatar?: { key: string; url: string }) => {
      if (!avatar) return;
      openImageLightbox(resolvedMergedAvatarUrlsRef.current.get(avatar.key) ?? avatar.url);
    },
    [openImageLightbox],
  );

  useEffect(() => {
    if (!isMergedGroup) return;
    const total = Math.max(mergedAvatars.length, mergedNameColors.length);
    if (total <= 1) return;
    cycleTimerRef.current = setInterval(() => {
      cycleIndexRef.current = (cycleIndexRef.current + 1) % total;
      const idx = cycleIndexRef.current;
      // Update avatar opacity via DOM directly (no re-render)
      mergedAvatarRefs.current.forEach((img, i) => {
        if (img) img.style.opacity = i === idx ? "1" : "0";
      });
      mergedAvatarTailRefs.current.forEach((img, i) => {
        if (img) img.style.opacity = i === idx ? "1" : "0";
      });
      // Update name color opacity via DOM directly
      const nameEl = mergedNameRef.current;
      if (nameEl) {
        const spans = nameEl.querySelectorAll<HTMLSpanElement>("[data-cycle-name]");
        spans.forEach((span, i) => {
          span.style.opacity = i === idx % mergedNameColors.length ? "1" : "0";
        });
      }
    }, 2000);
    return () => {
      if (cycleTimerRef.current) clearInterval(cycleTimerRef.current);
    };
  }, [isMergedGroup, mergedAvatars.length, mergedNameColors.length]);

  /** Build a stable style object for a given name color (gradient or plain). */
  function nameColorToStyle(c: string): React.CSSProperties {
    if (c.startsWith("linear-gradient")) {
      return {
        background: c,
        backgroundRepeat: "no-repeat",
        backgroundSize: "100% 100%",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        color: "transparent",
        display: "inline-block",
      };
    }
    return { color: c, WebkitTextFillColor: c };
  }

  /** Render a stack of absolutely-positioned "Narrator" labels that crossfade via opacity. */
  const mergedNameElement =
    isMergedGroup && mergedNameColors.length > 0 ? (
      <span ref={mergedNameRef} className="relative inline-block">
        {/* Invisible sizer so the parent reserves the right width */}
        <span className="invisible">Narrator</span>
        {mergedNameColors.map((c, i) => (
          <span
            key={i}
            data-cycle-name
            className="absolute inset-0"
            style={{
              ...nameColorToStyle(c),
              opacity: i === 0 ? 1 : 0,
              transition: "opacity 1s ease",
            }}
          >
            Narrator
          </span>
        ))}
      </span>
    ) : null;

  // Render content with dialogue highlighting (or HTML rendering)
  const text = typeof displayContent === "string" ? displayContent : message.content;
  const isHtmlContent = HTML_TAG_RE.test(text);
  const htmlScopeClass = useMemo(() => {
    const suffix = message.id.replace(/[^a-zA-Z0-9_-]/g, "");
    return `mari-html-message-${suffix || "content"}`;
  }, [message.id]);

  const renderedContent = useMemo(() => {
    return renderContent(text, dialogueColor, speakerColorMap, boldDialogue, htmlScopeClass, quoteFormat);
  }, [text, dialogueColor, speakerColorMap, boldDialogue, htmlScopeClass, quoteFormat]);

  const handleCopy = () => {
    copyToClipboard(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // ─── Swipe navigation ───
  const swipeCount = message.swipeCount ?? 0;
  const hasSwipes = swipeCount > 1;

  const useCompactRectangleAvatar = isRoleplay && roleplayAvatarStyle === "rectangles";
  const compactAvatarFrameClass = useCompactRectangleAvatar
    ? "h-[calc(3.5rem*var(--roleplay-avatar-scale))] w-[calc(2.75rem*var(--roleplay-avatar-scale))] rounded-xl"
    : "h-[calc(2.5rem*var(--roleplay-avatar-scale))] w-[calc(2.5rem*var(--roleplay-avatar-scale))] rounded-full";
  // RP rectangle avatars (compact "rectangles" style and the larger glued
  // panel) can't apply the source-rectangle crop format directly — that
  // format renders the <img> with position: absolute and non-aspect-preserving
  // width/height, which stretches when forced into a rectangle whose aspect
  // ratio differs from the (square) crop. Bypass the crop entirely for new
  // format so the <img>'s className (object-cover [object-top]) governs.
  // A previous attempt mapped the crop center to `object-position`, but on a
  // short message the glued panel becomes a wide rectangle — `object-cover`
  // against a tall source then crops the top off and 50%/50% (or any centered
  // focal point on a top-of-source face) lands on chin/chest instead of face.
  const rectangleSafeCropStyle = (
    crop: AvatarCropValue | null | undefined,
    fallback: React.CSSProperties,
  ): React.CSSProperties => {
    if (!crop) return fallback;
    return {};
  };
  const compactAvatarCrop: AvatarCropValue | null = isUser
    ? (personaAvatarCrop ?? null)
    : expressionAvatarUrl
      ? null
      : (charInfo?.avatarCrop ?? null);
  const compactAvatarCropStyle: React.CSSProperties = useCompactRectangleAvatar
    ? rectangleSafeCropStyle(compactAvatarCrop, avatarCropStyle)
    : avatarCropStyle;
  const compactMergedAvatarCropStyle = (avatar: { crop?: AvatarCropValue | null }): React.CSSProperties =>
    useCompactRectangleAvatar
      ? rectangleSafeCropStyle(avatar.crop, getAvatarCropStyle(avatar.crop))
      : getAvatarCropStyle(avatar.crop);
  const panelAvatarCropStyle: React.CSSProperties = rectangleSafeCropStyle(compactAvatarCrop, avatarCropStyle);
  const panelMergedAvatarCropStyle = (avatar: { crop?: AvatarCropValue | null }): React.CSSProperties =>
    rectangleSafeCropStyle(avatar.crop, getAvatarCropStyle(avatar.crop));
  const compactAvatarSpacerClass = useCompactRectangleAvatar
    ? "w-[calc(2.75rem*var(--roleplay-avatar-scale))]"
    : "w-[calc(2.5rem*var(--roleplay-avatar-scale))]";
  const compactAvatarIconSize = useCompactRectangleAvatar
    ? `${Math.max(1, Math.min(1.75, 1.125 * roleplayAvatarScale))}rem`
    : `${Math.max(0.875, Math.min(1.5, roleplayAvatarScale))}rem`;
  const hideRoleplayAvatar = isRoleplay && roleplayAvatarStyle === "none";
  const showRoleplayAvatarPanel = isRoleplay && roleplayAvatarStyle === "panel" && !isGrouped;
  const showCompactAvatar = !isGrouped && !showRoleplayAvatarPanel && !hideRoleplayAvatar;
  const roleplayAvatarPanelTail = showRoleplayAvatarPanel ? (
    isMergedGroup && mergedAvatars.length > 0 ? (
      <div className="rpg-avatar-panel-tail absolute inset-0 pointer-events-none overflow-hidden">
        {mergedAvatars.map((avatar, i) => (
          <ResolvedAvatarImage
            key={`tail-${avatar.key}`}
            ref={(el) => {
              mergedAvatarTailRefs.current[i] = el;
            }}
            src={avatar.url}
            avatarFilePath={avatar.avatarFilePath}
            avatarFilename={avatar.avatarFilename}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            thumbnailSize={256}
            className="rpg-avatar-panel-tail-image absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-700"
            style={{ opacity: i === 0 ? 1 : 0, ...panelMergedAvatarCropStyle(avatar) }}
            onResolvedSrc={(src) => rememberMergedAvatarSrc(avatar.key, src)}
          />
        ))}
      </div>
    ) : avatarUrl ? (
      <div className="rpg-avatar-panel-tail absolute inset-0 pointer-events-none overflow-hidden">
        <ResolvedAvatarImage
          src={avatarUrl}
          avatarFilePath={avatarFilePath}
          avatarFilename={avatarFilename}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          thumbnailSize={256}
          className="rpg-avatar-panel-tail-image absolute inset-0 h-full w-full object-cover object-top"
          style={panelAvatarCropStyle}
          onResolvedSrc={handleResolvedAvatarSrc}
        />
      </div>
    ) : null
  ) : null;
  const roleplayBubbleContent = isHiddenCollapsed ? null : editing ? (
    <EditTextarea
      initialContent={message.content}
      fontSize={chatFontSize}
      quoteFormat={quoteFormat}
      onSave={handleSaveEdit}
      onCancel={handleCancelEdit}
    />
  ) : (
    <>
      <div className={cn("mari-message-content break-words", !isHtmlContent && "whitespace-pre-wrap")}>
        {isStreaming && !message.content ? (
          <div className="mari-message-typing flex items-center gap-1 py-0.5">
            <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400/60 [animation-delay:0ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400/60 [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400/60 [animation-delay:300ms]" />
          </div>
        ) : (
          <>
            {renderedContent}
            {isStreaming && (
              <span className="ml-0.5 inline-block h-4 w-[0.125rem] animate-pulse rounded-full bg-blue-400" />
            )}
          </>
        )}
      </div>
      {(translatedText || isTranslating) && (
        <div className="mt-2 border-t border-white/10 pt-2">
          {isTranslating ? (
            <span className="text-[0.75rem] italic text-white/40">Translating…</span>
          ) : (
            <div className="whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-blue-200/70">
              {translatedText}
            </div>
          )}
        </div>
      )}
    </>
  );

  // ─── System messages (shared across modes) ───
  if (isSystem) {
    return (
      <div
        ref={msgRef}
        className={cn(
          "mari-system-message group flex justify-center py-2",
          multiSelectMode && isSelected && "rounded-lg bg-[var(--destructive)]/5 ring-2 ring-[var(--destructive)]/50",
        )}
        onClick={handleMobileTap}
        onDoubleClick={handleMessageDoubleClick}
      >
        <div className="relative">
          {!multiSelectMode && onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(message.id);
              }}
              aria-label="Delete message"
              className={cn(
                "absolute -right-1 -top-1 rounded-md p-1 text-white/20 opacity-0 transition-all hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100",
                showActions && "opacity-100",
              )}
              title="Delete"
            >
              <Trash2 size="0.75rem" />
            </button>
          )}
          <div className="mari-system-message-content rounded-full bg-[var(--secondary)] px-4 py-1.5 text-[0.6875rem] text-[var(--muted-foreground)]">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // Roleplay Mode — immersive narrative
  // ═══════════════════════════════════════════════
  if (isRoleplay) {
    // Narrator messages
    if (isNarrator) {
      return (
        <div
          ref={msgRef}
          className={cn(
            "mari-message mari-message-narrator rpg-narrator-msg group mb-4 px-2",
            multiSelectMode && isSelected && "rounded-lg bg-[var(--destructive)]/5 ring-2 ring-[var(--destructive)]/50",
          )}
          data-card-css={message.characterId ?? undefined}
          onClick={handleMobileTap}
          onDoubleClick={handleMessageDoubleClick}
        >
          <div className="flex gap-3">
            {multiSelectMode && (
              <div className="flex flex-shrink-0 items-start pt-2">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-label={isSelected ? "Deselect message" : "Select message"}
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded border-2 transition-colors",
                    isSelected
                      ? "border-[var(--destructive)] bg-[var(--destructive)]"
                      : "border-[var(--muted-foreground)]/40 bg-[var(--secondary)]",
                  )}
                >
                  {isSelected && <span className="text-xs font-bold text-white">✓</span>}
                </button>
              </div>
            )}
            <div className="mari-message-bubble relative flex-1 rounded-xl border border-amber-500/10 bg-black/40 px-5 py-4">
              {/* Delete button */}
              {!multiSelectMode && onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(message.id)}
                  aria-label="Delete message"
                  className={cn(
                    "absolute right-2 top-2 rounded-md p-1 text-white/20 opacity-0 transition-all hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100",
                    showActions && "opacity-100",
                  )}
                  title="Delete"
                >
                  <Trash2 size="0.75rem" />
                </button>
              )}
              <div className="mb-1 flex items-center gap-2 text-[0.625rem] font-semibold uppercase tracking-widest text-amber-400/70">
                <span className="h-px flex-1 bg-amber-400/20" />
                {hiddenFromAIHeader}
                Narrator
                {genLabel && (
                  <span
                    className="max-w-[15.625rem] truncate text-[0.5625rem] font-medium normal-case tracking-normal text-amber-100/50"
                    title={genLabel}
                  >
                    {genLabel}
                  </span>
                )}
                <span className="h-px flex-1 bg-amber-400/20" />
              </div>
              {!isHiddenCollapsed && (
                <div
                  className={cn("mari-message-content break-words italic", !isHtmlContent && "whitespace-pre-wrap")}
                  style={messageTextStyle}
                >
                  {renderedContent}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        <div
          ref={msgRef}
          className={cn(
            "mari-message group mb-4 flex gap-3 px-2",
            isUser ? "mari-message-user flex-row-reverse" : "mari-message-assistant",
            multiSelectMode && isSelected && "ring-2 ring-[var(--destructive)]/50 rounded-lg bg-[var(--destructive)]/5",
          )}
          data-message-id={message.id}
          data-message-role={message.role}
          data-card-css={message.characterId ?? undefined}
          onClick={handleMobileTap}
          onDoubleClick={handleMessageDoubleClick}
          style={roleplayAvatarScaleStyle}
        >
          {/* Multi-select checkbox */}
          {multiSelectMode && (
            <div className="flex items-start pt-2 flex-shrink-0">
              <button
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                aria-label={isSelected ? "Deselect message" : "Select message"}
                className={cn(
                  "h-5 w-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer",
                  isSelected
                    ? "border-[var(--destructive)] bg-[var(--destructive)]"
                    : "border-[var(--muted-foreground)]/40 bg-[var(--secondary)]",
                )}
              >
                {isSelected && <span className="text-white text-xs font-bold">✓</span>}
              </button>
            </div>
          )}
          {/* Avatar Column */}
          {showCompactAvatar && (
            <div className="mari-message-avatar flex flex-col items-center flex-shrink-0 pt-1">
              {isMergedGroup && mergedAvatars.length > 0 ? (
                <button
                  type="button"
                  className={cn(
                    "rpg-avatar-glow relative cursor-pointer overflow-hidden ring-2 ring-white/10",
                    compactAvatarFrameClass,
                  )}
                  onClick={() => openMergedAvatarLightbox(mergedAvatars[cycleIndexRef.current])}
                  aria-label={`Open ${displayName} avatar`}
                >
                  {mergedAvatars.map((avatar, i) => (
                    <ResolvedAvatarImage
                      key={avatar.key}
                      ref={(el) => {
                        mergedAvatarRefs.current[i] = el;
                      }}
                      src={avatar.url}
                      avatarFilePath={avatar.avatarFilePath}
                      avatarFilename={avatar.avatarFilename}
                      alt="Group"
                      loading="lazy"
                      decoding="async"
                      thumbnailSize={128}
                      className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
                      style={{ opacity: i === 0 ? 1 : 0, ...compactMergedAvatarCropStyle(avatar) }}
                      onResolvedSrc={(src) => rememberMergedAvatarSrc(avatar.key, src)}
                    />
                  ))}
                </button>
              ) : avatarUrl ? (
                <div className={cn(!isUser && "rpg-avatar-glow")}>
                  <button
                    type="button"
                    className={cn(
                      "relative cursor-pointer overflow-hidden ring-2 ring-white/10",
                      compactAvatarFrameClass,
                    )}
                    onClick={() => avatarLightboxUrl && openImageLightbox(avatarLightboxUrl)}
                    aria-label={`Open ${displayName} avatar`}
                  >
                    <ResolvedAvatarImage
                      src={avatarUrl}
                      avatarFilePath={avatarFilePath}
                      avatarFilename={avatarFilename}
                      alt={displayName}
                      loading="lazy"
                      decoding="async"
                      thumbnailSize={128}
                      className="h-full w-full object-cover"
                      style={compactAvatarCropStyle}
                      onResolvedSrc={handleResolvedAvatarSrc}
                    />
                  </button>
                </div>
              ) : (
                <div
                  className={cn(
                    "flex items-center justify-center ring-2 shadow-lg",
                    compactAvatarFrameClass,
                    isUser
                      ? "bg-gradient-to-br from-neutral-500 to-neutral-600 ring-white/15"
                      : "bg-gradient-to-br from-purple-500 to-pink-600 ring-purple-400/20",
                  )}
                >
                  {isUser ? (
                    <User size={compactAvatarIconSize} className="text-white" />
                  ) : (
                    <Bot size={compactAvatarIconSize} className="text-white" />
                  )}
                </div>
              )}
              {(showActions || showMessageNumbers) && messageIndex != null && (
                <span className="mt-1 text-[0.5625rem] font-medium text-[var(--muted-foreground)] select-none">
                  #{messageIndex}
                </span>
              )}
            </div>
          )}

          {/* Spacer if grouped (no avatar) */}
          {isGrouped && !hideRoleplayAvatar && <div className={cn("flex-shrink-0", compactAvatarSpacerClass)} />}

          {/* Content */}
          <div
            className={cn(
              "mari-message-body flex min-w-0 max-w-[82%] flex-col gap-0.5",
              isUser && "items-end",
              editing && "w-[82%]",
            )}
          >
            {/* Name + time (only if not grouped) */}
            {!isGrouped && (
              <div className={cn("flex items-baseline gap-2 px-1", isUser && "flex-row-reverse")}>
                {hiddenFromAIHeader}
                <span
                  className={cn(
                    "mari-message-name text-[0.75rem] font-bold tracking-tight",
                    !msgNameColor && !isMergedGroup && (isUser ? "text-neutral-300" : "rpg-char-name"),
                  )}
                  style={!isMergedGroup ? nameColorStyle(msgNameColor) : undefined}
                >
                  {isMergedGroup ? mergedNameElement : displayName}
                </span>
                <span className="text-[0.625rem] text-white/30">{formatTime(message.createdAt)}</span>
                {genLabel && (
                  <span className="max-w-[15.625rem] truncate text-[0.5625rem] italic text-white/45" title={genLabel}>
                    {genLabel}
                  </span>
                )}
                {showRoleplayAvatarPanel && (showActions || showMessageNumbers) && messageIndex != null && (
                  <span className="text-[0.5625rem] font-medium text-white/25 select-none">#{messageIndex}</span>
                )}
              </div>
            )}

            {/* Conversation start marker */}
            {isConversationStart && (
              <div className="flex items-center gap-1.5 px-1 mb-1">
                <span className="h-px flex-1 bg-amber-400/30" />
                <span className="text-[0.5625rem] font-semibold uppercase tracking-widest text-amber-400/70">
                  New Start
                </span>
                <span className="h-px flex-1 bg-amber-400/30" />
              </div>
            )}

            {/* Message bubble */}
            <div
              className={cn(
                "mari-message-bubble relative overflow-hidden rounded-2xl shadow-lg shadow-black/20",
                isUser
                  ? "rounded-tr-sm text-neutral-100 ring-1 ring-white/10"
                  : "rounded-tl-sm text-white/90 ring-1 ring-white/8",
                isGrouped && (isUser ? "rounded-tr-2xl" : "rounded-tl-2xl"),
                isStreaming && "rpg-streaming",
                isConversationStart && "ring-amber-400/30",
                isHiddenFromAI && "ring-amber-300/35 saturate-75",
                editing && "w-full",
              )}
              style={{
                ...messageTextStyle,
                backgroundColor: roleplayBubbleBg,
              }}
            >
              {showRoleplayAvatarPanel ? (
                <div className={cn("flex min-h-full items-stretch", isUser && "flex-row-reverse")}>
                  <div
                    className={cn(
                      "relative flex min-h-[calc(11rem*var(--roleplay-avatar-scale))] w-[calc(4.75rem*var(--roleplay-avatar-scale))] shrink-0 items-start self-stretch overflow-hidden md:w-[calc(5.25rem*var(--roleplay-avatar-scale))]",
                      isUser ? "border-l border-white/8" : "border-r border-white/8",
                    )}
                  >
                    <div className="rpg-avatar-panel-stack relative h-full max-h-[calc(11rem*var(--roleplay-avatar-scale))] w-full overflow-hidden">
                      {isMergedGroup && mergedAvatars.length > 0 ? (
                        <button
                          type="button"
                          className="rpg-avatar-panel-media rpg-avatar-panel absolute inset-0 block h-full w-full cursor-zoom-in overflow-hidden"
                          onClick={() => openMergedAvatarLightbox(mergedAvatars[cycleIndexRef.current])}
                          aria-label={`Open ${displayName} avatar`}
                        >
                          {mergedAvatars.map((avatar, i) => (
                            <ResolvedAvatarImage
                              key={avatar.key}
                              ref={(el) => {
                                mergedAvatarRefs.current[i] = el;
                              }}
                              src={avatar.url}
                              avatarFilePath={avatar.avatarFilePath}
                              avatarFilename={avatar.avatarFilename}
                              alt="Group"
                              loading="lazy"
                              decoding="async"
                              thumbnailSize={256}
                              className="absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-700"
                              style={{ opacity: i === 0 ? 1 : 0, ...panelMergedAvatarCropStyle(avatar) }}
                              onResolvedSrc={(src) => rememberMergedAvatarSrc(avatar.key, src)}
                            />
                          ))}
                        </button>
                      ) : avatarUrl ? (
                        <button
                          type="button"
                          className={cn(
                            "rpg-avatar-panel-media absolute inset-0 block h-full w-full cursor-zoom-in overflow-hidden",
                            !isUser && "rpg-avatar-panel",
                          )}
                          onClick={() => avatarLightboxUrl && openImageLightbox(avatarLightboxUrl)}
                          aria-label={`Open ${displayName} avatar`}
                        >
                          <ResolvedAvatarImage
                            src={avatarUrl}
                            avatarFilePath={avatarFilePath}
                            avatarFilename={avatarFilename}
                            alt={displayName}
                            loading="lazy"
                            decoding="async"
                            thumbnailSize={256}
                            className="h-full w-full object-cover object-top"
                            style={panelAvatarCropStyle}
                            onResolvedSrc={handleResolvedAvatarSrc}
                          />
                        </button>
                      ) : (
                        <div
                          className={cn(
                            "flex h-full w-full items-start justify-center pt-4",
                            isUser
                              ? "bg-gradient-to-b from-neutral-500/90 via-neutral-600/65 to-transparent"
                              : "bg-gradient-to-b from-purple-500/90 via-pink-600/65 to-transparent",
                          )}
                        >
                          {isUser ? (
                            <User size="1.25rem" className="text-white" />
                          ) : (
                            <Bot size="1.25rem" className="text-white" />
                          )}
                        </div>
                      )}
                      {roleplayAvatarPanelTail}
                      <div
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-[34%]"
                        style={{
                          background: `linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, ${roleplayBubbleBg} 100%)`,
                          opacity: 0.92,
                          maskImage:
                            "linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.12) 22%, rgba(0, 0, 0, 0.66) 72%, rgba(0, 0, 0, 1) 100%)",
                          WebkitMaskImage:
                            "linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.12) 22%, rgba(0, 0, 0, 0.66) 72%, rgba(0, 0, 0, 1) 100%)",
                        }}
                      />
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={{
                          background: `linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0) 74%, ${roleplayBubbleBg} 90%, ${roleplayBubbleBg} 100%)`,
                        }}
                      />
                    </div>
                  </div>
                  {roleplayBubbleContent && <div className="min-w-0 flex-1 px-3 py-3">{roleplayBubbleContent}</div>}
                </div>
              ) : roleplayBubbleContent ? (
                <div className="px-4 py-3">{roleplayBubbleContent}</div>
              ) : null}
            </div>

            {/* Image attachments (illustrations, selfies) */}
            {!editing && attachments.length > 0 && !IMAGE_URL_RE.test(message.content.trim()) && (
              <div className="mt-1.5 flex flex-col items-center gap-2 px-3 pb-2">
                {attachments.map((att, i) => {
                  const imageSource = isImageMessageAttachment(att) ? messageAttachmentImageSource(att) : null;
                  return imageSource ? (
                    <div key={i} className="group/att relative inline-block">
                      <button
                        type="button"
                        onClick={() => openImageLightbox(imageSource, att.prompt)}
                        className="block"
                        title="Open image"
                        aria-label={`Open ${messageAttachmentImageAlt(att)}`}
                      >
                        <img
                          src={imageSource}
                          alt={messageAttachmentImageAlt(att)}
                          className="max-h-80 max-w-full rounded-lg"
                          loading="lazy"
                          decoding="async"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(i)}
                        aria-label="Remove image from message"
                        title="Remove from message"
                        className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white/80 transition-opacity hover:bg-black/80 hover:text-white sm:opacity-0 sm:group-hover/att:opacity-100"
                      >
                        <X size="0.875rem" />
                      </button>
                    </div>
                  ) : null;
                })}
              </div>
            )}

            {/* Swipes */}
            {hasSwipes && (
              <SwipeJumpControl
                activeSwipeIndex={message.activeSwipeIndex}
                swipeCount={swipeCount}
                onSetActiveSwipe={(index) => onSetActiveSwipe?.(message.id, index)}
                onCreateNextSwipe={
                  onRegenerate
                    ? () => onRegenerate(message.id, { forCharacterId: message.characterId ?? null })
                    : undefined
                }
                className="px-1 text-[0.75rem] text-white/40"
                buttonClassName="rounded-md p-[0.25em] transition-colors hover:bg-white/10 disabled:opacity-30"
                inputClassName="border-white/10 bg-white/5 text-white/70 [color-scheme:dark]"
                iconSize={MESSAGE_SWIPE_ICON_SIZE}
              />
            )}

            {/* Hover actions (tap to toggle on mobile) */}
            <div
              className={cn(
                "mari-message-actions flex items-center gap-0.5 px-1 opacity-0 transition-all group-hover:opacity-100",
                isUser && "flex-row-reverse",
                showActions && "opacity-100",
              )}
            >
              <ActionBtn
                icon={copied ? "\u2713" : <Copy size={MESSAGE_ACTION_ICON_SIZE} />}
                onClick={handleCopy}
                title="Copy"
                dark
              />
              <ActionBtn
                icon={<Languages size={MESSAGE_ACTION_ICON_SIZE} />}
                onClick={() => void translate(message.id, message.content, message.chatId)}
                title={translatedText ? "Hide translation" : "Translate"}
                className={translatedText ? "text-blue-400/80 hover:text-blue-300" : undefined}
                dark
              />
              {generationDurationLabel && (
                <ActionBtn
                  icon={<Timer size={MESSAGE_ACTION_ICON_SIZE} />}
                  onClick={() => undefined}
                  title={generationDurationTitle}
                  dark
                />
              )}
              {onEdit && (
                <ActionBtn icon={<Pencil size={MESSAGE_ACTION_ICON_SIZE} />} onClick={startEditing} title="Edit" dark />
              )}
              {onRegenerate && (
                <ActionBtn
                  icon={<RefreshCw size={MESSAGE_ACTION_ICON_SIZE} />}
                  onClick={() => onRegenerate(message.id, { forCharacterId: message.characterId ?? null })}
                  title={regenerateButtonTitle}
                  className={regenerateGuidedClass}
                  dark
                />
              )}
              {onToggleConversationStart && (
                <ActionBtn
                  icon={<Flag size={MESSAGE_ACTION_ICON_SIZE} />}
                  onClick={() => onToggleConversationStart(message.id, isConversationStart)}
                  title={isConversationStart ? "Remove conversation start" : "Mark as new start"}
                  className={isConversationStart ? "text-amber-400/80 hover:text-amber-300" : undefined}
                  dark
                />
              )}
              {onToggleHiddenFromAI && (
                <ActionBtn
                  icon={
                    isHiddenFromAI ? (
                      <Eye size={MESSAGE_ACTION_ICON_SIZE} />
                    ) : (
                      <EyeOff size={MESSAGE_ACTION_ICON_SIZE} />
                    )
                  }
                  onClick={() => onToggleHiddenFromAI(message.id, isHiddenFromAI)}
                  title={isHiddenFromAI ? "Unhide from AI" : "Hide from AI"}
                  className={isHiddenFromAI ? "text-amber-400/90 hover:text-amber-300" : undefined}
                  dark
                />
              )}
              {!isUser && (
                <ActionBtn
                  icon={<Search size={MESSAGE_ACTION_ICON_SIZE} />}
                  onClick={() =>
                    onPeekPrompt?.({
                      forCharacterId: message.characterId ?? null,
                      messageId: message.id,
                      promptSnapshot: activePromptSnapshot,
                    })
                  }
                  title="Peek prompt"
                  dark
                />
              )}
              {generationReplay && (
                <ActionBtn
                  icon={<ScrollText size={MESSAGE_ACTION_ICON_SIZE} />}
                  onClick={() => setShowGenerationReplay(true)}
                  title="Stored guidance"
                  dark
                />
              )}
              {thinking && !isUser && (
                <ActionBtn
                  icon={<Brain size={MESSAGE_ACTION_ICON_SIZE} />}
                  onClick={() => setShowThinking(true)}
                  title="View thoughts"
                  dark
                />
              )}
              {onBranch && (
                <ActionBtn
                  icon={<GitBranch size={MESSAGE_ACTION_ICON_SIZE} />}
                  onClick={() => onBranch(message.id)}
                  title="Branch from here"
                  dark
                />
              )}
              {onCloneSceneFromHere && (
                <ActionBtn
                  icon={<GitBranch size={MESSAGE_ACTION_ICON_SIZE} />}
                  onClick={() => onCloneSceneFromHere(message.id)}
                  title="Clone from here"
                  disabled={isCloneSceneFromHereDisabled}
                  dark
                />
              )}
              {onDelete && (
                <ActionBtn
                  icon={<Trash2 size={MESSAGE_ACTION_ICON_SIZE} />}
                  onClick={() => onDelete(message.id)}
                  title="Delete"
                  className="hover:text-red-400"
                  dark
                />
              )}
              {ttsEnabled && (
                <>
                  {isSpeakingThis && !isLoadingThis && (
                    <>
                      <ActionBtn
                        icon={
                          isPausedThis ? (
                            <Play size={MESSAGE_ACTION_ICON_SIZE} />
                          ) : (
                            <Pause size={MESSAGE_ACTION_ICON_SIZE} />
                          )
                        }
                        onClick={handlePauseResumeTTS}
                        title={isPausedThis ? "Resume speaking" : "Pause speaking"}
                        className="text-sky-400 hover:text-sky-300"
                        dark
                      />
                      <ActionBtn
                        icon={<RefreshCw size={MESSAGE_ACTION_ICON_SIZE} />}
                        onClick={handleRestartTTS}
                        title="Restart speaking"
                        className="text-sky-400 hover:text-sky-300"
                        dark
                      />
                    </>
                  )}
                  <ActionBtn
                    icon={
                      isLoadingThis ? (
                        <Loader2 size={MESSAGE_ACTION_ICON_SIZE} className="animate-spin" />
                      ) : isSpeakingThis || streamingTTSActive ? (
                        <VolumeX size={MESSAGE_ACTION_ICON_SIZE} />
                      ) : (
                        <Volume2 size={MESSAGE_ACTION_ICON_SIZE} />
                      )
                    }
                    onClick={handleSpeak}
                    title={
                      streamingTTSActive
                        ? "Stop streaming narration"
                        : !hasTTSContent
                          ? "No dialogue to speak"
                          : isLoadingThis
                            ? "Loading…"
                            : isSpeakingThis
                              ? "Stop speaking"
                              : "Speak"
                    }
                    className={isSpeakingThis || streamingTTSActive ? "text-sky-400 hover:text-sky-300" : undefined}
                    disabled={!streamingTTSActive && (!hasTTSContent || (ttsBusy && !isSpeakingThis))}
                    dark
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Thinking modal */}
        {showThinking && thinking && <ThinkingModal thinking={thinking} onClose={() => setShowThinking(false)} />}
        {generationReplay && (
          <GenerationReplayDetailsModal
            open={showGenerationReplay}
            replay={generationReplay}
            onClose={() => setShowGenerationReplay(false)}
          />
        )}

        {/* Avatar lightbox */}
        {avatarLightbox && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80"
            onClick={closeImageLightbox}
          >
            <div
              className="flex max-h-[90vh] w-[min(90vw,64rem)] max-w-[90vw] flex-col items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={avatarLightbox}
                alt={displayName}
                decoding="async"
                className={
                  avatarLightboxPrompt?.trim()
                    ? "max-h-[calc(90vh-9rem)] max-w-full rounded-lg object-contain shadow-2xl"
                    : "max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
                }
              />
              <ImagePromptPanel prompt={avatarLightboxPrompt} className="w-full max-w-3xl" />
            </div>
            <button
              type="button"
              onClick={closeImageLightbox}
              aria-label="Close image"
              className="absolute right-3 top-3 rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
            >
              <X size="1rem" />
            </button>
          </div>
        )}
      </>
    );
  }

  // ═══════════════════════════════════════════════
  // Conversation Mode — iMessage / texting style
  // ═══════════════════════════════════════════════
  return (
    <div
      ref={msgRef}
      className={cn(
        "mari-message group flex",
        isUser ? "mari-message-user justify-end" : "mari-message-assistant justify-start",
        isGrouped ? "mb-0.5" : "mb-3",
        multiSelectMode && isSelected && "bg-[var(--destructive)]/5",
      )}
      data-message-id={message.id}
      data-message-role={message.role}
      data-card-css={message.characterId ?? undefined}
      onClick={handleMobileTap}
      onDoubleClick={handleMessageDoubleClick}
    >
      <div
        className={cn("flex min-w-0 max-w-[72%] gap-2", isUser && "flex-row-reverse", editing && "w-[85%] max-w-[85%]")}
      >
        {/* Avatar — only show for first in group */}
        {(!isUser || avatarUrl) && (
          <div
            className={cn(
              "mari-message-avatar flex flex-col items-center flex-shrink-0 self-end",
              isGrouped && "invisible",
            )}
          >
            {isMergedGroup && mergedAvatars.length > 0 ? (
              <button
                type="button"
                className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full"
                onClick={() => openMergedAvatarLightbox(mergedAvatars[cycleIndexRef.current])}
                aria-label={`Open ${displayName} avatar`}
              >
                {mergedAvatars.map((avatar, i) => (
                  <ResolvedAvatarImage
                    key={avatar.key}
                    ref={(el) => {
                      mergedAvatarRefs.current[i] = el;
                    }}
                    src={avatar.url}
                    avatarFilePath={avatar.avatarFilePath}
                    avatarFilename={avatar.avatarFilename}
                    alt="Group"
                    loading="lazy"
                    decoding="async"
                    thumbnailSize={64}
                    className="absolute inset-0 h-8 w-8 object-cover transition-opacity duration-700"
                    style={{ opacity: i === 0 ? 1 : 0, ...getAvatarCropStyle(avatar.crop) }}
                    onResolvedSrc={(src) => rememberMergedAvatarSrc(avatar.key, src)}
                  />
                ))}
              </button>
            ) : avatarUrl ? (
              <button
                type="button"
                className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full"
                onClick={() => avatarLightboxUrl && openImageLightbox(avatarLightboxUrl)}
                aria-label={`Open ${displayName} avatar`}
              >
                <ResolvedAvatarImage
                  src={avatarUrl}
                  avatarFilePath={avatarFilePath}
                  avatarFilename={avatarFilename}
                  alt={displayName}
                  loading="lazy"
                  decoding="async"
                  thumbnailSize={64}
                  className="h-full w-full object-cover"
                  style={avatarCropStyle}
                  onResolvedSrc={handleResolvedAvatarSrc}
                />
              </button>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-[0.6875rem] font-bold text-[var(--muted-foreground)]">
                {displayName[0]}
              </div>
            )}
            {(showActions || showMessageNumbers) && messageIndex != null && (
              <span className="mt-0.5 text-[0.5rem] font-medium text-[var(--muted-foreground)] select-none">
                #{messageIndex}
              </span>
            )}
          </div>
        )}

        <div
          className={cn(
            "mari-message-body flex flex-col gap-0.5",
            isUser ? "items-end" : "items-start",
            editing && "w-full",
          )}
        >
          {/* Name — only for first in group */}
          {!isGrouped && !isUser && (
            <div className="flex items-center gap-2 px-3">
              {hiddenFromAIHeader}
              <span
                className={cn(
                  "mari-message-name text-[0.6875rem] font-semibold",
                  !msgNameColor && !isMergedGroup && "text-[var(--muted-foreground)]",
                )}
                style={!isMergedGroup ? nameColorStyle(msgNameColor) : undefined}
              >
                {isMergedGroup ? mergedNameElement : displayName}
              </span>
            </div>
          )}

          {/* Conversation start marker */}
          {isConversationStart && (
            <div className="flex items-center gap-1.5 px-2 mb-0.5">
              <span className="h-px flex-1 bg-amber-500/30" />
              <span className="text-[0.5625rem] font-semibold uppercase tracking-widest text-amber-500/70">
                New Start
              </span>
              <span className="h-px flex-1 bg-amber-500/30" />
            </div>
          )}

          {/* Bubble */}
          <div
            className={cn(
              "mari-message-bubble texting-bubble relative px-3.5 py-2",
              isUser
                ? "texting-bubble-user rounded-2xl rounded-br-md"
                : "texting-bubble-other rounded-2xl rounded-bl-md",
              isGrouped && isUser && "rounded-br-2xl rounded-tr-md",
              isGrouped && !isUser && "rounded-bl-2xl rounded-tl-md",
              isStreaming && "ring-2 ring-[var(--primary)]/20",
              isConversationStart && "ring-1 ring-amber-500/30",
              editing && "w-full",
            )}
            style={{ ...messageTextStyle, ...(boxBgColor ? { backgroundColor: boxBgColor } : {}) }}
          >
            {isHiddenCollapsed ? null : editing ? (
              <EditTextarea
                initialContent={message.content}
                fontSize={chatFontSize}
                quoteFormat={quoteFormat}
                onSave={handleSaveEdit}
                onCancel={handleCancelEdit}
              />
            ) : (
              <>
                <div className={cn("mari-message-content break-words", !isHtmlContent && "whitespace-pre-wrap")}>
                  {isStreaming && !message.content ? (
                    <div className="mari-message-typing flex items-center gap-1 py-0.5">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted-foreground)]/60 [animation-delay:0ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted-foreground)]/60 [animation-delay:150ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted-foreground)]/60 [animation-delay:300ms]" />
                    </div>
                  ) : (
                    <>
                      {renderedContent}
                      {isStreaming && (
                        <span className="ml-0.5 inline-block h-4 w-[0.125rem] animate-pulse rounded-full bg-white/70" />
                      )}
                    </>
                  )}
                </div>
                {/* Translation */}
                {(translatedText || isTranslating) && (
                  <div className="mt-2 border-t border-[var(--border)] pt-2">
                    {isTranslating ? (
                      <span className="text-[0.75rem] italic text-[var(--muted-foreground)]">Translating…</span>
                    ) : (
                      <div className="whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-[var(--muted-foreground)]">
                        {translatedText}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Image attachments (illustrations, selfies) */}
          {!editing && attachments.length > 0 && !IMAGE_URL_RE.test(message.content.trim()) && (
            <div className="mt-1.5 flex flex-col items-center gap-2 px-3 pb-2">
              {attachments.map((att, i) => {
                const imageSource = isImageMessageAttachment(att) ? messageAttachmentImageSource(att) : null;
                return imageSource ? (
                  <div key={i} className="group/att relative inline-block">
                    <button
                      type="button"
                      onClick={() => openImageLightbox(imageSource, att.prompt)}
                      className="block"
                      title="Open image"
                      aria-label={`Open ${messageAttachmentImageAlt(att)}`}
                    >
                      <img
                        src={imageSource}
                        alt={messageAttachmentImageAlt(att)}
                        className="max-h-80 max-w-full rounded-lg"
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(i)}
                      aria-label="Remove image from message"
                      title="Remove from message"
                      className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white/80 transition-opacity hover:bg-black/80 hover:text-white sm:opacity-0 sm:group-hover/att:opacity-100"
                    >
                      <X size="0.875rem" />
                    </button>
                  </div>
                ) : null;
              })}
            </div>
          )}

          {/* Timestamp + model — only for last in a group or standalone */}
          {!isGrouped && (
            <div className={cn("mari-message-meta flex items-center gap-2 px-3", isUser && "flex-row-reverse")}>
              <span className="mari-message-timestamp text-[0.625rem] text-[var(--muted-foreground)]/50">
                {formatTime(message.createdAt)}
              </span>
              {genLabel && (
                <span
                  className="text-[0.5625rem] text-[var(--muted-foreground)]/40 italic truncate max-w-[15.625rem]"
                  title={genLabel}
                >
                  {genLabel}
                </span>
              )}
            </div>
          )}

          {/* Swipes */}
          {hasSwipes && (
            <SwipeJumpControl
              activeSwipeIndex={message.activeSwipeIndex}
              swipeCount={swipeCount}
              onSetActiveSwipe={(index) => onSetActiveSwipe?.(message.id, index)}
              onCreateNextSwipe={
                onRegenerate
                  ? () => onRegenerate(message.id, { forCharacterId: message.characterId ?? null })
                  : undefined
              }
              className="px-2 text-[0.75rem] text-[var(--muted-foreground)]"
              buttonClassName="rounded p-[0.25em] transition-colors hover:bg-[var(--accent)] disabled:opacity-30"
              iconSize={MESSAGE_SWIPE_ICON_SIZE}
            />
          )}

          {/* Hover actions (tap to toggle on mobile) */}
          <div
            className={cn(
              "mari-message-actions flex items-center gap-0 px-1 opacity-0 transition-all group-hover:opacity-100",
              isUser && "flex-row-reverse",
              showActions && "opacity-100",
            )}
          >
            <ActionBtn
              icon={copied ? "✓" : <Copy size={MESSAGE_ACTION_ICON_SIZE} />}
              onClick={handleCopy}
              title="Copy"
            />
            <ActionBtn
              icon={<Languages size={MESSAGE_ACTION_ICON_SIZE} />}
              onClick={() => void translate(message.id, message.content, message.chatId)}
              title={translatedText ? "Hide translation" : "Translate"}
              className={translatedText ? "text-blue-500" : undefined}
            />
            {generationDurationLabel && (
              <ActionBtn
                icon={<Timer size={MESSAGE_ACTION_ICON_SIZE} />}
                onClick={() => undefined}
                title={generationDurationTitle}
              />
            )}
            {onEdit && (
              <ActionBtn icon={<Pencil size={MESSAGE_ACTION_ICON_SIZE} />} onClick={startEditing} title="Edit" />
            )}
            {onRegenerate && (
              <ActionBtn
                icon={<RefreshCw size={MESSAGE_ACTION_ICON_SIZE} />}
                onClick={() => onRegenerate(message.id, { forCharacterId: message.characterId ?? null })}
                title={regenerateButtonTitle}
                className={regenerateGuidedClass}
              />
            )}
            {onToggleConversationStart && (
              <ActionBtn
                icon={<Flag size={MESSAGE_ACTION_ICON_SIZE} />}
                onClick={() => onToggleConversationStart(message.id, isConversationStart)}
                title={isConversationStart ? "Remove conversation start" : "Mark as new start"}
                className={isConversationStart ? "text-amber-500" : undefined}
              />
            )}
            {!isUser && (
              <ActionBtn
                icon={<Search size={MESSAGE_ACTION_ICON_SIZE} />}
                onClick={() =>
                  onPeekPrompt?.({
                    forCharacterId: message.characterId ?? null,
                    messageId: message.id,
                    promptSnapshot: activePromptSnapshot,
                  })
                }
                title="Peek prompt"
              />
            )}
            {generationReplay && (
              <ActionBtn
                icon={<ScrollText size={MESSAGE_ACTION_ICON_SIZE} />}
                onClick={() => setShowGenerationReplay(true)}
                title="Stored guidance"
              />
            )}
            {thinking && !isUser && (
              <ActionBtn
                icon={<Brain size={MESSAGE_ACTION_ICON_SIZE} />}
                onClick={() => setShowThinking(true)}
                title="View thoughts"
              />
            )}
            {onBranch && (
              <ActionBtn
                icon={<GitBranch size={MESSAGE_ACTION_ICON_SIZE} />}
                onClick={() => onBranch(message.id)}
                title="Branch from here"
              />
            )}
            {onCloneSceneFromHere && (
              <ActionBtn
                icon={<GitBranch size={MESSAGE_ACTION_ICON_SIZE} />}
                onClick={() => onCloneSceneFromHere(message.id)}
                title="Clone from here"
                disabled={isCloneSceneFromHereDisabled}
              />
            )}
            {onDelete && (
              <ActionBtn
                icon={<Trash2 size={MESSAGE_ACTION_ICON_SIZE} />}
                onClick={() => onDelete(message.id)}
                title="Delete"
                className="hover:text-[var(--destructive)]"
              />
            )}
            {ttsEnabled && (
              <>
                {isSpeakingThis && !isLoadingThis && (
                  <>
                    <ActionBtn
                      icon={
                        isPausedThis ? (
                          <Play size={MESSAGE_ACTION_ICON_SIZE} />
                        ) : (
                          <Pause size={MESSAGE_ACTION_ICON_SIZE} />
                        )
                      }
                      onClick={handlePauseResumeTTS}
                      title={isPausedThis ? "Resume speaking" : "Pause speaking"}
                      className="text-sky-500"
                    />
                    <ActionBtn
                      icon={<RefreshCw size={MESSAGE_ACTION_ICON_SIZE} />}
                      onClick={handleRestartTTS}
                      title="Restart speaking"
                      className="text-sky-500"
                    />
                  </>
                )}
                <ActionBtn
                  icon={
                    isLoadingThis ? (
                      <Loader2 size={MESSAGE_ACTION_ICON_SIZE} className="animate-spin" />
                    ) : isSpeakingThis || streamingTTSActive ? (
                      <VolumeX size={MESSAGE_ACTION_ICON_SIZE} />
                    ) : (
                      <Volume2 size={MESSAGE_ACTION_ICON_SIZE} />
                    )
                  }
                  onClick={handleSpeak}
                  title={
                    streamingTTSActive
                      ? "Stop streaming narration"
                      : !hasTTSContent
                        ? "No dialogue to speak"
                        : isLoadingThis
                          ? "Loading…"
                          : isSpeakingThis
                            ? "Stop speaking"
                            : "Speak"
                  }
                  className={isSpeakingThis || streamingTTSActive ? "text-sky-500" : undefined}
                  disabled={!streamingTTSActive && (!hasTTSContent || (ttsBusy && !isSpeakingThis))}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Thinking modal */}
      {showThinking && thinking && <ThinkingModal thinking={thinking} onClose={() => setShowThinking(false)} />}
      {generationReplay && (
        <GenerationReplayDetailsModal
          open={showGenerationReplay}
          replay={generationReplay}
          onClose={() => setShowGenerationReplay(false)}
        />
      )}

      {/* Avatar lightbox */}
      {avatarLightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80"
          onClick={closeImageLightbox}
        >
          <div
            className="flex max-h-[90vh] w-[min(90vw,64rem)] max-w-[90vw] flex-col items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={avatarLightbox}
              alt={displayName}
              decoding="async"
              className={
                avatarLightboxPrompt?.trim()
                  ? "max-h-[calc(90vh-9rem)] max-w-full rounded-lg object-contain shadow-2xl"
                  : "max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
              }
            />
            <ImagePromptPanel prompt={avatarLightboxPrompt} className="w-full max-w-3xl" />
          </div>
          <button
            type="button"
            onClick={closeImageLightbox}
            aria-label="Close image"
            className="absolute right-3 top-3 rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
          >
            <X size="1rem" />
          </button>
        </div>
      )}
    </div>
  );
});

// ── Thinking modal ──
function ThinkingModal({ thinking, onClose }: { thinking: string; onClose: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm max-md:pt-[env(safe-area-inset-top)]"
      onClick={onClose}
    >
      <div
        className="relative mx-4 flex max-h-[70vh] w-full max-w-xl flex-col rounded-xl bg-[var(--card)] shadow-2xl ring-1 ring-[var(--border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
            <Brain size="0.875rem" className="text-[var(--muted-foreground)]" />
            Model Thoughts
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close thoughts"
            className="rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          >
            <X size="0.875rem" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-3">
          <pre className="whitespace-pre-wrap break-words text-[0.8125rem] leading-relaxed text-[var(--muted-foreground)]">
            {thinking}
          </pre>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Action button ──
function ActionBtn({
  icon,
  onClick,
  title,
  className,
  dark,
  disabled,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  title: string;
  className?: string;
  dark?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={cn(
        "rounded-md p-[0.35em] text-[0.8125rem] transition-all active:scale-90 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-30",
        dark
          ? "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70"
          : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
        className,
      )}
    >
      {icon}
    </button>
  );
}

function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
