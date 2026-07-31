import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  useNoodle,
  useNoodlerAccounts,
  useNoodlerReserveStatus,
  useRefreshAllNoodlerCreatorsNow,
  useUpdateNoodleSettings,
  useUpdateNoodlerAutoPosting,
} from "../../hooks/use-noodle";
import { Avatar } from "./NoodleShell";
import { summarizeRefreshOutcomes } from "./noodle-auto-post";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

interface NoodlerPublishingSettingsProps {
  active: boolean;
  onOpenCreator?: (accountId: string) => void;
}

export function NoodlerPublishingSettings({ active, onOpenCreator }: NoodlerPublishingSettingsProps) {
  const { t } = useUiTranslation();
  const { data } = useNoodle();
  const settings = data?.settings;
  const accounts = useNoodlerAccounts(settings?.enableNoodler === true).data ?? [];
  const status = useNoodlerReserveStatus(active && settings?.enableNoodler === true).data;
  const updateSettings = useUpdateNoodleSettings();
  const updateAuto = useUpdateNoodlerAutoPosting();
  const refreshAll = useRefreshAllNoodlerCreatorsNow();
  const nextByAccount = new Map(status?.creators.map((entry) => [entry.accountId, entry.nextPreparedAt]) ?? []);

  return (
    <div className="space-y-4">
      <section className="space-y-4 border-b border-[var(--border)] pb-4">
        <label className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-sm font-semibold">
              {t("ui.noodle.noodlerschedulemanagermodal.automaticPostingSchedule")}
            </span>
            <span className="block text-xs text-[var(--muted-foreground)]">
              {t("ui.noodle.noodlerschedulemanagermodal.upToPostsPerDay", { count: settings?.postsPerDay ?? 4 })}
            </span>
          </span>
          <input
            type="checkbox"
            checked={settings?.autoPostingScheduleEnabled ?? true}
            disabled={updateSettings.isPending}
            onChange={(event) => updateSettings.mutate({ autoPostingScheduleEnabled: event.target.checked })}
            className="h-5 w-5 accent-[var(--noodle-accent)]"
          />
        </label>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-[var(--muted-foreground)]">
              {t("ui.noodle.noodlerschedulemanagermodal.textAttemptsLabel")}
            </dt>
            <dd className="mt-0.5 font-semibold tabular-nums">
              {t("ui.noodle.noodlerschedulemanagermodal.textAttempts", {
                used: status?.textAttemptsUsed ?? 0,
                limit: status?.postsPerDay ?? settings?.postsPerDay ?? 4,
              })}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted-foreground)]">
              {t("ui.noodle.noodlerschedulemanagermodal.imageAttemptsLabel")}
            </dt>
            <dd className="mt-0.5 font-semibold tabular-nums">
              {t("ui.noodle.noodlerschedulemanagermodal.imageAttempts", {
                used: status?.imageAttemptsUsed ?? 0,
                limit: status?.postsPerDay ?? settings?.postsPerDay ?? 4,
              })}
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <dt className="text-[var(--muted-foreground)]">
              {t("ui.noodle.noodlerschedulemanagermodal.preparedPostsLabel")}
            </dt>
            <dd className="mt-0.5 font-semibold tabular-nums">
              {status?.preparedThrough
                ? t("ui.noodle.noodlerschedulemanagermodal.reserveThrough", {
                    count: status.preparedCount,
                    time: new Date(status.preparedThrough).toLocaleString(),
                  })
                : t("ui.noodle.noodlerschedulemanagermodal.reserveEmpty")}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          disabled={refreshAll.isPending}
          onClick={() =>
            refreshAll.mutate(undefined, {
              onSuccess: ({ outcomes }) => {
                const summary = summarizeRefreshOutcomes(outcomes);
                (summary.ok ? toast.success : toast.error)(t(summary.key, summary.params));
              },
              onError: (error) =>
                toast.error(errorMessage(error, t("ui.noodle.noodlerschedulemanagermodal.couldNotRefreshCreators"))),
            })
          }
          className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-xs font-semibold transition-[background-color,scale] hover:bg-[var(--accent)] active:scale-[0.96] disabled:opacity-40"
        >
          <RefreshCw size={13} className={refreshAll.isPending ? "animate-spin" : undefined} />{" "}
          {t("ui.noodle.noodlerschedulemanagermodal.refreshAllNow")}
        </button>
      </section>

      <div className="space-y-2">
        {accounts.map((profile) => (
          <div
            key={profile.id}
            className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-1 py-3 last:border-b-0"
          >
            <button
              type="button"
              onClick={() => onOpenCreator?.(profile.id)}
              disabled={!onOpenCreator}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left disabled:cursor-default"
            >
              <Avatar account={profile} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{profile.displayName}</span>
                <span className="block truncate text-xs text-[var(--muted-foreground)]">
                  {nextByAccount.get(profile.id)
                    ? t("ui.noodle.noodlerschedulemanagermodal.nextValue1", {
                        value1: new Date(nextByAccount.get(profile.id)!).toLocaleString(),
                      })
                    : t("ui.noodle.noodlerschedulemanagermodal.noPreparedPost")}
                </span>
              </span>
            </button>
            <label className="flex items-center gap-2 text-xs font-semibold">
              {t("ui.noodle.noodlerschedulemanagermodal.automatic")}
              <input
                type="checkbox"
                checked={profile.autoPosting.enabled}
                disabled={updateAuto.isPending}
                onChange={(event) => updateAuto.mutate({ accountId: profile.id, enabled: event.target.checked })}
                className="h-4 w-4 accent-[var(--noodle-accent)]"
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold">
              {t("ui.noodle.noodlerschedulemanagermodal.images")}
              <input
                type="checkbox"
                checked={profile.autoPosting.imagesEnabled}
                disabled={updateAuto.isPending}
                onChange={(event) => updateAuto.mutate({ accountId: profile.id, imagesEnabled: event.target.checked })}
                className="h-4 w-4 accent-[var(--noodle-accent)]"
              />
            </label>
          </div>
        ))}
        {accounts.length === 0 && (
          <p className="text-sm text-[var(--muted-foreground)]">
            {t("ui.noodle.noodlerschedulemanagermodal.noCreatorsYetAddSomeFromTheNoodlerHub")}
          </p>
        )}
      </div>
    </div>
  );
}
