// ──────────────────────────────────────────────
// About Me profile popout (Conversation mode) — opened by clicking an avatar.
// A Discord-style card anchored next to the avatar (no dimmed backdrop): blown-up
// avatar + status, then the effective about-me (per-chat override, else the
// card/persona default), with set / edit / clear of the chat-specific override.
// ──────────────────────────────────────────────
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, RotateCcw, Save, Smile, Trash2, Undo2, User, X } from "lucide-react";
import { toast } from "sonner";
import type { Chat } from "@marinara-engine/shared";
import { useChat, useUpdateChatMetadata } from "../../hooks/use-chats";
import { useCharacter, usePersonas } from "../../hooks/use-characters";
import { useConversationCustomEmojis } from "../../hooks/use-conversation-custom-emojis";
import { useChatStore } from "../../stores/chat.store";
import { cn, getAvatarCropStyle, type AvatarCropValue } from "../../lib/utils";
import { parseChatMetadata } from "../../lib/chat-display";
import { renderInlineWithCustomEmojis } from "../../lib/custom-emoji-render";
import { EmojiPicker } from "../ui/EmojiPicker";
import { CustomEmojiTab } from "../chat/CustomEmojiTab";

interface AnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface AboutMeViewerModalProps {
  open: boolean;
  onClose: () => void;
  kind: "character" | "persona";
  id: string;
  anchorRect?: AnchorRect | null;
  avatarUrl?: string | null;
  avatarCrop?: AvatarCropValue | null;
  displayName?: string | null;
  nameColor?: string | null;
  status?: "online" | "idle" | "dnd" | "offline" | null;
  activity?: string | null;
}

const CARD_WIDTH = 320;

/** Matches the app's composer breakpoint — below it, the popout becomes a full sheet. */
function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(max-width: 767px)").matches,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return isMobile;
}

function statusDotClass(status?: string | null) {
  return status === "offline"
    ? "bg-gray-400"
    : status === "dnd"
      ? "bg-red-500"
      : status === "idle"
        ? "bg-yellow-500"
        : "bg-green-500";
}

function statusLabel(status?: string | null) {
  return status === "offline" ? "Offline" : status === "dnd" ? "Busy" : status === "idle" ? "Away" : "Online";
}

/** Style for a name that may be a solid color or a CSS gradient string. */
function nameStyle(nameColor?: string | null) {
  if (!nameColor) return undefined;
  if (nameColor.includes("gradient")) {
    return {
      backgroundImage: nameColor,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
    } as const;
  }
  return { color: nameColor } as const;
}

interface CharacterConvoProfile {
  name: string;
  displayName: string;
  aboutMe: string;
}

function parseCharacterConvo(data: unknown): CharacterConvoProfile {
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = (typeof data === "string" ? JSON.parse(data) : data) as Record<string, unknown>;
  } catch {
    parsed = null;
  }
  const ext = (parsed?.extensions ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const name = str(parsed?.name);
  const displayName = typeof ext.convoDisplayName === "string" && ext.convoDisplayName ? ext.convoDisplayName : name;
  return {
    name,
    displayName,
    aboutMe: str(ext.aboutMe),
  };
}

