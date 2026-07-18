// ──────────────────────────────────────────────
// Persona Editor — Full-page detail view
// Replaces the chat area when editing a persona.
// Sections: Metadata, Card, Convo, Lorebook, Sprites, Gallery, Colors, Stats
// ──────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback, type ChangeEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  useCreateCharacter,
  usePersonas,
  useUpdatePersona,
  useUploadAvatar,
  useUploadPersonaAvatar,
  useDeletePersona,
  useDuplicatePersona,
  usePersonaVersions,
  useRestorePersonaVersion,
  useDeletePersonaVersion,
  usePersonaGalleryImages,
  usePersonaGalleryClips,
  useUploadPersonaGalleryImage,
  useUploadPersonaGalleryClip,
  useUploadPersonaGalleryVideo,
  useDeletePersonaGalleryImage,
  useDeletePersonaGalleryClip,
  useGeneratePersonaCallVideoClips,
  useGeneratePersonaCustomCallVideoClip,
  useTagPersonaGalleryImage,
  type CharacterCallVideoGenerationInput,
  type CharacterGalleryClip,
  type PersonaGalleryImage,
} from "../../hooks/use-characters";
import { useConnections } from "../../hooks/use-connections";
import { useUIStore } from "../../stores/ui.store";
import {
  ArrowLeft,
  Save,
  User,
  IdCard,
  Camera,
  Trash2,
  AlertTriangle,
  Palette,
  Activity,
  Plus,
  X,
  Tag,
  Image,
  Upload,
  Download,
  FolderOpen,
  Film,
  History,
  Loader2,
  Copy,
  UserPlus,
  Wand2,
  ImageDown,
  Eraser,
  RotateCcw,
  Crop,
  Library,
  MessageCircle,
} from "lucide-react";
import { cn, generateClientId, getAvatarCropStyle, type AvatarCrop, type LegacyAvatarCrop } from "../../lib/utils";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { extractColorsFromImage } from "../../lib/avatar-color-extraction";
import { HelpTooltip } from "../ui/HelpTooltip";
import { ColorPicker } from "../ui/ColorPicker";
import { MacroTextarea } from "../ui/MacroTextarea";
import { ImageUploadDropzone } from "../ui/ImageUploadDropzone";
import { CustomEmojiTagButton } from "../ui/CustomEmojiTagButton";
import { CallClipGenerationModal } from "../ui/CallClipGenerationModal";
import { api } from "../../lib/api-client";
import { parseTrackerCardColorConfig, serializeTrackerCardColorConfig } from "../../lib/tracker-card-colors";
import { estimateTextTokens, formatEstimatedTokens } from "../../lib/character-token-count";
import {
  useCharacterSprites,
  useUploadSprite,
  useDeleteSprite,
  useExportSprites,
  useCleanupSavedSprites,
  useRestoreSpriteCleanupBackup,
  useSpriteCapabilities,
  spriteKeys,
  type SpriteInfo,
} from "../../hooks/use-characters";
import { useQueryClient } from "@tanstack/react-query";
import { SpriteGenerationModal } from "../ui/SpriteGenerationModal";
import { AvatarGenerationModal } from "../ui/AvatarGenerationModal";
import { AvatarCropWidget } from "../ui/AvatarCropWidget";
import { SpriteFrameEditor } from "../ui/SpriteFrameEditor";
import { SpriteWandCleanupEditor } from "../ui/SpriteWandCleanupEditor";
import { ExportFormatDialog, type ExportFormatChoice } from "../ui/ExportFormatDialog";
import { Modal } from "../ui/Modal";
import { EditorTabRail } from "../ui/EditorTabRail";
import { EditorSectionAnchor, EditorSectionJumps } from "../ui/EditorSectionJumps";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import {
  createDefaultRpgStatPools,
  normalizeSpriteExpressionLabel,
  normalizeRpgStatPools,
  syncRpgHpFromPools,
  type CharacterData,
  type ConvoBehaviorConfig,
  type PersonaCardSnapshot,
  type PersonaCardVersion,
  type RPGStatPool,
  type RPGStatsConfig,
  type TrackerCardColorConfig,
} from "@marinara-engine/shared";
import { useQuoteFormatter } from "../../hooks/use-quote-formatter";
import { LorebookAssignmentSection } from "../lorebooks/LorebookAssignmentSection";
import { ConvoProfileFields } from "../characters/ConvoProfileFields";

// ── Tabs ──
const TABS = [
  { id: "metadata", label: "Metadata", icon: User },
  { id: "card", label: "Card", icon: IdCard },
  { id: "convo", label: "Convo", icon: MessageCircle },
  { id: "lorebook", label: "Lorebook", icon: Library },
  { id: "sprites", label: "Sprites", icon: Image },
  { id: "gallery", label: "Gallery", icon: Camera },
  { id: "colors", label: "Colors", icon: Palette },
  { id: "stats", label: "Stats", icon: Activity },
] as const;

type TabId = (typeof TABS)[number]["id"];

const PERSONA_CARD_SECTIONS = [
  { id: "persona-card-description", label: "Description" },
  { id: "persona-card-personality", label: "Personality" },
  { id: "persona-card-backstory", label: "Backstory" },
  { id: "persona-card-appearance", label: "Appearance" },
  { id: "persona-card-scenario", label: "Scenario" },
] as const;

function formatPersonaTextTokens(value: string): string {
  return formatEstimatedTokens(estimateTextTokens(value));
}

const PERSONA_METADATA_HELP =
  "Use metadata for identity, sharing, and library organization. Name is injected as your persona name, creator/version help track authorship and revisions, tags make the persona searchable, and creator notes stay private.";

const PERSONA_CARD_HELP =
  "Write the fields that define how the model sees your persona. Description, personality, backstory, appearance, and scenario are kept together so the card feels like one writing document.";

const PERSONA_DESCRIPTION_HELP =
  "Your persona's general identity and role. This is sent in prompts so the AI knows who you are in the scene.";

const PERSONA_PERSONALITY_HELP = "Your temperament, behavior, speech habits, preferences, and emotional patterns.";

const PERSONA_BACKSTORY_HELP =
  "History, origin, important relationships, and formative events that explain your persona.";

const PERSONA_APPEARANCE_HELP =
  "Physical description, clothing, posture, distinguishing marks, and visual details the model should remember.";

const PERSONA_SCENARIO_HELP =
  "Your default situation or context for roleplays. Use it to establish where your persona starts and what is already true.";

const PERSONA_LOREBOOK_HELP =
  "Attach lorebook/world-info entries to this persona. Entries can be used as extra context when your persona needs private background, abilities, or relationships.";

const PERSONA_SPRITES_HELP =
  "Upload sprites one by one, or use Upload Folder to bulk-import a folder of PNGs. Each filename becomes the expression name, for example admiration.png becomes admiration. To rotate variants, share a prefix before an underscore, for example happy_01.png and happy_blush.png. Persona sprites can be used in Game Mode and roleplay with the Expression Engine. Use transparent PNGs for best results.";

const PERSONA_COLORS_HELP =
  "Name color is applied to your persona's display name in chat. Gradients use CSS linear-gradient. Dialogue color applies to text inside dialogue quotation marks and can optionally be bolded from Settings. Box color sets the background color of your persona's message bubble. Leave any field empty to use the default theme colors.";

const PERSONA_STATS_HELP =
  "Status bars represent your persona's physical and mental state, such as hunger, energy, or mood. The Persona Stats agent adjusts values realistically based on what happens in the narrative. Bars are displayed in the HUD widget during chat with color-coded gradients. Values set here serve as the initial defaults for new conversations.";

const PERSONA_RPG_ATTRIBUTES_HELP =
  "HP is injected into the prompt so the AI knows your persona's current health. Attributes are custom stats, like STR or DEX, that define your persona's capabilities. The Character Tracker agent can adjust values based on combat, healing, and narrative events. Values set here serve as the initial/default state for new conversations.";

interface PersonaFormData {
  name: string;
  comment: string;
  phoneticName: string;
  creator: string;
  personaVersion: string;
  creatorNotes: string;
  description: string;
  personality: string;
  scenario: string;
  backstory: string;
  appearance: string;
  nameColor: string;
  dialogueColor: string;
  boxColor: string;
  trackerCardColors: TrackerCardColorConfig;
  personaStats: string;
  tags: string[];
  savedStatusOptions: string;
  /** Conversation-mode-only fields. */
  convoDisplayName: string;
  aboutMe: string;
  convoBehavior: ConvoBehaviorConfig | null;
  /** Avatar crop region (parsed from the persona row's JSON-encoded `avatarCrop`).
   *  May be the current source-relative shape, the legacy zoom+offset shape (held
   *  through until the user re-edits via the cropper), or null when unset. */
  avatarCrop: AvatarCrop | LegacyAvatarCrop | null;
}

interface PersonaRow {
  id: string;
  name: string;
  comment?: string;
  phoneticName?: string;
  creator?: string;
  personaVersion?: string;
  creatorNotes?: string;
  description: string;
  personality: string;
  scenario: string;
  backstory: string;
  appearance: string;
  avatarPath: string | null;
  /** JSON-encoded AvatarCrop, or empty string when unset. */
  avatarCrop?: string;
  isActive: string | boolean;
  nameColor?: string;
  dialogueColor?: string;
  boxColor?: string;
  trackerCardColors?: string;
  personaStats?: string;
  tags?: string;
  savedStatusOptions?: string;
  convoDisplayName?: string;
  aboutMe?: string;
  convoBehavior?: string;
}

function appendNewTags(existingTags: string[], rawInput: string) {
  const seen = new Set(existingTags);
  const additions: string[] = [];

  for (const tag of rawInput.split(",").map((part) => part.trim())) {
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    additions.push(tag);
  }

  return additions.length > 0 ? [...existingTags, ...additions] : existingTags;
}

const PERSONA_QUOTE_FIELD_KEYS = new Set<string>(["description", "personality", "scenario", "backstory", "appearance"]);

function formatPersonaFieldValue<K extends keyof PersonaFormData>(
  key: K,
  value: PersonaFormData[K],
  formatQuotes: (value: string) => string,
): PersonaFormData[K] {
  if (PERSONA_QUOTE_FIELD_KEYS.has(String(key)) && typeof value === "string") {
    return formatQuotes(value) as PersonaFormData[K];
  }
  return value;
}

// ── Gallery Tab ──

type PersonaGalleryMediaTab = "images" | "clips";

function personaGalleryClipSourceLabel(source: CharacterGalleryClip["source"]) {
  switch (source) {
    case "game-scene":
      return "Game scene";
    case "scene-video":
      return "Scene video";
    case "conversation-call":
      return "Call presence";
    case "conversation-call-custom":
      return "Custom call clip";
    case "uploaded-video":
      return "Uploaded video";
    default:
      return "Video";
  }
}

function formatPersonaClipDate(value: string | null) {
  if (!value) return "Not generated";
  return new Date(value).toLocaleDateString();
}

function canDeletePersonaGalleryClip(clip: CharacterGalleryClip) {
  if (clip.source === "conversation-call" && clip.status === "missing") return false;
  return clip.status !== "generating";
}

function isPersonaCallVideoClip(clip: CharacterGalleryClip) {
  return clip.source === "conversation-call" || clip.source === "conversation-call-custom";
}

