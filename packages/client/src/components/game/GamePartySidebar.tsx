// ──────────────────────────────────────────────
// Game: Party Chat Sidebar
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Users, Send, ChevronLeft, ChevronRight, Swords, Heart, Sparkles } from "lucide-react";
import { cn, getAvatarCropStyle, type AvatarCropValue } from "../../lib/utils";
import { AnimatedText } from "./AnimatedText";
import { NEUTRAL_SURFACE_VARIABLES } from "../ui/neutral-surface-styles";

interface PartyChatMessage {
  id: string;
  role: string;
  content: string;
  characterId: string | null;
  characterName?: string;
  characterAvatar?: string | null;
}

interface GamePartySidebarProps {
  messages: PartyChatMessage[];
  expanded: boolean;
  onToggle: () => void;
  onSend: (message: string) => void;
  isStreaming: boolean;
  partyMembers?: Array<{
    id: string;
    name: string;
    avatarUrl?: string | null;
    avatarCrop?: AvatarCropValue | null;
    nameColor?: string;
    dialogueColor?: string;
  }>;
  partyCards?: Record<
    string,
    {
      title: string;
      subtitle?: string;
      mood?: string;
      status?: string;
      level?: number;
      avatarUrl?: string | null;
      avatarCrop?: AvatarCropValue | null;
      stats?: Array<{ name: string; value: number; max?: number; color?: string }>;
      inventory?: Array<{ name: string; quantity?: number; location?: string }>;
      customFields?: Record<string, string>;
    }
  >;
}

