// ──────────────────────────────────────────────
// Quick Persona Switcher — inline avatar dropdown; the list is the shared IdentityPicker
// ──────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useCharacters, usePersonas } from "../../hooks/use-characters";
import { useUpdateChat, useChat } from "../../hooks/use-chats";
import { useChatStore } from "../../stores/chat.store";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { parseCharacterDisplayData } from "../../lib/character-display";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { Persona } from "@marinara-engine/shared";
import { IdentityPicker } from "./IdentityPicker";

export function QuickPersonaSwitcher({ className }: { className?: string }) {
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const { data: rawPersonas } = usePersonas();
  const { data: rawCharacters } = useCharacters();
  const characters = useMemo(
    () =>
      (rawCharacters ?? []) as Array<{
        id: string;
        data: string | Record<string, unknown>;
        avatarPath?: string | null;
      }>,
    [rawCharacters],
  );
  const { data: chat } = useChat(activeChatId);
  const updateChat = useUpdateChat();
  const personas = (rawPersonas ?? []) as Persona[];

  const activePersonaId = chat?.personaId ?? null;
  const activeCharacterId = chat?.personaCharacterId ?? null;
  const activePersona = personas.find((p) => p.id === activePersonaId) ?? null;
  const activeCharacter = characters.find((character) => character.id === activeCharacterId) ?? null;
  const activeCharacterName = activeCharacter ? parseCharacterDisplayData(activeCharacter).name : null;

  const handleSwitch = useCallback(
    (personaId: string | null) => {
      if (!activeChatId) return;
      updateChat.mutate({ id: activeChatId, personaId, personaCharacterId: null });
      setOpen(false);
    },
    [activeChatId, updateChat],
  );
  const handleCharacterSwitch = useCallback(
    (personaCharacterId: string) => {
      if (!activeChatId) return;
      updateChat.mutate({ id: activeChatId, personaId: null, personaCharacterId });
      setOpen(false);
    },
    [activeChatId, updateChat],
  );

  // Close on outside click
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

  const [pos, setPos] = useState<{
    left: number;
    width: number;
    maxHeight: number;
    top?: number;
    bottom?: number;
  } | null>(null);
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      const button = btnRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const inputBox = button.closest(".marinara-chat-input-shell") as HTMLElement | null;
      const anchor = inputBox?.getBoundingClientRect() ?? rect;
      const menuEl = menuRef.current;
      const width = Math.min(Math.max(menuEl?.offsetWidth || 300, 280), window.innerWidth - 16);
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
      const spaceAbove = Math.max(0, anchor.top - viewportTop - 12);
      const spaceBelow = Math.max(0, viewportBottom - anchor.bottom - 12);
      const openAbove = spaceAbove >= Math.min(320, spaceBelow) || spaceAbove >= spaceBelow;
      const maxHeight = Math.max(
        0,
        Math.min(viewportBottom - viewportTop - 16, Math.max(120, Math.min(400, openAbove ? spaceAbove : spaceBelow))),
      );
      const useViewportFallback = Math.max(spaceAbove, spaceBelow) < 120;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      setPos({
        left,
        ...(useViewportFallback
          ? { top: viewportTop + 8 }
          : openAbove
            ? { bottom: Math.max(8, window.innerHeight - anchor.top + 4) }
            : { top: Math.max(viewportTop + 8, anchor.bottom + 4) }),
        width,
        maxHeight,
      });
    };
    const frame = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [open]);

  if (!activeChatId) return null;

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        title={
          activePersona || activeCharacter
            ? localizeUi("ui.chat.quickpersonaswitcher.value1Value2", {
                value1: activePersona?.name ?? activeCharacterName ?? "",
                value2: activePersona?.comment ? " — " + activePersona.comment : "",
              })
            : localizeUi("ui.chat.quickpersonaswitcher.quickPersonaSwitcher")
        }
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-full overflow-hidden transition-all border-2",
          open ? "border-foreground/40" : "border-transparent hover:border-foreground/30 hover:opacity-90",
          className,
        )}
      >
        {activePersona?.avatarPath || activeCharacter?.avatarPath ? (
          <img
            src={activePersona?.avatarPath ?? activeCharacter?.avatarPath ?? ""}
            alt={activePersona?.name ?? activeCharacterName ?? ""}
            className="h-full w-full object-cover rounded-full"
            style={getAvatarCropStyle(
              activePersona?.avatarPath
                ? activePersona.avatarCrop
                : activeCharacter
                  ? parseCharacterDisplayData(activeCharacter).avatarCrop
                  : undefined,
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-foreground/10 text-[0.75rem] font-semibold text-foreground/45">
            {(activePersona?.name ?? activeCharacterName ?? "?")[0]?.toUpperCase()}
          </div>
        )}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            data-chat-floating-panel
            role="menu"
            aria-label={localizeUi("navigation.topbar.personas")}
            tabIndex={-1}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setOpen(false);
                btnRef.current?.focus();
              }
            }}
            className={cn(
              "mari-chat-style-surface fixed z-[9999] flex min-w-[280px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border border-foreground/10 shadow-2xl",
              chat?.mode === "roleplay"
                ? "bg-[var(--card)] [--mari-chat-existing-bg:var(--card)]"
                : "bg-[var(--background)] [--mari-chat-existing-bg:var(--background)]",
            )}
            style={
              pos
                ? {
                    left: pos.left,
                    ...(pos.top !== undefined ? { top: pos.top } : { bottom: pos.bottom }),
                    width: pos.width,
                    maxHeight: pos.maxHeight,
                  }
                : { visibility: "hidden" as const }
            }
          >
            <div className="flex items-center justify-center border-b border-foreground/10 px-3 py-2 text-[0.6875rem] font-semibold">
              {localizeUi("navigation.topbar.personas")}
            </div>
            <IdentityPicker
              scope="persona"
              activePersonaId={activePersonaId}
              activeCharacterId={activeCharacterId}
              onPickPersona={handleSwitch}
              onPickCharacter={handleCharacterSwitch}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
