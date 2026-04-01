// ──────────────────────────────────────────────
// Quick Persona Switcher — inline avatar dropdown
// ──────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect } from "react";
import { usePersonas } from "../../hooks/use-characters";
import { useUpdateChat, useChat } from "../../hooks/use-chats";
import { useChatStore } from "../../stores/chat.store";
import { cn } from "../../lib/utils";

interface Persona {
  id: string;
  name: string;
  avatarPath?: string | null;
  comment?: string | null;
  description?: string | null;
}

export function QuickPersonaSwitcher({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const { data: rawPersonas } = usePersonas();
  const { data: chat } = useChat(activeChatId);
  const updateChat = useUpdateChat();

  const personas = ((rawPersonas ?? []) as Persona[])
    .slice()
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const activePersonaId = (chat as unknown as Record<string, unknown>)?.personaId as string | null;
  const activePersona = personas.find((p) => p.id === activePersonaId) ?? null;

  const handleSwitch = useCallback(
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

  // Position menu above button
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const inputBox = btnRef.current.closest(".rounded-2xl") as HTMLElement | null;
    const anchorTop = inputBox ? inputBox.getBoundingClientRect().top : rect.top;
    requestAnimationFrame(() => {
      const menuEl = menuRef.current;
      const menuHeight = menuEl?.offsetHeight || 400;
      let left = rect.left;
      if (left + 300 > window.innerWidth) left = window.innerWidth - 308;
      setPos({ left, top: Math.max(8, anchorTop - menuHeight - 4) });
    });
  }, [open]);

  if (!activeChatId) return null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        title={
          activePersona
            ? `${activePersona.name}${activePersona.comment ? " — " + activePersona.comment : ""}`
            : "Quick Persona Switcher"
        }
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full overflow-hidden transition-all border-2",
          open ? "border-[var(--primary)]" : "border-transparent hover:border-[var(--primary)] hover:opacity-90",
          className,
        )}
      >
        {activePersona?.avatarPath ? (
          <img
            src={activePersona.avatarPath}
            alt={activePersona.name}
            className="h-full w-full object-cover rounded-full"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-[var(--secondary)] text-[0.75rem] font-semibold text-[var(--muted-foreground)]">
            {activePersona ? (activePersona.name || "?")[0].toUpperCase() : "?"}
          </div>
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          className="fixed z-[9999] flex min-w-[280px] max-w-[340px] max-h-[400px] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
          style={pos ? { left: pos.left, top: pos.top } : { visibility: "hidden" as const }}
        >
          <div className="flex items-center justify-center border-b border-[var(--border)] px-3 py-2 text-[0.6875rem] font-semibold">
            Personas
          </div>
          <div className="overflow-y-auto p-1">
            {/* None option */}
            <button
              onClick={() => handleSwitch(null)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--accent)]",
                !activePersonaId && "text-[var(--primary)]",
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--secondary)] text-xs font-semibold text-[var(--muted-foreground)]">
                ?
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className={cn("text-xs font-semibold", !activePersonaId && "text-[var(--primary)]")}>None</span>
                <span className="text-[0.625rem] text-[var(--muted-foreground)]">No persona selected</span>
              </div>
              {!activePersonaId && <span className="ml-auto text-[0.6875rem]">✓</span>}
            </button>

            <div className="mx-2 my-1 h-px bg-[var(--border)]" />

            {personas.map((persona) => {
              const isActive = persona.id === activePersonaId;
              return (
                <button
                  key={persona.id}
                  onClick={() => handleSwitch(persona.id)}
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

            {personas.length === 0 && (
              <div className="px-3 py-4 text-center text-[0.6875rem] italic text-[var(--muted-foreground)]">
                No personas found.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
