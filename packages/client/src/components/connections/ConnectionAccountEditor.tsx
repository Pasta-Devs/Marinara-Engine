// ──────────────────────────────────────────────
// ConnectionAccountEditor — a Connection's credentials and limits, once for all its Models
// ──────────────────────────────────────────────
import { useEffect, useState } from "react";
import { Boxes, ChevronDown, ChevronRight, KeyRound, Loader2, Plus, Trash2, Wifi } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  PROVIDERS,
  isChatProvider,
  type APIProvider,
  type UpdateConnectionAccountInput,
} from "@marinara-engine/shared";
import { useConnections, useTestConnection } from "../../hooks/use-connections";
import {
  useConnectionAccounts,
  useDeleteConnectionAccount,
  useUpdateConnectionAccount,
} from "../../hooks/use-connection-accounts";
import { ApiError } from "../../lib/api-client";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { useUIStore } from "../../stores/ui.store";
import { openAddModels } from "../../lib/add-connection";
import { cn } from "../../lib/utils";
import { Modal } from "../ui/Modal";
import { SmoothFolderContent } from "../ui/SmoothFolderContent";
import { SETTINGS_BUTTON_CLASS, SettingsSection, ToggleSetting } from "../panels/settings/SettingControls";
import type { ConnectionRowData } from "./ConnectionRow";

type Draft = {
  name: string;
  baseUrl: string;
  enabled: boolean;
  showUsageWidget: boolean;
  showUsageFiveHour: boolean;
  showUsageWeekly: boolean;
  maxRequestsPerMinute: string;
  maxParallelJobs: string;
};

const capValue = (value: string) => (value.trim() ? Number(value) : null);

function SecretField({
  label,
  saved,
  last4,
  value,
  onChange,
}: {
  label: string;
  saved: boolean;
  last4?: string;
  /** Null while the saved secret is kept. */
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <label className="block">
      <span className="mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]">{label}</span>
      {saved && value === null ? (
        <div className="flex items-center gap-2">
          <span className="mari-chrome-field flex h-9 min-w-0 flex-1 max-md:min-h-11 items-center px-3 text-xs text-[var(--muted-foreground)]">
            {last4 ? t("connections.accounts.editor.keyEnding", { last4 }) : "••••••••"}
          </span>
          <button
            type="button"
            onClick={() => onChange("")}
            className="mari-chrome-control mari-chrome-control--small h-9 text-[0.6875rem] max-md:min-h-11"
          >
            {t("connections.accounts.editor.replace")}
          </button>
        </div>
      ) : (
        <input
          type="password"
          autoComplete="off"
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("connections.accounts.editor.keyPlaceholder")}
          className="mari-chrome-field h-9 w-full px-3 text-xs max-md:min-h-11"
        />
      )}
    </label>
  );
}

