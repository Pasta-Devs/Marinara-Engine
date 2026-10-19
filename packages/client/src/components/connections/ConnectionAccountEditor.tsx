// ──────────────────────────────────────────────
// ConnectionAccountEditor — credentials, status and shared limits for one Connection
// ──────────────────────────────────────────────
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, KeyRound, Loader2, Plus, Trash2, Wifi } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { isChatProvider, type UpdateConnectionAccountInput } from "@marinara-engine/shared";
import { useConnections, useTestConnection } from "../../hooks/use-connections";
import {
  useConnectionAccounts,
  useDeleteConnectionAccount,
  useUpdateConnectionAccount,
} from "../../hooks/use-connection-accounts";
import { ApiError } from "../../lib/api-client";
import { openAddModels } from "../../lib/add-connection";
import { showChoiceDialog, showConfirmDialog } from "../../lib/app-dialogs";
import { groupModelsByAccount, roleBadges, sortByModelId } from "../../lib/connection-groups";
import { getConnectionIdentity } from "../../lib/connection-identity";
import { isConnectionFlagTrue } from "../../lib/connection-filters";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import { SETTINGS_BUTTON_CLASS, ToggleSetting } from "../panels/settings/SettingControls";
import { Modal } from "../ui/Modal";
import { SmoothFolderContent } from "../ui/SmoothFolderContent";
import { ConnectionIdentity } from "./ConnectionIdentity";
import { ConnectionModelList } from "./ConnectionModelList";
import { mediaService, modelSubtitle, type ConnectionRowData } from "./ConnectionRow";
import { ProviderIcon } from "./ProviderIcon";

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
          <span className="mari-chrome-field flex h-9 min-w-0 flex-1 items-center px-3 text-xs text-[var(--muted-foreground)] max-md:min-h-11">
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
  const openConnectionDetail = useUIStore((state) => state.openConnectionDetail);
  const account = accounts?.find((entry) => entry.id === accountId) ?? null;
  const models = sortByModelId(
    groupModelsByAccount((rawRows ?? []) as ConnectionRowData[], accounts ?? []).groups.find(
      (group) => group.account.id === accountId,
    )?.rows ?? [],
  );
  const firstModel = models[0] ?? null;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [managementToken, setManagementToken] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [manage, setManage] = useState(false);
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
    if (!account.hasApiKey) {
      setApiKey("");
      setManage(account.state === "needs_key");
    }
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

  const save = async (close = true): Promise<boolean> => {
    if (!account || !dirty) return true;
    try {
      await update.mutateAsync({ id: account.id, ...changes });
      toast.success(t("connections.accounts.editor.saved"));
      if (close) onClose();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("connections.accounts.editor.saveFailed"));
      return false;
    }
  };

  const leaveFor = async (action: () => void) => {
    if (dirty) {
      const choice = await showChoiceDialog({
        title: t("connections.accounts.editor.unsavedTitle"),
        message: t("connections.accounts.editor.unsavedMessage"),
        choices: [
          { key: "save", label: t("connections.accounts.editor.saveAndContinue") },
          { key: "discard", label: t("connections.accounts.editor.discardAndContinue"), tone: "destructive" },
        ],
        cancelLabel: t("connections.accounts.editor.keepEditing"),
      });
      if (!choice) return;
      if (choice === "save" && !(await save(false))) return;
    }
    onClose();
    action();
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

  const openModel = (id: string) => void leaveFor(() => openConnectionDetail(id));
  const addModel = () => void leaveFor(() => openAddModels({ accountId }));

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
    <Modal
      open
      onClose={() => void leaveFor(() => {})}
      closeDisabled={update.isPending || remove.isPending || test.isPending}
      title={t("connections.accounts.editor.editTitle")}
      opaque
      width="max-w-lg"
    >
      {!account || !draft ? (
        <p className="text-xs text-[var(--muted-foreground)]">
          {isLoading ? <Loader2 size="0.875rem" className="animate-spin" /> : t("connections.accounts.editor.notFound")}
        </p>
      ) : (
        <div className="flex flex-col">
          <div className="mari-connection-group flex flex-wrap items-center gap-3">
            <ConnectionIdentity
              account={account}
              rows={models}
              count={t("connections.list.models", { count: models.length })}
              state={draft.enabled ? (account.state === "needs_key" ? "needs_key" : "ok") : "off"}
              stateLabel={t(
                draft.enabled
                  ? account.state === "needs_key"
                    ? "connections.accounts.editor.configured.needsKey"
                    : "connections.accounts.editor.configured.enabled"
                  : "connections.accounts.editor.configured.disabled",
              )}
            />
            <button
              type="button"
              onClick={() => setManage((value) => !value)}
              aria-expanded={manage}
              aria-controls={manage ? "connection-account-access" : undefined}
              className={cn(
                SETTINGS_BUTTON_CLASS,
                "shrink-0 max-sm:w-full max-sm:justify-center max-md:min-h-11 [@media(pointer:coarse)]:min-h-11",
              )}
            >
              <KeyRound size="0.75rem" />
              {account.state === "needs_key"
                ? t("connections.accounts.editor.repairAccess")
                : t("connections.accounts.editor.manageAccess")}
            </button>
          </div>

          <SmoothFolderContent open={manage}>
            <section
              id="connection-account-access"
              data-account-access
              className="border-b border-[var(--border)]/60 py-4"
            >
              <h3 className="text-xs font-semibold text-[var(--foreground)]">
                {t("connections.accounts.editor.access")}
              </h3>
              <p className="mt-1 max-w-[65ch] text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
                {t("connections.accounts.editor.accessSharedHelp")}
              </p>
              <div className="mt-3 flex flex-col gap-3">
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
                  <span className="min-w-0 truncate">{getConnectionIdentity(account, models).name}</span>
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
              </div>
            </section>
          </SmoothFolderContent>

          <section className="flex flex-col gap-2 border-b border-[var(--border)]/60 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-semibold text-[var(--foreground)]">
                {t("connections.accounts.editor.savedModelTest")}
              </h3>
              <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
                {firstModel
                  ? t("connections.accounts.editor.testScope", { model: firstModel.name || firstModel.model })
                  : t("connections.accounts.addModelFirst")}
              </p>
              <p
                role="status"
                className={cn(
                  "mt-1 break-words text-[0.6875rem]",
                  test.isError || (test.data && !test.data.success)
                    ? "text-[var(--marinara-app-accent-static)]"
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
                      : dirty
                        ? t("connections.accounts.editor.testUsesSaved")
                        : t("connections.accounts.editor.notTested")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => firstModel && test.mutate(firstModel.id)}
              disabled={!firstModel || test.isPending}
              className={cn(SETTINGS_BUTTON_CLASS, "shrink-0 self-start max-md:min-h-11 sm:self-center")}
            >
              {test.isPending ? <Loader2 size="0.75rem" className="animate-spin" /> : <Wifi size="0.75rem" />}
              {t("connections.accounts.editor.testSavedModel")}
            </button>
          </section>

          <div className="border-b border-[var(--border)]/60 py-1.5">
            <ToggleSetting
              label={t("connections.accounts.editor.enabled")}
              help={t("connections.accounts.editor.enabledHelp")}
              checked={draft.enabled}
              onChange={(checked) => set("enabled", checked)}
            />
          </div>

          <section className="py-4">
            <div className="mb-2 flex items-center justify-between gap-3 px-1">
              <h3 className="text-xs font-semibold text-[var(--foreground)]">
                {t("connections.accounts.editor.models", { count: models.length })}
              </h3>
            </div>
            <ConnectionModelList
              provider={account.provider}
              rows={models}
              getKey={(row) => row.id}
              className="overflow-hidden rounded-lg bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)]"
              empty={
                <p className="px-3 py-3 text-[0.6875rem] text-[var(--muted-foreground)]">
                  {t("connections.accounts.noModels")}
                </p>
              }
              renderRow={(row, upstream) => {
                const chat = isChatProvider(row.provider);
                const kind =
                  row.provider === "image_generation"
                    ? "image"
                    : row.provider === "video_generation"
                      ? "video"
                      : row.provider === "audio"
                        ? "audio"
                        : null;
                const typeLabel = kind
                  ? t(`connections.accounts.kind.${kind}`)
                  : chat
                    ? t("connections.accounts.section.chat")
                    : t("connections.decision.label");
                const roles = chat
                  ? roleBadges(row).map((role) => t(`connections.switcher.role.${role}`))
                  : [
                      ...(isConnectionFlagTrue(row.defaultForAgents) ? [t("connections.accounts.badge.default")] : []),
                      ...(isConnectionFlagTrue(row.fallbackForAgents) ? [t("connections.switcher.role.fallback")] : []),
                    ];
                return (
                  <button
                    type="button"
                    data-account-model-id={row.id}
                    aria-label={row.name}
                    onClick={() => openModel(row.id)}
                    className="flex min-h-11 w-full min-w-0 items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
                  >
                    <ProviderIcon
                      provider={row.provider === "decision" ? row.provider : account.provider}
                      baseUrl={account.baseUrl}
                      service={mediaService(row)}
                      model={row.model}
                      name={row.name}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-[var(--foreground)]">{row.name}</span>
                      <span className="mt-0.5 block truncate text-[0.6875rem] text-[var(--muted-foreground)]">
                        {modelSubtitle(row, upstream)}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-wrap items-center justify-end gap-1 text-[0.6875rem] text-[var(--muted-foreground)]">
                      <span>{typeLabel}</span>
                      {roles.map((role) => (
                        <span
                          key={role}
                          className="rounded-md bg-foreground/[0.07] px-1.5 py-0.5 font-medium text-[var(--foreground)]"
                        >
                          {role}
                        </span>
                      ))}
                    </span>
                    <ChevronRight size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" aria-hidden />
                  </button>
                );
              }}
              footer={
                <button
                  type="button"
                  data-add-model
                  onClick={addModel}
                  className="flex min-h-11 w-full items-center gap-3 px-3 text-left text-[0.6875rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-foreground/[0.04] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
                >
                  <Plus size="0.75rem" />
                  {t("connections.accounts.addModel")}
                </button>
              }
            />
          </section>

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
            <section data-account-advanced className="border-t border-[var(--border)]/60 py-4">
              <h3 className="text-xs font-semibold text-[var(--foreground)]">
                {t("connections.accounts.editor.sharedUsageAndLimits")}
              </h3>
              <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
                {t("connections.accounts.editor.capsHelp")}
              </p>
              <div className="mt-3 flex flex-col gap-3">
                <SecretField
                  label={t("connections.accounts.editor.managementToken")}
                  saved={account.hasManagementToken}
                  value={managementToken}
                  onChange={setManagementToken}
                />
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
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {capInput("maxRequestsPerMinute", 600, t("connections.accounts.editor.maxRequestsPerMinute"))}
                  {capInput("maxParallelJobs", 16, t("connections.accounts.editor.maxParallelJobs"))}
                </div>
              </div>
            </section>
          </SmoothFolderContent>

          <section className="flex flex-col gap-2 border-t border-[var(--border)]/60 py-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-semibold text-[var(--marinara-app-accent-static)]">
                {t("connections.accounts.editor.delete")}
              </h3>
              <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
                {t("connections.accounts.editor.deleteHelp")}
              </p>
              {blockedBy.length > 0 && (
                <div role="status" className="mt-2 text-[0.6875rem]">
                  <p className="text-[var(--marinara-app-accent-static)]">
                    {t("connections.accounts.editor.deleteBlocked")}
                  </p>
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
            </div>
            <button
              type="button"
              onClick={() => void deleteAccount()}
              disabled={remove.isPending}
              className={cn(
                SETTINGS_BUTTON_CLASS,
                "mari-chrome-control--danger shrink-0 self-start max-md:min-h-11 sm:self-center",
              )}
            >
              <Trash2 size="0.75rem" />
              {t("connections.accounts.editor.deleteShort")}
            </button>
          </section>

          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-3 max-md:sticky max-md:bottom-0 max-md:z-10 max-md:-mx-5 max-md:-mb-4 max-md:bg-[var(--sidebar)] max-md:px-5 max-md:pb-4">
            <button
              type="button"
              onClick={() => void leaveFor(() => {})}
              disabled={update.isPending || remove.isPending || test.isPending}
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