export function GamePartySidebar({
  messages,
  expanded,
  onToggle,
  onSend,
  isStreaming,
  partyMembers,
  partyCards,
}: GamePartySidebarProps) {
  const [text, setText] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(partyMembers?.[0]?.id ?? null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!partyMembers?.length) {
      setSelectedMemberId(null);
      return;
    }
    if (!selectedMemberId || !partyMembers.some((m) => m.id === selectedMemberId)) {
      setSelectedMemberId(partyMembers[0]!.id);
    }
  }, [partyMembers, selectedMemberId]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectedCard = selectedMemberId ? partyCards?.[selectedMemberId] : null;
  const partyMembersByName = new Map((partyMembers ?? []).map((m) => [m.name.toLowerCase(), m]));

  return (
    <div
      className={cn(
        "game-party-sidebar flex h-full min-h-0 flex-col border-l border-[var(--border)] bg-[var(--card)]/92 backdrop-blur-sm transition-all duration-200",
        expanded ? "w-80 expanded" : "w-12",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center border-b border-[var(--border)] px-2 py-2",
          expanded ? "justify-between" : "flex-col gap-1 justify-center",
        )}
      >
        {expanded && (
          <div className="flex items-center gap-1.5">
            <Users size={14} className="text-[var(--muted-foreground)]" />
            <span className="text-xs font-medium text-[var(--foreground)]">Party Chat</span>
          </div>
        )}
        {!expanded && <Users size={14} className="text-[var(--muted-foreground)]" />}
        <button
          onClick={onToggle}
          className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
        >
          {expanded ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {expanded && (
        <>
          {/* Party member avatars */}
          {partyMembers && partyMembers.length > 0 && (
            <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)] px-2 py-2">
              {partyMembers.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMemberId(m.id)}
                  className={cn(
                    "group relative shrink-0 rounded-full p-0.5 ring-1 transition-all",
                    selectedMemberId === m.id
                      ? "bg-[var(--foreground)]/10 ring-[var(--foreground)]/25"
                      : "ring-[var(--border)] hover:ring-[var(--foreground)]/25",
                  )}
                  title={m.name}
                >
                  {m.avatarUrl ? (
                    <span className="relative block h-8 w-8 overflow-hidden rounded-full">
                      <img
                        src={m.avatarUrl}
                        alt={m.name}
                        className="h-full w-full object-cover"
                        style={getAvatarCropStyle(m.avatarCrop)}
                      />
                    </span>
                  ) : (
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-[0.5625rem] font-bold"
                      style={m.nameColor ? { color: m.nameColor } : undefined}
                    >
                      {m.name[0]}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* RPG character card */}
          {selectedCard && (
            <div
              className={cn(
                NEUTRAL_SURFACE_VARIABLES,
                "border-b border-[var(--border)] bg-[var(--secondary)]/55 px-2 py-2",
              )}
            >
              <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]/80 shadow-lg">
                {/* Card header with avatar + name */}
                <div className="relative border-b border-[var(--border)] bg-[var(--secondary)]/45 px-2.5 py-2">
                  <div className="flex items-center gap-2">
                    {selectedCard.avatarUrl ? (
                      <span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-md border border-[var(--border)] shadow-md">
                        <img
                          src={selectedCard.avatarUrl}
                          alt={selectedCard.title}
                          className="h-full w-full object-cover"
                          style={getAvatarCropStyle(selectedCard.avatarCrop)}
                        />
                      </span>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--secondary)] text-sm font-bold text-[var(--muted-foreground)]">
                        {selectedCard.title[0]}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="overflow-x-auto whitespace-nowrap scrollbar-hide text-[0.75rem] font-bold text-[var(--foreground)] [-webkit-overflow-scrolling:touch]">
                        {selectedCard.title}
                      </p>
                      {selectedCard.subtitle && (
                        <p className="text-[0.6rem] text-[var(--muted-foreground)]">{selectedCard.subtitle}</p>
                      )}
                    </div>
                    {selectedCard.level != null && (
                      <div className="flex items-center gap-0.5 rounded border border-[var(--border)] bg-[var(--background)]/60 px-1 py-px">
                        <span className="text-[0.4375rem] uppercase tracking-wider text-[var(--muted-foreground)]">
                          LVL
                        </span>
                        <span className="text-[0.5rem] font-bold leading-none text-[var(--foreground)]">
                          {selectedCard.level}
                        </span>
                      </div>
                    )}
                  </div>
                  {selectedCard.mood && (
                    <div className="mt-1.5 flex items-center gap-1">
                      <Heart size={9} className="text-[var(--marinara-chat-chrome-panel-muted)]" />
                      <span className="text-[0.5625rem] italic text-[var(--marinara-chat-chrome-panel-muted)]">
                        {selectedCard.mood}
                      </span>
                    </div>
                  )}
                </div>

                {/* Stats bars */}
                {selectedCard.stats && selectedCard.stats.length > 0 && (
                  <div className="space-y-1 border-b border-[var(--border)] px-2.5 py-2">
                    {selectedCard.stats.slice(0, 6).map((stat) => {
                      const max = Math.max(1, stat.max ?? 100);
                      const value = Math.max(0, Math.min(max, stat.value));
                      const width = (value / max) * 100;
                      return (
                        <div key={stat.name}>
                          <div className="mb-0.5 flex items-center justify-between text-[0.5625rem]">
                            <span className="font-medium text-[var(--foreground)]/75">{stat.name}</span>
                            <span className="font-mono text-[var(--muted-foreground)]">
                              {value}/{max}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${width}%`,
                                background: stat.color || "linear-gradient(90deg, #b45309, #f59e0b)",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Inventory */}
                {selectedCard.inventory && selectedCard.inventory.length > 0 && (
                  <div className="border-b border-[var(--border)] px-2.5 py-1.5">
                    <div className="mb-1 flex items-center gap-1 text-[0.5625rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      <Swords size={9} />
                      <span>Inventory</span>
                    </div>
                    <div className="space-y-0.5">
                      {selectedCard.inventory.slice(0, 5).map((item) => (
                        <div
                          key={`${item.name}-${item.location ?? "bag"}`}
                          className="flex items-start justify-between gap-1 text-[0.5625rem]"
                        >
                          <span className="min-w-0 flex-1 whitespace-normal break-words leading-tight text-[var(--foreground)]/75 [overflow-wrap:anywhere]">
                            {item.name}
                          </span>
                          {item.quantity && item.quantity > 1 && (
                            <span className="ml-1 shrink-0 font-mono text-white/80">×{item.quantity}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom fields */}
                {selectedCard.customFields && Object.keys(selectedCard.customFields).length > 0 && (
                  <div className="border-t border-[var(--border)] px-2.5 py-1.5">
                    <div className="mb-1 flex items-center gap-1 text-[0.5625rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      <Sparkles size={9} />
                      <span>Traits</span>
                    </div>
                    <div className="space-y-0.5 text-[0.5625rem]">
                      {Object.entries(selectedCard.customFields)
                        .slice(0, 4)
                        .map(([key, val]) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-[var(--muted-foreground)]">{key}</span>
                            <span className="text-[var(--foreground)]/70">{val}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Fallback status when no stats/inventory */}
                {!selectedCard.stats?.length && !selectedCard.inventory?.length && selectedCard.status && (
                  <div className="px-2.5 py-2">
                    <p className="text-[0.625rem] italic text-[var(--muted-foreground)]">{selectedCard.status}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* No card data — show member name at minimum */}
          {!selectedCard && selectedMemberId && (
            <div className="border-b border-[var(--border)] bg-[var(--secondary)]/55 px-2 py-2">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]/80 px-2.5 py-3 text-center">
                <p className="text-[0.6875rem] font-bold text-[var(--foreground)]">
                  {partyMembers?.find((m) => m.id === selectedMemberId)?.name ?? "Unknown"}
                </p>
                <p className="mt-0.5 text-[0.5625rem] text-[var(--muted-foreground)]">
                  Card data will populate as the story progresses
                </p>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 py-2">
            {messages.length === 0 ? (
              <p className="py-4 text-center text-xs text-[var(--muted-foreground)]">Party members will chat here...</p>
            ) : (
              messages.map((msg) => {
                const msgMember = msg.characterName ? partyMembersByName.get(msg.characterName.toLowerCase()) : null;
                return (
                  <div key={msg.id} className="flex items-start gap-1.5 text-xs">
                    {msg.characterAvatar ? (
                      <span className="relative mt-0.5 block h-5 w-5 shrink-0 overflow-hidden rounded-full">
                        <img
                          src={msg.characterAvatar}
                          alt=""
                          className="h-full w-full object-cover"
                          style={getAvatarCropStyle(msgMember?.avatarCrop)}
                        />
                      </span>
                    ) : (
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[0.4375rem] font-bold">
                        {(msg.characterName || "P")[0]}
                      </div>
                    )}
                    <div>
                      <span
                        className="font-semibold"
                        style={
                          msg.characterName
                            ? { color: msgMember?.dialogueColor || msgMember?.nameColor || "#7dd3fc" }
                            : { color: "#7dd3fc" }
                        }
                      >
                        {msg.characterName || "Party"}:
                      </span>
                      <AnimatedText html={msg.content} className="text-[var(--foreground)]" />
                    </div>
                  </div>
                );
              })
            )}
            {isStreaming && <div className="text-xs text-[var(--muted-foreground)] animate-pulse">Talking...</div>}
            <div ref={endRef} />
          </div>

          {/* Input — shares exact same height as GameInput */}
          <div className="border-t border-[var(--border)] bg-[var(--card)]" style={{ minHeight: 61 }}>
            <div className="flex items-center gap-1.5 px-2 py-3">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Say to party…"
                className="flex-1 rounded-lg bg-[var(--secondary)] px-2 py-2 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
              />
              <button
                onClick={handleSend}
                disabled={!text.trim()}
                className="flex items-center justify-center rounded-lg p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
