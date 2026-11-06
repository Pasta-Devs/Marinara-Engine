// ──────────────────────────────────────────────
// NeedsModelChip — an agent or feature that cannot run without a kind of Model says so in one amber chip,
// with "Set up" opening the job's "Model for" window: pick any catalog model there, or Add account. It hides
// once the job has a Model, so every place that draws it (Agents panel, Chat Settings, Agent editor,
// generation windows) clears together.
// ──────────────────────────────────────────────
import { lazy, Suspense, useState, type SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import { agentRequiredConnection, parseAgentSettingsRecord, type ConnectionPickerKind } from "@marinara-engine/shared";
import { useConnections } from "../../hooks/use-connections";
import { openAddConnection } from "../../lib/add-connection";
import { isConnectionFlagTrue } from "../../lib/connection-filters";
import { JOBS, matchesKind } from "../../lib/connection-jobs";
import { cn } from "../../lib/utils";
import { WarningChip } from "./JobRow";
import type { ConnectionRowData } from "./ConnectionRow";
import { useSidecarStore } from "../../stores/sidecar.store";

// The picker pulls in the whole Jobs box; load it only when Set up is pressed.
const JobPickerWindow = lazy(() =>
  import("./ConnectionDefaults").then((module) => ({ default: module.JobPickerWindow })),
);

export type NeededKind = Exclude<ConnectionPickerKind, "all">;

/**
 * True while nothing would answer for `kind`: no Model the caller chose itself (`own`, such as an agent's
 * image connection) and no job default. Mirrors the server, which tries the agent's own Model, then the default.
 */
export function useNeedsModel(kind: NeededKind | null | undefined, own?: string | null) {
  const { data } = useConnections();
  // The built-in model can be Main without any row flag.
  const builtInMain = useSidecarStore((state) => state.config.useAsMainDefault);
  if (!kind || !data) return false;
  if (kind === "chat" && builtInMain) return false;
  const rows = (data as ConnectionRowData[]).filter(
    (row) => matchesKind(row, kind) && !isConnectionFlagTrue(row.profileImportReviewRequired),
  );
  const ownId = own?.trim();
  if (ownId && rows.some((row) => row.id === ownId)) return false;
  const flag = jobOf(kind).flag;
  return !rows.some((row) => isConnectionFlagTrue(flag && row[flag]));
}

/** The job whose default answers for a kind: Main for chat, else the kind's own job. */
const jobOf = (kind: NeededKind) => JOBS.find((entry) => entry.kind === kind)!;

export function NeedsModelChip({
  kind,
  own,
  className,
}: {
  kind: NeededKind | null | undefined;
  own?: string | null;
  className?: string;
}) {
  const { t } = useTranslation();
  const needed = useNeedsModel(kind, own);
  const [picking, setPicking] = useState(false);
  // An open picker stays open after its pick sets the job, so its "If it fails" slot is still reachable.
  if (!kind || (!needed && !picking)) return null;
  const job = jobOf(kind);
  // The chip sits inside draggable cards; presses on it or its picker (a portal) must not start a drag.
  const stop = (event: SyntheticEvent) => event.stopPropagation();
  return (
    <span
      className={cn("inline-flex min-w-0 flex-wrap items-center gap-1.5", className)}
      onMouseDown={stop}
      onTouchStart={stop}
      onPointerDown={stop}
      onDragStart={stop}
      onClick={stop}
    >
      {needed && (
        <>
          <WarningChip>{t(`connections.needsModel.${kind}`)}</WarningChip>
          <button
            type="button"
            className="text-[0.625rem] font-medium text-[var(--primary)] hover:underline focus-visible:underline focus-visible:outline-none"
            onClick={(event) => {
              event.stopPropagation();
              // Decision has its own setup window; every other job opens its picker.
              if (job.key === "decision") openAddConnection({ job: job.key });
              else setPicking(true);
            }}
          >
            {t("connections.defaults.setUp")}
          </button>
        </>
      )}
      {picking && (
        <Suspense fallback={null}>
          <JobPickerWindow job={job} onClose={() => setPicking(false)} />
        </Suspense>
      )}
    </span>
  );
}

/** What an agent needs before it can run, and the Model it picked itself, from its saved settings. */
export function agentModelNeed(agentType: string, settings: unknown) {
  const record = parseAgentSettingsRecord(settings);
  const kind = agentRequiredConnection(agentType, record);
  if (!kind) return null;
  // Agents keep their own image Model in imageConnectionId; other kinds have no per-agent pick yet.
  const own = kind === "image" && typeof record.imageConnectionId === "string" ? record.imageConnectionId : null;
  return { kind, own };
}
