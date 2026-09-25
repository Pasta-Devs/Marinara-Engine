import { useMemo, useState } from "react";
import { Check, ExternalLink, GitFork, Loader2, Plus, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import {
  CUSTOM_AGENT_PERMISSIONS_EXPLICIT_SETTING,
  normalizeCustomAgentCapabilities,
  type CustomAgentCapability,
  type CustomAgentRepositoryChange,
  type CustomAgentRepositoryPreview,
  type CustomAgentRepositoryRulesetChange,
  type CustomAgentRepositoryRulesetResult,
} from "@marinara-engine/shared";
import { toast } from "sonner";
import {
  useAddCustomAgentRepository,
  useCustomAgentRepositories,
  usePreviewCustomAgentRepository,
  useRemoveCustomAgentRepository,
  useSyncCustomAgentRepository,
} from "../../hooks/use-custom-agent-repositories";
import { getPrivilegedActionErrorMessage } from "../../lib/api-client";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { Modal } from "../ui/Modal";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useAgentImportPolicy } from "../../hooks/use-agents";

const TRUST_WARNING =
  "This repo and its agents are not affiliated with or vetted by PastaDevs. Custom agents can run tools, send prompts to your configured connections, and change behavior on every sync. Only add repos from people or sources you trust.";

const STATUS_LABELS: Record<CustomAgentRepositoryChange["status"], string> = {
  new: "New",
  updated: "Updated",
  unchanged: "Unchanged",
  removed: "No longer published",
};

const RULESET_STATUS_KEYS: Record<CustomAgentRepositoryRulesetChange["status"], string> = {
  new: "ui.agents.customagentrepositoriesmodal.rulesetStatusNew",
  "new-version": "ui.agents.customagentrepositoriesmodal.rulesetStatusNewVersion",
  unchanged: "ui.agents.customagentrepositoriesmodal.rulesetStatusUnchanged",
  conflict: "ui.agents.customagentrepositoriesmodal.rulesetStatusConflict",
  invalid: "ui.agents.customagentrepositoriesmodal.rulesetStatusInvalid",
};

/** The rulesets this confirm would actually install. A conflicting or unusable file changes nothing,
 *  so it neither asks for confirmation nor counts as work to review. */
function installableRulesets(preview: CustomAgentRepositoryPreview | null): CustomAgentRepositoryRulesetChange[] {
  return (preview?.rulesets ?? []).filter((ruleset) => ruleset.status === "new" || ruleset.status === "new-version");
}

function changeTone(status: CustomAgentRepositoryChange["status"]) {
  if (status === "unchanged") return "text-[var(--muted-foreground)]";
  if (status === "removed") return "text-[var(--destructive)]";
  return "text-[var(--marinara-chat-chrome-highlight-text)]";
}

function rulesetTone(status: CustomAgentRepositoryRulesetChange["status"]) {
  if (status === "invalid" || status === "conflict") return "text-[var(--destructive)]";
  if (status === "unchanged") return "text-[var(--muted-foreground)]";
  return "text-[var(--marinara-chat-chrome-highlight-text)]";
}

function previewSettings(change: CustomAgentRepositoryChange) {
  const definition = change.definition;
  if (!definition) return null;
  const { defaultPromptTemplate: _prompt, ...configuration } = definition;
  return configuration;
}

function previewPermissions(change: CustomAgentRepositoryChange): CustomAgentCapability[] {
  const definition = change.definition;
  if (!definition) return [];
  const settings = {
    ...(definition.defaultSettings ?? {}),
    ...(definition.defaultTools ? { enabledTools: definition.defaultTools } : {}),
    ...(definition.resultType ? { resultType: definition.resultType } : {}),
    [CUSTOM_AGENT_PERMISSIONS_EXPLICIT_SETTING]: false,
  };
  return Object.entries(normalizeCustomAgentCapabilities(settings))
    .filter(([, enabled]) => enabled === true)
    .map(([capability]) => capability as CustomAgentCapability);
}

