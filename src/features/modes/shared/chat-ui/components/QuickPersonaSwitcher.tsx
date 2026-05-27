// ──────────────────────────────────────────────
// Quick Persona Switcher — inline avatar dropdown
// with persona group support (collapsible folders)
// ──────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { ChevronDown, ChevronRight, FolderOpen, Folder } from "lucide-react";
import { usePersona, usePersonas, usePersonaGroups } from "../../../../catalog/characters/index";
import { useUpdateChat, useChat } from "../../../../catalog/chats/index";
import { useChatStore } from "../../../../../shared/stores/chat.store";
import { cn, getAvatarCropStyle, parseAvatarCropJson } from "../../../../../shared/lib/utils";

interface Persona {
  id: string;
  name: string;
  avatarPath?: string | null;
  /** JSON-encoded AvatarCrop from the persona row. */
  avatarCrop?: string;
  comment?: string | null;
  description?: string | null;
}

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

export function QuickPersonaSwitcher({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const { data: chat } = useChat(activeChatId);
  const activePersonaId = (chat as unknown as Record<string, unknown>)?.personaId as string | null;
  const { data: activePersonaRecord } = usePersona(activePersonaId, !!activePersonaId);
  const { data: rawPersonas } = usePersonas(open);
  const { data: rawPersonaGroups } = usePersonaGroups(open);
  const updateChat = useUpdateChat();

  const personas = ((rawPersonas ?? []) as Persona[])
    .slice()
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const activePersona = personas.find((p) => p.id === activePersonaId) ?? (activePersonaRecord as Persona | null) ?? null;

  // Build a map for quick lookups
  const personaMap = useMemo(() => {
    const map = new Map<string, Persona>();
    for (const p of personas) map.set(p.id, p);
    return map;
  }, [personas]);

  // Parse persona groups and resolve members
  const {
    groups,
    groupedPersonaIds: _groupedPersonaIds,
    ungrouped,
  } = useMemo(() => {
    const groupRows = (rawPersonaGroups ?? []) as PersonaGroupRow[];
    const allGroupedIds = new Set<string>();
    const parsedGroups: ParsedGroup[] = [];

    for (const g of groupRows) {
      let memberIds: string[] = [];
      try {
        memberIds = Array.isArray(g.personaIds) ? g.personaIds : [];
      } catch {
        memberIds = [];
      }
      const members: Persona[] = [];
      for (const pid of memberIds) {
        const p = personaMap.get(pid);
        if (p) {
          members.push(p);
          allGroupedIds.add(pid);
        }
      }
      if (members.length > 0) {
        parsedGroups.push({ id: g.id, name: g.name, memberIds, members });
      }
    }

    parsedGroups.sort((a, b) => a.name.localeCompare(b.name));

    const ungroupedList = personas.filter((p) => !allGroupedIds.has(p.id));

    return { groups: parsedGroups, groupedPersonaIds: allGroupedIds, ungrouped: ungroupedList };
  }, [rawPersonaGroups, personaMap, personas]);

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
  }, [open, expandedGroups]);

  if (!activeChatId) return null;

  const renderPersonaRow = (persona: Persona, indented: boolean = false) => {
    const isActive = persona.id === activePersonaId;
    return (
      <button
        key={persona.id}
        onClick={() => handleSwitch(persona.id)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--accent)]",
          isActive && "text-foreground",
          indented && "pl-6",
        )}
      >
        {persona.avatarPath ? (
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-[var(--border)]">
            <img
              src={persona.avatarPath}
              alt={persona.name}
              className="h-full w-full object-cover"
              style={getAvatarCropStyle(parseAvatarCropJson(persona.avatarCrop))}
            />
          </div>
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--secondary)] text-xs font-semibold text-[var(--muted-foreground)]">
            {(persona.name || "?")[0].toUpperCase()}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className={cn("text-xs font-semibold", isActive && "text-foreground")}>
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
  };

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
          "relative flex h-8 w-8 items-center justify-center rounded-full overflow-hidden transition-all border-2",
          open ? "border-foreground/40" : "border-transparent hover:border-foreground/30 hover:opacity-90",
          className,
        )}
      >
        {activePersona?.avatarPath ? (
          <img
            src={activePersona.avatarPath}
            alt={activePersona.name}
            className="h-full w-full object-cover rounded-full"
            style={getAvatarCropStyle(parseAvatarCropJson(activePersona.avatarCrop))}
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
                !activePersonaId && "text-foreground",
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--secondary)] text-xs font-semibold text-[var(--muted-foreground)]">
                ?
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className={cn("text-xs font-semibold", !activePersonaId && "text-foreground")}>None</span>
                <span className="text-[0.625rem] text-[var(--muted-foreground)]">No persona selected</span>
              </div>
              {!activePersonaId && <span className="ml-auto text-[0.6875rem]">✓</span>}
            </button>

            <div className="mx-2 my-1 h-px bg-[var(--border)]" />

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
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--accent)]",
                      hasActiveInGroup && "text-foreground",
                    )}
                  >
                    {firstMember?.avatarPath ? (
                      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-[var(--border)]">
                        <img
                          src={firstMember.avatarPath}
                          alt={group.name}
                          className="h-full w-full object-cover"
                          style={getAvatarCropStyle(parseAvatarCropJson(firstMember.avatarCrop))}
                        />
                      </div>
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--secondary)] text-xs font-semibold text-[var(--muted-foreground)]">
                        {group.name[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-1 text-xs font-semibold">
                        {isExpanded ? (
                          <FolderOpen size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
                        ) : (
                          <Folder size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
                        )}
                        {group.name} ({group.members.length})
                      </span>
                      <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                        {group.members.length} persona{group.members.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <span className="ml-auto shrink-0 text-[var(--muted-foreground)]">
                      {isExpanded ? <ChevronDown size="0.875rem" /> : <ChevronRight size="0.875rem" />}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="ml-2 border-l border-[var(--border)]/50 pl-1">
                      {group.members.map((persona) => renderPersonaRow(persona, true))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Ungrouped personas */}
            {ungrouped.map((persona) => renderPersonaRow(persona, false))}

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
