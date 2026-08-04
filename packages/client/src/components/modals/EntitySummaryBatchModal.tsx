import { useMemo, useState } from "react";
import type { EntitySummaryBatchItem, EntitySummaryBatchItemStatus } from "@marinara-engine/shared";
import { AlertCircle, Ban, Check, CheckCheck, Clock3, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  clearStoredEntitySummaryBatch,
  getStoredEntitySummaryBatch,
  useApplyEntitySummaryBatchItem,
  useCancelEntitySummaryBatch,
  useEntitySummaryBatch,
  useRetryEntitySummaryBatchItem,
} from "../../hooks/use-entity-summary-batch";
import { cn } from "../../lib/utils";
import { Modal } from "../ui/Modal";

interface EntitySummaryBatchModalProps {
  open: boolean;
  onClose: () => void;
  batchId: string;
}

const RETRYABLE = new Set<EntitySummaryBatchItemStatus>(["failed", "cancelled", "stale"]);

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function itemIcon(status: EntitySummaryBatchItemStatus) {
  if (status === "running") return Loader2;
  if (status === "candidate") return Sparkles;
  if (status === "applied") return Check;
  if (status === "failed" || status === "stale") return AlertCircle;
  if (status === "cancelled") return Ban;
  return Clock3;
}

export function EntitySummaryBatchModal({ open, onClose, batchId }: EntitySummaryBatchModalProps) {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const batchQuery = useEntitySummaryBatch(batchId);
  const retryItem = useRetryEntitySummaryBatchItem(batchId);
  const applyItem = useApplyEntitySummaryBatchItem(batchId);
  const cancelBatch = useCancelEntitySummaryBatch(batchId);
  const [applyingAll, setApplyingAll] = useState(false);
  const names = getStoredEntitySummaryBatch()?.batchId === batchId ? (getStoredEntitySummaryBatch()?.names ?? {}) : {};
  const batch = batchQuery.data;
  const counts = useMemo(() => {
    const items = batch?.items ?? [];
    return {
      ready: items.filter((item) => item.status === "candidate").length,
      applied: items.filter((item) => item.status === "applied").length,
      issues: items.filter((item) => RETRYABLE.has(item.status)).length,
    };
  }, [batch?.items]);
  const active = batch?.status === "queued" || batch?.status === "running";

  const itemName = (item: EntitySummaryBatchItem) =>
    names[`${item.kind}:${item.entityId}`] || t(`entitySummary.batch.kind.${item.kind}`);

  const apply = async (item: EntitySummaryBatchItem) => {
    try {
      await applyItem.mutateAsync({ itemId: item.id, kind: item.kind, entityId: item.entityId });
    } catch (error) {
      toast.error(errorMessage(error, t("entitySummary.batch.error.apply")));
    }
  };

  const applyAll = async () => {
    const ready = batch?.items.filter((item) => item.status === "candidate") ?? [];
    setApplyingAll(true);
    let applied = 0;
    for (const item of ready) {
      try {
        await applyItem.mutateAsync({ itemId: item.id, kind: item.kind, entityId: item.entityId });
        applied += 1;
      } catch {
        // A stale candidate is reflected by the refreshed batch and remains recoverable.
        void batchQuery.refetch();
      }
    }
    setApplyingAll(false);
    if (applied) toast.success(t("entitySummary.batch.appliedCount", { count: applied }));
    if (applied < ready.length)
      toast.error(t("entitySummary.batch.applySomeFailed", { count: ready.length - applied }));
  };

  const dismiss = () => {
    clearStoredEntitySummaryBatch(batchId);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("entitySummary.batch.title")}
      width="max-w-3xl"
      mobileFullscreen
      contentClassName="flex flex-col gap-4 px-3 py-3 sm:px-5 sm:py-4"
    >
      {batchQuery.isLoading ? (
        <div
          role="status"
          className="flex min-h-56 items-center justify-center gap-2 text-sm text-[var(--muted-foreground)]"
        >
          <Loader2 className="animate-spin" size="1rem" aria-hidden="true" />
          {t("entitySummary.batch.loading")}
        </div>
      ) : batchQuery.isError || !batch ? (
        <div role="alert" className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
          <AlertCircle size="1.5rem" className="text-[var(--destructive)]" aria-hidden="true" />
          <p className="max-w-md text-sm text-[var(--muted-foreground)]">{t("entitySummary.batch.loadError")}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => void batchQuery.refetch()}
              className="mari-chrome-control min-h-10 px-4 text-sm"
            >
              <RefreshCw size="0.875rem" aria-hidden="true" /> {t("entitySummary.batch.retryLoad")}
            </button>
            <button type="button" onClick={dismiss} className="mari-chrome-control min-h-10 px-4 text-sm">
              {t("entitySummary.batch.dismiss")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
            <div aria-live="polite" className="flex flex-wrap gap-2 text-xs">
              <span className="mari-chrome-muted-badge">{t(`entitySummary.batch.status.${batch.status}`)}</span>
              <span className="mari-chrome-muted-badge">
                {t("entitySummary.batch.readyCount", { count: counts.ready })}
              </span>
              <span className="mari-chrome-muted-badge">
                {t("entitySummary.batch.appliedCount", { count: counts.applied })}
              </span>
              {counts.issues > 0 && (
                <span className="mari-chrome-muted-badge text-[var(--destructive)]">
                  {t("entitySummary.batch.issueCount", { count: counts.issues })}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {active && (
                <button
                  type="button"
                  onClick={() =>
                    void cancelBatch
                      .mutateAsync()
                      .catch((error) => toast.error(errorMessage(error, t("entitySummary.batch.error.cancel"))))
                  }
                  disabled={cancelBatch.isPending || batch.cancelRequested}
                  className="mari-chrome-control mari-chrome-control--danger min-h-10 px-3 text-xs"
                >
                  <Ban size="0.75rem" aria-hidden="true" /> {t("entitySummary.batch.cancel")}
                </button>
              )}
              <button
                type="button"
                onClick={() => void applyAll()}
                disabled={counts.ready === 0 || applyingAll || applyItem.isPending}
                className="mari-chrome-control mari-chrome-control--primary min-h-10 px-3 text-xs"
              >
                {applyingAll ? <Loader2 className="animate-spin" size="0.75rem" /> : <CheckCheck size="0.75rem" />}
                {t("entitySummary.batch.applyAll")}
              </button>
            </div>
          </div>

          <p className="text-xs leading-5 text-[var(--muted-foreground)]">{t("entitySummary.batch.protection")}</p>

          <div className="space-y-2">
            {batch.items.map((item) => {
              const Icon = itemIcon(item.status);
              const busy =
                (retryItem.isPending && retryItem.variables === item.id) ||
                (applyItem.isPending && applyItem.variables?.itemId === item.id);
              return (
                <article
                  key={item.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--background)]/70 p-3"
                >
                  <div className="flex items-start gap-3">
                    <Icon
                      size="1rem"
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 shrink-0",
                        item.status === "running" && "animate-spin",
                        (item.status === "failed" || item.status === "stale") && "text-[var(--destructive)]",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="break-words text-sm font-semibold">{itemName(item)}</h3>
                          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
                            {t(`entitySummary.batch.kind.${item.kind}`)} ·{" "}
                            {t(`entitySummary.batch.itemStatus.${item.status}`)}
                            {item.attempts > 0
                              ? localizeUi("ui.modals.aboutmeviewermodal.value1", {
                                  value1: t("entitySummary.batch.attempts", { count: item.attempts }),
                                })
                              : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {RETRYABLE.has(item.status) && (
                            <button
                              type="button"
                              onClick={() =>
                                void retryItem
                                  .mutateAsync(item.id)
                                  .catch((error) =>
                                    toast.error(errorMessage(error, t("entitySummary.batch.error.retry"))),
                                  )
                              }
                              disabled={busy}
                              className="mari-chrome-control min-h-9 px-3 text-xs"
                              aria-label={t("entitySummary.batch.retryNamed", { name: itemName(item) })}
                            >
                              <RefreshCw size="0.75rem" aria-hidden="true" /> {t("entitySummary.batch.retry")}
                            </button>
                          )}
                          {item.status === "candidate" && (
                            <button
                              type="button"
                              onClick={() => void apply(item)}
                              disabled={busy || applyingAll}
                              className="mari-chrome-control mari-chrome-control--primary min-h-9 px-3 text-xs"
                              aria-label={t("entitySummary.batch.applyNamed", { name: itemName(item) })}
                            >
                              {busy ? <Loader2 className="animate-spin" size="0.75rem" /> : <Check size="0.75rem" />}
                              {t("entitySummary.batch.apply")}
                            </button>
                          )}
                        </div>
                      </div>
                      {item.candidateSummary && (
                        <p className="mt-2 whitespace-pre-wrap break-words rounded-md bg-[var(--secondary)] px-3 py-2 text-sm leading-5">
                          {item.candidateSummary}
                        </p>
                      )}
                      {item.error && (
                        <p role="alert" className="mt-2 break-words text-xs text-[var(--destructive)]">
                          {item.error}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="flex justify-end border-t border-[var(--border)] pt-3">
            <button
              type="button"
              onClick={batch.status === "completed" || batch.status === "cancelled" ? dismiss : onClose}
              className="mari-chrome-control min-h-10 px-4 text-sm"
            >
              {batch.status === "completed" || batch.status === "cancelled"
                ? t("entitySummary.batch.dismiss")
                : t("entitySummary.batch.close")}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
