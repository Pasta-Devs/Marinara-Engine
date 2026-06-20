// ──────────────────────────────────────────────
// Quick Persona Switcher — inline avatar dropdown
// with persona group support (collapsible folders)
// ──────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { ChevronDown, ChevronRight, FolderOpen, Folder } from "lucide-react";
import { usePersonas, usePersonaGroups } from "../../hooks/use-characters";
import { useUpdateChat, useChat } from "../../hooks/use-chats";
import { useChatStore } from "../../stores/chat.store";
import { cn, getAvatarCropStyle, parseAvatarCropJson } from "../../lib/utils";

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

const UNGROUPED_PERSONA_GROUP_ID = "__ungrouped-personas__";

export function QuickPersonaSwitcher({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const { data: rawPersonas } = usePersonas();
  const { data: rawPersonaGroups } = usePersonaGroups();
  const { data: chat } = useChat(activeChatId);
  const updateChat = useUpdateChat();

  const personas = ((rawPersonas ?? []) as Persona[])
    .slice()
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const activePersonaId = (chat as unknown as Record<string, unknown>)?.personaId as string | null;
  const activePersona = personas.find((p) => p.id === activePersonaId) ?? null;

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
    if (ungroupedList.length > 0) {
      parsedGroups.push({
        id: UNGROUPED_PERSONA_GROUP_ID,
        name: "Ungrouped",
        memberIds: ungroupedList.map((p) => p.id),
        members: ungroupedList,
      });
    }

    return { groups: parsedGroups };
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
    const inputBox = btnRef.current.closest(".marinara-chat-input-shell") as HTMLElement | null;
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
              style={getAvatarCropStyle(parseAvatarCropJson(persona.avatarCrop))}
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
          <div className="flex h-full w-full items-center justify-center rounded-full bg-foreground/10 text-[0.75rem] font-semibold text-foreground/45">
            {activePersona ? (activePersona.name || "?")[0].toUpperCase() : "?"}
          </div>
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          className="fixed z-[9999] flex min-w-[280px] max-w-[340px] max-h-[400px] flex-col overflow-hidden rounded-xl border border-foreground/10 bg-[var(--card)] shadow-2xl"
          style={pos ? { left: pos.left, top: pos.top } : { visibility: "hidden" as const }}
        >
          <div className="flex items-center justify-center border-b border-foreground/10 px-3 py-2 text-[0.6875rem] font-semibold">
            Personas
          </div>
          <div className="overflow-y-auto p-1">
            {/* None option */}
            <button
              type="button"
              onClick={() => handleSwitch(null)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                !activePersonaId
                  ? "bg-foreground/10 text-foreground ring-1 ring-foreground/15"
                  : "hover:bg-foreground/10",
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/10 bg-foreground/10 text-xs font-semibold text-foreground/45">
                ?
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className={cn("text-xs font-semibold", !activePersonaId && "text-foreground")}>None</span>
                <span className="text-[0.625rem] text-foreground/45">No persona selected</span>
              </div>
              {!activePersonaId && <span className="ml-auto text-[0.6875rem]">✓</span>}
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
                          style={getAvatarCropStyle(parseAvatarCropJson(firstMember.avatarCrop))}
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
                        {group.members.length} persona{group.members.length !== 1 ? "s" : ""}
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

            {personas.length === 0 && (
              <div className="px-3 py-4 text-center text-[0.6875rem] italic text-foreground/45">No personas found.</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
