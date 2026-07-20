import { useMemo, useState } from "react";
import { Check, ExternalLink, GitFork, Loader2, Plus, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import type { CustomAgentRepositoryChange, CustomAgentRepositoryPreview } from "@marinara-engine/shared";
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

const TRUST_WARNING =
  "This repo and its agents are not affiliated with or vetted by PastaDevs. Custom agents can run tools, send prompts to your configured connections, and change behavior on every sync. Only add repos from people or sources you trust.";

const STATUS_LABELS: Record<CustomAgentRepositoryChange["status"], string> = {
  new: "New",
  updated: "Updated",
  unchanged: "Unchanged",
  removed: "No longer published",
};

function changeTone(status: CustomAgentRepositoryChange["status"]) {
  if (status === "unchanged") return "text-[var(--muted-foreground)]";
  if (status === "removed") return "text-[var(--destructive)]";
  return "text-[var(--marinara-chat-chrome-highlight-text)]";
}

function previewSettings(change: CustomAgentRepositoryChange) {
  const definition = change.definition;
  if (!definition) return null;
  const { defaultPromptTemplate: _prompt, ...configuration } = definition;
  return configuration;
}

export function CustomAgentRepositoriesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const repositories = useCustomAgentRepositories();
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
  const contentChanges = preview?.changes.filter((change) => change.status !== "unchanged") ?? [];
  const pending =
    previewMutation.isPending || addMutation.isPending || syncMutation.isPending || removeMutation.isPending;

  const previewUrl = async () => {
    if (!url.trim()) return;
    try {
      setPreview(await previewMutation.mutateAsync({ url: url.trim() }));
    } catch (error) {
      toast.error(getPrivilegedActionErrorMessage(error, "Repository preview failed."));
    }
  };

  const previewExisting = async (repositoryId: string) => {
    try {
      setPreview(await previewMutation.mutateAsync({ repositoryId }));
    } catch (error) {
      toast.error(getPrivilegedActionErrorMessage(error, "Repository preview failed."));
    }
  };

  const applyPreview = async () => {
    if (!preview) return;
    if (!configuredRepository) {
      const confirmed = await showConfirmDialog({
        title: "Add this custom repository?",
        message: `${TRUST_WARNING}\n\n${preview.changes.length} agent${preview.changes.length === 1 ? "" : "s"} will be imported.`,
        confirmLabel: "Add Repo Anyway",
      });
      if (!confirmed) return;
      try {
        await addMutation.mutateAsync({ url: preview.repository.url, digest: preview.digest, confirmed });
        toast.success("Custom repository added and its agents imported.");
        setUrl("");
        setPreview(null);
      } catch (error) {
        toast.error(getPrivilegedActionErrorMessage(error, "Repository installation failed."));
      }
      return;
    }

    let confirmed = false;
    if (contentChanges.length > 0) {
      const summary = contentChanges
        .map((change) => `${change.name}: ${STATUS_LABELS[change.status].toLowerCase()}`)
        .join("\n");
      confirmed = await showConfirmDialog({
        title: "Apply repository changes?",
        message: `${TRUST_WARNING}\n\nRemote values replace the managed prompt, settings, and tools shown in this preview. Removed definitions are kept as local custom agents.\n\n${summary}`,
        confirmLabel: "Apply Changes",
      });
      if (!confirmed) return;
    }
    try {
      await syncMutation.mutateAsync({
        repositoryId: configuredRepository.id,
        digest: preview.digest,
        confirmed,
      });
      toast.success(contentChanges.length > 0 ? "Repository changes applied." : "Repository is already current.");
      setPreview(null);
    } catch (error) {
      toast.error(getPrivilegedActionErrorMessage(error, "Repository sync failed."));
    }
  };

  const removeRepository = async (repositoryId: string, name: string) => {
    const confirmed = await showConfirmDialog({
      title: `Remove ${name}?`,
      message:
        "This stops future synchronization. Imported agents, their runs, and their memory remain available as local custom agents.",
      confirmLabel: "Remove Source",
      tone: "destructive",
    });
    if (!confirmed) return;
    try {
      await removeMutation.mutateAsync(repositoryId);
      if (preview?.repository.id === repositoryId) setPreview(null);
      toast.success("Custom repository removed. Its agents were kept locally.");
    } catch (error) {
      toast.error(getPrivilegedActionErrorMessage(error, "Repository removal failed."));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Custom Agent Repositories"
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
            Preview a GitHub repository
          </h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Add the repository root URL. It must contain a top-level <code>agents.json</code> file.
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
              placeholder="https://github.com/owner/agent-repository"
              aria-label="GitHub agent repository URL"
              disabled={pending}
            />
            <button
              type="submit"
              className="mari-chrome-control mari-chrome-control--primary h-11 shrink-0 px-4 text-sm"
              disabled={pending || !url.trim()}
            >
              {previewMutation.isPending ? <Loader2 className="animate-spin" size="0.9rem" /> : <Plus size="0.9rem" />}
              Preview
            </button>
          </form>
        </section>

        <section aria-labelledby="custom-repository-saved-heading">
          <div className="flex items-center justify-between gap-3">
            <h3 id="custom-repository-saved-heading" className="text-base font-semibold">
              Saved sources
            </h3>
            <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
              {repositories.data?.repositories.length ?? 0}
            </span>
          </div>
          {repositories.isLoading ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              <Loader2 className="animate-spin" size="0.9rem" /> Loading sources…
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
                      {repository.agentCount} agent{repository.agentCount === 1 ? "" : "s"}
                      {repository.lastSyncedAt ? ` • Synced ${new Date(repository.lastSyncedAt).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="mari-chrome-control h-10 px-3 text-xs"
                    onClick={() => void previewExisting(repository.id)}
                    disabled={pending}
                    aria-label={`Preview updates from ${repository.owner}/${repository.name}`}
                  >
                    <RefreshCw size="0.85rem" className={cn(previewMutation.isPending && "animate-spin")} />
                    <span className="max-sm:hidden">Check</span>
                  </button>
                  <button
                    type="button"
                    className="mari-chrome-control h-10 w-10 p-0 text-[var(--destructive)]"
                    onClick={() => void removeRepository(repository.id, `${repository.owner}/${repository.name}`)}
                    disabled={pending}
                    aria-label={`Remove ${repository.owner}/${repository.name}`}
                  >
                    <Trash2 size="0.9rem" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted-foreground)]">
              No custom sources yet. Previewing never installs or changes an agent.
            </p>
          )}
        </section>

        {preview && (
          <section aria-labelledby="custom-repository-preview-heading" className="border-t border-[var(--border)] pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                  {configuredRepository ? "Sync preview" : "Import preview"}
                </p>
                <h3 id="custom-repository-preview-heading" className="mt-1 text-lg font-semibold">
                  {preview.repository.owner}/{preview.repository.name}
                </h3>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {contentChanges.length === 0
                    ? "No managed agent content has changed."
                    : `${contentChanges.length} content change${contentChanges.length === 1 ? "" : "s"} to review.`}
                </p>
              </div>
              <button
                type="button"
                className="mari-chrome-control mari-chrome-control--primary h-10 px-4 text-sm"
                onClick={() => void applyPreview()}
                disabled={pending}
              >
                {addMutation.isPending || syncMutation.isPending ? (
                  <Loader2 size="0.9rem" className="animate-spin" />
                ) : (
                  <Check size="0.9rem" />
                )}
                {configuredRepository
                  ? contentChanges.length > 0
                    ? "Apply Changes"
                    : "Confirm Current"
                  : "Add Repository"}
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
                    <span className="text-xs text-[var(--muted-foreground)] group-open:hidden">Review</span>
                  </summary>
                  <div className="ml-0 mt-3 space-y-3 sm:ml-28">
                    {change.changedFields.length > 0 && (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        Changes: {change.changedFields.join(", ")}
                      </p>
                    )}
                    {change.status === "removed" ? (
                      <p className="max-w-[70ch] text-sm text-[var(--muted-foreground)]">
                        This definition is absent upstream. Sync keeps the current agent and removes its repository
                        link.
                      </p>
                    ) : (
                      <>
                        <div>
                          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Prompt</p>
                          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--secondary)] p-3 text-xs leading-5 text-[var(--foreground)]">
                            {change.definition?.defaultPromptTemplate || "(empty prompt)"}
                          </pre>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Settings and tools</p>
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
          </section>
        )}
      </div>
    </Modal>
  );
}
