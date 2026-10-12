import { useId, useLayoutEffect, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { CapabilityPackageVersionNote } from "@marinara-engine/shared";
import { NotableChangeMarker } from "./NotableChangeMarker";

/** One version's notes, cut to two lines until the user asks for the rest.
 *
 *  The More/Less button only exists while the text is really cut off, so a short note
 *  never grows a control that does nothing. `versionId` names the version heading so
 *  each More/Less button is told apart from its siblings by a screen reader. */
function ClampedNotes({ notes, versionId }: { notes: string; versionId: string }) {
  const { t: localizeUi } = useUiTranslation();
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  // Layout effect: measure before paint so the button is there on the first frame.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || open) return;
    const measure = () => setOverflowing(element.scrollHeight > element.clientHeight + 1);
    measure();
    // A resize can cut a note that fitted a moment ago; without this it would be hidden with no button.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [notes, open]);

  return (
    <>
      <p
        ref={ref}
        className={`mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--muted-foreground)] ${
          open ? "" : "line-clamp-2"
        }`}
      >
        {notes}
      </p>
      {(overflowing || open) && (
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-describedby={versionId}
          className="mt-1 rounded-md text-xs font-medium text-[var(--primary)] hover:underline"
        >
          {localizeUi(open ? "ui.agents.agentreleasenotelist.less" : "ui.agents.agentreleasenotelist.more")}
        </button>
      )}
    </>
  );
}

/** Version-by-version release notes for one Agent package, in the order given.
 *
 *  Shared by the catalog's Version history and the update dialog. `clamp` shortens each
 *  version's notes (update dialog, several versions); without it every note is shown in full.
 *
 *  Notes render as PLAIN TEXT — never markdown or HTML. The catalog URL is
 *  operator-configurable, so this is untrusted remote content. */
export function AgentReleaseNoteList({
  entries,
  clamp = false,
}: {
  entries: CapabilityPackageVersionNote[];
  clamp?: boolean;
}) {
  const baseId = useId();
  return (
    <ol className="space-y-3">
      {entries.map((entry) => {
        const versionId = `${baseId}-${entry.version}`;
        return (
          <li key={entry.version} className="border-l-2 border-[var(--border)] pl-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {entry.highlight && <NotableChangeMarker />}
              <span id={versionId} className="text-sm font-medium text-[var(--foreground)]">
                {entry.version}
              </span>
              <span className="text-xs text-[var(--muted-foreground)]">{entry.date}</span>
            </div>
            {clamp ? (
              <ClampedNotes notes={entry.notes} versionId={versionId} />
            ) : (
              <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--muted-foreground)]">
                {entry.notes}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
