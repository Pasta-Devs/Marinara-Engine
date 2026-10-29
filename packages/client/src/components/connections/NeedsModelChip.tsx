// ──────────────────────────────────────────────
// NeedsModelChip — an agent or feature that cannot run without a kind of Model says so in one amber chip,
// with "Set up" opening the Add window on the matching job. It hides once the job has a Model, so every
// place that draws it (Agents panel, Chat Settings, Agent editor, generation windows) clears together.
// ──────────────────────────────────────────────
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { agentRequiredConnection, parseAgentSettingsRecord, type ConnectionPickerKind } from "@marinara-engine/shared";
import { useConnections } from "../../hooks/use-connections";
import { openAddConnection } from "../../lib/add-connection";
import { isConnectionFlagTrue } from "../../lib/connection-filters";
import { JOBS, matchesKind } from "../../lib/connection-jobs";
import { cn } from "../../lib/utils";
import type { ConnectionRowData } from "./ConnectionRow";

export type NeededKind = Exclude<ConnectionPickerKind, "all">;

/** The amber warning chip. JobRow draws it for a job's warning too. */
export function WarningChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[0.625rem] text-amber-500",
        className,
      )}
    >
      <AlertTriangle size="0.625rem" aria-hidden className="shrink-0" />
      <span className="whitespace-nowrap">{children}</span>
    </span>
  );
}

/**
 * True while nothing would answer for `kind`: no Model the caller chose itself (`own`, such as an agent's
 * image connection) and no job default. Mirrors the server, which tries the agent's own Model, then the default.
 */
export function useNeedsModel(kind: NeededKind | null | undefined, own?: string | null) {
  const { data } = useConnections();
  if (!kind || !data) return false;
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
  if (!kind || !needed) return null;
  return (
    <span className={cn("inline-flex min-w-0 flex-wrap items-center gap-1.5", className)}>
      <WarningChip>{t(`connections.needsModel.${kind}`)}</WarningChip>
      <button
        type="button"
        className="text-[0.625rem] font-medium text-[var(--primary)] hover:underline focus-visible:underline focus-visible:outline-none"
        onClick={(event) => {
          event.stopPropagation();
          openAddConnection({ job: jobOf(kind).key });
        }}
      >
        {t("connections.defaults.setUp")}
      </button>
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
