// ──────────────────────────────────────────────
// Library pickers: the preset field and the lorebook window, shared by the New Chat wizards,
// the Chat Settings drawer and the profile builder. They are the generic picker fields
// (PickerField.tsx) over the Presets / Lorebooks panels' folders, with each item's picture
// like character rows show avatars.
// ──────────────────────────────────────────────
import { useMemo, type RefObject } from "react";
import { BookOpen, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLibraryFolders } from "../../hooks/use-library-folders";
import { resolvePresetArtwork } from "../../lib/preset-artwork";
import type { AvatarCrop } from "@marinara-engine/shared";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { PICKER_ROW_ART, PickerField, PickerListField, PickerListWindow, type PickerListItem } from "./PickerField";

export type LibraryPreset = { id: string; name: string; author?: string | null; imagePath?: string | null };
export type LibraryLorebook = {
  id: string;
  name: string;
  imagePath?: string | null;
  imageCrop?: AvatarCrop | null;
  enabled?: boolean;
};

/** Size of the picture in a picker row. */
export const LIBRARY_ROW_ART = PICKER_ROW_ART;

// A preset's or lorebook's picture, as its panel shows it: the uploaded image, or the panel's
// placeholder (the presets gradient with a page, the lorebooks amber with a book).
export function LibraryArt({
  src,
  crop,
  kind,
  className,
}: {
  src: string | null;
  /** The lorebook picture's saved crop (presets have none). */
  crop?: AvatarCrop | null;
  kind: "preset" | "lorebook";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden",
        src
          ? "bg-[var(--muted)]"
          : kind === "preset"
            ? "mari-panel-gradient-surface mari-panel-gradient--presets"
            : "bg-gradient-to-br from-amber-400 to-orange-500 text-white",
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          style={getAvatarCropStyle(crop)}
          draggable={false}
        />
      ) : kind === "preset" ? (
        <FileText size="0.875rem" />
      ) : (
        <BookOpen size="0.875rem" />
      )}
    </span>
  );
}

// The Lorebooks panel's OFF mark. A switched-off book stays pickable: a fixed source or a write
// target uses it anyway, so the mark only says why it is quiet in chats.
export function LorebookOffBadge() {
  const { t } = useTranslation();
  return (
    <span className="shrink-0 rounded bg-[var(--muted)]/50 px-1 py-0.5 text-[0.5625rem] text-[var(--muted-foreground)]">
      {t("ui.panels.lorebookrow.off")}
    </span>
  );
}

const offBadge = (item: { enabled?: boolean; disabledReason?: string }) =>
  item.enabled === false && item.disabledReason === undefined ? <LorebookOffBadge /> : undefined;

export type LibraryFieldItem = (LibraryPreset | LibraryLorebook) & {
  /** Greys the row out in the window, with this as its second line. */
  disabledReason?: string;
};

