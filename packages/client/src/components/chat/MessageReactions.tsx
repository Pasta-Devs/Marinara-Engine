// ──────────────────────────────────────────────
// Conversation message reactions — pill row.
// Renders Discord-style reaction chips for a message. Clicking a chip toggles the
// user's own reaction; hovering shows a styled tooltip (emoji + who reacted). The
// add affordance lives in the hover toolbar (ReactionAddButton); this row renders
// OUTSIDE the card-CSS message container so a character's bubble theme can't
// restyle it. Conversation mode only.
// ──────────────────────────────────────────────
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MessageReaction } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { USER_REACTOR, customEmojiReactionName } from "../../lib/reactions";
import { useTranslation as useUiTranslation } from "react-i18next";

interface MessageReactionsProps {
  reactions: MessageReaction[];
  /** Resolve a reactor id ("user" or a character id) to a display name for tooltips. */
  resolveReactorName: (reactorId: string) => string;
  /** Toggle the user's membership in this reaction entry (identity: emoji + segment). */
  onToggle: (reaction: MessageReaction) => void;
  /** Remove character membership from this reaction entry. */
  onRemoveCharacter: (reaction: MessageReaction) => void;
}

export function MessageReactions({
  reactions,
  resolveReactorName,
  onToggle,
  onRemoveCharacter,
}: MessageReactionsProps) {
  if (reactions.length === 0) return null;
  return (
    <div className="mari-message-reactions flex flex-wrap items-center gap-1">
      {reactions.map((reaction) => (
        <ReactionPill
          // A whole-message row can also hold orphaned segment entries, so the same
          // emoji may legitimately appear more than once — key by segment too.
          key={`${reaction.segment ?? "m"}:${reaction.segmentSpeaker ?? ""}:${reaction.emoji}`}
          reaction={reaction}
          mine={reaction.by.includes(USER_REACTOR)}
          who={reaction.by.map(resolveReactorName).join(", ")}
          onToggle={() => onToggle(reaction)}
          onRemoveCharacter={() => onRemoveCharacter(reaction)}
        />
      ))}
    </div>
  );
}

function ReactionPill({
  reaction,
  mine,
  who,
  onToggle,
  onRemoveCharacter,
}: {
  reaction: MessageReaction;
  mine: boolean;
  who: string;
  onToggle: () => void;
  onRemoveCharacter: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [show, setShow] = useState(false);
  const wrapRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; ready: boolean }>({ top: 0, left: 0, ready: false });
  const name = customEmojiReactionName(reaction.emoji);
  const hasCharacterReaction = reaction.by.some((reactor) => reactor !== USER_REACTOR);
  const pointerTypeRef = useRef<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const onRemoveCharacterRef = useRef(onRemoveCharacter);

  useEffect(() => {
    onRemoveCharacterRef.current = onRemoveCharacter;
  }, [onRemoveCharacter]);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearLongPress, [clearLongPress]);

  // Position the tooltip centered above the chip, before paint (no flicker).
  useLayoutEffect(() => {
    if (!show || !wrapRef.current || !tipRef.current) {
      setPos((prev) => (prev.ready ? { ...prev, ready: false } : prev));
      return;
    }
    const rect = wrapRef.current.getBoundingClientRect();
    const tip = tipRef.current.getBoundingClientRect();
    const pad = 8;
    let top = rect.top - 6 - tip.height;
    let left = rect.left + rect.width / 2 - tip.width / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - pad - tip.width));
    top = Math.max(pad, Math.min(top, window.innerHeight - pad - tip.height));
    setPos({ top, left, ready: true });
  }, [show]);

  return (
    <>
      <button
        ref={wrapRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          if (hasCharacterReaction && (pointerTypeRef.current === "mouse" || event.detail === 0)) {
            onRemoveCharacter();
          } else onToggle();
          pointerTypeRef.current = null;
        }}
        onPointerDown={(event) => {
          suppressClickRef.current = false;
          pointerTypeRef.current = event.pointerType;
          if (event.pointerType !== "touch" || !hasCharacterReaction) return;
          clearLongPress();
          longPressTimerRef.current = window.setTimeout(() => {
            suppressClickRef.current = true;
            onRemoveCharacterRef.current();
          }, 500);
        }}
        onKeyDown={() => {
          suppressClickRef.current = false;
        }}
        onPointerUp={clearLongPress}
        onPointerCancel={clearLongPress}
        onPointerLeave={clearLongPress}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        aria-label={localizeUi("ui.chat.reactionpill.value1ReactedWithValue2", {
          value1: who,
          value2: name ? localizeUi("ui.chat.conversationinput.value1", { value1: name }) : reaction.emoji,
        })}
        aria-pressed={mine}
        className={cn(
          "flex items-center gap-1 rounded-md border px-1.5 py-0.5 leading-none transition-colors",
          mine
            ? "border-[var(--primary)]/60 bg-[var(--primary)]/15 text-[var(--primary)]"
            : "border-[var(--border)] bg-[var(--secondary)]/60 text-[var(--muted-foreground)] hover:border-[var(--muted-foreground)]/40 hover:bg-[var(--secondary)]",
        )}
      >
        {reaction.imageUrl ? (
          <img
            src={reaction.imageUrl}
            alt={reaction.emoji}
            className="h-[1.125rem] w-[1.125rem] object-contain"
            loading="lazy"
          />
        ) : (
          <span className="text-[1.125rem] leading-none">{reaction.emoji}</span>
        )}
        <span className="min-w-[0.75rem] text-center text-[0.6875rem] font-medium tabular-nums">
          {reaction.by.length}
        </span>
      </button>
      {show &&
        createPortal(
          <div
            ref={tipRef}
            className="pointer-events-none fixed z-[9999] flex max-w-[18rem] items-center gap-2 rounded-lg bg-[var(--card)] px-2.5 py-1.5 text-[0.75rem] text-[var(--foreground)] shadow-xl ring-1 ring-[var(--border)]"
            style={{ top: pos.top, left: pos.left, visibility: pos.ready ? "visible" : "hidden" }}
          >
            {reaction.imageUrl ? (
              <img src={reaction.imageUrl} alt="" className="h-7 w-7 shrink-0 object-contain" />
            ) : (
              <span className="text-2xl leading-none">{reaction.emoji}</span>
            )}
            <span className="leading-snug">
              {name ? (
                <>
                  <span className="font-semibold text-[var(--foreground)]">:{name}:</span>{" "}
                  {localizeUi("ui.chat.reactionpill.reactedBy")} {who}
                </>
              ) : (
                <>
                  {localizeUi("ui.chat.reactionpill.reactedBy")} {who}
                </>
              )}
            </span>
          </div>,
          document.body,
        )}
    </>
  );
}
