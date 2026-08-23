// ──────────────────────────────────────────────
// Story Bundle Editor — Full-page detail view
// ──────────────────────────────────────────────
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookMarked,
  BookOpen,
  FileText,
  Info,
  Loader2,
  MessageSquare,
  Play,
  Save,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import DOMPurify from "dompurify";
import { useStoryBundle, useUpdateStoryBundle, useDeleteStoryBundle } from "../../hooks/use-story-bundles";
import { useCharacters, useCharacterGroups, usePersonas } from "../../hooks/use-characters";
import { useLorebooks } from "../../hooks/use-lorebooks";
import { usePresets } from "../../hooks/use-presets";
import type { Lorebook, PromptPreset, StoryBundleIntro } from "@marinara-engine/shared";
import { useCreateChat, useUpdateChatMetadata } from "../../hooks/use-chats";
import { useConnections } from "../../hooks/use-connections";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { api } from "../../lib/api-client";
import { showChoiceDialog, showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";
import { EditorTabRail } from "../ui/EditorTabRail";
import { StoryBundleDescription } from "./StoryBundleDescription";
import { StoryBundleMetadata } from "./StoryBundleMetadata";
import { StoryBundleCharacters } from "./StoryBundleCharacters";
import { StoryBundlePersonas } from "./StoryBundlePersonas";
import { StoryBundleLorebooks } from "./StoryBundleLorebooks";
import { StoryBundlePresets } from "./StoryBundlePresets";
import { StoryBundleAgents } from "./StoryBundleAgents";
import { StoryBundleIntros } from "./StoryBundleIntros";

/** Allowed HTML tags for the description preview. */
const ALLOWED_DESCRIPTION_TAGS = [
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "code",
  "dd",
  "del",
  "div",
  "dl",
  "dt",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "ins",
  "li",
  "mark",
  "ol",
  "p",
  "pre",
  "s",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
];

/** Sanitize HTML for safe rendering in the description preview. */
function sanitizeDescription(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ALLOWED_DESCRIPTION_TAGS,
    ALLOWED_ATTR: [
      "href",
      "target",
      "rel",
      "src",
      "alt",
      "width",
      "height",
      "class",
      "id",
      "style",
      "colspan",
      "rowspan",
      "start",
      "type",
    ],
  });
}

/** Parse a JSON string or array into a string[] of character IDs. */
function parseCharacterFolderIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  }
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

