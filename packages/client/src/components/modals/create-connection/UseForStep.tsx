import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  LOCAL_SIDECAR_CONNECTION_ID,
  MODEL_LISTS,
  type ConnectionAccountListItem,
  type ConnectionPickerKind,
} from "@marinara-engine/shared";
import { useConnectionModels, useConnections, useCreateConnection } from "../../../hooks/use-connections";
import { usePickModel } from "../../../hooks/use-connection-accounts";
import { useDecisionOptions, useSelectDecisionModel } from "../../../hooks/use-decision-model";
import { useJobModels } from "../../connections/ConnectionDefaults";
import type { ConnectionRowData } from "../../connections/ConnectionRow";
import { catalogMatchesKind, JOB, jobLabelKey, matchesKind, type JobKey } from "../../../lib/connection-jobs";
import type { RemoteConnectionModel } from "../../../lib/connection-model-selection";
import { mediaRowFor } from "../../../lib/media-source";
import { errorText, kindsOf, PRIMARY_CLASS, SECONDARY_CLASS, type ServiceId, type Target } from "./shared";

type UseKind = Exclude<ConnectionPickerKind, "all">;
/** The job each model type serves, in row order. */
const JOB_OF: Partial<Record<UseKind, JobKey>> = {
  chat: "main",
  image: "images",
  video: "video",
  audio: "voice",
  decision: "decision",
};
type Use = { kind: UseKind; job: JobKey; model: string; name?: string; rowId?: string };

/** A catalog model that writes text: its listed outputs say so, else no media or embedding name. */
const writesText = (model: RemoteConnectionModel) =>
  model.outputModalities?.length
    ? model.outputModalities.some((output) => output.toLowerCase() === "text")
    : !/embed/i.test(model.id) &&
      !(["image", "video", "audio"] as const).some((kind) => catalogMatchesKind(model.id, model, kind));

/**
 * What a new account can do, one row per model type it offers: a saved row of that type, else the
 * catalog's first fit (for text, the provider's recommended pick when the catalog has it).
 */
export function usesOf(
  kinds: readonly UseKind[],
  provider: string,
  accountRows: readonly ConnectionRowData[],
  models: readonly RemoteConnectionModel[],
): Use[] {
  const recommended = (MODEL_LISTS[provider as keyof typeof MODEL_LISTS] ?? []).map((model) => model.id);
  return kinds.flatMap((kind): Use[] => {
    const job = JOB_OF[kind];
    if (!job) return [];
    const own = accountRows.find((row) => row.model?.trim() && matchesKind(row, kind));
    if (own) {
      const name = models.find((model) => model.id === own.model)?.name;
      return [{ kind, job, model: own.model!, rowId: own.id, ...(name ? { name } : {}) }];
    }
    const fits = models.filter((model) =>
      kind === "decision"
        ? model.capabilities?.logprobs
        : kind === "chat"
          ? writesText(model)
          : catalogMatchesKind(model.id, model, kind),
    );
    const best = (kind === "chat" && fits.find((model) => recommended.includes(model.id))) || fits[0];
    return best ? [{ kind, job, model: best.id, name: best.name }] : [];
  });
}

interface UseForStepProps {
  target: Target;
  service: ServiceId;
  accounts: ConnectionAccountListItem[] | undefined;
  accountName: string;
  serviceName: (service: ServiceId) => string;
  /** Closes the window; `applied` is false when nothing was set, so it still says the account was added. */
  onFinish: (applied: boolean) => void;
}

