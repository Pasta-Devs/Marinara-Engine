// ──────────────────────────────────────────────
// Quick Persona Switcher — inline avatar dropdown
// with persona group support (collapsible folders)
// ──────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, FolderOpen, Folder, Search } from "lucide-react";
import { useCharacters, usePersonas, usePersonaGroups, useCharacterGroups } from "../../hooks/use-characters";
import { useUpdateChat, useChat } from "../../hooks/use-chats";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore } from "../../stores/ui.store";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { parseCharacterDisplayData } from "../../lib/character-display";
import type { CharacterGroup } from "@marinara-engine/shared";
import { buildCharacterIdentityGroups, type CharacterIdentityChoice } from "../../lib/character-identity-groups";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { Persona } from "@marinara-engine/shared";

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

const UNGROUPED_PERSONA_GROUP_ID = "__ungrouped-personas__";

export function QuickPersonaSwitcher({ className }: { className?: string }) {
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showCharacterGroups, setShowCharacterGroups] = useState(false);
  const [expandedCharacterGroups, setExpandedCharacterGroups] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const showCharacterIdentities = useUIStore((state) => state.showCharactersInPersonaPickers);
  const { data: rawPersonas } = usePersonas();
  const { data: rawCharacters } = useCharacters();
  const { data: rawCharacterGroups } = useCharacterGroups();
  const characters = useMemo(
    () =>
      (rawCharacters ?? []) as Array<{
        id: string;
        data: string | Record<string, unknown>;
        avatarPath?: string | null;
      }>,
    [rawCharacters],
  );
  const characterGroups = useMemo(
    () =>
      buildCharacterIdentityGroups(
        characters as CharacterIdentityChoice[],
        (rawCharacterGroups ?? []) as CharacterGroup[],
        localizeUi("ui.chat.personapicker.ungrouped"),
      ),
    [characters, localizeUi, rawCharacterGroups],
  );
  const { data: rawPersonaGroups } = usePersonaGroups();
  const { data: chat } = useChat(activeChatId);
  const updateChat = useUpdateChat();

  const personas = (rawPersonas ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visiblePersonas = normalizedSearch
    ? personas.filter((persona) =>
        `${persona.name} ${persona.comment ?? ""}`.toLocaleLowerCase().includes(normalizedSearch),
      )
    : personas;

  const activePersonaId = chat?.personaId ?? null;
  const activeCharacterId = chat?.personaCharacterId ?? null;
  const activePersona = personas.find((p) => p.id === activePersonaId) ?? null;
  const activeCharacter = characters.find((character) => character.id === activeCharacterId) ?? null;
  const activeCharacterName = activeCharacter ? parseCharacterDisplayData(activeCharacter).name : null;

  // Build a map for quick lookups
  const personaMap = useMemo(() => {
    const map = new Map<string, Persona>();
    for (const p of personas) map.set(p.id, p);
    return map;
  }, [personas]);

  // Parse persona groups and resolve members
  const { groups } = useMemo(() => {
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

    const ungroupedList = visiblePersonas.filter((p) => !allGroupedIds.has(p.id));
    if (ungroupedList.length > 0) {
      parsedGroups.push({
        id: UNGROUPED_PERSONA_GROUP_ID,
        name: "Ungrouped",
        memberIds: ungroupedList.map((p) => p.id),
        members: ungroupedList,
      });
    }

    return { groups: parsedGroups };
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
    if (!open || (!showCharacterIdentities && !activeCharacterId && !normalizedSearch)) return;
    setShowCharacterGroups(true);
    setExpandedCharacterGroups((current) => {
      const next = new Set(current);
      for (const group of visibleCharacterGroups) next.add(group.id);
      return next;
    });
  }, [activeCharacterId, normalizedSearch, open, showCharacterIdentities, visibleCharacterGroups]);

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
      const spaceAbove = Math.max(0, anchor.top - 12);
      const spaceBelow = Math.max(0, window.innerHeight - anchor.bottom - 12);
      const openAbove = spaceAbove >= Math.min(320, spaceBelow) || spaceAbove >= spaceBelow;
      const maxHeight = Math.max(160, Math.min(400, openAbove ? spaceAbove : spaceBelow));
      const useViewportFallback = Math.max(spaceAbove, spaceBelow) < 160;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      setPos({
        left,
        ...(useViewportFallback
          ? { top: 8 }
          : openAbove
            ? { bottom: Math.max(8, window.innerHeight - anchor.top + 4) }
            : { top: Math.max(8, anchor.bottom + 4) }),
        width,
        maxHeight,
      });
    };
    const frame = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
    };
  }, [open, expandedGroups, expandedCharacterGroups, showCharacterGroups]);

  if (!activeChatId) return null;

  const renderPersonaRow = (persona: Persona, indented: boolean = false) => {
    const isActive = persona.id === activePersonaId;
    return (
      <button
        type="button"
        key={persona.id}
        onClick={() => handleSwitch(persona.id)}
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
            className="fixed z-[9999] flex min-w-[280px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border border-foreground/10 bg-[var(--background)] shadow-2xl"
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
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
              {/* None option */}
              <button
                type="button"
                onClick={() => handleSwitch(null)}
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
                    className={cn("text-xs font-semibold", !activePersonaId && !activeCharacterId && "text-foreground")}
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

              {/* Groups */}
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

              {visiblePersonas.length === 0 && !hasVisibleCharacterChoices && (
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
                                  onClick={() => handleCharacterSwitch(character.id)}
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
                                    <span className="block text-[0.625rem] text-foreground/45">
                                      {character.comment || localizeUi("ui.chat.personapicker.characterSource")}
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
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