function PersonaGalleryTab({ personaId, personaName }: { personaId: string; personaName?: string }) {
  const [mediaTab, setMediaTab] = useState<PersonaGalleryMediaTab>("images");
  const { data: images, isLoading } = usePersonaGalleryImages(personaId);
  const upload = useUploadPersonaGalleryImage(personaId);
  const remove = useDeletePersonaGalleryImage(personaId);
  const tag = useTagPersonaGalleryImage(personaId);
  const [lightbox, setLightbox] = useState<PersonaGalleryImage | null>(null);

  const handleUpload = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      upload.mutate(files, { onError: (err) => toast.error(err.message) });
    },
    [upload],
  );

  const handleDelete = useCallback(
    async (image: PersonaGalleryImage) => {
      if (
        !(await showConfirmDialog({
          title: "Delete Persona Image",
          message: "Delete this persona gallery image?",
          confirmLabel: "Delete",
          tone: "destructive",
        }))
      ) {
        return;
      }
      try {
        await remove.mutateAsync(image.id);
        if (lightbox?.id === image.id) setLightbox(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete persona image.");
      }
    },
    [lightbox?.id, remove],
  );

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold">Persona Gallery</h2>
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
          Keep reference art, alternate looks, and generated videos attached to this persona.
        </p>
      </div>

      <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-1">
        {[
          { id: "images" as const, label: "Images", icon: Camera, count: images?.length ?? 0 },
          { id: "clips" as const, label: "Videos", icon: Film, count: null },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = mediaTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMediaTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
              )}
            >
              <Icon size="0.8rem" />
              <span>{tab.label}</span>
              {typeof tab.count === "number" ? <span className="text-[0.65rem] opacity-70">{tab.count}</span> : null}
            </button>
          );
        })}
      </div>

      {mediaTab === "images" ? (
        <>
          <ImageUploadDropzone
            label="Upload Persona Images"
            pending={upload.isPending}
            pendingLabel="Uploading…"
            dragLabel="Drop persona images to upload"
            onFilesSelected={handleUpload}
            icon={<Upload size="1rem" />}
            className="w-full"
          />

          {isLoading ? (
            <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="shimmer aspect-square rounded-xl" />
              ))}
            </div>
          ) : images && images.length > 0 ? (
            <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
              {images.map((image) => (
                <div
                  key={image.id}
                  className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] transition-all hover:border-[var(--primary)]/30 hover:shadow-md"
                >
                  <CustomEmojiTagButton image={image} onApply={(patch) => tag.mutate({ imageId: image.id, patch })} />
                  <button
                    type="button"
                    className="block aspect-square w-full bg-[var(--secondary)]"
                    onClick={() => setLightbox(image)}
                  >
                    <img
                      src={image.url}
                      alt={image.prompt || personaName || "Persona image"}
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/75 via-black/25 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100">
                    <span className="max-w-[8rem] truncate text-[0.6875rem] font-medium text-white/85">
                      {new Date(image.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex gap-1">
                      <a
                        href={image.url}
                        download
                        className="rounded-lg bg-white/15 p-1.5 text-white transition-colors hover:bg-white/25"
                        title="Download"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download size="0.75rem" />
                      </a>
                      <button
                        type="button"
                        onClick={() => void handleDelete(image)}
	                        className="rounded-lg bg-[var(--secondary)] p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                        title="Delete"
                      >
                        <Trash2 size="0.75rem" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] py-12 text-center">
              <Camera size="1.75rem" className="text-[var(--muted-foreground)]/40" />
              <div>
                <p className="text-sm font-medium text-[var(--muted-foreground)]">No persona images yet</p>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]/60">
                  Upload images here to keep them tied to {personaName || "this persona"} instead of a specific chat.
                </p>
              </div>
            </div>
          )}
        </>
      ) : (
        <PersonaVideosGallery personaId={personaId} personaName={personaName} />
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 max-md:pt-[env(safe-area-inset-top)]"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw] w-[min(90vw,90vh)]" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightbox.url}
              alt={lightbox.prompt || personaName || "Persona image"}
              className="max-h-[85vh] w-full rounded-lg object-contain shadow-2xl"
            />
            <div className="absolute right-2 top-2 flex gap-2">
              <a
                href={lightbox.url}
                download
                className="rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
              >
                <Download size="0.875rem" />
              </a>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
              >
                <X size="0.875rem" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PersonaVideosGallery({ personaId, personaName }: { personaId: string; personaName?: string }) {
  const { data, isLoading } = usePersonaGalleryClips(personaId);
  const uploadVideo = useUploadPersonaGalleryVideo(personaId);
  const deleteClip = useDeletePersonaGalleryClip(personaId);
  const [deletingClipId, setDeletingClipId] = useState<string | null>(null);
  const clips = (data?.clips ?? []).filter((clip) => !isPersonaCallVideoClip(clip));

  const handleUploadVideos = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      try {
        for (const file of files) {
          await uploadVideo.mutateAsync({ file });
        }
        toast.success(files.length === 1 ? "Video uploaded." : "Videos uploaded.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not upload video.");
      }
    },
    [uploadVideo],
  );

  const handleDeleteClip = useCallback(
    async (clip: CharacterGalleryClip) => {
      if (!canDeletePersonaGalleryClip(clip)) return;
      if (
        !(await showConfirmDialog({
          title: "Delete Clip",
          message: "Delete this clip everywhere it appears in Marinara? This cannot be undone.",
          confirmLabel: "Delete",
          tone: "destructive",
        }))
      ) {
        return;
      }

      setDeletingClipId(clip.id);
      try {
        await deleteClip.mutateAsync(clip.id);
        toast.success("Video deleted.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not delete video.");
      } finally {
        setDeletingClipId(null);
      }
    },
    [deleteClip],
  );

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="shimmer aspect-video rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ImageUploadDropzone
        label="Upload Persona Videos"
        pending={uploadVideo.isPending}
        pendingLabel="Uploading…"
        dragLabel="Drop persona videos to upload"
        onFilesSelected={handleUploadVideos}
        icon={<Upload size="1rem" />}
        accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
        fileKind="video"
        className="w-full"
      />

      {clips.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {clips.map((clip) => (
            <PersonaClipCard
              key={clip.id}
              clip={clip}
              personaName={personaName}
              deleting={deletingClipId === clip.id}
              onDelete={handleDeleteClip}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] py-12 text-center">
          <Film size="1.75rem" className="text-[var(--muted-foreground)]/40" />
          <div>
            <p className="text-sm font-medium text-[var(--muted-foreground)]">No persona videos yet</p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]/60">
              Upload videos or generate game and scene videos from chats using {personaName || "this persona"}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function PersonaCallClipsGallery({ personaId, personaName }: { personaId: string; personaName?: string }) {
  const { data, isLoading } = usePersonaGalleryClips(personaId);
  const uploadClip = useUploadPersonaGalleryClip(personaId);
  const deleteClip = useDeletePersonaGalleryClip(personaId);
  const generateCallClips = useGeneratePersonaCallVideoClips(personaId);
  const generateCustomCallClip = useGeneratePersonaCustomCallVideoClip(personaId);
  const [deletingClipId, setDeletingClipId] = useState<string | null>(null);
  const [generationDialogOpen, setGenerationDialogOpen] = useState(false);
  const clipUploadInputRef = useRef<HTMLInputElement | null>(null);
  const clips = (data?.clips ?? []).filter(isPersonaCallVideoClip);
  const standardCallClips = clips.filter((clip) => clip.source === "conversation-call");
  const customCallClipCount = clips.filter((clip) => clip.source === "conversation-call-custom").length;
  const readyCallClipCount = standardCallClips.filter((clip) => clip.status === "ready").length;
  const generationLockActive =
    data?.callVideoGenerating === true ||
    clips.some((clip) => clip.status === "generating") ||
    generateCallClips.isPending ||
    generateCustomCallClip.isPending;

  const handleUploadClipFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      try {
        await uploadClip.mutateAsync({ file });
        toast.success("Call clip uploaded.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not upload clip.");
      }
    },
    [uploadClip],
  );

  const handleGenerateCallClips = useCallback(
    async (input: CharacterCallVideoGenerationInput) => {
      const standardKinds = input.clipKinds?.length ? input.clipKinds : input.clipKind ? [input.clipKind] : [];
      const customClip = input.customClip?.label.trim() && input.customClip.prompt.trim() ? input.customClip : null;
      try {
        if (standardKinds.length > 0) {
          await generateCallClips.mutateAsync({
            ...input,
            clipKinds: standardKinds,
            clipCount: standardKinds.length,
            customClip: null,
          });
        }
        if (customClip) {
          await generateCustomCallClip.mutateAsync({
            ...input,
            customClip,
          });
        }
        toast.success(
          customClip && standardKinds.length === 0
            ? "Custom call clip generation started."
            : customClip
              ? "Call clip and custom clip generation started."
              : "Call clip generation started.",
        );
        setGenerationDialogOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not start call clip generation.");
      }
    },
    [generateCallClips, generateCustomCallClip],
  );

  const handleDeleteClip = useCallback(
    async (clip: CharacterGalleryClip) => {
      if (!canDeletePersonaGalleryClip(clip)) return;
      if (
        !(await showConfirmDialog({
          title: "Delete Clip",
          message: "Delete this call clip? This cannot be undone.",
          confirmLabel: "Delete",
          tone: "destructive",
        }))
      ) {
        return;
      }

      setDeletingClipId(clip.id);
      try {
        await deleteClip.mutateAsync(clip.id);
        toast.success(clip.source === "conversation-call" ? "Call clip reset." : "Clip deleted.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not delete clip.");
      } finally {
        setDeletingClipId(null);
      }
    },
    [deleteClip],
  );

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="shimmer aspect-video rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        ref={clipUploadInputRef}
        type="file"
        accept="video/mp4,.mp4"
        className="hidden"
        onChange={handleUploadClipFile}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--foreground)]">Video call clips</p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            {readyCallClipCount}/{standardCallClips.length || 6} standard ready · {customCallClipCount} custom
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => clipUploadInputRef.current?.click()}
            disabled={uploadClip.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--primary)]/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploadClip.isPending ? <Loader2 size="0.85rem" className="animate-spin" /> : <Upload size="0.85rem" />}
            Upload extra
          </button>
          <button
            type="button"
            onClick={() => setGenerationDialogOpen(true)}
            disabled={generationLockActive}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-[var(--primary-foreground)] transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generateCallClips.isPending || generateCustomCallClip.isPending ? (
              <Loader2 size="0.85rem" className="animate-spin" />
            ) : (
              <Wand2 size="0.85rem" />
            )}
            {generateCallClips.isPending || generateCustomCallClip.isPending ? "Generating" : "Generate Clips"}
          </button>
        </div>
      </div>

      {clips.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {clips.map((clip) => (
            <PersonaClipCard
              key={clip.id}
              clip={clip}
              personaName={personaName}
              deleting={deletingClipId === clip.id}
              onDelete={handleDeleteClip}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] py-12 text-center">
          <Film size="1.75rem" className="text-[var(--muted-foreground)]/40" />
          <div>
            <p className="text-sm font-medium text-[var(--muted-foreground)]">No call clips yet</p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]/60">
              Generate or upload video-call loops for {personaName || "this persona"}.
            </p>
          </div>
        </div>
      )}
      <CallClipGenerationModal
        open={generationDialogOpen}
        entityName={personaName || "this persona"}
        generating={generateCallClips.isPending || generateCustomCallClip.isPending}
        onClose={() => setGenerationDialogOpen(false)}
        onGenerate={handleGenerateCallClips}
      />
    </div>
  );
}

function PersonaClipCard({
  clip,
  personaName,
  deleting,
  onDelete,
}: {
  clip: CharacterGalleryClip;
  personaName?: string;
  deleting: boolean;
  onDelete: (clip: CharacterGalleryClip) => void | Promise<void>;
}) {
  const sourceLabel = clip.origin === "uploaded" ? "Uploaded" : personaGalleryClipSourceLabel(clip.source);
  const dateLabel = formatPersonaClipDate(clip.updatedAt ?? clip.createdAt);
  const isReady = clip.status === "ready" && Boolean(clip.url);
  const canDelete = canDeletePersonaGalleryClip(clip);
  const isCallVideoClip = clip.source === "conversation-call" || clip.source === "conversation-call-custom";
  const clipDetails = [clip.durationSeconds ? `${clip.durationSeconds}s` : null, clip.aspectRatio]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="group overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] transition-all hover:border-[var(--primary)]/30 hover:shadow-md">
      <div className="relative aspect-video bg-[var(--secondary)]">
        {isReady && clip.url ? (
          <video
            src={clip.url}
            controls
            muted={isCallVideoClip}
            preload="metadata"
            className="h-full w-full bg-black object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-xs text-[var(--muted-foreground)]">
            {clip.status === "generating" ? (
              <Loader2 size="1.25rem" className="animate-spin text-[var(--primary)]" />
            ) : clip.status === "error" ? (
              <AlertTriangle size="1.25rem" className="text-[var(--destructive)]" />
            ) : (
              <Film size="1.25rem" className="opacity-50" />
            )}
            <span>{clip.status === "missing" ? "Not generated" : clip.status}</span>
          </div>
        )}
        <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/65 px-2 py-1 text-[0.65rem] font-semibold text-white">
          {sourceLabel}
        </div>
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--foreground)]">
              {clip.label || personaName || "Clip"}
            </p>
            <p className="mt-0.5 truncate text-[0.6875rem] text-[var(--muted-foreground)]">
              {clip.chatName ? `${clip.chatName} · ${dateLabel}` : dateLabel}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isReady && clip.url ? (
              <a
                href={clip.url}
                download
                className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-1.5 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                title="Download"
              >
                <Download size="0.75rem" />
              </a>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                onClick={() => void onDelete(clip)}
                disabled={deleting}
	                className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
                title="Delete"
                aria-label={`Delete ${clip.label || "clip"}`}
              >
                {deleting ? <Loader2 size="0.75rem" className="animate-spin" /> : <Trash2 size="0.75rem" />}
              </button>
            ) : null}
          </div>
        </div>
        {clip.prompt ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-[var(--muted-foreground)]">{clip.prompt}</p>
        ) : null}
        {clipDetails ? <p className="text-[0.65rem] text-[var(--muted-foreground)]/70">{clipDetails}</p> : null}
      </div>
    </div>
  );
}

