// ──────────────────────────────────────────────
// Quick Switcher Mobile — single chevron opens
// a tabbed menu with Connections + Personas
// ──────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect } from "react";
import { ChevronUp, Link, CircleUser } from "lucide-react";
import { useConnections } from "../../hooks/use-connections";
import { usePersonas } from "../../hooks/use-characters";
import { useUpdateChat, useChat } from "../../hooks/use-chats";
import { useChatStore } from "../../stores/chat.store";
import { cn } from "../../lib/utils";

interface Persona {
  id: string;
  name: string;
  avatarPath?: string | null;
  comment?: string | null;
}

export function QuickSwitcherMobile() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"connections" | "personas">("connections");
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const { data: connections } = useConnections();
  const { data: rawPersonas } = usePersonas();
  const { data: chat } = useChat(activeChatId);
  const updateChat = useUpdateChat();

  const activeConnectionId = (chat as unknown as Record<string, unknown>)?.connectionId as string | null;
  const activePersonaId = (chat as unknown as Record<string, unknown>)?.personaId as string | null;

  const sortedConnections = ((connections ?? []) as Array<{ id: string; name: string }>)
    .slice()
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const sortedPersonas = ((rawPersonas ?? []) as Persona[])
    .slice()
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const handleSwitchConnection = useCallback(
    (connId: string | null) => {
      if (!activeChatId) return;
      updateChat.mutate({ id: activeChatId, connectionId: connId });
      setOpen(false);
    },
    [activeChatId, updateChat],
  );

  const handleSwitchPersona = useCallback(
    (personaId: string | null) => {
      if (!activeChatId) return;
      updateChat.mutate({ id: activeChatId, personaId });
      setOpen(false);
    },
    [activeChatId, updateChat],
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Position menu above input box, aligned to its left edge
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      // Find the input box container (the rounded border div)
      const inputBox = btnRef.current!.closest(".rounded-2xl") as HTMLElement | null;
      const menuEl = menuRef.current;
      const menuHeight = menuEl?.offsetHeight || 400;

      if (inputBox) {
        const boxRect = inputBox.getBoundingClientRect();
        setPos({
          left: boxRect.left,
          top: Math.max(8, boxRect.top - menuHeight - 4),
          width: boxRect.width,
        });
      } else {
        // Fallback to button position
        const rect = btnRef.current!.getBoundingClientRect();
        setPos({
          left: 8,
          top: Math.max(8, rect.top - menuHeight - 8),
          width: 300,
        });
      }
    };
    requestAnimationFrame(update);
    const timer = setTimeout(update, 50);
    return () => clearTimeout(timer);
  }, [open, tab]);

  if (!activeChatId) return null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        title="Quick Switcher"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
          open
            ? "text-[var(--primary)]"
            : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
        )}
      >
        <ChevronUp size="1rem" className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          ref={menuRef}
          className="fixed z-[9999] flex max-h-[400px] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
          style={pos ? { left: pos.left, top: pos.top, width: pos.width } : { visibility: "hidden" as const }}
        >
          {/* Tab bar with icons */}
          <div className="flex border-b border-[var(--border)]">
            <button
              onClick={() => setTab("connections")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-[0.6875rem] font-semibold transition-colors",
                tab === "connections"
                  ? "text-[var(--foreground)] border-b-2 border-[var(--primary)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
              )}
            >
              <Link size="0.75rem" />
              Connections
            </button>
            <button
              onClick={() => setTab("personas")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-[0.6875rem] font-semibold transition-colors",
                tab === "personas"
                  ? "text-[var(--foreground)] border-b-2 border-[var(--primary)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
              )}
            >
              <CircleUser size="0.75rem" />
              Personas
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto p-1">
            {tab === "connections" && (
              <>
                <button
                  onClick={() => handleSwitchConnection("random")}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--accent)]",
                    activeConnectionId === "random" && "text-[var(--primary)] font-semibold",
                  )}
                >
                  <span>🎲 Random</span>
                  {activeConnectionId === "random" && <span className="ml-auto text-[0.6875rem]">✓</span>}
                </button>

                <div className="mx-2 my-1 h-px bg-[var(--border)]" />

                {sortedConnections.map((conn) => (
                  <button
                    key={conn.id}
                    onClick={() => handleSwitchConnection(conn.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--accent)]",
                      activeConnectionId === conn.id && "text-[var(--primary)] font-semibold",
                    )}
                  >
                    <span>{conn.name || conn.id}</span>
                    {activeConnectionId === conn.id && <span className="ml-auto text-[0.6875rem]">✓</span>}
                  </button>
                ))}

                {sortedConnections.length === 0 && (
                  <div className="px-3 py-4 text-center text-[0.6875rem] italic text-[var(--muted-foreground)]">
                    No connections found.
                  </div>
                )}
              </>
            )}

            {tab === "personas" && (
              <>
                <button
                  onClick={() => handleSwitchPersona(null)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--accent)]",
                    !activePersonaId && "text-[var(--primary)]",
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--secondary)] text-xs font-semibold text-[var(--muted-foreground)]">
                    ?
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className={cn("text-xs font-semibold", !activePersonaId && "text-[var(--primary)]")}>
                      None
                    </span>
                    <span className="text-[0.625rem] text-[var(--muted-foreground)]">No persona selected</span>
                  </div>
                  {!activePersonaId && <span className="ml-auto text-[0.6875rem]">✓</span>}
                </button>

                <div className="mx-2 my-1 h-px bg-[var(--border)]" />

                {sortedPersonas.map((persona) => {
                  const isActive = persona.id === activePersonaId;
                  return (
                    <button
                      key={persona.id}
                      onClick={() => handleSwitchPersona(persona.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--accent)]",
                        isActive && "text-[var(--primary)]",
                      )}
                    >
                      {persona.avatarPath ? (
                        <img
                          src={persona.avatarPath}
                          alt={persona.name}
                          className="h-9 w-9 shrink-0 rounded-full border border-[var(--border)] object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--secondary)] text-xs font-semibold text-[var(--muted-foreground)]">
                          {(persona.name || "?")[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className={cn("text-xs font-semibold", isActive && "text-[var(--primary)]")}>
                          {persona.name || persona.id}
                        </span>
                        {persona.comment && (
                          <span className="truncate text-[0.625rem] leading-tight text-[var(--muted-foreground)]">
                            {persona.comment.length > 60 ? persona.comment.substring(0, 60) + "…" : persona.comment}
                          </span>
                        )}
                      </div>
                      {isActive && <span className="ml-auto shrink-0 text-[0.6875rem]">✓</span>}
                    </button>
                  );
                })}

                {sortedPersonas.length === 0 && (
                  <div className="px-3 py-4 text-center text-[0.6875rem] italic text-[var(--muted-foreground)]">
                    No personas found.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
