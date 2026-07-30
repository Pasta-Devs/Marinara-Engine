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
import { Modal } from "../ui/Modal";
import { Avatar, getNoodleAccentStyle, NOODLE_PINK } from "./NoodleShell";
import { summarizeRefreshOutcomes } from "./noodle-auto-post";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function NoodlerScheduleManagerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useUiTranslation();
  const { data } = useNoodle();
  const settings = data?.settings;
  const accounts = useNoodlerAccounts(settings?.enableNoodler === true).data ?? [];
  const status = useNoodlerReserveStatus(open && settings?.enableNoodler === true).data;
  const updateSettings = useUpdateNoodleSettings();
  const updateAuto = useUpdateNoodlerAutoPosting();
  const refreshAll = useRefreshAllNoodlerCreatorsNow();
  const nextByAccount = new Map(status?.creators.map((entry) => [entry.accountId, entry.nextPreparedAt]) ?? []);

  return (
    <Modal open={open} onClose={onClose} title={t("ui.noodle.noodlerschedulemanagermodal.noodlerSchedules")} width="max-w-2xl" panelStyle={getNoodleAccentStyle(NOODLE_PINK)}>
      <div className="space-y-3">
        <section className="space-y-3 rounded-lg bg-[var(--secondary)] p-3 ring-1 ring-[var(--border)]">
          <label className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{t("ui.noodle.noodlerschedulemanagermodal.automaticPostingSchedule")}</span>
              <span className="block text-xs text-[var(--muted-foreground)]">{t("ui.noodle.noodlerschedulemanagermodal.upToPostsPerDay", { count: settings?.postsPerDay ?? 4 })}</span>
            </span>
            <input type="checkbox" checked={settings?.autoPostingScheduleEnabled ?? true} disabled={updateSettings.isPending} onChange={(event) => updateSettings.mutate({ autoPostingScheduleEnabled: event.target.checked })} className="h-5 w-5 accent-[var(--noodle-accent)]" />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm font-semibold">
            {t("ui.noodle.noodlerschedulemanagermodal.postsPerDay")}
            <input type="number" min={1} max={24} value={settings?.postsPerDay ?? 4} disabled={updateSettings.isPending} onChange={(event) => updateSettings.mutate({ postsPerDay: Number(event.target.value) })} className="h-9 w-20 rounded-md bg-[var(--background)] px-2 text-right ring-1 ring-[var(--border)]" />
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <p className="rounded-md bg-[var(--background)] p-2 ring-1 ring-[var(--border)]">{t("ui.noodle.noodlerschedulemanagermodal.textAttempts", { used: status?.textAttemptsUsed ?? 0, limit: status?.postsPerDay ?? settings?.postsPerDay ?? 4 })}</p>
            <p className="rounded-md bg-[var(--background)] p-2 ring-1 ring-[var(--border)]">{t("ui.noodle.noodlerschedulemanagermodal.imageAttempts", { used: status?.imageAttemptsUsed ?? 0, limit: status?.postsPerDay ?? settings?.postsPerDay ?? 4 })}</p>
            <p className="col-span-2 rounded-md bg-[var(--background)] p-2 ring-1 ring-[var(--border)] sm:col-span-1">{status?.preparedThrough ? t("ui.noodle.noodlerschedulemanagermodal.reserveThrough", { count: status.preparedCount, time: new Date(status.preparedThrough).toLocaleString() }) : t("ui.noodle.noodlerschedulemanagermodal.reserveEmpty")}</p>
          </div>
          <button type="button" disabled={refreshAll.isPending} onClick={() => refreshAll.mutate(undefined, { onSuccess: ({ outcomes }) => { const summary = summarizeRefreshOutcomes(outcomes); (summary.ok ? toast.success : toast.error)(t(summary.key, summary.params)); }, onError: (error) => toast.error(errorMessage(error, t("ui.noodle.noodlerschedulemanagermodal.couldNotRefreshCreators"))) })} className="inline-flex h-9 items-center gap-2 rounded-full bg-[var(--background)] px-3 text-xs font-semibold ring-1 ring-[var(--border)] disabled:opacity-40">
            <RefreshCw size={13} className={refreshAll.isPending ? "animate-spin" : undefined} /> {t("ui.noodle.noodlerschedulemanagermodal.refreshAllNow")}
          </button>
        </section>

        <div className="space-y-2">
          {accounts.map((profile) => (
            <div key={profile.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-[var(--secondary)] p-3 ring-1 ring-[var(--border)]">
              <Avatar account={profile} />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{profile.displayName}</span><span className="block truncate text-xs text-[var(--muted-foreground)]">{nextByAccount.get(profile.id) ? t("ui.noodle.noodlerschedulemanagermodal.nextValue1", { value1: new Date(nextByAccount.get(profile.id)!).toLocaleString() }) : t("ui.noodle.noodlerschedulemanagermodal.noPreparedPost")}</span></span>
              <label className="flex items-center gap-2 text-xs font-semibold">{t("ui.noodle.noodlerschedulemanagermodal.automatic")}<input type="checkbox" checked={profile.autoPosting.enabled} disabled={updateAuto.isPending} onChange={(event) => updateAuto.mutate({ accountId: profile.id, enabled: event.target.checked })} className="h-4 w-4 accent-[var(--noodle-accent)]" /></label>
              <label className="flex items-center gap-2 text-xs font-semibold">{t("ui.noodle.noodlerschedulemanagermodal.images")}<input type="checkbox" checked={profile.autoPosting.imagesEnabled} disabled={updateAuto.isPending} onChange={(event) => updateAuto.mutate({ accountId: profile.id, imagesEnabled: event.target.checked })} className="h-4 w-4 accent-[var(--noodle-accent)]" /></label>
            </div>
          ))}
          {accounts.length === 0 && <p className="text-sm text-[var(--muted-foreground)]">{t("ui.noodle.noodlerschedulemanagermodal.noCreatorsYetAddSomeFromTheNoodlerHub")}</p>}
        </div>
      </div>
    </Modal>
  );
}
