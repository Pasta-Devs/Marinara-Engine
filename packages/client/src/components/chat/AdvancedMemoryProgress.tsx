import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { AdvancedMemoryStatus } from "@marinara-engine/shared";
import { useAdvancedMemoryAction } from "../../hooks/use-advanced-memory";
import { useReducedAmbientEffects } from "../../hooks/use-reduced-ambient-effects";
import "./advanced-memory.css";

export function AdvancedMemoryProgress({
  chatId,
  status,
  onResume,
}: {
  chatId: string;
  status: AdvancedMemoryStatus;
  onResume: () => void;
}) {
  const { t } = useTranslation();
  const progressLabel = useId();
  const reducedMotion = useReducedAmbientEffects();
  const action = useAdvancedMemoryAction(chatId);
  const { job } = status;
  const running = job.status === "running";
  const panelRef = useRef<HTMLElement>(null);
  const shownJobRef = useRef<string | null>(null);
  useEffect(() => {
    const id = job.id ?? "initial";
    if (!running || job.blocking === false || shownJobRef.current === id) return;
    const frame = window.requestAnimationFrame(() => {
      shownJobRef.current = id;
      panelRef.current?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [job.blocking, job.id, running]);
  if (job.status === "idle" || job.status === "needs_confirmation") return null;
  const stage = t(`chat.advancedMemory.stage.${job.stage}`);

  return (
    <section
      ref={panelRef}
      className="space-y-2 rounded-lg bg-[var(--secondary)] p-3"
      aria-label={t("chat.advancedMemory.progress")}
      data-component="AdvancedMemoryProgress"
    >
      {running && job.blocking !== false && (
        <div className="flex flex-col items-center gap-1">
          <span
            aria-hidden="true"
            className="mari-memory-wheel block w-36"
            data-running={reducedMotion ? "false" : "true"}
          />
          <p className="text-xs text-[var(--muted-foreground)]">{t("chat.advancedMemory.mayTakeAWhile")}</p>
        </div>
      )}
      <p id={progressLabel} role="status" aria-live="polite" className="text-xs font-medium">
        {running ? stage : t(`chat.advancedMemory.status.${job.status}`)}
      </p>
      {running && job.total > 0 && (
        <>
          <progress
            value={Math.min(job.completed, job.total)}
            max={job.total}
            aria-labelledby={progressLabel}
            className="mari-memory-progress h-2 w-full overflow-hidden rounded-full"
          />
          <p className="text-[0.6875rem] tabular-nums text-[var(--muted-foreground)]">
            {t("chat.advancedMemory.completed", { completed: job.completed, total: job.total })}
          </p>
        </>
      )}
      {job.error && (
        <p role="alert" className="break-words text-xs text-[var(--destructive)]">
          {job.error}
        </p>
      )}
      {running && (
        <button
          type="button"
          className="mari-chrome-control min-h-9 w-full rounded-lg px-3 py-2 text-xs"
          disabled={action.isPending}
          onClick={() => action.mutate({ action: "cancel" })}
        >
          {t("chat.advancedMemory.cancel")}
        </button>
      )}
      {(job.status === "cancelled" || job.status === "error") && (
        <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
          {t("chat.advancedMemory.resumeHelp")}{" "}
          <button type="button" className="font-medium underline" onClick={onResume}>
            {t("chat.advancedMemory.resume")}
          </button>
        </p>
      )}
    </section>
  );
}
