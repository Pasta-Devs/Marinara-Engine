import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { CapabilityPackageUpdate } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { NotableChangeMarker } from "./NotableChangeMarker";

/** Prompt shown when installed Agent packages have compatible updates waiting.
 *
 *  Replaces a plain confirm dialog because release notes cannot travel through
 *  `showConfirmDialog` — that store carries a single `message` string, which is why
 *  the old prompt faked a list with bullet characters and newlines.
 *
 *  Notes are collapsed by default and render as PLAIN TEXT. `MARINARA_AGENT_CATALOG_URL`
 *  is operator-configurable, so notes are untrusted remote content and must never be
 *  parsed as markdown or HTML here.
 *
 *  `releaseHighlight` marks a version the publisher says the user will notice. It is a
 *  reading cue, not a recommendation: the primary action still updates everything, so
 *  a routine bugfix release does not have to compete for attention with a real change. */
export function AgentUpdateDialog({
  open,
  updates,
  busy,
  onUpdateAll,
  onNotNow,
}: {
  open: boolean;
  updates: CapabilityPackageUpdate[];
  busy: boolean;
  onUpdateAll: () => void;
  onNotNow: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const anyHighlighted = updates.some((update) => update.releaseHighlight);

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <Modal
      open={open}
      onClose={onNotNow}
      title={localizeUi("ui.agents.agentupdatedialog.agentUpdatesAvailable")}
      width="max-w-lg"
      chatFloatingPanel
      closeDisabled={busy}
    >
      <div className="space-y-4">
        <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
          {updates.map((update) => {
            const isOpen = expanded.has(update.id);
            return (
              <li key={update.id} className="rounded-lg ring-1 ring-[var(--border)]">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
                  {update.releaseHighlight && <NotableChangeMarker />}
                  <span className="text-sm font-medium text-[var(--foreground)]">{update.name}</span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {update.installedVersion} → {update.version}
                  </span>
                  {update.restartRequired && (
                    <span className="mari-chrome-tag text-[10px] uppercase tracking-wide">
                      {localizeUi("ui.agents.agentupdatedialog.restartRequired")}
                    </span>
                  )}
                  {update.releaseNotes && (
                    <button
                      type="button"
                      onClick={() => toggle(update.id)}
                      aria-expanded={isOpen}
                      className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    >
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      {localizeUi("ui.agents.agentupdatedialog.whatChanged")}
                    </button>
                  )}
                </div>
                {update.releaseNotes && isOpen && (
                  <p className="whitespace-pre-wrap break-words border-t border-[var(--border)] px-3 py-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                    {update.releaseNotes}
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        {anyHighlighted && (
          <p className="text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.agents.agentupdatedialog.dotLegend")}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onNotNow}
            disabled={busy}
            className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-60"
          >
            {localizeUi("ui.agents.agentupdatedialog.notNow")}
          </button>
          <button
            type="button"
            onClick={onUpdateAll}
            disabled={busy}
            className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--primary)]/85 disabled:opacity-60"
          >
            {localizeUi("ui.agents.agentupdatedialog.updateAll")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
