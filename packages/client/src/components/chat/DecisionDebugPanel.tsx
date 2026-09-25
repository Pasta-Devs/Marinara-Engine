import { useState } from "react";
import { ChevronDown, ChevronRight, FlaskConical, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DecisionDebugPreview } from "@marinara-engine/shared";
import { useDecisionDebug } from "../../hooks/use-decision-debug";

export function DecisionDebugPanel({
  chatId,
  onPreview,
}: {
  chatId: string;
  onPreview: (preview: DecisionDebugPreview | null) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const test = useDecisionDebug(chatId);
  const report = test.data?.prompt.decisionDebug;
  const canRun = report?.results.some((row) => ["ready", "evaluated", "cached", "unanswered"].includes(row.status));
  const run = (mode: "inspect" | "run") => {
    onPreview(null);
    test.mutate(mode, {
      onSuccess: (preview) => {
        if (mode === "run") onPreview(preview);
      },
    });
  };

  return (
    <section className="border-b border-[var(--border)] pb-3 text-xs" aria-label={t("decisionDebug.title")}>
      <button
        type="button"
        aria-expanded={open}
        className="flex min-h-10 w-full items-center gap-2 text-left font-medium"
        onClick={() => {
          setOpen(!open);
          if (!open && !test.data && !test.isPending) run("inspect");
        }}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <FlaskConical size={16} />
        {t("decisionDebug.title")}
      </button>
      {open && (
        <div className="space-y-3">
          <p className="text-[var(--muted-foreground)]">{t("decisionDebug.scope")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="mari-chrome-control min-h-10 px-3 disabled:opacity-50"
              disabled={test.isPending || !canRun}
              onClick={() => run("run")}
            >
              {t("decisionDebug.run")}
            </button>
            <button
              type="button"
              className="mari-chrome-control min-h-10 px-3 disabled:opacity-50"
              disabled={test.isPending}
              onClick={() => run("inspect")}
            >
              {t("decisionDebug.refresh")}
            </button>
            {test.isPending && (
              <button type="button" className="mari-chrome-control min-h-10 px-3" onClick={test.cancel}>
                {t("decisionDebug.cancel")}
              </button>
            )}
          </div>
          <p className="text-[var(--muted-foreground)]">{t("decisionDebug.cost")}</p>
          {test.isPending && (
            <p role="status" className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              {t(test.variables === "run" ? "decisionDebug.running" : "decisionDebug.preparing")}
            </p>
          )}
          {test.isError && (
            <p role="alert" className="text-[var(--destructive)]">
              {t(test.error?.name === "AbortError" ? "decisionDebug.cancelled" : "decisionDebug.failed")}
            </p>
          )}
          {report && !test.isPending && (
            <>
              <p className="font-medium break-words">
                {t("decisionDebug.model", { model: report.model ?? t("decisionDebug.noModel") })}
              </p>
              <p className="text-[var(--muted-foreground)]">
                {t(report.mode === "run" ? "decisionDebug.ranAt" : "decisionDebug.preparedAt", {
                  time: new Date(report.createdAt).toLocaleString(),
                })}
              </p>
              {report.results.length === 0 && <p role="status">{t("decisionDebug.empty")}</p>}
              <ul className="divide-y divide-[var(--border)]">
                {report.results.map((row) => (
                  <li key={`${row.kind}:${row.statement}`} className="space-y-1 py-3">
                    <p className="whitespace-pre-wrap break-words font-medium">{row.statement}</p>
                    <p className="text-[var(--muted-foreground)]">{t(`decisionDebug.status.${row.status}`)}</p>
                    <dl className="flex flex-wrap gap-x-4 gap-y-1">
                      {row.probability !== undefined && (
                        <div className="flex gap-1">
                          <dt>{t("decisionDebug.score")}</dt>
                          <dd>{row.probability.toLocaleString(undefined, { maximumSignificantDigits: 6 })}</dd>
                        </div>
                      )}
                      {row.threshold !== undefined && (
                        <div className="flex gap-1">
                          <dt>{t("decisionDebug.threshold")}</dt>
                          <dd>{row.threshold}</dd>
                        </div>
                      )}
                      {row.yes !== undefined && (
                        <div className="flex gap-1">
                          <dt>{t("decisionDebug.result")}</dt>
                          <dd>{t(row.yes ? "decisionDebug.yes" : "decisionDebug.no")}</dd>
                        </div>
                      )}
                      {row.choice !== undefined && (
                        <div className="flex min-w-0 gap-1">
                          <dt>{t("decisionDebug.choice")}</dt>
                          <dd className="break-words">{row.choice}</dd>
                        </div>
                      )}
                    </dl>
                    {row.binary && <p className="text-[var(--muted-foreground)]">{t("decisionDebug.binary")}</p>}
                    {row.options && (
                      <p className="break-words text-[var(--muted-foreground)]">
                        {t("decisionDebug.options", { options: row.options.join(", ") })}
                      </p>
                    )}
                    {row.error && (
                      <p className="text-[var(--destructive)]">
                        {t("decisionDebug.requestError", { error: row.error })}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              {report.requests.length > 0 && (
                <details>
                  <summary className="cursor-pointer py-2 font-medium">
                    {t(report.mode === "run" ? "decisionDebug.sentRequests" : "decisionDebug.plannedRequests", {
                      count: report.requests.length,
                    })}
                  </summary>
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-md bg-[var(--background)] p-3 text-xs">
                    {JSON.stringify(report.requests, null, 2)}
                  </pre>
                </details>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