/** Step 3 of a new account: "Found in <account> — use it for:", one row per job it can do. */
export function UseForStep({ target, service, accounts, accountName, serviceName, onFinish }: UseForStepProps) {
  const { t } = useTranslation();
  const { data: connections } = useConnections();
  const rows = (connections ?? []) as ConnectionRowData[];
  const catalog = useConnectionModels(target.connectionId);
  const modelFor = useJobModels(rows);
  const decisionOptions = useDecisionOptions(true);
  const selectDecision = useSelectDecisionModel();
  const pickModel = usePickModel();
  const createRow = useCreateConnection();
  const [ticked, setTicked] = useState<Set<JobKey> | null>(null);
  const [busy, setBusy] = useState(false);
  const account = accounts?.find((item) => item.id === target.accountId);

  const kinds = kindsOf(service).map((kind) => (kind === "voice" ? "audio" : kind)) as UseKind[];
  const uses = account
    ? usesOf(
        (Object.keys(JOB_OF) as UseKind[]).filter((kind) => kinds.includes(kind)),
        account.provider,
        rows.filter((row) => row.accountId === account.id),
        catalog.data?.models ?? [],
      )
    : [];
  const currentOf = (use: Use) =>
    use.kind === "decision" ? (decisionOptions.data?.selected ?? null) : (modelFor(JOB[use.job])?.value ?? null);
  const labelOf = (id: string) => {
    if (id === LOCAL_SIDECAR_CONNECTION_ID) return serviceName("local_model");
    const row = rows.find((candidate) => candidate.id === id);
    return row?.model?.trim() || row?.name || id;
  };
  // Empty jobs start ticked; a job that already has a model waits for the user.
  const isTicked = (use: Use) => (ticked ? ticked.has(use.job) : !currentOf(use));
  const toggle = (use: Use) =>
    setTicked(() => {
      const next = new Set(uses.filter(isTicked).map((item) => item.job));
      if (next.has(use.job)) next.delete(use.job);
      else next.add(use.job);
      return next;
    });

  const rowFor = async (use: Use): Promise<string | undefined> => {
    if (use.rowId || !account) return use.rowId;
    if (use.kind === "chat")
      return (
        await pickModel.mutateAsync({
          accountId: account.id,
          model: use.model,
          ...(use.name ? { name: use.name } : {}),
        })
      ).connectionId;
    if (use.kind === "decision") {
      const existing = rows.find(
        (row) => row.provider === "decision" && row.accountId === account.id && row.model === use.model,
      );
      if (existing) return existing.id;
      const created = (await createRow.mutateAsync({
        name: use.model,
        provider: "decision",
        apiKey: "",
        baseUrl: account.baseUrl ?? "",
        accountId: account.id,
        decisionSource: "openai_compatible",
        model: use.model,
      })) as { id?: string };
      return created.id;
    }
    return mediaRowFor(use.kind, account, use.model, use.name, rows, (data) => createRow.mutateAsync(data));
  };

  const done = async () => {
    setBusy(true);
    const undo: Array<() => void> = [];
    const jobs: string[] = [];
    let failed = false;
    try {
      for (const use of uses.filter(isTicked)) {
        const id = await rowFor(use);
        const previous = currentOf(use);
        if (!id || id === previous) continue;
        if (use.kind === "decision") {
          await selectDecision.mutateAsync(id);
          undo.push(() => selectDecision.mutate(previous));
        } else {
          const model = modelFor(JOB[use.job]);
          const set = model && "set" in model ? model.set : undefined;
          if (!model || !set) continue;
          model.onChange(id);
          undo.push(() => set(id, previous));
        }
        jobs.push(t(jobLabelKey(JOB[use.job])));
      }
    } catch (error) {
      failed = true;
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
    if (jobs.length)
      toast.success(t("connections.add.usedFor", { name: accountName, jobs: jobs.join(", ") }), {
        duration: 8000,
        action: { label: t("connections.switcher.undo"), onClick: () => undo.forEach((step) => step()) },
      });
    if (!failed) onFinish(jobs.length > 0);
  };

  const loading = catalog.isLoading && !uses.length;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-3 py-4">
        <p className="text-sm text-[var(--muted-foreground)]">{t("connections.add.foundIn", { name: accountName })}</p>
        {loading ? (
          <p role="status" className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <Loader2 size="0.875rem" className="animate-spin" aria-hidden />
            {t("connections.add.readingCatalog")}
          </p>
        ) : uses.length === 0 ? (
          <p role="status" className="text-sm text-[var(--muted-foreground)]">
            {t("connections.add.nothingFound")}
          </p>
        ) : (
          uses.map((use) => {
            const current = currentOf(use);
            return (
              <label
                key={use.job}
                data-add-connection-use={use.job}
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2 hover:bg-[var(--marinara-chat-chrome-highlight-bg)]"
              >
                <input
                  type="checkbox"
                  checked={isTicked(use)}
                  onChange={() => toggle(use)}
                  disabled={busy}
                  className="h-[1.125rem] w-[1.125rem] shrink-0 accent-[var(--primary)]"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium">{t(jobLabelKey(JOB[use.job]))}</span>
                  <span className="text-xs text-[var(--muted-foreground)] [overflow-wrap:anywhere]">
                    {use.name ?? use.model} ·{" "}
                    {current
                      ? t("connections.add.nowUses", { model: labelOf(current) })
                      : t("connections.add.nothingSet")}
                  </span>
                </span>
              </label>
            );
          })
        )}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--marinara-chat-chrome-panel-divider)] px-3 py-3">
        <button type="button" className={SECONDARY_CLASS} disabled={busy} onClick={() => onFinish(false)}>
          {t("connections.add.skip")}
        </button>
        <button
          type="button"
          className={PRIMARY_CLASS}
          data-add-connection-done
          disabled={busy || loading}
          onClick={() => void done()}
        >
          {busy && <Loader2 size="0.75rem" className="animate-spin" aria-hidden />}
          {t("connections.add.done")}
        </button>
      </div>
    </div>
  );
}
