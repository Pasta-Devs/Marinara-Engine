import { useTranslation as useUiTranslation } from "react-i18next";
import { useCapabilityPackageReleaseNotes } from "../../hooks/use-capability-packages";
import { NotableChangeMarker } from "./NotableChangeMarker";

/** Version history for one Agent package, newest first.
 *
 *  Renders nothing at all when the catalog publishes no notes for this package. A
 *  list of "no notes provided" rows reads as broken software, so versions without
 *  notes are omitted rather than shown empty.
 *
 *  Notes render as PLAIN TEXT — never markdown or HTML. The catalog URL is
 *  operator-configurable, so this is untrusted remote content. */
export function AgentVersionHistory({ packageId }: { packageId: string }) {
  const { t: localizeUi } = useUiTranslation();
  const { data } = useCapabilityPackageReleaseNotes(packageId);
  const entries = data ?? [];
  if (entries.length === 0) return null;

  return (
    <section>
      <h3 className="text-sm font-semibold">{localizeUi("ui.agents.agentversionhistory.versionHistory")}</h3>
      <ol className="mt-3 space-y-3">
        {entries.map((entry) => (
          <li key={entry.version} className="border-l-2 border-[var(--border)] pl-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {entry.highlight && <NotableChangeMarker />}
              <span className="text-sm font-medium text-[var(--foreground)]">{entry.version}</span>
              <span className="text-xs text-[var(--muted-foreground)]">{entry.date}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--muted-foreground)]">
              {entry.notes}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
