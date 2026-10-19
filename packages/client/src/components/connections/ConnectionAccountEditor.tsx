// ──────────────────────────────────────────────
// ConnectionAccountEditor — picture, name, address, key, models and shared limits for one Connection
// ──────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import { Camera, ChevronRight, Loader2, Trash2, Wifi } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  isChatProvider,
  type ConnectionAccountState,
  type UpdateConnectionAccountInput,
} from "@marinara-engine/shared";
import { useConnections, useTestConnection } from "../../hooks/use-connections";
import {
  useConnectionAccounts,
  useDeleteConnectionAccount,
  useUpdateConnectionAccount,
} from "../../hooks/use-connection-accounts";
import { ApiError } from "../../lib/api-client";
import { openAddModels } from "../../lib/add-connection";
import { showChoiceDialog, showConfirmDialog } from "../../lib/app-dialogs";
import { groupModelsByAccount, sortByModelId } from "../../lib/connection-groups";
import { getConnectionIdentity, modelKindOf, serviceName } from "../../lib/connection-identity";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import { ToggleSetting } from "../panels/settings/SettingControls";
import { Modal } from "../ui/Modal";
import { SmoothFolderContent } from "../ui/SmoothFolderContent";
import { ConnectionModelList } from "./ConnectionModelList";
import {
  confirmAccountDelete,
  deleteAccountModels,
  mediaService,
  menuAt,
  ModelRow,
  modelRoleLabels,
  modelSubtitle,
  type ConnectionRowData,
  type MenuAt,
} from "./ConnectionRow";
import { PICTURE_MENU_SELECTOR, PictureMenu } from "./PictureMenu";
import { StateWord, type EngineTone } from "./DeviceDetail";
import { ProviderIcon } from "./ProviderIcon";
import { CompactUsageMeter } from "./SubscriptionUsageWidget";
import { resolveUsageConnection } from "../../lib/connection-filters";
import { starAnchorOf } from "../../hooks/use-model-star";

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
const STATE_TONE: Record<ConnectionAccountState, EngineTone> = { ok: "ok", off: "off", needs_key: "warn" };
const labelClass = "mb-1 block text-xs font-semibold text-[var(--foreground)]";
const fieldClass = "mari-chrome-field h-11 w-full px-3 text-xs md:h-9";

function SecretField({
  label,
  saved,
  last4,
  value,
  onChange,
  help,
  autoFocus,
}: {
  label: string;
  saved: boolean;
  last4?: string;
  /** Null while the saved secret is kept. */
  value: string | null;
  onChange: (value: string | null) => void;
  help?: string;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const masked = saved && value === null;
  // A masked key is text plus a Replace button; a <label> around them would rename the button after the field.
  const Wrapper = masked ? "div" : "label";
  return (
    <div>
      <Wrapper className="block">
        <span className={labelClass}>{label}</span>
        {masked ? (
          <span className="mari-chrome-field flex h-11 items-center gap-2 pl-3 pr-1 md:h-9">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--muted-foreground)]">
              {last4 ? t("connections.accounts.editor.keyEnding", { last4 }) : "••••••••"}
            </span>
            <button
              type="button"
              onClick={() => onChange("")}
              className="min-h-11 shrink-0 rounded-md px-2 text-xs font-semibold text-[var(--primary)] hover:underline md:min-h-7"
            >
              {t("connections.accounts.editor.replace")}
            </button>
          </span>
        ) : (
          <input
            type="password"
            autoComplete="off"
            autoFocus={autoFocus}
            value={value ?? ""}
            onChange={(event) => onChange(event.target.value)}
            placeholder={t("connections.accounts.editor.keyPlaceholder")}
            className={cn(fieldClass, "font-mono")}
          />
        )}
      </Wrapper>
      {help && <p className="mt-1 text-[0.6875rem] text-[var(--muted-foreground)]">{help}</p>}
    </div>
  );
}

