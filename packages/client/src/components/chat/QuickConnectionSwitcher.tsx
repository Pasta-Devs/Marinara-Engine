// ──────────────────────────────────────────────
// Quick Connection Switcher — the composer chip shows the model the chat
// runs (its maker, and whether it follows Main or is this chat's own pick);
// it opens the shared one-column chooser. A pick applies to this chat only.
// ──────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import { useUpdateChat, useChat } from "../../hooks/use-chats";
import { useChatStore } from "../../stores/chat.store";
import { useSidecarStore } from "../../stores/sidecar.store";
import { cn } from "../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { ProfessorMariContextBudget } from "../../lib/professor-mari-context-budget";
import { ContextBudgetGauge, ContextBudgetIndicator } from "./ContextBudgetIndicator";
import {
  ConnectionSwitcherBody,
  EffectiveModelIcon,
  useChatModelPick,
  useEffectiveChatModel,
} from "../connections/ConnectionSwitcherBody";

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
  const effective = useEffectiveChatModel(activeChatId);
  const sidecarModelDownloaded = useSidecarStore((state) => state.modelDownloaded);

  const activeConnectionId = (chat as unknown as Record<string, unknown>)?.connectionId as string | null;
  const chatMode = (chat as unknown as { mode?: string } | null | undefined)?.mode;
  const isRandom = activeConnectionId === "random";

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
      // Touch browsers may leave focus on the page after Browse, outside the chooser's key handler.
      const back = menuRef.current?.querySelector<HTMLButtonElement>("[data-switcher-back]");
      if (back) {
        event.preventDefault();
        back.click();
        return;
      }
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
  }, [open, hasContextBudget]);

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
            aria-labelledby="quick-connection-menu-title"
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
              // One column; a fixed size keeps the menu still while a catalog loads or is filtered.
              "mari-chat-style-surface fixed z-[9999] flex h-[min(34rem,calc(100dvh-6rem))] w-[min(26rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-xl border border-foreground/10 shadow-2xl",
              chatMode === "roleplay"
                ? "bg-[var(--card)] [--mari-chat-existing-bg:var(--card)]"
                : "bg-[var(--background)] [--mari-chat-existing-bg:var(--background)]",
            )}
            style={pos ? { left: pos.left, top: pos.top } : { visibility: "hidden" as const }}
          >
            <div className="flex shrink-0 items-center gap-2 py-1 pl-4 pr-1">
              <h2 id="quick-connection-menu-title" className="min-w-0 flex-1 truncate text-sm font-semibold">
                {localizeUi("connections.switcher.title")}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label={localizeUi("common.close")}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground/55 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground/80 focus-visible:ring-1 focus-visible:ring-foreground/25 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
              >
                <X size="1rem" aria-hidden />
              </button>
            </div>
            <ConnectionSwitcherBody
              layout="steps"
              current={chatPick.current}
              recent={chatPick.recent}
              onApply={chatPick.apply}
              onDone={close}
              showLocalModel={chatMode !== "game" && sidecarModelDownloaded}
              shuffle={{ active: isRandom, onToggle: handleToggleRandom }}
              followDefault={{ active: chatPick.followsMain, onSelect: chatPick.useDefault }}
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

  const chipName =
    !effective || effective.kind === "none" ? localizeUi("connections.switcher.chooseModel") : effective.title;
  const unavailable = effective?.unavailable ? localizeUi(`connections.accounts.state.${effective.unavailable}`) : null;

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={localizeUi("chat.settings.connectionModel.buttonLabel", { model: chipName })}
        title={chipName}
        className={cn(
          "flex h-8 min-w-0 max-w-[11rem] items-center gap-1 rounded-full border pl-px pr-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 lg:max-w-[16rem] [@media(pointer:coarse)]:h-11",
          open
            ? "border-foreground/25 bg-foreground/10 text-foreground/85"
            : "border-foreground/10 text-foreground/65 hover:bg-foreground/10 hover:text-foreground/85",
          className,
        )}
      >
        <span className="relative flex h-[1.875rem] w-[1.875rem] shrink-0 items-center justify-center">
          {contextBudget && <ContextBudgetGauge percentage={contextBudget.percentage} />}
          <EffectiveModelIcon
            effective={effective}
            // Inside the context ring the tile shrinks so the ring stays readable.
            className={contextBudget ? "!h-[1.125rem] !w-[1.125rem] !rounded-md" : undefined}
          />
        </span>
        <span className="min-w-0 truncate font-medium">{chipName}</span>
        {effective?.kind === "model" && !unavailable && (
          <span className="hidden shrink-0 text-foreground/45 lg:inline">
            {localizeUi(
              effective.followsMain ? "connections.switcher.chipFollowsMain" : "connections.switcher.chipThisChat",
            )}
          </span>
        )}
        {unavailable && (
          <span className="mari-chrome-muted-badge shrink-0 rounded px-1 py-px text-[0.5625rem] leading-4">
            {unavailable}
          </span>
        )}
        <ChevronDown
          size="0.75rem"
          className={cn("shrink-0 text-foreground/45 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {menu}
    </>
  );
}
