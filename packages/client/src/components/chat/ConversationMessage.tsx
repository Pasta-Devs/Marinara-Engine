// ──────────────────────────────────────────────
// Chat: Discord-style conversation message
// ──────────────────────────────────────────────
import { useState, useCallback, useRef, memo, useMemo, type ReactNode } from "react";
import { Pencil, Trash2, Copy, RefreshCw, Eye, Brain, X, User } from "lucide-react";
import { cn } from "../../lib/utils";
import type { CharacterMap } from "./ChatArea";

/** Regex to detect a message that is just an image/GIF URL */
const IMAGE_URL_RE = /^https?:\/\/\S+\.(?:gif|png|jpe?g|webp)(?:\?[^\s]*)?$/i;

/** Apply markdown-style inline formatting: **bold** and *italic*. */
function applyInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
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
      nodes.push(<strong key={`${keyPrefix}b${key++}`}>{match[2]}</strong>);
    } else if (match[3] != null) {
      nodes.push(<em key={`${keyPrefix}i${key++}`}>{match[3]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes.length > 0 ? nodes : [text];
}

/** Renders message content, showing image URLs as inline images */
function MessageContent({ content }: { content: string }) {
  if (IMAGE_URL_RE.test(content.trim())) {
    const url = content.trim();
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img src={url} alt="GIF" className="max-h-48 max-w-full sm:max-w-xs rounded-lg" loading="lazy" />
      </a>
    );
  }
  return <>{applyInlineMarkdown(content, "m")}</>;
}

/** Parse <speaker="Name">text</speaker> tags into segments */
interface SpeakerSegment {
  speaker: string | null; // null = narration / non-attributed text
  text: string;
}
function parseSpeakerTags(content: string): SpeakerSegment[] | null {
  const regex = /<speaker="([^"]*)">([\s\S]*?)<\/speaker>/g;
  let match: RegExpExecArray | null;
  const segments: SpeakerSegment[] = [];
  let lastIndex = 0;
  let found = false;
  while ((match = regex.exec(content)) !== null) {
    found = true;
    // Text before this tag
    if (match.index > lastIndex) {
      const before = content.slice(lastIndex, match.index).trim();
      if (before) segments.push({ speaker: null, text: before });
    }
    segments.push({ speaker: match[1]!, text: match[2]!.trim() });
    lastIndex = regex.lastIndex;
  }
  if (!found) return null;
  // Trailing text
  if (lastIndex < content.length) {
    const after = content.slice(lastIndex).trim();
    if (after) segments.push({ speaker: null, text: after });
  }
  return segments;
}

/** Parse "Name: text" format into segments. Requires known character names to avoid false positives. */
function parseNamePrefixFormat(content: string, knownNames: Set<string>): SpeakerSegment[] | null {
  if (!knownNames.size) return null;
  const lines = content.split("\n");
  const segments: SpeakerSegment[] = [];
  let currentSpeaker: string | null = null;
  let currentLines: string[] = [];
  let found = false;

  for (const line of lines) {
    // Check if the line starts with "KnownName: "
    const colonIdx = line.indexOf(": ");
    if (colonIdx > 0) {
      const potentialName = line.slice(0, colonIdx).trim();
      if (knownNames.has(potentialName.toLowerCase())) {
        // Save previous segment
        if (currentLines.length > 0) {
          segments.push({ speaker: currentSpeaker, text: currentLines.join("\n") });
        }
        currentSpeaker = potentialName;
        currentLines = [line.slice(colonIdx + 2)];
        found = true;
        continue;
      }
    }
    // Continuation line for the current speaker
    currentLines.push(line);
  }
  if (currentLines.length > 0) {
    segments.push({ speaker: currentSpeaker, text: currentLines.join("\n") });
  }
  if (!found) return null;
  // Filter out empty segments
  return segments.filter((s) => s.text.trim());
}

/** Group consecutive same-speaker segments so the header only shows once. */
interface GroupedSegment {
  speaker: string | null;
  lines: string[]; // each segment's text joined
}
function groupConsecutiveSegments(segments: SpeakerSegment[]): GroupedSegment[] {
  const groups: GroupedSegment[] = [];
  for (const seg of segments) {
    const last = groups[groups.length - 1];
    const trimmed = seg.text.replace(/^\n+|\n+$/g, "");
    if (last && last.speaker && seg.speaker && last.speaker.toLowerCase() === seg.speaker.toLowerCase()) {
      last.lines.push(trimmed);
    } else {
      groups.push({ speaker: seg.speaker, lines: [trimmed] });
    }
  }
  return groups;
}

interface PersonaInfo {
  name: string;
  avatarUrl: string | null;
}

