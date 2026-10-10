// ──────────────────────────────────────────────
// Quick Switcher Mobile — single chevron opens
// a tabbed menu with Connections + Personas
// (with persona group support). Tapping a
// connection opens its models as a second step.
// ──────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Link,
  CircleUser,
  FolderOpen,
  Folder,
  Check,
  Search,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useConnections, useUpdateConnection } from "../../hooks/use-connections";
import { useCharacters, usePersonas, usePersonaGroups, useCharacterGroups } from "../../hooks/use-characters";
import { useUpdateChat, useChat } from "../../hooks/use-chats";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore } from "../../stores/ui.store";
import { useSidecarStore } from "../../stores/sidecar.store";
import {
  appendLocalSidecarConnectionOption,
  isLocalSidecarConnectionOption,
  resolveNanoGptUsageConnection,
} from "../../lib/connection-filters";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { getCharacterTitle, parseCharacterDisplayData } from "../../lib/character-display";
import { buildCharacterIdentityGroups, type CharacterIdentityChoice } from "../../lib/character-identity-groups";
import { useTranslation as useUiTranslation } from "react-i18next";
import { LOCAL_SIDECAR_CONNECTION_ID, type CharacterGroup, type Persona } from "@marinara-engine/shared";
import type { ProfessorMariContextBudget } from "../../lib/professor-mari-context-budget";
import { ContextBudgetGauge, ContextBudgetIndicator } from "./ContextBudgetIndicator";
import { NanoGptUsageWidget } from "../connections/NanoGptUsageWidget";
import { ConnectionModelPicker } from "../connections/ConnectionModelPicker";

interface PersonaGroupRow {
  id: string;
  name: string;
  description: string;
  personaIds: string;
}

interface ParsedGroup {
  id: string;
  name: string;
  memberIds: string[];
  members: Persona[];
}

