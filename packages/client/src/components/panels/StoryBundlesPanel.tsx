// ──────────────────────────────────────────────
// Panel: Story Bundles
// ──────────────────────────────────────────────
// Minimal list panel for the new Story Bundle object. The first iteration
// only carries a title; create/delete live here, editing in the full-page
// StoryBundleEditor.
// ──────────────────────────────────────────────
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { BookMarked, Download, Loader2, Play, Plus, Trash2, Upload } from "lucide-react";
import { useStoryBundles, useCreateStoryBundle, useDeleteStoryBundle } from "../../hooks/use-story-bundles";
import { useCreateChat, useUpdateChatMetadata } from "../../hooks/use-chats";
import { useConnections } from "../../hooks/use-connections";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { showChoiceDialog, showConfirmDialog, showPromptDialog } from "../../lib/app-dialogs";
import { api } from "../../lib/api-client";
import { cn } from "../../lib/utils";

export function StoryBundlesPanel() {
  const { t } = useTranslation();
  const openStoryBundleDetail = useUIStore((s) => s.openStoryBundleDetail);
  const openModal = useUIStore((s) => s.openModal);
  const { data: bundles, isLoading } = useStoryBundles();
  const createMutation = useCreateStoryBundle();
  const deleteMutation = useDeleteStoryBundle();
  const [creating, setCreating] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  // RP chat creation hook for the Play button
  const createChat = useCreateChat();
  const updateChatMetadata = useUpdateChatMetadata();
  const { data: connections } = useConnections();

  const handleCreate = useCallback(async () => {
    if (creating) return;
    const title = await showPromptDialog({
      title: t("storyBundles.createDialogTitle", "Create Story Bundle"),
      message: t("storyBundles.createPromptMessage", "Enter a title for the new story bundle."),
      placeholder: t("storyBundles.namePlaceholder", "Title of this story bundle…"),
      confirmLabel: t("storyBundles.create", "Create"),
      cancelLabel: t("storyBundles.cancel", "Cancel"),
      tone: "accent",
      testId: "story-bundle-create-dialog",
    });
    if (title === null) return;
    const name = title.trim();
    if (!name) return;
    setCreating(true);
    try {
      const bundle = await createMutation.mutateAsync({ name });
      openStoryBundleDetail(bundle.id);
    } catch {
      toast.error(t("storyBundles.createFailed", "Failed to create the story bundle."));
    } finally {
      setCreating(false);
    }
  }, [createMutation, creating, openStoryBundleDetail, t]);

  const handleDelete = useCallback(
    async (id: string, name: string) => {
      const confirmed = await showConfirmDialog({
        title: t("storyBundles.deleteConfirmTitle", "Delete story bundle?"),
        message: t("storyBundles.deleteConfirmBody", {
          defaultValue: "“{{name}}” will be permanently deleted.",
          name,
        }),
        confirmLabel: t("storyBundles.delete", "Delete"),
        tone: "destructive",
        testId: "story-bundle-delete-dialog",
      });
      if (!confirmed) return;
      try {
        await deleteMutation.mutateAsync(id);
      } catch {
        toast.error(t("storyBundles.deleteFailed", "Failed to delete the story bundle."));
      }
    },
    [deleteMutation, t],
  );

  const handlePlay = useCallback(
    async (id: string, _name: string) => {
      if (playingId) return;
      setPlayingId(id);
      try {
        // Fetch the full bundle to get character/persona/preset/intro IDs
        const bundle = await api.get<{
          id: string;
          name: string;
          characterIds: string[];
          personaIds: string[];
          lorebookIds: string[];
          presetIds: string[];
          agentIds: string[];
          intros?: Array<{ id: string; name: string; text: string }>;
        }>(`/story-bundles/${id}`);

        // If the bundle has intros, let the user pick one first.
        let selectedIntroText: string | null = null;
        const bundleIntros = bundle.intros ?? [];
        if (bundleIntros.length > 0) {
          const choice = await showChoiceDialog({
            title: t("storyBundles.introPickTitle", "Choose an Intro"),
            message: t("storyBundles.introPickMessage", "Select an intro to use as the first message."),
            choices: bundleIntros.map((intro) => ({
              key: intro.id,
              label: intro.name,
            })),
          });
          if (!choice) {
            setPlayingId(null);
            return;
          }
          const picked = bundleIntros.find((i) => i.id === choice);
          selectedIntroText = picked?.text ?? null;
        }

        const conns = (connections ?? []) as Array<{ id: string }>;

        createChat.mutate(
          {
            name: bundle.name,
            mode: "roleplay",
            characterIds: bundle.characterIds ?? [],
            personaId: bundle.personaIds?.[0] ?? null,
            connectionId: conns[0]?.id,
            promptPresetId: bundle.presetIds?.[0] ?? null,
          },
          {
            onSuccess: async (chat) => {
              useChatStore.getState().setActiveChatId(chat.id);

              // Tag the chat with the story bundle it was started from so the
              // chat sidebar can show the bundle's picture on this RP's row.
              try {
                await updateChatMetadata.mutateAsync({ id: chat.id, storyBundleId: bundle.id });
              } catch (err) {
                console.error("[playStoryBundle] Failed to tag chat with story bundle:", err);
              }

              // Activate the bundle's lorebooks on the new chat.
              const lorebookIds = bundle.lorebookIds ?? [];
              if (lorebookIds.length > 0) {
                try {
                  await api.patch(`/chats/${chat.id}/metadata`, { activeLorebookIds: lorebookIds });
                } catch (err) {
                  console.error("[playStoryBundle] Failed to activate lorebooks:", err);
                }
              }

              // Activate the bundle's pre-configured agents on the new chat.
              const agentIds = bundle.agentIds ?? [];
              if (agentIds.length > 0) {
                try {
                  await api.patch(`/chats/${chat.id}/metadata`, {
                    enableAgents: true,
                    activeAgentIds: agentIds,
                  });
                } catch (err) {
                  console.error("[playStoryBundle] Failed to activate agents:", err);
                }
              }

              // If an intro was selected, insert it as the first assistant message.
              if (selectedIntroText) {
                try {
                  await api.post(`/chats/${chat.id}/messages`, {
                    role: "assistant",
                    content: selectedIntroText,
                  });
                } catch (err) {
                  console.error("[playStoryBundle] Failed to insert intro message:", err);
                }
              }

              // Check if the preset has configurable variables — if so, show
              // only the ChoiceSelectionModal instead of the full setup wizard.
              const presetId = bundle.presetIds?.[0] ?? null;
              let hasPresetVariables = false;
              if (presetId) {
                try {
                  const presetFull = await api.get<{ choiceBlocks?: Array<{ id: string }> }>(
                    `/prompts/${presetId}/full`,
                  );
                  hasPresetVariables = (presetFull?.choiceBlocks?.length ?? 0) > 0;
                } catch {
                  // If we can't fetch the preset, fall through to settings.
                }
              }

              useChatStore.getState().setShouldOpenSettings(true);
              if (hasPresetVariables && presetId) {
                useChatStore.getState().setPresetVariablesPrompt({ chatId: chat.id, presetId });
              }
              toast.success(t("storyBundles.playStarted", "Roleplay started!"));
              setPlayingId(null);
            },
            onError: (err) => {
              console.error("[playStoryBundle]", err);
              toast.error(t("storyBundles.playFailed", "Failed to start roleplay."));
              setPlayingId(null);
            },
          },
        );
      } catch (err) {
        console.error("[playStoryBundle]", err);
        toast.error(t("storyBundles.playFailed", "Failed to start roleplay."));
        setPlayingId(null);
      }
    },
    [playingId, connections, createChat, updateChatMetadata, t],
  );

  const handleExport = useCallback(
    async (id: string, name: string) => {
      if (exportingId) return;
      setExportingId(id);
      try {
        await api.download(`/story-bundles/${id}/export`, `${name.replace(/[^a-zA-Z0-9_\- ]/g, "_")}.marinara.json`);
        toast.success(t("storyBundles.exportSuccess", "Story bundle exported."));
      } catch {
        toast.error(t("storyBundles.exportFailed", "Failed to export the story bundle."));
      } finally {
        setExportingId(null);
      }
    },
    [exportingId, t],
  );

  return (
    <div data-testid="story-bundles-panel" className="flex h-full min-h-0 flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="mari-chrome-text-muted text-xs">
          {t("storyBundles.count", { count: bundles?.length ?? 0, defaultValue: "{{count}} bundles" })}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            data-testid="story-bundles-import-button"
            onClick={() => openModal("import-story-bundle")}
            className="mari-chrome-control mari-chrome-control--primary text-xs"
            title={t("storyBundles.import", "Import")}
          >
            <Download size="0.8125rem" />
          </button>
          <button
            data-testid="story-bundles-create-button"
            onClick={handleCreate}
            disabled={creating}
            className="mari-panel-gradient-button mari-panel-gradient-button--compact mari-panel-gradient-surface mari-panel-gradient--story-bundles flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium"
          >
            {creating ? <Loader2 size="0.75rem" className="animate-spin" /> : <Plus size="0.75rem" />}
            {t("storyBundles.newBundle", "New Bundle")}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {isLoading ? (
          <div className="mari-chrome-text-muted flex h-24 items-center justify-center text-sm">
            <Loader2 size="1rem" className="animate-spin" />
          </div>
        ) : !bundles || bundles.length === 0 ? (
          <div className="mari-chrome-text-muted flex flex-col items-center gap-2 px-4 py-8 text-center text-xs">
            <BookMarked size="1.25rem" />
            {t("storyBundles.empty", "No story bundles yet. Create your first one to get started.")}
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {bundles.map((bundle) => (
              <li key={bundle.id}>
                <div
                  data-testid={`story-bundle-row-${bundle.id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => openStoryBundleDetail(bundle.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openStoryBundleDetail(bundle.id);
                    }
                  }}
                  className="group relative flex cursor-pointer items-center gap-2.5 rounded-xl p-2.5 transition-all hover:bg-[var(--sidebar-accent)]"
                >
                  <div
                    className={cn(
                      "relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg text-white shadow-sm",
                      bundle.imagePath
                        ? "bg-[var(--muted)]"
                        : "mari-panel-gradient-surface mari-panel-gradient--story-bundles",
                    )}
                  >
                    {bundle.imagePath ? (
                      <img src={bundle.imagePath} alt="" className="h-full w-full object-cover" draggable={false} />
                    ) : (
                      <BookMarked size="0.875rem" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mari-chrome-text-strong truncate text-sm font-medium">{bundle.name}</div>
                    <div className="mari-chrome-text-muted truncate text-xs">
                      {bundle.comment ? bundle.comment : new Date(bundle.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  {/* Row action pill (visible on hover / always on mobile) */}
                  <div className="absolute right-2 top-1/2 flex shrink-0 -translate-y-1/2 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 max-md:opacity-100">
                    <button
                      data-testid={`story-bundle-play-button-${bundle.id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handlePlay(bundle.id, bundle.name);
                      }}
                      disabled={playingId === bundle.id}
                      className="rounded-md p-1 transition-transform hover:bg-[var(--sidebar-accent)] active:scale-90"
                      title={t("storyBundles.playTitle", "Start game from this story bundle")}
                    >
                      {playingId === bundle.id ? (
                        <Loader2 size="0.75rem" className="animate-spin" />
                      ) : (
                        <Play size="0.75rem" />
                      )}
                    </button>
                    <button
                      data-testid={`story-bundle-export-button-${bundle.id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleExport(bundle.id, bundle.name);
                      }}
                      disabled={exportingId === bundle.id}
                      className="rounded-md p-1 transition-transform hover:bg-[var(--sidebar-accent)] active:scale-90"
                      title={t("storyBundles.export", "Export")}
                    >
                      {exportingId === bundle.id ? (
                        <Loader2 size="0.75rem" className="animate-spin" />
                      ) : (
                        <Upload size="0.75rem" />
                      )}
                    </button>
                    <button
                      data-testid={`story-bundle-delete-button-${bundle.id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDelete(bundle.id, bundle.name);
                      }}
                      className="rounded-md p-1 transition-transform hover:bg-[var(--sidebar-accent)] active:scale-90"
                      title={t("storyBundles.delete", "Delete")}
                    >
                      <Trash2 size="0.75rem" className={cn("text-[var(--destructive)]")} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
