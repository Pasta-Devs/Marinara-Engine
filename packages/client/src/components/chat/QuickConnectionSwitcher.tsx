// ──────────────────────────────────────────────
// Quick Connection Switcher — inline dropdown
// ──────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "lucide-react";
import { useConnections } from "../../hooks/use-connections";
import { useUpdateChat, useChat } from "../../hooks/use-chats";
import { useChatStore } from "../../stores/chat.store";
import { cn } from "../../lib/utils";

export function QuickConnectionSwitcher({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const { data: connections } = useConnections();
  const { data: chat } = useChat(activeChatId);
  const updateChat = useUpdateChat();

  const activeConnectionId = (chat as unknown as Record<string, unknown>)?.connectionId as string | null;

  const sorted = ((connections ?? []) as Array<{ id: string; name: string }>)
    .slice()
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const handleSwitch = useCallback(
    (connId: string | null) => {
      if (!activeChatId) return;
      updateChat.mutate({ id: activeChatId, connectionId: connId });
      setOpen(false);
    },
    [activeChatId, updateChat],
  );

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

  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const inputBox = btnRef.current.closest(".rounded-2xl") as HTMLElement | null;
    const anchorTop = inputBox ? inputBox.getBoundingClientRect().top : rect.top;
    requestAnimationFrame(() => {
      const menuEl = menuRef.current;
      const menuHeight = menuEl?.offsetHeight || 360;
      const menuWidth = menuEl?.offsetWidth || 300;
      let left = rect.left;
      if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 8;
      if (left < 8) left = 8;
      setPos({ left, top: Math.max(8, anchorTop - menuHeight - 4) });
    });
  }, [open]);

  if (!activeChatId) return null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        title="Quick Connection Switcher"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
          open
            ? "text-[var(--primary)]"
            : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
          className,
        )}
      >
        <Link size="1rem" />
      </button>

      {open && (
        <div
          ref={menuRef}
          className="fixed z-[9999] flex min-w-[280px] max-w-[340px] max-h-[360px] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
          style={pos ? { left: pos.left, top: pos.top } : { visibility: "hidden" as const }}
        >
          <div className="flex items-center justify-center border-b border-[var(--border)] px-3 py-2 text-[0.6875rem] font-semibold">
            Connections
          </div>
          <div className="overflow-y-auto p-1">
            <button
              onClick={() => handleSwitch("random")}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--accent)]",
                activeConnectionId === "random" && "text-[var(--primary)] font-semibold",
              )}
            >
              <span>🎲 Random</span>
              {activeConnectionId === "random" && <span className="ml-auto text-[0.6875rem]">✓</span>}
            </button>

            <div className="mx-2 my-1 h-px bg-[var(--border)]" />

            {sorted.map((conn) => (
              <button
                key={conn.id}
                onClick={() => handleSwitch(conn.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--accent)]",
                  activeConnectionId === conn.id && "text-[var(--primary)] font-semibold",
                )}
              >
                <span>{conn.name || conn.id}</span>
                {activeConnectionId === conn.id && <span className="ml-auto text-[0.6875rem]">✓</span>}
              </button>
            ))}

            {sorted.length === 0 && (
              <div className="px-3 py-4 text-center text-[0.6875rem] italic text-[var(--muted-foreground)]">
                No connections found.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
