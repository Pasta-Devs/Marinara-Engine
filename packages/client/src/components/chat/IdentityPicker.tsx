// ──────────────────────────────────────────────
// Identity Picker — the one searchable list for choosing a persona or a
// character. `scope="persona"` lists personas (plus the opt-in "Play as a
// character" section); `scope="character"` lists characters only. Callers
// own the shell (popover, modal, drawer dropdown) and what a pick does.
// ──────────────────────────────────────────────
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen, Search } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { CharacterGroup, Persona } from "@marinara-engine/shared";
import { useCharacterGroups, useCharacters, usePersonaGroups, usePersonas } from "../../hooks/use-characters";
import { useUIStore } from "../../stores/ui.store";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { characterMatchesSearch, getCharacterTitle, parseCharacterDisplayData } from "../../lib/character-display";
import { buildCharacterIdentityGroups, type CharacterIdentityChoice } from "../../lib/character-identity-groups";

interface IdentityPickerProps {
  scope: "persona" | "character";
  activePersonaId?: string | null;
  activeCharacterId?: string | null;
  /** Characters to leave out, such as the ones already in the chat. */
  excludeCharacterIds?: readonly string[];
  /** Persona scope: a pick of a persona, or `null` for None. */
  onPickPersona?: (personaId: string | null) => void;
  onPickCharacter: (characterId: string) => void;
  /** Controlled search, for shells that draw their own search box. Omit to show the built-in one. */
  search?: string;
  listClassName?: string;
}

const ROW = "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors";
const ROW_ACTIVE = "bg-foreground/10 text-foreground ring-1 ring-foreground/15";
const ROW_IDLE = "hover:bg-foreground/10";

