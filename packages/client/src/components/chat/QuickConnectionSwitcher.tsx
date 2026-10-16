// ──────────────────────────────────────────────
// Quick Connection Switcher — inline dropdown with
// the chosen Connection's models beside the list;
// a pick applies to this chat only
// ──────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "lucide-react";
import { useUpdateChat, useChat } from "../../hooks/use-chats";
import { useChatStore } from "../../stores/chat.store";
import { useSidecarStore } from "../../stores/sidecar.store";
import { cn } from "../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { ProfessorMariContextBudget } from "../../lib/professor-mari-context-budget";
import { ContextBudgetGauge, ContextBudgetIndicator } from "./ContextBudgetIndicator";
import { ConnectionSwitcherBody, useChatModelPick } from "../connections/ConnectionSwitcherBody";

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
  const { data: chat } = useChat(activeChatId);
  const updateChat = useUpdateChat();
  const chatPick = useChatModelPick(activeChatId);
  const sidecarModelDownloaded = useSidecarStore((state) => state.modelDownloaded);

  const activeConnectionId = (chat as unknown as Record<string, unknown>)?.connectionId as string | null;
  const chatMode = (chat as unknown as { mode?: string } | null | undefined)?.mode;
  const isRandom = activeConnectionId === "random";
  // Random has no single connection, so no models column.
  const showModels = !isRandom;

  const handleToggleRandom = useCallback(() => {
    if (!activeChatId) return;
    updateChat.mutate({ id: activeChatId, connectionId: isRandom ? null : "random" });
  }, [activeChatId, isRandom, updateChat]);

  const close = useCallback(() => {
    setOpen(false);
    btnRef.current?.focus();
  }, []);

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
      // With a mouse, the search takes focus so typing finds any model right away; a touch keyboard
      // would cover the menu, so touch screens keep the first button focused.
      const modelSearch = window.matchMedia?.("(pointer: fine)").matches
        ? menu?.querySelector<HTMLElement>("[data-switcher-search]")
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
                : "max-h-[360px] min-w-[280px] max-w-[340px] flex-col",
              chatMode === "roleplay"
                ? "bg-[var(--card)] [--mari-chat-existing-bg:var(--card)]"
                : "bg-[var(--background)] [--mari-chat-existing-bg:var(--background)]",
            )}
            style={pos ? { left: pos.left, top: pos.top } : { visibility: "hidden" as const }}
          >
            <ConnectionSwitcherBody
              layout="columns"
              current={chatPick.current}
              recent={chatPick.recent}
              onApply={chatPick.apply}
              onDone={close}
              showLocalModel={chatMode !== "game" && sidecarModelDownloaded}
              shuffle={{ active: isRandom, onToggle: handleToggleRandom }}
              followDefault={{ active: chatPick.followsMain, onSelect: chatPick.useDefault }}
              className={showModels ? undefined : "flex-col"}
              listClassName={showModels ? undefined : "w-full border-r-0"}
              listHeader={
                contextBudget && (
                  <div className="border-b border-foreground/10 px-3 pt-2">
                    <ContextBudgetIndicator budget={contextBudget} />
                  </div>
                )
              }
            />
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
