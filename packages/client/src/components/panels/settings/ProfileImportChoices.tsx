// "Choose what to import" for Import Profile (Settings > Data > Backup & restore). After the file is
// scanned, it lists what the file holds, one row per kind with its count, and the kinds that can be
// picked item by item (characters, personas, lorebooks, presets, chats) open to a checklist. Same
// look as the SillyTavern import's category list (ov-stimp / ov-stcat). The server checks the choice
// again before it writes anything.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bot,
  BookOpen,
  Brain,
  ChevronRight,
  Dices,
  GraduationCap,
  Image,
  MessageSquare,
  Newspaper,
  Package,
  Palette,
  Plug,
  Puzzle,
  Regex,
  Search,
  Settings,
  SlidersHorizontal,
  UserRound,
  Users,
  Wrench,
  Layers,
} from "lucide-react";
import { HelpTooltip } from "../../ui/HelpTooltip";
import { cn } from "../../../lib/utils";

export type ProfileImportContentItem = {
  id: string;
  name: string;
  mode?: string;
  messages?: number;
  entries?: number;
};
export type ProfileImportContentKind = {
  key: string;
  count: number;
  files: number;
  items?: ProfileImportContentItem[];
  messages?: number;
};
export type ProfileImportContents = { kinds: ProfileImportContentKind[] };

/** Per kind: whether it is on, and for kinds with items, which items are picked. */
export type ProfileImportChoiceEntry = { on: boolean; picked?: Set<string> };
export type ProfileImportChoice = Record<string, ProfileImportChoiceEntry>;
export type ProfileImportChoiceUpdate = ProfileImportChoice | ((current: ProfileImportChoice) => ProfileImportChoice);
/** What the server takes: the chosen kinds, and item lists only for kinds that aren't fully picked. */
export type ProfileImportSelectionPayload = { kinds: string[]; items: Record<string, string[]> };

const KIND_ICONS: Record<string, typeof Users> = {
  characters: Users,
  personas: UserRound,
  lorebooks: BookOpen,
  presets: SlidersHorizontal,
  chats: MessageSquare,
  settingsProfiles: Layers,
  connections: Plug,
  agents: Bot,
  customTools: Wrench,
  regex: Regex,
  themes: Palette,
  assets: Image,
  game: Dices,
  social: Newspaper,
  mari: GraduationCap,
  extensions: Puzzle,
  memory: Brain,
  settings: Settings,
  other: Package,
};

function hasItems(kind: ProfileImportContentKind) {
  return Array.isArray(kind.items) && kind.items.length > 0;
}

/** Everything ticked, as the import did before there was a choice. */
export function buildInitialProfileImportChoice(contents: ProfileImportContents): ProfileImportChoice {
  const choice: ProfileImportChoice = {};
  for (const kind of contents.kinds) {
    choice[kind.key] = hasItems(kind)
      ? { on: true, picked: new Set(kind.items!.map((item) => item.id)) }
      : { on: true };
  }
  return choice;
}

function isEntryOn(kind: ProfileImportContentKind, current: ProfileImportChoiceEntry | undefined) {
  if (!current) return false;
  return hasItems(kind) ? (current.picked?.size ?? 0) > 0 : current.on;
}

function isKindOn(kind: ProfileImportContentKind, choice: ProfileImportChoice) {
  return isEntryOn(kind, choice[kind.key]);
}

export function buildProfileImportSelection(
  contents: ProfileImportContents,
  choice: ProfileImportChoice,
): ProfileImportSelectionPayload {
  const kinds: string[] = [];
  const items: Record<string, string[]> = {};
  for (const kind of contents.kinds) {
    if (!isKindOn(kind, choice)) continue;
    kinds.push(kind.key);
    const picked = choice[kind.key]?.picked;
    if (hasItems(kind) && picked && picked.size < kind.items!.length) items[kind.key] = [...picked];
  }
  return { kinds, items };
}