function Avatar({
  src,
  name,
  crop,
}: {
  src?: string | null;
  name: string;
  crop?: Parameters<typeof getAvatarCropStyle>[0];
}) {
  if (src) {
    return (
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-foreground/10">
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" style={getAvatarCropStyle(crop)} />
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/10 bg-foreground/10 text-xs font-semibold text-foreground/45">
      {(name || "?")[0]?.toUpperCase()}
    </div>
  );
}

function PickRow({
  active,
  onClick,
  avatar,
  title,
  subtitle,
  indented = false,
}: {
  active: boolean;
  onClick: () => void;
  avatar: ReactNode;
  title: string;
  subtitle?: string | null;
  indented?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className={cn(ROW, active ? ROW_ACTIVE : ROW_IDLE, indented && "pl-6")}>
      {avatar}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate text-xs font-semibold", active && "text-foreground")}>{title}</span>
        {subtitle && <span className="truncate text-[0.625rem] leading-tight text-foreground/45">{subtitle}</span>}
      </div>
      {active && <span className="ml-auto shrink-0 text-[0.6875rem]">✓</span>}
    </button>
  );
}

function FolderToggle({
  open,
  onClick,
  label,
  count,
  avatarPath,
  highlighted = false,
}: {
  open: boolean;
  onClick: () => void;
  label: string;
  count: ReactNode;
  avatarPath?: string | null;
  highlighted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={cn(
        ROW,
        "text-xs",
        highlighted ? "bg-foreground/10 text-foreground ring-1 ring-foreground/15" : ROW_IDLE,
      )}
    >
      {avatarPath ? (
        <img src={avatarPath} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-foreground/10" />
      ) : open ? (
        <FolderOpen size="0.875rem" className="shrink-0 text-foreground/45" />
      ) : (
        <Folder size="0.875rem" className="shrink-0 text-foreground/45" />
      )}
      <span className="min-w-0 flex-1 truncate font-semibold">{label}</span>
      <span className="text-[0.625rem] text-foreground/45">{count}</span>
      {open ? <ChevronDown size="0.75rem" /> : <ChevronRight size="0.75rem" />}
    </button>
  );
}

function parseIds(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function IdentityPicker({
  scope,
  activePersonaId = null,
  activeCharacterId = null,
  excludeCharacterIds,
  onPickPersona,
  onPickCharacter,
  search: controlledSearch,
  listClassName,
}: IdentityPickerProps) {
  const { t: localizeUi } = useUiTranslation();
  const [ownSearch, setOwnSearch] = useState("");
  const search = controlledSearch ?? ownSearch;
  const query = search.trim().toLocaleLowerCase();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showCharacters, setShowCharacters] = useState(scope === "character");
  const showCharacterIdentities = useUIStore((state) => state.showCharactersInPersonaPickers);

  const isPersonaScope = scope === "persona";
  const { data: rawPersonas } = usePersonas(isPersonaScope);
  const { data: rawPersonaGroups } = usePersonaGroups();
  const { data: rawCharacters } = useCharacters();
  const { data: rawCharacterGroups } = useCharacterGroups();

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // Searching opens every folder, so a match is never hidden behind a tap.
  const isOpen = (id: string) => query !== "" || expanded.has(id);

  // ── Personas ──
  const personas = useMemo(
    () => ((rawPersonas ?? []) as Persona[]).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [rawPersonas],
  );
  const visiblePersonas = useMemo(
    () =>
      query ? personas.filter((p) => `${p.name} ${p.comment ?? ""}`.toLocaleLowerCase().includes(query)) : personas,
    [personas, query],
  );
  const { personaGroups, ungroupedPersonas } = useMemo(() => {
    const byId = new Map(visiblePersonas.map((p) => [p.id, p]));
    const grouped = new Set<string>();
    const groups = ((rawPersonaGroups ?? []) as Array<{ id: string; name: string; personaIds: string }>)
      .map((g) => {
        const members = parseIds(g.personaIds)
          .map((id) => byId.get(id))
          .filter((p): p is Persona => Boolean(p));
        members.forEach((p) => grouped.add(p.id));
        return { id: g.id, name: g.name, members };
      })
      .filter((g) => g.members.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
    return { personaGroups: groups, ungroupedPersonas: visiblePersonas.filter((p) => !grouped.has(p.id)) };
  }, [rawPersonaGroups, visiblePersonas]);

  // ── Characters ──
  const characterGroups = useMemo(() => {
    const excluded = new Set(excludeCharacterIds ?? []);
    const characters = ((rawCharacters ?? []) as CharacterIdentityChoice[]).filter((c) => {
      if (excluded.has(c.id)) return false;
      // Persona scope shows characters only when the setting is on; the one in use always stays visible.
      if (isPersonaScope && !showCharacterIdentities && c.id !== activeCharacterId) return false;
      return characterMatchesSearch(parseCharacterDisplayData(c), search);
    });
    return buildCharacterIdentityGroups(
      characters,
      (rawCharacterGroups ?? []) as CharacterGroup[],
      localizeUi("ui.chat.personapicker.ungrouped"),
    );
  }, [
    rawCharacters,
    rawCharacterGroups,
    excludeCharacterIds,
    isPersonaScope,
    showCharacterIdentities,
    activeCharacterId,
    search,
    localizeUi,
  ]);

  // Open the folder that holds the character in use, so the check is in sight.
  useEffect(() => {
    if (!activeCharacterId) return;
    const group = characterGroups.find((g) => g.members.some((c) => c.id === activeCharacterId));
    if (!group) return;
    setShowCharacters(true);
    setExpanded((prev) => (prev.has(group.id) ? prev : new Set(prev).add(group.id)));
  }, [activeCharacterId, characterGroups]);

  const characterRow = (character: CharacterIdentityChoice, indented: boolean) => {
    const data = parseCharacterDisplayData(character);
    return (
      <PickRow
        key={`character-${character.id}`}
        active={character.id === activeCharacterId}
        onClick={() => onPickCharacter(character.id)}
        avatar={<Avatar src={character.avatarPath} name={data.name} crop={data.avatarCrop} />}
        title={data.name}
        subtitle={
          getCharacterTitle(data) || (isPersonaScope ? localizeUi("ui.chat.personapicker.characterSource") : null)
        }
        indented={indented}
      />
    );
  };

  // One folder only (often just "ungrouped"): a flat list, no extra tap.
  const characterList =
    characterGroups.length === 1
      ? characterGroups[0]!.members.map((c) => characterRow(c, false))
      : characterGroups.map((group) => (
          <div key={group.id}>
            <FolderToggle
              open={isOpen(group.id)}
              onClick={() => toggle(group.id)}
              label={group.name}
              count={group.members.length}
              avatarPath={group.avatarPath ?? group.members[0]?.avatarPath}
            />
            {isOpen(group.id) && group.members.map((c) => characterRow(c, true))}
          </div>
        ));

  const personaRow = (persona: Persona, indented: boolean) => (
    <PickRow
      key={persona.id}
      active={persona.id === activePersonaId}
      onClick={() => onPickPersona?.(persona.id)}
      avatar={<Avatar src={persona.avatarPath} name={persona.name} crop={persona.avatarCrop} />}
      title={persona.name || persona.id}
      subtitle={
        persona.comment && (persona.comment.length > 60 ? `${persona.comment.substring(0, 60)}…` : persona.comment)
      }
      indented={indented}
    />
  );

  const noneActive = !activePersonaId && !activeCharacterId;
  const hasCharacters = characterGroups.length > 0;

  return (
    <>
      {controlledSearch === undefined && (
        <label className="mx-2 mt-2 flex items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.04] px-2.5 py-2 text-foreground/55">
          <Search size="0.875rem" className="shrink-0" />
          <span className="sr-only">
            {localizeUi(
              isPersonaScope ? "ui.chat.personapicker.search" : "ui.chat.chatsettingsdrawer.searchCharacters",
            )}
          </span>
          <input
            value={ownSearch}
            onChange={(event) => setOwnSearch(event.target.value)}
            placeholder={localizeUi(
              isPersonaScope ? "ui.chat.personapicker.search" : "ui.chat.chatsettingsdrawer.searchCharacters",
            )}
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-foreground/40"
          />
        </label>
      )}
      <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain p-1", listClassName)}>
        {isPersonaScope ? (
          <>
            <PickRow
              active={noneActive}
              onClick={() => onPickPersona?.(null)}
              avatar={<div className="h-9 w-9 shrink-0 rounded-full border border-foreground/10 bg-foreground/10" />}
              title={localizeUi("ui.game.gamesurfacecomponent.none")}
              subtitle={localizeUi("ui.chat.quickpersonaswitcher.noPersonaSelected")}
            />
            <div className="mx-2 my-1 h-px bg-foreground/10" />
            {personaGroups.map((group) => {
              const open = isOpen(group.id);
              return (
                <div key={group.id}>
                  <FolderToggle
                    open={open}
                    onClick={() => toggle(group.id)}
                    label={group.name}
                    count={`${group.members.length} ${localizeUi("ui.chat.quickpersonaswitcher.persona")}${group.members.length !== 1 ? localizeUi("ui.noodle.stageprofileview.s") : ""}`}
                    avatarPath={group.members[0]?.avatarPath}
                    highlighted={group.members.some((p) => p.id === activePersonaId)}
                  />
                  {open && (
                    <div className="ml-2 border-l border-foreground/10 pl-1">
                      {group.members.map((p) => personaRow(p, true))}
                    </div>
                  )}
                </div>
              );
            })}
            {ungroupedPersonas.map((p) => personaRow(p, false))}
            {personas.length === 0 && !hasCharacters && (
              <div className="px-3 py-4 text-center text-[0.6875rem] italic text-foreground/45">
                {localizeUi("ui.chat.quickpersonaswitcher.noPersonasFound")}
              </div>
            )}
            {personas.length > 0 && visiblePersonas.length === 0 && !hasCharacters && (
              <div className="px-3 py-4 text-center text-[0.6875rem] italic text-foreground/45">
                {localizeUi("ui.chat.personapicker.noMatchingPersonas")}
              </div>
            )}
            {hasCharacters && (
              <>
                <button
                  type="button"
                  onClick={() => setShowCharacters((value) => !value)}
                  aria-expanded={showCharacters || query !== ""}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg border border-foreground/10 px-2.5 py-2 text-left text-xs font-semibold text-foreground/70 transition-colors hover:bg-foreground/10"
                >
                  {showCharacters || query ? (
                    <FolderOpen size="0.875rem" className="shrink-0 text-foreground/50" />
                  ) : (
                    <Folder size="0.875rem" className="shrink-0 text-foreground/50" />
                  )}
                  <span className="flex-1">{localizeUi("ui.chat.personapicker.playAsCharacter")}</span>
                  {showCharacters || query ? <ChevronDown size="0.75rem" /> : <ChevronRight size="0.75rem" />}
                </button>
                {(showCharacters || query !== "") && characterList}
              </>
            )}
          </>
        ) : (
          <>
            {characterList}
            {!hasCharacters && (
              <div className="px-3 py-4 text-center text-[0.6875rem] italic text-foreground/45">
                {localizeUi("ui.chat.identitypicker.noMatchingCharacters")}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