const TABS = [
  { id: "metadata", label: "Metadata", icon: Info },
  { id: "description", label: "Description", icon: FileText },
  { id: "characters", label: "Characters", icon: Users },
  { id: "personas", label: "Personas", icon: UserRound },
  { id: "lorebooks", label: "Lorebooks", icon: BookOpen },
  { id: "presets", label: "Presets", icon: SlidersHorizontal },
  { id: "agents", label: "Agents", icon: Sparkles },
  { id: "intros", label: "Intros", icon: MessageSquare },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function StoryBundleEditor() {
  const { t } = useTranslation();
  const storyBundleDetailId = useUIStore((s) => s.storyBundleDetailId);
  const closeStoryBundleDetail = useUIStore((s) => s.closeStoryBundleDetail);
  const openRightPanel = useUIStore((s) => s.openRightPanel);

  const { data: bundle, isLoading } = useStoryBundle(storyBundleDetailId);
  const updateMutation = useUpdateStoryBundle();
  const deleteMutation = useDeleteStoryBundle();

  const { data: allCharacters } = useCharacters();
  const { data: allCharacterGroups } = useCharacterGroups();
  const { data: allPersonas } = usePersonas();
  const { data: allLorebooks } = useLorebooks();
  const { data: allPresets } = usePresets();

  const characters = useMemo(
    () =>
      (allCharacters ?? []) as Array<{ id: string; data: unknown; comment?: string | null; avatarPath: string | null }>,
    [allCharacters],
  );

  const characterFolders = useMemo(
    () =>
      ((allCharacterGroups ?? []) as Array<{ id: string; name: string; characterIds: unknown }>).map((group) => ({
        ...group,
        characterIds: parseCharacterFolderIds(group.characterIds),
      })),
    [allCharacterGroups],
  );

  const validCharacterIds = useMemo(() => new Set((characters ?? []).map((c) => c.id)), [characters]);

  const personas = useMemo(
    () =>
      (allPersonas ?? []) as Array<{
        id: string;
        name: string;
        avatarPath?: string | null;
        avatarCrop?: string;
        comment?: string | null;
        description?: string | null;
      }>,
    [allPersonas],
  );

  const validPersonaIds = useMemo(() => new Set((personas ?? []).map((p) => p.id)), [personas]);

  const lorebooks = useMemo(() => (allLorebooks ?? []) as Lorebook[], [allLorebooks]);

  const validLorebookIds = useMemo(() => new Set((lorebooks ?? []).map((lb) => lb.id)), [lorebooks]);

  const presets = useMemo(() => (allPresets ?? []) as PromptPreset[], [allPresets]);

  const validPresetIds = useMemo(() => new Set((presets ?? []).map((p) => p.id)), [presets]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [avatarCrop, setAvatarCrop] = useState<Record<string, unknown> | null>(null);
  const [comment, setComment] = useState("");
  const [creator, setCreator] = useState("");
  const [version, setVersion] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [characterIds, setCharacterIds] = useState<string[]>([]);
  const [personaIds, setPersonaIds] = useState<string[]>([]);
  const [lorebookIds, setLorebookIds] = useState<string[]>([]);
  const [presetIds, setPresetIds] = useState<string[]>([]);
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const [intros, setIntros] = useState<StoryBundleIntro[]>([]);
  const [previewDescription, setPreviewDescription] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("metadata");
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState(false);

  // RP chat creation hook for the Play button
  const createChat = useCreateChat();
  const updateChatMetadata = useUpdateChatMetadata();
  const { data: connections } = useConnections();

  // Keep the local draft in sync with the loaded bundle. useLayoutEffect so
  // the draft is populated synchronously before paint — Play must never read
  // an empty draft in the window between the editor rendering and a passive
  // effect running.
  useLayoutEffect(() => {
    if (bundle) {
      setName(bundle.name);
      setDescription(bundle.description ?? "");
      setImagePath(bundle.imagePath ?? null);
      setAvatarCrop((bundle.avatarCrop as unknown as Record<string, unknown>) ?? null);
      setComment(bundle.comment ?? "");
      setCreator(bundle.creator ?? "");
      setVersion(bundle.version ?? "");
      setTags(bundle.tags ?? []);
      setCharacterIds(bundle.characterIds ?? []);
      setPersonaIds(bundle.personaIds ?? []);
      setLorebookIds(bundle.lorebookIds ?? []);
      setPresetIds(bundle.presetIds ?? []);
      setAgentIds(bundle.agentIds ?? []);
      setIntros(bundle.intros ?? []);
    }
  }, [bundle]);

  const nameDirty = bundle ? name.trim() !== bundle.name && name.trim().length > 0 : false;
  const descriptionDirty = bundle ? description !== (bundle.description ?? "") : false;
  const commentDirty = bundle ? comment !== (bundle.comment ?? "") : false;
  const creatorDirty = bundle ? creator !== (bundle.creator ?? "") : false;
  const versionDirty = bundle ? version !== (bundle.version ?? "") : false;
  const tagsDirty = bundle
    ? JSON.stringify([...(tags ?? [])].sort()) !== JSON.stringify([...(bundle.tags ?? [])].sort())
    : false;
  const characterIdsDirty = bundle
    ? JSON.stringify([...(characterIds ?? [])].sort()) !== JSON.stringify([...(bundle.characterIds ?? [])].sort())
    : false;
  const personaIdsDirty = bundle
    ? JSON.stringify([...(personaIds ?? [])].sort()) !== JSON.stringify([...(bundle.personaIds ?? [])].sort())
    : false;
  const lorebookIdsDirty = bundle
    ? JSON.stringify([...(lorebookIds ?? [])].sort()) !== JSON.stringify([...(bundle.lorebookIds ?? [])].sort())
    : false;
  const presetIdsDirty = bundle
    ? JSON.stringify([...(presetIds ?? [])].sort()) !== JSON.stringify([...(bundle.presetIds ?? [])].sort())
    : false;
  const agentIdsDirty = bundle
    ? JSON.stringify([...(agentIds ?? [])].sort()) !== JSON.stringify([...(bundle.agentIds ?? [])].sort())
    : false;
  const introsDirty = bundle ? JSON.stringify(intros) !== JSON.stringify(bundle.intros ?? []) : false;
  const avatarCropDirty = bundle ? JSON.stringify(avatarCrop) !== JSON.stringify(bundle.avatarCrop ?? null) : false;
  const isDirty =
    nameDirty ||
    descriptionDirty ||
    commentDirty ||
    creatorDirty ||
    versionDirty ||
    tagsDirty ||
    characterIdsDirty ||
    personaIdsDirty ||
    lorebookIdsDirty ||
    presetIdsDirty ||
    agentIdsDirty ||
    introsDirty ||
    avatarCropDirty;

  const sanitizedDescription = useMemo(() => (description ? sanitizeDescription(description) : ""), [description]);

  const handleSave = useCallback(async () => {
    if (!storyBundleDetailId || !isDirty || saving) return;
    setSaving(true);
    try {
      const payload: {
        name?: string;
        description?: string | null;
        avatarCrop?: Record<string, unknown> | null;
        comment?: string;
        creator?: string;
        version?: string;
        tags?: string[];
        characterIds?: string[];
        personaIds?: string[];
        lorebookIds?: string[];
        presetIds?: string[];
        agentIds?: string[];
        intros?: StoryBundleIntro[];
      } = {};
      if (nameDirty) payload.name = name.trim();
      if (descriptionDirty) payload.description = description || null;
      if (avatarCropDirty) payload.avatarCrop = avatarCrop;
      if (commentDirty) payload.comment = comment;
      if (creatorDirty) payload.creator = creator;
      if (versionDirty) payload.version = version;
      if (tagsDirty) payload.tags = tags;
      if (characterIdsDirty) payload.characterIds = characterIds;
      if (personaIdsDirty) payload.personaIds = personaIds;
      if (lorebookIdsDirty) payload.lorebookIds = lorebookIds;
      if (presetIdsDirty) payload.presetIds = presetIds;
      if (agentIdsDirty) payload.agentIds = agentIds;
      if (introsDirty) payload.intros = intros;
      await updateMutation.mutateAsync({ id: storyBundleDetailId, ...payload });
      toast.success(t("storyBundles.saveSuccess", "Story bundle saved."));
    } catch {
      toast.error(t("storyBundles.saveFailed", "Failed to save the story bundle."));
    } finally {
      setSaving(false);
    }
  }, [
    storyBundleDetailId,
    isDirty,
    saving,
    nameDirty,
    descriptionDirty,
    avatarCropDirty,
    commentDirty,
    creatorDirty,
    versionDirty,
    tagsDirty,
    characterIdsDirty,
    personaIdsDirty,
    lorebookIdsDirty,
    presetIdsDirty,
    agentIdsDirty,
    introsDirty,
    updateMutation,
    name,
    description,
    avatarCrop,
    comment,
    creator,
    version,
    tags,
    characterIds,
    personaIds,
    lorebookIds,
    presetIds,
    agentIds,
    intros,
    t,
  ]);

  const handlePlay = useCallback(async () => {
    if (!bundle || playing) return;
    setPlaying(true);

    // Play what the user sees: use the current editor draft rather than the
    // last saved server state, so unsaved changes (e.g. a freshly added
    // preset) are honored when starting the roleplay.
    const draftName = name.trim() || bundle.name;
    const draftCharacterIds = characterIds;
    const draftPersonaId = personaIds[0] ?? null;
    const draftLorebookIds = lorebookIds;
    const draftPresetId = presetIds[0] ?? null;
    const draftAgentIds = agentIds;
    const draftIntros = intros;

    // If the bundle has intros, let the user pick one first.
    let selectedIntroText: string | null = null;
    if (draftIntros.length > 0) {
      const choice = await showChoiceDialog({
        title: t("storyBundles.introPickTitle", "Choose an Intro"),
        message: t("storyBundles.introPickMessage", "Select an intro to use as the first message."),
        choices: draftIntros.map((intro) => ({
          key: intro.id,
          label: intro.name,
        })),
        cancelLabel: t("storyBundles.cancel", "Cancel"),
      });
      if (!choice) {
        setPlaying(false);
        return;
      }
      const picked = draftIntros.find((i) => i.id === choice);
      selectedIntroText = picked?.text ?? null;
    }

    const conns = (connections ?? []) as Array<{ id: string }>;
    createChat.mutate(
      {
        name: draftName,
        mode: "roleplay",
        characterIds: draftCharacterIds,
        personaId: draftPersonaId,
        connectionId: conns[0]?.id,
        promptPresetId: draftPresetId,
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
          if (draftLorebookIds.length > 0) {
            try {
              await api.patch(`/chats/${chat.id}/metadata`, { activeLorebookIds: draftLorebookIds });
            } catch (err) {
              console.error("[playStoryBundle] Failed to activate lorebooks:", err);
            }
          }

          // Activate the bundle's pre-configured agents on the new chat.
          if (draftAgentIds.length > 0) {
            try {
              await api.patch(`/chats/${chat.id}/metadata`, {
                enableAgents: true,
                activeAgentIds: draftAgentIds,
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
          const presetId = draftPresetId;
          let hasPresetVariables = false;
          if (presetId) {
            try {
              const presetFull = await api.get<{ choiceBlocks?: Array<{ id: string }> }>(`/prompts/${presetId}/full`);
              hasPresetVariables = (presetFull?.choiceBlocks?.length ?? 0) > 0;
            } catch {
              // If we can't fetch the preset, fall through to settings.
            }
          }

          useChatStore.getState().setShouldOpenSettings(true);
          if (hasPresetVariables && presetId) {
            useChatStore.getState().setPresetVariablesPrompt({ chatId: chat.id, presetId });
          }
          closeStoryBundleDetail();
          toast.success(t("storyBundles.playStarted", "Roleplay started!"));
          setPlaying(false);
        },
        onError: (err) => {
          console.error("[playStoryBundle]", err);
          toast.error(t("storyBundles.playFailed", "Failed to start roleplay."));
          setPlaying(false);
        },
      },
    );
  }, [
    bundle,
    playing,
    connections,
    createChat,
    updateChatMetadata,
    closeStoryBundleDetail,
    t,
    name,
    characterIds,
    personaIds,
    lorebookIds,
    presetIds,
    agentIds,
    intros,
  ]);

  const handleDelete = useCallback(async () => {
    if (!storyBundleDetailId || !bundle) return;
    const confirmed = await showConfirmDialog({
      title: t("storyBundles.deleteConfirmTitle", "Delete story bundle?"),
      message: t("storyBundles.deleteConfirmBody", {
        defaultValue: "“{{name}}” will be permanently deleted.",
        name: bundle.name,
      }),
      confirmLabel: t("storyBundles.delete", "Delete"),
      tone: "destructive",
      testId: "story-bundle-delete-dialog",
    });
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(storyBundleDetailId);
      closeStoryBundleDetail();
      openRightPanel("story-bundles");
    } catch {
      toast.error(t("storyBundles.deleteFailed", "Failed to delete the story bundle."));
    }
  }, [storyBundleDetailId, bundle, deleteMutation, closeStoryBundleDetail, openRightPanel, t]);

  if (isLoading || !bundle) {
    return (
      <div data-testid="story-bundle-editor-loading" className="flex h-full items-center justify-center">
        <Loader2 size="1.25rem" className="mari-chrome-text-muted animate-spin" />
      </div>
    );
  }

  return (
    <div data-testid="story-bundle-editor" className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div
        data-testid="story-bundle-editor-header"
        className="sticky top-0 z-10 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)]/30 bg-[var(--card)]/80 px-4 backdrop-blur-sm"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            data-testid="story-bundle-editor-back-button"
            onClick={closeStoryBundleDetail}
            className="mari-topbar-action flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] active:scale-95"
            title={t("storyBundles.back", "Back")}
          >
            <ArrowLeft size="1rem" />
          </button>
          <div className="mari-panel-gradient-surface mari-panel-gradient--story-bundles flex h-6 w-6 items-center justify-center rounded-md text-white shadow-sm">
            <BookMarked size="0.875rem" />
          </div>
          <h2 className="mari-chrome-text-strong truncate text-sm font-semibold">
            {t("storyBundles.editorTitle", "Edit Story Bundle")}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            data-testid="story-bundle-editor-play-button"
            onClick={handlePlay}
            disabled={playing}
            className={cn(
              "mari-panel-gradient-button mari-panel-gradient-button--compact mari-panel-gradient-surface mari-panel-gradient--story-bundles flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
              playing && "cursor-not-allowed opacity-45",
            )}
            title={t("storyBundles.playTitle", "Start game from this story bundle")}
          >
            {playing ? <Loader2 size="0.75rem" className="animate-spin" /> : <Play size="0.75rem" />}
            {t("storyBundles.play", "Play")}
          </button>
          <button
            data-testid="story-bundle-editor-save-button"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className={cn(
              "mari-panel-gradient-button mari-panel-gradient-button--compact mari-panel-gradient-surface mari-panel-gradient--story-bundles flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
              (!isDirty || saving) && "cursor-not-allowed opacity-45",
            )}
          >
            {saving ? <Loader2 size="0.75rem" className="animate-spin" /> : <Save size="0.75rem" />}
            {t("storyBundles.save", "Save")}
          </button>
          <button
            data-testid="story-bundle-editor-delete-button"
            onClick={handleDelete}
            className="mari-topbar-action flex h-8 w-8 items-center justify-center rounded-lg text-[var(--destructive)] transition-all hover:bg-[var(--accent)] active:scale-95"
            title={t("storyBundles.delete", "Delete")}
          >
            <Trash2 size="0.875rem" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="mari-editor-body @max-5xl:flex-col min-h-0 flex-1">
        <EditorTabRail tabs={TABS} activeId={activeTab} onChange={setActiveTab} tabTestId="story-bundle-editor-tab" />

        <div className="mari-editor-content @max-5xl:p-4">
          <div className="mari-editor-content-inner">
            {activeTab === "metadata" && (
              <StoryBundleMetadata
                bundleId={storyBundleDetailId ?? ""}
                name={name}
                onNameChange={setName}
                comment={comment}
                onCommentChange={setComment}
                creator={creator}
                onCreatorChange={setCreator}
                version={version}
                onVersionChange={setVersion}
                tags={tags}
                onTagsChange={setTags}
                imagePath={imagePath}
                avatarCrop={avatarCrop}
                onAvatarCropChange={setAvatarCrop}
              />
            )}

            {activeTab === "description" && (
              <StoryBundleDescription
                description={description}
                onDescriptionChange={setDescription}
                previewDescription={previewDescription}
                onPreviewToggle={() => setPreviewDescription((prev) => !prev)}
                sanitizedDescription={sanitizedDescription}
              />
            )}

            {activeTab === "characters" && (
              <StoryBundleCharacters
                characterIds={characterIds}
                onCharacterIdsChange={setCharacterIds}
                characters={characters}
                characterFolders={characterFolders}
                validCharacterIds={validCharacterIds}
              />
            )}

            {activeTab === "personas" && (
              <StoryBundlePersonas
                personaIds={personaIds}
                onPersonaIdsChange={setPersonaIds}
                personas={personas}
                validPersonaIds={validPersonaIds}
              />
            )}

            {activeTab === "lorebooks" && (
              <StoryBundleLorebooks
                lorebookIds={lorebookIds}
                onLorebookIdsChange={setLorebookIds}
                lorebooks={lorebooks}
                validLorebookIds={validLorebookIds}
              />
            )}

            {activeTab === "presets" && (
              <StoryBundlePresets
                presetIds={presetIds}
                onPresetIdsChange={setPresetIds}
                presets={presets}
                validPresetIds={validPresetIds}
              />
            )}

            {activeTab === "agents" && <StoryBundleAgents agentIds={agentIds} onAgentIdsChange={setAgentIds} />}

            {activeTab === "intros" && <StoryBundleIntros intros={intros} onIntrosChange={setIntros} />}
          </div>
        </div>
      </div>
    </div>
  );
}
