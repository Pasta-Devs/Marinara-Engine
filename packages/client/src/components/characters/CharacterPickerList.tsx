// ──────────────────────────────────────────────
// Character Picker List — the searchable list inside CharacterSelect. `kind="persona"`
// lists personas (plus the opt-in "Play as a character" section); `kind="character"`
// lists characters. With `multiple`, rows toggle and the picked ones show as pills on top.
// The shell (popover, sheet, inline tab) belongs to the caller.
// ──────────────────────────────────────────────
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  Ban,
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Plus,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { includesTextForMatch, type CharacterGroup, type Persona } from "@marinara-engine/shared";
import { useCharacterGroups, useCharacters, usePersonaGroups, usePersonas } from "../../hooks/use-characters";
import { useUIStore } from "../../stores/ui.store";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { characterMatchesSearch, getCharacterTitle, parseCharacterDisplayData } from "../../lib/character-display";
import {
  buildCharacterIdentityGroups,
  UNGROUPED_CHARACTER_GROUP_ID,
  type CharacterIdentityChoice,
} from "../../lib/character-identity-groups";

export type CharacterSelectKind = "persona" | "character";

export interface CharacterPickerListProps {
  kind: CharacterSelectKind;
  multiple?: boolean;
  /** Picked persona ids (persona kind). */
  personaIds?: readonly string[];
  /** Picked character ids (character kind, or "Play as a character" in persona kind). */
  characterIds?: readonly string[];
  onPickPersona?: (personaId: string | null) => void;
  onPickCharacter?: (characterId: string) => void;
  /** Single pick: a "None" row on top that calls this. */
  onPickNone?: () => void;
  /** Multi pick: an "Add all" button on each folder row, with the ids it would add. */
  onPickGroup?: (characterIds: string[]) => void;
  /** Persona kind: `true` always offers "Play as a character", `false` never; unset follows the user setting. */
  withCharacters?: boolean;
  /** Rows pause while the caller saves a pick, so fast taps never save from an old list. */
  busy?: boolean;
  /** Ids left out of the list, such as Professor Mari. */
  exclude?: readonly string[];
  /** Ids shown greyed out, with the reason as the subtitle. */
  unavailable?: Readonly<Record<string, string>>;
  /** Small mark after a row's name, such as the onboarding badge. */
  badge?: (id: string) => ReactNode;
  /** Shows a "New character" / "New persona" button when the library is empty. */
  onCreate?: () => void;
  autoFocusSearch?: boolean;
  /** Set false when the caller has a pick the list cannot show, so None is not marked. */
  nonePicked?: boolean;
  className?: string;
}

// The chat setup wizard paged its character list at 50; the picker keeps that limit per block.
const PAGE = 50;
const ROW = "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors max-md:min-h-12";
const NO_IDS: readonly string[] = [];

function parseIds(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

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
      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-foreground/10">
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" style={getAvatarCropStyle(crop)} />
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-foreground/10 bg-foreground/10 text-xs font-semibold text-foreground/45">
      {(name || "?")[0]?.toUpperCase()}
    </div>
  );
}

function PickRow({
  picked,
  multiple,
  onClick,
  avatar,
  title,
  subtitle,
  badge,
  indented,
  disabledReason,
  busy,
}: {
  picked: boolean;
  multiple?: boolean;
  onClick: () => void;
  avatar: ReactNode;
  title: string;
  subtitle?: string | null;
  badge?: ReactNode;
  indented?: boolean;
  disabledReason?: string;
  busy?: boolean;
}) {
  const disabled = disabledReason !== undefined;
  return (
    <button
      type="button"
      data-pick-row
      title={title}
      disabled={disabled || busy}
      onClick={onClick}
      aria-pressed={multiple ? picked : undefined}
      aria-current={!multiple && picked ? "true" : undefined}
      className={cn(
        ROW,
        "relative data-[active=true]:ring-2 data-[active=true]:ring-[var(--marinara-chat-chrome-focus-ring,currentColor)]",
        picked && !multiple ? "bg-foreground/10 text-foreground" : "hover:bg-foreground/[0.06]",
        indented && "pl-6",
        disabled && "cursor-default opacity-45 hover:bg-transparent",
      )}
    >
      {multiple && (
        <span
          aria-hidden="true"
          className={cn(
            "flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-[0.3125rem] border-[1.5px]",
            picked
              ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
              : "border-foreground/35",
          )}
        >
          {picked && <Check size="0.75rem" strokeWidth={3} />}
        </span>
      )}
      {avatar}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate text-xs font-medium", picked && "text-foreground")}>{title}</span>
        {(disabledReason ?? subtitle) && (
          <span className="truncate text-[0.6875rem] leading-tight text-foreground/50">
            {disabledReason ?? subtitle}
          </span>
        )}
      </span>
      {badge}
      {picked && !multiple && <Check size="0.875rem" className="ml-auto shrink-0 text-[var(--primary)]" />}
    </button>
  );
}

