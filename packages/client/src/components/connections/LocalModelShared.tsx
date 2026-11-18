// ──────────────────────────────────────────────
// Pieces every built-in model's page shares: the Engine-wide "When unused" setting, and a
// note that says why a model is not loaded right now or may not fit in memory.
// ──────────────────────────────────────────────
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { LOCAL_MODEL_IDLE_UNLOAD_CHOICES, type LocalModelSlotId } from "@marinara-engine/shared";
import { useLocalModels, useUpdateLocalModelSettings } from "../../hooks/use-local-models";
import { FactRow } from "./DeviceDetail";

const FIELD = "mari-chrome-field h-8 w-full max-w-[18rem] px-2 text-xs max-md:h-11 max-sm:max-w-none max-sm:text-base";

function choiceLabel(minutes: number, t: (key: string, values?: Record<string, unknown>) => string): string {
  if (minutes === 0) return t("connections.localModels.keepLoaded");
  if (minutes >= 60) return t("connections.localModels.unloadAfterHours", { count: minutes / 60 });
  return t("connections.localModels.unloadAfterMinutes", { count: minutes });
}

/**
 * One setting for every built-in model, shown on each of their pages. `field` lays it out
 * like the decision model's own options (label above), `fact` like a facts-card row.
 */
export function UnloadWhenUnusedRow({ variant = "fact" }: { variant?: "fact" | "field" }) {
  const { t } = useTranslation();
  const { data } = useLocalModels();
  const update = useUpdateLocalModelSettings();
  if (!data) return null;
  const value =
    update.isPending && update.variables ? update.variables.idleUnloadMinutes : data.settings.idleUnloadMinutes;
  const label = t("connections.localModels.whenUnused");
  const select = (
    <select
      value={value}
      disabled={update.isPending}
      onChange={(event) =>
        update.mutate(
          { idleUnloadMinutes: Number(event.target.value) },
          {
            onError: (error) =>
              toast.error(error instanceof Error ? error.message : t("connections.localModels.saveFailed")),
          },
        )
      }
      aria-label={label}
      className={variant === "field" ? "mari-chrome-field h-11 w-full px-3 text-xs max-sm:text-base md:h-9" : FIELD}
    >
      {LOCAL_MODEL_IDLE_UNLOAD_CHOICES.map((minutes) => (
        <option key={minutes} value={minutes}>
          {choiceLabel(minutes, t)}
        </option>
      ))}
    </select>
  );
  if (variant === "field") {
    return (
      <div className="flex flex-col gap-1 text-xs">
        <span className="font-medium">{label}</span>
        {select}
        <span className="text-[0.625rem] text-[var(--muted-foreground)] max-sm:text-[13px]">
          {t("connections.localModels.whenUnusedHint")}
        </span>
      </div>
    );
  }
  return (
    <FactRow label={label} stack>
      {select}
      <span className="mt-1 block text-[0.6875rem] text-[var(--muted-foreground)]">
        {t("connections.localModels.whenUnusedHint")}
      </span>
    </FactRow>
  );
}

/** Why this model is not loaded right now, or why it may not fit. Nothing when neither applies. */
export function LocalModelSlotNote({ slot }: { slot: LocalModelSlotId }) {
  const { t } = useTranslation();
  const { data } = useLocalModels();
  const status = data?.slots.find((entry) => entry.id === slot);
  if (!status) return null;
  if (status.memoryWarning) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-2.5 text-[0.6875rem]"
      >
        <AlertTriangle size="0.8125rem" className="mt-px shrink-0 text-[var(--warning)]" aria-hidden="true" />
        <span className="min-w-0 text-[var(--foreground)] [overflow-wrap:anywhere]">{status.memoryWarning}</span>
      </div>
    );
  }
  const reason = status.unloadedForMemoryAt
    ? t("connections.localModels.unloadedForMemory")
    : status.unloadedForIdleAt
      ? t("connections.localModels.unloadedForIdle")
      : null;
  if (!reason) return null;
  return <p className="px-0.5 text-[0.6875rem] text-[var(--muted-foreground)]">{reason}</p>;
}
