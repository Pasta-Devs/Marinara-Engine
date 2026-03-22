// ──────────────────────────────────────────────
// Chat: Message — mode-aware rendering
// ──────────────────────────────────────────────
import { cn, getAvatarCropStyle } from "../../lib/utils";
import {
  User,
  Bot,
  ChevronLeft,
  ChevronRight,
  Copy,
  RefreshCw,
  Trash2,
  GitBranch,
  Pencil,
  Check,
  X,
  Flag,
  Eye,
  Brain,
} from "lucide-react";
import type { Message } from "@marinara-engine/shared";
import { memo, useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback, type ReactNode } from "react";
import type { CharacterMap } from "./ChatArea";
import { useApplyRegex } from "../../hooks/use-apply-regex";
import { useUIStore } from "../../stores/ui.store";
import DOMPurify from "dompurify";

/** Isolated edit textarea — uncontrolled to avoid React re-renders on every keystroke. */
const EditTextarea = memo(function EditTextarea({
  initialContent,
  fontSize,
  onSave,
  onCancel,
}: {
  initialContent: string;
  fontSize: string | number | undefined;
  onSave: (content: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    if (ref.current) {
      ref.current.style.height = ref.current.scrollHeight + "px";
      ref.current.focus({ preventScroll: true });
    }
  }, []);

  const handleSave = useCallback(() => {
    if (ref.current) onSave(ref.current.value);
  }, [onSave]);

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={ref}
        defaultValue={initialContent}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
          if (e.key === "Escape") onCancel();
        }}
        className="w-full resize-none rounded-lg bg-black/30 px-3 py-2 text-white outline-none ring-1 ring-white/20 focus:ring-blue-400/50"
        style={{ fontSize, lineHeight: 1.5, fieldSizing: "content" } as React.CSSProperties}
      />
      <div className="flex items-center gap-1.5 justify-end">
        <button
          onClick={onCancel}
          className="rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white/70"
          title="Cancel (Esc)"
        >
          <X size="0.8125rem" />
        </button>
        <button
          onClick={handleSave}
          className="rounded-md p-1 text-emerald-400/70 hover:bg-emerald-400/10 hover:text-emerald-400"
          title="Save (Cmd+Enter)"
        >
          <Check size="0.8125rem" />
        </button>
      </div>
    </div>
  );
});

interface PersonaInfo {
  name?: string;
  avatarUrl?: string;
  nameColor?: string;
  dialogueColor?: string;
  boxColor?: string;
}

interface ChatMessageProps {
  message: Message & { swipes?: Array<{ id: string; content: string }> };
  isStreaming?: boolean;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  onSetActiveSwipe?: (messageId: string, index: number) => void;
  onToggleConversationStart?: (messageId: string, current: boolean) => void;
  onPeekPrompt?: () => void;
  onBranch?: (messageId: string) => void;
  isLastAssistantMessage?: boolean;
  characterMap?: CharacterMap;
  chatMode?: string;
  isGrouped?: boolean;
  personaInfo?: PersonaInfo;
  groupChatMode?: string;
  chatCharacterIds?: string[];
}

