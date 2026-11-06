// ──────────────────────────────────────────────
// UI overhaul: shared pieces for the Library editors (v1 frames)
//
// A title row (crumbs, big title, a short meta line, actions on the right),
// eyebrow section headings with a rule, and label-left form rows. The
// Connection, Regex and Agent editors are built from these.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "../../lib/utils";
import { openLibrarySection } from "./library-navigation";
import { useOverhaulMobile, type LibrarySection } from "../../stores/overhaul.store";
import { MobileBackCrumb } from "./EditorRail";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";

export function OvEditorHead({
  section,
  sectionLabel,
  title,
  onTitleChange,
  titlePlaceholder,
  meta,
  status,
  actions,
  menu,
}: {
  section: LibrarySection;
  sectionLabel: string;
  title: string;
  onTitleChange?: (next: string) => void;
  titlePlaceholder?: string;
  meta?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  /** Items for the ⋯ menu. */
  menu?: Array<{ label: string; onSelect: () => void; danger?: boolean; disabled?: boolean }>;
}) {
  const { t: localizeUi } = useUiTranslation();
  const localize = useLocalizedUiText();
  const mobile = useOverhaulMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);
  return (
    <header className="ov-edhead">
      {mobile ? (
        <MobileBackCrumb label={sectionLabel} onBack={() => openLibrarySection(section)} />
      ) : (
        <nav className="ov-edhead__crumbs" aria-label={localizeUi("ui.overhaul.oveditorhead.breadcrumb")}>
          <button type="button" onClick={() => openLibrarySection(section)}>
            {localizeUi("ui.overhaul.oveditorhead.library")}
          </button>
          <ChevronRight size={12} aria-hidden="true" />
          <button type="button" onClick={() => openLibrarySection(section)}>
            {sectionLabel}
          </button>
          <ChevronRight size={12} aria-hidden="true" />
          <span>{title || titlePlaceholder}</span>
        </nav>
      )}
      <div className="ov-edhead__row">
        {onTitleChange ? (
          <input
            className="ov-edhead__title"
            value={title}
            placeholder={titlePlaceholder}
            onChange={(event) => onTitleChange(event.target.value)}
            aria-label={localizeUi("connections.accounts.editor.name")}
          />
        ) : (
          <h1 className="ov-edhead__title">{title || titlePlaceholder}</h1>
        )}
        {meta ? <span className="ov-edhead__meta">{meta}</span> : null}
        <div className="ov-edhead__actions">
          {status}
          {actions}
          {menu?.length ? (
            <div className="ov-menu-wrap" ref={menuRef}>
              <button
                type="button"
                className="ov-edbtn ov-edbtn--icon"
                aria-label={localizeUi("chatInsights.activity.more")}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <MoreHorizontal size={15} />
              </button>
              {menuOpen ? (
                <div
                  className="ov-menu"
                  role="menu"
                  onClick={(event) => {
                    // Phones show the menu as a sheet; a tap on its backdrop closes it.
                    if (event.target === event.currentTarget) setMenuOpen(false);
                  }}
                >
                  {menu.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      role="menuitem"
                      disabled={item.disabled}
                      className={cn(item.danger && "is-danger")}
                      onClick={() => {
                        setMenuOpen(false);
                        item.onSelect();
                      }}
                    >
                      {localize(item.label)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function OvSaveState({ dirty, saving, error }: { dirty: boolean; saving?: boolean; error?: boolean }) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <span className={cn("ov-savestate", error ? "is-error" : dirty ? "is-dirty" : "is-saved")}>
      {error
        ? localizeUi("ui.agents.agenteditor.saveFailed")
        : saving
          ? localizeUi("chat.settings.inlineEditor.saving")
          : dirty
            ? localizeUi("ui.agents.agenteditor.unsaved")
            : localizeUi("chat.settings.inlineEditor.saved")}
    </span>
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
