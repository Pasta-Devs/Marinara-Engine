// ──────────────────────────────────────────────
// Pieces every built-in model's page shares: the Engine-wide "When unused" setting, and a
// note that says why a model is not loaded right now or may not fit in memory.
// ──────────────────────────────────────────────
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { LOCAL_MODEL_IDLE_UNLOAD_CHOICES, type LocalModelSlotId } from "@marinara-engine/shared";
import { useLocalModels, useUpdateLocalModelSettings } from "../../hooks/use-local-models";
import { DEVICE_FIELD, FactRow } from "./DeviceDetail";

function choiceLabel(minutes: number, t: (key: string, values?: Record<string, unknown>) => string): string {
  if (minutes === 0) return t("connections.localModels.keepLoaded");
  if (minutes >= 60) return t("connections.localModels.unloadAfterHours", { count: minutes / 60 });
  return t("connections.localModels.unloadAfterMinutes", { count: minutes });
}

/** One setting for every built-in model, shown as a facts-card row on each of their pages. */
export function UnloadWhenUnusedRow() {
  const { t } = useTranslation();
  const { data } = useLocalModels();
  const update = useUpdateLocalModelSettings();
  if (!data) return null;
  const value =
    update.isPending && update.variables ? update.variables.idleUnloadMinutes : data.settings.idleUnloadMinutes;
  const label = t("connections.localModels.whenUnused");
  return (
    <FactRow label={label}>
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
        className={DEVICE_FIELD}
      >
        {LOCAL_MODEL_IDLE_UNLOAD_CHOICES.map((minutes) => (
          <option key={minutes} value={minutes}>
            {choiceLabel(minutes, t)}
          </option>
        ))}
      </select>
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