export function AboutMeViewerModal({
  open,
  onClose,
  kind,
  id,
  anchorRect,
  avatarUrl,
  avatarCrop,
  displayName: displayNameProp,
  nameColor,
  status,
  activity,
}: AboutMeViewerModalProps) {
  const activeChatId = useChatStore((s) => s.activeChatId);
  const { data: chat } = useChat(activeChatId);
  const { data: character } = useCharacter(kind === "character" ? id : null);
  const { data: personas } = usePersonas(kind === "persona");
  const updateMeta = useUpdateChatMetadata();
  const isMobile = useIsMobileViewport();

  const profile: CharacterConvoProfile =
    kind === "character"
      ? parseCharacterConvo((character as { data?: unknown } | undefined)?.data)
      : (() => {
          const persona = ((personas ?? []) as Array<Record<string, unknown>>).find((p) => p.id === id);
          const name = typeof persona?.name === "string" ? persona.name : "";
          const dn =
            typeof persona?.convoDisplayName === "string" && persona.convoDisplayName ? persona.convoDisplayName : name;
          return {
            name,
            displayName: dn,
            aboutMe: typeof persona?.aboutMe === "string" ? persona.aboutMe : "",
          };
        })();

  const displayName = displayNameProp || profile.displayName || profile.name || "Profile";
  const handle = profile.name && profile.name !== displayName ? profile.name : "";

  // Parse defensively: a freshly-fetched chat carries `metadata` as a JSON STRING
  // (only mutations normalize it to an object in cache). A raw cast here made the
  // override read `undefined` after any reload/refetch — dropping the chat-specific
  // about-me and, on save, clobbering every other character's override.
  const metadata = parseChatMetadata(chat?.metadata) as Chat["metadata"];
  const overrides = (metadata.conversationAboutMeOverrides ?? {}) as Record<string, string>;
  const override = typeof overrides[id] === "string" ? overrides[id] : undefined;
  const hasOverride = override !== undefined && override.trim().length > 0;
  const effective = hasOverride ? override! : profile.aboutMe;

  const { map: emojiMap } = useConversationCustomEmojis();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  // Value the draft started at so Revert can undo unsaved typing.
  const [editBaseline, setEditBaseline] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const emojiPanelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    setEditing(false);
    setDraft("");
    setEmojiOpen(false);
  }, [id, kind, open]);

  const renderAbout = (text: string) =>
    renderInlineWithCustomEmojis(text, "about-me", emojiMap, (t, kp) => [<span key={kp}>{t}</span>]);

  const insertEmoji = (token: string) => {
    const el = textareaRef.current;
    if (!el) {
      setDraft((d) => d + token);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = el.value.slice(0, start) + token + el.value.slice(end);
    setDraft(next);
    const caret = start + token.length;
    requestAnimationFrame(() => {
      // Desktop: refocus so typing continues. Mobile: keep focus off the field so
      // the on-screen keyboard stays retracted and the docked picker stays visible;
      // the textarea keeps its caret on blur, so the next insert still lands right.
      if (!isMobile) el.focus();
      try {
        el.selectionStart = el.selectionEnd = caret;
      } catch {
        /* ignore */
      }
    });
  };

  // Close the emoji panel when clicking outside it (it's embedded in the card).
  useEffect(() => {
    if (!emojiOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (emojiPanelRef.current?.contains(t) || emojiBtnRef.current?.contains(t)) return;
      setEmojiOpen(false);
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [emojiOpen]);

  // Escape: back out of the emoji panel, then edit mode, then close.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (emojiOpen) setEmojiOpen(false);
      else if (editing) setEditing(false);
      else onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose, editing, emojiOpen]);

  // Anchor the card next to the avatar; flip/clamp to stay on screen.
  // Skipped on mobile, where the card is a full-height sheet (no anchoring).
  useLayoutEffect(() => {
    if (!open || isMobile) return;
    const rect = anchorRect;
    const card = cardRef.current;
    const cw = card?.offsetWidth ?? CARD_WIDTH;
    const ch = card?.offsetHeight ?? 360;
    const gap = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!rect) {
      setPos({ top: Math.max(8, (vh - ch) / 2), left: Math.max(8, (vw - cw) / 2) });
      return;
    }
    let left = rect.right + gap;
    if (left + cw > vw - 8) left = rect.left - cw - gap;
    if (left < 8) left = 8;
    let top = rect.top;
    if (top + ch > vh - 8) top = vh - ch - 8;
    if (top < 8) top = 8;
    setPos({ top, left });
    // Editing and draft changes can change the card height, so re-measure and
    // re-clamp to keep it on screen.
  }, [open, anchorRect, editing, effective, isMobile, draft]);

  if (!open) return null;

  const chatId = activeChatId;
  const isPending = updateMeta.isPending;

  const writeOverrides = async (next: Record<string, string>) => {
    if (!chatId) return;
    await updateMeta.mutateAsync({ id: chatId, conversationAboutMeOverrides: next });
  };

  const handleSave = async () => {
    if (!chatId || isPending) return;
    try {
      const next = { ...overrides };
      if (draft.trim()) next[id] = draft;
      else delete next[id];
      await writeOverrides(next);
      setEditing(false);
      toast.success(draft.trim() ? "Chat-specific about me saved" : "Reverted to the default about me");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const handleClear = async () => {
    if (!chatId || isPending) return;
    const next = { ...overrides };
    delete next[id];
    try {
      await writeOverrides(next);
      setEditing(false);
      toast.success("Reverted to the default about me");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear");
    }
  };

  const emojiPickerNode = (
    <EmojiPicker
      embedded
      open
      onClose={() => setEmojiOpen(false)}
      onSelect={insertEmoji}
      customTab={{
        icon: "⭐",
        label: "Custom emojis",
        render: (query) => <CustomEmojiTab onInsert={insertEmoji} query={query} />,
      }}
    />
  );

  return createPortal(
    <div
      // Inline z-index (Tailwind didn't emit an arbitrary z-[9990]); far above chat UI.
      // `mari-card-css` recreates the card-CSS scope root here (the popout portals to
      // body, outside the chat area), so a card's/persona's custom CSS can theme it.
      // Desktop: transparent (Discord-style, no dim). Mobile: dim behind the sheet.
      className={cn("mari-card-css fixed inset-0", isMobile && "bg-black/60")}
      style={{ zIndex: 9990 }}
      data-component="AboutMeProfilePopout"
      // Click outside closes, but NOT while editing (protects the draft; use
      // Cancel / Save / Escape / ✕). On mobile only the strip above the sheet is
      // outside the card.
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (editing || emojiOpen) return;
        onClose();
      }}
    >
      <div
        ref={cardRef}
        // `data-card-css` + the mari-about-me-* classes are the stable hooks a
        // character's/persona's custom CSS targets (see the Card CSS Theming Guide).
        data-card-css={id}
        // Desktop: an anchored bubble, NO overflow-hidden so the emoji panel can
        // open upward past the card top. Mobile: a near-full-height bottom sheet
        // (top strip left for the toolbar), a flex column that keeps the docked
        // emoji picker in normal flow so it can never cover the bio field.
        className={cn(
          "mari-about-me-popout mari-modal-panel border border-[var(--border)] bg-[var(--card)] shadow-2xl",
          isMobile
            ? "absolute inset-x-0 bottom-0 top-16 flex flex-col overflow-hidden rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
            : "absolute w-80 max-w-[calc(100vw-1rem)] rounded-2xl",
        )}
        style={
          isMobile
            ? undefined
            : {
                top: pos?.top ?? anchorRect?.top ?? 80,
                left: pos?.left ?? (anchorRect ? anchorRect.right + 12 : 80),
                visibility: pos ? "visible" : "hidden",
              }
        }
      >
        {/* Banner */}
        <div
          className="mari-about-me-banner h-14 w-full shrink-0 rounded-t-2xl"
          style={{ background: nameColor || "var(--accent)" }}
        />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 rounded-lg bg-black/25 p-1 text-white/90 transition-colors hover:bg-black/40"
          aria-label="Close"
        >
          <X size="0.875rem" />
        </button>

        <div className={cn("px-4 pb-4", isMobile && "flex min-h-0 flex-1 flex-col")}>
          {/* Blown-up avatar overlapping the banner */}
          <div className="-mt-9 mb-2 flex shrink-0 items-end justify-between">
            <div className="mari-about-me-avatar relative">
              <div className="relative h-[4.5rem] w-[4.5rem] overflow-hidden rounded-full border-4 border-[var(--card)] bg-[var(--accent)]">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                    style={getAvatarCropStyle(avatarCrop)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl font-bold text-[var(--muted-foreground)]">
                    {kind === "persona" ? <User size="1.5rem" /> : displayName[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              {kind === "character" && (
                <span
                  title={statusLabel(status)}
                  className={cn(
                    "mari-about-me-status absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-[3px] border-[var(--card)]",
                    statusDotClass(status),
                  )}
                />
              )}
            </div>
          </div>

          {/* Identity */}
          <div className="mb-3 shrink-0">
            <h2
              className="mari-about-me-name text-lg font-bold leading-tight text-[var(--foreground)]"
              style={nameStyle(nameColor)}
            >
              {displayName}
            </h2>
            {handle && (
              <p className="mari-about-me-handle text-[0.8125rem] text-[var(--muted-foreground)]">{profile.name}</p>
            )}
            {kind === "character" && (
              <p className="mari-about-me-presence mt-0.5 text-[0.75rem] text-[var(--muted-foreground)]">
                {statusLabel(status)}
                {activity ? ` · ${activity}` : ""}
              </p>
            )}
          </div>

          {/* About Me */}
          <div
            className={cn(
              "mari-about-me-box rounded-xl bg-[var(--secondary)]/50 p-3",
              isMobile && "flex min-h-0 flex-1 flex-col",
            )}
          >
            <div className="mb-1.5 flex shrink-0 items-center justify-between gap-2">
              <span className="mari-about-me-label text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                About Me
              </span>
              <span
                className={cn(
                  "mari-about-me-badge rounded-full px-1.5 py-0.5 text-[0.5625rem] font-medium",
                  hasOverride
                    ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                    : "bg-[var(--background)]/60 text-[var(--muted-foreground)]",
                )}
              >
                {hasOverride ? "Chat-specific" : "Default"}
              </span>
            </div>

            {!editing ? (
              <div
                className={cn(
                  "mari-about-me-text min-h-[2.5rem] whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-[var(--foreground)]",
                  // Long bios scroll instead of stretching the popout off-screen: fill the
                  // sheet on mobile, cap + scroll on the anchored desktop card.
                  isMobile ? "min-h-0 flex-1 overflow-y-auto" : "max-h-[16rem] overflow-y-auto",
                )}
              >
                {effective.trim() ? (
                  renderAbout(effective)
                ) : (
                  <span className="text-[var(--muted-foreground)]">No about me set.</span>
                )}
              </div>
            ) : (
              <>
                <div className={cn("relative", isMobile && "min-h-0 flex-1")}>
                  {/* Desktop: embedded picker inside the card's own stacking context,
                    opening upward above the field (portaled pickers fought the
                    popout's z-index). Mobile uses the docked panel below instead. */}
                  {!isMobile && emojiOpen && (
                    <div
                      ref={emojiPanelRef}
                      className="absolute bottom-full right-0 z-30 mb-2 flex h-[22rem] w-[21rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl"
                    >
                      {emojiPickerNode}
                    </div>
                  )}
                  <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={5}
                    autoFocus
                    placeholder="What this person shows in this conversation… :emoji: works too"
                    className={cn(
                      "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-2 pr-9 text-[0.8125rem] leading-relaxed outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20",
                      isMobile ? "h-full resize-none" : "resize-y",
                    )}
                  />
                  <button
                    ref={emojiBtnRef}
                    type="button"
                    onClick={() => {
                      if (isMobile) {
                        // Retract / restore the OS keyboard so it doesn't fight the
                        // docked picker for the bottom of the screen.
                        if (!emojiOpen) textareaRef.current?.blur();
                        else textareaRef.current?.focus();
                      }
                      setEmojiOpen((v) => !v);
                    }}
                    aria-label="Emoji"
                    className="absolute bottom-2 right-2 rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  >
                    <Smile size="1rem" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Controls */}
          <div className="mt-3 flex shrink-0 flex-wrap items-center justify-end gap-2">
            {!editing ? (
              <>
                {hasOverride && (
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
                  >
                    <Trash2 size="0.8125rem" />
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDraft(effective);
                    setEditBaseline(effective);
                    setEditing(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-2.5 py-1.5 text-xs font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
                >
                  <Pencil size="0.8125rem" />
                  Edit
                </button>
              </>
            ) : (
              <>
                {draft !== editBaseline && (
                  <button
                    type="button"
                    onClick={() => setDraft(editBaseline)}
                    title="Undo the changes to this about me"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
                  >
                    <Undo2 size="0.8125rem" />
                    Revert
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
                >
                  <RotateCcw size="0.8125rem" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-2.5 py-1.5 text-xs font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <Save size="0.8125rem" />
                  {isPending ? "Saving…" : "Save"}
                </button>
              </>
            )}
          </div>
          <p className="mt-2 shrink-0 text-[0.625rem] text-[var(--muted-foreground)]">
            Default about me is edited on the {kind === "persona" ? "persona" : "character"} card. A chat-specific
            override only applies here.
          </p>
        </div>

        {/* Mobile: emoji picker docked in normal flow at the sheet's bottom, so it
            pushes the bio field up instead of overlaying it. */}
        {isMobile && editing && emojiOpen && (
          <div
            ref={emojiPanelRef}
            className="flex h-[45vh] max-h-[24rem] min-h-[15rem] shrink-0 flex-col overflow-hidden border-t border-[var(--border)] bg-[var(--card)]"
          >
            {emojiPickerNode}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
