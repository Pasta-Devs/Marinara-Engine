// ──────────────────────────────────────────────
// Persona Editor — Full-page detail view
// Replaces the chat area when editing a persona.
// Sections: Metadata, Card, Convo, Lorebook, Sprites, Gallery, Colors, Stats
// ──────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback, useMemo, type ChangeEvent, type ReactNode } from "react";
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
  useRenamePersonaVersion,
  useResetPersonaVersions,
  usePersonaGalleryImages,
  usePersonaGalleryClips,
  useUploadPersonaGalleryImage,
  useUploadPersonaGalleryClip,
  useUploadPersonaGalleryVideo,
  useDeletePersonaGalleryImage,
  useSetPersonaGalleryImageAsAvatar,
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
  Pencil,
  Check,
} from "lucide-react";
import type { AvatarCrop } from "@marinara-engine/shared";
import { normalizeAvatarCrop } from "@marinara-engine/shared";
import { cn, generateClientId, getAvatarCropStyle } from "../../lib/utils";
import { showConfirmDialog, showPromptDialog } from "../../lib/app-dialogs";
import { formatCardVersionTimestamp, getCardVersionTitle } from "../../lib/card-version-history";
import { dataImageUrlToFile } from "../../lib/data-image-file";
import { extractColorsFromImage } from "../../lib/avatar-color-extraction";
import { HelpTooltip } from "../ui/HelpTooltip";
import { ColorPicker } from "../ui/ColorPicker";
import { StatIconPicker } from "../ui/StatIconPicker";
import { MacroTextarea } from "../ui/MacroTextarea";
import { ImageUploadDropzone } from "../ui/ImageUploadDropzone";
import { CustomEmojiTagButton } from "../ui/CustomEmojiTagButton";
import { CallClipGenerationModal } from "../ui/CallClipGenerationModal";
import { api, formatFirstApiValidationIssue } from "../../lib/api-client";
import { downloadSpriteFile } from "../../lib/sprite-download";
import { downloadUrlToDevice } from "../../lib/file-download";
import { parseTrackerCardColorConfig, serializeTrackerCardColorConfig } from "../../lib/tracker-card-colors";
import {
  getStatNameOccurrence,
  remapStatIconAssignments,
  resolveStatIconAssignment,
  setStatIconAssignment,
} from "../../lib/stat-icon-assignments";
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
import { AvatarReplaceActions } from "../ui/AvatarReplaceActions";
import { EditorAvatarTileActions } from "../ui/EditorAvatarTileActions";
import { SpriteFrameEditor } from "../ui/SpriteFrameEditor";
import { SpriteWandCleanupEditor } from "../ui/SpriteWandCleanupEditor";
import { ExportFormatDialog, type ExportFormatChoice } from "../ui/ExportFormatDialog";
import { Modal } from "../ui/Modal";
import { EditorTabNavigation } from "../ui/EditorTabNavigation";
import { EditorSectionAnchor, EditorSectionJumps } from "../ui/EditorSectionJumps";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import {
  createDefaultRpgStatPools,
  normalizeSpriteExpressionLabel,
  normalizeRpgStatPools,
  syncRpgHpFromPools,
  type CharacterData,
  type ConvoBehaviorConfig,
  type Persona,
  type PersonaCardSnapshot,
  type PersonaCardVersion,
  type PersonaStatBar,
  type PersonaStatsConfig,
  type PersonaUpdateInput,
  type RPGStatPool,
  type RPGStatsConfig,
  type TrackerCardColorConfig,
} from "@marinara-engine/shared";
import { useQuoteFormatter } from "../../hooks/use-quote-formatter";
import { LorebookAssignmentSection } from "../lorebooks/LorebookAssignmentSection";
import { ConvoProfileFields } from "../characters/ConvoProfileFields";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import {
  mergeAuthoritativePersonaEditorDraft,
  personaEditorFieldsDifferingFromBaseline,
  pickPersonaEditorFields,
  reconcileVersionedPersonaEditorSave,
} from "./persona-editor-transitions";

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
  "Name color is applied to your persona's display name in chat. Gradients use CSS linear-gradient. Dialogue color applies to text inside dialogue quotation marks and can optionally be bolded from Settings. Box color sets the background color of your persona's message bubble. An empty dialogue color uses the default from Settings > Appearance; other empty fields use theme colors.";

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
  versioningEnabled: boolean;
  creatorNotes: string;
  description: string;
  personality: string;
  scenario: string;
  backstory: string;
  appearance: string;
  characterSheetImageId: string | null;
  useCharacterSheetAsReference: boolean;
  nameColor: string;
  dialogueColor: string;
  boxColor: string;
  trackerCardColors: TrackerCardColorConfig;
  /** Status bars + RPG stats, kept decoded in form state; serialized at save/snapshot boundaries. */
  personaStats: PersonaStatsConfig | null;
  tags: string[];
  /** Saved Conversation mode activity/status options, kept decoded in form state. */
  savedStatusOptions: string[];
  /** Conversation-mode-only fields. */
  convoDisplayName: string;
  aboutMe: string;
  convoBehavior: ConvoBehaviorConfig | null;
  /** Avatar crop region (hydrated from the decoded Persona; kept decoded in form
   *  state and serialized back to JSON at save/snapshot boundaries).
   *  May be the current source-relative shape, the legacy zoom+offset shape (held
   *  through until the user re-edits via the cropper), or null when unset. */
  avatarCrop: AvatarCrop | null;
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

// ── Editor save/reconciliation model ──

/** Persona mutations the editor coordinates. Only one may run at a time,
 *  because each writes or removes the same Persona row. */
type PersonaMutationKind = "save" | "avatar" | "gallery-avatar" | "delete";

/** The decoded PATCH contract this editor writes: the shared update input plus
 *  the character-sheet fields the Persona route still handles separately. */
type PersonaUpdatableFields = PersonaUpdateInput & {
  characterSheetImageId?: string | null;
  useCharacterSheetAsReference?: boolean;
};

/** Every form field must map onto the same-named decoded update field. Indexing
 *  the update contract here is what turns a form key with no matching update
 *  field — or an incompatible value type — into a compile error instead of a
 *  silently dropped save. */
type PersonaUpdateFieldValues = { [K in keyof PersonaFormData]: PersonaUpdatableFields[K] };

/** Draft values as they would be written. The one semantic transform is a blank
 *  conversation behavior, which is an explicit clear rather than an empty object. */
function personaUpdateValues(formData: PersonaFormData): PersonaUpdateFieldValues {
  return {
    ...formData,
    convoBehavior: formData.convoBehavior?.instruction?.trim() ? formData.convoBehavior : null,
  };
}

/**
 * Fields whose decoded write-boundary values differ from the authoritative
 * baseline. A blank conversation behavior and null are therefore equivalent.
 */
function personaFieldsDifferingFromBaseline(
  draft: PersonaFormData,
  baseline: PersonaFormData,
): (keyof PersonaFormData)[] {
  return personaEditorFieldsDifferingFromBaseline(personaUpdateValues(draft), personaUpdateValues(baseline));
}

function pickPersonaUpdateFields(
  formData: PersonaFormData,
  keys: Iterable<keyof PersonaFormData>,
): Partial<PersonaUpdatableFields> {
  // `PersonaUpdateFieldValues` proves each copied value is legal for the decoded
  // update contract; the pure helper retains that key/value relationship.
  return pickPersonaEditorFields(personaUpdateValues(formData), keys);
}

