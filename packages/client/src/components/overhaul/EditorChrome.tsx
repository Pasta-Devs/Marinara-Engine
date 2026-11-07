// ──────────────────────────────────────────────
// UI overhaul: shared pieces for the Library editors (v1 frames)
//
// A title row (crumbs, big title, a short meta line, actions on the right),
// eyebrow section headings with a rule, and label-left form rows. The
// Connection, Regex and Agent editors are built from these.
// ──────────────────────────────────────────────
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, MoreHorizontal, Save } from "lucide-react";
import { cn } from "../../lib/utils";
import { openLibraryPane, openLibrarySection } from "./library-navigation";
import { useOverhaulMobile, type LibrarySection } from "../../stores/overhaul.store";
import { EditorCrumbs, type RailCrumb } from "./EditorRail";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { useEditorDraftOfferStore } from "../../hooks/use-editor-leave-save";

/** "just now", "3 min ago", "2 h ago" for a kept draft (user panel 3, PR4: a few seconds read "1 min ago"). */
function useDraftAge(savedAt: number) {
  const { t } = useUiTranslation();
  const minutes = Math.floor((Date.now() - savedAt) / 60_000);
  if (minutes < 1) return t("editor.draft.justNow", { defaultValue: "just now" });
  if (minutes < 60) return t("editor.draft.minutesAgo", { count: minutes, defaultValue: "{{count}} min ago" });
  return t("editor.draft.hoursAgo", { count: Math.floor(minutes / 60), defaultValue: "{{count}} h ago" });
}

/**
 * Edits kept from before a reload, offered back inside the editor they belong to: names the item,
 * stays until Restore or Discard, and after Restore says they still need a Save (user panel 3, PV6/PN3/PR4).
 */
function OvDraftBar() {
  const { t } = useUiTranslation();
  const offer = useEditorDraftOfferStore((state) => state.offer);
  const age = useDraftAge(offer?.savedAt ?? Date.now());
  if (!offer) return null;
  if (offer.state === "restored") {
    return (
      <div className="ov-stock-bar ov-draft-bar is-restored" role="status" data-component="OverhaulDraftBar">
        <span className="ov-stock-bar__text">
          {t("editor.draft.restored", { defaultValue: "Restored your unsaved changes. Save to keep them." })}
        </span>
      </div>
    );
  }
  return (
    <div className="ov-stock-bar ov-draft-bar" role="status" data-component="OverhaulDraftBar">
      <span className="ov-stock-bar__text">
        {offer.name
          ? t("editor.draft.foundNamed", {
              name: offer.name,
              age,
              defaultValue: "{{name}} has unsaved changes from before the page reloaded ({{age}}).",
            })
          : t("editor.draft.foundAge", {
              age,
              defaultValue: "Unsaved changes from before the page reloaded ({{age}}).",
            })}
      </span>
      <button type="button" className="ov-btn" onClick={offer.discard}>
        {t("editor.draft.discard", { defaultValue: "Discard" })}
      </button>
      <button type="button" className="ov-btn ov-btn--primary" onClick={offer.restore}>
        {t("editor.draft.restore", { defaultValue: "Restore" })}
      </button>
    </div>
  );
}

/**
 * Library viewers (Regex, Connections) hand their top header to the open item's editor:
 * an editor inside a viewer renders its header here, so every editor's title row sits at
 * the same place whether it is a page of its own or the right side of a viewer.
 */
export const OvEditorHeadSlot = createContext<HTMLElement | null>(null);

export type OvEditorMenuItem = {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
};

export type OvEditorSave = {
  dirty: boolean;
  onSave: () => unknown;
  saving?: boolean;
  error?: boolean;
  /** Extra reason the Save button can't be pressed (a validation error). */
  disabled?: boolean;
};

/**
 * The one header every Library editor shares: Library › Section › Item crumbs, the item's
 * name as the title, a short meta line, then the editor's own buttons, the save state, Save
 * and ⋯ on the right. Phones get a ‹ back instead of the crumbs.
 */