/** How many things are ticked: items for kinds with items, the count for the rest. */
export function countProfileImportChoice(contents: ProfileImportContents, choice: ProfileImportChoice) {
  let selected = 0;
  let total = 0;
  for (const kind of contents.kinds) {
    const size = hasItems(kind) ? kind.items!.length : Math.max(kind.count, kind.files > 0 ? 1 : 0);
    total += size;
    if (!isKindOn(kind, choice)) continue;
    selected += hasItems(kind) ? (choice[kind.key]?.picked?.size ?? 0) : size;
  }
  return { selected, total };
}

function KindCheckbox({
  checked,
  indeterminate,
  onChange,
  disabled,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 shrink-0 accent-[var(--primary)]"
    />
  );
}

/** Longer item lists get a search box. */
const SEARCH_FROM_ITEMS = 8;

/** One kind's row. Memoized on its own entry, so ticking an item redraws only that kind. */
const ProfileImportKindRow = memo(function ProfileImportKindRow({
  kind,
  entry,
  onEntryChange,
  disabled,
}: {
  kind: ProfileImportContentKind;
  entry: ProfileImportChoiceEntry | undefined;
  onEntryChange: (key: string, entry: ProfileImportChoiceEntry) => void;
  disabled?: boolean;
}) {
  const { t: localizeUi } = useTranslation();
  const items = kind.items ?? [];
  const itemized = items.length > 0;
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  // A to Z, so one character among a hundred can be found; the search narrows it further.
  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" }),
      ),
    [items],
  );
  const needle = query.trim().toLocaleLowerCase();
  const shownItems = needle
    ? sortedItems.filter((item) => (item.name || "").toLocaleLowerCase().includes(needle))
    : sortedItems;
  const picked = entry?.picked ?? new Set<string>();
  const on = isEntryOn(kind, entry);
  const partial = itemized && picked.size > 0 && picked.size < items.length;
  const Icon = KIND_ICONS[kind.key] ?? Package;

  const setPicked = (ids: Iterable<string>) => {
    const next = new Set(ids);
    onEntryChange(kind.key, { on: next.size > 0, picked: next });
  };
  const setOn = (checked: boolean) => {
    if (itemized) setPicked(checked ? items.map((item) => item.id) : []);
    else onEntryChange(kind.key, { on: checked });
  };

  const details: string[] = [];
  if (kind.key === "chats" && kind.messages) {
    details.push(localizeUi("ui.panels.importsettings.profileChoose.messages", { count: kind.messages }));
  }
  if (kind.files > 0) {
    details.push(localizeUi("ui.panels.importsettings.profileChoose.files", { count: kind.files }));
  }
  const name = localizeUi(`ui.panels.importsettings.profileChoose.kinds.${kind.key}`);

  return (
    <div className={cn("ov-stcat", !on && "is-off")}>
      <div className="ov-stcat__head">
        <label className="ov-pimp__kind">
          <KindCheckbox checked={on && !partial} indeterminate={partial} onChange={setOn} disabled={disabled} />
          <span className="ov-stcat__icon">
            <Icon size="0.875rem" />
          </span>
          <span className="ov-pimp__text">
            <span className="ov-stcat__name">{name}</span>
            {itemized ? (
              <span className="ov-stcat__count">
                {picked.size}/{items.length}
              </span>
            ) : kind.count > 0 ? (
              <span className="ov-stcat__count">{kind.count}</span>
            ) : null}
            {details.length > 0 && <span className="ov-pimp__detail">{details.join(" · ")}</span>}
          </span>
        </label>
        {itemized && (
          <span className="ov-stcat__tools">
            <button
              type="button"
              className="ov-stcat__toggle"
              aria-expanded={expanded}
              aria-label={localizeUi(
                expanded
                  ? "ui.panels.importsettings.profileChoose.hideItems"
                  : "ui.panels.importsettings.profileChoose.showItems",
                { kind: name },
              )}
              onClick={() => setExpanded((value) => !value)}
            >
              <ChevronRight size="0.875rem" />
            </button>
          </span>
        )}
      </div>
      {itemized && expanded && items.length > SEARCH_FROM_ITEMS && (
        <div className="ov-pimp__search">
          <label className="ov-search">
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={localizeUi("ui.panels.importsettings.profileChoose.searchKind", { kind: name })}
              aria-label={localizeUi("ui.panels.importsettings.profileChoose.searchKind", { kind: name })}
            />
          </label>
        </div>
      )}
      {itemized && expanded && (
        <div className="ov-stcat__items">
          {shownItems.length === 0 && (
            <div className="ov-pimp__nomatch">{localizeUi("ui.panels.importsettings.profileChoose.noMatches")}</div>
          )}
          {shownItems.map((item) => {
            const itemDetails: string[] = [];
            if (item.mode)
              itemDetails.push(localizeUi(`ui.panels.importsettings.profileChoose.mode.${item.mode}`, item.mode));
            if (typeof item.messages === "number") {
              itemDetails.push(localizeUi("ui.panels.importsettings.profileChoose.messages", { count: item.messages }));
            }
            if (typeof item.entries === "number") {
              itemDetails.push(localizeUi("ui.panels.importsettings.profileChoose.entries", { count: item.entries }));
            }
            return (
              <label key={item.id} className="ov-stcat__item">
                <input
                  type="checkbox"
                  checked={picked.has(item.id)}
                  disabled={disabled}
                  onChange={(event) => {
                    const next = new Set(picked);
                    if (event.target.checked) next.add(item.id);
                    else next.delete(item.id);
                    setPicked(next);
                  }}
                  className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                />
                <span className="ov-stcat__itemname">
                  {item.name || localizeUi("ui.panels.importsettings.profileChoose.unnamed")}
                </span>
                {itemDetails.length > 0 && <span className="ov-stcat__itemdetail">{itemDetails.join(" · ")}</span>}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
});

export function ProfileImportChoices({
  contents,
  choice,
  onChange,
  disabled,
  fileName,
}: {
  contents: ProfileImportContents;
  choice: ProfileImportChoice;
  /** Takes a new choice or an updater; pass a stable function (a state setter) so rows can skip redraws. */
  onChange: (next: ProfileImportChoiceUpdate) => void;
  disabled?: boolean;
  fileName?: string;
}) {
  const { t: localizeUi } = useTranslation();
  const onEntryChange = useCallback(
    (key: string, entry: ProfileImportChoiceEntry) => onChange((current) => ({ ...current, [key]: entry })),
    [onChange],
  );
  const { selected, total } = countProfileImportChoice(contents, choice);
  const allOn = contents.kinds.every((kind) => {
    if (!isKindOn(kind, choice)) return false;
    return !hasItems(kind) || (choice[kind.key]?.picked?.size ?? 0) === kind.items!.length;
  });
  return (
    <div className="ov-stimp__cats ov-pimp">
      <div className="ov-stimp__catshead">
        <span className="ov-pimp__title">
          <span>{localizeUi("ui.panels.importsettings.profileChoose.title")}</span>
          <HelpTooltip
            text={localizeUi("ui.panels.importsettings.profileChoose.help")}
            topic={localizeUi("ui.panels.importsettings.profileChoose.title")}
            wide
          />
          {fileName && <span className="ov-pimp__file">{fileName}</span>}
        </span>
        <span className="ov-stcat__tools">
          <span className="ov-stimp__count">
            {localizeUi("ui.panels.importsettings.profileChoose.selected", { selected, total })}
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (allOn) {
                const none: ProfileImportChoice = {};
                for (const kind of contents.kinds) {
                  none[kind.key] = hasItems(kind) ? { on: false, picked: new Set() } : { on: false };
                }
                onChange(none);
              } else {
                onChange(buildInitialProfileImportChoice(contents));
              }
            }}
          >
            {allOn
              ? localizeUi("ui.game.gamesurfacecomponent.none")
              : localizeUi("ui.noodle.stageprofilesourcepicker.all")}
          </button>
        </span>
      </div>
      {contents.kinds.map((kind) => (
        <ProfileImportKindRow
          key={kind.key}
          kind={kind}
          entry={choice[kind.key]}
          onEntryChange={onEntryChange}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
