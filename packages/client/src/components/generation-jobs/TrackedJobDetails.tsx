// Extra detail for a job row in the Generation jobs viewer (feature switch
// generationJobTracking): kind, chat, age, run time, error code, a result link and the job's log
// trail (the same structured events the server logged).
import { useQueryClient } from "@tanstack/react-query";
import type { Chat } from "@marinara-engine/shared";
import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { chatKeys } from "../../hooks/use-chats";
import { useTrackedGenerationJob } from "../../hooks/use-generation-jobs";
import { formatJobAge, safeResultHref, type TrackedGenerationJob } from "../../lib/generation-job-tracking";

export function TrackedJobDetails({ record, expanded }: { record: TrackedGenerationJob; expanded: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const detail = useTrackedGenerationJob(record.id, expanded);
  const chatName = record.chatId
    ? (queryClient.getQueryData<Chat[]>(chatKeys.list())?.find((chat) => chat.id === record.chatId)?.name ?? null)
    : null;
  const href = safeResultHref(record.resultRef);
  const age = formatJobAge(Date.now() - Date.parse(record.createdAt));
  const trail = detail.data?.trail ?? [];

  return (
    <div className="mt-1.5 min-w-0 space-y-1.5" data-testid="tracked-job-details">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-[var(--muted-foreground)]">
        <span className="rounded-md bg-[var(--secondary)] px-1.5 py-0.5 font-medium text-[var(--foreground)]">
          {t(`generationJobs.tracking.kind.${record.kind}`)}
        </span>
        {chatName ? <span className="max-w-[12rem] truncate">{chatName}</span> : null}
        <span>{t("generationJobs.tracking.age", { value: age })}</span>
        {record.elapsedMs !== null ? (
          <span>{t("generationJobs.tracking.took", { value: formatJobAge(record.elapsedMs) })}</span>
        ) : null}
        {record.errorCode ? <span className="font-mono text-[var(--destructive)]">{record.errorCode}</span> : null}
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
          >
            <ExternalLink size="0.7rem" aria-hidden="true" />
            {t("generationJobs.tracking.openResult")}
          </a>
        ) : null}
      </div>
      {expanded ? (
        <details className="rounded-lg border border-[var(--border)]/60 bg-[var(--background)]/60 px-2.5 py-1.5 text-[0.6875rem]">
          <summary className="cursor-pointer select-none font-semibold text-[var(--foreground)]">
            {t("generationJobs.tracking.logTrail", { count: trail.length })}
          </summary>
          {detail.isError ? (
            <p className="mt-1 text-[var(--destructive)]">{t("generationJobs.tracking.logTrailError")}</p>
          ) : (
            <ol className="mt-1.5 space-y-1">
              {trail.map((entry, index) => (
                <li
                  key={`${entry.at}-${index}`}
                  className="flex min-w-0 flex-wrap gap-x-2 font-mono text-[0.625rem] text-[var(--muted-foreground)]"
                >
                  <span>{new Date(entry.at).toLocaleTimeString()}</span>
                  <span className="text-[var(--foreground)]">{entry.state}</span>
                  <span>{entry.stage}</span>
                  {entry.elapsedMs !== undefined ? (
                    <span>{t("generationJobs.tracking.elapsedMs", { value: entry.elapsedMs })}</span>
                  ) : null}
                  {entry.errorCode ? <span className="text-[var(--destructive)]">{entry.errorCode}</span> : null}
                  {entry.outcome ? <span>{entry.outcome}</span> : null}
                </li>
              ))}
            </ol>
          )}
          <p className="mt-1.5 break-all font-mono text-[0.625rem] text-[var(--muted-foreground)]">
            {t("generationJobs.tracking.jobId", { value: record.id })}
          </p>
        </details>
      ) : null}
    </div>
  );
}
