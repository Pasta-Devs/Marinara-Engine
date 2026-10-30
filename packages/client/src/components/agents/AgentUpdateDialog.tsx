import { useState } from "react";
import { ArrowUpRight, Check, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { CapabilityPackageUpdate } from "@marinara-engine/shared";
import { useCapabilityCatalog } from "../../hooks/use-capability-packages";
import { cn } from "../../lib/utils";
import { Modal } from "../ui/Modal";
import { AgentArtwork } from "./AgentArtwork";
import { AgentReleaseNoteList } from "./AgentReleaseNoteList";
import { NotableChangeMarker } from "./NotableChangeMarker";
import { taglineOf } from "./organizer/organizer-model";

export type AgentUpdatePhase = "ask" | "running" | "done";
export type AgentUpdateResult =
  { status: "running" } | { status: "updated"; restartRequired: boolean } | { status: "failed"; error: string };

/** Prompt shown when installed Agent packages have compatible updates waiting.
 *
 *  The user picks which updates to apply; unpicked ones count as "Not now". While the
 *  run is going, and after it, each row shows its own result, so one failure never
 *  hides the others. A failed row keeps its error and a Retry.
 *
 *  Notes render as PLAIN TEXT. `MARINARA_AGENT_CATALOG_URL` is operator-configurable,
 *  so notes are untrusted remote content and must never be parsed as markdown or HTML.
 *  `releaseHighlight` marks a version the publisher says the user will notice. */
export function AgentUpdateDialog({
  open,
  updates,
  selected,
  phase,
  results,
  onToggle,
  onUpdate,
  onNotNow,
  onRetry,
  onClose,
  onRestart,
  onShowInOrganizer,
}: {
  open: boolean;
  updates: CapabilityPackageUpdate[];
  selected: ReadonlySet<string>;
  phase: AgentUpdatePhase;
  results: Readonly<Record<string, AgentUpdateResult>>;
  onToggle: (id: string) => void;
  onUpdate: () => void;
  onNotNow: () => void;
  onRetry: (id: string) => void;
  onClose: () => void;
  /** Present when an applied update needs a restart. */
  onRestart?: () => void;
  onShowInOrganizer: (id: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const catalog = useCapabilityCatalog();
  const [expanded, setExpanded] = useState<string | null>(null);
  const entryById = new Map((catalog.data?.packages ?? []).map((entry) => [entry.manifest.id, entry]));
  const anyHighlighted = updates.some((update) => update.releaseHighlight);
  const running = phase === "running";
  const done = phase === "done";
  const values = Object.values(results);
  const updated = values.filter((result) => result.status === "updated").length;
  const failed = values.filter((result) => result.status === "failed").length;
  const restartNames = updates
    .filter((update) => {
      const result = results[update.id];
      return result?.status === "updated" && result.restartRequired;
    })
    .map((update) => update.name);

  const summary = done
    ? [
        updated > 0 && localizeUi("ui.agents.agentupdatedialog.updatedCount", { count: updated }),
        failed > 0 && localizeUi("ui.agents.agentupdatedialog.failedCount", { count: failed }),
        restartNames.length > 0 &&
          localizeUi("ui.agents.agentupdatedialog.namesNeedRestart", {
            names: restartNames.join(", "),
            count: restartNames.length,
          }),
      ]
    : [
        localizeUi("ui.agents.agentupdatedialog.updateCount", { count: updates.length }),
        updates.some((update) => update.restartRequired) &&
          localizeUi("ui.agents.agentupdatedialog.restartCount", {
            count: updates.filter((update) => update.restartRequired).length,
          }),
      ];

  return (
    <Modal
      open={open}
      onClose={done ? onClose : onNotNow}
      title={localizeUi(
        done ? "ui.agents.agentupdatedialog.agentUpdatesFinished" : "ui.agents.agentupdatedialog.agentUpdatesAvailable",
      )}
      width="max-w-lg"
      chatFloatingPanel
      closeDisabled={running}
    >
      <div className="space-y-3">
        <p className="text-xs text-[var(--muted-foreground)]" role="status" aria-live="polite">
          {summary.filter(Boolean).join(" · ")}
        </p>
        <ul className="max-h-[55vh] space-y-2 overflow-y-auto">
          {updates.map((update) => {
            const entry = entryById.get(update.id);
            const result = results[update.id];
            const notes = update.releaseNotes ?? [];
            const isOpen = expanded === update.id;
            const isSelected = selected.has(update.id);
            const skipped = phase !== "ask" && !result;
            const checkboxId = `agent-update-${update.id}`;
            return (
              <li
                key={update.id}
                className={cn(
                  "rounded-[10px] border border-[var(--border)] px-3 py-2.5 transition-opacity",
                  (skipped || (phase === "ask" && !isSelected)) && "opacity-60",
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-lg">
                    <AgentArtwork
                      imageUrl={entry?.store?.iconUrl ?? entry?.iconUrl}
                      alt={localizeUi("ui.agents.agentcatalogview.value1Artwork", { value1: update.name })}
                      iconSize="1rem"
                    />
                  </span>
                  <label htmlFor={checkboxId} className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      {update.releaseHighlight && <NotableChangeMarker />}
                      <span className="text-sm font-semibold text-[var(--foreground)]">{update.name}</span>
                      {update.restartRequired && (
                        <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                          {localizeUi("ui.agents.agentupdatedialog.restartTag")}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--muted-foreground)]">
                      {update.installedVersion} →{" "}
                      <span className="font-medium text-[var(--foreground)]">{update.version}</span>
                      {entry && ` · ${taglineOf(entry)}`}
                    </span>
                  </label>
                  {phase === "ask" ? (
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggle(update.id)}
                      className="mt-1 h-5 w-5 shrink-0 accent-[var(--primary)]"
                    />
                  ) : skipped ? (
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {localizeUi("ui.agents.agentupdatedialog.skipped")}
                    </span>
                  ) : (
                    <AgentUpdateStatus result={result} />
                  )}
                </div>
                {result?.status === "failed" && (
                  <AgentUpdateFailure error={result.error} disabled={running} onRetry={() => onRetry(update.id)} />
                )}
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pl-[46px] [&>button]:whitespace-nowrap">
                  {notes.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : update.id)}
                      aria-expanded={isOpen}
                      className="flex items-center gap-1 rounded-md text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    >
                      {isOpen ? (
                        <ChevronDown size="0.8rem" aria-hidden="true" />
                      ) : (
                        <ChevronRight size="0.8rem" aria-hidden="true" />
                      )}
                      {localizeUi("ui.agents.agentupdatedialog.whatsNewCount", { count: notes.length })}
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    disabled={running}
                    onClick={() => onShowInOrganizer(update.id)}
                    className="flex items-center gap-1 rounded-md text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    {localizeUi("ui.agents.agentupdatedialog.seeInOrganizer")}
                    <ArrowUpRight size="0.75rem" aria-hidden="true" />
                  </button>
                </div>
                {notes.length > 0 && isOpen && (
                  <div className="mt-2 ml-[46px] rounded-lg bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] px-3 py-2">
                    <AgentReleaseNoteList entries={notes} clamp={notes.length > 1} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-3">
          {anyHighlighted && phase === "ask" && (
            <p className="mr-auto flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[var(--primary)]" />
              {localizeUi("ui.agents.notablechangemarker.notableChange")}
            </p>
          )}
          {done ? (
            <>
              <button type="button" onClick={onClose} className="mari-chrome-control h-9 px-3 text-sm font-semibold">
                {localizeUi("ui.agents.agentupdatedialog.close")}
              </button>
              {onRestart && (
                <button
                  type="button"
                  onClick={onRestart}
                  className="mari-chrome-control mari-chrome-control--primary h-9 px-3 text-sm font-semibold"
                >
                  {localizeUi("ui.agents.agentupdatedialog.restartNow")}
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onNotNow}
                disabled={running}
                className="mari-chrome-control h-9 px-3 text-sm font-semibold"
              >
                {localizeUi("ui.agents.agentupdatedialog.notNow")}
              </button>
              <button
                type="button"
                onClick={onUpdate}
                disabled={running || selected.size === 0}
                className="mari-chrome-control mari-chrome-control--primary h-9 gap-1.5 px-3 text-sm font-semibold"
              >
                {running && <Loader2 size="0.85rem" className="animate-spin" aria-hidden="true" />}
                {selected.size === updates.length
                  ? localizeUi("ui.agents.agentupdatedialog.updateAll")
                  : localizeUi("ui.agents.agentupdatedialog.updateSome", {
                      count: selected.size,
                      total: updates.length,
                    })}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** One update's state in a run; no result yet means it is still queued. */
export function AgentUpdateStatus({ result }: { result: AgentUpdateResult | undefined }) {
  const { t: localizeUi } = useUiTranslation();
  if (result?.status === "running") {
    return (
      <span className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
        <Loader2 size="0.85rem" className="animate-spin" aria-hidden="true" />
        {localizeUi("ui.agents.agentupdatedialog.updating")}
      </span>
    );
  }
  if (result?.status === "updated") {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-500">
        <Check size="0.85rem" aria-hidden="true" />
        {localizeUi("ui.agents.agentupdatedialog.updated")}
      </span>
    );
  }
  if (result?.status === "failed") {
    return (
      <span className="text-xs font-semibold text-red-500">{localizeUi("ui.agents.agentupdatedialog.failed")}</span>
    );
  }
  return (
    <span className="text-xs text-[var(--muted-foreground)]">{localizeUi("ui.agents.agentupdatedialog.waiting")}</span>
  );
}

/** A failed update's error with a Retry button. */
export function AgentUpdateFailure({
  error,
  disabled,
  onRetry,
}: {
  error: string;
  disabled: boolean;
  onRetry: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2">
      <p className="min-w-0 flex-1 text-xs text-red-500">{error}</p>
      <button
        type="button"
        disabled={disabled}
        onClick={onRetry}
        className="mari-chrome-control h-7 shrink-0 px-2.5 text-xs font-semibold"
      >
        {localizeUi("ui.agents.agentupdatedialog.retry")}
      </button>
    </div>
  );
}
