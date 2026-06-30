// ──────────────────────────────────────────────
// Game: Input Bar (send message, roll dice, attach files, emoji)
// ──────────────────────────────────────────────
import { useState, useRef, useEffect, useCallback, useMemo, type KeyboardEvent } from "react";
import { Send, Dices, Paperclip, Smile, Users, MessageCircle, MessageSquare, Languages, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { EmojiPicker } from "../ui/EmojiPicker";
import { SpeechToTextButton } from "../ui/SpeechToTextButton";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { translateDraftText } from "../../lib/draft-translation";
import { formatTextQuotes, type DiceRollResult } from "@marinara-engine/shared";
import { getChatInputShellClass } from "../chat/chat-input-styles";

interface Attachment {
  type: string;
  data: string;
  name: string;
}

type AddressMode = "scene" | "party" | "gm";

interface GameInputProps {
  onSend: (
    message: string,
    attachments?: Array<{ type: string; data: string }>,
    options?: { commitPendingMove?: boolean },
  ) => void;
  onRollDice: (notation: string) => Promise<DiceRollResult | null>;
  /** When true, allow "Talk to Party" in the address selector. */
  hasPartyMembers?: boolean;
  /** Pending staged destination from the map UI. */
  pendingMoveLabel?: string | null;
  /** Clear the staged destination without sending it. */
  onClearPendingMove?: () => void;
  disabled: boolean;
  isStreaming: boolean;
  /** When true, renders without the bottom-bar chrome (for embedding inside narration box) */
  inline?: boolean;
  /** Key for persisting the input draft to localStorage (e.g. chatId) */
  draftKey?: string;
  /** Increment to request focus on the textarea (used by the Interrupt button to jump the player into typing). */
  focusToken?: number;
  /**
   * When set, the input renders in interrupt-commit mode. `risky` paints the bar red,
   * highlights the dice button with a glow, and shows a "using dice recommended" hint.
   * `force` keeps the normal styling — the GM won't be told this is an interrupt.
   */
  interruptMode?: "risky" | "force" | null;
}

const QUICK_DICE = ["d20", "d6", "2d6", "d10", "d100", "d4", "d8", "d12"];

function readGameInputDraft(storageKey: string | null): string {
  if (!storageKey) return "";
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) return stored;
    const legacy = sessionStorage.getItem(storageKey);
    if (legacy !== null) {
      localStorage.setItem(storageKey, legacy);
      sessionStorage.removeItem(storageKey);
      return legacy;
    }
  } catch {
    /* ignore */
  }
  return "";
}

function writeGameInputDraft(storageKey: string | null, value: string): void {
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, value);
    sessionStorage.removeItem(storageKey);
  } catch {
    /* ignore */
  }
}

function clearGameInputDraft(storageKey: string | null): void {
  if (!storageKey) return;
  try {
    localStorage.removeItem(storageKey);
    sessionStorage.removeItem(storageKey);
  } catch {
    /* ignore */
  }
}

function formatDiceResultTag(result: DiceRollResult): string {
  const rollDetail =
    result.rolls.length > 1 || result.modifier !== 0
      ? ` (${result.rolls.join(", ")}${result.modifier ? ` ${result.modifier > 0 ? "+" : ""}${result.modifier}` : ""})`
      : "";
  return `[dice: ${result.notation} = ${result.total}${rollDetail}]`;
}

