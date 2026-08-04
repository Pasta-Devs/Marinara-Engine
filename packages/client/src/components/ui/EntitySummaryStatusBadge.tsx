import { useEffect, useState } from "react";
import { Bot, CircleHelp, PenLine, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  getEntitySummaryStatus,
  type EntitySummaryStatus,
  type EntitySummaryStatusInput,
} from "../../lib/entity-summary-status";
import { cn } from "../../lib/utils";

export function EntitySummaryStatusBadge({
  input,
  className,
}: {
  input: EntitySummaryStatusInput;
  className?: string;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<EntitySummaryStatus | null>(null);

  const projectionJson = input.projection === undefined ? undefined : JSON.stringify(input.projection);
  const {
    entitySummary,
    entitySummaryContentHash,
    entitySummaryProjectionVersion,
    entitySummarySource,
    currentContentHash,
  } = input;
  useEffect(() => {
    let active = true;
    const projection = projectionJson === undefined ? undefined : (JSON.parse(projectionJson) as unknown);
    void getEntitySummaryStatus({
      entitySummary,
      entitySummaryContentHash,
      entitySummaryProjectionVersion,
      entitySummarySource,
      currentContentHash,
      projection,
    }).then((next) => {
      if (active) setStatus(next);
    });
    return () => {
      active = false;
    };
  }, [
    entitySummary,
    entitySummaryContentHash,
    entitySummaryProjectionVersion,
    entitySummarySource,
    currentContentHash,
    projectionJson,
  ]);

  if (!status) return null;
  const config = {
    ai: { icon: Bot, label: t("entitySummary.status.ai"), title: t("entitySummary.status.aiHelp") },
    manual: { icon: PenLine, label: t("entitySummary.status.manual"), title: t("entitySummary.status.manualHelp") },
    stale: { icon: RefreshCw, label: t("entitySummary.status.stale"), title: t("entitySummary.status.staleHelp") },
    unknown: {
      icon: CircleHelp,
      label: t("entitySummary.status.unknown"),
      title: t("entitySummary.status.unknownHelp"),
    },
  }[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--secondary)] px-2 py-0.5 text-[0.625rem] font-medium text-[var(--muted-foreground)]",
        status === "stale" && "border-[var(--warning)]/40 text-[var(--warning)]",
        className,
      )}
      title={config.title}
    >
      <Icon size="0.625rem" aria-hidden="true" />
      {config.label}
    </span>
  );
}