type LibraryFieldProps = {
  /** Item id, or "" for None. */
  value: string;
  /** Names the trigger and titles the window. */
  ariaLabel: string;
  /** Text of the None row and of the trigger when nothing is picked. Defaults to "None". */
  noneLabel?: string;
  /** Trigger text when `value` is set but not in the list (deleted, unavailable, not loaded yet). */
  missingLabel?: string;
  /** The field look of the surface it sits in (wizard input, drawer select). */
  triggerClassName: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

// A single-pick library field: PickerField over the panel's folders, with a None row and each
// item's picture, like the persona and character pickers. A pick closes it.
function LibraryPickerField({
  kind,
  items: source,
  noneLabel,
  ...rest
}: LibraryFieldProps & { kind: "preset" | "lorebook"; items: readonly LibraryFieldItem[] }) {
  const { t } = useTranslation();
  const { data: folders } = useLibraryFolders(kind === "preset" ? "presets" : "lorebooks");
  const items = useMemo(
    () =>
      source.map((item) => ({
        id: item.id,
        label: item.name,
        disabledReason: item.disabledReason,
        badge: kind === "lorebook" ? offBadge(item as LibraryLorebook) : undefined,
        icon: (
          <LibraryArt
            src={kind === "preset" ? resolvePresetArtwork(item) : (item.imagePath ?? null)}
            kind={kind}
            className={LIBRARY_ROW_ART}
          />
        ),
      })),
    [source, kind],
  );

  return (
    <PickerField
      {...rest}
      items={items}
      folders={folders}
      noneLabel={noneLabel ?? t("ui.game.gamesurfacecomponent.none")}
      triggerData={kind === "preset" ? { "data-preset-picker-trigger": "" } : { "data-lorebook-picker-trigger": "" }}
      searchLabel={t(kind === "preset" ? "chat.wizard.select.search" : "ui.chat.roleplaysetupwizard.searchLorebooks")}
      emptyLabel={t("ui.lorebooks.linkedresourcepicker.noMatches")}
      noMatchesLabel={t("ui.lorebooks.linkedresourcepicker.noMatches")}
    />
  );
}

/** The preset field (wizards, Chat Settings, scene setup, the profile builder). */
export function PresetPickerField(props: LibraryFieldProps & { presets: readonly LibraryFieldItem[] }) {
  const { presets, ...rest } = props;
  return <LibraryPickerField kind="preset" items={presets} {...rest} />;
}

/** A one-lorebook field (agent target, agent attachment, encounter spellbook). */
export function LorebookPickerField(props: LibraryFieldProps & { lorebooks: readonly LibraryFieldItem[] }) {
  const { lorebooks, ...rest } = props;
  return <LibraryPickerField kind="lorebook" items={lorebooks} {...rest} />;
}

function useLorebookItems(lorebooks: readonly LibraryLorebook[]) {
  return useMemo(
    (): PickerListItem[] =>
      lorebooks.map((lb) => ({
        id: lb.id,
        label: lb.name,
        badge: offBadge(lb),
        icon: <LibraryArt src={lb.imagePath ?? null} crop={lb.imageCrop} kind="lorebook" className={LIBRARY_ROW_ART} />,
        smallIcon: (
          <LibraryArt src={lb.imagePath ?? null} crop={lb.imageCrop} kind="lorebook" className="h-6 w-6 rounded-md" />
        ),
      })),
    [lorebooks],
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
  const items = useLorebookItems(lorebooks);
  return (
    <PickerListWindow
      title={t("navigation.topbar.lorebooks")}
      anchorRef={anchorRef}
      items={items}
      folders={folders}
      selectedIds={selectedIds}
      onToggle={onToggle}
      onAdd={onAdd}
      onClose={onClose}
      searchLabel={t("ui.chat.roleplaysetupwizard.searchLorebooks")}
      emptyLabel={t("ui.panels.lorebookspanel.noLorebooksYet")}
      noMatchesLabel={t("ui.lorebooks.linkedresourcepicker.noMatches")}
    />
  );
}

// A several-lorebooks field (New Chat lorebook step, agents' fixed sources, the profile builder): a
// trigger that opens the lorebook window, with the picked lorebooks listed under it, a remove button each.
export function LorebookListField({
  lorebooks,
  selectedIds,
  onToggle,
  onAdd,
  triggerClassName,
  ariaLabel,
  keepMissing,
  disabled,
}: {
  lorebooks: readonly LibraryLorebook[];
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  onAdd: (ids: string[]) => void;
  /** The field look of the surface it sits in. */
  triggerClassName: string;
  /** Names the trigger, when a visible label isn't tied to it. */
  ariaLabel?: string;
  /** Lists picked ids that aren't loaded lorebooks by their id, so they can be removed. */
  keepMissing?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { data: folders } = useLibraryFolders("lorebooks");
  const items = useLorebookItems(lorebooks);
  return (
    <PickerListField
      items={items}
      folders={folders}
      selectedIds={selectedIds}
      onToggle={onToggle}
      onAdd={onAdd}
      title={t("navigation.topbar.lorebooks")}
      triggerLabel={t("ui.chat.roleplaysetupwizard.chooseLorebooks")}
      triggerIcon={<BookOpen size="0.875rem" aria-hidden="true" className="shrink-0 text-[var(--muted-foreground)]" />}
      triggerClassName={triggerClassName}
      triggerData={{ "data-lorebook-list-trigger": "" }}
      ariaLabel={ariaLabel}
      removeLabel={(name) => t("ui.chat.roleplaysetupwizard.removeLorebook", { name })}
      keepMissing={keepMissing}
      disabled={disabled}
      searchLabel={t("ui.chat.roleplaysetupwizard.searchLorebooks")}
      emptyLabel={t("ui.panels.lorebookspanel.noLorebooksYet")}
      noMatchesLabel={t("ui.lorebooks.linkedresourcepicker.noMatches")}
    />
  );
}