export function ConnectionAccountEditor({ accountId, onClose }: { accountId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: accounts, isLoading } = useConnectionAccounts();
  const { data: rawRows } = useConnections();
  const update = useUpdateConnectionAccount();
  const remove = useDeleteConnectionAccount();
  const test = useTestConnection();
  const openConnectionDetail = useUIStore((s) => s.openConnectionDetail);
  const account = accounts?.find((entry) => entry.id === accountId) ?? null;
  const models = ((rawRows ?? []) as ConnectionRowData[]).filter((row) => row.accountId === accountId);
  const firstModel = models[0] ?? null;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [managementToken, setManagementToken] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [blockedBy, setBlockedBy] = useState<Array<{ id: string; name: string; model?: string }>>([]);

  useEffect(() => {
    if (!account || draft) return;
    setDraft({
      name: account.name,
      baseUrl: account.baseUrl,
      enabled: account.enabled,
      showUsageWidget: account.showUsageWidget,
      showUsageFiveHour: account.showUsageFiveHour,
      showUsageWeekly: account.showUsageWeekly,
      maxRequestsPerMinute: account.maxRequestsPerMinute?.toString() ?? "",
      maxParallelJobs: account.maxParallelJobs?.toString() ?? "",
    });
    // A key that was never saved has nothing to keep, so its field starts open.
    if (!account.hasApiKey) setApiKey("");
  }, [account, draft]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));

  const changes: UpdateConnectionAccountInput = {};
  if (account && draft) {
    if (draft.name.trim() && draft.name.trim() !== account.name) changes.name = draft.name.trim();
    if (draft.baseUrl.trim() !== account.baseUrl) changes.baseUrl = draft.baseUrl.trim();
    if (draft.enabled !== account.enabled) changes.enabled = draft.enabled;
    if (draft.showUsageWidget !== account.showUsageWidget) changes.showUsageWidget = draft.showUsageWidget;
    if (draft.showUsageFiveHour !== account.showUsageFiveHour) changes.showUsageFiveHour = draft.showUsageFiveHour;
    if (draft.showUsageWeekly !== account.showUsageWeekly) changes.showUsageWeekly = draft.showUsageWeekly;
    const rpm = capValue(draft.maxRequestsPerMinute);
    if (rpm !== account.maxRequestsPerMinute) changes.maxRequestsPerMinute = rpm;
    const parallel = capValue(draft.maxParallelJobs);
    if (parallel !== account.maxParallelJobs) changes.maxParallelJobs = parallel;
    if (apiKey) changes.apiKey = apiKey;
    if (managementToken) changes.managementToken = managementToken;
  }
  const dirty = Object.keys(changes).length > 0;

  const save = async () => {
    if (!account || !dirty) return;
    try {
      await update.mutateAsync({ id: account.id, ...changes });
      toast.success(t("connections.accounts.editor.saved"));
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("connections.accounts.editor.saveFailed"));
    }
  };

  const deleteAccount = async () => {
    if (!account) return;
    const confirmed = await showConfirmDialog({
      title: t("connections.accounts.editor.delete"),
      message: t("connections.accounts.editor.deleteConfirm", { name: account.name }),
      confirmLabel: t("connections.accounts.editor.delete"),
      tone: "destructive",
    });
    if (!confirmed) return;
    try {
      await remove.mutateAsync(account.id);
      onClose();
    } catch (error) {
      const blocked =
        error instanceof ApiError && error.status === 409
          ? ((error.payload as { models?: Array<{ id: string; name: string; model?: string }> } | undefined)?.models ??
            [])
          : null;
      if (blocked) setBlockedBy(blocked);
      else toast.error(error instanceof Error ? error.message : t("connections.accounts.editor.deleteFailed"));
    }
  };

  const openModel = (id: string) => {
    onClose();
    openConnectionDetail(id);
  };

  const label = (text: string) => (
    <span className="mb-1 block text-[0.6875rem] font-medium text-[var(--muted-foreground)]">{text}</span>
  );
  const capInput = (key: "maxRequestsPerMinute" | "maxParallelJobs", max: number, text: string) => (
    <label className="block min-w-0">
      {label(text)}
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        value={draft?.[key] ?? ""}
        onChange={(event) => set(key, event.target.value)}
        placeholder={t("connections.accounts.editor.noLimit")}
        className="mari-chrome-field h-9 w-full px-3 text-xs max-md:min-h-11"
      />
    </label>
  );

  return (
    <Modal open onClose={onClose} title={account?.name ?? t("connections.accounts.editor.title")}>
      {!account || !draft ? (
        <p className="text-xs text-[var(--muted-foreground)]">
          {isLoading ? <Loader2 size="0.875rem" className="animate-spin" /> : t("connections.accounts.editor.notFound")}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <SettingsSection
            title={t("connections.accounts.editor.access")}
            icon={<KeyRound size="0.875rem" />}
            contentClassName="flex flex-col gap-3"
          >
            <label className="block">
              {label(t("connections.accounts.editor.name"))}
              <input
                value={draft.name}
                onChange={(event) => set("name", event.target.value)}
                className="mari-chrome-field h-9 w-full px-3 text-xs max-md:min-h-11"
              />
            </label>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
                {t("connections.accounts.editor.service")}
              </span>
              <span className="min-w-0 truncate">
                {PROVIDERS[account.provider as APIProvider]?.name ?? account.provider}
              </span>
            </div>
            <label className="block">
              {label(t("connections.accounts.editor.endpoint"))}
              <input
                value={draft.baseUrl}
                onChange={(event) => set("baseUrl", event.target.value)}
                placeholder={t("connections.accounts.editor.endpointPlaceholder")}
                inputMode="url"
                className="mari-chrome-field h-9 w-full px-3 text-xs max-md:min-h-11"
              />
            </label>
            <SecretField
              label={t("connections.accounts.editor.apiKey")}
              saved={account.hasApiKey}
              last4={account.apiKeyLast4}
              value={apiKey}
              onChange={setApiKey}
            />
            {/* The Test row keeps its result beside it, so the answer lands where the question was asked. */}
            <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)]/40 p-1.5 ring-1 ring-[var(--border)]/60">
              <button
                type="button"
                onClick={() => firstModel && test.mutate(firstModel.id)}
                disabled={!firstModel || test.isPending}
                className={cn(SETTINGS_BUTTON_CLASS, "shrink-0 max-md:min-h-11")}
              >
                {test.isPending ? <Loader2 size="0.75rem" className="animate-spin" /> : <Wifi size="0.75rem" />}
                {t("connections.accounts.test")}
              </button>
              <span
                role="status"
                className={cn(
                  "min-w-0 flex-1 break-words text-[0.6875rem]",
                  test.isError || (test.data && !test.data.success)
                    ? "text-[var(--destructive)]"
                    : "text-[var(--muted-foreground)]",
                )}
              >
                {test.isPending
                  ? t("connections.accounts.editor.testing")
                  : test.data
                    ? test.data.success
                      ? t("connections.accounts.testOk", { latency: test.data.latencyMs })
                      : test.data.message
                    : test.isError
                      ? t("connections.accounts.testFailed")
                      : !firstModel
                        ? t("connections.accounts.addModelFirst")
                        : dirty
                          ? t("connections.accounts.editor.testUsesSaved")
                          : t("connections.accounts.editor.notTested")}
              </span>
            </div>
          </SettingsSection>

          <div className="rounded-lg border border-[var(--border)]/70 px-1.5 py-1">
            <ToggleSetting
              label={t("connections.accounts.editor.enabled")}
              help={t("connections.accounts.editor.enabledHelp")}
              checked={draft.enabled}
              onChange={(checked) => set("enabled", checked)}
            />
          </div>

          <SettingsSection
            title={t("connections.accounts.editor.models", { count: models.length })}
            icon={<Boxes size="0.875rem" />}
            contentClassName="p-1"
          >
            {models.length === 0 ? (
              <p className="px-2 py-1.5 text-[0.6875rem] text-[var(--muted-foreground)]">
                {t("connections.accounts.noModels")}
              </p>
            ) : (
              <ul>
                {models.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => openModel(row.id)}
                      className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[var(--sidebar-accent)] md:min-h-9"
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-xs">{row.name}</span>
                        {row.model && (
                          <span className="truncate text-[0.625rem] text-[var(--muted-foreground)]">{row.model}</span>
                        )}
                      </span>
                      <ChevronRight size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {models.some((row) => isChatProvider(row.provider ?? "")) && (
              <button
                type="button"
                data-add-model
                onClick={() => openAddModels({ accountId })}
                className="mari-chrome-control mari-chrome-control--small m-1 w-fit text-[0.6875rem] max-md:min-h-11"
              >
                <Plus size="0.75rem" />
                {t("connections.accounts.addModel")}
              </button>
            )}
          </SettingsSection>

          <button
            type="button"
            onClick={() => setMore((value) => !value)}
            aria-expanded={more}
            className="flex min-h-11 items-center gap-1.5 self-start text-[0.6875rem] font-medium text-[var(--muted-foreground)] md:min-h-9"
          >
            <ChevronDown size="0.75rem" className={cn("transition-transform", more && "rotate-180")} />
            {t("connections.accounts.editor.advanced")}
          </button>
          <SmoothFolderContent open={more}>
            <div data-account-advanced className="flex flex-col gap-3 pb-1">
              <SettingsSection
                title={t("connections.accounts.editor.usageAndLimits")}
                contentClassName="flex flex-col gap-2"
              >
                <SecretField
                  label={t("connections.accounts.editor.managementToken")}
                  saved={account.hasManagementToken}
                  value={managementToken}
                  onChange={setManagementToken}
                />
                {/* The toggles' own padding lines their labels up with the fields above. */}
                <div className="-mx-1.5">
                  <ToggleSetting
                    label={t("connections.accounts.editor.showUsage")}
                    checked={draft.showUsageWidget}
                    onChange={(checked) => set("showUsageWidget", checked)}
                  />
                  {draft.showUsageWidget && (
                    <>
                      <ToggleSetting
                        label={t("connections.accounts.editor.showUsageFiveHour")}
                        checked={draft.showUsageFiveHour}
                        onChange={(checked) => set("showUsageFiveHour", checked)}
                      />
                      <ToggleSetting
                        label={t("connections.accounts.editor.showUsageWeekly")}
                        checked={draft.showUsageWeekly}
                        onChange={(checked) => set("showUsageWeekly", checked)}
                      />
                    </>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {capInput("maxRequestsPerMinute", 600, t("connections.accounts.editor.maxRequestsPerMinute"))}
                  {capInput("maxParallelJobs", 16, t("connections.accounts.editor.maxParallelJobs"))}
                </div>
                <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                  {t("connections.accounts.editor.capsHelp")}
                </p>
              </SettingsSection>
              <SettingsSection
                title={t("connections.accounts.editor.delete")}
                description={t("connections.accounts.editor.deleteHelp")}
                tone="danger"
                headerAction={
                  <button
                    type="button"
                    onClick={() => void deleteAccount()}
                    disabled={remove.isPending}
                    aria-label={t("connections.accounts.editor.delete")}
                    className={cn(SETTINGS_BUTTON_CLASS, "mari-chrome-control--danger max-md:min-h-11")}
                  >
                    <Trash2 size="0.75rem" />
                    {t("connections.accounts.editor.deleteShort")}
                  </button>
                }
                contentClassName={blockedBy.length > 0 ? undefined : "hidden"}
              >
                {blockedBy.length > 0 && (
                  <div role="status" className="text-[0.6875rem]">
                    <p className="text-[var(--destructive)]">{t("connections.accounts.editor.deleteBlocked")}</p>
                    <ul className="mt-1 space-y-0.5">
                      {blockedBy.map((row) => (
                        <li key={row.id}>
                          <button type="button" onClick={() => openModel(row.id)} className="text-left underline">
                            {row.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </SettingsSection>
            </div>
          </SmoothFolderContent>

          {/* On a phone the footer stays in reach while the form scrolls. */}
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-3 max-md:sticky max-md:bottom-0 max-md:z-10 max-md:-mx-5 max-md:-mb-4 max-md:bg-[var(--sidebar)] max-md:px-5 max-md:pb-4">
            <button
              type="button"
              onClick={onClose}
              className="mari-chrome-control mari-chrome-control--small text-xs max-md:min-h-11"
            >
              {t("connections.accounts.editor.cancel")}
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || update.isPending}
              className="mari-panel-gradient-button mari-panel-gradient--connections px-3 text-xs max-md:min-h-11"
            >
              {update.isPending && <Loader2 size="0.75rem" className="animate-spin" />}
              {t("connections.accounts.editor.save")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