export function ConnectionAccountEditor({
  accountId,
  replaceKey = false,
  onClose,
}: {
  accountId: string;
  /** Opened from "Replace key": the key field starts empty and focused. */
  replaceKey?: boolean;
  onClose: () => void;
}) {
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
  // The usage meter reads the same anchor as the card's, so both share one request.
  const usageAnchor = starAnchorOf(models) ?? models[0] ?? null;
  // The test checks the Connection's key and address through one of its Models; a chat Model asks the catalog.
  const testRow =
    models.find((row) => isChatProvider(row.provider)) ??
    models.find((row) => row.provider !== "video_generation") ??
    models[0] ??
    null;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [managementToken, setManagementToken] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [pictureAt, setPictureAt] = useState<MenuAt | null>(null);
  const closePicture = useCallback(() => setPictureAt(null), []);
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
    if (!account.hasApiKey || replaceKey) setApiKey("");
  }, [account, draft, replaceKey]);

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
  const accessDirty = changes.apiKey !== undefined || changes.baseUrl !== undefined;

  const save = async (close = true): Promise<boolean> => {
    if (!account || !dirty) return true;
    try {
      const saved = await update.mutateAsync({ id: account.id, ...changes });
      toast.success(t("connections.accounts.editor.saved"));
      const others = saved.sameKeyAccounts ?? [];
      if (changes.apiKey && others.length) {
        const confirmed = await showConfirmDialog({
          title: t("connections.accounts.editor.sameKeyTitle"),
          message: t("connections.accounts.editor.sameKeyMessage", {
            count: others.length,
            names: others.map((other) => other.name).join(", "),
          }),
          confirmLabel: t("connections.accounts.editor.sameKeyUpdate", { count: others.length }),
        });
        if (confirmed) {
          await Promise.all(others.map((other) => update.mutateAsync({ id: other.id, apiKey: changes.apiKey })));
          toast.success(t("connections.accounts.editor.sameKeyUpdated", { count: others.length }));
        }
      }
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
    if (!(await confirmAccountDelete(account.name, models, t))) return;
    try {
      await deleteAccountModels(models);
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

  const rolesOf = (row: ConnectionRowData) => modelRoleLabels(row, t);
  const openModel = (id: string) => void leaveFor(() => openConnectionDetail(id));
  const addModel = () => void leaveFor(() => openAddModels({ accountId }));

  const capInput = (key: "maxRequestsPerMinute" | "maxParallelJobs", max: number, text: string) => (
    <label className="block min-w-0">
      <span className={labelClass}>{text}</span>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        value={draft?.[key] ?? ""}
        onChange={(event) => set(key, event.target.value)}
        placeholder={t("connections.accounts.editor.noLimit")}
        className={fieldClass}
      />
    </label>
  );

  const state: ConnectionAccountState = draft?.enabled ? (account?.state === "needs_key" ? "needs_key" : "ok") : "off";
  const testFailed = test.isError || (!!test.data && !test.data.success);
  const testText = test.isPending
    ? t("connections.accounts.editor.testing")
    : test.data?.success
      ? t("connections.accounts.editor.testOk", { latency: test.data.latencyMs })
      : test.data
        ? test.data.message
        : test.isError
          ? t("connections.accounts.testFailed")
          : !testRow
            ? t("connections.accounts.addModelFirst")
            : accessDirty
              ? t("connections.accounts.editor.testUsesDraft")
              : "";

  const tile = account && (
    <ProviderIcon
      provider={account.provider}
      baseUrl={account.baseUrl}
      service={getConnectionIdentity(account, models).service}
      name={account.name}
      icon={account.icon}
      imagePath={account.imagePath}
      size="add"
    />
  );

  return (
    <Modal
      open
      onClose={() => void leaveFor(() => {})}
      // While the picture menu is open, Escape and the backdrop close only the menu.
      closeDisabled={update.isPending || remove.isPending || test.isPending || !!pictureAt}
      focusScopePortalSelector={PICTURE_MENU_SELECTOR}
      title={t("connections.accounts.editor.editTitle")}
      opaque
      width="max-w-lg"
      panelClassName="mari-connection-scope"
    >
      {!account || !draft ? (
        <p className="text-xs text-[var(--muted-foreground)]">
          {isLoading ? <Loader2 size="0.875rem" className="animate-spin" /> : t("connections.accounts.editor.notFound")}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              data-account-picture
              onClick={(event) => setPictureAt(menuAt(event))}
              aria-label={t("connections.picture.change", { name: account.name })}
              title={t("connections.picture.change", { name: account.name })}
              className="relative shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
            >
              {tile}
              <span
                aria-hidden
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--card)] text-[var(--foreground)] shadow ring-1 ring-[var(--border)]"
              >
                <Camera size="0.75rem" />
              </span>
            </button>
            {pictureAt && (
              <PictureMenu
                target={{ kind: "account", id: account.id }}
                name={account.name}
                icon={account.icon}
                imagePath={account.imagePath}
                at={pictureAt}
                onClose={closePicture}
              />
            )}
            <div className="min-w-0 flex-1">
              <input
                value={draft.name}
                onChange={(event) => set("name", event.target.value)}
                aria-label={t("connections.accounts.editor.name")}
                data-account-name
                className="mari-chrome-field h-10 w-full px-3 text-[0.9375rem] font-semibold"
              />
              <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[0.6875rem] text-[var(--muted-foreground)]">
                <span className="min-w-0 truncate">
                  {serviceName(getConnectionIdentity(account, models).service, account.provider)} ·{" "}
                  {t("connections.list.models", { count: models.length })}
                </span>
                {state !== "ok" && (
                  <StateWord tone={STATE_TONE[state]} label={t(`connections.accounts.state.${state}`)} />
                )}
              </p>
              {usageAnchor && resolveUsageConnection([account], account.id) && (
                <CompactUsageMeter
                  connectionId={usageAnchor.id}
                  showFiveHour={account.showUsageFiveHour}
                  showWeekly={account.showUsageWeekly}
                  className="mt-1"
                />
              )}
            </div>
          </div>

          <label className="block">
            <span className={labelClass}>{t("connections.accounts.editor.address")}</span>
            <input
              value={draft.baseUrl}
              onChange={(event) => {
                set("baseUrl", event.target.value);
                test.reset();
              }}
              placeholder={t("connections.accounts.editor.endpointPlaceholder")}
              inputMode="url"
              spellCheck={false}
              autoCapitalize="off"
              data-account-address
              className={fieldClass}
            />
          </label>

          <SecretField
            label={t("connections.accounts.editor.apiKey")}
            saved={account.hasApiKey}
            last4={account.apiKeyLast4}
            value={apiKey}
            onChange={(value) => {
              setApiKey(value);
              test.reset();
            }}
            help={t("connections.accounts.editor.keySaved")}
            autoFocus={account.state === "needs_key" || replaceKey}
          />

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              // Tests the key and address as typed, so a wrong key is caught before it is saved.
              onClick={() =>
                testRow && test.mutate({ id: testRow.id, apiKey: changes.apiKey, baseUrl: changes.baseUrl })
              }
              disabled={!testRow || test.isPending}
              className="mari-connection-btn"
            >
              {test.isPending ? <Loader2 size="0.75rem" className="animate-spin" /> : <Wifi size="0.75rem" />}
              {t("connections.accounts.editor.test")}
            </button>
            <p
              role="status"
              data-account-test-result
              className={cn(
                "min-w-0 flex-1 break-words text-[0.6875rem]",
                testFailed
                  ? "text-[color-mix(in_srgb,var(--color-amber-500)_78%,var(--foreground)_22%)]"
                  : test.data?.success
                    ? "text-emerald-500"
                    : "text-[var(--muted-foreground)]",
              )}
            >
              {testText}
            </p>
          </div>

          <div className="-mx-1.5 border-y border-[var(--border)]/60 py-1">
            <ToggleSetting
              label={t("connections.accounts.editor.enabled")}
              help={t("connections.accounts.editor.enabledHelp")}
              checked={draft.enabled}
              onChange={(checked) => set("enabled", checked)}
            />
          </div>

          <section>
            <h3 className="mb-2 flex items-baseline gap-1.5 px-1 text-xs font-semibold text-[var(--foreground)]">
              {t("connections.accounts.editor.modelsHeading")}
              <span className="font-normal text-[var(--muted-foreground)]">{models.length}</span>
            </h3>
            <ConnectionModelList
              provider={account.provider}
              rows={models}
              getKey={(row) => row.id}
              empty={
                <p className="px-3 py-3 text-[0.6875rem] text-[var(--muted-foreground)]">
                  {t("connections.accounts.noModels")}
                </p>
              }
              rolesOf={rolesOf}
              onAddModels={addModel}
              renderRow={(row, upstream) => (
                <ModelRow
                  data-account-model-id={row.id}
                  onClick={() => openModel(row.id)}
                  aria-label={t("connections.row.edit", { name: row.name })}
                  tile={
                    <ProviderIcon
                      provider={row.provider === "decision" ? row.provider : account.provider}
                      baseUrl={account.baseUrl}
                      service={mediaService(row)}
                      model={row.model}
                      name={row.name}
                      icon={row.icon}
                      imagePath={row.imagePath}
                      size="row"
                    />
                  }
                  title={row.name?.trim() || row.model}
                  tooltip={row.model && row.model !== row.name ? [row.name, row.model].join("\n") : row.name}
                  subtitle={modelSubtitle(row, upstream)}
                  kind={modelKindOf(row.provider)}
                  roles={rolesOf(row)}
                  customized={isChatProvider(row.provider) && !!row.ownSettings}
                  trailing={
                    <ChevronRight size="1rem" className="shrink-0 text-[var(--muted-foreground)]" aria-hidden />
                  }
                />
              )}
            />
          </section>

          <div>
            <button
              type="button"
              onClick={() => setMore((value) => !value)}
              aria-expanded={more}
              aria-controls="connection-account-more"
              className="flex min-h-11 items-center gap-1.5 text-left text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] md:min-h-9"
            >
              <ChevronRight
                size="0.75rem"
                className={cn("shrink-0 transition-transform", more && "rotate-90")}
                aria-hidden
              />
              <span>
                <span className="font-medium text-[var(--foreground)]">
                  {t("connections.accounts.editor.moreOptions")}
                </span>{" "}
                · {t("connections.accounts.editor.moreOptionsHint")}
              </span>
            </button>
            <SmoothFolderContent open={more}>
              <section id="connection-account-more" data-account-advanced className="flex flex-col gap-3 pb-1 pt-2">
                <p className="text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
                  {t("connections.accounts.editor.capsHelp")}
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {capInput("maxRequestsPerMinute", 600, t("connections.accounts.editor.maxRequestsPerMinute"))}
                  {capInput("maxParallelJobs", 16, t("connections.accounts.editor.maxParallelJobs"))}
                </div>
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
                <SecretField
                  label={t("connections.accounts.editor.managementToken")}
                  saved={account.hasManagementToken}
                  value={managementToken}
                  onChange={setManagementToken}
                  help={t("connections.accounts.editor.managementTokenHelp")}
                />
              </section>
            </SmoothFolderContent>
          </div>

          <div>
            <button
              type="button"
              onClick={() => void deleteAccount()}
              disabled={remove.isPending}
              className="flex min-h-11 items-center gap-2 text-xs font-semibold text-[var(--marinara-app-accent-static)] hover:underline disabled:opacity-50 md:min-h-9"
            >
              <Trash2 size="0.875rem" aria-hidden />
              {t("connections.accounts.editor.delete")}
            </button>
            {blockedBy.length > 0 && (
              <div role="status" className="mt-1 text-[0.6875rem]">
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

          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-3 max-md:sticky max-md:bottom-0 max-md:z-10 max-md:-mx-5 max-md:-mb-4 max-md:bg-[var(--sidebar)] max-md:px-5 max-md:pb-4">
            <button
              type="button"
              onClick={() => void leaveFor(() => {})}
              disabled={update.isPending || remove.isPending || test.isPending}
              className="mari-connection-btn"
            >
              {t("connections.accounts.editor.cancel")}
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || update.isPending}
              className="mari-connection-btn mari-connection-btn--primary"
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
