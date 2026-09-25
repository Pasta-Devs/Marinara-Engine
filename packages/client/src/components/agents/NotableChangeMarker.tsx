import { useTranslation as useUiTranslation } from "react-i18next";

/** The dot beside a version the publisher flagged as a change the user will notice.
 *
 *  One component rather than one per surface, so the visual style and the accessible
 *  name cannot drift apart. It means "read this first", not "install this": the
 *  update prompt's primary action applies everything either way. */
export function NotableChangeMarker() {
  const { t: localizeUi } = useUiTranslation();
  const label = localizeUi("ui.agents.notablechangemarker.notableChange");
  return (
    <>
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" title={label} />
      <span className="sr-only">{label}</span>
    </>
  );
}
