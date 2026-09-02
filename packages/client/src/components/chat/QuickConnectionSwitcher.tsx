// ──────────────────────────────────────────────
// Quick Connection Switcher — inline dropdown
// ──────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, Dices, Check } from "lucide-react";
import { useConnections, useUpdateConnection } from "../../hooks/use-connections";
import { useUpdateChat, useChat } from "../../hooks/use-chats";
import { useChatStore } from "../../stores/chat.store";
import { useSidecarStore } from "../../stores/sidecar.store";
import { appendLocalSidecarConnectionOption, isLocalSidecarConnectionOption } from "../../lib/connection-filters";
import { cn } from "../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { ProfessorMariContextBudget } from "../../lib/professor-mari-context-budget";
import { ContextBudgetGauge, ContextBudgetIndicator } from "./ContextBudgetIndicator";

export function QuickConnectionSwitcher({
  className,
  contextBudget,
}: {
  className?: string;
  contextBudget?: ProfessorMariContextBudget | null;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const { data: connections } = useConnections();
  const { data: chat } = useChat(activeChatId);
  const updateChat = useUpdateChat();
  const updateConnection = useUpdateConnection();
  const sidecarModelDownloaded = useSidecarStore((state) => state.modelDownloaded);
  const sidecarModelDisplayName = useSidecarStore((state) => state.modelDisplayName);

  const activeConnectionId = (chat as unknown as Record<string, unknown>)?.connectionId as string | null;
  const chatMode = (chat as unknown as { mode?: string } | null | undefined)?.mode;
  const isRandom = activeConnectionId === "random";

  const sorted = appendLocalSidecarConnectionOption(
    (connections ?? []) as Array<{ id: string; name: string; provider?: string; useForRandom?: string }>,
    chatMode !== "game" && sidecarModelDownloaded,
    sidecarModelDisplayName,
  )
    .filter((connection) => !isRandom || !isLocalSidecarConnectionOption(connection))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const handleSwitch = useCallback(
    (connId: string | null) => {
      if (!activeChatId) return;
      updateChat.mutate({ id: activeChatId, connectionId: connId });
      setOpen(false);
    },
    [activeChatId, updateChat],
  );

  const handleToggleRandom = useCallback(() => {
    if (!activeChatId) return;
    updateChat.mutate({ id: activeChatId, connectionId: isRandom ? null : "random" });
  }, [activeChatId, isRandom, updateChat]);

  const handleTogglePool = useCallback(
    (connId: string, inPool: boolean) => {
      updateConnection.mutate({ id: connId, useForRandom: !inPool });
    },
    [updateConnection],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const menu = menuRef.current;
      const focusTarget =
        menu?.querySelector<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])') ?? menu;
      focusTarget?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const hasContextBudget = Boolean(contextBudget);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const inputBox = btnRef.current.closest(".marinara-chat-input-shell") as HTMLElement | null;
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
  }, [open, hasContextBudget]);

  if (!activeChatId) return null;

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={localizeUi("navigation.topbar.connections")}
            tabIndex={-1}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setOpen(false);
                btnRef.current?.focus();
              }
            }}
            className="fixed z-[9999] flex min-w-[280px] max-w-[340px] max-h-[360px] flex-col overflow-hidden rounded-xl border border-foreground/10 bg-[var(--background)] shadow-2xl"
            style={pos ? { left: pos.left, top: pos.top } : { visibility: "hidden" as const }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-foreground/10 px-3 py-2">
              <span className="text-[0.6875rem] font-semibold">{localizeUi("navigation.topbar.connections")}</span>
              <button
                type="button"
                onClick={handleToggleRandom}
                title={
                  isRandom
                    ? localizeUi("ui.chat.quickconnectionswitcher.randomPoolActiveClickToDisable")
                    : localizeUi("ui.chat.quickconnectionswitcher.useRandomConnectionFromPool")
                }
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-md transition-all active:scale-90",
                  isRandom
                    ? "bg-foreground/10 text-foreground/75 ring-1 ring-foreground/20"
                    : "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70",
                )}
              >
                <Dices size="0.875rem" />
              </button>
            </div>
            {contextBudget && (
              <div className="border-b border-foreground/10 px-3 pt-2">
                <ContextBudgetIndicator budget={contextBudget} />
              </div>
            )}
            <div className="overflow-y-auto p-1">
              {sorted.map((conn) => {
                const inPool = conn.useForRandom === "true";
                const isActive = activeConnectionId === conn.id;
                if (isRandom) {
                  return (
                    <button
                      type="button"
                      key={conn.id}
                      onClick={() => handleTogglePool(conn.id, inPool)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-foreground/10"
                      title={
                        inPool
                          ? localizeUi("ui.chat.quickconnectionswitcher.inRandomPoolClickToRemove")
                          : localizeUi("ui.chat.quickconnectionswitcher.clickToAddToRandomPool")
                      }
                    >
                      <span className="flex-1 truncate">{conn.name || conn.id}</span>
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                          inPool
                            ? "border-foreground/35 bg-foreground/10 text-foreground/75"
                            : "border-foreground/20 bg-transparent",
                        )}
                      >
                        {inPool && <Check size="0.625rem" strokeWidth={3} />}
                      </span>
                    </button>
                  );
                }
                return (
                  <button
                    type="button"
                    key={conn.id}
                    onClick={() => handleSwitch(conn.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-foreground/10",
                      isActive && "text-foreground font-semibold",
                    )}
                  >
                    <span className="flex-1 truncate">{conn.name || conn.id}</span>
                    {isActive && <span className="text-[0.6875rem]">✓</span>}
                  </button>
                );
              })}

              {sorted.length === 0 && (
                <div className="px-3 py-4 text-center text-[0.6875rem] italic text-foreground/45">
                  {localizeUi("ui.chat.quickconnectionswitcher.noConnectionsFound")}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        title={localizeUi("ui.chat.quickconnectionswitcher.quickConnectionSwitcher")}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
          open
            ? "bg-foreground/10 text-foreground/75 ring-1 ring-foreground/20"
            : "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70",
          className,
        )}
      >
        <span className="relative flex h-[1.875rem] w-[1.875rem] items-center justify-center">
          {contextBudget && <ContextBudgetGauge percentage={contextBudget.percentage} />}
          <Link size="1rem" />
        </span>
      </button>
      {menu}
    </>
  );
}