interface MessageData {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system" | "narrator";
  characterId: string | null;
  content: string;
  activeSwipeIndex: number;
  swipeCount?: number;
  extra: {
    displayText: string | null;
    isGenerated: boolean;
    tokenCount: number | null;
    generationInfo: {
      model?: string;
      tokensIn?: number;
      tokensOut?: number;
      duration?: number;
    } | null;
    isConversationStart?: boolean;
    thinking?: string | null;
    attachments?: Array<{ type: string; url: string; filename?: string }>;
  };
  createdAt: string;
}

interface ConversationMessageProps {
  message: MessageData;
  isStreaming?: boolean;
  isGrouped?: boolean;
  hideActions?: boolean;
  noHoverGroup?: boolean;
  forceShowActions?: boolean;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  onPeekPrompt?: () => void;
  isLastAssistantMessage?: boolean;
  characterMap?: CharacterMap;
  personaInfo?: PersonaInfo;
  /** Override the edit button click (used by SplitMessageGroup) */
  onEditClick?: () => void;
}

export const ConversationMessage = memo(function ConversationMessage({
  message,
  isStreaming,
  isGrouped,
  hideActions,
  noHoverGroup,
  forceShowActions,
  onDelete,
  onRegenerate,
  onEdit,
  onPeekPrompt,
  isLastAssistantMessage,
  characterMap,
  personaInfo,
  onEditClick,
}: ConversationMessageProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  // Character info
  const charInfo = message.characterId && characterMap ? characterMap.get(message.characterId) : null;
  const avatarUrl = isUser ? (personaInfo?.avatarUrl ?? null) : (charInfo?.avatarUrl ?? null);
  const displayName = isUser ? (personaInfo?.name ?? "You") : (charInfo?.name ?? "Assistant");
  const nameColor = !isUser ? charInfo?.nameColor : undefined;

  // Build name→character lookup for speaker tag resolution
  const charByName = useMemo(() => {
    if (!characterMap) return null;
    const map = new Map<string, NonNullable<ReturnType<CharacterMap["get"]>>>();
    for (const [, v] of characterMap) {
      if (v) map.set(v.name.toLowerCase(), v);
    }
    return map;
  }, [characterMap]);

  // Parse speaker tags or Name: text format for group merged-mode messages
  const groupedSegments = useMemo(() => {
    if (isUser || !message.content) return null;
    // Try <speaker> tags first (backward compat)
    const speakerSegs = parseSpeakerTags(message.content);
    if (speakerSegs) return groupConsecutiveSegments(speakerSegs);
    // Try Name: text format
    const knownNames = charByName ? new Set(charByName.keys()) : new Set<string>();
    const nameSegs = parseNamePrefixFormat(message.content, knownNames);
    if (nameSegs) return groupConsecutiveSegments(nameSegs);
    return null;
  }, [isUser, message.content, charByName]);

  const extra = typeof message.extra === "string" ? JSON.parse(message.extra) : (message.extra ?? {});
  const thinking = extra?.thinking;

  // Actions
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [message.content]);

  const startEditing = useCallback(() => {
    setEditing(true);
    setEditValue(message.content);
    requestAnimationFrame(() => editRef.current?.focus());
  }, [message.content]);

  const handleSaveEdit = useCallback(() => {
    if (editValue.trim() !== message.content) {
      onEdit?.(message.id, editValue.trim());
    }
    setEditing(false);
  }, [editValue, message.content, message.id, onEdit]);

  // System messages — minimal display
  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-[var(--secondary)] px-3 py-1 text-[0.6875rem] text-[var(--muted-foreground)]">
          {message.content}
        </span>
      </div>
    );
  }

  // ── Render: grouped multi-speaker message (merged group chat) ──
  if (groupedSegments && !editing && !isUser) {
    return (
      <div
        className={cn(
          "relative px-4 py-0.5 transition-colors hover:bg-[var(--secondary)]/30",
          !noHoverGroup && "group",
          isGrouped ? "mt-0" : "mt-3",
          isStreaming && "bg-[var(--secondary)]/20",
        )}
        onClick={() => setShowActions((v) => !v)}
      >
        {/* Render each grouped speaker as a mini-message row */}
        {groupedSegments.map((grp, i) => {
          const segChar = grp.speaker && charByName ? charByName.get(grp.speaker.toLowerCase()) : null;
          const segAvatar = segChar?.avatarUrl ?? null;
          const segName = segChar?.name ?? grp.speaker ?? "";
          const segColor = segChar?.nameColor;
          const isFirst = i === 0;
          const combinedText = grp.lines.join("\n");

          if (!grp.speaker) {
            // Non-attributed narration text — render as indented italic
            return (
              <div
                key={i}
                className="pl-14 py-0.5 text-[0.875rem] leading-relaxed break-words whitespace-pre-wrap text-[var(--muted-foreground)] italic"
              >
                {applyInlineMarkdown(combinedText, `ns${i}`)}
              </div>
            );
          }

          return (
            <div key={i} className={cn("flex gap-4", i > 0 && "mt-3")}>
              {/* Avatar */}
              <div className="w-10 flex-shrink-0">
                <div className="h-10 w-10 overflow-hidden rounded-full bg-[var(--accent)]">
                  {segAvatar ? (
                    <img src={segAvatar} alt={segName} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-bold text-[var(--muted-foreground)]">
                      {segName[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              {/* Name + content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span
                    className="text-[0.9375rem] font-semibold leading-tight hover:underline cursor-default"
                    style={segColor ? { color: segColor } : undefined}
                  >
                    {segName}
                  </span>
                  {isFirst && (
                    <span className="text-[0.6875rem] text-[var(--muted-foreground)]/60">
                      {formatTimestamp(message.createdAt)}
                    </span>
                  )}
                </div>
                <div className="text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap">
                  {applyInlineMarkdown(combinedText, `gs${i}`)}
                </div>
              </div>
            </div>
          );
        })}

        {/* Streaming cursor */}
        {isStreaming && (
          <span className="ml-14 inline-block h-4 w-[0.125rem] animate-pulse rounded-full bg-[var(--foreground)]/50" />
        )}

        {/* Hover action bar */}
        <div
          className={cn(
            "absolute -top-3 right-4 flex items-center gap-0.5 rounded-md border border-white/20 bg-black/40 px-1 py-0.5 shadow-sm backdrop-blur-sm transition-all",
            "opacity-0 group-hover:opacity-100",
            (showActions || forceShowActions) && "opacity-100",
          )}
        >
          <MsgAction icon={copied ? "✓" : <Copy size="0.75rem" />} onClick={handleCopy} title="Copy" />
          <MsgAction icon={<Pencil size="0.75rem" />} onClick={onEditClick ?? startEditing} title="Edit" />
          <MsgAction
            icon={<RefreshCw size="0.75rem" />}
            onClick={() => onRegenerate?.(message.id)}
            title="Regenerate"
          />
          {isLastAssistantMessage && (
            <MsgAction icon={<Eye size="0.75rem" />} onClick={() => onPeekPrompt?.()} title="Peek prompt" />
          )}
          {thinking && (
            <MsgAction icon={<Brain size="0.75rem" />} onClick={() => setShowThinking(true)} title="View thoughts" />
          )}
          <MsgAction
            icon={<Trash2 size="0.75rem" />}
            onClick={() => onDelete?.(message.id)}
            title="Delete"
            className="hover:text-[var(--destructive)]"
          />
        </div>

        {/* Thinking modal */}
        {showThinking && thinking && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setShowThinking(false)}
          >
            <div
              className="relative mx-4 flex max-h-[70vh] w-full max-w-xl flex-col rounded-xl bg-[var(--card)] shadow-2xl ring-1 ring-[var(--border)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Brain size="0.875rem" className="text-[var(--muted-foreground)]" />
                  Model Thoughts
                </div>
                <button
                  onClick={() => setShowThinking(false)}
                  className="rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
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
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex gap-4 px-4 py-0.5 transition-colors hover:bg-[var(--secondary)]/30",
        !noHoverGroup && "group",
        isGrouped ? "mt-0" : "mt-4",
        isStreaming && "bg-[var(--secondary)]/20",
      )}
      onClick={() => setShowActions((v) => !v)}
    >
      {/* Avatar column — fixed 40px width */}
      <div className="w-10 flex-shrink-0">
        {!isGrouped && (
          <div className="h-10 w-10 overflow-hidden rounded-full bg-[var(--accent)]">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-[var(--muted-foreground)]">
                {isUser ? <User size="1.125rem" /> : displayName[0]?.toUpperCase()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Message content column */}
      <div className="min-w-0 flex-1">
        {/* Header — name + timestamp (only for first in group) */}
        {!isGrouped && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span
              className="text-[0.9375rem] font-semibold leading-tight hover:underline cursor-default"
              style={nameColor ? { color: nameColor } : undefined}
            >
              {displayName}
            </span>
            <span className="text-[0.6875rem] text-[var(--muted-foreground)]/60">
              {formatTimestamp(message.createdAt)}
            </span>
          </div>
        )}

        {/* Message body */}
        {editing ? (
          <div className="space-y-2">
            <textarea
              ref={editRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full resize-none rounded-lg border border-white/25 bg-[var(--secondary)] p-2.5 text-[0.9375rem] leading-relaxed outline-none"
              rows={Math.min(editValue.split("\n").length + 1, 12)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && editValue === "") {
                  e.preventDefault();
                  setEditing(false);
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveEdit();
                }
              }}
            />
            <div className="flex items-center gap-2 text-[0.6875rem] text-[var(--muted-foreground)]">
              backspace (empty) to{" "}
              <button onClick={() => setEditing(false)} className="text-white/70 hover:underline hover:text-white">
                cancel
              </button>{" "}
              · enter to{" "}
              <button onClick={handleSaveEdit} className="text-white/70 hover:underline hover:text-white">
                save
              </button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap",
              isStreaming && !message.content && "py-1",
            )}
          >
            {isStreaming && !message.content ? (
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted-foreground)]/60 [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted-foreground)]/60 [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted-foreground)]/60 [animation-delay:300ms]" />
              </div>
            ) : (
              <>
                <MessageContent content={message.content} />
                {isStreaming && (
                  <span className="ml-0.5 inline-block h-4 w-[0.125rem] animate-pulse rounded-full bg-[var(--foreground)]/50" />
                )}
              </>
            )}
          </div>
        )}

        {/* Image attachments (selfies, etc.) — skip when content is already an image URL */}
        {extra.attachments && extra.attachments.length > 0 && !IMAGE_URL_RE.test(message.content.trim()) && (
          <div className="mt-1.5 flex flex-wrap gap-2">
            {extra.attachments.map((att: any, i: number) =>
              att.type === "image" || att.type?.startsWith("image/") ? (
                <a key={i} href={att.url || att.data} target="_blank" rel="noopener noreferrer">
                  <img
                    src={att.url || att.data}
                    alt={att.filename || att.name || "image"}
                    className="max-h-64 max-w-full sm:max-w-xs rounded-lg"
                    loading="lazy"
                  />
                </a>
              ) : null,
            )}
          </div>
        )}
      </div>

      {/* Hover action bar — Discord-style floating pill */}
      {!hideActions && (
        <div
          className={cn(
            "absolute -top-3 right-4 flex items-center gap-0.5 rounded-md border border-white/20 bg-black/40 px-1 py-0.5 shadow-sm backdrop-blur-sm transition-all",
            "opacity-0 group-hover:opacity-100",
            (showActions || forceShowActions) && "opacity-100",
          )}
        >
          <MsgAction icon={copied ? "✓" : <Copy size="0.75rem" />} onClick={handleCopy} title="Copy" />
          <MsgAction icon={<Pencil size="0.75rem" />} onClick={startEditing} title="Edit" />
          {!isUser && (
            <MsgAction
              icon={<RefreshCw size="0.75rem" />}
              onClick={() => onRegenerate?.(message.id)}
              title="Regenerate"
            />
          )}
          {isLastAssistantMessage && !isUser && (
            <MsgAction icon={<Eye size="0.75rem" />} onClick={() => onPeekPrompt?.()} title="Peek prompt" />
          )}
          {thinking && !isUser && (
            <MsgAction icon={<Brain size="0.75rem" />} onClick={() => setShowThinking(true)} title="View thoughts" />
          )}
          <MsgAction
            icon={<Trash2 size="0.75rem" />}
            onClick={() => onDelete?.(message.id)}
            title="Delete"
            className="hover:text-[var(--destructive)]"
          />
        </div>
      )}

      {/* Thinking modal */}
      {showThinking && thinking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowThinking(false)}
        >
          <div
            className="relative mx-4 flex max-h-[70vh] w-full max-w-xl flex-col rounded-xl bg-[var(--card)] shadow-2xl ring-1 ring-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Brain size="0.875rem" className="text-[var(--muted-foreground)]" />
                Model Thoughts
              </div>
              <button
                onClick={() => setShowThinking(false)}
                className="rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
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
      )}
    </div>
  );
});

// ── Tiny action button ──
function MsgAction({
  icon,
  onClick,
  title,
  className,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  title: string;
  className?: string;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      className={cn("rounded p-1 text-white/70 transition-colors hover:bg-white/20 hover:text-white", className)}
    >
      {icon}
    </button>
  );
}

// ── Timestamp formatting ──

/** Full timestamp: "Today at 3:42 PM", "Yesterday at 10:15 AM", "03/15/2026" */
function formatTimestamp(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);

    const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    if (diffDays === 0 && date.getDate() === now.getDate()) {
      return `Today at ${time}`;
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (diffDays <= 1 && date.getDate() === yesterday.getDate()) {
      return `Yesterday at ${time}`;
    }
    return `${date.toLocaleDateString()} ${time}`;
  } catch {
    return "";
  }
}
