// ──────────────────────────────────────────────
// Library pickers: the preset field and the lorebook window, shared by the New Chat wizards
// and the Chat Settings drawer. Both open PickerWindow with PickerFolderList over the
// Presets / Lorebooks panels' folders, and show each item's picture like character rows
// show avatars.
// ──────────────────────────────────────────────
import { useMemo, useRef, useState, type RefObject } from "react";
import { Ban, BookOpen, ChevronDown, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLibraryFolders } from "../../hooks/use-library-folders";
import { resolvePresetArtwork } from "../../lib/preset-artwork";
import { cn } from "../../lib/utils";
import { PickerFolderList } from "./PickerFolderList";
import { PickerWindow } from "./PickerWindow";

export type LibraryPreset = { id: string; name: string; author?: string | null; imagePath?: string | null };
export type LibraryLorebook = { id: string; name: string; imagePath?: string | null };

/** Size of the picture in a picker row. */
export const LIBRARY_ROW_ART = "h-8 w-8 rounded-lg";

// A preset's or lorebook's picture, as its panel shows it: the uploaded image, or the panel's
// placeholder (the presets gradient with a page, the lorebooks amber with a book).
export function LibraryArt({
  src,
  kind,
  className,
}: {
  src: string | null;
  kind: "preset" | "lorebook";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden",
        src
          ? "bg-[var(--muted)]"
          : kind === "preset"
            ? "mari-panel-gradient-surface mari-panel-gradient--presets"
            : "bg-gradient-to-br from-amber-400 to-orange-500 text-white",
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" draggable={false} />
      ) : kind === "preset" ? (
        <FileText size="0.875rem" />
      ) : (
        <BookOpen size="0.875rem" />
      )}
    </span>
  );
}

// The preset field: a trigger that opens the picker window with search, a None row and the
// Presets panel's folders, like the persona and character pickers. A pick closes it.
export function PresetPickerField({
  value,
  presets,
  ariaLabel,
  noneLabel,
  triggerClassName,
  disabled,
  onChange,
}: {
  /** Preset id, or "" for None. */
  value: string;
  presets: readonly LibraryPreset[];
  /** Names the trigger and titles the window. */
  ariaLabel: string;
  /** Text of the None row and of the trigger when nothing is picked. Defaults to "None". */
  noneLabel?: string;
  /** The field look of the surface it sits in (wizard input, drawer select). */
  triggerClassName: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { data: folders } = useLibraryFolders("presets");
  const none = noneLabel ?? t("ui.game.gamesurfacecomponent.none");
  const items = useMemo(
    () =>
      presets.map((preset) => ({
        id: preset.id,
        label: preset.name,
        icon: <LibraryArt src={resolvePresetArtwork(preset)} kind="preset" className={LIBRARY_ROW_ART} />,
      })),
    [presets],
  );
  const leadingItems = useMemo(
    () => [
      {
        id: "",
        label: none,
        icon: (
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-foreground/35 text-foreground/40"
          >
            <Ban size="0.8rem" />
          </span>
        ),
      },
    ],
    [none],
  );
  const selectedLabel = presets.find((preset) => preset.id === value)?.name ?? none;

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-preset-picker-trigger
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        className={cn(triggerClassName, "flex items-center justify-between gap-2 pr-3 text-left")}
      >
        <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
        <ChevronDown
          size="0.75rem"
          aria-hidden="true"
          className={cn("shrink-0 text-[var(--muted-foreground)] transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <PickerWindow title={ariaLabel} anchorRef={triggerRef} onClose={close}>
          <PickerFolderList
            items={items}
            folders={folders ?? []}
            selectedIds={[value]}
            leadingItems={leadingItems}
            onToggle={(id) => {
              onChange(id);
              close();
            }}
            searchLabel={t("chat.wizard.select.search")}
            emptyLabel={t("ui.lorebooks.linkedresourcepicker.noMatches")}
            noMatchesLabel={t("ui.lorebooks.linkedresourcepicker.noMatches")}
          />
        </PickerWindow>
      )}
    </>
  );
}

// The lorebook window: search, checkboxes and the Lorebooks panel's folders ("Add all" per
// folder). It stays open while picking; the caller owns the trigger and the open state.
export function LorebookPickerWindow({
  anchorRef,
  lorebooks,
  selectedIds,
  onToggle,
  onAdd,
  onClose,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  lorebooks: readonly LibraryLorebook[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  /** "Add all" on a folder, with the ids of that folder not yet selected. */
  onAdd: (ids: string[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data: folders } = useLibraryFolders("lorebooks");
  const items = useMemo(
    () =>
      lorebooks.map((lb) => ({
        id: lb.id,
        label: lb.name,
        icon: <LibraryArt src={lb.imagePath ?? null} kind="lorebook" className={LIBRARY_ROW_ART} />,
      })),
    [lorebooks],
  );
  const count = selectedIds.filter((id) => lorebooks.some((lb) => lb.id === id)).length;
  const baseTitle = t("navigation.topbar.lorebooks");
  const title = count > 0 ? baseTitle + " · " + count : baseTitle;

  return (
    <PickerWindow title={title} anchorRef={anchorRef} onClose={onClose}>
      <PickerFolderList
        items={items}
        folders={folders ?? []}
        selectedIds={selectedIds}
        multiple
        onToggle={onToggle}
        onPickGroup={onAdd}
        searchLabel={t("ui.chat.roleplaysetupwizard.searchLorebooks")}
        emptyLabel={t("ui.panels.lorebookspanel.noLorebooksYet")}
        noMatchesLabel={t("ui.lorebooks.linkedresourcepicker.noMatches")}
      />
    </PickerWindow>
  );
}