/** The authoritative projected Persona, expressed in the editor's form shape. */
function personaFormFromPersona(persona: Persona): PersonaFormData {
  return {
    name: persona.name,
    comment: persona.comment ?? "",
    phoneticName: persona.phoneticName ?? "",
    creator: persona.creator ?? "",
    personaVersion: persona.personaVersion ?? "1.0",
    versioningEnabled: persona.versioningEnabled !== false,
    creatorNotes: persona.creatorNotes ?? "",
    description: persona.description,
    personality: persona.personality ?? "",
    scenario: persona.scenario ?? "",
    backstory: persona.backstory ?? "",
    appearance: persona.appearance ?? "",
    characterSheetImageId: persona.characterSheetImageId ?? null,
    useCharacterSheetAsReference: persona.useCharacterSheetAsReference === true,
    nameColor: persona.nameColor ?? "",
    dialogueColor: persona.dialogueColor ?? "",
    boxColor: persona.boxColor ?? "",
    trackerCardColors: parseTrackerCardColorConfig(persona.trackerCardColors),
    personaStats: persona.personaStats ?? null,
    tags: persona.tags ?? [],
    savedStatusOptions: persona.savedStatusOptions ?? [],
    convoDisplayName: persona.convoDisplayName ?? "",
    aboutMe: persona.aboutMe ?? "",
    convoBehavior: persona.convoBehavior ?? null,
    // Defensive: accept either the current source-relative shape or the legacy
    // zoom+offset shape (already decoded by the persona projector). Anything
    // malformed is silently dropped so the editor falls back to defaults instead
    // of producing NaN transforms or an off-screen overlay.
    avatarCrop: normalizeAvatarCrop(persona.avatarCrop),
  };
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

function PersonaGalleryTab({
  personaId,
  personaName,
  onCreateCharacterSheet,
  // Assigning a gallery image replaces the Persona avatar, so the editor owns the
  // call and lends this tab its live mutation-busy state instead of a local flag.
  editorBusy,
  galleryAvatarPending,
  onSetAvatar,
}: {
  personaId: string;
  personaName?: string;
  onCreateCharacterSheet: () => void;
  editorBusy: boolean;
  galleryAvatarPending: boolean;
  onSetAvatar: (image: PersonaGalleryImage) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [mediaTab, setMediaTab] = useState<PersonaGalleryMediaTab>("images");
  const { data: images, isLoading } = usePersonaGalleryImages(personaId);
  const upload = useUploadPersonaGalleryImage(personaId);
  const remove = useDeletePersonaGalleryImage(personaId);
  const tag = useTagPersonaGalleryImage(personaId);
  const [lightbox, setLightbox] = useState<PersonaGalleryImage | null>(null);
  const [selectingImages, setSelectingImages] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(() => new Set());
  const selectedImages = useMemo(
    () => images?.filter((image) => selectedImageIds.has(image.id)) ?? [],
    [images, selectedImageIds],
  );

  useEffect(() => {
    const availableIds = new Set(images?.map((image) => image.id) ?? []);
    setSelectedImageIds((current) => {
      const next = new Set([...current].filter((id) => availableIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [images]);

  const leaveImageSelection = useCallback(() => {
    setSelectingImages(false);
    setSelectedImageIds(new Set());
  }, []);

  const toggleImageSelection = useCallback((imageId: string) => {
    setSelectedImageIds((current) => {
      const next = new Set(current);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  }, []);

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
          title: localizeUi("ui.personas.personagallerytab.deletePersonaImage"),
          message: localizeUi("ui.personas.personagallerytab.deleteThisPersonaGalleryImage"),
          confirmLabel: localizeUi("lorebook.editor.batch.delete"),
          tone: "destructive",
        }))
      ) {
        return;
      }
      try {
        await remove.mutateAsync(image.id);
        if (lightbox?.id === image.id) setLightbox(null);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : localizeUi("ui.personas.personagallerytab.failedToDeletePersonaImage"),
        );
      }
    },
    [lightbox?.id, remove, localizeUi],
  );

  const handleBatchDownload = useCallback(async () => {
    if (selectedImages.length === 0) return;
    if (
      !(await showConfirmDialog({
        title: localizeUi("ui.gallery.batch.downloadTitle"),
        message: localizeUi("ui.gallery.batch.downloadMessage", { count: selectedImages.length }),
        confirmLabel: localizeUi("ui.gallery.batch.download"),
      }))
    ) {
      return;
    }
    try {
      let failedDownloads = 0;
      for (const [index, image] of selectedImages.entries()) {
        try {
          await downloadUrlToDevice(image.url, image.filePath.split("/").pop() || `persona-gallery-${index + 1}.png`);
        } catch {
          failedDownloads += 1;
        }
      }
      if (failedDownloads > 0) {
        toast.error(
          localizeUi("ui.gallery.batch.downloadPartial", {
            completed: selectedImages.length - failedDownloads,
            count: selectedImages.length,
            failed: failedDownloads,
          }),
        );
        return;
      }
      toast.success(localizeUi("ui.gallery.batch.downloadStarted", { count: selectedImages.length }));
    } catch {
      toast.error(localizeUi("ui.gallery.batch.downloadFailed"));
    }
  }, [localizeUi, selectedImages]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedImages.length === 0) return;
    if (
      !(await showConfirmDialog({
        title: localizeUi("ui.gallery.batch.deleteTitle"),
        message: localizeUi("ui.gallery.batch.deleteMessage", { count: selectedImages.length }),
        confirmLabel: localizeUi("ui.gallery.batch.delete"),
        tone: "destructive",
      }))
    ) {
      return;
    }
    try {
      for (const image of selectedImages) await remove.mutateAsync(image.id);
      toast.success(localizeUi("ui.gallery.batch.deleted", { count: selectedImages.length }));
      leaveImageSelection();
    } catch {
      toast.error(localizeUi("ui.personas.personagallerytab.failedToDeletePersonaImage"));
    }
  }, [leaveImageSelection, localizeUi, remove, selectedImages]);

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold">{localizeUi("ui.personas.personagallerytab.personaGallery")}</h2>
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.personas.personagallerytab.keepReferenceArtAlternateLooksAndGeneratedVideosAttached")}
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
              aria-pressed={active}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (selectingImages) leaveImageSelection();
                  else setSelectingImages(true);
                }}
                className="mari-editor-action inline-flex"
              >
                {selectingImages ? <X size="0.875rem" /> : <Check size="0.875rem" />}
                {localizeUi(selectingImages ? "ui.gallery.batch.cancel" : "ui.gallery.batch.selectImages")}
              </button>
              <button
                type="button"
                disabled={!images?.length}
                onClick={() => {
                  setSelectingImages(true);
                  setSelectedImageIds(new Set(images?.map((image) => image.id) ?? []));
                }}
                className="mari-editor-action inline-flex disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check size="0.875rem" />
                {localizeUi("ui.gallery.batch.selectAll")}
              </button>
              {selectingImages ? (
                <span className="text-xs font-semibold text-[var(--muted-foreground)]">
                  {localizeUi("ui.gallery.batch.selected", { count: selectedImages.length })}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onCreateCharacterSheet}
              className="mari-editor-action mari-editor-action--primary inline-flex max-sm:w-full max-sm:justify-center"
            >
              <Wand2 size="0.875rem" />
              {localizeUi("ui.characters.charactersheet.createWithAi")}
            </button>
          </div>

          <p className="rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs leading-relaxed text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
            {localizeUi("ui.gallery.batch.hint")}
          </p>

          <ImageUploadDropzone
            label={localizeUi("ui.personas.personagallerytab.uploadPersonaImages")}
            pending={upload.isPending}
            pendingLabel="Uploading…"
            dragLabel="Drop persona images to upload"
            onFilesSelected={handleUpload}
            icon={<Upload size="1rem" />}
            className="w-full"
          />

          {isLoading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="shimmer aspect-square rounded-xl" />
              ))}
            </div>
          ) : images && images.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4">
              {images.map((image) => (
                <div
                  key={image.id}
                  className={cn(
                    "mari-gallery-card group relative overflow-hidden rounded-xl border bg-[var(--card)] transition-all hover:shadow-md",
                    selectedImageIds.has(image.id)
                      ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/45"
                      : "border-[var(--border)] hover:border-[var(--primary)]/30",
                  )}
                >
                  {!selectingImages ? (
                    <CustomEmojiTagButton image={image} onApply={(patch) => tag.mutate({ imageId: image.id, patch })} />
                  ) : (
                    <button
                      type="button"
                      aria-pressed={selectedImageIds.has(image.id)}
                      aria-label={localizeUi("ui.gallery.batch.toggleImage")}
                      onClick={() => toggleImageSelection(image.id)}
                      className={cn(
                        "absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border shadow-lg transition-colors",
                        selectedImageIds.has(image.id)
                          ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                          : "border-white/65 bg-black/55 text-transparent hover:bg-black/75",
                      )}
                    >
                      <Check size="0.9rem" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="block aspect-square w-full bg-[var(--secondary)]"
                    onClick={() => (selectingImages ? toggleImageSelection(image.id) : setLightbox(image))}
                  >
                    <img
                      src={image.url}
                      alt={image.prompt || personaName || "Persona image"}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <div
                    className={cn(
                      "absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/75 via-black/25 to-transparent p-2 transition-opacity",
                      selectingImages && !selectedImageIds.has(image.id)
                        ? "pointer-events-none opacity-0"
                        : "opacity-0 group-hover:opacity-100 group-[&:focus-within]:opacity-100 max-md:opacity-100",
                    )}
                  >
                    <span className="max-w-[8rem] truncate text-[0.6875rem] font-medium text-white/85 max-md:hidden">
                      {new Date(image.createdAt).toLocaleDateString()}
                    </span>
                    <div className="ml-auto flex gap-1">
                      {!selectingImages ? (
                        <button
                          type="button"
                          onClick={() => onSetAvatar(image)}
                          disabled={editorBusy}
                          className="rounded-lg bg-white/15 p-1.5 text-white transition-colors hover:bg-white/25 disabled:opacity-50"
                          title={localizeUi("ui.personas.personagallerytab.setAsAvatar")}
                        >
                          {galleryAvatarPending ? (
                            <Loader2 size="0.75rem" className="animate-spin" />
                          ) : (
                            <User size="0.75rem" />
                          )}
                        </button>
                      ) : null}
                      {selectingImages ? (
                        <button
                          type="button"
                          onClick={() => void handleBatchDownload()}
                          className="rounded-lg bg-white/15 p-1.5 text-white transition-colors hover:bg-white/25"
                          title={localizeUi("ui.gallery.batch.download")}
                        >
                          <Download size="0.75rem" />
                        </button>
                      ) : (
                        <a
                          href={image.url}
                          download
                          className="rounded-lg bg-white/15 p-1.5 text-white transition-colors hover:bg-white/25"
                          title={localizeUi("ui.personas.personagallerytab.download")}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download size="0.75rem" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => void (selectingImages ? handleBatchDelete() : handleDelete(image))}
                        disabled={remove.isPending}
                        className="rounded-lg bg-white/15 p-1.5 text-white transition-colors hover:bg-white/25 disabled:opacity-50"
                        title={localizeUi(selectingImages ? "ui.gallery.batch.delete" : "lorebook.editor.batch.delete")}
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
                <p className="text-sm font-medium text-[var(--muted-foreground)]">
                  {localizeUi("ui.personas.personagallerytab.noPersonaImagesYet")}
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]/60">
                  {localizeUi("ui.personas.personagallerytab.uploadImagesHereToKeepThemTiedTo")}{" "}
                  {personaName || "this persona"} {localizeUi("ui.personas.personagallerytab.insteadOfASpecificChat")}
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
              <button
                type="button"
                onClick={() => onSetAvatar(lightbox)}
                disabled={editorBusy}
                className="rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80 disabled:opacity-50"
                title={localizeUi("ui.personas.personagallerytab.setAsAvatar")}
              >
                {galleryAvatarPending ? <Loader2 size="0.875rem" className="animate-spin" /> : <User size="0.875rem" />}
              </button>
              <a
                href={lightbox.url}
                download
                className="rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
              >
                <Download size="0.875rem" />
              </a>
              <button
                type="button"
                onClick={() => void handleDelete(lightbox)}
                className="rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
                title={localizeUi("lorebook.editor.batch.delete")}
                aria-label={localizeUi("lorebook.editor.batch.delete")}
              >
                <Trash2 size="0.875rem" />
              </button>
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
  const { t: localizeUi } = useUiTranslation();
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
        toast.success(
          files.length === 1
            ? localizeUi("ui.personas.personavideosgallery.videoUploaded")
            : localizeUi("ui.personas.personavideosgallery.videosUploaded"),
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : localizeUi("ui.personas.personavideosgallery.couldNotUploadVideo"),
        );
      }
    },
    [uploadVideo, localizeUi],
  );

  const handleDeleteClip = useCallback(
    async (clip: CharacterGalleryClip) => {
      if (!canDeletePersonaGalleryClip(clip)) return;
      if (
        !(await showConfirmDialog({
          title: localizeUi("ui.personas.personavideosgallery.deleteClip"),
          message: localizeUi("ui.personas.personavideosgallery.deleteThisClipEverywhereItAppearsInMarinaraThis"),
          confirmLabel: localizeUi("lorebook.editor.batch.delete"),
          tone: "destructive",
        }))
      ) {
        return;
      }

      setDeletingClipId(clip.id);
      try {
        await deleteClip.mutateAsync(clip.id);
        toast.success(localizeUi("ui.personas.personavideosgallery.videoDeleted"));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : localizeUi("ui.personas.personavideosgallery.couldNotDeleteVideo"),
        );
      } finally {
        setDeletingClipId(null);
      }
    },
    [deleteClip, localizeUi],
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
        label={localizeUi("ui.personas.personavideosgallery.uploadPersonaVideos")}
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
            <p className="text-sm font-medium text-[var(--muted-foreground)]">
              {localizeUi("ui.personas.personavideosgallery.noPersonaVideosYet")}
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]/60">
              {localizeUi("ui.personas.personavideosgallery.uploadVideosOrGenerateGameAndSceneVideosFrom")}{" "}
              {personaName || "this persona"}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function PersonaCallClipsGallery({ personaId, personaName }: { personaId: string; personaName?: string }) {
  const { t: localizeUi } = useUiTranslation();
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
        toast.success(localizeUi("ui.personas.personacallclipsgallery.callClipUploaded"));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : localizeUi("ui.personas.personacallclipsgallery.couldNotUploadClip"),
        );
      }
    },
    [uploadClip, localizeUi],
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
            ? localizeUi("ui.personas.personacallclipsgallery.customCallClipGenerationStarted")
            : customClip
              ? localizeUi("ui.personas.personacallclipsgallery.callClipAndCustomClipGenerationStarted")
              : localizeUi("ui.personas.personacallclipsgallery.callClipGenerationStarted"),
        );
        setGenerationDialogOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : localizeUi("ui.personas.personacallclipsgallery.couldNotStartCallClipGeneration"),
        );
      }
    },
    [generateCallClips, generateCustomCallClip, localizeUi],
  );

  const handleDeleteClip = useCallback(
    async (clip: CharacterGalleryClip) => {
      if (!canDeletePersonaGalleryClip(clip)) return;
      if (
        !(await showConfirmDialog({
          title: localizeUi("ui.personas.personavideosgallery.deleteClip"),
          message: localizeUi("ui.personas.personacallclipsgallery.deleteThisCallClipThisCannotBeUndone"),
          confirmLabel: localizeUi("lorebook.editor.batch.delete"),
          tone: "destructive",
        }))
      ) {
        return;
      }

      setDeletingClipId(clip.id);
      try {
        await deleteClip.mutateAsync(clip.id);
        toast.success(
          clip.source === "conversation-call"
            ? localizeUi("ui.personas.personacallclipsgallery.callClipReset")
            : localizeUi("ui.personas.personacallclipsgallery.clipDeleted"),
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : localizeUi("ui.personas.personacallclipsgallery.couldNotDeleteClip"),
        );
      } finally {
        setDeletingClipId(null);
      }
    },
    [deleteClip, localizeUi],
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
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {localizeUi("ui.personas.personacallclipsgallery.videoCallClips")}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            {readyCallClipCount}/{standardCallClips.length || 6}{" "}
            {localizeUi("ui.personas.personacallclipsgallery.standardReady")} {customCallClipCount}{" "}
            {localizeUi("ui.personas.personacallclipsgallery.custom")}
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
            {localizeUi("ui.personas.personacallclipsgallery.uploadExtra")}
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
            {generateCallClips.isPending || generateCustomCallClip.isPending
              ? localizeUi("ui.personas.personacallclipsgallery.generating")
              : localizeUi("ui.personas.personacallclipsgallery.generateClips")}
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
            <p className="text-sm font-medium text-[var(--muted-foreground)]">
              {localizeUi("ui.personas.personacallclipsgallery.noCallClipsYet")}
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]/60">
              {localizeUi("ui.personas.personacallclipsgallery.generateOrUploadVideoCallLoopsFor")}{" "}
              {personaName || "this persona"}.
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
  const { t: localizeUi } = useUiTranslation();
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
            <span>
              {clip.status === "missing" ? localizeUi("ui.personas.personaclipcard.notGenerated") : clip.status}
            </span>
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
              {clip.chatName
                ? localizeUi("ui.personas.personaclipcard.value1Value2", { value1: clip.chatName, value2: dateLabel })
                : dateLabel}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isReady && clip.url ? (
              <a
                href={clip.url}
                download
                className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-1.5 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                title={localizeUi("ui.personas.personagallerytab.download")}
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
                title={localizeUi("lorebook.editor.batch.delete")}
                aria-label={localizeUi("ui.personas.personaclipcard.deleteValue1", {
                  value1: clip.label || localizeUi("ui.panels.ttsconfigcard.clip"),
                })}
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

function createCharacterDataFromPersona(formData: PersonaFormData): CharacterData {
  const rpgStats = formData.personaStats?.rpgStats;

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
      versioningEnabled: formData.versioningEnabled,
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
  const { t: localizeUi } = useUiTranslation();
  const personaId = useUIStore((s) => s.personaDetailId);
  const personaInitialTab = useUIStore((s) => s.personaDetailInitialTab) as TabId | null;
  const closeDetail = useUIStore((s) => s.closePersonaDetail);
  const { data: allPersonas, isLoading } = usePersonas();
  const createCharacter = useCreateCharacter();
  const updatePersona = useUpdatePersona();
  const uploadCharacterAvatar = useUploadAvatar();
  const uploadAvatar = useUploadPersonaAvatar();
  const setGalleryImageAsAvatar = useSetPersonaGalleryImageAsAvatar(personaId ?? "");
  const deletePersona = useDeletePersona();
  const duplicatePersona = useDuplicatePersona();
  const uploadCharacterSheet = useUploadPersonaGalleryImage(personaId ?? "");
  const { data: connectionsList } = useConnections();

  const [activeTab, setActiveTab] = useState<TabId>(() => personaInitialTab ?? "metadata");
  useEffect(() => {
    setActiveTab(personaInitialTab ?? "metadata");
  }, [personaId, personaInitialTab]);
  // ── Editor state machine ──
  // The draft and the authoritative baseline are each held in a ref *and* in
  // state, always written together through the commit helpers below. The refs are
  // what asynchronous save/upload continuations read, so reconciliation never
  // depends on a render having happened; the state is what re-renders the UI.
  const [formData, setFormDataState] = useState<PersonaFormData | null>(null);
  const formDataRef = useRef<PersonaFormData | null>(null);
  const [baselineForm, setBaselineFormState] = useState<PersonaFormData | null>(null);
  const baselineFormRef = useRef<PersonaFormData | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [avatarGeneratorOpen, setAvatarGeneratorOpen] = useState(false);
  const [characterSheetGeneratorOpen, setCharacterSheetGeneratorOpen] = useState(false);
  const loadedPersonaIdRef = useRef<string | null>(null);
  /** Authoritative avatar path last reconciled into the editor. */
  const authoritativeAvatarPathRef = useRef<string | null>(null);
  /** Which image the *draft* crop is framed against. Crop ownership is bound to
   *  avatar identity, so a replacement image never inherits the old framing. */
  const avatarCropOwnerRef = useRef<string | null>(null);
  /** Per-field monotonic edit versions. Ordering evidence for reconciling an
   *  in-flight save only — never the source of truth for dirty. */
  const fieldVersionsRef = useRef<Map<keyof PersonaFormData, number>>(new Map());
  /** Identity token invalidated on Persona switch and unmount, so a stale
   *  completion can still update shared caches but never local editor state. */
  const editorSessionRef = useRef<string>(generateClientId());
  /** The single operation mutex: an immediate ref so two clicks in one tick
   *  cannot both pass, plus render state for the disabled/spinner UI. */
  const mutationTokenRef = useRef<string | null>(null);
  const mutationKindRef = useRef<PersonaMutationKind | null>(null);
  const [mutationKind, setMutationKind] = useState<PersonaMutationKind | null>(null);
  const formatQuotes = useQuoteFormatter();
  const setEditorDirty = useUIStore((s) => s.setEditorDirty);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const commitFormData = useCallback((next: PersonaFormData | null) => {
    formDataRef.current = next;
    setFormDataState(next);
  }, []);

  const commitBaseline = useCallback((next: PersonaFormData | null) => {
    baselineFormRef.current = next;
    setBaselineFormState(next);
  }, []);

  // Dirty is a value comparison against the authoritative baseline, so a field
  // edited and then reverted stops being dirty and stops being sent.
  const changedFieldKeys = useMemo(
    () => (formData && baselineForm ? personaFieldsDifferingFromBaseline(formData, baselineForm) : []),
    [formData, baselineForm],
  );
  const dirty = changedFieldKeys.length > 0;
  useEffect(() => {
    setEditorDirty(dirty);
  }, [dirty, setEditorDirty]);

  const mutationBusy = mutationKind !== null;
  const saving = mutationKind === "save";
  const avatarBusy = mutationKind === "avatar" || mutationKind === "gallery-avatar";

  const beginMutation = useCallback((kind: PersonaMutationKind) => {
    if (mutationTokenRef.current) return null;
    const token = generateClientId();
    mutationTokenRef.current = token;
    mutationKindRef.current = kind;
    setMutationKind(kind);
    return token;
  }, []);

  const finishMutation = useCallback((token: string) => {
    if (mutationTokenRef.current !== token) return;
    mutationTokenRef.current = null;
    mutationKindRef.current = null;
    setMutationKind(null);
  }, []);

  /** True while the completion still belongs to the mounted editor session.
   *  Anything else may touch caches but not local state. */
  const isCurrentEditorSession = useCallback((session: string) => editorSessionRef.current === session, []);
  const imageGenerationAvailable =
    Array.isArray(connectionsList) &&
    (connectionsList as Array<{ provider?: string }>).some((connection) => connection.provider === "image_generation");

  // Find the persona from the decoded list returned by usePersonas.
  const rawPersona = allPersonas?.find((p) => p.id === personaId);

  /**
   * Reconcile an authoritative Persona into the editor: untouched fields adopt
   * server values, local edits survive, and unchanged submitted versions force
   * canonical response values. The authoritative form becomes the new baseline,
   * so dirty always means "draft differs from current server truth".
   */
  const adoptAuthoritativePersona = useCallback(
    (
      persona: Persona,
      options: {
        submittedVersions?: ReadonlyMap<keyof PersonaFormData, number>;
        adoptAvatar?: boolean;
      } = {},
    ) => {
      const authoritative = personaFormFromPersona(persona);
      const draft = formDataRef.current;
      const baseline = baselineFormRef.current;
      let nextDraft = authoritative;

      if (draft && baseline) {
        nextDraft = options.submittedVersions
          ? reconcileVersionedPersonaEditorSave({
              draft,
              baseline,
              authoritative,
              submittedVersions: options.submittedVersions,
              currentVersions: fieldVersionsRef.current,
            })
          : mergeAuthoritativePersonaEditorDraft(draft, baseline, authoritative);
      }

      if (options.adoptAvatar !== false) {
        // Crop ownership is bound to avatar identity: when the image behind the
        // editor changed, a crop framed against the replaced image is discarded
        // rather than reapplied to a differently framed picture.
        if (avatarCropOwnerRef.current !== persona.avatarPath) {
          nextDraft = { ...nextDraft, avatarCrop: authoritative.avatarCrop };
          fieldVersionsRef.current.delete("avatarCrop");
          avatarCropOwnerRef.current = persona.avatarPath;
        }
        authoritativeAvatarPathRef.current = persona.avatarPath;
        setAvatarPreview(persona.avatarPath);
      }

      commitBaseline(authoritative);
      commitFormData(nextDraft);
    },
    [commitBaseline, commitFormData],
  );

  // Hydrate the form from the shared decoded persona. usePersonas returns projected
  // Persona values, so structured fields are already decoded here.
  // A Persona switch resets identity, baseline, draft, versions, and preview. A
  // same-id refetch merges authoritative changes into untouched fields — including
  // non-avatar fields changed by the inline editor, Tracker settings, or another
  // client — while every locally edited field survives.
  useEffect(() => {
    if (!rawPersona) return;

    if (loadedPersonaIdRef.current !== rawPersona.id) {
      const authoritative = personaFormFromPersona(rawPersona);
      loadedPersonaIdRef.current = rawPersona.id;
      editorSessionRef.current = generateClientId();
      mutationTokenRef.current = null;
      mutationKindRef.current = null;
      setMutationKind(null);
      fieldVersionsRef.current.clear();
      authoritativeAvatarPathRef.current = rawPersona.avatarPath;
      avatarCropOwnerRef.current = rawPersona.avatarPath;
      setAvatarPreview(rawPersona.avatarPath);
      commitBaseline(authoritative);
      commitFormData(authoritative);
      return;
    }

    // An avatar/gallery replacement owns the preview and crop until it settles;
    // an interim refetch must not flip the image back and forth underneath it.
    const avatarOperationActive = mutationKindRef.current === "avatar" || mutationKindRef.current === "gallery-avatar";
    const baseline = baselineFormRef.current;
    const avatarUnchanged = authoritativeAvatarPathRef.current === rawPersona.avatarPath;
    if (
      baseline &&
      avatarUnchanged &&
      personaFieldsDifferingFromBaseline(personaFormFromPersona(rawPersona), baseline).length === 0
    ) {
      return;
    }
    adoptAuthoritativePersona(rawPersona, { adoptAvatar: !avatarOperationActive });
  }, [rawPersona, mutationKind, adoptAuthoritativePersona, commitBaseline, commitFormData]);

  // Forced teardown (unmount, or a Persona switch that never re-hydrates) drops the
  // local identity so an in-flight completion can still update shared caches through
  // the hooks but can no longer write this editor's state.
  useEffect(() => {
    return () => {
      editorSessionRef.current = generateClientId();
      loadedPersonaIdRef.current = null;
      mutationTokenRef.current = null;
      mutationKindRef.current = null;
    };
  }, [personaId]);

  const updateField = useCallback(
    <K extends keyof PersonaFormData>(key: K, value: PersonaFormData[K]) => {
      const previous = formDataRef.current;
      if (!previous) return;
      const nextValue = formatPersonaFieldValue(key, value, formatQuotes);
      // Versions record *when* a field was edited, for save-completion ordering.
      // Whether it is dirty is decided by comparison against the baseline.
      fieldVersionsRef.current.set(key, (fieldVersionsRef.current.get(key) ?? 0) + 1);
      commitFormData({ ...previous, [key]: nextValue });
    },
    [commitFormData, formatQuotes],
  );

  const handleGeneratedCharacterSheet = useCallback(
    async (dataUrl: string) => {
      let file: File;
      try {
        file = dataImageUrlToFile(dataUrl, `${formData?.name || "persona"}-sheet`);
      } catch {
        throw new Error(localizeUi("ui.characters.charactersheet.generatedSaveFailed"));
      }
      const uploaded = await uploadCharacterSheet.mutateAsync([file]);
      const image = uploaded[0];
      if (!image) throw new Error(localizeUi("ui.characters.charactersheet.generatedSaveFailed"));
      updateField("characterSheetImageId", image.id);
      toast.success(localizeUi("ui.characters.charactersheet.created"));
    },
    [formData?.name, localizeUi, updateField, uploadCharacterSheet],
  );

  /** Resolves true when the save landed and no later draft change is still unsaved. */
  const handleSave = useCallback(async () => {
    const draft = formDataRef.current;
    const baseline = baselineFormRef.current;
    if (!personaId || !draft || !baseline) return false;
    // Rejected locally: an empty name never reaches the network and the draft is kept.
    if (!draft.name.trim()) {
      toast.error(localizeUi("ui.personas.personaeditor.nameIsRequired"));
      return false;
    }

    const submittedFields = personaFieldsDifferingFromBaseline(draft, baseline);
    if (submittedFields.length === 0) return true;

    const saveToken = beginMutation("save");
    if (!saveToken) return false;
    const session = editorSessionRef.current;
    const savedPersonaId = personaId;
    // Ordering snapshot: which fields went out, and at which edit version. Text
    // inputs stay editable during the save, so this is what tells a later edit
    // apart from a field the server may legitimately canonicalize.
    const submittedVersions = new Map(submittedFields.map((key) => [key, fieldVersionsRef.current.get(key) ?? 0]));

    try {
      const authoritativePersona = await updatePersona.mutateAsync({
        id: savedPersonaId,
        // Sparse by value: exactly the decoded fields that differ from the baseline.
        ...pickPersonaUpdateFields(draft, submittedFields),
      });
      if (!isCurrentEditorSession(session)) return false;
      adoptAuthoritativePersona(authoritativePersona, { submittedVersions });
      const remaining =
        formDataRef.current && baselineFormRef.current
          ? personaFieldsDifferingFromBaseline(formDataRef.current, baselineFormRef.current)
          : [];
      return remaining.length === 0;
    } catch (error) {
      if (!isCurrentEditorSession(session)) return false;
      console.error("[PersonaEditor] Save failed:", error);
      toast.error(formatFirstApiValidationIssue(error, localizeUi("ui.personas.personaeditor.failedToSavePersona")));
      return false;
    } finally {
      finishMutation(saveToken);
    }
  }, [
    adoptAuthoritativePersona,
    beginMutation,
    finishMutation,
    isCurrentEditorSession,
    localizeUi,
    personaId,
    updatePersona,
  ]);

  /**
   * Replace the Persona avatar from an already-read data URL. The caller owns the
   * mutex token; this owns the optimistic preview, the crop hand-off, and the
   * reconciliation of the authoritative Persona the upload route returns.
   */
  const replaceAvatar = useCallback(
    async ({
      avatar,
      filename,
      operationToken,
      uploadPersonaId,
      session,
      previousAvatarPreview,
      previousAvatarCrop,
    }: {
      avatar: string;
      filename: string;
      operationToken: string;
      uploadPersonaId: string;
      session: string;
      previousAvatarPreview: string | null;
      previousAvatarCrop: AvatarCrop | null;
    }) => {
      const stillCurrent = () => isCurrentEditorSession(session) && mutationTokenRef.current === operationToken;
      if (!stillCurrent()) return false;

      // The pending image is its own crop owner, so the incoming picture is never
      // framed with the replaced image's crop.
      avatarCropOwnerRef.current = operationToken;
      setAvatarPreview(avatar);
      updateField("avatarCrop", null);
      const clearedCropVersion = fieldVersionsRef.current.get("avatarCrop");

      try {
        const authoritativePersona = await uploadAvatar.mutateAsync({ id: uploadPersonaId, avatar, filename });
        if (!stillCurrent()) return false;
        // Adopt the authoritative avatar path and the crop the server cleared for
        // the new image, while every unrelated dirty field stays dirty.
        adoptAuthoritativePersona(authoritativePersona, { adoptAvatar: true });
        return true;
      } catch (error) {
        // Roll back only when nothing newer superseded this operation.
        if (stillCurrent() && fieldVersionsRef.current.get("avatarCrop") === clearedCropVersion) {
          const draft = formDataRef.current;
          avatarCropOwnerRef.current = authoritativeAvatarPathRef.current;
          setAvatarPreview(previousAvatarPreview);
          if (draft) commitFormData({ ...draft, avatarCrop: previousAvatarCrop });
        }
        throw error;
      }
    },
    [adoptAuthoritativePersona, commitFormData, isCurrentEditorSession, updateField, uploadAvatar],
  );

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !personaId) return;
    // Reserved before the asynchronous file read starts, not after it resolves:
    // the editor must already read as busy while the picture is being decoded.
    const mutationToken = beginMutation("avatar");
    if (!mutationToken) return;

    const uploadPersonaId = personaId;
    const session = editorSessionRef.current;
    const fallbackAvatarPreview = avatarPreview;
    const fallbackAvatarCrop = formDataRef.current?.avatarCrop ?? null;

    const reader = new FileReader();
    reader.onload = () => {
      void replaceAvatar({
        avatar: reader.result as string,
        filename: `persona-${uploadPersonaId}-${Date.now()}.${file.name.split(".").pop()}`,
        operationToken: mutationToken,
        uploadPersonaId,
        session,
        previousAvatarPreview: fallbackAvatarPreview,
        previousAvatarCrop: fallbackAvatarCrop,
      })
        .catch((error: unknown) => {
          if (!isCurrentEditorSession(session)) return;
          toast.error(
            formatFirstApiValidationIssue(error, localizeUi("ui.personas.personaeditor.failedToSavePersona")),
          );
        })
        .finally(() => finishMutation(mutationToken));
    };
    reader.onerror = () => {
      if (isCurrentEditorSession(session)) {
        toast.error(localizeUi("ui.personas.personaeditor.failedToSavePersona"));
      }
      finishMutation(mutationToken);
    };
    reader.readAsDataURL(file);
  };

  const handleGeneratedAvatar = useCallback(
    async (avatarDataUrl: string) => {
      if (!personaId) return;
      const mutationToken = beginMutation("avatar");
      // The generator modal can outlive the click that opened it, so a write that
      // started meanwhile is reported instead of silently dropping the picture.
      if (!mutationToken) throw new Error(localizeUi("ui.personas.personaeditor.failedToSavePersona"));
      const uploadPersonaId = personaId;
      const session = editorSessionRef.current;
      try {
        const replaced = await replaceAvatar({
          avatar: avatarDataUrl,
          filename: `persona-${uploadPersonaId}-${Date.now()}.png`,
          operationToken: mutationToken,
          uploadPersonaId,
          session,
          previousAvatarPreview: avatarPreview,
          previousAvatarCrop: formDataRef.current?.avatarCrop ?? null,
        });
        if (replaced) toast.success(localizeUi("ui.personas.personaeditor.personaAvatarGenerated"));
      } finally {
        finishMutation(mutationToken);
      }
    },
    [avatarPreview, beginMutation, finishMutation, localizeUi, personaId, replaceAvatar],
  );

  /** Assigning a gallery image replaces the avatar, so it shares the editor mutex
   *  and reconciles the same way an upload does. */
  const handleSetGalleryAvatar = useCallback(
    (image: PersonaGalleryImage) => {
      if (!personaId) return;
      const mutationToken = beginMutation("gallery-avatar");
      if (!mutationToken) return;
      const session = editorSessionRef.current;
      // The assigned image becomes the crop owner; an old dirty crop is dropped
      // rather than reapplied to the newly assigned picture.
      avatarCropOwnerRef.current = mutationToken;

      void setGalleryImageAsAvatar
        .mutateAsync(image.id)
        .then((authoritativePersona) => {
          if (!isCurrentEditorSession(session)) return;
          if (mutationTokenRef.current !== mutationToken) return;
          adoptAuthoritativePersona(authoritativePersona, { adoptAvatar: true });
          toast.success(localizeUi("ui.personas.personagallerytab.personaAvatarUpdated"));
        })
        .catch((error: unknown) => {
          if (!isCurrentEditorSession(session)) return;
          if (mutationTokenRef.current === mutationToken) {
            avatarCropOwnerRef.current = authoritativeAvatarPathRef.current;
          }
          toast.error(
            formatFirstApiValidationIssue(
              error,
              localizeUi("ui.personas.personagallerytab.failedToUpdatePersonaAvatar"),
            ),
          );
        })
        .finally(() => finishMutation(mutationToken));
    },
    [
      adoptAuthoritativePersona,
      beginMutation,
      finishMutation,
      isCurrentEditorSession,
      localizeUi,
      personaId,
      setGalleryImageAsAvatar,
    ],
  );

  const handleDelete = async () => {
    if (!personaId) return;
    // Confirmation belongs to the currently loaded Persona epoch, not whichever
    // Persona happens to occupy this reused editor when the dialog later settles.
    const deletedPersonaId = personaId;
    const session = editorSessionRef.current;
    if (
      !(await showConfirmDialog({
        title: localizeUi("ui.personas.personaeditor.deletePersona_0b2415a"),
        message: localizeUi("dialog.delete.namedPermanent", {
          name: rawPersona?.name || localizeUi("ui.characters.cardlibrarydetailcard.persona"),
        }),
        confirmLabel: localizeUi("lorebook.editor.batch.delete"),
        tone: "destructive",
      }))
    ) {
      return;
    }

    // A programmatic navigation can replace the editor while confirmation waits.
    // Stale confirmations silently do nothing; only the original owner may acquire
    // Delete's immediate mutex and issue the destructive request.
    if (!isCurrentEditorSession(session) || loadedPersonaIdRef.current !== deletedPersonaId) return;
    const deleteToken = beginMutation("delete");
    if (!deleteToken) return;
    try {
      await deletePersona.mutateAsync(deletedPersonaId);
      if (isCurrentEditorSession(session) && loadedPersonaIdRef.current === deletedPersonaId) closeDetail();
    } catch (error) {
      if (!isCurrentEditorSession(session) || loadedPersonaIdRef.current !== deletedPersonaId) return;
      console.error("[PersonaEditor] Delete failed:", error);
      toast.error(formatFirstApiValidationIssue(error, localizeUi("ui.personas.personaeditor.failedToDeletePersona")));
    } finally {
      // A failure retains the editor and draft; success closes once above. An old
      // completion cannot clear a newer session's operation token.
      finishMutation(deleteToken);
    }
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
      toast.error(localizeUi("ui.personas.personaeditor.personaNeedsANameBeforeItCanBeAdded"));
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
          toast.error(localizeUi("ui.personas.personaeditor.characterAddedButTheAvatarCouldNotBeCopied"));
          return;
        }
      }

      toast.success(localizeUi("ui.personas.personaeditor.addedValue1AsACharacter", { value1: characterName }));
    } catch (error) {
      console.error("[PersonaEditor] Failed to add persona as character:", error);
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.personas.personaeditor.failedToAddPersonaAsCharacter"),
      );
    }
  }, [avatarPreview, createCharacter, formData, getAvatarDataUrl, uploadCharacterAvatar, localizeUi]);

  const handleClose = useCallback(() => {
    // Read immediate refs so a local Back click cannot race a write or draft update.
    if (mutationTokenRef.current) return;
    const draft = formDataRef.current;
    const baseline = baselineFormRef.current;
    const dirtyNow =
      draft !== null && baseline !== null && personaFieldsDifferingFromBaseline(draft, baseline).length > 0;
    if (dirtyNow) {
      setShowUnsavedWarning(true);
      return;
    }
    closeDetail();
  }, [closeDetail]);

  const keepEditing = useCallback(() => {
    setShowUnsavedWarning(false);
  }, []);

  const discardAndNavigate = useCallback(() => {
    // A write may have started after the warning opened; never discard under it.
    if (mutationTokenRef.current) return;
    closeDetail();
  }, [closeDetail]);

  const handleSaveAndClose = useCallback(async () => {
    if (mutationTokenRef.current) return;
    const savedAndClean = await handleSave();
    // Only close when the save landed and no edit made during it is still unsaved.
    if (savedAndClean && !mutationTokenRef.current) closeDetail();
  }, [closeDetail, handleSave]);

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
  const saveDisabled = !dirty || mutationBusy;
  const saveLabel = localizeUi(saving ? "editor.save.saving" : "editor.save.action");
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
        title={localizeUi("ui.personas.personaeditor.exportPersona")}
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
        title={localizeUi("ui.personas.personaeditor.addPersonaAsCharacter")}
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
              toast.success(localizeUi("ui.personas.personaeditor.personaDuplicated"));
            },
          });
        }}
        disabled={duplicatePersona.isPending}
        className="mari-editor-action inline-flex disabled:cursor-not-allowed disabled:opacity-50"
        title={localizeUi("ui.personas.personaeditor.duplicatePersona")}
      >
        {duplicatePersona.isPending ? <Loader2 size="1rem" className="animate-spin" /> : <Copy size="1rem" />}
      </button>

      <button
        type="button"
        onClick={handleDelete}
        disabled={mutationBusy}
        className="mari-editor-action inline-flex disabled:cursor-not-allowed disabled:opacity-50"
        title={localizeUi("ui.personas.personaeditor.deletePersona")}
      >
        <Trash2 size="1rem" />
      </button>
    </>
  );

  return (
    <div className="mari-editor-shell mari-editor-legacy-bridge flex flex-1 flex-col overflow-hidden">
      <ExportFormatDialog
        open={exportDialogOpen}
        title={localizeUi("ui.personas.personaeditor.exportPersona_ae29ab5")}
        description={localizeUi(
          "ui.personas.personaeditor.nativeKeepsMarinaraPersonaMetadataSpritesAndAttachedLorebooks",
        )}
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
        title={localizeUi("ui.personas.personaeditor.generatePersonaAvatar")}
        entityName={formData.name}
        defaultAppearance={formData.appearance || formData.description || formData.personality}
        defaultAvatarUrl={avatarPreview}
        onClose={() => setAvatarGeneratorOpen(false)}
        onUseAvatar={handleGeneratedAvatar}
      />
      <AvatarGenerationModal
        open={characterSheetGeneratorOpen}
        mode="character-sheet"
        title={localizeUi("ui.characters.charactersheet.createTitle")}
        entityName={formData.name || localizeUi("ui.characters.charactersheet.characterFallback")}
        defaultAppearance={formData.appearance || formData.description || formData.personality}
        defaultAvatarUrl={avatarPreview}
        onClose={() => setCharacterSheetGeneratorOpen(false)}
        onUseAvatar={handleGeneratedCharacterSheet}
      />

      {/* ── Header ── */}
      <div className="mari-editor-header mari-editor-header--with-nav">
        <div className="mari-editor-header-main mari-editor-header-main--identity">
          <button
            type="button"
            onClick={handleClose}
            disabled={mutationBusy}
            className="mari-editor-action inline-flex disabled:cursor-not-allowed disabled:opacity-50"
            title={localizeUi("ui.noodle.noodlerframe.back")}
          >
            <ArrowLeft size="1.125rem" />
          </button>

          {/* Avatar */}
          <div
            className={cn(
              "mari-editor-avatar-tile group relative",
              !avatarPreview && "mari-avatar-placeholder mari-avatar-placeholder--persona",
              mutationBusy && "pointer-events-none opacity-60",
            )}
            onClick={() => {
              if (!mutationBusy) fileInputRef.current?.click();
            }}
          >
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt={formData.name}
                className="pointer-events-none h-full w-full object-cover"
                style={getAvatarCropStyle(formData.avatarCrop)}
              />
            ) : (
              <User size="1.375rem" className="text-white" />
            )}
            <EditorAvatarTileActions
              generationAvailable={imageGenerationAvailable}
              onGenerate={() => {
                if (!mutationBusy) setAvatarGeneratorOpen(true);
              }}
            />
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="mari-editor-title-line">
              <input
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="mari-editor-title-input"
                placeholder={localizeUi("ui.personas.personaeditor.personaName")}
                size={Math.max(1, Math.min(formData.name.length || 12, 80))}
              />
              <p
                className="mari-editor-meta mari-editor-byline"
                title={localizeUi("ui.personas.personaeditor.value1VValue2", {
                  value1: formData.creator
                    ? localizeUi("ui.personas.personaeditor.byValue1", { value1: formData.creator })
                    : localizeUi("ui.personas.personaeditor.noCreator"),
                  value2: formData.personaVersion || "1.0",
                })}
              >
                <span className="mari-editor-byline-creator">
                  {formData.creator
                    ? localizeUi("ui.personas.personaeditor.byValue1", { value1: formData.creator })
                    : localizeUi("ui.personas.personaeditor.noCreator")}
                </span>
                <span aria-hidden="true">·</span>
                <span className="mari-editor-byline-version">
                  {localizeUi("ui.personas.personaeditor.v")}
                  {formData.personaVersion || "1.0"}
                </span>
              </p>
            </div>
            <div className="mari-editor-secondary-line">
              <input
                value={formData.comment}
                onChange={(e) => updateField("comment", e.target.value)}
                className="mari-editor-subtitle-input"
                placeholder={localizeUi("ui.personas.personaeditor.titleCommentEGModernAuVersion")}
              />
            </div>
          </div>
        </div>

        <EditorTabNavigation tabs={TABS} activeId={activeTab} onChange={setActiveTab} />

        <div className="mari-editor-actions flex">
          <button
            type="button"
            onClick={handleSave}
            disabled={saveDisabled}
            className={saveButtonClass}
            aria-label={saveLabel}
            title={saveLabel}
          >
            <Save size="0.9375rem" />
            <span className="mari-editor-save-label">{saveLabel}</span>
          </button>
          {headerActions}
        </div>
      </div>

      {/* ── Unsaved changes warning ── */}
      {showUnsavedWarning && (
        <div className="flex items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
          <AlertTriangle size="0.9375rem" className="shrink-0 text-amber-500" />
          <p className="flex-1 text-xs font-medium text-amber-500">
            {localizeUi("ui.personas.personaeditor.youHaveUnsavedChangesCloseWithoutSaving")}
          </p>
          <button
            type="button"
            onClick={keepEditing}
            className="rounded-lg px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)]"
          >
            {localizeUi("ui.personas.personaeditor.keepEditing")}
          </button>
          {/* Blocked while a Persona write is in flight: it cannot be cancelled, so
              "discard" would drop local state while the server still persists it. */}
          <button
            type="button"
            onClick={discardAndNavigate}
            disabled={mutationBusy}
            className="rounded-lg bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-500 transition-all hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-amber-500/15"
          >
            {localizeUi("ui.personas.personaeditor.discardClose")}
          </button>
          <button
            type="button"
            onClick={() => void handleSaveAndClose()}
            disabled={mutationBusy}
            className="mari-editor-action mari-editor-action--primary mari-editor-action--compact inline-flex rounded-lg px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {localizeUi("ui.personas.personaeditor.saveClose")}
          </button>
        </div>
      )}

      {/* ── Body ── */}
      <div className="mari-editor-body">
        {/* Tab Content */}
        <div className="mari-editor-content @max-5xl:p-4">
          <div className="mari-editor-content-inner">
            {activeTab === "metadata" && (
              <PersonaMetadataTab
                personaId={personaId}
                formData={formData}
                updateField={updateField}
                avatarPreview={avatarPreview}
                onSelectAvatar={() => {
                  if (!mutationBusy) fileInputRef.current?.click();
                }}
                onGenerateAvatar={() => {
                  if (!mutationBusy) setAvatarGeneratorOpen(true);
                }}
                imageGenerationAvailable={imageGenerationAvailable}
                avatarUploading={avatarBusy}
                hasUnsavedChanges={dirty}
                avatarMutationBusy={mutationBusy}
              />
            )}
            {activeTab === "card" && <PersonaCardTab formData={formData} updateField={updateField} />}
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
                characterSheetImageId={formData.characterSheetImageId}
                useCharacterSheetAsReference={formData.useCharacterSheetAsReference}
                updateField={updateField}
                onCreateCharacterSheet={() => setCharacterSheetGeneratorOpen(true)}
              />
            )}
            {activeTab === "gallery" && personaId && (
              <PersonaGalleryTab
                personaId={personaId}
                personaName={formData.name}
                onCreateCharacterSheet={() => setCharacterSheetGeneratorOpen(true)}
                editorBusy={mutationBusy}
                galleryAvatarPending={mutationKind === "gallery-avatar"}
                onSetAvatar={handleSetGalleryAvatar}
              />
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
  characterSheetImageId,
  useCharacterSheetAsReference,
  updateField,
  onCreateCharacterSheet,
}: {
  personaId: string;
  personaName?: string;
  defaultAppearance?: string;
  defaultAvatarUrl?: string | null;
  characterSheetImageId: string | null;
  useCharacterSheetAsReference: boolean;
  updateField: <K extends keyof PersonaFormData>(key: K, value: PersonaFormData[K]) => void;
  onCreateCharacterSheet: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
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
  const portraitExpressionSprites = allSprites.filter((s) => !s.expression.toLowerCase().startsWith("full_"));
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
          aria-pressed={category === tab.id}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
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

  /** Open the sprite picker unless another single-file upload is already running. */
  const startUpload = (expression: string) => {
    if (uploading || !expression) return;
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
            ? localizeUi("ui.personas.personaspritestab.exportedValue1SpriteValue2AsAFolder", {
                value1: spritesToExport.length,
                value2: spritesToExport.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
              })
            : localizeUi("ui.personas.personaspritestab.exportedValue1Value2SpriteValue3AsAFolder", {
                value1: spritesToExport.length,
                value2:
                  category === "full-body"
                    ? localizeUi("ui.personas.personaspritestab.fullBody_0fbbc4a")
                    : localizeUi("ui.personas.personaspritestab.expression"),
                value3: spritesToExport.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
              }),
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : localizeUi("ui.personas.personaspritestab.noSpritesWereExportedPleaseTryAgain"),
        );
      } finally {
        setExporting(false);
      }
    },
    [category, exportSprites, personaId, personaName, localizeUi],
  );

  const handleCleanVisibleSprites = useCallback(async () => {
    if (visibleSprites.length === 0) return;

    const modeLabel = category === "full-body" ? "full-body" : "expression";
    if (
      !(await showConfirmDialog({
        title: localizeUi("ui.personas.personaspritestab.cleanSpriteBackgrounds"),
        message: localizeUi("ui.personas.personaspritestab.cleanBackgroundsOnValue1SavedValue2SpriteValue3At", {
          value1: visibleSprites.length,
          value2: modeLabel,
          value3: visibleSprites.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
          value4: savedCleanupStrength,
        }),
        confirmLabel: localizeUi("ui.personas.personaspritestab.clean"),
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
        toast.success(
          localizeUi("ui.personas.personaspritestab.cleanedValue1SavedSpriteValue2Value3", {
            value1: result.processed,
            value2: result.processed === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
            value3: engineDetails,
          }),
        );
      }
      if (result.failed.length > 0) {
        toast.warning(
          localizeUi("ui.personas.personaspritestab.value1SpriteValue2CouldNotBeCleaned", {
            value1: result.failed.length,
            value2: result.failed.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
          }),
        );
      }
    } catch (err: any) {
      toast.error(err?.message || localizeUi("ui.personas.personaspritestab.failedToCleanSavedSprites"));
    } finally {
      setCleaningSprites(false);
    }
  }, [category, cleanupSavedSprites, personaId, savedCleanupStrength, visibleSprites, localizeUi]);

  const handleRestoreLastCleanup = useCallback(async () => {
    if (!lastCleanupBackupId) return;
    setRestoringCleanup(true);
    try {
      const result = await restoreSpriteCleanupBackup.mutateAsync({
        characterId: personaId,
        backupId: lastCleanupBackupId,
      });
      if (result.restored > 0) {
        toast.success(
          localizeUi("ui.personas.personaspritestab.restoredValue1SpriteValue2FromTheCleanupBackup", {
            value1: result.restored,
            value2: result.restored === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
          }),
        );
      }
      if (result.failed.length > 0) {
        toast.warning(
          localizeUi("ui.personas.personaspritestab.value1SpriteValue2CouldNotBeRestored", {
            value1: result.failed.length,
            value2: result.failed.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
          }),
        );
      } else {
        setLastCleanupBackupId(null);
      }
    } catch (err: any) {
      toast.error(err?.message || localizeUi("ui.personas.personaspritestab.failedToRestoreSpriteCleanupBackup"));
    } finally {
      setRestoringCleanup(false);
    }
  }, [lastCleanupBackupId, personaId, restoreSpriteCleanupBackup, localizeUi]);

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
        toast.success(
          localizeUi("ui.personas.personaspritestab.framedValue1Sprite", {
            value1: displayExpression(framingSprite.expression),
          }),
        );
        setFramingSprite(null);
      } finally {
        setSavingFrame(false);
      }
    },
    [displayExpression, framingSprite, personaId, uploadSprite, localizeUi],
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
        toast.success(
          localizeUi("ui.personas.personaspritestab.cleanedValue1Sprite", {
            value1: displayExpression(wandCleanupSprite.expression),
          }),
        );
        setWandCleanupSprite(null);
      } finally {
        setSavingWandCleanup(false);
      }
    },
    [displayExpression, personaId, uploadSprite, wandCleanupSprite, localizeUi],
  );

  const characterSheetSection = (
    <PersonaCharacterSheetSection
      personaId={personaId}
      personaName={personaName ?? ""}
      characterSheetImageId={characterSheetImageId}
      useAsReference={useCharacterSheetAsReference}
      updateField={updateField}
      onCreateCharacterSheet={onCreateCharacterSheet}
    />
  );

  if (category === "clips") {
    return (
      <div className="space-y-6">
        <SectionHeader
          title={localizeUi("ui.personas.personaspritestab.personaSprites")}
          subtitle={localizeUi("ui.personas.personaspritestab.uploadVnStyleSpritesAndVideoCallClipsFor")}
          helpText={PERSONA_SPRITES_HELP}
        />

        {characterSheetSection}

        {categoryTabs}

        <PersonaCallClipsGallery personaId={personaId} personaName={personaName} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={localizeUi("ui.personas.personaspritestab.personaSprites")}
        subtitle={localizeUi("ui.personas.personaspritestab.uploadVnStyleSpritesForYourPersonaTheseAre")}
        helpText={PERSONA_SPRITES_HELP}
      />

      {characterSheetSection}

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
            {localizeUi("ui.personas.personaspritestab.addSprite")}
          </h4>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <button
              type="button"
              onClick={() => setSpriteGenOpen(true)}
              disabled={spriteGenerationUnavailable}
              className="mari-chrome-accent-surface mari-accent-animated flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-center text-[0.6875rem] font-medium leading-tight transition-all disabled:cursor-not-allowed disabled:opacity-40 max-md:flex-1 max-md:basis-[calc(50%-0.25rem)] max-md:px-2.5"
              title={
                spriteGenerationUnavailable
                  ? spriteGenerationReason
                  : localizeUi("ui.personas.personaspritestab.generateSpritesUsingAiImageGeneration")
              }
            >
              <Wand2 size="0.8125rem" />
              {localizeUi("ui.personas.personaspritestab.generateSprite")}
            </button>
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              disabled={!!folderProgress}
              className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-center text-[0.6875rem] font-medium leading-tight text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40 max-md:flex-1 max-md:basis-[calc(50%-0.25rem)] max-md:px-2.5"
              title={localizeUi("ui.personas.personaspritestab.selectAFolderOfPngs")}
            >
              <FolderOpen size="0.8125rem" />
              {localizeUi("ui.personas.personaspritestab.uploadFolder")}
            </button>
            <button
              type="button"
              onClick={() => void handleCleanVisibleSprites()}
              disabled={cleaningSprites || backgroundCleanupUnavailable || visibleSprites.length === 0}
              className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-center text-[0.6875rem] font-medium leading-tight text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40 max-md:flex-1 max-md:basis-[calc(50%-0.25rem)] max-md:px-2.5"
              title={
                backgroundCleanupUnavailable
                  ? backgroundCleanupReason
                  : localizeUi("ui.personas.personaspritestab.cleanBackgroundsOnTheCurrentlyVisibleSavedSprites")
              }
            >
              {cleaningSprites ? <Loader2 size="0.8125rem" className="animate-spin" /> : <Eraser size="0.8125rem" />}
              {cleaningSprites
                ? localizeUi("ui.personas.personaspritestab.cleaning")
                : localizeUi("ui.personas.personaspritestab.cleanBackgrounds")}
            </button>
            <div className="relative max-md:flex-1 max-md:basis-[calc(50%-0.25rem)]">
              <button
                type="button"
                onClick={() => setExportMenuOpen((open) => !open)}
                disabled={exporting || allSprites.length === 0}
                className="flex w-full min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-center text-[0.6875rem] font-medium leading-tight text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40 max-md:px-2.5"
                title={localizeUi("ui.personas.personaspritestab.chooseWhichSavedSpritesToExport")}
              >
                <ImageDown size="0.8125rem" />
                {exporting
                  ? localizeUi("ui.personas.personaspritestab.exporting")
                  : localizeUi("ui.personas.personaspritestab.export")}
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
                    {category === "full-body"
                      ? localizeUi("ui.personas.personaspritestab.fullBodyOnly")
                      : localizeUi("ui.personas.personaspritestab.expressionsOnly")}
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
                    {localizeUi("ui.personas.personaspritestab.allSprites")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--secondary)]/60 px-3 py-2">
          <span className="text-[0.6875rem] font-medium text-[var(--foreground)]">
            {localizeUi("ui.personas.personaspritestab.cleanupStrength")}
          </span>
          <span className="text-[0.625rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.personas.personaspritestab.soft")}
          </span>
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
          <span className="text-[0.625rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.personas.personaspritestab.aggressive")}
          </span>
          <span className="w-8 text-right text-[0.6875rem] tabular-nums text-[var(--muted-foreground)]">
            {savedCleanupStrength}
          </span>
        </div>

        {folderProgress && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
            <Loader2 size="0.75rem" className="animate-spin text-[var(--primary)]" />
            {localizeUi("ui.noodle.noodleprofilesurface.uploading_de27240")} {folderProgress.done}/
            {folderProgress.total} {localizeUi("ui.personas.personaspritestab.sprites")}
          </div>
        )}
        {cleaningSprites && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
            <Loader2 size="0.75rem" className="animate-spin text-[var(--primary)]" />
            {localizeUi("ui.personas.personaspritestab.applyingAutomaticMatteCleanupToSavedSprites")}
          </div>
        )}
        {lastCleanupBackupId && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
            <span>{localizeUi("ui.personas.personaspritestab.lastCleanupHasARestorePoint")}</span>
            <button
              type="button"
              onClick={() => void handleRestoreLastCleanup()}
              disabled={restoringCleanup}
              className="flex items-center gap-1.5 rounded-md bg-[var(--card)] px-2.5 py-1 text-[0.6875rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] disabled:opacity-40"
            >
              {restoringCleanup ? <Loader2 size="0.75rem" className="animate-spin" /> : <RotateCcw size="0.75rem" />}
              {localizeUi("ui.personas.personaspritestab.undoCleanup")}
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
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={newExpression}
            onChange={(e) => setNewExpression(e.target.value)}
            placeholder={
              category === "full-body"
                ? localizeUi("ui.personas.personaspritestab.poseNameEGIdleWalkBattleStance")
                : localizeUi("ui.personas.personaspritestab.expressionNameEGHappySadAngry")
            }
            className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
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
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] shadow-sm transition-all hover:shadow-md disabled:opacity-40 sm:w-auto"
          >
            <Plus size="0.8125rem" />
            {localizeUi("ui.personas.personaspritestab.upload")}
          </button>
        </div>

        {category === "expressions" && suggestedExpressions.length > 0 && (
          <div>
            <p className="text-[0.625rem] text-[var(--muted-foreground)] mb-1.5">
              {localizeUi("ui.personas.personaspritestab.quickAdd")}
            </p>
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
                title={localizeUi("ui.personas.personaspritestab.openWandCleanup")}
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
                    title={localizeUi("ui.personas.personaspritestab.frame")}
                  >
                    <Crop size="0.6875rem" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadSpriteFile(sprite)}
                    className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    title={localizeUi("ui.personas.personagallerytab.download")}
                  >
                    <ImageDown size="0.6875rem" />
                  </button>
                  <button
                    type="button"
                    onClick={() => startUpload(sprite.expression)}
                    className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    title={localizeUi("settings.notifications.customSound.actions.replace")}
                  >
                    <Upload size="0.6875rem" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteSpriteRequest(sprite)}
                    className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    title={localizeUi("lorebook.editor.batch.delete")}
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
            <p className="text-sm font-medium text-[var(--muted-foreground)]">
              {localizeUi("ui.personas.personaspritestab.noSpritesYet")}
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]/60">
              {category === "full-body"
                ? localizeUi("ui.personas.personaspritestab.uploadFullBodySpritesAboveUseTransparentPngsFor")
                : localizeUi("ui.personas.personaspritestab.uploadExpressionSpritesAboveUseTransparentPngsForBest")}
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
          title={localizeUi("ui.personas.personaspritestab.deleteSprite")}
          width="max-w-sm"
        >
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-[var(--foreground)]">
              {localizeUi("ui.personas.personaspritestab.deleteSpriteFor")}
              {displayExpression(deleteSpriteRequest.expression)}"?
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
                  {localizeUi("ui.personas.personaspritestab.deleteAll")}{" "}
                  {category === "full-body"
                    ? localizeUi("ui.personas.personaspritestab.fullBody")
                    : localizeUi("ui.personas.personaspritestab.expressions")}
                </button>
              ) : null}
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteSpriteRequest(null)}
                  disabled={!!deletingSprites}
                  className="rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50 sm:px-3 sm:text-sm"
                >
                  {localizeUi("chat.delete.dialog.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteSingleSprite()}
                  disabled={!!deletingSprites}
                  className="mari-chrome-accent-surface mari-accent-animated inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors disabled:opacity-50 sm:px-3 sm:text-sm"
                >
                  {deletingSprites === "single" && <Loader2 size="0.875rem" className="animate-spin" />}
                  {localizeUi("lorebook.editor.batch.delete")}
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
        existingExpressionSprites={portraitExpressionSprites}
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
  const { t: localizeUi } = useUiTranslation();
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
        title={localizeUi("ui.personas.personacolorstab.personaColors")}
        subtitle={localizeUi("ui.personas.personacolorstab.customizeHowYourPersonaAppearsInChatsColorsAre")}
        helpText={PERSONA_COLORS_HELP}
      />

      <button
        type="button"
        disabled={!avatarUrl || extracting}
        onClick={handleExtract}
        className="mari-editor-action mari-editor-action--accent mari-editor-action--primary flex w-full rounded-xl px-4 py-2.5 text-xs"
      >
        {extracting ? <Loader2 size="0.875rem" className="animate-spin" /> : <Palette size="0.875rem" />}
        {extracting
          ? localizeUi("ui.personas.personacolorstab.extracting")
          : avatarUrl
            ? localizeUi("ui.personas.personacolorstab.extractColorsFromAvatar")
            : localizeUi("ui.personas.personacolorstab.uploadAnAvatarFirst")}
      </button>

      <div className="space-y-3 overflow-hidden rounded-xl border border-[var(--border)] bg-black/30 p-4">
        <p className="text-[0.625rem] font-medium uppercase tracking-widest text-[var(--muted-foreground)]">
          {localizeUi("settings.notifications.customSound.actions.preview")}
        </p>
        <div className="flex gap-3 flex-row-reverse">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-neutral-500 to-neutral-600 ring-2 ring-white/15">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={localizeUi("ui.personas.personacolorstab.value1AvatarPreview", {
                  value1: formData.name || localizeUi("ui.characters.cardlibrarydetailcard.persona"),
                })}
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
              <span className="text-neutral-100">
                {localizeUi("ui.personas.personacolorstab.iTurnAroundAndRaiseMyHand")}{" "}
              </span>
              <strong
                style={formData.dialogueColor ? { color: formData.dialogueColor } : { color: "rgb(255, 255, 255)" }}
              >
                {localizeUi("ui.personas.personacolorstab.ldquoGeneralKenobiRdquo")}
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
        label={localizeUi("ui.personas.personacolorstab.nameDisplayColor")}
        helpText="The color (or gradient) used for your persona's name in chat messages and persona selectors. Supports gradients!"
      />

      {/* Dialogue Color */}
      <ColorPicker
        value={formData.dialogueColor}
        onChange={(v) => updateField("dialogueColor", v)}
        label={localizeUi("ui.personas.personacolorstab.dialogueHighlightColor")}
        helpText={
          'Text inside dialogue quotation marks ("", “”, «», 「」, 『』) will be automatically colored with this, and can also be bolded from Settings.'
        }
      />

      {/* Box Color */}
      <ColorPicker
        value={formData.boxColor}
        onChange={(v) => updateField("boxColor", v)}
        label={localizeUi("ui.personas.personacolorstab.messageBoxColor")}
        helpText="Background color for your persona's chat message bubbles. Use a semi-transparent color for best results (e.g. rgba)."
      />
    </div>
  );
}

