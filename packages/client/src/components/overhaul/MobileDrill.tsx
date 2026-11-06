// ──────────────────────────────────────────────
// New layout on phones and tablets: drill-in rows for editors
//
// On desktop a drill renders its children in place. On phones it renders a
// row (icon, title, short summary, chevron); tapping it opens the children as
// a page of their own with a ‹ back button. While a page is open, everything
// else inside the nearest `.ovm-drill-scope` is hidden (see overhaul-mobile.css),
// so the page fills the editor.
// ──────────────────────────────────────────────
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useOverhaulMobile } from "../../stores/overhaul.store";
import { useTranslation as useUiTranslation } from "react-i18next";

export function OvmDrill({
  title,
  summary,
  icon,
  children,
  className,
}: {
  title: string;
  /** What's set, in a few words, shown on the row. */
  summary?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const mobile = useOverhaulMobile();
  const [open, setOpen] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Opening shows the page from its top; going back returns to the row.
  useLayoutEffect(() => {
    if (open) pageRef.current?.scrollIntoView({ block: "start" });
    else if (wasOpen.current) rowRef.current?.scrollIntoView({ block: "center" });
    wasOpen.current = open;
  }, [open]);

  if (!mobile) return <>{children}</>;
  if (!open) {
    return (
      <button ref={rowRef} type="button" className="ovm-drill-row" onClick={() => setOpen(true)}>
        {icon ? <span className="ovm-drill-row__icon">{icon}</span> : null}
        <span className="ovm-drill-row__title">{title}</span>
        {summary ? <span className="ovm-drill-row__value">{summary}</span> : null}
        <ChevronRight size={16} className="ovm-drill-row__chev" aria-hidden="true" />
      </button>
    );
  }
  return (
    <div ref={pageRef} className={className ? `ovm-drill-page ${className}` : "ovm-drill-page"}>
      <div className="ovm-drill-page__head">
        <button
          type="button"
          className="ovm-drill-page__back"
          aria-label={localizeUi("characters.bulkTags.back")}
          onClick={() => setOpen(false)}
        >
          <ChevronLeft size={26} aria-hidden="true" />
        </button>
        <span className="ovm-drill-page__title">{title}</span>
        <span aria-hidden="true" />
      </div>
      <div className="ovm-drill-page__body">{children}</div>
    </div>
  );
}

/** A small group heading between drill rows; phones only. */
export function OvmDrillGroup({ label }: { label: string }) {
  const mobile = useOverhaulMobile();
  if (!mobile) return null;
  return <p className="ovm-drill-group">{label}</p>;
}