function parsePersonaRpgStats(personaStats: string): RPGStatsConfig | undefined {
  if (!personaStats.trim()) return undefined;

  try {
    const parsed = JSON.parse(personaStats) as { rpgStats?: RPGStatsConfig } | null;
    if (!parsed || typeof parsed !== "object" || !parsed.rpgStats || typeof parsed.rpgStats !== "object") {
      return undefined;
    }
    return parsed.rpgStats;
  } catch {
    return undefined;
  }
}

function createCharacterDataFromPersona(formData: PersonaFormData): CharacterData {
  const rpgStats = parsePersonaRpgStats(formData.personaStats);

  return {
    name: formData.name.trim(),
    description: formData.description ?? "",
    personality: formData.personality ?? "",
    scenario: formData.scenario ?? "",
    first_mes: "",
    mes_example: "",
    creator_notes: formData.creatorNotes ?? "",
    system_prompt: "",
    post_history_instructions: "",
    tags: formData.tags ?? [],
    creator: formData.creator ?? "",
    character_version: formData.personaVersion ?? "1.0",
    alternate_greetings: [],
    character_book: null,
    extensions: {
      talkativeness: 0.5,
      fav: false,
      world: "",
      depth_prompt: { prompt: "", depth: 4, role: "system" },
      backstory: formData.backstory ?? "",
      appearance: formData.appearance ?? "",
      phoneticName: formData.phoneticName.trim() || undefined,
      nameColor: formData.nameColor || undefined,
      dialogueColor: formData.dialogueColor || undefined,
      boxColor: formData.boxColor || undefined,
      trackerCardColors: serializeTrackerCardColorConfig(formData.trackerCardColors),
      convoDisplayName: formData.convoDisplayName || undefined,
      aboutMe: formData.aboutMe || undefined,
      ...(formData.convoBehavior?.instruction?.trim() ? { convoBehavior: formData.convoBehavior } : {}),
      ...(rpgStats ? { rpgStats } : {}),
    },
  };
}