function FolderToggle({
  open,
  onClick,
  label,
  count,
  icon,
}: {
  open: boolean;
  onClick: () => void;
  label: string;
  count: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      data-pick-row
      onClick={onClick}
      aria-expanded={open}
      className={cn(
        ROW,
        "text-xs hover:bg-foreground/[0.06] data-[active=true]:ring-2 data-[active=true]:ring-[var(--marinara-chat-chrome-focus-ring,currentColor)]",
      )}
    >
      {open ? (
        <ChevronDown size="0.75rem" className="shrink-0 text-foreground/40" />
      ) : (
        <ChevronRight size="0.75rem" className="shrink-0 text-foreground/40" />
      )}
      {icon ??
        (open ? (
          <FolderOpen size="0.875rem" className="shrink-0 text-foreground/45" />
        ) : (
          <Folder size="0.875rem" className="shrink-0 text-foreground/45" />
        ))}
      <span className="min-w-0 flex-1 truncate font-semibold">{label}</span>
      <span className="text-[0.6875rem] tabular-nums text-foreground/45">{count}</span>
    </button>
  );
}

/** Renders the first 50 items, then a "Show 50 more" row. */
function Capped<T>({ items, render }: { items: readonly T[]; render: (item: T) => ReactNode }) {
  const { t } = useUiTranslation();
  const [limit, setLimit] = useState(PAGE);
  return (
    <>
      {items.slice(0, limit).map(render)}
      {items.length > limit && (
        <button
          type="button"
          data-pick-row
          onClick={() => setLimit((value) => value + PAGE)}
          className="min-h-10 w-full rounded-lg text-xs text-foreground/55 hover:bg-foreground/[0.06] data-[active=true]:ring-2"
        >
          {t("ui.characterselect.showMore", { count: Math.min(PAGE, items.length - limit) })}
        </button>
      )}
    </>
  );
}

