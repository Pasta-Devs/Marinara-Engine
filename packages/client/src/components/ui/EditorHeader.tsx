// ──────────────────────────────────────────────
// The header of a full-page editor: Back, icon tile, name, optional section tabs, actions and Close.
// ──────────────────────────────────────────────
import type { ReactNode } from "react";
import { Save } from "lucide-react";
import { cn } from "../../lib/utils";
import { SurfaceBackButton } from "./SurfaceBackButton";
import { SurfaceCloseButton } from "./SurfaceCloseButton";

interface EditorHeaderProps {
  /** Editors pass their save-and-leave handler; omitted, Back closes the top surface. */
  onBack?: () => void;
  /** Disables Back and Close while a save or upload runs. */
  busy?: boolean;
  /** What the icon tile shows: an icon, or the item's picture. */
  icon?: ReactNode;
  /** Extra classes for the tile, such as a panel gradient. */
  iconClassName?: string;
  /** Replaces the icon tile with the editor's own, such as the card editors' avatar upload. */
  tile?: ReactNode;
  /** The name: the editor's name field (`mari-editor-title-input`) or a heading (`mari-editor-title`). */
  title: ReactNode;
  /** A short line under the name. */
  meta?: ReactNode;
  /** Section tabs (`EditorTabNavigation`). With tabs, the phone density rules apply; without, the actions wrap to
   *  a row of their own on phones. */
  nav?: ReactNode;
  /** Save, status and the editor's own buttons (`EditorSaveButton`, `EditorHeaderAction`). */
  actions?: ReactNode;
  /** Header variants, such as the card editors' `mari-editor-header--card`. */
  className?: string;
  /** Classes for the Back/tile/name group (with tabs only), such as `mari-editor-header-main--identity`. */
  mainClassName?: string;
}

/**
 * One header for every full-page editor, so a header change is made once. The rows are slots: the editor keeps its
 * own name field and buttons, the header owns the frame and its two layouts.
 */
export function EditorHeader({
  onBack,
  busy = false,
  icon,
  iconClassName,
  tile,
  title,
  meta,
  nav,
  actions,
  className,
  mainClassName,
}: EditorHeaderProps) {
  const withNav = nav !== undefined;
  const identity = (
    <>
      <SurfaceBackButton
        onClick={onBack}
        disabled={busy}
        className="mari-editor-action inline-flex disabled:cursor-not-allowed disabled:opacity-50"
      />
      {tile ?? <div className={cn("mari-editor-icon-tile", iconClassName)}>{icon}</div>}
      {meta === undefined ? (
        title
      ) : (
        <div className="min-w-0 flex-1">
          {title}
          <p className="mari-editor-meta">{meta}</p>
        </div>
      )}
    </>
  );
  return (
    <div className={cn("mari-editor-header", withNav && "mari-editor-header--with-nav", className)}>
      {/* With tabs, the density rules size this group against the tabs. Without, its parts sit in the header row
          itself, so on phones Close stays beside the name while the actions wrap below. */}
      {withNav ? <div className={cn("mari-editor-header-main", mainClassName)}>{identity}</div> : identity}
      {nav}
      {actions && (
        <div
          className={cn(
            "mari-editor-actions flex",
            !withNav &&
              "max-md:order-2 max-md:w-full max-md:justify-end max-md:border-t max-md:border-[var(--marinara-editor-divider)] max-md:pt-2",
          )}
        >
          {actions}
        </div>
      )}
      <SurfaceCloseButton disabled={busy} dividerClassName={withNav ? "" : "max-md:hidden"} />
    </div>
  );
}

/** The editor's Save button. The label hides where the header runs out of room (see `globals.css`). */
export function EditorSaveButton({
  label,
  ariaLabel = label,
  onClick,
  disabled,
  className,
}: {
  label: string;
  /** A fuller name for screen readers and the tooltip, such as "Save tool". Starts with the visible label. */
  ariaLabel?: string;
  onClick: () => void;
  disabled?: boolean;
  /** Replaces the default classes (the card editors add `mari-editor-action--save`). */
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className ?? "mari-editor-action mari-editor-action--primary inline-flex disabled:opacity-50"}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <Save size="0.8125rem" />
      <span className="mari-editor-save-label">{label}</span>
    </button>
  );
}

/** An icon button in the header. `label` is both its tooltip and its accessible name. */
export function EditorHeaderAction({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mari-editor-action inline-flex disabled:opacity-50"
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}