export function PersonaEditor() {
  const personaId = useUIStore((s) => s.personaDetailId);
  const closeDetail = useUIStore((s) => s.closePersonaDetail);
  const { data: allPersonas, isLoading } = usePersonas();
  const createCharacter = useCreateCharacter();
  const updatePersona = useUpdatePersona();
  const uploadCharacterAvatar = useUploadAvatar();
  const uploadAvatar = useUploadPersonaAvatar();
  const deletePersona = useDeletePersona();
  const duplicatePersona = useDuplicatePersona();
  const { data: connectionsList } = useConnections();

  const [activeTab, setActiveTab] = useState<TabId>("metadata");
  const [formData, setFormData] = useState<PersonaFormData | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [avatarGeneratorOpen, setAvatarGeneratorOpen] = useState(false);
  const loadedPersonaIdRef = useRef<string | null>(null);
  const loadedTrackerCardColorsRef = useRef<string | null>(null);
  const latestAvatarUploadTokenRef = useRef<string | null>(null);
  const formatQuotes = useQuoteFormatter();
  const setEditorDirty = useUIStore((s) => s.setEditorDirty);
  useEffect(() => {
    setEditorDirty(dirty);
  }, [dirty, setEditorDirty]);
  const [saving, setSaving] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageGenerationAvailable =
    Array.isArray(connectionsList) &&
    (connectionsList as Array<{ provider?: string }>).some((connection) => connection.provider === "image_generation");

  // Find the persona from the list
  const rawPersona = (allPersonas as PersonaRow[] | undefined)?.find((p) => p.id === personaId);

  // Parse persona into form data when it first loads (or when switching personas).
  // Important: don't overwrite local unsaved edits if server data refetches (e.g. after avatar upload).
  useEffect(() => {
    if (!rawPersona) return;

    const isSwitchingPersona = loadedPersonaIdRef.current !== rawPersona.id;
    if (!isSwitchingPersona && dirty) return;

    loadedPersonaIdRef.current = rawPersona.id;

    let parsedAvatarCrop: AvatarCrop | LegacyAvatarCrop | null = null;
    try {
      const raw = rawPersona.avatarCrop;
      if (raw) {
        const obj = JSON.parse(raw);
        // Defensive: accept either the current source-relative shape or the
        // legacy zoom+offset shape. Anything else is silently dropped so a
        // malformed cell can't break the editor with NaN transforms.
        if (obj && typeof obj === "object") {
          // Validate geometry — finite, positive, within normalized bounds.
          // Anything malformed is dropped so the editor falls back to defaults
          // instead of producing NaN transforms or an off-screen overlay.
          if (
            Number.isFinite(obj.srcX) &&
            Number.isFinite(obj.srcY) &&
            Number.isFinite(obj.srcWidth) &&
            Number.isFinite(obj.srcHeight) &&
            obj.srcWidth > 0 &&
            obj.srcHeight > 0 &&
            obj.srcX >= 0 &&
            obj.srcY >= 0 &&
            obj.srcX + obj.srcWidth <= 1.001 &&
            obj.srcY + obj.srcHeight <= 1.001
          ) {
            parsedAvatarCrop = {
              srcX: obj.srcX,
              srcY: obj.srcY,
              srcWidth: obj.srcWidth,
              srcHeight: obj.srcHeight,
            };
          } else if (
            Number.isFinite(obj.zoom) &&
            Number.isFinite(obj.offsetX) &&
            Number.isFinite(obj.offsetY) &&
            obj.zoom > 0
          ) {
            parsedAvatarCrop = {
              zoom: obj.zoom,
              offsetX: obj.offsetX,
              offsetY: obj.offsetY,
              ...(obj.fullImage ? { fullImage: true } : {}),
            };
          }
        }
      }
    } catch {
      /* ignore — empty / malformed crop just stays null */
    }

    const trackerCardColors = parseTrackerCardColorConfig(rawPersona.trackerCardColors);
    loadedTrackerCardColorsRef.current = serializeTrackerCardColorConfig(trackerCardColors);
    setFormData({
      name: rawPersona.name,
      comment: rawPersona.comment ?? "",
      phoneticName: rawPersona.phoneticName ?? "",
      creator: rawPersona.creator ?? "",
      personaVersion: rawPersona.personaVersion ?? "1.0",
      creatorNotes: rawPersona.creatorNotes ?? "",
      description: rawPersona.description,
      personality: rawPersona.personality ?? "",
      scenario: rawPersona.scenario ?? "",
      backstory: rawPersona.backstory ?? "",
      appearance: rawPersona.appearance ?? "",
      nameColor: rawPersona.nameColor ?? "",
      dialogueColor: rawPersona.dialogueColor ?? "",
      boxColor: rawPersona.boxColor ?? "",
      trackerCardColors,
      personaStats: rawPersona.personaStats ?? "",
      tags: (() => {
        try {
          return rawPersona.tags ? JSON.parse(rawPersona.tags) : [];
        } catch {
          return [];
        }
      })(),
      savedStatusOptions: rawPersona.savedStatusOptions ?? "[]",
      convoDisplayName: rawPersona.convoDisplayName ?? "",
      aboutMe: rawPersona.aboutMe ?? "",
      convoBehavior: (() => {
        if (!rawPersona.convoBehavior?.trim()) return null;
        try {
          const parsed = JSON.parse(rawPersona.convoBehavior) as ConvoBehaviorConfig;
          return parsed && typeof parsed.instruction === "string" ? parsed : null;
        } catch {
          return null;
        }
      })(),
      avatarCrop: parsedAvatarCrop,
    });
    setAvatarPreview(rawPersona.avatarPath);
    setDirty(false);
  }, [rawPersona, dirty]);

  const updateField = useCallback(
    <K extends keyof PersonaFormData>(key: K, value: PersonaFormData[K]) => {
      const nextValue = formatPersonaFieldValue(key, value, formatQuotes);
      setFormData((prev) => (prev ? { ...prev, [key]: nextValue } : prev));
      setDirty(true);
    },
    [formatQuotes],
  );

  const handleSave = async () => {
    if (!personaId || !formData) return;
    setSaving(true);
    try {
      const { tags, avatarCrop, convoBehavior, trackerCardColors, ...rest } = formData;
      const serializedTrackerCardColors = serializeTrackerCardColorConfig(trackerCardColors);
      const trackerCardColorsChanged = serializedTrackerCardColors !== loadedTrackerCardColorsRef.current;
      await updatePersona.mutateAsync({
        id: personaId,
        ...rest,
        tags: JSON.stringify(tags),
        ...(trackerCardColorsChanged ? { trackerCardColors: serializedTrackerCardColors } : {}),
        // Persist as JSON string; empty string means "no crop" so the row keeps
        // the legacy default in render sites.
        avatarCrop: avatarCrop ? JSON.stringify(avatarCrop) : "",
        // convoBehavior is a JSON-string column; "" means unset.
        convoBehavior: convoBehavior && convoBehavior.instruction?.trim() ? JSON.stringify(convoBehavior) : "",
      });
      if (trackerCardColorsChanged) loadedTrackerCardColorsRef.current = serializedTrackerCardColors;
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !personaId) return;

    const uploadToken = generateClientId();
    latestAvatarUploadTokenRef.current = uploadToken;
    const fallbackAvatarPath = rawPersona?.avatarPath ?? null;
    // Capture the saved crop so we can revert if the upload fails. The new image
    // almost certainly has different framing/dimensions, so the old normalized
    // crop coords are meaningless for it — clear immediately on upload start
    // and let the cropper re-init from default centered max-square.
    const fallbackAvatarCrop = formData?.avatarCrop ?? null;

    const reader = new FileReader();
    reader.onload = async () => {
      if (latestAvatarUploadTokenRef.current !== uploadToken) return;
      const dataUrl = reader.result as string;
      setAvatarPreview(dataUrl);
      updateField("avatarCrop", null);
      try {
        await uploadAvatar.mutateAsync({
          id: personaId,
          avatar: dataUrl,
          filename: `persona-${personaId}-${Date.now()}.${file.name.split(".").pop()}`,
        });
      } catch {
        if (latestAvatarUploadTokenRef.current !== uploadToken) return;
        setAvatarPreview(fallbackAvatarPath);
        updateField("avatarCrop", fallbackAvatarCrop);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleGeneratedAvatar = useCallback(
    async (avatarDataUrl: string) => {
      if (!personaId) return;
      const uploadToken = generateClientId();
      latestAvatarUploadTokenRef.current = uploadToken;
      setAvatarPreview(avatarDataUrl);
      // Same rationale as handleAvatarUpload — a freshly generated avatar
      // shouldn't inherit the prior image's crop coords.
      updateField("avatarCrop", null);
      await uploadAvatar.mutateAsync({
        id: personaId,
        avatar: avatarDataUrl,
        filename: `persona-${personaId}-${Date.now()}.png`,
      });
      toast.success("Persona avatar generated.");
    },
    [personaId, updateField, uploadAvatar],
  );

  const handleDelete = async () => {
    if (!personaId) return;
    if (
      !(await showConfirmDialog({
        title: "Delete Persona",
        message: "Are you sure you want to delete this persona?",
        confirmLabel: "Delete",
        tone: "destructive",
      }))
    ) {
      return;
    }
    await deletePersona.mutateAsync(personaId);
    closeDetail();
  };

  const getAvatarDataUrl = useCallback(async (src: string) => {
    if (src.startsWith("data:")) return src;

    const response = await fetch(src);
    if (!response.ok) {
      throw new Error("Failed to read persona avatar");
    }

    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }
        reject(new Error("Failed to convert avatar"));
      };
      reader.onerror = () => reject(reader.error ?? new Error("Failed to convert avatar"));
      reader.readAsDataURL(blob);
    });
  }, []);

  const handleAddAsCharacter = useCallback(async () => {
    if (!formData) return;

    const characterName = formData.name.trim();
    if (!characterName) {
      toast.error("Persona needs a name before it can be added as a character.");
      return;
    }

    try {
      const created = (await createCharacter.mutateAsync({
        comment: formData.comment ?? "",
        data: createCharacterDataFromPersona(formData),
      })) as { id?: string };

      const characterId = created?.id;
      if (!characterId) {
        throw new Error("Character was created without an id");
      }

      if (avatarPreview) {
        try {
          await uploadCharacterAvatar.mutateAsync({
            id: characterId,
            avatar: await getAvatarDataUrl(avatarPreview),
          });
        } catch (error) {
          console.warn("[PersonaEditor] Failed to copy avatar to added character:", error);
          toast.error("Character added, but the avatar could not be copied.");
          return;
        }
      }

      toast.success(`Added "${characterName}" as a character.`);
    } catch (error) {
      console.error("[PersonaEditor] Failed to add persona as character:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add persona as character.");
    }
  }, [avatarPreview, createCharacter, formData, getAvatarDataUrl, uploadCharacterAvatar]);

  const handleClose = useCallback(() => {
    if (dirty) {
      setShowUnsavedWarning(true);
      return;
    }
    closeDetail();
  }, [dirty, closeDetail]);

  const forceClose = useCallback(() => {
    setShowUnsavedWarning(false);
    setDirty(false);
    closeDetail();
  }, [closeDetail]);

  if (isLoading || !formData) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="shimmer h-16 w-16 rounded-2xl" />
          <div className="shimmer h-3 w-32 rounded-full" />
        </div>
      </div>
    );
  }

  const headerActionButtonClass = "mari-editor-action inline-flex";
  const saveDisabled = !dirty || saving;
  const saveLabel = saving ? "Saving…" : "Save";
  const saveButtonClass = cn(
    "mari-editor-action mari-editor-action--primary mari-editor-action--save inline-flex",
    saveDisabled && "cursor-not-allowed opacity-50",
  );
  const headerActions = (
    <>
      <button
        type="button"
        onClick={() => setExportDialogOpen(true)}
        className={headerActionButtonClass}
        title="Export persona"
      >
        <svg width="1rem" height="1rem" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M10 13V3m0 0l-4 4m4-4l4 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="3" y="15" width="14" height="2" rx="1" fill="currentColor" />
        </svg>
      </button>

      <button
        type="button"
        onClick={handleAddAsCharacter}
        disabled={createCharacter.isPending || uploadCharacterAvatar.isPending}
        className="mari-editor-action inline-flex disabled:cursor-not-allowed disabled:opacity-50"
        title="Add persona as character"
      >
        {createCharacter.isPending || uploadCharacterAvatar.isPending ? (
          <Loader2 size="1rem" className="animate-spin" />
        ) : (
          <UserPlus size="1rem" />
        )}
      </button>

      <button
        type="button"
        onClick={() => {
          if (!personaId) return;
          duplicatePersona.mutate(personaId, {
            onSuccess: () => {
              toast.success("Persona duplicated");
            },
          });
        }}
        disabled={duplicatePersona.isPending}
        className="mari-editor-action inline-flex disabled:cursor-not-allowed disabled:opacity-50"
        title="Duplicate persona"
      >
        {duplicatePersona.isPending ? <Loader2 size="1rem" className="animate-spin" /> : <Copy size="1rem" />}
      </button>

      <button
        type="button"
        onClick={handleDelete}
        className="mari-editor-action inline-flex"
        title="Delete persona"
      >
        <Trash2 size="1rem" />
      </button>
    </>
  );

  return (
    <div className="mari-editor-shell mari-editor-legacy-bridge flex flex-1 flex-col overflow-hidden">
      <ExportFormatDialog
        open={exportDialogOpen}
        title="Export Persona"
        description="Native keeps Marinara persona metadata, sprites, and attached lorebooks. Compatible exports simple persona JSON for other tools."
        compatibleDescription="Exports persona fields directly without the Marinara wrapper."
        onClose={() => setExportDialogOpen(false)}
        onSelect={(format: ExportFormatChoice) => {
          if (!personaId) return;
          setExportDialogOpen(false);
          void api.download(`/characters/personas/${personaId}/export?format=${format}`);
        }}
      />
      <AvatarGenerationModal
        open={avatarGeneratorOpen}
        title="Generate Persona Avatar"
        entityName={formData.name}
        defaultAppearance={formData.appearance || formData.description || formData.personality}
        defaultAvatarUrl={avatarPreview}
        onClose={() => setAvatarGeneratorOpen(false)}
        onUseAvatar={handleGeneratedAvatar}
      />

      {/* ── Header ── */}
      <div className="mari-editor-header items-start">
        <div className="mari-editor-header-main max-md:min-w-full">
          <button type="button" onClick={handleClose} className="mari-editor-action inline-flex" title="Back">
            <ArrowLeft size="1.125rem" />
          </button>

          {/* Avatar */}
          <div
            className={cn(
              "mari-editor-avatar-tile group relative",
              !avatarPreview && "mari-avatar-placeholder mari-avatar-placeholder--persona",
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt={formData.name}
                className="h-full w-full object-cover"
                style={getAvatarCropStyle(formData.avatarCrop)}
              />
            ) : (
              <User size="1.375rem" className="text-white" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera size="1rem" className="text-white" />
            </div>
            {imageGenerationAvailable && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setAvatarGeneratorOpen(true);
                }}
                className="absolute right-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--card)]/95 text-[var(--primary)] opacity-0 shadow-md ring-1 ring-[var(--border)] transition-opacity hover:bg-[var(--card)] group-hover:opacity-100 max-md:opacity-100"
                title="Generate avatar"
              >
                <Wand2 size="0.75rem" />
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>

          <div className="min-w-0 flex-1">
            <input
              value={formData.name}
              onChange={(e) => updateField("name", e.target.value)}
              className="mari-editor-title-input"
              placeholder="Persona name"
            />
            <input
              value={formData.comment}
              onChange={(e) => updateField("comment", e.target.value)}
              className="mari-editor-subtitle-input"
              placeholder="Title / comment (e.g. 'Modern AU version')"
            />
            <p className="mari-editor-meta text-[0.625rem]">
              {formData.creator ? `by ${formData.creator}` : "No creator"} · v{formData.personaVersion || "1.0"}
            </p>
          </div>
        </div>

        <div className="mari-editor-actions flex">
          <button type="button" onClick={handleSave} disabled={saveDisabled} className={saveButtonClass}>
            <Save size="0.9375rem" />
            <span>{saveLabel}</span>
          </button>
          {headerActions}
        </div>
      </div>

      {/* ── Unsaved changes warning ── */}
      {showUnsavedWarning && (
        <div className="flex items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
          <AlertTriangle size="0.9375rem" className="shrink-0 text-amber-500" />
          <p className="flex-1 text-xs font-medium text-amber-500">You have unsaved changes. Close without saving?</p>
          <button
            type="button"
            onClick={() => setShowUnsavedWarning(false)}
            className="rounded-lg px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)]"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={forceClose}
            className="rounded-lg bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-500 transition-all hover:bg-amber-500/25"
          >
            Discard & close
          </button>
          <button
            type="button"
            onClick={async () => {
              await handleSave();
              closeDetail();
            }}
            className="mari-editor-action mari-editor-action--primary mari-editor-action--compact inline-flex rounded-lg px-3 py-1"
          >
            Save & close
          </button>
        </div>
      )}

      {/* ── Body: Tabs + Content ── */}
      <div className="mari-editor-body @max-5xl:flex-col">
        <EditorTabRail tabs={TABS} activeId={activeTab} onChange={setActiveTab} />

        {/* Tab Content */}
        <div className="mari-editor-content @max-5xl:p-4">
          <div className="mari-editor-content-inner">
            {activeTab === "metadata" && (
              <PersonaMetadataTab
                personaId={personaId}
                formData={formData}
                updateField={updateField}
                avatarPreview={avatarPreview}
              />
            )}
            {activeTab === "card" && (
              <PersonaCardTab formData={formData} updateField={updateField} setDirty={setDirty} />
            )}
            {activeTab === "convo" && (
              // Key by the edited persona so the Convo fields' transient state resets on
              // switch — the editor reuses this instance across personas.
              <PersonaConvoTab
                key={personaId ?? "new-persona"}
                personaId={personaId}
                formData={formData}
                updateField={updateField}
              />
            )}
            {activeTab === "lorebook" && personaId && (
              <PersonaLorebookTab personaId={personaId} personaName={formData.name} />
            )}
            {activeTab === "colors" && (
              <PersonaColorsTab formData={formData} updateField={updateField} avatarUrl={avatarPreview} />
            )}
            {activeTab === "sprites" && personaId && (
              <PersonaSpritesTab
                personaId={personaId}
                personaName={formData.name}
                defaultAppearance={formData.appearance || formData.description}
                defaultAvatarUrl={avatarPreview}
              />
            )}
            {activeTab === "gallery" && personaId && (
              <PersonaGalleryTab personaId={personaId} personaName={formData.name} />
            )}
            {activeTab === "stats" && <PersonaStatsTab formData={formData} updateField={updateField} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Persona Sprites Tab ──

const DEFAULT_EXPRESSIONS = [
  "neutral",
  "happy",
  "sad",
  "angry",
  "surprised",
  "scared",
  "disgusted",
  "thinking",
  "laughing",
  "crying",
  "blushing",
  "smirk",
];

function sanitizeSpriteExportFolderName(value: string, fallback: string): string {
  const sanitized = value
    .replace(/[\\/]/g, "_")
    .replace(/[^a-z0-9._ -]+/gi, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s_-]+|[.\s_-]+$/g, "");
  return sanitized || fallback;
}

function PersonaSpritesTab({
  personaId,
  personaName,
  defaultAppearance,
  defaultAvatarUrl,
}: {
  personaId: string;
  personaName?: string;
  defaultAppearance?: string;
  defaultAvatarUrl?: string | null;
}) {
  type SpriteCategory = "expressions" | "full-body" | "clips";

  const { data: sprites, isLoading } = useCharacterSprites(personaId);
  const { data: spriteCapabilities } = useSpriteCapabilities();
  const uploadSprite = useUploadSprite();
  const deleteSprite = useDeleteSprite();
  const exportSprites = useExportSprites();
  const cleanupSavedSprites = useCleanupSavedSprites();
  const restoreSpriteCleanupBackup = useRestoreSpriteCleanupBackup();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<SpriteCategory>("expressions");
  const [newExpression, setNewExpression] = useState("");
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [cleaningSprites, setCleaningSprites] = useState(false);
  const [savedCleanupStrength, setSavedCleanupStrength] = useState(35);
  const [restoringCleanup, setRestoringCleanup] = useState(false);
  const [lastCleanupBackupId, setLastCleanupBackupId] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [framingSprite, setFramingSprite] = useState<SpriteInfo | null>(null);
  const [savingFrame, setSavingFrame] = useState(false);
  const [wandCleanupSprite, setWandCleanupSprite] = useState<SpriteInfo | null>(null);
  const [savingWandCleanup, setSavingWandCleanup] = useState(false);
  const [deleteSpriteRequest, setDeleteSpriteRequest] = useState<SpriteInfo | null>(null);
  const [deletingSprites, setDeletingSprites] = useState<"single" | "all" | null>(null);
  const [folderProgress, setFolderProgress] = useState<{ done: number; total: number } | null>(null);
  const [spriteGenOpen, setSpriteGenOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const pendingExpressionRef = useRef("");

  const allSprites = (sprites as SpriteInfo[] | undefined) ?? [];
  const portraitExpressionNames = allSprites
    .filter((s) => !s.expression.toLowerCase().startsWith("full_"))
    .map((s) => s.expression);
  const visibleSprites = allSprites.filter((s) =>
    category === "clips"
      ? false
      : category === "full-body"
        ? s.expression.startsWith("full_")
        : !s.expression.startsWith("full_"),
  );
  const existingExpressions = new Set(
    visibleSprites.map((s) => (category === "full-body" ? s.expression.replace(/^full_/, "") : s.expression)),
  );
  const suggestedExpressions = DEFAULT_EXPRESSIONS.filter((e) => !existingExpressions.has(e));
  const spriteGenerationUnavailable = spriteCapabilities?.spriteGenerationAvailable === false;
  const spriteGenerationReason = spriteCapabilities?.reason ?? "Sprite generation is unavailable on this platform.";
  const backgroundCleanupUnavailable = spriteCapabilities?.backgroundRemovalAvailable === false;
  const backgroundCleanupReason = spriteCapabilities?.reason ?? "Background cleanup is unavailable on this platform.";

  const categoryTabs = (
    <div className="inline-flex rounded-xl bg-[var(--secondary)] p-1 ring-1 ring-[var(--border)]">
      {[
        { id: "expressions" as const, label: "Facial Expressions" },
        { id: "full-body" as const, label: "Full-body" },
        { id: "clips" as const, label: "Clips" },
      ].map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setCategory(tab.id)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            category === tab.id
              ? "bg-[var(--primary)]/15 text-[var(--primary)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  const normalizeExpressionForCategory = (raw: string) => {
    return normalizeSpriteExpressionLabel(raw, { fullBody: category === "full-body" });
  };

  const displayExpression = useCallback(
    (stored: string) => (category === "full-body" ? stored.replace(/^full_/, "") : stored),
    [category],
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const expression = pendingExpressionRef.current || normalizeExpressionForCategory(newExpression);
    if (!expression) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await uploadSprite.mutateAsync({ characterId: personaId, expression, image: reader.result as string });
        setNewExpression("");
        pendingExpressionRef.current = "";
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const startUpload = (expression: string) => {
    if (!expression) return;
    pendingExpressionRef.current = expression;
    fileInputRef.current?.click();
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((f) => /\.(png|jpg|jpeg|gif|webp|avif)$/i.test(f.name));
    if (imageFiles.length === 0) return;

    setFolderProgress({ done: 0, total: imageFiles.length });
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i]!;
      const expression = file.name.replace(/\.[^.]+$/, "").trim();
      const normalized = normalizeExpressionForCategory(expression);
      if (!normalized) continue;
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      try {
        await uploadSprite.mutateAsync({ characterId: personaId, expression: normalized, image: dataUrl });
      } catch {
        /* skip */
      }
      setFolderProgress({ done: i + 1, total: imageFiles.length });
    }
    setFolderProgress(null);
    e.target.value = "";
  };

  const handleDeleteSingleSprite = useCallback(async () => {
    if (!deleteSpriteRequest) return;
    setDeletingSprites("single");
    try {
      await deleteSprite.mutateAsync({ characterId: personaId, expression: deleteSpriteRequest.expression });
      setDeleteSpriteRequest(null);
    } finally {
      setDeletingSprites(null);
    }
  }, [deleteSprite, deleteSpriteRequest, personaId]);

  const handleDeleteVisibleSprites = useCallback(async () => {
    if (visibleSprites.length === 0) return;
    setDeletingSprites("all");
    try {
      for (const sprite of visibleSprites) {
        await deleteSprite.mutateAsync({ characterId: personaId, expression: sprite.expression });
      }
      setDeleteSpriteRequest(null);
    } finally {
      setDeletingSprites(null);
    }
  }, [deleteSprite, personaId, visibleSprites]);

  const downloadSpriteFile = useCallback(async (sprite: SpriteInfo) => {
    const response = await fetch(sprite.url);
    if (!response.ok) {
      throw new Error(`Failed to download ${sprite.expression}`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = sprite.filename || `${sprite.expression}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }, []);

  const handleExportSprites = useCallback(
    async (spritesToExport: SpriteInfo[], modeLabel: "visible" | "all") => {
      if (spritesToExport.length === 0) return;

      setExporting(true);

      try {
        const scopeLabel =
          modeLabel === "all" ? "sprites" : category === "full-body" ? "full-body-sprites" : "expressions";
        const folderName = sanitizeSpriteExportFolderName(`${personaName || "persona"}-${scopeLabel}`, "sprites");
        await exportSprites.mutateAsync({
          characterId: personaId,
          expressions: spritesToExport.map((sprite) => sprite.expression),
          folderName,
        });
        toast.success(
          modeLabel === "all"
            ? `Exported ${spritesToExport.length} sprite${spritesToExport.length === 1 ? "" : "s"} as a folder.`
            : `Exported ${spritesToExport.length} ${category === "full-body" ? "full-body" : "expression"} sprite${spritesToExport.length === 1 ? "" : "s"} as a folder.`,
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No sprites were exported. Please try again.");
      } finally {
        setExporting(false);
      }
    },
    [category, exportSprites, personaId, personaName],
  );

  const handleCleanVisibleSprites = useCallback(async () => {
    if (visibleSprites.length === 0) return;

    const modeLabel = category === "full-body" ? "full-body" : "expression";
    if (
      !(await showConfirmDialog({
        title: "Clean Sprite Backgrounds",
        message: `Clean backgrounds on ${visibleSprites.length} saved ${modeLabel} sprite${visibleSprites.length === 1 ? "" : "s"} at strength ${savedCleanupStrength}? Marinara will keep a restore point in case the cleanup looks wrong.`,
        confirmLabel: "Clean",
      }))
    ) {
      return;
    }

    setCleaningSprites(true);
    try {
      const result = await cleanupSavedSprites.mutateAsync({
        characterId: personaId,
        expressions: visibleSprites.map((sprite) => sprite.expression),
        cleanupStrength: savedCleanupStrength,
        engine: "auto",
      });

      if (result.processed > 0) {
        setLastCleanupBackupId(result.backupId ?? null);
        const engineDetails =
          result.backgroundRemoverProcessed && result.builtinProcessed
            ? ` with automatic matte cleanup and AI fallback`
            : result.backgroundRemoverProcessed
              ? ` with AI fallback`
              : ` with automatic matte cleanup`;
        toast.success(`Cleaned ${result.processed} saved sprite${result.processed === 1 ? "" : "s"}${engineDetails}.`);
      }
      if (result.failed.length > 0) {
        toast.warning(`${result.failed.length} sprite${result.failed.length === 1 ? "" : "s"} could not be cleaned.`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to clean saved sprites.");
    } finally {
      setCleaningSprites(false);
    }
  }, [category, cleanupSavedSprites, personaId, savedCleanupStrength, visibleSprites]);

  const handleRestoreLastCleanup = useCallback(async () => {
    if (!lastCleanupBackupId) return;
    setRestoringCleanup(true);
    try {
      const result = await restoreSpriteCleanupBackup.mutateAsync({
        characterId: personaId,
        backupId: lastCleanupBackupId,
      });
      if (result.restored > 0) {
        toast.success(`Restored ${result.restored} sprite${result.restored === 1 ? "" : "s"} from the cleanup backup.`);
      }
      if (result.failed.length > 0) {
        toast.warning(`${result.failed.length} sprite${result.failed.length === 1 ? "" : "s"} could not be restored.`);
      } else {
        setLastCleanupBackupId(null);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to restore sprite cleanup backup.");
    } finally {
      setRestoringCleanup(false);
    }
  }, [lastCleanupBackupId, personaId, restoreSpriteCleanupBackup]);

  const handleApplySpriteFrame = useCallback(
    async (croppedDataUrl: string) => {
      if (!framingSprite) return;

      setSavingFrame(true);
      try {
        await uploadSprite.mutateAsync({
          characterId: personaId,
          expression: framingSprite.expression,
          image: croppedDataUrl,
        });
        toast.success(`Framed ${displayExpression(framingSprite.expression)} sprite.`);
        setFramingSprite(null);
      } finally {
        setSavingFrame(false);
      }
    },
    [displayExpression, framingSprite, personaId, uploadSprite],
  );

  const handleApplyWandCleanup = useCallback(
    async (cleanedDataUrl: string) => {
      if (!wandCleanupSprite) return;

      setSavingWandCleanup(true);
      try {
        await uploadSprite.mutateAsync({
          characterId: personaId,
          expression: wandCleanupSprite.expression,
          image: cleanedDataUrl,
        });
        toast.success(`Cleaned ${displayExpression(wandCleanupSprite.expression)} sprite.`);
        setWandCleanupSprite(null);
      } finally {
        setSavingWandCleanup(false);
      }
    },
    [displayExpression, personaId, uploadSprite, wandCleanupSprite],
  );

  if (category === "clips") {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Persona Sprites"
          subtitle="Upload VN-style sprites and video-call clips for your persona."
          helpText={PERSONA_SPRITES_HELP}
        />

        {categoryTabs}

        <PersonaCallClipsGallery personaId={personaId} personaName={personaName} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Persona Sprites"
        subtitle="Upload VN-style sprites for your persona. These are used in Game Mode and roleplay with the Expression Engine."
        helpText={PERSONA_SPRITES_HELP}
      />

      {categoryTabs}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      <input
        ref={folderInputRef}
        type="file"
        accept="image/*"
        multiple
        // @ts-expect-error — webkitdirectory is non-standard but widely supported
        webkitdirectory=""
        className="hidden"
        onChange={handleFolderUpload}
      />

      {/* Upload new expression */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h4 className="text-xs font-semibold flex items-center gap-1.5">
            <Upload size="0.8125rem" className="text-[var(--primary)]" />
            Add Sprite
          </h4>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <button
              type="button"
              onClick={() => setSpriteGenOpen(true)}
              disabled={spriteGenerationUnavailable}
              className="mari-chrome-accent-surface mari-accent-animated flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-center text-[0.6875rem] font-medium leading-tight transition-all disabled:cursor-not-allowed disabled:opacity-40 max-md:flex-1 max-md:basis-[calc(50%-0.25rem)] max-md:px-2.5"
              title={
                spriteGenerationUnavailable ? spriteGenerationReason : "Generate sprites using AI image generation"
              }
            >
              <Wand2 size="0.8125rem" />
              Generate Sprite
            </button>
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              disabled={!!folderProgress}
              className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-center text-[0.6875rem] font-medium leading-tight text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40 max-md:flex-1 max-md:basis-[calc(50%-0.25rem)] max-md:px-2.5"
              title="Select a folder of PNGs"
            >
              <FolderOpen size="0.8125rem" />
              Upload Folder
            </button>
            <button
              type="button"
              onClick={() => void handleCleanVisibleSprites()}
              disabled={cleaningSprites || backgroundCleanupUnavailable || visibleSprites.length === 0}
              className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-center text-[0.6875rem] font-medium leading-tight text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40 max-md:flex-1 max-md:basis-[calc(50%-0.25rem)] max-md:px-2.5"
              title={
                backgroundCleanupUnavailable
                  ? backgroundCleanupReason
                  : "Clean backgrounds on the currently visible saved sprites"
              }
            >
              {cleaningSprites ? <Loader2 size="0.8125rem" className="animate-spin" /> : <Eraser size="0.8125rem" />}
              {cleaningSprites ? "Cleaning..." : "Clean Backgrounds"}
            </button>
            <div className="relative max-md:flex-1 max-md:basis-[calc(50%-0.25rem)]">
              <button
                type="button"
                onClick={() => setExportMenuOpen((open) => !open)}
                disabled={exporting || allSprites.length === 0}
                className="flex w-full min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-center text-[0.6875rem] font-medium leading-tight text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40 max-md:px-2.5"
                title="Choose which saved sprites to export"
              >
                <ImageDown size="0.8125rem" />
                {exporting ? "Exporting..." : "Export"}
              </button>
              {exportMenuOpen && !exporting && (
                <div className="absolute right-0 top-[calc(100%+0.35rem)] z-30 min-w-44 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 text-xs shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setExportMenuOpen(false);
                      void handleExportSprites(visibleSprites, "visible");
                    }}
                    disabled={visibleSprites.length === 0}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[var(--foreground)] transition-colors hover:bg-[var(--secondary)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ImageDown size="0.75rem" />
                    {category === "full-body" ? "Full-body only" : "Expressions only"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExportMenuOpen(false);
                      void handleExportSprites(allSprites, "all");
                    }}
                    disabled={allSprites.length === 0}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[var(--foreground)] transition-colors hover:bg-[var(--secondary)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ImageDown size="0.75rem" />
                    All sprites
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--secondary)]/60 px-3 py-2">
          <span className="text-[0.6875rem] font-medium text-[var(--foreground)]">Cleanup strength</span>
          <span className="text-[0.625rem] text-[var(--muted-foreground)]">Soft</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={savedCleanupStrength}
            onChange={(e) => setSavedCleanupStrength(Number(e.target.value))}
            disabled={cleaningSprites}
            className="min-w-40 flex-1 accent-[var(--primary)] disabled:opacity-50"
          />
          <span className="text-[0.625rem] text-[var(--muted-foreground)]">Aggressive</span>
          <span className="w-8 text-right text-[0.6875rem] tabular-nums text-[var(--muted-foreground)]">
            {savedCleanupStrength}
          </span>
        </div>

        {folderProgress && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
            <Loader2 size="0.75rem" className="animate-spin text-[var(--primary)]" />
            Uploading {folderProgress.done}/{folderProgress.total} sprites…
          </div>
        )}
        {cleaningSprites && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
            <Loader2 size="0.75rem" className="animate-spin text-[var(--primary)]" />
            Applying automatic matte cleanup to saved sprites…
          </div>
        )}
        {lastCleanupBackupId && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
            <span>Last cleanup has a restore point.</span>
            <button
              type="button"
              onClick={() => void handleRestoreLastCleanup()}
              disabled={restoringCleanup}
              className="flex items-center gap-1.5 rounded-md bg-[var(--card)] px-2.5 py-1 text-[0.6875rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] disabled:opacity-40"
            >
              {restoringCleanup ? <Loader2 size="0.75rem" className="animate-spin" /> : <RotateCcw size="0.75rem" />}
              Undo Cleanup
            </button>
          </div>
        )}
        {spriteGenerationUnavailable && (
          <div className="rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
            {spriteGenerationReason}
          </div>
        )}
        {backgroundCleanupUnavailable && !spriteGenerationUnavailable && (
          <div className="rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
            {backgroundCleanupReason}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={newExpression}
            onChange={(e) => setNewExpression(e.target.value)}
            placeholder={
              category === "full-body"
                ? "Pose name (e.g. idle, walk, battle_stance)…"
                : "Expression name (e.g. happy, sad, angry)…"
            }
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newExpression.trim()) {
                startUpload(normalizeExpressionForCategory(newExpression));
              }
            }}
          />
          <button
            type="button"
            onClick={() => newExpression.trim() && startUpload(normalizeExpressionForCategory(newExpression))}
            disabled={!newExpression.trim() || uploading}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] shadow-sm transition-all hover:shadow-md disabled:opacity-40"
          >
            <Plus size="0.8125rem" />
            Upload
          </button>
        </div>

        {category === "expressions" && suggestedExpressions.length > 0 && (
          <div>
            <p className="text-[0.625rem] text-[var(--muted-foreground)] mb-1.5">Quick add:</p>
            <div className="flex flex-wrap gap-1">
              {suggestedExpressions.slice(0, 12).map((expr) => (
                <button
                  type="button"
                  key={expr}
                  onClick={() => startUpload(expr)}
                  className="rounded-lg bg-[var(--secondary)] px-2.5 py-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                >
                  {expr}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sprite grid */}
      {framingSprite && (
        <SpriteFrameEditor
          imageUrl={framingSprite.url}
          label={displayExpression(framingSprite.expression)}
          applying={savingFrame}
          onApply={handleApplySpriteFrame}
          onClose={() => setFramingSprite(null)}
        />
      )}

      {wandCleanupSprite && (
        <SpriteWandCleanupEditor
          imageUrl={wandCleanupSprite.url}
          label={displayExpression(wandCleanupSprite.expression)}
          applying={savingWandCleanup}
          onApply={handleApplyWandCleanup}
          onClose={() => setWandCleanupSprite(null)}
        />
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="shimmer aspect-[3/4] rounded-xl" />
          ))}
        </div>
      ) : visibleSprites.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {visibleSprites.map((sprite) => (
            <div
              key={sprite.expression}
              className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] transition-all hover:border-[var(--primary)]/30 hover:shadow-md"
            >
              <button
                type="button"
                onClick={() => setWandCleanupSprite(sprite)}
                className="group/preview relative block aspect-[3/4] w-full bg-[var(--secondary)]"
                title="Open wand cleanup"
              >
                <img src={sprite.url} alt={sprite.expression} loading="lazy" className="h-full w-full object-contain" />
                <span className="pointer-events-none absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--card)]/90 text-[var(--primary)] opacity-0 shadow-lg ring-1 ring-[var(--border)] transition-opacity group-hover/preview:opacity-100 max-md:opacity-100">
                  <Wand2 size="0.875rem" />
                </span>
              </button>
              <div className="flex items-center justify-between p-2">
                <span
                  className="max-w-[10rem] truncate text-[0.6875rem] font-medium capitalize"
                  title={displayExpression(sprite.expression)}
                >
                  {displayExpression(sprite.expression)}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => setFramingSprite(sprite)}
                    className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    title="Frame"
                  >
                    <Crop size="0.6875rem" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadSpriteFile(sprite)}
                    className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    title="Download"
                  >
                    <ImageDown size="0.6875rem" />
                  </button>
                  <button
                    type="button"
                    onClick={() => startUpload(sprite.expression)}
                    className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    title="Replace"
                  >
                    <Upload size="0.6875rem" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteSpriteRequest(sprite)}
	                    className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    title="Delete"
                  >
                    <Trash2 size="0.6875rem" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] py-12 text-center">
          <Image size="1.75rem" className="text-[var(--muted-foreground)]/40" />
          <div>
            <p className="text-sm font-medium text-[var(--muted-foreground)]">No sprites yet</p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]/60">
              {category === "full-body"
                ? "Upload full-body sprites above. Use transparent PNGs for best results."
                : "Upload expression sprites above. Use transparent PNGs for best results."}
            </p>
          </div>
        </div>
      )}

      {deleteSpriteRequest && (
        <Modal
          open
          onClose={() => {
            if (!deletingSprites) setDeleteSpriteRequest(null);
          }}
          title="Delete Sprite"
          width="max-w-sm"
        >
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-[var(--foreground)]">
              Delete sprite for "{displayExpression(deleteSpriteRequest.expression)}"?
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {visibleSprites.length > 1 ? (
                <button
                  type="button"
                  onClick={() => void handleDeleteVisibleSprites()}
                  disabled={!!deletingSprites}
	                  className="mr-auto inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50 sm:px-3 sm:text-sm"
                >
                  {deletingSprites === "all" ? (
                    <Loader2 size="0.875rem" className="animate-spin" />
                  ) : (
                    <Trash2 size="0.875rem" />
                  )}
                  Delete All {category === "full-body" ? "Full-Body" : "Expressions"}
                </button>
              ) : null}
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteSpriteRequest(null)}
                  disabled={!!deletingSprites}
                  className="rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50 sm:px-3 sm:text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteSingleSprite()}
                  disabled={!!deletingSprites}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--destructive)] px-2.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--destructive)]/85 disabled:opacity-50 sm:px-3 sm:text-sm"
                >
                  {deletingSprites === "single" && <Loader2 size="0.875rem" className="animate-spin" />}
                  Delete
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Sprite Generation Modal */}
      <SpriteGenerationModal
        open={spriteGenOpen}
        onClose={() => setSpriteGenOpen(false)}
        entityId={personaId}
        initialSpriteType={category === "full-body" ? "full-body" : "expressions"}
        existingExpressionNames={portraitExpressionNames}
        defaultAppearance={defaultAppearance}
        defaultAvatarUrl={defaultAvatarUrl}
        onSpritesGenerated={() => {
          queryClient.invalidateQueries({ queryKey: spriteKeys.list(personaId) });
        }}
      />
    </div>
  );
}

// ── Persona Colors Tab ──

function PersonaColorsTab({
  formData,
  updateField,
  avatarUrl,
}: {
  formData: PersonaFormData;
  updateField: <K extends keyof PersonaFormData>(key: K, value: PersonaFormData[K]) => void;
  avatarUrl: string | null;
}) {
  const [extracting, setExtracting] = useState(false);

  const handleExtract = async () => {
    if (!avatarUrl) return;
    setExtracting(true);
    try {
      const [nameColor, dialogueColor, boxColor] = await extractColorsFromImage(avatarUrl);
      updateField("nameColor", nameColor);
      updateField("dialogueColor", dialogueColor);
      updateField("boxColor", boxColor);
    } catch {
      // silently ignore — user can just pick colors manually
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Persona Colors"
        subtitle="Customize how your persona appears in chats. Colors are applied to your name, dialogue, and message bubble."
        helpText={PERSONA_COLORS_HELP}
      />

      <button
        type="button"
        disabled={!avatarUrl || extracting}
        onClick={handleExtract}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition-all",
          avatarUrl
            ? "mari-chrome-accent-surface mari-accent-animated active:scale-[0.98]"
            : "cursor-not-allowed bg-white/5 text-[var(--muted-foreground)]/50",
        )}
      >
        {extracting ? <Loader2 size="0.875rem" className="animate-spin" /> : <Palette size="0.875rem" />}
        {extracting ? "Extracting..." : avatarUrl ? "Extract Colors from Avatar" : "Upload an avatar first"}
      </button>

      <div className="space-y-3 overflow-hidden rounded-xl border border-[var(--border)] bg-black/30 p-4">
        <p className="text-[0.625rem] font-medium uppercase tracking-widest text-[var(--muted-foreground)]">Preview</p>
        <div className="flex gap-3 flex-row-reverse">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-neutral-500 to-neutral-600 ring-2 ring-white/15">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={`${formData.name || "Persona"} avatar preview`}
                className="h-full w-full object-cover"
                style={getAvatarCropStyle(formData.avatarCrop)}
              />
            ) : (
              <User size="1rem" className="text-white" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-end space-y-1">
            <span
              className="text-[0.75rem] font-bold tracking-tight"
              style={
                formData.nameColor
                  ? formData.nameColor.includes("gradient(")
                    ? {
                        backgroundImage: formData.nameColor,
                        backgroundRepeat: "no-repeat",
                        backgroundSize: "100% 100%",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                        color: "transparent",
                        display: "inline-block",
                      }
                    : { color: formData.nameColor }
                  : { color: "rgb(212, 212, 212)" }
              }
            >
              {formData.name || "You"}
            </span>
            <div
              className="rounded-2xl rounded-tr-sm px-4 py-3 text-[0.8125rem] leading-[1.8] backdrop-blur-md ring-1 ring-white/10"
              style={
                formData.boxColor
                  ? { backgroundColor: formData.boxColor }
                  : { backgroundColor: "rgba(255, 255, 255, 0.12)" }
              }
            >
              <span className="text-neutral-100">I turn around and raise my hand. </span>
              <strong
                style={formData.dialogueColor ? { color: formData.dialogueColor } : { color: "rgb(255, 255, 255)" }}
              >
                &ldquo;General Kenobi.&rdquo;
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Name Color */}
      <ColorPicker
        value={formData.nameColor}
        onChange={(v) => updateField("nameColor", v)}
        gradient
        label="Name Display Color"
        helpText="The color (or gradient) used for your persona's name in chat messages and persona selectors. Supports gradients!"
      />

      {/* Dialogue Color */}
      <ColorPicker
        value={formData.dialogueColor}
        onChange={(v) => updateField("dialogueColor", v)}
        label="Dialogue Highlight Color"
        helpText={
          'Text inside dialogue quotation marks ("", “”, «», 「」, 『』) will be automatically colored with this, and can also be bolded from Settings.'
        }
      />

      {/* Box Color */}
      <ColorPicker
        value={formData.boxColor}
        onChange={(v) => updateField("boxColor", v)}
        label="Message Box Color"
        helpText="Background color for your persona's chat message bubbles. Use a semi-transparent color for best results (e.g. rgba)."
      />
    </div>
  );
}

// ── Persona Stats Tab ──

interface PersonaStatBar {
  name: string;
  value: number;
  max: number;
  color: string;
}

interface PersonaStatsData {
  enabled: boolean;
  bars: PersonaStatBar[];
  rpgStats?: RPGStatsConfig;
}

const DEFAULT_RPG_STATS: RPGStatsConfig = {
  enabled: false,
  attributes: [
    { name: "STR", value: 10 },
    { name: "DEX", value: 10 },
    { name: "CON", value: 10 },
    { name: "INT", value: 10 },
    { name: "WIS", value: 10 },
    { name: "CHA", value: 10 },
  ],
  hp: { value: 100, max: 100 },
  pools: createDefaultRpgStatPools(),
};

const DEFAULT_PERSONA_STATS: PersonaStatsData = {
  enabled: false,
  bars: [
    { name: "Satiety", value: 100, max: 100, color: "#f59e0b" },
    { name: "Energy", value: 100, max: 100, color: "#22c55e" },
    { name: "Hygiene", value: 100, max: 100, color: "#3b82f6" },
    { name: "Mood", value: 100, max: 100, color: "#eab308" },
  ],
  rpgStats: DEFAULT_RPG_STATS,
};

function createNewRpgPool(existing: readonly RPGStatPool[]): RPGStatPool {
  const used = new Set(existing.map((pool) => pool.name.trim().toLowerCase()).filter(Boolean));
  let index = existing.length + 1;
  let name = `Pool ${index}`;
  while (used.has(name.toLowerCase())) {
    name = `Pool ${++index}`;
  }
  return { name, value: 100, max: 100, color: "#a78bfa" };
}

function PersonaStatsTab({
  formData,
  updateField,
}: {
  formData: PersonaFormData;
  updateField: <K extends keyof PersonaFormData>(key: K, value: PersonaFormData[K]) => void;
}) {
  const parsed: PersonaStatsData = formData.personaStats
    ? (() => {
        try {
          return JSON.parse(formData.personaStats) as PersonaStatsData;
        } catch {
          return DEFAULT_PERSONA_STATS;
        }
      })()
    : DEFAULT_PERSONA_STATS;

  const save = (next: PersonaStatsData) => {
    updateField("personaStats", JSON.stringify(next));
  };

  const updateBar = (index: number, field: string, value: string | number) => {
    const next = [...parsed.bars];
    next[index] = { ...next[index], [field]: value };
    save({ ...parsed, bars: next });
  };

  const addBar = () => {
    save({
      ...parsed,
      bars: [...parsed.bars, { name: "New Stat", value: 100, max: 100, color: "#38bdf8" }],
    });
  };

  const removeBar = (index: number) => {
    save({ ...parsed, bars: parsed.bars.filter((_, i) => i !== index) });
  };

  // RPG Attributes helpers
  const rpgStats: RPGStatsConfig = parsed.rpgStats ?? DEFAULT_RPG_STATS;
  const rpgPools = normalizeRpgStatPools(rpgStats);

  const updateRpg = (patch: Partial<RPGStatsConfig>) => {
    save({ ...parsed, rpgStats: { ...rpgStats, ...patch } });
  };

  const updateRpgPools = (nextPools: RPGStatPool[]) => {
    updateRpg({
      pools: nextPools,
      hp: syncRpgHpFromPools(nextPools, rpgStats.hp),
    });
  };

  const updateRpgPool = (index: number, patch: Partial<RPGStatPool>) => {
    updateRpgPools(rpgPools.map((pool, poolIndex) => (poolIndex === index ? { ...pool, ...patch } : pool)));
  };

  const updateRpgAttribute = (index: number, field: string, value: string | number) => {
    const next = [...rpgStats.attributes];
    next[index] = { ...next[index], [field]: value };
    updateRpg({ attributes: next });
  };

  const addRpgAttribute = () => {
    updateRpg({ attributes: [...rpgStats.attributes, { name: "NEW", value: 10 }] });
  };

  const removeRpgAttribute = (index: number) => {
    updateRpg({ attributes: rpgStats.attributes.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Persona Status Bars"
        subtitle="Track your persona's physical and mental needs. These are updated by the Persona Stats agent after each message."
        helpText={PERSONA_STATS_HELP}
      />

      <SettingsSwitch
        label={<span className="font-medium">Enable Persona Stats</span>}
        description="Tracked by the Persona Stats agent. Stats appear in the HUD and are adjusted based on narrative events."
        checked={parsed.enabled}
        onChange={(checked) => save({ ...parsed, enabled: checked })}
        labelPosition="start"
        className="justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        labelClassName="text-sm"
      />

      {parsed.enabled && (
        <>
          {/* Stat bars */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Status Bars</h3>
              <button
                type="button"
                onClick={addBar}
                className="mari-chrome-accent-surface mari-accent-animated flex items-center gap-1 rounded-lg px-2.5 py-1 text-[0.6875rem] font-medium transition-colors"
              >
                <Plus size="0.75rem" />
                Add
              </button>
            </div>

            <div className="space-y-2">
              {parsed.bars.map((bar, i) => (
                <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={bar.color}
                      onChange={(e) => updateBar(i, "color", e.target.value)}
                      className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent"
                    />
                    <input
                      value={bar.name}
                      onChange={(e) => updateBar(i, "name", e.target.value)}
                      className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs font-medium"
                      placeholder="Stat name"
                    />
                    <span className="text-[0.625rem] text-[var(--muted-foreground)]">max:</span>
                    <input
                      type="number"
                      value={bar.max}
                      onChange={(e) => updateBar(i, "max", parseInt(e.target.value) || 1)}
                      className="w-14 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-center text-xs"
                      min={1}
                    />
                    <button
                      type="button"
                      onClick={() => removeBar(i)}
                      className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-red-500/15 hover:text-red-400"
                    >
                      <X size="0.75rem" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── RPG Attributes ── */}
      <div className="border-t border-[var(--border)] pt-6">
        <SectionHeader
          title="RPG Attributes"
          subtitle="Define your persona's RPG stats (STR, DEX, etc.) and HP — just like character cards. Tracked via Persona Stats in the game state."
          helpText={PERSONA_RPG_ATTRIBUTES_HELP}
        />

        <SettingsSwitch
          label={<span className="font-medium">Enable RPG Attributes</span>}
          description="Attributes are injected into the prompt and tracked via Persona Stats in the game state."
          checked={rpgStats.enabled}
          onChange={(checked) => updateRpg({ enabled: checked })}
          labelPosition="start"
          className="justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
          labelClassName="text-sm"
        />

        {rpgStats.enabled && (
          <>
            {/* Pools */}
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Pools</h3>
                <button
                  type="button"
                  onClick={() => updateRpgPools([...rpgPools, createNewRpgPool(rpgPools)])}
                  className="mari-chrome-accent-surface mari-accent-animated flex items-center gap-1 rounded-lg px-2.5 py-1 text-[0.6875rem] font-medium transition-colors"
                >
                  <Plus size="0.75rem" />
                  Add
                </button>
              </div>
              <div className="space-y-2">
                {rpgPools.map((pool, i) => (
                  <div
                    key={i}
                    className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 sm:grid-cols-[2rem_minmax(0,1fr)_5rem_5rem_auto] sm:items-center"
                  >
                    <input
                      type="color"
                      value={pool.color}
                      onChange={(e) => updateRpgPool(i, { color: e.target.value })}
                      className="h-8 w-8 rounded border border-[var(--border)] bg-transparent p-0.5"
                      aria-label={`${pool.name || "Pool"} color`}
                    />
                    <input
                      value={pool.name}
                      onChange={(e) => updateRpgPool(i, { name: e.target.value })}
                      className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs font-medium"
                      placeholder="Name"
                    />
                    <input
                      type="number"
                      value={pool.value}
                      onChange={(e) => updateRpgPool(i, { value: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-center text-xs"
                      min={0}
                      aria-label={`${pool.name || "Pool"} value`}
                    />
                    <input
                      type="number"
                      value={pool.max}
                      onChange={(e) => updateRpgPool(i, { max: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-center text-xs"
                      min={1}
                      aria-label={`${pool.name || "Pool"} max`}
                    />
                    <button
                      type="button"
                      onClick={() => updateRpgPools(rpgPools.filter((_, poolIndex) => poolIndex !== i))}
                      className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-red-500/15 hover:text-red-400"
                      aria-label={`Remove ${pool.name || "pool"}`}
                    >
                      <X size="0.75rem" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Attributes */}
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Attributes</h3>
                <button
                  type="button"
                  onClick={addRpgAttribute}
                  className="mari-chrome-accent-surface mari-accent-animated flex items-center gap-1 rounded-lg px-2.5 py-1 text-[0.6875rem] font-medium transition-colors"
                >
                  <Plus size="0.75rem" />
                  Add
                </button>
              </div>

              <div className="space-y-2">
                {rpgStats.attributes.map((attr, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2"
                  >
                    <input
                      value={attr.name}
                      onChange={(e) => updateRpgAttribute(i, "name", e.target.value)}
                      className="w-20 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs font-medium"
                      placeholder="Name"
                    />
                    <input
                      type="number"
                      value={attr.value}
                      onChange={(e) => updateRpgAttribute(i, "value", parseInt(e.target.value) || 0)}
                      className="w-16 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-center text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removeRpgAttribute(i)}
                      className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-red-500/15 hover:text-red-400"
                    >
                      <X size="0.75rem" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function PersonaMetadataTab({
  personaId,
  formData,
  updateField,
  avatarPreview,
}: {
  personaId: string | null;
  formData: PersonaFormData;
  updateField: <K extends keyof PersonaFormData>(key: K, value: PersonaFormData[K]) => void;
  avatarPreview: string | null;
}) {
  const [newTag, setNewTag] = useState("");

  const addTag = () => {
    const nextTags = appendNewTags(formData.tags, newTag);
    if (nextTags === formData.tags) return;
    updateField("tags", nextTags);
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    updateField(
      "tags",
      formData.tags.filter((t) => t !== tag),
    );
  };

  const removeAllTags = () => {
    updateField("tags", []);
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Metadata"
        subtitle="Basic persona info: name, title, creator, version, avatar, tags."
        helpText={PERSONA_METADATA_HELP}
      />

      {personaId && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/70 px-3 py-2">
          <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Persona ID
          </span>
          <code className="min-w-0 flex-1 break-all rounded-lg bg-[var(--background)] px-2 py-1 text-[0.6875rem] text-[var(--foreground)]">
            {personaId}
          </code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(personaId);
              toast.success("Persona ID copied");
            }}
            className="mari-editor-action inline-flex h-8 px-2 text-[0.6875rem]"
            title="Copy persona ID"
          >
            <Copy size="0.75rem" />
            Copy
          </button>
        </div>
      )}

      {avatarPreview && (
        <AvatarCropWidget
          src={avatarPreview}
          alt={formData.name}
          crop={formData.avatarCrop}
          onChange={(next) => updateField("avatarCrop", next)}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 sm:col-span-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            Name{" "}
            <HelpTooltip text="Your persona's display name. This is injected into prompts as the user's persona identity." />
          </span>
          <input
            value={formData.name}
            onChange={(e) => updateField("name", e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
            placeholder="Persona name"
          />
        </label>
        <label className="space-y-1.5 sm:col-span-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            Title / comment{" "}
            <HelpTooltip text="A short note shown under the persona name in the library, useful for variants or alternate versions." />
          </span>
          <input
            value={formData.comment}
            onChange={(e) => updateField("comment", e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
            placeholder="Modern AU version"
          />
        </label>
        <label className="space-y-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            Phonetic name{" "}
            <HelpTooltip text="Optional pronunciation override used only when your persona name is sent to text-to-speech." />
          </span>
          <input
            value={formData.phoneticName}
            onChange={(e) => updateField("phoneticName", e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
            placeholder={formData.name}
          />
        </label>
        <label className="space-y-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            Creator{" "}
            <HelpTooltip text="The person who made this persona. Useful for credit when sharing persona cards." />
          </span>
          <input
            value={formData.creator}
            onChange={(e) => updateField("creator", e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
            placeholder="Your name"
          />
        </label>
        <label className="space-y-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            Version <HelpTooltip text="Version number for tracking changes to this persona definition over time." />
          </span>
          <input
            value={formData.personaVersion}
            onChange={(e) => updateField("personaVersion", e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
            placeholder="1.0"
          />
          <PersonaVersionHistoryPanel personaId={personaId} currentData={formData} currentAvatarPath={avatarPreview} />
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            Tags{" "}
            <HelpTooltip text="Labels for organizing personas. Use tags like 'fantasy', 'modern', 'OC' etc. to categorize and filter." />
          </span>
          {formData.tags.length > 0 && (
            <button
              type="button"
              onClick={removeAllTags}
              className="mari-chrome-control mari-chrome-control--compact mari-chrome-control--danger"
            >
              Remove All
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {formData.tags.map((tag) => (
            <span key={tag} className="mari-chrome-control mari-chrome-control--compact group/tag">
              <Tag size="0.625rem" />
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-[var(--destructive)]/20 hover:text-[var(--destructive)]"
                title={`Remove tag "${tag}"`}
              >
                <X size="0.625rem" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Add tag..."
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5 text-xs outline-none focus:border-[var(--primary)]/40"
          />
          <button
            type="button"
            onClick={addTag}
            className="mari-chrome-control mari-chrome-control--compact mari-chrome-control--selected px-3 py-1.5"
          >
            Add
          </button>
        </div>
      </div>

      <div className="block space-y-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
          Creator Notes{" "}
          <HelpTooltip text="Private notes about this persona — tips for use, known quirks, recommended settings. Not sent to the AI." />
        </span>
        <MacroTextarea
          value={formData.creatorNotes}
          onChange={(value) => updateField("creatorNotes", value)}
          rows={4}
          title="Creator Notes"
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-sm outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          placeholder="Notes about this persona, intended use, tips for best results..."
        />
      </div>
    </div>
  );
}

const PERSONA_VERSION_COMPARE_FIELDS: Array<{ key: keyof PersonaCardSnapshot; label: string }> = [
  { key: "name", label: "Name" },
  { key: "creator", label: "Creator" },
  { key: "creatorNotes", label: "Creator Notes" },
  { key: "description", label: "Description" },
  { key: "personality", label: "Personality" },
  { key: "scenario", label: "Scenario" },
  { key: "backstory", label: "Backstory" },
  { key: "appearance", label: "Appearance" },
  { key: "avatarCrop", label: "Avatar Crop" },
  { key: "nameColor", label: "Name Color" },
  { key: "dialogueColor", label: "Dialogue Color" },
  { key: "boxColor", label: "Box Color" },
  { key: "personaStats", label: "Persona Stats" },
  { key: "tags", label: "Tags" },
  { key: "savedStatusOptions", label: "Saved Status Options" },
  { key: "convoDisplayName", label: "Convo Display Name" },
  { key: "aboutMe", label: "About Me" },
  { key: "convoBehavior", label: "Convo Behavior" },
];

function buildCurrentPersonaSnapshot(formData: PersonaFormData): PersonaCardSnapshot {
  return {
    name: formData.name,
    creator: formData.creator,
    personaVersion: formData.personaVersion,
    creatorNotes: formData.creatorNotes,
    description: formData.description,
    personality: formData.personality,
    scenario: formData.scenario,
    backstory: formData.backstory,
    appearance: formData.appearance,
    avatarCrop: formData.avatarCrop ? JSON.stringify(formData.avatarCrop) : "",
    nameColor: formData.nameColor,
    dialogueColor: formData.dialogueColor,
    boxColor: formData.boxColor,
    trackerCardColors: serializeTrackerCardColorConfig(formData.trackerCardColors),
    personaStats: formData.personaStats,
    tags: JSON.stringify(formData.tags),
    savedStatusOptions: formData.savedStatusOptions,
    convoDisplayName: formData.convoDisplayName,
    aboutMe: formData.aboutMe,
    convoBehavior:
      formData.convoBehavior && formData.convoBehavior.instruction?.trim()
        ? JSON.stringify(formData.convoBehavior)
        : "",
  };
}

function formatVersionTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPersonaVersionTitle(version: PersonaCardVersion): string {
  return version.version?.trim() ? `v${version.version}` : "Untitled version";
}

function formatPersonaVersionValue(data: PersonaCardSnapshot, key: keyof PersonaCardSnapshot): string {
  const value = data[key];
  if (typeof value !== "string") return "";
  if (!value.trim()) return "";
  if (key === "avatarCrop" || key === "trackerCardColors" || key === "personaStats" || key === "tags") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return value;
}

function PersonaVersionHistoryPanel({
  personaId,
  currentData,
  currentAvatarPath,
}: {
  personaId: string | null;
  currentData: PersonaFormData;
  currentAvatarPath: string | null;
}) {
  const { data: versions = [], isLoading } = usePersonaVersions(personaId);
  const restoreVersion = useRestorePersonaVersion();
  const deleteVersion = useDeletePersonaVersion();
  const [selectedVersion, setSelectedVersion] = useState<PersonaCardVersion | null>(null);

  if (!personaId) return null;

  const currentSnapshot = buildCurrentPersonaSnapshot(currentData);

  const handleRestore = async (version: PersonaCardVersion) => {
    const confirmed = await showConfirmDialog({
      title: "Restore Persona Version",
      message: `Restore ${currentData.name || "this persona"} to ${getPersonaVersionTitle(version)}? The current persona card will become exactly that saved version without creating another history entry.`,
      confirmLabel: "Restore",
    });
    if (!confirmed) return;
    try {
      await restoreVersion.mutateAsync({ id: personaId, versionId: version.id });
      toast.success(`Restored ${getPersonaVersionTitle(version)}.`);
      setSelectedVersion(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore persona version.");
    }
  };

  const handleDeleteVersion = async (version: PersonaCardVersion) => {
    const confirmed = await showConfirmDialog({
      title: "Delete Saved Version",
      message: `Delete ${getPersonaVersionTitle(version)} from version history? This does not change the current persona card.`,
      confirmLabel: "Delete",
      tone: "destructive",
    });
    if (!confirmed) return;
    try {
      await deleteVersion.mutateAsync({ id: personaId, versionId: version.id });
      toast.success(`Deleted ${getPersonaVersionTitle(version)}.`);
      setSelectedVersion((current) => (current?.id === version.id ? null : current));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete persona version.");
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/70 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
          <History size="0.75rem" />
          Version history
        </span>
        <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
          {isLoading ? "Loading" : `${versions.length} saved`}
        </span>
      </div>

      {versions.length === 0 ? (
        <p className="mt-2 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
          Previous persona states will appear here after the next edit.
        </p>
      ) : (
        <div className="mt-2 flex max-h-36 flex-col gap-1.5 overflow-y-auto pr-1">
          {versions.map((version) => (
            <div
              key={version.id}
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5"
            >
              <button
                type="button"
                onClick={() => setSelectedVersion(version)}
                className="min-w-0 flex-1 text-left"
                title="Compare with current persona"
              >
                <span className="block truncate text-[0.6875rem] font-medium text-[var(--foreground)]">
                  {getPersonaVersionTitle(version)}
                </span>
                <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                  {formatVersionTimestamp(version.createdAt)}
                  {version.source ? ` · ${version.source}` : ""}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleRestore(version)}
                disabled={restoreVersion.isPending || deleteVersion.isPending}
                className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
                title="Restore this version"
              >
                {restoreVersion.isPending ? (
                  <Loader2 size="0.75rem" className="animate-spin" />
                ) : (
                  <RotateCcw size="0.75rem" />
                )}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteVersion(version)}
                disabled={restoreVersion.isPending || deleteVersion.isPending}
	                className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
                title="Delete this saved version"
              >
                {deleteVersion.isPending && deleteVersion.variables?.versionId === version.id ? (
                  <Loader2 size="0.75rem" className="animate-spin" />
                ) : (
                  <Trash2 size="0.75rem" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!selectedVersion}
        onClose={() => setSelectedVersion(null)}
        title={selectedVersion ? `Compare ${getPersonaVersionTitle(selectedVersion)}` : "Compare Version"}
        width="max-w-5xl"
      >
        {selectedVersion && (
          <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto">
            <div className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-xs md:grid-cols-2">
              <div>
                <p className="font-semibold text-[var(--foreground)]">Current persona</p>
                <p className="mt-1 text-[var(--muted-foreground)]">
                  v{currentData.personaVersion || "1.0"}
                  {currentData.comment ? ` · ${currentData.comment}` : ""}
                  {currentAvatarPath ? " · has avatar" : ""}
                </p>
              </div>
              <div>
                <p className="font-semibold text-[var(--foreground)]">{getPersonaVersionTitle(selectedVersion)}</p>
                <p className="mt-1 text-[var(--muted-foreground)]">
                  {formatVersionTimestamp(selectedVersion.createdAt)}
                  {selectedVersion.reason ? ` · ${selectedVersion.reason}` : ""}
                  {selectedVersion.avatarPath ? " · has avatar" : ""}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {PERSONA_VERSION_COMPARE_FIELDS.map((field) => {
                const currentValue = formatPersonaVersionValue(currentSnapshot, field.key);
                const savedValue = formatPersonaVersionValue(selectedVersion.data, field.key);
                const changed = currentValue !== savedValue;
                if (!changed && !currentValue && !savedValue) return null;
                return (
                  <div key={field.key} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--foreground)]">{field.label}</span>
                      {changed && (
                        <span className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[0.625rem] font-medium text-[var(--primary)]">
                          changed
                        </span>
                      )}
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="min-h-20 whitespace-pre-wrap rounded-lg bg-[var(--secondary)] p-2 text-xs leading-relaxed text-[var(--foreground)]">
                        {currentValue || <span className="text-[var(--muted-foreground)]">Empty</span>}
                      </div>
                      <div className="min-h-20 whitespace-pre-wrap rounded-lg bg-[var(--secondary)] p-2 text-xs leading-relaxed text-[var(--foreground)]">
                        {savedValue || <span className="text-[var(--muted-foreground)]">Empty</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end border-t border-[var(--border)] pt-3">
              <button
                type="button"
                onClick={() => handleRestore(selectedVersion)}
                disabled={restoreVersion.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {restoreVersion.isPending ? (
                  <Loader2 size="0.75rem" className="animate-spin" />
                ) : (
                  <RotateCcw size="0.75rem" />
                )}
                Restore this version
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function PersonaConvoTab({
  personaId,
  formData,
  updateField,
}: {
  personaId: string | null;
  formData: PersonaFormData;
  updateField: <K extends keyof PersonaFormData>(key: K, value: PersonaFormData[K]) => void;
}) {
  return (
    <ConvoProfileFields
      kind="persona"
      entityKey={personaId ?? "new-persona"}
      baseName={formData.name}
      displayName={formData.convoDisplayName}
      onDisplayNameChange={(v) => updateField("convoDisplayName", v)}
      aboutMe={formData.aboutMe}
      onAboutMeChange={(v) => updateField("aboutMe", v)}
      behavior={formData.convoBehavior}
      onBehaviorChange={(b) => updateField("convoBehavior", b)}
    />
  );
}

function PersonaCardTab({
  formData,
  updateField,
  setDirty,
}: {
  formData: PersonaFormData;
  updateField: <K extends keyof PersonaFormData>(key: K, value: PersonaFormData[K]) => void;
  setDirty: (v: boolean) => void;
}) {
  return (
    <div>
      <SectionHeader
        title="Card"
        subtitle="Write your core persona card fields in one focused workspace."
        helpText={PERSONA_CARD_HELP}
      />
      <EditorSectionJumps items={PERSONA_CARD_SECTIONS} />
      <div className="space-y-10">
        <EditorSectionAnchor id="persona-card-description">
          <DescriptionTab formData={formData} updateField={updateField} setDirty={setDirty} />
        </EditorSectionAnchor>
        <EditorSectionAnchor id="persona-card-personality">
          <TextareaTab
            title="Personality"
            subtitle="Your personality traits, temperament, and behavioral patterns."
            helpText={PERSONA_PERSONALITY_HELP}
            value={formData.personality}
            onChange={(v) => updateField("personality", v)}
            placeholder="Calm and analytical, but quick to act when someone's in danger. Has a dry sense of humor…"
            rows={8}
          />
        </EditorSectionAnchor>
        <EditorSectionAnchor id="persona-card-backstory">
          <TextareaTab
            title="Backstory"
            subtitle="Your character's history, origin story, and formative life events."
            helpText={PERSONA_BACKSTORY_HELP}
            value={formData.backstory}
            onChange={(v) => updateField("backstory", v)}
            placeholder="Grew up in a frontier town, apprenticed under a traveling scholar…"
            rows={12}
          />
        </EditorSectionAnchor>
        <EditorSectionAnchor id="persona-card-appearance">
          <TextareaTab
            title="Appearance"
            subtitle="Physical description, height, build, hair, eyes, clothing, distinguishing features."
            helpText={PERSONA_APPEARANCE_HELP}
            value={formData.appearance}
            onChange={(v) => updateField("appearance", v)}
            placeholder="Average height, dark hair worn loose. Prefers practical clothing, boots, a worn jacket…"
            rows={8}
          />
        </EditorSectionAnchor>
        <EditorSectionAnchor id="persona-card-scenario">
          <TextareaTab
            title="Scenario"
            subtitle="Your default situation or context within roleplays."
            helpText={PERSONA_SCENARIO_HELP}
            value={formData.scenario}
            onChange={(v) => updateField("scenario", v)}
            placeholder="A wandering adventurer seeking answers about a mysterious artifact…"
            rows={8}
          />
        </EditorSectionAnchor>
      </div>
    </div>
  );
}

function PersonaLorebookTab({ personaId, personaName }: { personaId: string; personaName: string }) {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Persona Lorebook"
        subtitle="World-building entries attached to your persona."
        helpText={PERSONA_LOREBOOK_HELP}
      />
      <LorebookAssignmentSection ownerType="persona" ownerId={personaId} ownerName={personaName} />
    </div>
  );
}

// ── Description Tab ──

function DescriptionTab({
  formData,
  updateField,
  setDirty: _setDirty,
}: {
  formData: PersonaFormData;
  updateField: <K extends keyof PersonaFormData>(key: K, value: PersonaFormData[K]) => void;
  setDirty: (v: boolean) => void;
}) {
  return (
    <div className="mari-editor-panel space-y-3 p-3">
      <SectionHeader
        title="Description"
        subtitle="Your general description. This is sent in every prompt so the AI knows who you are."
        helpText={PERSONA_DESCRIPTION_HELP}
      />
      <MacroTextarea
        value={formData.description}
        onChange={(value) => updateField("description", value)}
        placeholder="Describe who you are, your role in the story, and your key traits…"
        rows={12}
        title="Description"
        className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/20"
      />
      <p className="mt-1.5 text-right text-[0.625rem] text-[var(--muted-foreground)]">
        {formatPersonaTextTokens(formData.description)}
      </p>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  helpText,
  helpWide = true,
}: {
  title: string;
  subtitle?: string;
  helpText?: ReactNode;
  helpWide?: boolean;
}) {
  return (
    <div className="mb-4">
      <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold">
        {title}
        {helpText && <HelpTooltip text={helpText} side="bottom" wide={helpWide} size="0.8125rem" />}
      </h3>
      {subtitle && <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{subtitle}</p>}
    </div>
  );
}

function TextareaTab({
  title,
  subtitle,
  value,
  onChange,
  placeholder,
  rows = 8,
  helpText,
}: {
  title: string;
  subtitle: string;
  helpText?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <div className="mari-editor-panel space-y-3 p-3">
      <SectionHeader title={title} subtitle={subtitle} helpText={helpText} />
      <MacroTextarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        title={title}
        className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/20"
      />
      <p className="mt-1.5 text-right text-[0.625rem] text-[var(--muted-foreground)]">
        {formatPersonaTextTokens(value)}
      </p>
    </div>
  );
}