export function OvEditorHead({
  section,
  sectionLabel,
  crumbs,
  onBack,
  lead,
  title,
  onTitleChange,
  titlePlaceholder,
  meta,
  status,
  actions,
  save,
  menu,
  menuContent,
  className,
}: {
  section?: LibrarySection;
  sectionLabel?: string;
  /** Overrides the default Library › Section › Title trail. */
  crumbs?: RailCrumb[];
  /** Where Section (and the phone ‹) goes; defaults to the section's landing page. */
  onBack?: () => void;
  /** A picture or icon before the title (a connection's provider). */
  lead?: ReactNode;
  title: string;
  onTitleChange?: (next: string) => void;
  titlePlaceholder?: string;
  meta?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  save?: OvEditorSave;
  /** Items for the ⋯ menu. */
  menu?: OvEditorMenuItem[];
  /** A ready-made ⋯ menu body, for editors whose overflow actions are their own buttons. */
  menuContent?: ReactNode;
  className?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const localize = useLocalizedUiText();
  const mobile = useOverhaulMobile();
  const slot = useContext(OvEditorHeadSlot);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);
  const goBack = onBack ?? (() => section && openLibrarySection(section));
  const label = sectionLabel ? localize(sectionLabel) : "";
  // Desktop crumbs go where they say: Library opens the Library pane, the section opens its landing
  // page (not whatever was on screen before the editor). The phone ‹ keeps the editor's own way back.
  const trail: RailCrumb[] = crumbs ?? [
    { label: localizeUi("ui.overhaul.oveditorhead.library"), onClick: openLibraryPane },
    { label, onClick: section ? () => openLibrarySection(section) : goBack },
    { label: title || titlePlaceholder || "" },
  ];
  const hasMenu = Boolean(menu?.length || menuContent);
  const menuNode = hasMenu ? (
    <div className="ov-menu-wrap" ref={menuRef}>
      <button
        type="button"
        className={cn("ov-edbtn ov-edbtn--icon", menuOpen && "is-on")}
        aria-label={localizeUi("chatInsights.activity.more")}
        title={localizeUi("chatInsights.activity.more")}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <MoreHorizontal size={16} />
      </button>
      {menuOpen ? (
        <div
          className="ov-menu"
          role="menu"
          onClick={(event) => {
            // Phones show the menu as a sheet; a tap on its backdrop closes it. Items close it
            // after their own click has run (React 19 commits a capture-phase close first).
            if (event.target === event.currentTarget) setMenuOpen(false);
            else if ((event.target as Element).closest("button")) window.setTimeout(() => setMenuOpen(false), 0);
          }}
        >
          {menuContent}
          {menu?.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={cn(item.danger && "is-danger")}
              onClick={() => item.onSelect()}
            >
              {item.icon}
              {localize(item.label)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  ) : null;
  const titleNode = onTitleChange ? (
    <input
      className="ov-edhead__title"
      value={title}
      placeholder={titlePlaceholder}
      onChange={(event) => onTitleChange(event.target.value)}
      aria-label={titlePlaceholder || localizeUi("connections.accounts.editor.name")}
    />
  ) : (
    <h1 className="ov-edhead__title">{title || titlePlaceholder}</h1>
  );
  const saveNode = save ? <OvSaveButton {...save} quiet={mobile} /> : null;
  // Phones: ‹ back, the name and ⋯ on the first line; the editor's buttons and Save on the next,
  // with Save always at the right end (on the first line when the editor has no buttons).
  const head = mobile ? (
    <header className={cn("ov-edhead ov-edhead--m", className)} data-component="OverhaulEditorHead">
      <div className="ov-edhead__top">
        <button
          type="button"
          className="ov-edhead__back"
          aria-label={localizeUi("ui.chat.scheduletimeline.value1Value2", {
            value1: localize("Back to"),
            value2: label,
          })}
          title={label}
          onClick={goBack}
        >
          <ChevronLeft size={26} aria-hidden="true" />
        </button>
        {lead ? <span className="ov-edhead__lead">{lead}</span> : null}
        {titleNode}
        {actions ? null : (
          <>
            {status}
            {saveNode}
          </>
        )}
        {menuNode}
      </div>
      {meta ? <p className="ov-edhead__meta">{meta}</p> : null}
      {actions ? (
        <div className="ov-edhead__bar">
          {actions}
          <span className="ov-edhead__gap" />
          {status}
          {saveNode}
        </div>
      ) : null}
      <OvDraftBar />
    </header>
  ) : (
    <header className={cn("ov-edhead", className)} data-component="OverhaulEditorHead">
      <EditorCrumbs items={trail} />
      <div className="ov-edhead__row">
        {lead ? <span className="ov-edhead__lead">{lead}</span> : null}
        {titleNode}
        {meta ? <span className="ov-edhead__meta">{meta}</span> : null}
        <div className="ov-edhead__actions">
          {actions}
          {status}
          {saveNode}
          {menuNode}
        </div>
      </div>
      <OvDraftBar />
    </header>
  );
  return slot ? createPortal(head, slot) : head;
}

/** The editors' one Save button: an "Unsaved changes" note while there are edits, then Save. */
export function OvSaveButton({
  dirty,
  onSave,
  saving,
  error,
  disabled,
  quiet,
}: OvEditorSave & {
  /** Phones: no "Unsaved changes" note; the Save button turning on says it. */
  quiet?: boolean;
}) {
  const { t } = useUiTranslation();
  const shortcut = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? "") ? "⌘S" : "Ctrl+S";
  return (
    <>
      {error || (!quiet && (dirty || saving)) ? (
        <span className={cn("ov-savestate", error ? "is-error" : "is-dirty")} role="status">
          {error
            ? t("ui.agents.agenteditor.saveFailed")
            : saving
              ? t("chat.settings.inlineEditor.saving")
              : t("editor.save.unsaved")}
        </span>
      ) : null}
      <button
        type="button"
        className={cn("ov-savebtn", dirty && "is-dirty")}
        // The editor shows its own save error; a rejected save must not surface as an uncaught error.
        onClick={() =>
          void Promise.resolve()
            .then(onSave)
            .catch(() => undefined)
        }
        disabled={!dirty || saving || disabled}
        title={`${t("ui.noodle.noodlehome.save")} (${shortcut})`}
        data-ov-save=""
      >
        <Save size={14} aria-hidden="true" />
        {dirty || saving ? t("ui.noodle.noodlehome.save") : t("chat.settings.inlineEditor.saved")}
      </button>
    </>
  );
}

export function OvEyebrow({
  children,
  aside,
  className,
}: {
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("ov-eyebrow", className)}>
      <span>{children}</span>
      {aside ? <small>{aside}</small> : null}
    </p>
  );
}

/** One label-left row: label (and an optional hint under it), then the control. */
export function OvRow({
  label,
  hint,
  children,
  top,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  /** Align the label with the top of a tall control. */
  top?: boolean;
}) {
  return (
    <div className={cn("ov-row", top && "is-top")}>
      <div className="ov-row__label">
        {label}
        {hint ? <small>{hint}</small> : null}
      </div>
      <div className="ov-row__control">{children}</div>
    </div>
  );
}
