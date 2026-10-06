// ──────────────────────────────────────────────
// Quick Connection Switcher — inline dropdown with
// the chosen connection's models beside the list
// ──────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, Dices, Check } from "lucide-react";
import { useConnections, useUpdateConnection } from "../../hooks/use-connections";
import { useUpdateChat, useChat } from "../../hooks/use-chats";
import { useChatStore } from "../../stores/chat.store";
import { useSidecarStore } from "../../stores/sidecar.store";
import {
  appendLocalSidecarConnectionOption,
  isLocalSidecarConnectionOption,
  resolveNanoGptUsageConnection,
} from "../../lib/connection-filters";
import { cn } from "../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { ProfessorMariContextBudget } from "../../lib/professor-mari-context-budget";
import { ContextBudgetGauge, ContextBudgetIndicator } from "./ContextBudgetIndicator";
import { NanoGptUsageWidget } from "../connections/NanoGptUsageWidget";
import { ConnectionModelPicker } from "../connections/ConnectionModelPicker";

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
    (connections ?? []) as Array<{
      id: string;
      name: string;
      provider?: string;
      model?: string;
      pinnedModels?: unknown;
      useForRandom?: string;
      showUsageWidget?: unknown;
    }>,
    chatMode !== "game" && sidecarModelDownloaded,
    sidecarModelDisplayName,
  )
    .filter((connection) => !isRandom || !isLocalSidecarConnectionOption(connection))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  // The NanoGPT quota follows the selected connection, and never Random, which
  // has no single connection to read a quota from.
  const usageConnection = resolveNanoGptUsageConnection(sorted, activeConnectionId);

  // The Models column shows the chosen connection's models. Choosing a connection keeps the menu open so a
  // model can be picked next; picking a model closes it. Random has no single connection, so no column.
  const [chosenConnectionId, setChosenConnectionId] = useState<string | null>(null);
  useEffect(() => {
    if (!open) setChosenConnectionId(null);
  }, [open]);
  const modelsConnectionId = chosenConnectionId ?? activeConnectionId;
  const showModels = !isRandom;
  const modelsConnection = showModels ? sorted.find((connection) => connection.id === modelsConnectionId) : undefined;

  const handleSwitch = useCallback(
    (connId: string) => {
      if (!activeChatId) return;
      setChosenConnectionId(connId);
      if (connId !== activeConnectionId) updateChat.mutate({ id: activeChatId, connectionId: connId });
    },
    [activeChatId, activeConnectionId, updateChat],
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
    // Escape closes the menu wherever focus is: Safari does not focus a tapped or clicked button.
    const onKeyDown = (event: KeyboardEvent) => {
      // Escape while an input method is composing cancels the composition, not the menu.
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
      setOpen(false);
      btnRef.current?.focus();
    };
    document.addEventListener("pointerdown", handler);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handler);
      document.removeEventListener("keydown", onKeyDown);
    };
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
  }, [open, hasContextBudget, showModels]);

  // Focus once the menu is placed: a hidden menu cannot take focus.
  const placed = pos !== null;
  useEffect(() => {
    if (!open || !placed) return;
    const frame = window.requestAnimationFrame(() => {
      const menu = menuRef.current;
      // With a mouse, the model search takes focus so typing filters right away; a touch keyboard
      // would cover the menu, so touch screens keep the first button focused.
      const modelSearch = window.matchMedia?.("(pointer: fine)").matches
        ? menu?.querySelector<HTMLElement>("[data-model-search]")
        : null;
      const focusTarget =
        modelSearch ??
        menu?.querySelector<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])') ??
        menu;
      focusTarget?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, placed]);

  if (!activeChatId) return null;

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            // A non-modal dialog: it holds a search box and toggle buttons, not menu items.
            role="dialog"
            aria-label={localizeUi("navigation.topbar.connections")}
            tabIndex={-1}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                event.stopPropagation();
                setOpen(false);
                btnRef.current?.focus();
              }
            }}
            data-quick-connection-menu
            className={cn(
              "mari-chat-style-surface fixed z-[9999] flex overflow-hidden rounded-xl border border-foreground/10 shadow-2xl",
              showModels
                ? // A fixed size keeps the menu still while a model list loads or is filtered.
                  "h-[min(30rem,calc(100dvh-6rem))] w-[min(46rem,calc(100vw-1rem))]"
                : cn(
                    "min-w-[280px] max-w-[340px] flex-col",
                    // The quota meter adds height above the list, so let the menu grow
                    // rather than clip the list a second time.
                    usageConnection ? "max-h-[440px]" : "max-h-[360px]",
                  ),
              chatMode === "roleplay"
                ? "bg-[var(--card)] [--mari-chat-existing-bg:var(--card)]"
                : "bg-[var(--background)] [--mari-chat-existing-bg:var(--background)]",
            )}
            style={pos ? { left: pos.left, top: pos.top } : { visibility: "hidden" as const }}
          >
            <div
              className={cn(
                "flex min-h-0 flex-col",
                showModels ? "w-[15.5rem] shrink-0 border-r border-foreground/10" : "w-full",
              )}
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
              {usageConnection && (
                <div className="border-b border-foreground/10 px-3 pt-1">
                  <NanoGptUsageWidget connectionId={usageConnection.id} variant="inline" />
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
                  const isShown = modelsConnectionId === conn.id;
                  return (
                    <button
                      type="button"
                      key={conn.id}
                      data-connection-option={conn.id}
                      aria-current={isActive ? "true" : undefined}
                      onClick={() => handleSwitch(conn.id)}
                      className={cn(
                        "relative flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-foreground/10",
                        isShown && "bg-foreground/[0.07]",
                        isActive && "text-foreground font-semibold",
                      )}
                    >
                      {isShown && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-[var(--marinara-chat-chrome-accent)]"
                        />
                      )}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{conn.name || conn.id}</span>
                        {isActive && conn.model && (
                          <span className="truncate text-[0.625rem] font-normal text-foreground/50">{conn.model}</span>
                        )}
                      </span>
                      {isActive && (
                        <Check size="0.75rem" className="shrink-0 text-[var(--marinara-chat-chrome-accent)]" />
                      )}
                    </button>
                  );
                })}

                {sorted.length === 0 && (
                  <div className="px-3 py-4 text-center text-[0.6875rem] italic text-foreground/45">
                    {localizeUi("ui.chat.quickconnectionswitcher.noConnectionsFound")}
                  </div>
                )}
              </div>
            </div>
            {showModels && (
              <div data-quick-connection-models className="flex min-h-0 min-w-0 flex-1 flex-col">
                {modelsConnection && !isLocalSidecarConnectionOption(modelsConnection) ? (
                  <ConnectionModelPicker
                    connection={modelsConnection}
                    chatId={activeChatId}
                    chatConnectionId={activeConnectionId}
                    onPicked={() => {
                      setOpen(false);
                      btnRef.current?.focus();
                    }}
                  />
                ) : (
                  <p className="px-4 py-4 text-[0.6875rem] text-foreground/50">
                    {localizeUi(
                      modelsConnection
                        ? "connections.modelPicker.localModel"
                        : "connections.modelPicker.chooseConnection",
                    )}
                  </p>
                )}
              </div>
            )}
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