/** Regex to match <speaker="name">dialogue</speaker> tags. */
const SPEAKER_TAG_RE = /<speaker="([^"]*)">([\s\S]*?)<\/speaker>/g;

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
  const renderLine = boldDialogue ? highlightDialogue : (t: string) => applyInlineMarkdown(t, "m");

  if (!speakerColorMap || !SPEAKER_TAG_RE.test(text)) {
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
    const speakerName = match[1]!;
    const dialogue = match[2]!;
    const speakerColor = speakerColorMap.get(speakerName) ?? defaultDialogueColor;
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

/**
 * Apply markdown-style inline formatting: **bold** and *italic*.
 * Returns an array of ReactNodes.
 */
function applyInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  // Match **bold** first, then *italic* (order matters to avoid conflict)
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[2] != null) {
      // **bold**
      nodes.push(<strong key={`${keyPrefix}b${key++}`}>{match[2]}</strong>);
    } else if (match[3] != null) {
      // *italic*
      nodes.push(<em key={`${keyPrefix}i${key++}`}>{match[3]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes.length > 0 ? nodes : [text];
}

/**
 * Highlight quoted dialogue — text in "", "", «», or '' gets bold + colored.
 * Returns an array of ReactNodes (strings + <strong> elements).
 */
function highlightDialogue(text: string, dialogueColor?: string): ReactNode[] {
  // Match text in various quotation marks (curly doubles already normalised to straight)
  const regex = /(?:"([^"]+)"|«([^»]+)»|‘([^’]+)’)/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match — apply inline markdown
    if (match.index > lastIndex) {
      nodes.push(...applyInlineMarkdown(text.slice(lastIndex, match.index), `d${key}`));
    }
    // The full match including quotes
    const fullMatch = match[0];
    // Determine which capture group matched
    const innerText = match[1] ?? match[2] ?? match[3] ?? "";
    // Get the opening and closing quotes from the full match
    const openQuote = fullMatch[0];
    const closeQuote = fullMatch[fullMatch.length - 1];

    nodes.push(
      <strong
        key={key++}
        style={dialogueColor ? { color: dialogueColor } : undefined}
        className={!dialogueColor ? "text-white" : undefined}
      >
        {openQuote}
        {applyInlineMarkdown(innerText, `dq${key}`)}
        {closeQuote}
      </strong>,
    );
    lastIndex = match.index + fullMatch.length;
  }

  // Add remaining text — apply inline markdown
  if (lastIndex < text.length) {
    nodes.push(...applyInlineMarkdown(text.slice(lastIndex), `d${key}`));
  }

  return nodes.length > 0 ? nodes : applyInlineMarkdown(text, "m");
}

/** Check whether text contains meaningful HTML tags. */
const HTML_TAG_RE =
  /<(?:div|span|style|table|p|br|img|a|ul|ol|li|h[1-6]|em|strong|b|i|pre|code|section|article|header|footer|nav|button|input|form|label|select|option|textarea|canvas|svg|video|audio|source|iframe|hr|blockquote|details|summary|figure|figcaption|main|aside|mark|small|sub|sup|del|ins|abbr|time|progress|meter|output|dialog|template|slot|ruby|rt|rp|bdi|bdo|wbr|area|map|track|embed|object|param|picture|portal|datalist|fieldset|legend|optgroup|caption|col|colgroup|thead|tbody|tfoot|th|td|dl|dt|dd|kbd|samp|var|cite|dfn|q|s|u|font|center)\b[^>]*>/i;

/**
 * Render message content, handling both plain text with dialogue highlighting
 * and HTML blocks that should be rendered as actual HTML.
 */