export function GameInput({
  onSend,
  onRollDice,
  hasPartyMembers,
  pendingMoveLabel,
  onClearPendingMove,
  disabled,
  isStreaming,
  inline,
  draftKey,
  focusToken,
  interruptMode,
}: GameInputProps) {
  const enterToSend = useUIStore((s) => s.enterToSendGame);
  const speechToTextEnabled = useUIStore((s) => s.speechToTextEnabled);
  const quoteFormat = useUIStore((s) => s.quoteFormat);
  const storageKey = draftKey ? `game-input-draft:${draftKey}` : null;
  const [text, setText] = useState(() => readGameInputDraft(storageKey));
  const [showDice, setShowDice] = useState(false);
  const [customDice, setCustomDice] = useState("");
  const [queuedDice, setQueuedDice] = useState<string | null>(null);
  const [rollingQueuedDice, setRollingQueuedDice] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isTranslatingDraft, setIsTranslatingDraft] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [addressMode, setAddressMode] = useState<AddressMode>("scene");
  const [addressMenuOpen, setAddressMenuOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const inputBarRef = useRef<HTMLDivElement>(null);
  const addressButtonRef = useRef<HTMLButtonElement>(null);
  const addressMenuRef = useRef<HTMLDivElement>(null);
  const activeChat = useChatStore((s) => s.activeChat);
  const chatMetadata = useMemo(() => {
    if (!activeChat?.metadata) return {};
    if (typeof activeChat.metadata !== "string") return activeChat.metadata as Record<string, unknown>;
    try {
      return JSON.parse(activeChat.metadata) as Record<string, unknown>;
    } catch {
      return {};
    }
  }, [activeChat?.metadata]);
  const showDraftTranslateButton = chatMetadata.showInputTranslateButton === true;

  useEffect(() => {
    const draft = readGameInputDraft(storageKey);
    setText(draft);
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    });
  }, [storageKey]);

  useEffect(() => {
    if (addressMode !== "party" || hasPartyMembers) return;
    setAddressMode("scene");
  }, [addressMode, hasPartyMembers]);

  // Honors focus requests even if the input was disabled at the time the
  // token bumped (e.g. Interrupt clicked while `isStreaming` is still true) —
  // we re-attempt the focus once `disabled` flips to false.
  const lastFocusedTokenRef = useRef(0);
  useEffect(() => {
    if (!focusToken) return;
    if (lastFocusedTokenRef.current === focusToken) return;
    if (disabled) return;
    inputRef.current?.focus();
    lastFocusedTokenRef.current = focusToken;
  }, [focusToken, disabled]);

  useEffect(() => {
    if (!addressMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (addressButtonRef.current?.contains(target) || addressMenuRef.current?.contains(target)) return;
      setAddressMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [addressMenuOpen]);

  /** Update text state and persist draft */
  const updateText = useCallback(
    (value: string) => {
      const formatted = formatTextQuotes(value, quoteFormat);
      setText(formatted);
      writeGameInputDraft(storageKey, formatted);
    },
    [quoteFormat, storageKey],
  );

  /** Clear the persisted draft */
  const clearDraft = useCallback(() => {
    clearGameInputDraft(storageKey);
  }, [storageKey]);

  const handleAddressModeSelect = useCallback((nextMode: Exclude<AddressMode, "scene">) => {
    setAddressMode((current) => (current === nextMode ? "scene" : nextMode));
    setAddressMenuOpen(false);
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    const trimmed = formatTextQuotes(text.trim(), quoteFormat);
    const commitPendingMove = !!pendingMoveLabel && addressMode === "scene";
    const hasTurnContent = trimmed.length > 0 || attachments.length > 0 || commitPendingMove || !!queuedDice;
    if (!hasTurnContent || disabled || rollingQueuedDice) return;

    let body = trimmed;
    if (commitPendingMove && pendingMoveLabel) {
      body = body ? `*moves to ${pendingMoveLabel}*\n${body}` : `*moves to ${pendingMoveLabel}*`;
    }

    const pendingAttachments =
      attachments.length > 0 ? attachments.map((a) => ({ type: a.type, data: a.data })) : undefined;

    if (queuedDice) {
      setRollingQueuedDice(true);
      let diceResult: DiceRollResult | null = null;
      try {
        diceResult = await onRollDice(queuedDice);
      } finally {
        setRollingQueuedDice(false);
      }
      if (!diceResult) return;
      const diceTag = formatDiceResultTag(diceResult);
      body = body ? `${body}\n${diceTag}` : diceTag;
      setQueuedDice(null);
    }

    if (addressMode === "party") {
      body = body ? `[To the party] ${body}` : "[To the party]";
    } else if (addressMode === "gm") {
      body = body ? `[To the GM] ${body}` : "[To the GM]";
    }

    onSend(body, pendingAttachments, { commitPendingMove });

    setText("");
    clearDraft();
    setAttachments([]);
    if (inputRef.current) inputRef.current.style.height = "auto";
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const shouldSend = enterToSend ? e.key === "Enter" && !e.shiftKey : e.key === "Enter" && (e.metaKey || e.ctrlKey);
    if (shouldSend) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleDiceRoll = (notation: string) => {
    setQueuedDice(notation);
    setShowDice(false);
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) continue;
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments((prev) => [...prev, { type: file.type, data: reader.result as string, name: file.name }]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  }, []);

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      if (!inputRef.current) return;
      const el = inputRef.current;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const value = el.value;
      const newValue = value.slice(0, start) + emoji + value.slice(end);
      updateText(newValue);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + emoji.length;
        el.focus();
      });
    },
    [updateText],
  );

  const handleTranslateDraft = useCallback(async () => {
    if (disabled || isTranslatingDraft || !text.trim()) return;
    setIsTranslatingDraft(true);
    try {
      const translated = await translateDraftText(text);
      if (!translated) return;
      updateText(translated);
      requestAnimationFrame(() => {
        if (!inputRef.current) return;
        inputRef.current.style.height = "auto";
        inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
        inputRef.current.focus();
      });
    } finally {
      setIsTranslatingDraft(false);
    }
  }, [disabled, isTranslatingDraft, text, updateText]);

  const handleSpeechTranscript = useCallback(
    (transcript: string) => {
      const el = inputRef.current;
      if (!el) return;
      const currentText = el.value;
      const start = el.selectionStart ?? currentText.length;
      const end = el.selectionEnd ?? start;
      const before = currentText.slice(0, start);
      const after = currentText.slice(end);
      const prefix = before && !/\s$/.test(before) ? " " : "";
      const suffix = after && !/^\s/.test(after) ? " " : "";
      const nextValue = `${before}${prefix}${transcript}${suffix}${after}`;
      const nextCursor = before.length + prefix.length + transcript.length;

      updateText(nextValue);
      requestAnimationFrame(() => {
        if (!inputRef.current) return;
        inputRef.current.selectionStart = inputRef.current.selectionEnd = nextCursor;
        inputRef.current.style.height = "auto";
        inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
        inputRef.current.focus();
      });
    },
    [updateText],
  );

  const riskyInterrupt = interruptMode === "risky";
  const forceInterrupt = interruptMode === "force";
  const forceInterruptStyle = forceInterrupt
    ? {
        boxShadow: "0 0 18px -6px rgba(32, 194, 14, 0.6)",
        backgroundColor: "rgba(32, 194, 14, 0.04)",
        ["--tw-ring-color" as never]: "rgba(32, 194, 14, 0.45)",
      }
    : undefined;

  return (
    <div
      className={cn(inline ? "" : "px-3 pt-2 pb-3")}
      style={inline ? undefined : { minHeight: 61 }}
    >
      {/* Dice picker */}
      {showDice && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-1.5 border-b border-foreground/10 py-2",
            inline ? "px-0" : "px-4",
          )}
        >
          {QUICK_DICE.map((d) => (
            <button
              type="button"
              key={d}
              onClick={() => handleDiceRoll(d)}
              className="rounded bg-foreground/10 px-2 py-1 text-xs font-mono text-foreground/70 transition-colors hover:bg-foreground/15"
            >
              🎲 {d}
            </button>
          ))}
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={customDice}
              onChange={(e) => setCustomDice(e.target.value)}
              placeholder="3d8+2"
              className="h-[26px] w-16 rounded bg-foreground/10 px-1.5 text-xs font-mono text-foreground/70 outline-none ring-1 ring-foreground/10 placeholder:text-foreground/35 focus:ring-foreground/20"
              onKeyDown={(e) => {
                if (e.key === "Enter" && customDice.trim()) {
                  handleDiceRoll(customDice.trim());
                  setCustomDice("");
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (customDice.trim()) {
                  handleDiceRoll(customDice.trim());
                  setCustomDice("");
                }
              }}
              className="flex h-[26px] items-center rounded bg-foreground/10 px-1.5 text-foreground/70 hover:bg-foreground/15"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-foreground/10 px-4 py-2">
          {attachments.map((att, i) => (
            <div
              key={i}
              className="flex items-center gap-1 rounded-lg bg-foreground/10 px-2 py-1 text-[0.625rem] ring-1 ring-foreground/10"
            >
              {att.type.startsWith("image/") && (
                <img src={att.data} alt={att.name} className="h-5 w-5 rounded object-cover" />
              )}
              <span className="max-w-[80px] truncate">{att.name}</span>
              <button
                onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-foreground/45 hover:text-[var(--destructive)]"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {pendingMoveLabel && (
        <div className={cn("flex items-center", inline ? "px-0 pb-1" : "border-b border-foreground/10 px-4 py-2")}>
          <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-foreground/10 bg-foreground/10 px-2.5 py-1 text-[0.6875rem] text-foreground/80">
            <span className="shrink-0">📍</span>
            <span className="min-w-0 truncate">Destination: {pendingMoveLabel}</span>
            {onClearPendingMove && (
              <button
                onClick={onClearPendingMove}
                className="shrink-0 text-foreground/45 transition-colors hover:text-foreground/80"
                title="Clear destination"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main input */}
      <div
        ref={inputBarRef}
        className={getChatInputShellClass({
          className: cn(
            riskyInterrupt &&
              "ring-1 ring-red-500/40 bg-red-500/5 shadow-[0_0_18px_-6px_rgba(248,113,113,0.55)]",
            forceInterrupt && "ring-1",
          ),
          hasContent: text.trim().length > 0 || attachments.length > 0 || !!queuedDice || !!pendingMoveLabel,
          inline,
          layout: "game",
        })}
        style={forceInterruptStyle}
      >
        {/* Left: Attach files + address selector */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf,.txt,.md,.json,.csv"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach files"
          className={cn(
            "shrink-0 rounded-lg p-1 transition-all active:scale-90 sm:p-1.5",
            attachments.length
              ? "bg-foreground/10 text-foreground/75 ring-1 ring-foreground/20 hover:bg-foreground/15"
              : "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70",
          )}
          title="Attach files"
        >
          <Paperclip size={18} />
        </button>

        <div className="relative shrink-0">
          {addressMenuOpen && (
            <div
              ref={addressMenuRef}
              className="absolute bottom-full left-0 z-20 mb-2 flex min-w-[11rem] flex-col gap-1 rounded-xl border border-foreground/10 bg-[var(--card)]/95 p-1.5 shadow-lg backdrop-blur"
            >
              {hasPartyMembers && (
                <button
                  onClick={() => handleAddressModeSelect("party")}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                    addressMode === "party"
                      ? "bg-foreground/10 text-foreground/85 ring-1 ring-foreground/15"
                      : "text-foreground/65 hover:bg-foreground/10 hover:text-foreground/85",
                  )}
                >
                  <Users size={14} className="shrink-0" />
                  <span className="flex-1">Talk to Party</span>
                  {addressMode === "party" && <span className="text-[0.625rem] uppercase tracking-wide">On</span>}
                </button>
              )}
              <button
                onClick={() => handleAddressModeSelect("gm")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                  addressMode === "gm"
                    ? "bg-foreground/10 text-foreground/85 ring-1 ring-foreground/15"
                    : "text-foreground/65 hover:bg-foreground/10 hover:text-foreground/85",
                )}
              >
                <MessageCircle size={14} className="shrink-0" />
                <span className="flex-1">Talk to GM</span>
                {addressMode === "gm" && <span className="text-[0.625rem] uppercase tracking-wide">On</span>}
              </button>
            </div>
          )}
          <button
            ref={addressButtonRef}
            onClick={() => setAddressMenuOpen((open) => !open)}
            className={cn(
              "shrink-0 rounded-lg p-1 transition-all active:scale-90 sm:p-1.5",
              addressMode === "party"
                ? "bg-foreground/10 text-foreground/75 ring-1 ring-foreground/20 hover:bg-foreground/15"
                : addressMode === "gm"
                  ? "bg-foreground/10 text-foreground/75 ring-1 ring-foreground/20 hover:bg-foreground/15"
                  : "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70",
            )}
            title={
              addressMode === "party"
                ? "Choose who to address (currently Party)"
                : addressMode === "gm"
                  ? "Choose who to address (currently GM)"
                  : "Choose who to address"
            }
            aria-haspopup="menu"
            aria-expanded={addressMenuOpen}
          >
            <MessageSquare size={18} />
          </button>
        </div>

        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => {
            const cursor = e.target.selectionStart;
            updateText(e.target.value);
            requestAnimationFrame(() => {
              inputRef.current?.setSelectionRange(cursor, cursor);
            });
            // Auto-grow: reset height then set to scrollHeight
            const el = e.target;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            isStreaming
              ? "Waiting for the Game Master..."
              : addressMode === "party"
                ? "Say to party..."
                : addressMode === "gm"
                  ? "Say to GM..."
                  : pendingMoveLabel
                    ? "What do you do when you arrive?"
                    : "What do you do?"
          }
          disabled={disabled}
          rows={1}
          className="min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-normal text-foreground outline-none placeholder:text-foreground/30 disabled:opacity-50"
          style={{ minHeight: 36, maxHeight: 120 }}
        />

        {queuedDice && (
          <div className="flex items-center self-stretch rounded-lg border border-foreground/10 bg-foreground/10 px-2 text-xs text-foreground/70">
            🎲 {queuedDice}
            <button
              type="button"
              onClick={() => setQueuedDice(null)}
              className="ml-1 text-foreground/45 transition-colors hover:text-foreground/80"
              title="Clear queued roll"
            >
              ✕
            </button>
          </div>
        )}

        {/* Right: Dice, Emoji (desktop), Send */}
        {riskyInterrupt && !queuedDice && (
          <span className="hidden text-[0.625rem] font-medium uppercase tracking-wide text-red-300/80 sm:inline">
            using dice recommended
          </span>
        )}
        {forceInterrupt && (
          <span
            className="hidden text-[0.625rem] font-medium uppercase tracking-wide sm:inline"
            style={{ color: "#20C20E", opacity: 0.9 }}
          >
            force interrupting
          </span>
        )}
        <button
          type="button"
          onClick={() => setShowDice(!showDice)}
          className={cn(
            "shrink-0 rounded-lg p-1 transition-all active:scale-90 sm:p-1.5",
            showDice
              ? "bg-foreground/10 text-foreground/75 ring-1 ring-foreground/20 hover:bg-foreground/15"
              : "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70",
            riskyInterrupt &&
              !queuedDice &&
              "animate-pulse text-red-300 ring-1 ring-red-400/60 shadow-[0_0_12px_-2px_rgba(248,113,113,0.85)] hover:text-red-200",
          )}
          title={riskyInterrupt && !queuedDice ? "Roll dice — recommended for an interrupt attempt" : "Roll dice"}
        >
          <Dices size={18} />
        </button>

        <div className="relative hidden sm:block">
          <button
            type="button"
            ref={emojiButtonRef}
            onClick={() => setEmojiOpen((v) => !v)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
              emojiOpen
                ? "bg-foreground/10 text-foreground/75 ring-1 ring-foreground/20"
                : "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70",
            )}
            title="Emoji"
          >
            <Smile size={18} />
          </button>
          <EmojiPicker
            open={emojiOpen}
            onClose={() => setEmojiOpen(false)}
            onSelect={handleEmojiSelect}
            anchorRef={emojiButtonRef}
            containerRef={inputBarRef}
          />
        </div>

        {showDraftTranslateButton && (
          <button
            type="button"
            onClick={() => void handleTranslateDraft()}
            disabled={disabled || !text.trim() || isTranslatingDraft}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-200 active:scale-90",
              !disabled && text.trim() && !isTranslatingDraft
                ? "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70"
                : "text-foreground/25",
            )}
            title="Translate draft"
          >
            {isTranslatingDraft ? <Loader2 size={18} className="animate-spin" /> : <Languages size={18} />}
          </button>
        )}

        {speechToTextEnabled && (
          <SpeechToTextButton
            disabled={disabled}
            onTranscript={handleSpeechTranscript}
            className="!h-8 !w-8"
            iconSize={18}
          />
        )}

        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={
            disabled ||
            rollingQueuedDice ||
            (!text.trim() && attachments.length === 0 && !(pendingMoveLabel && addressMode === "scene") && !queuedDice)
          }
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-200 active:scale-90",
            (text.trim() || attachments.length > 0 || (pendingMoveLabel && addressMode === "scene") || queuedDice) &&
              !disabled &&
              !rollingQueuedDice
              ? "text-foreground/70 hover:bg-foreground/10 hover:text-foreground/90"
              : "text-foreground/25",
          )}
          aria-label="Send game turn"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
