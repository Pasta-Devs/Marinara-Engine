import { openAddConnection } from "../../lib/add-connection";
// ──────────────────────────────────────────────
// Quick Switcher Mobile — single chevron opens
// a tabbed menu with Connections + Personas
// (with persona group support). The Connections
// tab is the shared chooser: Now pinned at the
// top, a Connection's Browse opens its catalog in
// place; a pick applies to this chat only.
// ──────────────────────────────────────────────
import { useState, useRef, useCallback, useMemo } from "react";
import { ChevronUp, Link, CircleUser } from "lucide-react";
import { Modal } from "../ui/Modal";
import { useCharacters } from "../../hooks/use-characters";
import { useUpdateChat, useChat } from "../../hooks/use-chats";
import { useChatStore } from "../../stores/chat.store";
import { cn } from "../../lib/utils";
import { parseCharacterDisplayData } from "../../lib/character-display";
import type { CharacterIdentityChoice } from "../../lib/character-identity-groups";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { ProfessorMariContextBudget } from "../../lib/professor-mari-context-budget";
import { ContextBudgetGauge, ContextBudgetIndicator } from "./ContextBudgetIndicator";
import { ConnectionSwitcherBody, useChatModelPick } from "../connections/ConnectionSwitcherBody";
import { CharacterPickerList } from "../characters/CharacterPickerList";

export function QuickSwitcherMobile({ contextBudget }: { contextBudget?: ProfessorMariContextBudget | null }) {
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"connections" | "personas">("connections");
  const btnRef = useRef<HTMLButtonElement>(null);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const { data: rawCharacters } = useCharacters();
  const { data: chat } = useChat(activeChatId);
  const updateChat = useUpdateChat();
  const chatPick = useChatModelPick(activeChatId);

  const activeConnectionId = (chat as unknown as Record<string, unknown>)?.connectionId as string | null;
  const activePersonaId = chat?.personaId ?? null;
  const activeCharacterId = chat?.personaCharacterId ?? null;
  const characters = useMemo(() => (rawCharacters ?? []) as CharacterIdentityChoice[], [rawCharacters]);
  const chatMode = (chat as unknown as { mode?: string } | null | undefined)?.mode;
  const isRandom = activeConnectionId === "random";

  const handleToggleRandom = useCallback(() => {
    if (!activeChatId) return;
    updateChat.mutate({ id: activeChatId, connectionId: isRandom ? null : "random" });
  }, [activeChatId, isRandom, updateChat]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    btnRef.current?.focus();
  }, []);

  const handleSwitchPersona = useCallback(
    (personaId: string | null) => {
      if (!activeChatId) return;
      updateChat.mutate({ id: activeChatId, personaId, personaCharacterId: null });
      setOpen(false);
    },
    [activeChatId, updateChat],
  );
  const handleSwitchCharacter = useCallback(
    (personaCharacterId: string) => {
      if (!activeChatId) return;
      updateChat.mutate({ id: activeChatId, personaId: null, personaCharacterId });
      setOpen(false);
    },
    [activeChatId, updateChat],
  );

  if (!activeChatId) return null;

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={
          activeCharacterId && characters.find((character) => character.id === activeCharacterId)
            ? parseCharacterDisplayData(characters.find((character) => character.id === activeCharacterId)!).name
            : localizeUi("ui.chat.quickswitchermobile.quickSwitcher")
        }
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25",
          open
            ? "bg-foreground/10 text-foreground/75 ring-1 ring-foreground/20"
            : "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70",
        )}
      >
        <span className="relative flex h-[1.875rem] w-[1.875rem] items-center justify-center">
          {contextBudget && <ContextBudgetGauge percentage={contextBudget.percentage} />}
          <ChevronUp size="1rem" className={cn("transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open && (
        <Modal
          open
          onClose={closeMenu}
          title={localizeUi("ui.chat.quickswitchermobile.quickSwitcher")}
          opaque
          chatFloatingPanel
          restoreFocusRef={btnRef}
          panelClassName="max-sm:h-[calc(100dvh-1.5rem)] max-sm:min-h-0"
          contentClassName="flex flex-col overflow-hidden !p-0"
        >
          <div data-quick-switcher-mobile-menu className="flex min-h-0 flex-1 flex-col">
            <div className="flex border-b border-foreground/10">
              <button
                onClick={() => setTab("connections")}
                className={cn(
                  "flex min-h-11 flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-[0.6875rem] font-semibold transition-colors",
                  tab === "connections"
                    ? "border-b-2 border-foreground/25 bg-foreground/10 text-foreground/85"
                    : "text-foreground/50 hover:text-foreground/80",
                )}
              >
                <Link size="0.75rem" />
                {localizeUi("navigation.quickSwitcher.models")}
              </button>
              <button
                onClick={() => setTab("personas")}
                className={cn(
                  "flex min-h-11 flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-[0.6875rem] font-semibold transition-colors",
                  tab === "personas"
                    ? "border-b-2 border-foreground/25 bg-foreground/10 text-foreground/85"
                    : "text-foreground/50 hover:text-foreground/80",
                )}
              >
                <CircleUser size="0.75rem" />
                {localizeUi("navigation.topbar.personas")}
              </button>
            </div>

            {tab === "connections" && (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {/* Above the picker, not its list header: a phone hides the picker's Now row (and its header)
                    while a pane is open, and the picker's Connections colours would recolour the meter. */}
                {contextBudget && (
                  <div className="shrink-0 px-2 pt-1">
                    <ContextBudgetIndicator budget={contextBudget} useAccentColor />
                  </div>
                )}
                <ConnectionSwitcherBody
                  onAdd={() => openAddConnection()}
                  current={chatPick.current}
                  onApply={chatPick.apply}
                  onDone={closeMenu}
                  showLocalModel={chatMode !== "game" && import.meta.env.VITE_MARINARA_LITE !== "true"}
                  shuffle={{ active: isRandom, onToggle: handleToggleRandom }}
                  followDefault={{ active: chatPick.followsMain, onSelect: chatPick.useDefault }}
                />
              </div>
            )}
            {tab === "personas" && (
              <CharacterPickerList
                kind="persona"
                personaIds={activePersonaId ? [activePersonaId] : []}
                characterIds={activeCharacterId ? [activeCharacterId] : []}
                onPickNone={() => handleSwitchPersona(null)}
                onPickPersona={handleSwitchPersona}
                onPickCharacter={handleSwitchCharacter}
              />
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