function renderContent(
  text: string,
  dialogueColor?: string,
  speakerColorMap?: Map<string, string>,
  boldDialogue = true,
): ReactNode {
  // Normalise curly quotes to straight so they display consistently
  const normalized = text.replace(/[“”„‟]/g, '"').replace(/[‘’]/g, "'");

  // Strip speaker tags before HTML detection (they aren't real HTML)
  const withoutSpeakerTags = normalized.replace(/<\/?speaker(?:="[^"]*")?>/g, "");

  if (!HTML_TAG_RE.test(withoutSpeakerTags)) {
    // Split on *** horizontal rules (standalone line)
    const hrParts = normalized.split(/^\*{3,}$/m);
    if (hrParts.length > 1) {
      return (
        <>
          {hrParts.map((part, i) => (
            <span key={i}>
              {i > 0 && <hr className="my-3 border-t border-[var(--border)]" />}
              {renderWithSpeakerTags(part, dialogueColor, speakerColorMap, boldDialogue)}
            </span>
          ))}
        </>
      );
    }
    return <>{renderWithSpeakerTags(normalized, dialogueColor, speakerColorMap, boldDialogue)}</>;
  }

  // For HTML content, replace speaker tags with color-annotated spans (preserves per-character colors)
  const stripped = speakerColorMap
    ? normalized.replace(SPEAKER_TAG_RE, (_, name, dialogue) => {
        const color = speakerColorMap.get(name as string);
        return color ? `<span data-spk="${color}">${dialogue as string}</span>` : (dialogue as string);
      })
    : normalized.replace(SPEAKER_TAG_RE, "$2");

  // Convert newlines to <br> with compact spacing for HTML content,
  // but preserve newlines inside <style> blocks (they're harmless in CSS
  // and injecting <br> tags would corrupt the stylesheet).
  const withBreaks = stripped.replace(/(<style[\s\S]*?<\/style>)|\n/gi, (m, styleBlock) =>
    styleBlock ? styleBlock : '<br style="display:block;margin:0.2em 0">',
  );

  // Content has HTML — sanitize and render it
  const clean = DOMPurify.sanitize(withBreaks, {
    ADD_ATTR: ["style", "class"],
    ALLOW_DATA_ATTR: true,
  });

  // Apply dialogue bolding inside sanitised HTML with per-speaker color support.
  const withDialogue = boldDialogue
    ? (() => {
        // Sanitize a CSS color value — only allow safe color formats
        const safeColor = (c: string) =>
          /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|rgba?\([\d,.\s%]+\)|hsla?\([\d,.\s%]+\))$/.test(c) ? c : "inherit";
        // Pass 1: Bold quotes inside speaker-annotated spans with their specific colors
        const afterSpeaker = clean.replace(
          /<span[^>]*\bdata-spk="([^"]*)"[^>]*>([\s\S]*?)<\/span>/g,
          (_m: string, color: string, content: string) => {
            const validColor = safeColor(color);
            return content.replace(/(?<![=\w])"([^"<>]+)"/g, `<strong style="color:${validColor}">"$1"</strong>`);
          },
        );
        // Pass 2: Bold remaining quotes with default dialogue color, skipping already-bolded text
        return afterSpeaker.replace(/(?<![=\w])"([^"<>]+)"/g, (match, inner, offset) => {
          const before = afterSpeaker.slice(0, offset);
          // Skip if already inside a <strong> from pass 1
          if (/<strong[^>]*>\s*$/.test(before.slice(Math.max(0, before.length - 300)))) return match;
          // Skip if inside a <font> tag (author-specified colors take priority)
          const lastFontOpen = before.lastIndexOf("<font ");
          if (lastFontOpen !== -1) {
            const lastFontClose = before.lastIndexOf("</font>");
            if (lastFontClose < lastFontOpen) return match;
          }
          const boldColor = dialogueColor ?? "white";
          return `<strong style="color:${boldColor}">"${inner}"</strong>`;
        });
      })()
    : clean;

  // Convert *** horizontal rules to <hr> tags in HTML path
  const withHr = withDialogue.replace(
    /(?:^|(?<=<br[^>]*>))\s*\*{3,}\s*(?:$|(?=<br[^>]*>))/g,
    '<hr style="margin:0.75em 0;border:0;border-top:1px solid var(--border)">',
  );

  // Apply markdown-style bold/italic in HTML path
  const withMarkdown = withHr
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");

  return <div className="overflow-hidden" dangerouslySetInnerHTML={{ __html: withMarkdown }} />;
}