// ── Persona Stats Tab ──

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

const DEFAULT_PERSONA_STATS: PersonaStatsConfig = {
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
  const { t: localizeUi } = useUiTranslation();
  // Form state keeps personaStats decoded (hydrated from the projected Persona);
  // serialization happens only at the save/snapshot boundaries.
  const parsed = formData.personaStats ?? DEFAULT_PERSONA_STATS;

  const save = (next: PersonaStatsConfig) => {
    updateField("personaStats", next);
  };

  const updateStatIcons = (statIcons: NonNullable<TrackerCardColorConfig["statIcons"]>) => {
    updateField("trackerCardColors", { ...formData.trackerCardColors, statIcons });
  };

  const updateBar = <K extends keyof PersonaStatBar>(index: number, field: K, value: PersonaStatBar[K]) => {
    const next = [...parsed.bars];
    next[index] = { ...next[index], [field]: value };
    if (field === "name" && value !== parsed.bars[index]?.name) {
      updateStatIcons(
        remapStatIconAssignments(
          formData.trackerCardColors.statIcons ?? [],
          parsed.bars,
          next,
          (nextIndex) => nextIndex,
        ),
      );
    }
    save({ ...parsed, bars: next });
  };

  const addBar = () => {
    save({
      ...parsed,
      bars: [...parsed.bars, { name: "New Stat", value: 100, max: 100, color: "#38bdf8" }],
    });
  };

  const removeBar = (index: number) => {
    const nextBars = parsed.bars.filter((_, i) => i !== index);
    updateStatIcons(
      remapStatIconAssignments(formData.trackerCardColors.statIcons ?? [], parsed.bars, nextBars, (nextIndex) =>
        nextIndex < index ? nextIndex : nextIndex + 1,
      ),
    );
    save({ ...parsed, bars: nextBars });
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
        title={localizeUi("ui.personas.personastatstab.personaStatusBars")}
        subtitle={localizeUi("ui.personas.personastatstab.trackYourPersonaSPhysicalAndMentalNeedsThese")}
        helpText={PERSONA_STATS_HELP}
      />

      <SettingsSwitch
        label={<span className="font-medium">{localizeUi("ui.personas.personastatstab.enablePersonaStats")}</span>}
        description={localizeUi("ui.personas.personastatstab.trackedByThePersonaStatsAgentStatsAppearIn")}
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
              <h3 className="text-sm font-semibold">{localizeUi("ui.personas.personastatstab.statusBars")}</h3>
              <button
                type="button"
                onClick={addBar}
                className="mari-chrome-accent-surface mari-accent-animated flex items-center gap-1 rounded-lg px-2.5 py-1 text-[0.6875rem] font-medium transition-colors"
              >
                <Plus size="0.75rem" />
                {localizeUi("ui.personas.personastatstab.add")}
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
                    <StatIconPicker
                      value={resolveStatIconAssignment(
                        formData.trackerCardColors.statIcons ?? [],
                        bar.name,
                        getStatNameOccurrence(parsed.bars, i),
                      )}
                      statName={bar.name}
                      onSelect={(icon) =>
                        updateStatIcons(
                          setStatIconAssignment(
                            formData.trackerCardColors.statIcons ?? [],
                            bar.name,
                            getStatNameOccurrence(parsed.bars, i),
                            icon ?? undefined,
                          ),
                        )
                      }
                    />
                    <input
                      value={bar.name}
                      onChange={(e) => updateBar(i, "name", e.target.value)}
                      className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs font-medium"
                      placeholder={localizeUi("ui.personas.personastatstab.statName")}
                    />
                    <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                      {localizeUi("ui.personas.personastatstab.max")}
                    </span>
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
                      className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--primary)]/15 hover:text-[var(--primary)]"
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
          title={localizeUi("ui.personas.personastatstab.rpgAttributes")}
          subtitle={localizeUi("ui.personas.personastatstab.defineYourPersonaSRpgStatsStrDexEtc")}
          helpText={PERSONA_RPG_ATTRIBUTES_HELP}
        />

        <SettingsSwitch
          label={<span className="font-medium">{localizeUi("ui.personas.personastatstab.enableRpgAttributes")}</span>}
          description={localizeUi("ui.personas.personastatstab.attributesAreInjectedIntoThePromptAndTrackedVia")}
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
                <h3 className="text-sm font-semibold">{localizeUi("ui.personas.personastatstab.pools")}</h3>
                <button
                  type="button"
                  onClick={() => updateRpgPools([...rpgPools, createNewRpgPool(rpgPools)])}
                  className="mari-chrome-accent-surface mari-accent-animated flex items-center gap-1 rounded-lg px-2.5 py-1 text-[0.6875rem] font-medium transition-colors"
                >
                  <Plus size="0.75rem" />
                  {localizeUi("ui.personas.personastatstab.add")}
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
                      aria-label={localizeUi("ui.personas.personastatstab.value1Color", {
                        value1: pool.name || localizeUi("ui.personas.personastatstab.pool"),
                      })}
                    />
                    <input
                      value={pool.name}
                      onChange={(e) => updateRpgPool(i, { name: e.target.value })}
                      className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs font-medium"
                      placeholder={localizeUi("ui.personas.personastatstab.name")}
                    />
                    <input
                      type="number"
                      value={pool.value}
                      onChange={(e) => updateRpgPool(i, { value: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-center text-xs"
                      min={0}
                      aria-label={localizeUi("ui.personas.personastatstab.value1Value", {
                        value1: pool.name || localizeUi("ui.personas.personastatstab.pool"),
                      })}
                    />
                    <input
                      type="number"
                      value={pool.max}
                      onChange={(e) => updateRpgPool(i, { max: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-center text-xs"
                      min={1}
                      aria-label={localizeUi("ui.personas.personastatstab.value1Max", {
                        value1: pool.name || localizeUi("ui.personas.personastatstab.pool"),
                      })}
                    />
                    <button
                      type="button"
                      onClick={() => updateRpgPools(rpgPools.filter((_, poolIndex) => poolIndex !== i))}
                      className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--primary)]/15 hover:text-[var(--primary)]"
                      aria-label={localizeUi("ui.personas.personastatstab.removeValue1", {
                        value1: pool.name || localizeUi("ui.personas.personastatstab.pool_51a4b13"),
                      })}
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
                <h3 className="text-sm font-semibold">{localizeUi("ui.personas.personastatstab.attributes")}</h3>
                <button
                  type="button"
                  onClick={addRpgAttribute}
                  className="mari-chrome-accent-surface mari-accent-animated flex items-center gap-1 rounded-lg px-2.5 py-1 text-[0.6875rem] font-medium transition-colors"
                >
                  <Plus size="0.75rem" />
                  {localizeUi("ui.personas.personastatstab.add")}
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
                      placeholder={localizeUi("ui.personas.personastatstab.name")}
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
                      className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--primary)]/15 hover:text-[var(--primary)]"
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
  onSelectAvatar,
  onGenerateAvatar,
  imageGenerationAvailable,
  avatarUploading,
  hasUnsavedChanges,
  // The editor's live save/avatar/gallery mutex. Replacing or reframing the avatar
  // while one of those is running would race the image the server is about to
  // return, so both entry points and the cropper follow the same busy state.
  avatarMutationBusy,
}: {
  personaId: string | null;
  formData: PersonaFormData;
  updateField: <K extends keyof PersonaFormData>(key: K, value: PersonaFormData[K]) => void;
  avatarPreview: string | null;
  onSelectAvatar: () => void;
  onGenerateAvatar: () => void;
  imageGenerationAvailable: boolean;
  avatarUploading: boolean;
  hasUnsavedChanges: boolean;
  avatarMutationBusy: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
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
        title={localizeUi("editor.tabs.metadata")}
        subtitle={localizeUi("ui.personas.personametadatatab.basicPersonaInfoNameTitleCreatorVersionAvatarTags")}
        helpText={PERSONA_METADATA_HELP}
      />

      {personaId && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/70 px-3 py-2">
          <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            {localizeUi("ui.personas.personametadatatab.personaId")}
          </span>
          <code className="min-w-0 flex-1 break-all rounded-lg bg-[var(--background)] px-2 py-1 text-[0.6875rem] text-[var(--foreground)]">
            {personaId}
          </code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(personaId);
              toast.success(localizeUi("ui.personas.personametadatatab.personaIdCopied"));
            }}
            className="mari-editor-action inline-flex h-8 px-2 text-[0.6875rem]"
            title={localizeUi("ui.personas.personametadatatab.copyPersonaId")}
          >
            <Copy size="0.75rem" />
            {localizeUi("lorebook.editor.batch.copy")}
          </button>
        </div>
      )}

      <div className="space-y-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
          {t("editor.avatar.label")}
          <HelpTooltip text={t("editor.avatar.persona.help")} />
        </span>

        {avatarPreview && (
          <fieldset
            disabled={avatarMutationBusy}
            className="min-w-0 border-0 p-0 disabled:pointer-events-none disabled:opacity-60"
          >
            <AvatarCropWidget
              src={avatarPreview}
              alt={formData.name}
              crop={formData.avatarCrop}
              onChange={(next) => {
                if (avatarMutationBusy) return;
                updateField("avatarCrop", next);
              }}
            />
          </fieldset>
        )}

        <fieldset disabled={avatarMutationBusy} className="min-w-0 border-0 p-0 disabled:opacity-60">
          <AvatarReplaceActions
            hasAvatar={Boolean(avatarPreview)}
            uploading={avatarUploading}
            generationAvailable={imageGenerationAvailable}
            onUpload={onSelectAvatar}
            onGenerate={onGenerateAvatar}
          />
        </fieldset>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 sm:col-span-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.personas.personastatstab.name")}{" "}
            <HelpTooltip
              text={localizeUi("ui.personas.personametadatatab.yourPersonaSDisplayNameThisIsInjectedInto")}
            />
          </span>
          <input
            value={formData.name}
            onChange={(e) => updateField("name", e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
            placeholder={localizeUi("ui.personas.personaeditor.personaName")}
          />
        </label>
        <label className="space-y-1.5 sm:col-span-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.personas.personametadatatab.titleComment")}{" "}
            <HelpTooltip text={localizeUi("ui.personas.personametadatatab.aShortNoteShownUnderThePersonaNameIn")} />
          </span>
          <input
            value={formData.comment}
            onChange={(e) => updateField("comment", e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
            placeholder={localizeUi("ui.personas.personametadatatab.modernAuVersion")}
          />
        </label>
        <label className="space-y-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.personas.personametadatatab.phoneticName")}{" "}
            <HelpTooltip
              text={localizeUi(
                "ui.personas.personametadatatab.optionalPronunciationOverrideUsedOnlyWhenYourPersonaName",
              )}
            />
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
            {localizeUi("ui.personas.personametadatatab.creator")}{" "}
            <HelpTooltip
              text={localizeUi("ui.personas.personametadatatab.thePersonWhoMadeThisPersonaUsefulForCredit")}
            />
          </span>
          <input
            value={formData.creator}
            onChange={(e) => updateField("creator", e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
            placeholder={localizeUi("ui.personas.personametadatatab.yourName")}
          />
        </label>
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
              {localizeUi("ui.personas.personametadatatab.version")}{" "}
              <HelpTooltip
                text={localizeUi(
                  "ui.personas.personametadatatab.versionNumberForTrackingChangesToThisPersonaDefinition",
                )}
              />
            </span>
            <SettingsSwitch
              checked={formData.versioningEnabled}
              onChange={(enabled) => {
                updateField("versioningEnabled", enabled);
                if (enabled && !formData.personaVersion.trim()) {
                  updateField("personaVersion", "1.0");
                }
              }}
              label={localizeUi("ui.cardversionhistory.automaticVersioning")}
              labelPosition="end"
              title={localizeUi("ui.cardversionhistory.automaticVersioningDescription")}
              className="min-h-11 gap-2 rounded-md px-1 py-0"
              labelClassName="text-xs font-medium text-[var(--muted-foreground)]"
            />
          </div>
          <input
            value={formData.personaVersion}
            onChange={(e) => updateField("personaVersion", e.target.value)}
            disabled={!formData.versioningEnabled}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="1.0"
          />
          <PersonaVersionHistoryPanel
            personaId={personaId}
            currentData={formData}
            currentAvatarPath={avatarPreview}
            hasUnsavedChanges={hasUnsavedChanges}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.personas.personametadatatab.tags")}{" "}
            <HelpTooltip
              text={localizeUi("ui.personas.personametadatatab.labelsForOrganizingPersonasUseTagsLikeFantasyModern")}
            />
          </span>
          {formData.tags.length > 0 && (
            <button
              type="button"
              onClick={removeAllTags}
              className="mari-chrome-accent-surface mari-accent-animated rounded-lg border px-2.5 py-1 text-[0.6875rem] font-medium transition-colors"
            >
              {localizeUi("ui.personas.personametadatatab.removeAll")}
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
                className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-[var(--primary)]/15 hover:text-[var(--primary)]"
                title={localizeUi("ui.personas.personametadatatab.removeTagValue1", { value1: tag })}
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
            placeholder={localizeUi("ui.personas.personametadatatab.addTag")}
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5 text-xs outline-none focus:border-[var(--primary)]/40"
          />
          <button
            type="button"
            onClick={addTag}
            className="mari-chrome-control mari-chrome-control--compact mari-chrome-control--selected px-3 py-1.5"
          >
            {localizeUi("ui.personas.personastatstab.add")}
          </button>
        </div>
      </div>

      <div className="block space-y-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
          {localizeUi("ui.personas.personametadatatab.creatorNotes")}{" "}
          <HelpTooltip
            text={localizeUi("ui.personas.personametadatatab.privateNotesAboutThisPersonaTipsForUseKnown")}
          />
        </span>
        <MacroTextarea
          value={formData.creatorNotes}
          onChange={(value) => updateField("creatorNotes", value)}
          rows={4}
          title={localizeUi("ui.personas.personametadatatab.creatorNotes")}
          showMarkdownPreview
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-sm outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          placeholder={localizeUi("ui.personas.personametadatatab.notesAboutThisPersonaIntendedUseTipsForBest")}
        />
      </div>
    </div>
  );
}

function PersonaCharacterSheetSection({
  personaId,
  personaName,
  characterSheetImageId,
  useAsReference,
  updateField,
  onCreateCharacterSheet,
}: {
  personaId: string;
  personaName: string;
  characterSheetImageId: string | null;
  useAsReference: boolean;
  updateField: <K extends keyof PersonaFormData>(key: K, value: PersonaFormData[K]) => void;
  onCreateCharacterSheet: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { data: images, isLoading } = usePersonaGalleryImages(personaId);
  const upload = useUploadPersonaGalleryImage(personaId);
  const selectedImage = images?.find((image) => image.id === characterSheetImageId) ?? null;
  const selectionMissing = Boolean(characterSheetImageId && !isLoading && !selectedImage);

  const handleUpload = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      try {
        const uploaded = await upload.mutateAsync([file]);
        const image = uploaded[0];
        if (image) updateField("characterSheetImageId", image.id);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : localizeUi("ui.characters.charactersheet.uploadFailed"));
      }
    },
    [localizeUi, updateField, upload],
  );

  const clearSelection = useCallback(() => {
    updateField("characterSheetImageId", null);
    updateField("useCharacterSheetAsReference", false);
  }, [updateField]);

  return (
    <section className="space-y-6 border-t border-[var(--border)] pt-5">
      <SectionHeader
        title={localizeUi("ui.characters.charactersheet.title")}
        subtitle={localizeUi("ui.characters.charactersheet.subtitle")}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
          {selectedImage ? (
            <img
              src={selectedImage.url}
              alt={localizeUi("ui.characters.charactersheet.previewAlt", { name: personaName })}
              className="max-h-[32rem] w-full bg-[var(--secondary)] object-contain"
            />
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 bg-[var(--secondary)] px-6 text-center">
              <Image size="2rem" className="text-[var(--muted-foreground)]/50" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">{localizeUi("ui.characters.charactersheet.emptyTitle")}</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {localizeUi("ui.characters.charactersheet.emptyDescription")}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <button
            type="button"
            onClick={onCreateCharacterSheet}
            disabled={upload.isPending}
            className="mari-editor-action mari-editor-action--primary inline-flex w-full justify-center disabled:cursor-wait disabled:opacity-60"
          >
            <Wand2 size="0.875rem" />
            {localizeUi("ui.characters.charactersheet.createWithAi")}
          </button>

          <ImageUploadDropzone
            multiple={false}
            label={
              selectedImage
                ? localizeUi("ui.characters.charactersheet.replace")
                : localizeUi("ui.characters.charactersheet.upload")
            }
            pending={upload.isPending}
            pendingLabel={localizeUi("ui.characters.charactersheet.uploading")}
            dragLabel={localizeUi("ui.characters.charactersheet.dropImage")}
            onFilesSelected={(files) => void handleUpload(files)}
            icon={<Upload size="1rem" />}
            className="w-full"
          />

          <SettingsSwitch
            label={<span className="font-medium">{localizeUi("ui.characters.charactersheet.useAsReference")}</span>}
            description={localizeUi("ui.characters.charactersheet.useAsReferenceDescription")}
            checked={Boolean(selectedImage) && useAsReference}
            disabled={!selectedImage}
            onChange={(checked) => updateField("useCharacterSheetAsReference", checked)}
            labelPosition="start"
            className="justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
          />

          <p className="rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
            {selectedImage && useAsReference
              ? localizeUi("ui.characters.charactersheet.activeStatus")
              : localizeUi("ui.characters.charactersheet.avatarFallbackStatus")}
          </p>

          {(selectedImage || selectionMissing) && (
            <button
              type="button"
              onClick={clearSelection}
              className="mari-editor-action inline-flex w-full justify-center text-red-500"
            >
              <X size="0.875rem" />
              {localizeUi("ui.characters.charactersheet.remove")}
            </button>
          )}
        </div>
      </div>
    </section>
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
  { key: "characterSheetImageId", label: "Character Sheet" },
  { key: "useCharacterSheetAsReference", label: "Use Character Sheet as Reference" },
  { key: "avatarCrop", label: "Avatar Crop" },
  { key: "nameColor", label: "Name Color" },
  { key: "dialogueColor", label: "Dialogue Color" },
  { key: "boxColor", label: "Box Color" },
  { key: "personaStats", label: "Persona Stats" },
  { key: "tags", label: "Tags" },
  { key: "savedStatusOptions", label: "Saved Status Options" },
  { key: "convoDisplayName", label: "Convo Display Name" },
  { key: "aboutMe", label: "About Me" },
];

function buildCurrentPersonaSnapshot(formData: PersonaFormData): PersonaCardSnapshot {
  return {
    name: formData.name,
    creator: formData.creator,
    personaVersion: formData.personaVersion,
    versioningEnabled: String(formData.versioningEnabled),
    creatorNotes: formData.creatorNotes,
    description: formData.description,
    personality: formData.personality,
    scenario: formData.scenario,
    backstory: formData.backstory,
    appearance: formData.appearance,
    characterSheetImageId: formData.characterSheetImageId ?? "",
    useCharacterSheetAsReference: String(formData.useCharacterSheetAsReference),
    avatarCrop: formData.avatarCrop ? JSON.stringify(formData.avatarCrop) : "",
    nameColor: formData.nameColor,
    dialogueColor: formData.dialogueColor,
    boxColor: formData.boxColor,
    trackerCardColors: serializeTrackerCardColorConfig(formData.trackerCardColors),
    personaStats: formData.personaStats ? JSON.stringify(formData.personaStats) : "",
    tags: JSON.stringify(formData.tags),
    savedStatusOptions: JSON.stringify(formData.savedStatusOptions),
    convoDisplayName: formData.convoDisplayName,
    aboutMe: formData.aboutMe,
    convoBehavior:
      formData.convoBehavior && formData.convoBehavior.instruction?.trim()
        ? JSON.stringify(formData.convoBehavior)
        : "",
  };
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
  hasUnsavedChanges,
}: {
  personaId: string | null;
  currentData: PersonaFormData;
  currentAvatarPath: string | null;
  hasUnsavedChanges: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { data: versions = [], isLoading } = usePersonaVersions(personaId);
  const restoreVersion = useRestorePersonaVersion();
  const deleteVersion = useDeletePersonaVersion();
  const renameVersion = useRenamePersonaVersion();
  const resetVersions = useResetPersonaVersions();
  const [selectedVersion, setSelectedVersion] = useState<PersonaCardVersion | null>(null);
  const savedVersionCount = versions.filter((version) => !version.isCurrent).length;
  const getPersonaVersionTitle = (version: PersonaCardVersion) => getCardVersionTitle(version, localizeUi);
  const versionMutationPending =
    restoreVersion.isPending || deleteVersion.isPending || renameVersion.isPending || resetVersions.isPending;

  if (!personaId) return null;

  const currentSnapshot = buildCurrentPersonaSnapshot(currentData);

  const handleRestore = async (version: PersonaCardVersion) => {
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.personas.personaversionhistorypanel.restorePersonaVersion"),
      message: localizeUi("ui.personas.personaversionhistorypanel.restoreValue1ToValue2TheCurrentPersonaCardWill", {
        value1: currentData.name || localizeUi("ui.personas.personaversionhistorypanel.thisPersona"),
        value2: getPersonaVersionTitle(version),
      }),
      confirmLabel: localizeUi("ui.chat.databaseworkspaceapprovalcard.restore"),
    });
    if (!confirmed) return;
    try {
      await restoreVersion.mutateAsync({ id: personaId, versionId: version.id });
      toast.success(
        localizeUi("ui.personas.personaversionhistorypanel.restoredValue1", {
          value1: getPersonaVersionTitle(version),
        }),
      );
      setSelectedVersion(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : localizeUi("ui.personas.personaversionhistorypanel.failedToRestorePersonaVersion"),
      );
    }
  };

  const handleDeleteVersion = async (version: PersonaCardVersion) => {
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.personas.personaversionhistorypanel.deleteSavedVersion"),
      message: localizeUi("ui.personas.personaversionhistorypanel.deleteValue1FromVersionHistoryThisDoesNotChange", {
        value1: getPersonaVersionTitle(version),
      }),
      confirmLabel: localizeUi("lorebook.editor.batch.delete"),
      tone: "destructive",
    });
    if (!confirmed) return;
    try {
      await deleteVersion.mutateAsync({ id: personaId, versionId: version.id });
      toast.success(
        localizeUi("ui.personas.personaversionhistorypanel.deletedValue1", { value1: getPersonaVersionTitle(version) }),
      );
      setSelectedVersion((current) => (current?.id === version.id ? null : current));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : localizeUi("ui.personas.personaversionhistorypanel.failedToDeletePersonaVersion"),
      );
    }
  };

  const handleRenameVersion = async (version: PersonaCardVersion) => {
    const nextVersion = await showPromptDialog({
      title: localizeUi("ui.cardversionhistory.renameVersion"),
      message: localizeUi("ui.cardversionhistory.renameVersionMessage", {
        value1: getPersonaVersionTitle(version),
      }),
      defaultValue: version.version,
      placeholder: localizeUi("ui.cardversionhistory.versionPlaceholder"),
      confirmLabel: localizeUi("ui.cardversionhistory.save"),
      tone: "accent",
    });
    const trimmedVersion = nextVersion?.trim();
    if (!trimmedVersion || trimmedVersion === version.version) return;
    try {
      await renameVersion.mutateAsync({ id: personaId, versionId: version.id, version: trimmedVersion });
      toast.success(
        localizeUi("ui.cardversionhistory.renamedVersion", {
          value1: getPersonaVersionTitle(version),
          value2: trimmedVersion,
        }),
      );
      setSelectedVersion(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localizeUi("ui.cardversionhistory.failedToRenameVersion"));
    }
  };

  const handleResetVersions = async () => {
    const personaName = currentData.name || localizeUi("ui.personas.personaversionhistorypanel.thisPersona");
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.cardversionhistory.resetVersioningForValue1", { value1: personaName }),
      message: localizeUi("ui.cardversionhistory.resetVersioningMessage", { value1: personaName }),
      confirmLabel: localizeUi("ui.cardversionhistory.reset"),
      tone: "destructive",
    });
    if (!confirmed) return;
    try {
      await resetVersions.mutateAsync(personaId);
      toast.success(localizeUi("ui.cardversionhistory.resetVersioningSuccess", { value1: personaName }));
      setSelectedVersion(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localizeUi("ui.cardversionhistory.failedToResetVersioning"));
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/70 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
          <History size="0.75rem" />
          {localizeUi("ui.personas.personaversionhistorypanel.versionHistory")}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleResetVersions}
            disabled={isLoading || versionMutationPending || hasUnsavedChanges}
            className="mari-editor-action mari-editor-action--compact inline-flex h-7 px-2 text-[0.625rem]"
            title={localizeUi(
              hasUnsavedChanges
                ? "ui.cardversionhistory.saveOrDiscardEditsBeforeResettingVersioning"
                : "ui.cardversionhistory.resetVersioning",
            )}
          >
            {resetVersions.isPending ? (
              <Loader2 size="0.75rem" className="animate-spin" />
            ) : (
              <RotateCcw size="0.75rem" />
            )}
            {localizeUi("ui.cardversionhistory.reset")}
          </button>
          <span className="mari-editor-chip mari-editor-chip--accent px-2 py-0.5 text-[0.625rem]">
            {isLoading
              ? localizeUi("ui.personas.personaversionhistorypanel.loading")
              : localizeUi("ui.personas.personaversionhistorypanel.value1Saved", { value1: savedVersionCount })}
          </span>
        </div>
      </div>

      {versions.length === 0 ? (
        <p className="mt-2 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
          {localizeUi("ui.personas.personaversionhistorypanel.previousPersonaStatesWillAppearHereAfterTheNext")}
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
                onClick={() => {
                  if (!version.isCurrent) setSelectedVersion(version);
                }}
                disabled={version.isCurrent}
                className="min-w-0 flex-1 text-left disabled:cursor-default"
                title={
                  version.isCurrent
                    ? undefined
                    : localizeUi("ui.personas.personaversionhistorypanel.compareWithCurrentPersona")
                }
              >
                <span className="block truncate text-[0.6875rem] font-medium text-[var(--foreground)]">
                  {getPersonaVersionTitle(version)}
                </span>
                <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                  {formatCardVersionTimestamp(version.createdAt)}
                  {!version.isCurrent && version.source
                    ? localizeUi("ui.personas.personaversionhistorypanel.value1", { value1: version.source })
                    : ""}
                </span>
              </button>
              {!version.isCurrent && (
                <>
                  <button
                    type="button"
                    onClick={() => handleRenameVersion(version)}
                    disabled={versionMutationPending}
                    className="mari-editor-action mari-editor-action--compact inline-flex h-7 w-7 rounded-lg p-0"
                    title={localizeUi("ui.cardversionhistory.renameThisSavedVersion")}
                  >
                    {renameVersion.isPending && renameVersion.variables?.versionId === version.id ? (
                      <Loader2 size="0.75rem" className="animate-spin" />
                    ) : (
                      <Pencil size="0.75rem" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRestore(version)}
                    disabled={versionMutationPending}
                    className="mari-editor-action mari-editor-action--compact inline-flex h-7 w-7 rounded-lg p-0"
                    title={localizeUi("ui.personas.personaversionhistorypanel.restoreThisVersion")}
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
                    disabled={versionMutationPending}
                    className="mari-editor-action mari-editor-action--compact mari-editor-action--danger inline-flex h-7 w-7 rounded-lg p-0"
                    title={localizeUi("ui.personas.personaversionhistorypanel.deleteThisSavedVersion")}
                  >
                    {deleteVersion.isPending && deleteVersion.variables?.versionId === version.id ? (
                      <Loader2 size="0.75rem" className="animate-spin" />
                    ) : (
                      <Trash2 size="0.75rem" />
                    )}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!selectedVersion}
        onClose={() => setSelectedVersion(null)}
        title={
          selectedVersion
            ? localizeUi("ui.personas.personaversionhistorypanel.compareValue1", {
                value1: getPersonaVersionTitle(selectedVersion),
              })
            : localizeUi("ui.personas.personaversionhistorypanel.compareVersion")
        }
        width="max-w-5xl"
      >
        {selectedVersion && (
          <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto">
            <div className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-xs md:grid-cols-2">
              <div>
                <p className="font-semibold text-[var(--foreground)]">
                  {localizeUi("ui.personas.personaversionhistorypanel.currentPersona")}
                </p>
                <p className="mt-1 text-[var(--muted-foreground)]">
                  {localizeUi("ui.personas.personaeditor.v")}
                  {currentData.personaVersion || "1.0"}
                  {currentData.comment
                    ? localizeUi("ui.personas.personaversionhistorypanel.value1", { value1: currentData.comment })
                    : ""}
                  {currentAvatarPath ? localizeUi("ui.personas.personaversionhistorypanel.hasAvatar") : ""}
                </p>
              </div>
              <div>
                <p className="font-semibold text-[var(--foreground)]">{getPersonaVersionTitle(selectedVersion)}</p>
                <p className="mt-1 text-[var(--muted-foreground)]">
                  {formatCardVersionTimestamp(selectedVersion.createdAt)}
                  {selectedVersion.reason
                    ? localizeUi("ui.personas.personaversionhistorypanel.value1", { value1: selectedVersion.reason })
                    : ""}
                  {selectedVersion.avatarPath ? localizeUi("ui.personas.personaversionhistorypanel.hasAvatar") : ""}
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
                          {localizeUi("ui.personas.personaversionhistorypanel.changed")}
                        </span>
                      )}
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="min-h-20 min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-lg bg-[var(--secondary)] p-2 text-xs leading-relaxed text-[var(--foreground)]">
                        {currentValue || (
                          <span className="text-[var(--muted-foreground)]">
                            {localizeUi("ui.personas.personaversionhistorypanel.empty")}
                          </span>
                        )}
                      </div>
                      <div className="min-h-20 min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-lg bg-[var(--secondary)] p-2 text-xs leading-relaxed text-[var(--foreground)]">
                        {savedValue || (
                          <span className="text-[var(--muted-foreground)]">
                            {localizeUi("ui.personas.personaversionhistorypanel.empty")}
                          </span>
                        )}
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
                {localizeUi("ui.personas.personaversionhistorypanel.restoreThisVersion")}
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
}: {
  formData: PersonaFormData;
  updateField: <K extends keyof PersonaFormData>(key: K, value: PersonaFormData[K]) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div>
      <SectionHeader
        title={localizeUi("editor.tabs.card")}
        subtitle={localizeUi("ui.personas.personacardtab.writeYourCorePersonaCardFieldsInOneFocused")}
        helpText={PERSONA_CARD_HELP}
      />
      <EditorSectionJumps items={PERSONA_CARD_SECTIONS} />
      <div className="space-y-10">
        <EditorSectionAnchor id="persona-card-description">
          <DescriptionTab formData={formData} updateField={updateField} />
        </EditorSectionAnchor>
        <EditorSectionAnchor id="persona-card-personality">
          <TextareaTab
            title={localizeUi("chat.settings.inlineEditor.fields.personality")}
            subtitle={localizeUi("ui.personas.personacardtab.yourPersonalityTraitsTemperamentAndBehavioralPatterns")}
            helpText={PERSONA_PERSONALITY_HELP}
            value={formData.personality}
            onChange={(v) => updateField("personality", v)}
            placeholder={localizeUi("ui.personas.personacardtab.calmAndAnalyticalButQuickToActWhenSomeone")}
            rows={8}
          />
        </EditorSectionAnchor>
        <EditorSectionAnchor id="persona-card-backstory">
          <TextareaTab
            title={localizeUi("chat.settings.inlineEditor.fields.backstory")}
            subtitle={localizeUi("ui.personas.personacardtab.yourCharacterSHistoryOriginStoryAndFormativeLife")}
            helpText={PERSONA_BACKSTORY_HELP}
            value={formData.backstory}
            onChange={(v) => updateField("backstory", v)}
            placeholder={localizeUi("ui.personas.personacardtab.grewUpInAFrontierTownApprenticedUnderA")}
            rows={12}
          />
        </EditorSectionAnchor>
        <EditorSectionAnchor id="persona-card-appearance">
          <TextareaTab
            title={localizeUi("chat.settings.inlineEditor.fields.appearance")}
            subtitle={localizeUi(
              "ui.personas.personacardtab.physicalDescriptionHeightBuildHairEyesClothingDistinguishingFeatures",
            )}
            helpText={PERSONA_APPEARANCE_HELP}
            value={formData.appearance}
            onChange={(v) => updateField("appearance", v)}
            placeholder={localizeUi(
              "ui.personas.personacardtab.averageHeightDarkHairWornLoosePrefersPracticalClothing",
            )}
            rows={8}
          />
        </EditorSectionAnchor>
        <EditorSectionAnchor id="persona-card-scenario">
          <TextareaTab
            title={localizeUi("chat.settings.inlineEditor.fields.scenario")}
            subtitle={localizeUi("ui.personas.personacardtab.yourDefaultSituationOrContextWithinRoleplays")}
            helpText={PERSONA_SCENARIO_HELP}
            value={formData.scenario}
            onChange={(v) => updateField("scenario", v)}
            placeholder={localizeUi(
              "ui.personas.personacardtab.aWanderingAdventurerSeekingAnswersAboutAMysteriousArtifact",
            )}
            rows={8}
          />
        </EditorSectionAnchor>
      </div>
    </div>
  );
}

function PersonaLorebookTab({ personaId, personaName }: { personaId: string; personaName: string }) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="space-y-4">
      <SectionHeader
        title={localizeUi("ui.personas.personalorebooktab.personaLorebook")}
        subtitle={localizeUi("ui.personas.personalorebooktab.worldBuildingEntriesAttachedToYourPersona")}
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
}: {
  formData: PersonaFormData;
  updateField: <K extends keyof PersonaFormData>(key: K, value: PersonaFormData[K]) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="mari-editor-panel space-y-3 p-3">
      <SectionHeader
        title={localizeUi("chat.settings.inlineEditor.fields.description")}
        subtitle={localizeUi("ui.personas.descriptiontab.yourGeneralDescriptionThisIsSentInEveryPrompt")}
        helpText={PERSONA_DESCRIPTION_HELP}
      />
      <MacroTextarea
        value={formData.description}
        onChange={(value) => updateField("description", value)}
        placeholder={localizeUi("ui.personas.descriptiontab.describeWhoYouAreYourRoleInTheStory")}
        rows={12}
        title={localizeUi("chat.settings.inlineEditor.fields.description")}
        showMarkdownPreview
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
        showMarkdownPreview
        className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/20"
      />
      <p className="mt-1.5 text-right text-[0.625rem] text-[var(--muted-foreground)]">
        {formatPersonaTextTokens(value)}
      </p>
    </div>
  );
}