export function CustomAgentRepositoriesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t: localizeUi } = useUiTranslation();
  const repositories = useCustomAgentRepositories();
  const { data: agentImportPolicy } = useAgentImportPolicy();
  const previewMutation = usePreviewCustomAgentRepository();
  const addMutation = useAddCustomAgentRepository();
  const syncMutation = useSyncCustomAgentRepository();
  const removeMutation = useRemoveCustomAgentRepository();
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<CustomAgentRepositoryPreview | null>(null);

  const configuredRepository = useMemo(
    () => repositories.data?.repositories.find((entry) => entry.id === preview?.repository.id) ?? null,
    [preview?.repository.id, repositories.data?.repositories],
  );
  const previewPermissionsByAgentId = useMemo(
    () => new Map((preview?.changes ?? []).map((change) => [change.agentId, previewPermissions(change)])),
    [preview],
  );
  const contentChanges = preview?.changes.filter((change) => change.status !== "unchanged") ?? [];
  const rulesetChanges = installableRulesets(preview);
  const changeCount = contentChanges.length + rulesetChanges.length;
  const pending =
    previewMutation.isPending || addMutation.isPending || syncMutation.isPending || removeMutation.isPending;
  // A preview from a server that predates repository rulesets has no `rulesets` at all.
  const previewRulesets = preview?.rulesets ?? [];
  const agentImportsEnabled = agentImportPolicy?.enabled === true;

  /** Adding or syncing reports what happened to the rulesets separately, because a version already
   *  installed with other contents is deliberately left alone rather than replaced. */
  const reportRulesets = (result: CustomAgentRepositoryRulesetResult | undefined) => {
    // A server that predates repository rulesets answers without this part.
    if (!result || result.added + result.unchanged + result.skipped === 0) return;
    toast.info(localizeUi("ui.agents.customagentrepositoriesmodal.rulesetsApplied", { ...result }));
  };

  const previewUrl = async () => {
    if (!url.trim()) return;
    try {
      setPreview(await previewMutation.mutateAsync({ url: url.trim() }));
    } catch (error) {
      toast.error(
        getPrivilegedActionErrorMessage(
          error,
          localizeUi("ui.agents.customagentrepositoriesmodal.repositoryPreviewFailed"),
        ),
      );
    }
  };

  const previewExisting = async (repositoryId: string) => {
    try {
      setPreview(await previewMutation.mutateAsync({ repositoryId }));
    } catch (error) {
      toast.error(
        getPrivilegedActionErrorMessage(
          error,
          localizeUi("ui.agents.customagentrepositoriesmodal.repositoryPreviewFailed"),
        ),
      );
    }
  };

  const applyPreview = async () => {
    if (!preview) return;
    if (!agentImportsEnabled) {
      toast.info(localizeUi("settings.agentImports.enableFirst"));
      return;
    }
    if (!configuredRepository) {
      const confirmed = await showConfirmDialog({
        title: localizeUi("ui.agents.customagentrepositoriesmodal.addThisCustomRepository"),
        message: [
          localizeUi("ui.agents.customagentrepositoriesmodal.repositoryAgentsWillBeImported", {
            warning: TRUST_WARNING,
            count: preview.changes.length,
          }),
          ...(rulesetChanges.length > 0
            ? [
                localizeUi("ui.agents.customagentrepositoriesmodal.rulesetsWillBeInstalled", {
                  count: rulesetChanges.length,
                }),
              ]
            : []),
        ].join("\n\n"),
        confirmLabel: localizeUi("ui.agents.customagentrepositoriesmodal.addRepoAnyway"),
      });
      if (!confirmed) return;
      try {
        const result = await addMutation.mutateAsync({
          url: preview.repository.url,
          digest: preview.digest,
          confirmed,
        });
        toast.success(localizeUi("ui.agents.customagentrepositoriesmodal.customRepositoryAddedAndItsAgentsImported"));
        reportRulesets(result.rulesets);
        setUrl("");
        setPreview(null);
      } catch (error) {
        toast.error(
          getPrivilegedActionErrorMessage(
            error,
            localizeUi("ui.agents.customagentrepositoriesmodal.repositoryInstallationFailed"),
          ),
        );
      }
      return;
    }

    let confirmed = false;
    if (changeCount > 0) {
      const summary = [
        ...contentChanges.map((change) => `${change.name}: ${STATUS_LABELS[change.status].toLowerCase()}`),
        ...rulesetChanges.map(
          (ruleset) => `${ruleset.name}: ${localizeUi(RULESET_STATUS_KEYS[ruleset.status]).toLowerCase()}`,
        ),
      ].join("\n");
      confirmed = await showConfirmDialog({
        title: localizeUi("ui.agents.customagentrepositoriesmodal.applyRepositoryChanges"),
        message: localizeUi(
          "ui.agents.customagentrepositoriesmodal.value1RemoteValuesReplaceTheManagedPromptSettingsAnd",
          { value1: TRUST_WARNING, value2: summary },
        ),
        confirmLabel: localizeUi("ui.agents.customagentrepositoriesmodal.applyChanges"),
      });
      if (!confirmed) return;
    }
    try {
      const result = await syncMutation.mutateAsync({
        repositoryId: configuredRepository.id,
        digest: preview.digest,
        confirmed,
      });
      toast.success(
        changeCount > 0
          ? localizeUi("ui.agents.customagentrepositoriesmodal.repositoryChangesApplied")
          : localizeUi("ui.agents.customagentrepositoriesmodal.repositoryIsAlreadyCurrent"),
      );
      reportRulesets(result.rulesets);
      setPreview(null);
    } catch (error) {
      toast.error(
        getPrivilegedActionErrorMessage(
          error,
          localizeUi("ui.agents.customagentrepositoriesmodal.repositorySyncFailed"),
        ),
      );
    }
  };

  const removeRepository = async (repositoryId: string, name: string) => {
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.agents.customagentrepositoriesmodal.removeValue1", { value1: name }),
      message: localizeUi(
        "ui.agents.customagentrepositoriesmodal.thisStopsFutureSynchronizationImportedAgentsTheirRunsAnd",
      ),
      confirmLabel: localizeUi("ui.agents.customagentrepositoriesmodal.removeSource"),
      tone: "destructive",
    });
    if (!confirmed) return;
    try {
      await removeMutation.mutateAsync(repositoryId);
      if (preview?.repository.id === repositoryId) setPreview(null);
      toast.success(
        localizeUi("ui.agents.customagentrepositoriesmodal.customRepositoryRemovedItsAgentsWereKeptLocally"),
      );
    } catch (error) {
      toast.error(
        getPrivilegedActionErrorMessage(
          error,
          localizeUi("ui.agents.customagentrepositoriesmodal.repositoryRemovalFailed"),
        ),
      );
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={localizeUi("ui.agents.customagentrepositoriesmodal.customAgentRepositories")}
      width="max-w-3xl"
      mobileFullscreen
      closeDisabled={pending}
    >
      <div className="space-y-6">
        <div className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/45 p-3 text-sm leading-6">
          <TriangleAlert className="mt-0.5 shrink-0 text-[var(--marinara-chat-chrome-highlight-text)]" size="1rem" />
          <p className="max-w-[70ch] text-[var(--muted-foreground)]">{TRUST_WARNING}</p>
        </div>

        <section aria-labelledby="custom-repository-add-heading">
          <h3 id="custom-repository-add-heading" className="text-base font-semibold">
            {localizeUi("ui.agents.customagentrepositoriesmodal.previewAGithubRepository")}
          </h3>
          <p className="mt-1 max-w-[70ch] text-sm text-[var(--muted-foreground)]">
            {localizeUi("ui.agents.customagentrepositoriesmodal.repositoryContents")}
          </p>
          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              void previewUrl();
            }}
          >
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className="mari-chrome-field h-11 min-w-0 flex-1 px-3 text-sm"
              placeholder={localizeUi("ui.agents.customagentrepositoriesmodal.httpsGithubComOwnerAgentRepository")}
              aria-label={localizeUi("ui.agents.customagentrepositoriesmodal.githubAgentRepositoryUrl")}
              disabled={pending}
            />
            <button
              type="submit"
              className="mari-chrome-control mari-chrome-control--primary h-11 shrink-0 px-4 text-sm"
              disabled={pending || !url.trim()}
            >
              {previewMutation.isPending ? <Loader2 className="animate-spin" size="0.9rem" /> : <Plus size="0.9rem" />}
              {localizeUi("settings.notifications.customSound.actions.preview")}
            </button>
          </form>
        </section>

        <section aria-labelledby="custom-repository-saved-heading">
          <div className="flex items-center justify-between gap-3">
            <h3 id="custom-repository-saved-heading" className="text-base font-semibold">
              {localizeUi("ui.agents.customagentrepositoriesmodal.savedSources")}
            </h3>
            <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
              {repositories.data?.repositories.length ?? 0}
            </span>
          </div>
          {repositories.isLoading ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              <Loader2 className="animate-spin" size="0.9rem" />{" "}
              {localizeUi("ui.agents.customagentrepositoriesmodal.loadingSources")}
            </p>
          ) : repositories.data?.repositories.length ? (
            <div className="mt-2 divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {repositories.data.repositories.map((repository) => (
                <div key={repository.id} className="flex items-center gap-3 py-3">
                  <GitFork size="1rem" className="shrink-0 text-[var(--muted-foreground)]" />
                  <div className="min-w-0 flex-1">
                    <a
                      href={repository.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full items-center gap-1.5 font-semibold text-[var(--foreground)] hover:text-[var(--marinara-chat-chrome-highlight-text)]"
                    >
                      <span className="truncate">
                        {repository.owner}/{repository.name}
                      </span>
                      <ExternalLink size="0.75rem" className="shrink-0" />
                    </a>
                    <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                      {repository.agentCount} {localizeUi("ui.agents.agentcatalogview.agent")}
                      {repository.agentCount === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s")}
                      {repository.rulesetCount > 0
                        ? localizeUi("ui.agents.customagentrepositoriesmodal.rulesetCount", {
                            count: repository.rulesetCount,
                          })
                        : ""}
                      {repository.lastSyncedAt
                        ? localizeUi("ui.agents.customagentrepositoriesmodal.syncedValue1", {
                            value1: new Date(repository.lastSyncedAt).toLocaleString(),
                          })
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="mari-chrome-control h-10 px-3 text-xs"
                    onClick={() => void previewExisting(repository.id)}
                    disabled={pending}
                    aria-label={localizeUi("ui.agents.customagentrepositoriesmodal.previewUpdatesFromValue1Value2", {
                      value1: repository.owner,
                      value2: repository.name,
                    })}
                  >
                    <RefreshCw size="0.85rem" className={cn(previewMutation.isPending && "animate-spin")} />
                    <span className="max-sm:hidden">{localizeUi("ui.agents.customagentrepositoriesmodal.check")}</span>
                  </button>
                  <button
                    type="button"
                    className="mari-chrome-control h-10 w-10 p-0 text-[var(--destructive)]"
                    onClick={() => void removeRepository(repository.id, `${repository.owner}/${repository.name}`)}
                    disabled={pending}
                    aria-label={localizeUi("ui.agents.customagentrepositoriesmodal.removeValue1Value2", {
                      value1: repository.owner,
                      value2: repository.name,
                    })}
                  >
                    <Trash2 size="0.9rem" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted-foreground)]">
              {localizeUi("ui.agents.customagentrepositoriesmodal.noCustomSourcesYetPreviewingNeverInstallsOrChanges")}
            </p>
          )}
        </section>

        {preview && (
          <section aria-labelledby="custom-repository-preview-heading" className="border-t border-[var(--border)] pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                  {configuredRepository
                    ? localizeUi("ui.agents.customagentrepositoriesmodal.syncPreview")
                    : localizeUi("ui.agents.customagentrepositoriesmodal.importPreview")}
                </p>
                <h3 id="custom-repository-preview-heading" className="mt-1 text-lg font-semibold">
                  {preview.repository.owner}/{preview.repository.name}
                </h3>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {changeCount === 0
                    ? localizeUi("ui.agents.customagentrepositoriesmodal.noManagedAgentContentHasChanged")
                    : localizeUi("ui.agents.customagentrepositoriesmodal.value1ContentChangeValue2ToReview", {
                        value1: changeCount,
                        value2: changeCount === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
                      })}
                </p>
              </div>
              <button
                type="button"
                className="mari-chrome-control mari-chrome-control--primary h-10 px-4 text-sm"
                onClick={() => void applyPreview()}
                disabled={pending || !agentImportsEnabled}
                title={agentImportsEnabled ? undefined : localizeUi("settings.agentImports.enableFirst")}
              >
                {addMutation.isPending || syncMutation.isPending ? (
                  <Loader2 size="0.9rem" className="animate-spin" />
                ) : (
                  <Check size="0.9rem" />
                )}
                {configuredRepository
                  ? changeCount > 0
                    ? localizeUi("ui.agents.customagentrepositoriesmodal.applyChanges")
                    : localizeUi("ui.agents.customagentrepositoriesmodal.confirmCurrent")
                  : localizeUi("ui.agents.customagentrepositoriesmodal.addRepository")}
              </button>
            </div>

            <div className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {preview.changes.map((change) => (
                <details key={`${change.status}-${change.agentId}`} className="group py-3">
                  <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                    <span className={cn("w-28 shrink-0 text-xs font-semibold", changeTone(change.status))}>
                      {STATUS_LABELS[change.status]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{change.name}</span>
                    <span className="text-xs text-[var(--muted-foreground)] group-open:hidden">
                      {localizeUi("ui.agents.customagentrepositoriesmodal.review")}
                    </span>
                  </summary>
                  <div className="ml-0 mt-3 space-y-3 sm:ml-28">
                    {change.changedFields.length > 0 && (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {localizeUi("ui.agents.customagentrepositoriesmodal.changes")} {change.changedFields.join(", ")}
                      </p>
                    )}
                    {change.status === "removed" ? (
                      <p className="max-w-[70ch] text-sm text-[var(--muted-foreground)]">
                        {localizeUi(
                          "ui.agents.customagentrepositoriesmodal.thisDefinitionIsAbsentUpstreamSyncKeepsTheCurrent",
                        )}
                      </p>
                    ) : (
                      <>
                        <div>
                          <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                            {localizeUi("ui.agents.customagentrepositoriesmodal.prompt")}
                          </p>
                          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--secondary)] p-3 text-xs leading-5 text-[var(--foreground)]">
                            {change.definition?.defaultPromptTemplate || "(empty prompt)"}
                          </pre>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                            {localizeUi("settings.agentImports.review.permissions")}
                          </p>
                          {(previewPermissionsByAgentId.get(change.agentId)?.length ?? 0) > 0 ? (
                            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-[var(--foreground)]">
                              {(previewPermissionsByAgentId.get(change.agentId) ?? []).map((capability) => (
                                <li key={capability}>
                                  {localizeUi(`settings.agentImports.capabilities.${capability}.label`)}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                              {localizeUi("settings.agentImports.review.noPermissions")}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                            {localizeUi("ui.agents.customagentrepositoriesmodal.settingsAndTools")}
                          </p>
                          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--secondary)] p-3 text-xs leading-5 text-[var(--foreground)]">
                            {JSON.stringify(previewSettings(change), null, 2)}
                          </pre>
                        </div>
                      </>
                    )}
                  </div>
                </details>
              ))}
            </div>

            {previewRulesets.length > 0 && (
              <div className="mt-6">
                <h4 className="text-base font-semibold">
                  {localizeUi("ui.agents.customagentrepositoriesmodal.rulesets")}
                </h4>
                <p className="mt-1 max-w-[70ch] text-sm text-[var(--muted-foreground)]">
                  {localizeUi("ui.agents.customagentrepositoriesmodal.rulesetGameMasterNotice")}
                </p>
                <ul className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
                  {previewRulesets.map((ruleset) => (
                    <li key={ruleset.file} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-3">
                      <span className={cn("w-28 shrink-0 text-xs font-semibold", rulesetTone(ruleset.status))}>
                        {localizeUi(RULESET_STATUS_KEYS[ruleset.status])}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{ruleset.name}</p>
                        <p className="mt-0.5 break-words text-xs text-[var(--muted-foreground)]">
                          {ruleset.rulesetId ?? ruleset.file}
                        </p>
                        {ruleset.version !== null && (
                          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                            {localizeUi("ui.agents.customagentrepositoriesmodal.rulesetVersionValue1", {
                              value1: ruleset.version,
                            })}
                          </p>
                        )}
                        {ruleset.coverage && (
                          <p className="mt-1 max-w-[70ch] text-xs text-[var(--muted-foreground)]">{ruleset.coverage}</p>
                        )}
                        {ruleset.status === "conflict" && (
                          <p className="mt-1 max-w-[70ch] text-xs text-[var(--muted-foreground)]">
                            {localizeUi("ui.agents.customagentrepositoriesmodal.rulesetConflictNotice")}
                          </p>
                        )}
                        {ruleset.issues.length > 0 && (
                          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-[var(--destructive)]">
                            {ruleset.issues.map((issue) => (
                              <li key={issue}>{issue}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}