/** Build style object for name color (supports gradients). */
function nameColorStyle(color?: string): React.CSSProperties | undefined {
  if (!color) return undefined;
  if (color.startsWith("linear-gradient")) {
    return {
      background: color,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
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
  onPeekPrompt,
  onBranch,
  isLastAssistantMessage,
  characterMap,
  chatMode,
  isGrouped,
  personaInfo,
  groupChatMode,
  chatCharacterIds,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isNarrator = message.role === "narrator";
  const isRoleplay = chatMode === "roleplay" || chatMode === "visual_novel";
  const chatFontSize = useUIStore((s) => s.chatFontSize);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const scrollRestoreRef = useRef<{ el: HTMLElement; top: number } | null>(null);
  const msgRef = useRef<HTMLDivElement>(null);

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

  const handleMobileTap = useCallback((e: React.MouseEvent) => {
    // Only toggle on touch devices
    if (!matchMedia("(pointer: coarse)").matches) return;
    // Don't toggle when tapping buttons, links, or the edit textarea
    const target = e.target as HTMLElement;
    if (target.closest("button, a, textarea")) return;
    setShowActions((v) => !v);
  }, []);

  // Parse message extra for conversation start flag
  const extra = useMemo(() => {
    if (!message.extra) return {};
    return typeof message.extra === "string" ? JSON.parse(message.extra) : message.extra;
  }, [message.extra]);
  const isConversationStart = !!extra.isConversationStart;
  const thinking = extra.thinking as string | undefined;

  // Model name display
  const showModelName = useUIStore((s) => s.showModelName);
  const _modelName = !isUser && showModelName ? (extra.generationInfo?.model ?? null) : null;
  const genInfo = !isUser && showModelName ? extra.generationInfo : null;
  const genLabel = useMemo(() => {
    if (!genInfo) return null;
    const parts: string[] = [];
    if (genInfo.model) parts.push(genInfo.model);
    if (genInfo.tokensPrompt != null || genInfo.tokensCompletion != null) {
      const p = genInfo.tokensPrompt ?? "?";
      const c = genInfo.tokensCompletion ?? "?";
      parts.push(`${p}→${c} tok`);
    }
    if (genInfo.durationMs != null) parts.push(`${(genInfo.durationMs / 1000).toFixed(1)}s`);
    return parts.length > 0 ? parts.join(" · ") : null;
  }, [genInfo]);
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

  const handleSaveEdit = useCallback(
    (content: string) => {
      if (content.trim() !== message.content) {
        onEdit?.(message.id, content.trim());
      }
      setEditing(false);
    },
    [message.content, message.id, onEdit],
  );

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  // Apply regex scripts to AI output (assistant/narrator roles)
  const { applyToAIOutput } = useApplyRegex();

  // Resolve character info
  const charInfo = message.characterId && characterMap ? characterMap.get(message.characterId) : null;
  const userName = personaInfo?.name ?? "You";
  const charName = charInfo?.name ?? message.characterId ?? "Assistant";

  const displayContent = useMemo(() => {
    let text = isUser || isSystem ? message.content : applyToAIOutput(message.content);
    // Resolve common display macros
    text = text.replaceAll("{{user}}", userName);
    text = text.replaceAll("{{char}}", charName);
    return text;
  }, [message.content, isUser, isSystem, applyToAIOutput, userName, charName]);

  const displayName = isUser ? userName : charName;
  const avatarUrl = isUser ? (personaInfo?.avatarUrl ?? null) : (charInfo?.avatarUrl ?? null);
  const avatarCropStyle = isUser ? {} : getAvatarCropStyle(charInfo?.avatarCrop);

  // Resolve colors: character colors for assistant, persona colors for user
  const msgColors = isUser ? personaInfo : charInfo;
  const dialogueColor = msgColors?.dialogueColor;
  const boxBgColor = msgColors?.boxColor;
  const msgNameColor = msgColors?.nameColor;

  // Build speaker → dialogueColor map for group chat speaker tag coloring
  const speakerColorMap = useMemo(() => {
    if (!characterMap || characterMap.size <= 1) return undefined;
    const map = new Map<string, string>();
    for (const [, info] of characterMap) {
      if (info.name && info.dialogueColor) {
        map.set(info.name, info.dialogueColor);
      }
    }
    return map.size > 0 ? map : undefined;
  }, [characterMap]);

  // Merged group chat: cycling avatars + cycling name color
  const isMergedGroup = groupChatMode === "merged" && !isUser && chatCharacterIds && chatCharacterIds.length > 1;
  const mergedAvatars = useMemo(() => {
    if (!isMergedGroup || !characterMap || !chatCharacterIds) return [];
    return chatCharacterIds
      .map((id) => {
        const info = characterMap.get(id);
        if (!info?.avatarUrl) return null;
        return { url: info.avatarUrl, crop: info.avatarCrop };
      })
      .filter(Boolean) as { url: string; crop?: { zoom: number; offsetX: number; offsetY: number } | null }[];
  }, [isMergedGroup, characterMap, chatCharacterIds]);
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
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
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
  const boldDialogue = useUIStore((s) => s.boldDialogue) ?? true;
  const renderedContent = useMemo(() => {
    return renderContent(text, dialogueColor, speakerColorMap, boldDialogue);
  }, [text, dialogueColor, speakerColorMap, boldDialogue]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // ─── Swipe navigation ───
  const swipeCount = message.swipeCount ?? 0;
  const hasSwipes = swipeCount > 1;

  const handleSwipePrev = useCallback(() => {
    if (message.activeSwipeIndex > 0) {
      onSetActiveSwipe?.(message.id, message.activeSwipeIndex - 1);
    }
  }, [message.id, message.activeSwipeIndex, onSetActiveSwipe]);

  const handleSwipeNext = useCallback(() => {
    if (message.activeSwipeIndex < swipeCount - 1) {
      onSetActiveSwipe?.(message.id, message.activeSwipeIndex + 1);
    }
  }, [message.id, message.activeSwipeIndex, swipeCount, onSetActiveSwipe]);

  // ─── System messages (shared across modes) ───
  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <div className="rounded-full bg-[var(--secondary)] px-4 py-1.5 text-[0.6875rem] text-[var(--muted-foreground)]">
          {message.content}
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
        <div ref={msgRef} className="rpg-narrator-msg group mb-4 px-2" onClick={handleMobileTap}>
          <div className="relative rounded-xl border border-amber-500/10 bg-black/40 px-5 py-4">
            {/* Delete button */}
            {onDelete && (
              <button
                onClick={() => onDelete(message.id)}
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
              Narrator
              <span className="h-px flex-1 bg-amber-400/20" />
            </div>
            <div
              className="whitespace-pre-wrap break-words text-amber-100/80 italic"
              style={{ fontSize: chatFontSize, lineHeight: 1.5 }}
            >
              {displayContent}
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        <div
          ref={msgRef}
          className={cn("group mb-4 flex gap-3 px-2", isUser && "flex-row-reverse")}
          onClick={handleMobileTap}
        >
          {/* Avatar Column */}
          {!isGrouped && (
            <div className="flex-shrink-0 pt-1">
              {isMergedGroup && mergedAvatars.length > 0 ? (
                <div className="rpg-avatar-glow relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-white/10">
                  {mergedAvatars.map((avatar, i) => (
                    <img
                      key={avatar.url}
                      ref={(el) => {
                        mergedAvatarRefs.current[i] = el;
                      }}
                      src={avatar.url}
                      alt="Group"
                      className="absolute inset-0 h-10 w-10 object-cover transition-opacity duration-700"
                      style={{ opacity: i === 0 ? 1 : 0, ...getAvatarCropStyle(avatar.crop) }}
                    />
                  ))}
                </div>
              ) : avatarUrl ? (
                <div className={cn(!isUser && "rpg-avatar-glow")}>
                  <div className="h-10 w-10 overflow-hidden rounded-full ring-2 ring-white/10">
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="h-full w-full object-cover"
                      style={avatarCropStyle}
                    />
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full ring-2 shadow-lg",
                    isUser
                      ? "bg-gradient-to-br from-neutral-500 to-neutral-600 ring-white/15"
                      : "bg-gradient-to-br from-purple-500 to-pink-600 ring-purple-400/20",
                  )}
                >
                  {isUser ? <User size="1rem" className="text-white" /> : <Bot size="1rem" className="text-white" />}
                </div>
              )}
            </div>
          )}

          {/* Spacer if grouped (no avatar) */}
          {isGrouped && <div className="w-10 flex-shrink-0" />}

          {/* Content */}
          <div className={cn("flex min-w-0 max-w-[82%] flex-col gap-0.5", isUser && "items-end", editing && "w-[82%]")}>
            {/* Name + time (only if not grouped) */}
            {!isGrouped && (
              <div className={cn("flex items-baseline gap-2 px-1", isUser && "flex-row-reverse")}>
                <span
                  className={cn(
                    "text-[0.75rem] font-bold tracking-tight",
                    !msgNameColor && !isMergedGroup && (isUser ? "text-neutral-300" : "rpg-char-name"),
                  )}
                  style={!isMergedGroup ? nameColorStyle(msgNameColor) : undefined}
                >
                  {isMergedGroup ? mergedNameElement : displayName}
                </span>
                <span className="text-[0.625rem] text-white/30">{formatTime(message.createdAt)}</span>
                {genLabel && (
                  <span className="text-[0.5625rem] text-white/25 italic truncate max-w-[15.625rem]" title={genLabel}>
                    {genLabel}
                  </span>
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
                "relative overflow-hidden rounded-2xl px-4 py-3 shadow-lg shadow-black/20",
                isUser
                  ? "rounded-tr-sm text-neutral-100 ring-1 ring-white/10"
                  : "rounded-tl-sm text-white/90 ring-1 ring-white/8",
                !boxBgColor && (isUser ? "bg-black/30 dark:bg-neutral-900/70" : "bg-black/20 dark:bg-neutral-900/60"),
                isGrouped && (isUser ? "rounded-tr-2xl" : "rounded-tl-2xl"),
                isStreaming && "rpg-streaming",
                isConversationStart && "ring-amber-400/30",
                editing && "w-full",
              )}
              style={{
                fontSize: chatFontSize,
                lineHeight: 1.5,
                ...(boxBgColor ? { backgroundColor: boxBgColor } : {}),
              }}
            >
              {editing ? (
                <EditTextarea
                  initialContent={message.content}
                  fontSize={chatFontSize}
                  onSave={handleSaveEdit}
                  onCancel={handleCancelEdit}
                />
              ) : (
                <div className={cn("break-words", !isHtmlContent && "whitespace-pre-wrap")}>
                  {isStreaming && !message.content ? (
                    <div className="flex items-center gap-1 py-0.5">
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
              )}
            </div>

            {/* Swipes */}
            {hasSwipes && (
              <div className="flex items-center gap-1.5 px-1 text-[0.625rem] text-white/40">
                <button
                  className="rounded-md p-0.5 transition-colors hover:bg-white/10 disabled:opacity-30"
                  onClick={handleSwipePrev}
                  disabled={message.activeSwipeIndex <= 0}
                >
                  <ChevronLeft size="0.75rem" />
                </button>
                <span className="tabular-nums">
                  {message.activeSwipeIndex + 1}/{swipeCount}
                </span>
                <button
                  className="rounded-md p-0.5 transition-colors hover:bg-white/10 disabled:opacity-30"
                  onClick={handleSwipeNext}
                  disabled={message.activeSwipeIndex >= swipeCount - 1}
                >
                  <ChevronRight size="0.75rem" />
                </button>
              </div>
            )}

            {/* Hover actions (tap to toggle on mobile) */}
            <div
              className={cn(
                "flex items-center gap-0.5 px-1 opacity-0 transition-all group-hover:opacity-100",
                isUser && "flex-row-reverse",
                showActions && "opacity-100",
              )}
            >
              <ActionBtn icon={copied ? "\u2713" : <Copy size="0.6875rem" />} onClick={handleCopy} title="Copy" dark />
              <ActionBtn icon={<Pencil size="0.6875rem" />} onClick={startEditing} title="Edit" dark />
              <ActionBtn
                icon={<RefreshCw size="0.6875rem" />}
                onClick={() => onRegenerate?.(message.id)}
                title="Regenerate"
                dark
              />
              <ActionBtn
                icon={<Flag size="0.6875rem" />}
                onClick={() => onToggleConversationStart?.(message.id, isConversationStart)}
                title={isConversationStart ? "Remove conversation start" : "Mark as new start"}
                className={isConversationStart ? "text-amber-400/80 hover:text-amber-300" : undefined}
                dark
              />
              {isLastAssistantMessage && !isUser && (
                <ActionBtn icon={<Eye size="0.6875rem" />} onClick={() => onPeekPrompt?.()} title="Peek prompt" dark />
              )}
              {thinking && !isUser && (
                <ActionBtn
                  icon={<Brain size="0.6875rem" />}
                  onClick={() => setShowThinking(true)}
                  title="View thoughts"
                  dark
                />
              )}
              <ActionBtn
                icon={<GitBranch size="0.6875rem" />}
                onClick={() => onBranch?.(message.id)}
                title="Branch from here"
                dark
              />
              <ActionBtn
                icon={<Trash2 size="0.6875rem" />}
                onClick={() => onDelete?.(message.id)}
                title="Delete"
                className="hover:text-red-400"
                dark
              />
            </div>
          </div>
        </div>

        {/* Thinking modal */}
        {showThinking && thinking && <ThinkingModal thinking={thinking} onClose={() => setShowThinking(false)} />}
      </>
    );
  }

  // ═══════════════════════════════════════════════
  // Conversation Mode — iMessage / texting style
  // ═══════════════════════════════════════════════
  return (
    <div
      ref={msgRef}
      className={cn("group flex", isUser ? "justify-end" : "justify-start", isGrouped ? "mb-0.5" : "mb-3")}
      onClick={handleMobileTap}
    >
      <div
        className={cn("flex min-w-0 max-w-[72%] gap-2", isUser && "flex-row-reverse", editing && "w-[85%] max-w-[85%]")}
      >
        {/* Avatar — only show for first in group */}
        {(!isUser || avatarUrl) && (
          <div className={cn("flex-shrink-0 self-end", isGrouped && "invisible")}>
            {isMergedGroup && mergedAvatars.length > 0 ? (
              <div className="relative h-8 w-8 overflow-hidden rounded-full">
                {mergedAvatars.map((avatar, i) => (
                  <img
                    key={avatar.url}
                    ref={(el) => {
                      mergedAvatarRefs.current[i] = el;
                    }}
                    src={avatar.url}
                    alt="Group"
                    className="absolute inset-0 h-8 w-8 object-cover transition-opacity duration-700"
                    style={{ opacity: i === 0 ? 1 : 0, ...getAvatarCropStyle(avatar.crop) }}
                  />
                ))}
              </div>
            ) : avatarUrl ? (
              <div className="h-8 w-8 overflow-hidden rounded-full">
                <img
                  src={avatarUrl}
                  alt={displayName}
                  loading="lazy"
                  className="h-full w-full object-cover"
                  style={avatarCropStyle}
                />
              </div>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-[0.6875rem] font-bold text-[var(--muted-foreground)]">
                {displayName[0]}
              </div>
            )}
          </div>
        )}

        <div className={cn("flex flex-col gap-0.5", isUser ? "items-end" : "items-start", editing && "w-full")}>
          {/* Name — only for first in group */}
          {!isGrouped && !isUser && (
            <span
              className={cn(
                "px-3 text-[0.6875rem] font-semibold",
                !msgNameColor && !isMergedGroup && "text-[var(--muted-foreground)]",
              )}
              style={!isMergedGroup ? nameColorStyle(msgNameColor) : undefined}
            >
              {isMergedGroup ? mergedNameElement : displayName}
            </span>
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
              "texting-bubble relative px-3.5 py-2",
              isUser
                ? "texting-bubble-user rounded-2xl rounded-br-md"
                : "texting-bubble-other rounded-2xl rounded-bl-md",
              isGrouped && isUser && "rounded-br-2xl rounded-tr-md",
              isGrouped && !isUser && "rounded-bl-2xl rounded-tl-md",
              isStreaming && "ring-2 ring-[var(--primary)]/20",
              isConversationStart && "ring-1 ring-amber-500/30",
              editing && "w-full",
            )}
            style={{ fontSize: chatFontSize, lineHeight: 1.5, ...(boxBgColor ? { backgroundColor: boxBgColor } : {}) }}
          >
            {editing ? (
              <EditTextarea
                initialContent={message.content}
                fontSize={chatFontSize}
                onSave={handleSaveEdit}
                onCancel={handleCancelEdit}
              />
            ) : (
              <div className={cn("break-words", !isHtmlContent && "whitespace-pre-wrap")}>
                {isStreaming && !message.content ? (
                  <div className="flex items-center gap-1 py-0.5">
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
            )}
          </div>

          {/* Timestamp + model — only for last in a group or standalone */}
          {!isGrouped && (
            <div className={cn("flex items-center gap-2 px-3", isUser && "flex-row-reverse")}>
              <span className="text-[0.625rem] text-[var(--muted-foreground)]/50">{formatTime(message.createdAt)}</span>
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
            <div className="flex items-center gap-1.5 px-2 text-[0.625rem] text-[var(--muted-foreground)]">
              <button
                className="rounded p-0.5 transition-colors hover:bg-[var(--accent)] disabled:opacity-30"
                onClick={handleSwipePrev}
                disabled={message.activeSwipeIndex <= 0}
              >
                <ChevronLeft size="0.6875rem" />
              </button>
              <span className="tabular-nums">
                {message.activeSwipeIndex + 1}/{swipeCount}
              </span>
              <button
                className="rounded p-0.5 transition-colors hover:bg-[var(--accent)] disabled:opacity-30"
                onClick={handleSwipeNext}
                disabled={message.activeSwipeIndex >= swipeCount - 1}
              >
                <ChevronRight size="0.6875rem" />
              </button>
            </div>
          )}

          {/* Hover actions (tap to toggle on mobile) */}
          <div
            className={cn(
              "flex items-center gap-0 px-1 opacity-0 transition-all group-hover:opacity-100",
              isUser && "flex-row-reverse",
              showActions && "opacity-100",
            )}
          >
            <ActionBtn icon={copied ? "✓" : <Copy size="0.625rem" />} onClick={handleCopy} title="Copy" />
            <ActionBtn icon={<Pencil size="0.625rem" />} onClick={startEditing} title="Edit" />
            <ActionBtn
              icon={<RefreshCw size="0.625rem" />}
              onClick={() => onRegenerate?.(message.id)}
              title="Regenerate"
            />
            <ActionBtn
              icon={<Flag size="0.625rem" />}
              onClick={() => onToggleConversationStart?.(message.id, isConversationStart)}
              title={isConversationStart ? "Remove conversation start" : "Mark as new start"}
              className={isConversationStart ? "text-amber-500" : undefined}
            />
            {isLastAssistantMessage && !isUser && (
              <ActionBtn icon={<Eye size="0.625rem" />} onClick={() => onPeekPrompt?.()} title="Peek prompt" />
            )}
            {thinking && !isUser && (
              <ActionBtn icon={<Brain size="0.625rem" />} onClick={() => setShowThinking(true)} title="View thoughts" />
            )}
            <ActionBtn
              icon={<GitBranch size="0.625rem" />}
              onClick={() => onBranch?.(message.id)}
              title="Branch from here"
            />
            <ActionBtn
              icon={<Trash2 size="0.625rem" />}
              onClick={() => onDelete?.(message.id)}
              title="Delete"
              className="hover:text-[var(--destructive)]"
            />
          </div>
        </div>
      </div>

      {/* Thinking modal */}
      {showThinking && thinking && <ThinkingModal thinking={thinking} onClose={() => setShowThinking(false)} />}
    </div>
  );
});

// ── Thinking modal ──
function ThinkingModal({ thinking, onClose }: { thinking: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
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
            onClick={onClose}
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
    </div>
  );
}

// ── Action button ──
function ActionBtn({
  icon,
  onClick,
  title,
  className,
  dark,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  title: string;
  className?: string;
  dark?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "rounded-md p-1 transition-all active:scale-90",
        dark
          ? "text-white/40 hover:bg-white/10 hover:text-white/70"
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