export function QuickSwitcherMobile({ contextBudget }: { contextBudget?: ProfessorMariContextBudget | null }) {
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"connections" | "personas">("connections");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showCharacterGroups, setShowCharacterGroups] = useState(false);
  const [expandedCharacterGroups, setExpandedCharacterGroups] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  /** The connection whose models are shown as the menu's second step; null shows the connection list. */
  const [modelsStep, setModelsStep] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const showCharacterIdentities = useUIStore((state) => state.showCharactersInPersonaPickers);
  const { data: connections } = useConnections();
  const { data: rawPersonas } = usePersonas();
  const { data: rawCharacters } = useCharacters();
  const { data: rawCharacterGroups } = useCharacterGroups();
  const { data: rawPersonaGroups } = usePersonaGroups();
  const { data: chat } = useChat(activeChatId);
  const updateChat = useUpdateChat();
  const updateConnection = useUpdateConnection();
  const sidecarModelDownloaded = useSidecarStore((state) => state.modelDownloaded);
  const sidecarModelDisplayName = useSidecarStore((state) => state.modelDisplayName);

  const activeConnectionId = (chat as unknown as Record<string, unknown>)?.connectionId as string | null;
  const activePersonaId = chat?.personaId ?? null;
  const activeCharacterId = chat?.personaCharacterId ?? null;
  const characters = useMemo(() => (rawCharacters ?? []) as CharacterIdentityChoice[], [rawCharacters]);
  const characterGroups = useMemo(
    () =>
      buildCharacterIdentityGroups(
        characters,
        (rawCharacterGroups ?? []) as CharacterGroup[],
        localizeUi("ui.chat.personapicker.ungrouped"),
      ),
    [characters, localizeUi, rawCharacterGroups],
  );
  const chatMode = (chat as unknown as { mode?: string } | null | undefined)?.mode;
  const isRandom = activeConnectionId === "random";
  const sortedConnections = appendLocalSidecarConnectionOption(
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

  // Mirrors the desktop switcher: the NanoGPT quota follows the selected
  // connection, and Random has no single connection to read a quota from.
  const usageConnection = resolveNanoGptUsageConnection(sortedConnections, activeConnectionId);

  const sortedPersonas = (rawPersonas ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visiblePersonas = normalizedSearch
    ? sortedPersonas.filter((persona) =>
        `${persona.name} ${persona.comment ?? ""}`.toLocaleLowerCase().includes(normalizedSearch),
      )
    : sortedPersonas;

  const personaMap = useMemo(() => {
    const map = new Map<string, Persona>();
    for (const p of sortedPersonas) map.set(p.id, p);
    return map;
  }, [sortedPersonas]);

  const { groups, ungroupedPersonas } = useMemo(() => {
    const groupRows = (rawPersonaGroups ?? []) as PersonaGroupRow[];
    const allGroupedIds = new Set<string>();
    const parsedGroups: ParsedGroup[] = [];

    for (const g of groupRows) {
      let memberIds: string[] = [];
      try {
        memberIds = JSON.parse(g.personaIds);
      } catch {
        memberIds = [];
      }
      const members: Persona[] = [];
      for (const pid of memberIds) {
        const p = personaMap.get(pid);
        if (p && (!normalizedSearch || `${p.name} ${p.comment ?? ""}`.toLocaleLowerCase().includes(normalizedSearch))) {
          members.push(p);
          allGroupedIds.add(pid);
        }
      }
      if (members.length > 0) {
        parsedGroups.push({ id: g.id, name: g.name, memberIds, members });
      }
    }

    parsedGroups.sort((a, b) => a.name.localeCompare(b.name));
    // F9 (O5): personas in no named group are not wrapped in their own
    // "Ungrouped" folder - that folder served no purpose (everyone already
    // starts expanded/collapsed the same way a real folder would), it just
    // added a tap for a persona that has no group at all. Flat rows instead,
    // matching the desktop QuickPersonaSwitcher fix from slice 50.
    const ungroupedPersonas = visiblePersonas.filter((p) => !allGroupedIds.has(p.id));
    return { groups: parsedGroups, ungroupedPersonas };
  }, [normalizedSearch, rawPersonaGroups, personaMap, visiblePersonas]);

  const visibleCharacterGroups = useMemo(
    () =>
      characterGroups
        .map((group) => ({
          ...group,
          members: group.members.filter((character) => {
            if (!normalizedSearch) return true;
            const data = parseCharacterDisplayData(character);
            return `${data.name} ${character.comment ?? ""}`.toLocaleLowerCase().includes(normalizedSearch);
          }),
        }))
        .filter((group) => group.members.length > 0),
    [characterGroups, normalizedSearch],
  );
  const hasVisibleCharacterChoices = showCharacterIdentities
    ? visibleCharacterGroups.length > 0
    : visibleCharacterGroups.some((group) => group.members.some((character) => character.id === activeCharacterId));

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const handleSwitchConnection = useCallback(
    (connId: string) => {
      if (!activeChatId) return;
      if (connId !== activeConnectionId) updateChat.mutate({ id: activeChatId, connectionId: connId });
      // The built-in Local Model has no model list, so it closes the menu as before.
      if (connId === LOCAL_SIDECAR_CONNECTION_ID) setOpen(false);
      else setModelsStep(connId);
    },
    [activeChatId, activeConnectionId, updateChat],
  );
  useEffect(() => {
    if (!open) setModelsStep(null);
  }, [open]);
  const modelsConnection =
    tab === "connections" && modelsStep && !isRandom
      ? sortedConnections.find(
          (connection) => connection.id === modelsStep && !isLocalSidecarConnectionOption(connection),
        )
      : undefined;

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
    // Escape closes the menu wherever focus is: Safari does not focus a tapped or clicked button.
    const onKeyDown = (event: KeyboardEvent) => {
      // Escape while an input method is composing cancels the composition, not the menu.
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
      setOpen(false);
      btnRef.current?.focus();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || tab !== "personas" || (!showCharacterIdentities && !activeCharacterId && !normalizedSearch)) return;
    setShowCharacterGroups(true);
    setExpandedCharacterGroups((current) => {
      const next = new Set(current);
      for (const group of visibleCharacterGroups) next.add(group.id);
      return next;
    });
  }, [activeCharacterId, normalizedSearch, open, showCharacterIdentities, tab, visibleCharacterGroups]);

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
      const buttonEl = btnRef.current;
      if (!buttonEl) return;
      const inputBox = buttonEl.closest(".marinara-chat-input-shell") as HTMLElement | null;
      const anchor = inputBox?.getBoundingClientRect() ?? buttonEl.getBoundingClientRect();
      const width = Math.min(inputBox?.getBoundingClientRect().width ?? 300, window.innerWidth - 16);
      const left = Math.max(8, Math.min(inputBox?.getBoundingClientRect().left ?? 8, window.innerWidth - width - 8));
      const spaceAbove = Math.max(0, anchor.top - 12);
      const spaceBelow = Math.max(0, window.innerHeight - anchor.bottom - 12);
      const openAbove = spaceAbove >= spaceBelow;
      const anchoredSpace = openAbove ? spaceAbove : spaceBelow;
      const useViewportFallback = anchoredSpace < 160;
      // The models step has a search box and a list, so it may grow taller than the connection list.
      const maxHeight = Math.min(modelsStep ? 560 : 400, useViewportFallback ? window.innerHeight - 16 : anchoredSpace);
      setPos({
        left,
        // Anchor by `bottom` when opening upwards so short content stays
        // attached to the input shell instead of floating at full maxHeight.
        ...(useViewportFallback
          ? { top: 8 }
          : openAbove
            ? { bottom: Math.max(8, window.innerHeight - anchor.top + 4) }
            : { top: Math.max(8, anchor.bottom + 4) }),
        width,
        maxHeight,
      });
    };
    requestAnimationFrame(update);
    const timer = setTimeout(update, 50);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [open, tab, expandedGroups, expandedCharacterGroups, showCharacterGroups, modelsStep]);

  if (!activeChatId) return null;

  const renderPersonaRow = (persona: Persona, indented: boolean = false) => {
    const isActive = persona.id === activePersonaId;
    return (
      <button
        key={persona.id}
        onClick={() => handleSwitchPersona(persona.id)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
          isActive ? "bg-foreground/10 text-foreground ring-1 ring-foreground/15" : "hover:bg-foreground/10",
          indented && "pl-6",
        )}
      >
        {persona.avatarPath ? (
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-foreground/10">
            <img
              src={persona.avatarPath}
              alt={persona.name}
              className="h-full w-full object-cover"
              style={getAvatarCropStyle(persona.avatarCrop)}
            />
          </div>
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/10 bg-foreground/10 text-xs font-semibold text-foreground/45">
            {(persona.name || "?")[0].toUpperCase()}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className={cn("text-xs font-semibold", isActive && "text-foreground")}>
            {persona.name || persona.id}
          </span>
          {persona.comment && (
            <span className="truncate text-[0.625rem] leading-tight text-foreground/45">
              {persona.comment.length > 60 ? persona.comment.substring(0, 60) + "…" : persona.comment}
            </span>
          )}
        </div>
        {isActive && <span className="ml-auto shrink-0 text-[0.6875rem]">✓</span>}
      </button>
    );
  };
  return (
    <>
      <button
        type="button"
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        title={
          activeCharacterId && characters.find((character) => character.id === activeCharacterId)
            ? parseCharacterDisplayData(characters.find((character) => character.id === activeCharacterId)!).name
            : localizeUi("ui.chat.quickswitchermobile.quickSwitcher")
        }
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
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

      {open &&
        createPortal(
          <div
            ref={menuRef}
            data-chat-floating-panel
            data-quick-switcher-mobile-menu
            className={cn(
              "mari-chat-style-surface fixed z-[9999] flex min-w-0 flex-col overflow-hidden rounded-xl border border-foreground/10 shadow-2xl",
              chatMode === "roleplay"
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
            <div className="flex border-b border-foreground/10">
              <button
                onClick={() => {
                  setTab("connections");
                  setModelsStep(null);
                }}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-[0.6875rem] font-semibold transition-colors",
                  tab === "connections"
                    ? "border-b-2 border-foreground/25 bg-foreground/10 text-foreground/85"
                    : "text-foreground/50 hover:text-foreground/80",
                )}
              >
                <Link size="0.75rem" />
                {localizeUi("navigation.topbar.connections")}
              </button>
              <button
                onClick={() => setTab("personas")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-[0.6875rem] font-semibold transition-colors",
                  tab === "personas"
                    ? "border-b-2 border-foreground/25 bg-foreground/10 text-foreground/85"
                    : "text-foreground/50 hover:text-foreground/80",
                )}
              >
                <CircleUser size="0.75rem" />
                {localizeUi("navigation.topbar.personas")}
              </button>
            </div>
            {tab === "personas" && (
              <label className="mx-2 mt-2 flex items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.04] px-2.5 py-2 text-foreground/55">
                <Search size="0.875rem" className="shrink-0" />
                <span className="sr-only">{localizeUi("ui.chat.personapicker.search")}</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={localizeUi("ui.chat.personapicker.search")}
                  className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-foreground/40"
                />
              </label>
            )}

            {modelsConnection && (
              <ConnectionModelPicker
                connection={modelsConnection}
                chatId={activeChatId}
                chatConnectionId={activeConnectionId}
                showConnectionName
                onPicked={() => {
                  setOpen(false);
                  btnRef.current?.focus();
                }}
                leading={
                  <button
                    type="button"
                    data-model-back
                    onClick={() => setModelsStep(null)}
                    aria-label={localizeUi("connections.modelPicker.back")}
                    title={localizeUi("connections.modelPicker.back")}
                    className="-my-2 -ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground/85"
                  >
                    <ChevronLeft size="1rem" />
                  </button>
                }
              />
            )}
            <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain p-1", modelsConnection && "hidden")}>
              {tab === "connections" && (
                <>
                  {contextBudget && (
                    <div className="px-2 pt-1">
                      <ContextBudgetIndicator budget={contextBudget} useAccentColor />
                    </div>
                  )}
                  {usageConnection && (
                    <div className="px-2 pt-1">
                      <NanoGptUsageWidget connectionId={usageConnection.id} variant="inline" />
                    </div>
                  )}
                  <button
                    onClick={handleToggleRandom}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors",
                      isRandom
                        ? "bg-foreground/10 font-semibold text-foreground/85 ring-1 ring-foreground/15"
                        : "hover:bg-foreground/10",
                    )}
                    title={
                      isRandom
                        ? localizeUi("ui.chat.quickconnectionswitcher.randomPoolActiveClickToDisable")
                        : localizeUi("ui.chat.quickconnectionswitcher.useRandomConnectionFromPool")
                    }
                  >
                    <span>{localizeUi("ui.chat.quickswitchermobile.random")}</span>
                    {isRandom && (
                      <span className="ml-auto text-[0.6875rem]">
                        {localizeUi("ui.chat.quickswitchermobile.active")}
                      </span>
                    )}
                  </button>
                  <div className="mx-2 my-1 h-px bg-foreground/10" />
                  {sortedConnections.map((conn) => {
                    const inPool = conn.useForRandom === "true";
                    const isActive = activeConnectionId === conn.id;
                    if (isRandom) {
                      return (
                        <button
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
                    const hasModels = !isLocalSidecarConnectionOption(conn);
                    return (
                      <button
                        key={conn.id}
                        type="button"
                        data-connection-option={conn.id}
                        aria-current={isActive ? "true" : undefined}
                        onClick={() => handleSwitchConnection(conn.id)}
                        className={cn(
                          "relative flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs transition-colors hover:bg-foreground/10",
                          isActive && "bg-foreground/[0.07] text-foreground font-semibold",
                        )}
                      >
                        {isActive && (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-[var(--marinara-chat-chrome-accent)]"
                          />
                        )}
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate">{conn.name || conn.id}</span>
                          {isActive && conn.model && (
                            <span className="truncate text-[0.625rem] font-normal text-foreground/50">
                              {conn.model}
                            </span>
                          )}
                        </span>
                        {isActive && (
                          <Check size="0.75rem" className="shrink-0 text-[var(--marinara-chat-chrome-accent)]" />
                        )}
                        {hasModels && (
                          <ChevronRight size="0.875rem" className="shrink-0 text-foreground/40" aria-hidden />
                        )}
                      </button>
                    );
                  })}
                  {sortedConnections.length === 0 && (
                    <div className="px-3 py-4 text-center text-[0.6875rem] italic text-foreground/45">
                      {localizeUi("ui.chat.quickconnectionswitcher.noConnectionsFound")}
                    </div>
                  )}
                </>
              )}

              {tab === "personas" && (
                <>
                  <button
                    onClick={() => handleSwitchPersona(null)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                      !activePersonaId && !activeCharacterId
                        ? "bg-foreground/10 text-foreground ring-1 ring-foreground/15"
                        : "hover:bg-foreground/10",
                    )}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/10 bg-foreground/10 text-xs font-semibold text-foreground/45">
                      ?
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          !activePersonaId && !activeCharacterId && "text-foreground",
                        )}
                      >
                        {localizeUi("ui.game.gamesurfacecomponent.none")}
                      </span>
                      <span className="text-[0.625rem] text-foreground/45">
                        {localizeUi("ui.chat.quickpersonaswitcher.noPersonaSelected")}
                      </span>
                    </div>
                    {!activePersonaId && !activeCharacterId && <span className="ml-auto text-[0.6875rem]">✓</span>}
                  </button>
                  <div className="mx-2 my-1 h-px bg-foreground/10" />
                  {groups.map((group) => {
                    const isExpanded = expandedGroups.has(group.id);
                    const firstMember = group.members[0];
                    const hasActiveInGroup = group.members.some((p) => p.id === activePersonaId);
                    return (
                      <div key={group.id}>
                        <button
                          onClick={() => toggleGroup(group.id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                            hasActiveInGroup
                              ? "bg-foreground/10 text-foreground ring-1 ring-foreground/15"
                              : "hover:bg-foreground/10",
                          )}
                        >
                          {firstMember?.avatarPath ? (
                            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-foreground/10">
                              <img
                                src={firstMember.avatarPath}
                                alt={group.name}
                                className="h-full w-full object-cover"
                                style={getAvatarCropStyle(firstMember.avatarCrop)}
                              />
                            </div>
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/10 bg-foreground/10 text-xs font-semibold text-foreground/45">
                              {group.name[0].toUpperCase()}
                            </div>
                          )}
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="flex items-center gap-1 text-xs font-semibold">
                              {isExpanded ? (
                                <FolderOpen size="0.75rem" className="shrink-0 text-foreground/45" />
                              ) : (
                                <Folder size="0.75rem" className="shrink-0 text-foreground/45" />
                              )}
                              {group.name} ({group.members.length})
                            </span>
                            <span className="text-[0.625rem] text-foreground/45">
                              {group.members.length} {localizeUi("ui.chat.quickpersonaswitcher.persona")}
                              {group.members.length !== 1 ? localizeUi("ui.noodle.stageprofileview.s") : ""}
                            </span>
                          </div>
                          <span className="ml-auto shrink-0 text-foreground/45">
                            {isExpanded ? <ChevronDown size="0.875rem" /> : <ChevronRight size="0.875rem" />}
                          </span>
                        </button>
                        {isExpanded && (
                          <div className="ml-2 border-l border-foreground/10 pl-1">
                            {group.members.map((persona) => renderPersonaRow(persona, true))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* F9: personas in no named group: flat rows, no folder to tap through. */}
                  {ungroupedPersonas.map((persona) => renderPersonaRow(persona, false))}
                  {sortedPersonas.length > 0 && visiblePersonas.length === 0 && !hasVisibleCharacterChoices && (
                    <div className="px-3 py-4 text-center text-[0.6875rem] italic text-foreground/45">
                      {localizeUi("ui.chat.personapicker.noMatchingPersonas")}
                    </div>
                  )}
                  {characters.length > 0 && (showCharacterIdentities || !!activeCharacterId) && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowCharacterGroups((value) => !value)}
                        aria-expanded={showCharacterGroups}
                        className="mt-1 flex w-full items-center gap-2 rounded-lg border border-foreground/10 px-2.5 py-2 text-left text-xs font-semibold text-foreground/70 transition-colors hover:bg-foreground/10"
                      >
                        {showCharacterGroups ? (
                          <FolderOpen size="0.875rem" className="shrink-0 text-foreground/50" />
                        ) : (
                          <Folder size="0.875rem" className="shrink-0 text-foreground/50" />
                        )}
                        <span className="flex-1">{localizeUi("ui.chat.personapicker.playAsCharacter")}</span>
                        {showCharacterGroups ? <ChevronDown size="0.75rem" /> : <ChevronRight size="0.75rem" />}
                      </button>
                      {showCharacterGroups &&
                        visibleCharacterGroups.map((group) => {
                          const expanded = expandedCharacterGroups.has(group.id);
                          const members = group.members.filter(
                            (character) => showCharacterIdentities || character.id === activeCharacterId,
                          );
                          if (members.length === 0) return null;
                          return (
                            <div key={group.id}>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedCharacterGroups((current) => {
                                    const next = new Set(current);
                                    if (next.has(group.id)) next.delete(group.id);
                                    else next.add(group.id);
                                    return next;
                                  })
                                }
                                aria-expanded={expanded}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-foreground/10"
                              >
                                {group.avatarPath || group.members[0]?.avatarPath ? (
                                  <img
                                    src={group.avatarPath ?? group.members[0]?.avatarPath ?? ""}
                                    alt=""
                                    className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-foreground/10"
                                  />
                                ) : expanded ? (
                                  <FolderOpen size="0.875rem" className="shrink-0 text-foreground/45" />
                                ) : (
                                  <Folder size="0.875rem" className="shrink-0 text-foreground/45" />
                                )}
                                <span className="min-w-0 flex-1 truncate">{group.name}</span>
                                <span className="text-[0.625rem] text-foreground/45">{members.length}</span>
                                {expanded ? <ChevronDown size="0.75rem" /> : <ChevronRight size="0.75rem" />}
                              </button>
                              {expanded &&
                                members.map((character) => {
                                  const characterData = parseCharacterDisplayData(character);
                                  const name = characterData.name;
                                  const isActive = activeCharacterId === character.id;
                                  return (
                                    <button
                                      key={`character-${character.id}`}
                                      type="button"
                                      onClick={() => handleSwitchCharacter(character.id)}
                                      className={cn(
                                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-foreground/10",
                                        isActive && "bg-foreground/10 text-foreground ring-1 ring-foreground/15",
                                      )}
                                    >
                                      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-foreground/10 bg-foreground/10 text-xs font-semibold">
                                        {character.avatarPath ? (
                                          <img
                                            src={character.avatarPath}
                                            alt=""
                                            className="h-full w-full object-cover"
                                            style={getAvatarCropStyle(characterData.avatarCrop)}
                                          />
                                        ) : (
                                          name[0]
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <span className="block truncate text-xs font-semibold">{name}</span>
                                        <span className="block truncate text-[0.625rem] text-foreground/45">
                                          {getCharacterTitle(characterData) ||
                                            localizeUi("ui.chat.personapicker.characterSource")}
                                        </span>
                                      </div>
                                      {isActive && <span className="text-[0.6875rem]">✓</span>}
                                    </button>
                                  );
                                })}
                            </div>
                          );
                        })}
                    </>
                  )}
                  {sortedPersonas.length === 0 && (
                    <div className="px-3 py-4 text-center text-[0.6875rem] italic text-foreground/45">
                      {localizeUi("ui.chat.quickpersonaswitcher.noPersonasFound")}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