export function CharacterPickerList({
  kind,
  multiple = false,
  personaIds = NO_IDS,
  characterIds = NO_IDS,
  onPickPersona,
  onPickCharacter,
  onPickNone,
  onPickGroup,
  withCharacters,
  busy = false,
  exclude,
  unavailable,
  badge,
  onCreate,
  autoFocusSearch = false,
  nonePicked,
  className,
}: CharacterPickerListProps) {
  const { t } = useUiTranslation();
  const [search, setSearch] = useState("");
  const query = search.trim();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const isPersona = kind === "persona";
  const showSetting = useUIStore((state) => state.showCharactersInPersonaPickers);
  // Persona kind offers characters only for a single pick, behind the user setting (or when one is in use).
  const offersCharacters =
    !isPersona || (!multiple && withCharacters !== false && (withCharacters || showSetting || characterIds.length > 0));
  const [showCharacters, setShowCharacters] = useState(!isPersona || withCharacters === true || showSetting);

  const personasQuery = usePersonas(isPersona);
  const { data: rawPersonaGroups } = usePersonaGroups();
  const charactersQuery = useCharacters();
  const { data: rawCharacterGroups } = useCharacterGroups();
  const loading = (isPersona && personasQuery.isLoading) || (offersCharacters && charactersQuery.isLoading);

  const personaSet = useMemo(() => new Set(personaIds), [personaIds]);
  const characterSet = useMemo(() => new Set(characterIds), [characterIds]);
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // A search opens every folder, so a match is never hidden behind a tap.
  const isOpen = (id: string) => query !== "" || expanded.has(id);

  // ── Personas ──
  const personas = useMemo(
    () =>
      ((personasQuery.data ?? []) as Persona[])
        .filter((p) => !exclude?.includes(p.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [personasQuery.data, exclude],
  );
  const visiblePersonas = useMemo(
    () => (query ? personas.filter((p) => includesTextForMatch(`${p.name} ${p.comment ?? ""}`, query)) : personas),
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
  const allCharacters = useMemo(
    () => ((charactersQuery.data ?? []) as CharacterIdentityChoice[]).filter((c) => !exclude?.includes(c.id)),
    [charactersQuery.data, exclude],
  );
  const characterGroups = useMemo(() => {
    const visible = allCharacters.filter((c) => {
      const data = parseCharacterDisplayData(c);
      return characterMatchesSearch(data, query) || includesTextForMatch(data.comment, query);
    });
    return buildCharacterIdentityGroups(
      visible,
      (rawCharacterGroups ?? []) as CharacterGroup[],
      t("ui.chat.personapicker.ungrouped"),
    );
  }, [allCharacters, rawCharacterGroups, query, t]);
  const characterCount = characterGroups.reduce((sum, g) => sum + g.members.length, 0);

  // Open the folder that holds a picked character, so its check is in sight on open.
  const firstPicked = characterIds[0];
  useEffect(() => {
    if (!firstPicked) return;
    const group = characterGroups.find((g) => g.members.some((c) => c.id === firstPicked));
    if (!group) return;
    if (isPersona) setShowCharacters(true);
    setExpanded((prev) => (prev.has(group.id) ? prev : new Set(prev).add(group.id)));
    // Only on open and when the pick changes, not on every search keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstPicked, characterGroups.length > 0]);
  const firstPersona = personaIds[0];
  useEffect(() => {
    const group = personaGroups.find((g) => g.members.some((p) => p.id === firstPersona));
    if (group) setExpanded((prev) => (prev.has(group.id) ? prev : new Set(prev).add(group.id)));
    // Only on open and when the pick changes, like the character folder above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstPersona, personaGroups.length > 0]);

  // ── Keyboard: the search keeps focus, arrows move a ring over the rows, Enter picks ──
  useEffect(() => setActive(0), [query]);
  const rows = () =>
    Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-pick-row]:not(:disabled)") ?? []);
  useEffect(() => {
    rows().forEach((row, index) => {
      row.id = `${listId}-row-${index}`;
      if (index === active) {
        row.dataset.active = "true";
      } else delete row.dataset.active;
    });
    const activeRow = rows()[active];
    if (activeRow) searchRef.current?.setAttribute("aria-activedescendant", activeRow.id);
    else searchRef.current?.removeAttribute("aria-activedescendant");
  });
  useEffect(() => {
    rows()[active]?.scrollIntoView?.({ block: "nearest" });
  }, [active, query]);

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    const count = rows().length;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (count) setActive((i) => (i + (event.key === "ArrowDown" ? 1 : count - 1)) % count);
    } else if (event.key === "Enter") {
      event.preventDefault();
      rows()[active]?.click();
    }
  };

  const characterRow = (character: CharacterIdentityChoice, indented: boolean) => {
    const data = parseCharacterDisplayData(character);
    return (
      <PickRow
        key={`character-${character.id}`}
        picked={characterSet.has(character.id)}
        multiple={multiple}
        onClick={() => onPickCharacter?.(character.id)}
        avatar={<Avatar src={character.avatarPath} name={data.name} crop={data.avatarCrop} />}
        title={data.name}
        subtitle={getCharacterTitle(data) || (isPersona ? t("ui.chat.personapicker.characterSource") : null)}
        badge={badge?.(character.id)}
        indented={indented}
        disabledReason={unavailable?.[character.id]}
        busy={busy}
      />
    );
  };
  const personaRow = (persona: Persona, indented: boolean) => (
    <PickRow
      key={`persona-${persona.id}`}
      picked={personaSet.has(persona.id)}
      multiple={multiple}
      onClick={() => onPickPersona?.(persona.id)}
      avatar={<Avatar src={persona.avatarPath} name={persona.name} crop={persona.avatarCrop} />}
      title={persona.name || "?"}
      subtitle={persona.comment}
      badge={badge?.(persona.id)}
      indented={indented}
      disabledReason={unavailable?.[persona.id]}
      busy={busy}
    />
  );

  const noneRow = onPickNone && !multiple && query === "" && (
    <>
      <PickRow
        picked={nonePicked ?? (personaIds.length === 0 && characterIds.length === 0)}
        onClick={onPickNone}
        avatar={
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-foreground/35 text-foreground/40">
            <Ban size="0.8rem" />
          </span>
        }
        title={t("ui.game.gamesurfacecomponent.none")}
        subtitle={isPersona ? t("ui.chat.quickpersonaswitcher.noPersonaSelected") : null}
      />
      <div className="mx-2 my-1 h-px bg-foreground/10" />
    </>
  );

  // One folder only (often just "Ungrouped") is a flat list, with no extra tap.
  // A single real folder keeps its row, open, when the caller can add a whole folder.
  const groupPickable = (id: string) => multiple && !!onPickGroup && id !== UNGROUPED_CHARACTER_GROUP_ID;
  const characterList =
    characterGroups.length === 1 && !groupPickable(characterGroups[0]!.id) ? (
      <Capped items={characterGroups[0]!.members} render={(c) => characterRow(c, false)} />
    ) : (
      characterGroups.map((group) => {
        // The sole folder cannot collapse, so its header is a plain label.
        const sole = characterGroups.length === 1;
        const open = sole || isOpen(group.id);
        const addable = groupPickable(group.id)
          ? group.members.filter((c) => !characterSet.has(c.id) && !unavailable?.[c.id]).map((c) => c.id)
          : [];
        return (
          <div key={group.id}>
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                {sole ? (
                  <div className="flex min-h-9 items-center gap-2 px-2 text-xs">
                    <FolderOpen size="0.875rem" className="shrink-0 text-foreground/45" />
                    <span className="min-w-0 flex-1 truncate font-semibold">{group.name}</span>
                    <span className="text-[0.6875rem] tabular-nums text-foreground/45">{group.members.length}</span>
                  </div>
                ) : (
                  <FolderToggle
                    open={open}
                    onClick={() => toggle(group.id)}
                    label={group.name}
                    count={group.members.length}
                  />
                )}
              </div>
              {addable.length > 0 && (
                <button
                  type="button"
                  data-pick-row
                  disabled={busy}
                  onClick={() => onPickGroup?.(addable)}
                  className="shrink-0 rounded-lg px-2 py-1.5 text-[0.6875rem] font-medium text-[var(--primary)] hover:bg-foreground/[0.06] data-[active=true]:ring-2 data-[active=true]:ring-[var(--marinara-chat-chrome-focus-ring,currentColor)]"
                >
                  {t("ui.characterselect.addAll", { count: addable.length })}
                </button>
              )}
            </div>
            {open && <Capped items={group.members} render={(c) => characterRow(c, true)} />}
          </div>
        );
      })
    );

  const libraryEmpty =
    !loading &&
    (isPersona
      ? personas.length === 0 && (!offersCharacters || allCharacters.length === 0)
      : allCharacters.length === 0);
  const nothingMatches =
    !loading &&
    !libraryEmpty &&
    query !== "" &&
    visiblePersonas.length === 0 &&
    (!offersCharacters || characterCount === 0);

  // Links to a deleted card stay as a removable pill instead of vanishing.
  const deleted = (ids: readonly string[], cards: Array<{ id: string }> | undefined) =>
    cards
      ? ids
          .filter((id) => !exclude?.includes(id) && !cards.some((card) => card.id === id))
          .map((id) => ({ id, name: t("ui.characterselect.deleted"), src: null }))
      : [];
  const picked = multiple
    ? isPersona
      ? [
          ...personas.filter((p) => personaSet.has(p.id)).map((p) => ({ id: p.id, name: p.name, src: p.avatarPath })),
          ...deleted(personaIds, personasQuery.data as Array<{ id: string }> | undefined),
        ]
      : [
          ...allCharacters
            .filter((c) => characterSet.has(c.id))
            .map((c) => ({ id: c.id, name: parseCharacterDisplayData(c).name, src: c.avatarPath })),
          ...deleted(characterIds, charactersQuery.data as Array<{ id: string }> | undefined),
        ]
    : [];

  const searchLabel = t(
    !isPersona
      ? "ui.chat.chatsettingsdrawer.searchCharacters"
      : offersCharacters
        ? "ui.characterselect.searchPersonasAndCharacters"
        : "ui.characterselect.searchPersonas",
  );

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <label className="mx-2 mt-2 flex items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.04] px-2.5 py-2 text-foreground/55 focus-within:border-foreground/25">
        <Search size="0.875rem" className="shrink-0" />
        <span className="sr-only">{searchLabel}</span>
        <input
          type="search"
          ref={searchRef}
          aria-controls={listId}
          value={search}
          autoFocus={autoFocusSearch}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={onSearchKey}
          placeholder={searchLabel}
          className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-foreground/40 max-md:text-base"
        />
      </label>

      {picked.length > 0 && (
        <div className="flex max-h-24 shrink-0 flex-wrap gap-1.5 overflow-y-auto px-2 py-2">
          {picked.map((item) => (
            <span
              key={item.id}
              className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-foreground/10 pl-0.5 pr-1 text-[0.6875rem]"
            >
              {item.src ? (
                <img src={item.src} alt="" className="h-5 w-5 rounded-full object-cover" />
              ) : (
                <span className="h-5 w-5 rounded-full bg-foreground/15" />
              )}
              <span className="truncate">{item.name}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => (isPersona ? onPickPersona?.(item.id) : onPickCharacter?.(item.id))}
                aria-label={t("ui.characterselect.remove", { name: item.name })}
                className="relative after:absolute after:-inset-3 after:content-[''] flex h-5 w-5 items-center justify-center rounded-full text-foreground/55 hover:bg-foreground/10 hover:text-foreground"
              >
                <X size="0.6875rem" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div
        ref={listRef}
        id={listId}
        aria-busy={busy || undefined}
        className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-foreground/10 p-1"
      >
        {loading ? (
          [70, 55, 80].map((width) => (
            <div key={width} className="flex items-center gap-2.5 px-2 py-1.5" aria-hidden="true">
              <span className="h-8 w-8 shrink-0 rounded-full bg-foreground/[0.06]" />
              <span className="flex flex-1 flex-col gap-1.5">
                <span className="h-2.5 rounded bg-foreground/[0.06]" style={{ width: `${width}%` }} />
                <span className="h-2 rounded bg-foreground/[0.06]" style={{ width: `${width - 25}%` }} />
              </span>
            </div>
          ))
        ) : libraryEmpty ? (
          <div className="flex flex-col items-center gap-2 px-5 py-8 text-center text-xs text-foreground/55">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-foreground/[0.06]">
              <UserPlus size="1.125rem" />
            </span>
            {t(isPersona ? "ui.characterselect.noPersonasYet" : "ui.characterselect.noCharactersYet")}
            {onCreate && (
              <button
                type="button"
                onClick={onCreate}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-foreground/20 px-3 text-xs text-foreground hover:bg-foreground/[0.06]"
              >
                <Plus size="0.875rem" />
                {t(isPersona ? "ui.characterselect.newPersona" : "ui.characterselect.newCharacter")}
              </button>
            )}
          </div>
        ) : nothingMatches ? (
          <div className="flex flex-col items-center gap-2 px-5 py-8 text-center text-xs text-foreground/55">
            {t("ui.characterselect.noMatch", { query })}
            <button
              type="button"
              onClick={() => setSearch("")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-foreground/20 px-3 text-xs text-foreground hover:bg-foreground/[0.06]"
            >
              <X size="0.875rem" />
              {t("ui.characterselect.clearSearch")}
            </button>
          </div>
        ) : isPersona ? (
          <>
            {noneRow}
            {personaGroups.map((group) => (
              <div key={group.id}>
                <FolderToggle
                  open={isOpen(group.id)}
                  onClick={() => toggle(group.id)}
                  label={group.name}
                  count={group.members.length}
                />
                {isOpen(group.id) && group.members.map((p) => personaRow(p, true))}
              </div>
            ))}
            <Capped items={ungroupedPersonas} render={(p) => personaRow(p, false)} />
            {offersCharacters && characterCount > 0 && (
              <>
                <FolderToggle
                  open={showCharacters || query !== ""}
                  onClick={() => setShowCharacters((value) => !value)}
                  label={t("ui.chat.personapicker.playAsCharacter")}
                  count={characterCount}
                  icon={<Users size="0.875rem" className="shrink-0 text-foreground/45" />}
                />
                {(showCharacters || query !== "") && <div className="pl-2">{characterList}</div>}
              </>
            )}
          </>
        ) : (
          <>
            {noneRow}
            {characterList}
          </>
        )}
      </div>
    </div>
  );
}
