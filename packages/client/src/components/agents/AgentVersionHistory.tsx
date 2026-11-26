import { useTranslation as useUiTranslation } from "react-i18next";
import { useCapabilityPackageReleaseNotes } from "../../hooks/use-capability-packages";
import { AgentReleaseNoteList } from "./AgentReleaseNoteList";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

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
  const [expanded, setExpanded] = useState(false);
  const { data } = useCapabilityPackageReleaseNotes(packageId);
  const entries = data ?? [];
  if (entries.length === 0) return null;

  return (
    <section>
      <h3 className="text-sm font-semibold">{localizeUi("ui.agents.agentversionhistory.versionHistory")}</h3>
      <div className="mt-3">
        <AgentReleaseNoteList entries={expanded ? entries : entries.slice(0, 3)} />
      </div>
      {entries.length > 3 && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--primary)] hover:underline"
        >
          {expanded ? <ChevronUp size="1rem" aria-hidden="true" /> : <ChevronDown size="1rem" aria-hidden="true" />}
          {localizeUi(expanded ? "ui.agents.agentversionhistory.showLess" : "ui.agents.agentversionhistory.showOlder")}
        </button>
      )}
    </section>
  );
}
