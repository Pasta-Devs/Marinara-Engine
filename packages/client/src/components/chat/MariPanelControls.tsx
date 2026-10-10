import { type ReactNode, useEffect, useRef } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { ChevronLeft, Search, X } from "lucide-react";

import { type MariPanelSortMode } from "../../stores/ui.store";

/**
 * Shared controls for Professor Mari's management panels (Skills, Memories, and
 * the chat history list). The panels themselves are lazy, but the parent uses
 * the sort control too, so it stays in the eager chunk.
 */

// #4868: client-side sort for the Skills/Memories panels. Deliberately keyed on name or
// createdAt, never updatedAt, so saving or toggling a row does NOT reorder it (which used to
// snap the open editor out of view). Persistent memories are pinned above the rest by the caller.
export function compareMariPanelItems(
  a: { name: string; createdAt: string },
  b: { name: string; createdAt: string },
  mode: MariPanelSortMode,
): number {
  switch (mode) {
    case "za":
      return b.name.localeCompare(a.name);
    case "newest":
      return String(b.createdAt).localeCompare(String(a.createdAt));
    case "oldest":
      return String(a.createdAt).localeCompare(String(b.createdAt));
    default:
      return a.name.localeCompare(b.name);
  }
}

const MARI_PANEL_SORT_OPTIONS: MariPanelSortMode[] = ["az", "za", "newest", "oldest"];

export function MariPanelSortSelect({
  value,
  onChange,
}: {
  value: MariPanelSortMode;
  onChange: (mode: MariPanelSortMode) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const labels: Record<MariPanelSortMode, string> = {
    az: localizeUi("ui.chat.homeprofessormarichat.sortAToZ"),
    za: localizeUi("ui.chat.homeprofessormarichat.sortZToA"),
    newest: localizeUi("ui.chat.homeprofessormarichat.sortNewest"),
    oldest: localizeUi("ui.chat.homeprofessormarichat.sortOldest"),
  };
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as MariPanelSortMode)}
      aria-label={localizeUi("ui.chat.homeprofessormarichat.sortLabel")}
      title={localizeUi("ui.chat.homeprofessormarichat.sortLabel")}
      className="h-9 shrink-0 rounded-[0.65rem] border border-[var(--mari-hairline)] bg-[var(--mari-group-bg)] px-1.5 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/55"
    >
      {MARI_PANEL_SORT_OPTIONS.map((mode) => (
        <option key={mode} value={mode}>
          {labels[mode]}
        </option>
      ))}
    </select>
  );
}

/** Draft shape for the Skills panel editor. */
export type SkillDraftState = {
  name: string;
  description: string;
  content: string;
};

// #4851: draft for the Memories panel. `enabled` and `persistent` are toggled directly
// on the row/editor (not staged in the draft); name/description/content save together.
export type MemoryDraftState = {
  name: string;
  description: string;
  content: string;
};

/** M6: one row of a side panel, on Mari's direction A `.mari-edit` group. */
export const MARI_SIDE_ROW_CLASS = "mari-edit__row flex min-h-12 items-center gap-3 px-3 py-2";

/**
 * M6: the one header every side panel (Chats, Skills, Memories, Aware of) shares: title, a
 * one-line hint and Close; on a phone, where the panel is a full sheet, Back instead. `onBack` is a
 * panel's own sub-view back (it then shows at every width). On open, the panel's first control takes
 * focus; on close, focus returns to its opener.
 */
export function MariSidePanelHeader({
  title,
  hint,
  onClose,
  closeLabel,
  onBack,
  backLabel,
  actions,
}: {
  title: string;
  hint?: string;
  onClose: () => void;
  closeLabel: string;
  onBack?: () => void;
  backLabel?: string;
  actions?: ReactNode;
}) {
  const { t: localizeUi } = useUiTranslation();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = ref.current?.parentElement;
    const controls = panel?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), select:not([disabled])",
    );
    Array.from(controls ?? [])
      .find((control) => control.offsetParent !== null)
      ?.focus();
    // Closed with Escape or Close: focus goes back to the destination that opened it, so the next
    // Escape still reaches the omnibar. Closed by a click somewhere else: leave focus there.
    return () => {
      const active = document.activeElement;
      if (!active || active === document.body || panel?.contains(active)) {
        if (opener?.isConnected) opener.focus();
      }
    };
  }, []);
  return (
    <div ref={ref} className="mari-side-head">
      <button
        type="button"
        onClick={onBack ?? onClose}
        className="mari-omnibar-header-menu__trigger mari-side-head__back"
        data-sub={onBack ? "true" : undefined}
        aria-label={backLabel ?? localizeUi("ui.chat.homeprofessormarichat.sidePanelBack")}
      >
        <ChevronLeft size="1rem" aria-hidden="true" />
      </button>
      <div className="mari-side-head__text">
        <h3 className="mari-side-head__title">{title}</h3>
        {hint ? <p className="mari-side-head__hint">{hint}</p> : null}
      </div>
      {actions}
      <button
        type="button"
        onClick={onClose}
        className="mari-omnibar-header-menu__trigger mari-side-head__close"
        aria-label={closeLabel}
        title={closeLabel}
      >
        <X size="0.95rem" aria-hidden="true" />
      </button>
    </div>
  );
}

/** M6: the side panels' search field. */
export function MariSideSearch({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <label className="mari-side-search">
      <Search size="0.875rem" aria-hidden="true" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={label} aria-label={label} />
    </label>
  );
}
