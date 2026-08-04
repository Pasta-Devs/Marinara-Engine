// ──────────────────────────────────────────────
// Character Editor — Full-page detail view
// Replaces the chat area when editing a character.
// Sections: Metadata, Card, Convo, Lorebook, Sprites, Gallery, Colors, Stats, Advanced
// ──────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback, type ChangeEvent, type ReactNode, type SyntheticEvent } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCharacter,
  useUpdateCharacter,
  useUploadAvatar,
  useRemoveAvatar,
  useDeleteCharacter,
  useDuplicateCharacter,
  useCreatePersona,
  useUploadPersonaAvatar,
  useCharacterSprites,
  useCharacterGalleryImages,
  useCharacterGalleryClips,
  useUploadCharacterGalleryImage,
  useDeleteCharacterGalleryImage,
  useSetCharacterGalleryImageAsAvatar,
  useDeleteCharacterGalleryClip,
  useUpdateCharacterGalleryClipTrim,
  useUploadCharacterGalleryClip,
  useUploadCharacterGalleryVideo,
  useTagCharacterGalleryImage,
  useGenerateCharacterCallVideoClips,
  useGenerateCharacterCustomCallVideoClip,
  useUploadSprite,
  useDeleteSprite,
  useExportSprites,
  useCleanupSavedSprites,
  useRestoreSpriteCleanupBackup,
  useSpriteCapabilities,
  useCharacterVersions,
  useRestoreCharacterVersion,
  useDeleteCharacterVersion,
  useRenameCharacterVersion,
  useResetCharacterVersions,
  spriteKeys,
  type CharacterCallVideoGenerationInput,
  type CharacterGalleryClip,
  type CharacterGalleryImage,
  type SpriteInfo,
} from "../../hooks/use-characters";
import { ConvoProfileFields } from "./ConvoProfileFields";
import { useUIStore } from "../../stores/ui.store";
import { lorebookKeys, useLorebook, useUpdateLorebook } from "../../hooks/use-lorebooks";
import { useConnections } from "../../hooks/use-connections";
import { useInstalledCapabilityPackages } from "../../hooks/use-capability-packages";
import { showConfirmDialog, showPromptDialog } from "../../lib/app-dialogs";
import { formatCardVersionTimestamp, getCardVersionTitle } from "../../lib/card-version-history";
import { SpriteGenerationModal } from "../ui/SpriteGenerationModal";
import { AvatarGenerationModal } from "../ui/AvatarGenerationModal";
import { AvatarCropWidget } from "../ui/AvatarCropWidget";
import { AvatarReplaceActions } from "../ui/AvatarReplaceActions";
import { EditorAvatarTileActions } from "../ui/EditorAvatarTileActions";
import { CallClipGenerationModal } from "../ui/CallClipGenerationModal";
import { ImageUploadDropzone } from "../ui/ImageUploadDropzone";
import { CustomEmojiTagButton } from "../ui/CustomEmojiTagButton";
import { CharacterRegexSection } from "./CharacterRegexSection";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Save,
  User,
  IdCard,
  Settings2,
  Library,
  Camera,
  Copy,
  Trash2,
  Star,
  StarOff,
  Tag,
  X,
  AlertTriangle,
  Image,
  Upload,
  Plus,
  Palette,
  FolderOpen,
  Film,
  Link2,
  Loader2,
  Swords,
  Crop,
  ImageDown,
  Download,
  Eraser,
  Wand2,
  UserPlus,
  History,
  RotateCcw,
  Scissors,
  MessageCircle,
  Pencil,
} from "lucide-react";
import { cn, copyToClipboard, generateClientId, getAvatarCropStyle } from "../../lib/utils";
import { normalizeAvatarCrop } from "@marinara-engine/shared";
import { extractColorsFromImage } from "../../lib/avatar-color-extraction";
import { buildCardAssetMarkdown } from "../../lib/card-asset-links";
import { HelpTooltip } from "../ui/HelpTooltip";
import { api } from "../../lib/api-client";
import { downloadSpriteFile } from "../../lib/sprite-download";
import { ColorPicker } from "../ui/ColorPicker";
import { StatIconPicker } from "../ui/StatIconPicker";
import { MacroTextarea } from "../ui/MacroTextarea";
import { Modal } from "../ui/Modal";
import { SpriteFrameEditor } from "../ui/SpriteFrameEditor";
import { SpriteWandCleanupEditor } from "../ui/SpriteWandCleanupEditor";
import { ExportFormatDialog, type ExportFormatChoice } from "../ui/ExportFormatDialog";
import { EditorTabRail } from "../ui/EditorTabRail";
import { EditorSectionAnchor, EditorSectionJumps } from "../ui/EditorSectionJumps";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import {
  createDefaultRpgStatPools,
  normalizeSpriteExpressionLabel,
  normalizeRpgStatPools,
  syncRpgHpFromPools,
  type CharacterCardVersion,
  type CharacterData,
  type CharacterTrackerCustomFieldDefault,
  type ConversationCallCharacterVideoClipKind,
  type ConvoBehaviorConfig,
  type RPGStatPool,
  type RPGStatsConfig,
} from "@marinara-engine/shared";
import { parseTrackerCardColorConfig, serializeTrackerCardColorConfig } from "../../lib/tracker-card-colors";
import {
  getStatNameOccurrence,
  remapStatIconAssignments,
  resolveStatIconAssignment,
  setStatIconAssignment,
} from "../../lib/stat-icon-assignments";
import { useQuoteFormatter } from "../../hooks/use-quote-formatter";
import { LorebookAssignmentSection } from "../lorebooks/LorebookAssignmentSection";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";

// ── Tabs ──
const TABS = [
  { id: "metadata", label: "Metadata", icon: User },
  { id: "card", label: "Card", icon: IdCard },
  { id: "convo", label: "Convo", icon: MessageCircle },
  { id: "lorebook", label: "Lorebook", icon: Library },
  { id: "sprites", label: "Sprites", icon: Image },
  { id: "gallery", label: "Gallery", icon: Camera },
  { id: "colors", label: "Colors", icon: Palette },
  { id: "stats", label: "Stats", icon: Swords },
  { id: "advanced", label: "Advanced", icon: Settings2 },
] as const;

type TabId = (typeof TABS)[number]["id"];

const CHARACTER_CARD_SECTIONS = [
  { id: "character-card-description", label: "Description" },
  { id: "character-card-personality", label: "Personality" },
  { id: "character-card-backstory", label: "Backstory" },
  { id: "character-card-appearance", label: "Appearance" },
  { id: "character-card-scenario", label: "Scenario" },
  { id: "character-card-dialogue", label: "Dialogue" },
] as const;

const CHARACTER_METADATA_HELP =
  "Use metadata for identity, sharing, and library organization. The avatar identifies the character throughout Marinara, name is used as {{char}}, creator/version help track authorship and revisions, tags make the card searchable, talkativeness affects group chat response frequency, and creator notes stay private.";

const CHARACTER_CARD_HELP =
  "Write the fields that define how the model sees and plays the character. Description, personality, backstory, appearance, scenario, and dialogue are kept together here so you can treat the card as one writing document.";

const CHARACTER_DESCRIPTION_HELP =
  "The character's general identity and role. This is sent in every prompt as part of who the character is.";

const CHARACTER_PERSONALITY_HELP =
  "A concise summary of temperament, behavior, speech habits, preferences, and emotional patterns.";

const CHARACTER_BACKSTORY_HELP =
  "History, origin, important relationships, and formative events that explain how the character became who they are.";

const CHARACTER_APPEARANCE_HELP =
  "Physical description, clothing, posture, distinguishing marks, and visual details the model should remember.";

const CHARACTER_SCENARIO_HELP =
  "The default setting or situation for new interactions. Use it to establish where the scene starts and what is already happening.";

const CHARACTER_DIALOGUE_HELP =
  "First Message opens a new chat. Alternate Greetings provide other opening options. Example Dialogue teaches voice and formatting; use <START> to separate examples and {{user}} / {{char}} as placeholders.";

const CHARACTER_ADVANCED_HELP =
  "Character-specific prompt controls. System Prompt is injected through the preset's character block, Post-History Instructions appear near generation time, and Depth Prompt inserts a reminder at a selected point in chat history.";

const CHARACTER_GALLERY_HELP =
  "These images belong to the character, so deleting a chat does not remove them. Use this for reference sheets, outfit variants, or imported ST-style character image packs. Chat gallery is still best for scene-specific illustrations and generated message attachments.";

const CHARACTER_SPRITES_HELP =
  "Upload sprites one by one, or use Upload Folder to bulk-import a folder of PNGs. Each filename becomes the expression name, for example admiration.png becomes admiration. To rotate variants, share a prefix before an underscore, for example happy_01.png and happy_blush.png. Enable the Expression Engine agent so roleplay can pick matching sprites from detected emotions. Sprites appear as VN-style overlays in the chat area.";

const CHARACTER_STATS_HELP =
  "HP is injected into the prompt so the AI knows the character's current health. Attributes are custom stats, like STR or DEX, that define the character's capabilities. The Character Tracker agent can adjust values based on combat, healing, and narrative events. Values set here serve as the initial/default state for new conversations.";

const CHARACTER_COLORS_HELP =
  "Name color is applied to the character's display name in chat. Gradients use CSS linear-gradient. Dialogue color applies to text inside dialogue quotation marks and can optionally be bolded from Settings. Box color sets the background color of the character's message bubble in roleplay mode. An empty dialogue color uses the default from Settings > Appearance; other empty fields use theme colors.";

const CHARACTER_LOREBOOK_HELP =
  "Attach lorebook/world-info entries to this character. Entries trigger from keywords during conversation; embedded card lorebooks can be imported into Marinara as linked lorebooks for deeper editing.";

interface ParsedCharacter {
  id: string;
  data: string;
  comment: string;
  avatarPath: string | null;
  spriteFolderPath: string | null;
}

function getPersistedCharacterName(character: ParsedCharacter | undefined) {
  if (!character) return null;
  try {
    const data = typeof character.data === "string" ? JSON.parse(character.data) : character.data;
    return typeof data?.name === "string" && data.name.trim() ? data.name.trim() : null;
  } catch {
    return null;
  }
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

const CHARACTER_QUOTE_FIELD_KEYS = new Set<string>([
  "description",
  "personality",
  "scenario",
  "first_mes",
  "mes_example",
  "system_prompt",
  "post_history_instructions",
  "creator_notes",
]);

const CHARACTER_QUOTE_EXTENSION_KEYS = new Set(["appearance", "backstory"]);

function formatCharacterFieldValue<K extends keyof CharacterData>(
  key: K,
  value: CharacterData[K],
  formatQuotes: (value: string) => string,
): CharacterData[K] {
  if (CHARACTER_QUOTE_FIELD_KEYS.has(String(key)) && typeof value === "string") {
    return formatQuotes(value) as CharacterData[K];
  }
  if (key === "alternate_greetings" && Array.isArray(value)) {
    return value.map((entry) => (typeof entry === "string" ? formatQuotes(entry) : entry)) as CharacterData[K];
  }
  return value;
}

function formatCharacterExtensionValue(key: string, value: unknown, formatQuotes: (value: string) => string): unknown {
  if (CHARACTER_QUOTE_EXTENSION_KEYS.has(key) && typeof value === "string") return formatQuotes(value);
  if (key === "depth_prompt" && value && typeof value === "object" && "prompt" in value) {
    const depthPrompt = value as { prompt?: unknown };
    if (typeof depthPrompt.prompt === "string") return { ...value, prompt: formatQuotes(depthPrompt.prompt) };
  }
  return value;
}

export function CharacterEditor() {
  const { t: localizeUi } = useUiTranslation();
  const characterId = useUIStore((s) => s.characterDetailId);
  const closeDetail = useUIStore((s) => s.closeCharacterDetail);
  const { data: rawCharacter, isLoading } = useCharacter(characterId);
  const updateCharacter = useUpdateCharacter();
  const uploadAvatar = useUploadAvatar();
  const removeAvatar = useRemoveAvatar();
  const deleteCharacter = useDeleteCharacter();
  const duplicateCharacter = useDuplicateCharacter();
  const createPersona = useCreatePersona();
  const uploadPersonaAvatar = useUploadPersonaAvatar();
  const { data: connectionsList } = useConnections();

  const [activeTab, setActiveTab] = useState<TabId>(
    () => (useUIStore.getState().characterDetailInitialTab as TabId | null) ?? "metadata",
  );
  const [formData, setFormData] = useState<CharacterData | null>(null);
  const [characterComment, setCharacterComment] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const loadedCharacterIdRef = useRef<string | null>(null);
  const activeCharacterIdRef = useRef<string | null>(characterId);
  const formatQuotes = useQuoteFormatter();
  const dirtyRef = useRef(false);
  const editRevisionRef = useRef(0);
  const setEditorDirty = useUIStore((s) => s.setEditorDirty);
  const lorebookEmbedInFlightRef = useRef(false);
  const [lorebookEmbedding, setLorebookEmbedding] = useState(false);
  const setDirtyState = useCallback((nextDirty: boolean) => {
    dirtyRef.current = nextDirty;
    setDirty(nextDirty);
  }, []);
  const setLorebookEmbedInFlight = useCallback((inFlight: boolean) => {
    lorebookEmbedInFlightRef.current = inFlight;
    setLorebookEmbedding(inFlight);
  }, []);
  const isLorebookEmbeddingInFlight = useCallback(() => lorebookEmbedInFlightRef.current, []);
  const markDirty = useCallback(() => {
    editRevisionRef.current += 1;
    setDirtyState(true);
  }, [setDirtyState]);
  useEffect(() => {
    dirtyRef.current = dirty;
    setEditorDirty(dirty);
  }, [dirty, setEditorDirty]);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [avatarGeneratorOpen, setAvatarGeneratorOpen] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const latestAvatarUploadRef = useRef<{ token: string; characterId: string } | null>(null);
  const avatarUploadInFlightRef = useRef(false);
  const imageGenerationAvailable =
    Array.isArray(connectionsList) &&
    (connectionsList as Array<{ provider?: string }>).some((connection) => connection.provider === "image_generation");

  useEffect(() => {
    activeCharacterIdRef.current = characterId;
    const upload = latestAvatarUploadRef.current;
    if (upload && upload.characterId !== characterId) {
      latestAvatarUploadRef.current = null;
      avatarUploadInFlightRef.current = false;
      setAvatarUploading(false);
    }
  }, [characterId]);

  // Parse the character when it first loads, or when switching characters.
  // Avoid overwriting unsaved local edits when a refetch follows avatar upload.
  useEffect(() => {
    if (!rawCharacter) return;
    const char = rawCharacter as ParsedCharacter;
    const isSwitchingCharacter = loadedCharacterIdRef.current !== char.id;
    if (!isSwitchingCharacter && dirtyRef.current) return;

    loadedCharacterIdRef.current = char.id;

    try {
      const parsed = typeof char.data === "string" ? JSON.parse(char.data) : char.data;
      setFormData(parsed as CharacterData);
      setCharacterComment(char.comment ?? "");
      setAvatarPreview(char.avatarPath);
      setDirtyState(false);
    } catch {
      setFormData(null);
      setCharacterComment("");
      setAvatarPreview(null);
      setDirtyState(false);
    }
  }, [rawCharacter, setDirtyState]);

  const updateField = useCallback(
    <K extends keyof CharacterData>(key: K, value: CharacterData[K]) => {
      const nextValue = formatCharacterFieldValue(key, value, formatQuotes);
      setFormData((prev) => (prev ? { ...prev, [key]: nextValue } : prev));
      markDirty();
    },
    [formatQuotes, markDirty],
  );

  const updateCharacterComment = useCallback(
    (value: string) => {
      setCharacterComment(value);
      markDirty();
    },
    [markDirty],
  );

  const setExtensionValue = useCallback((key: string, value: unknown) => {
    setFormData((prev) => {
      if (!prev) return prev;
      return { ...prev, extensions: { ...(prev.extensions ?? {}), [key]: value } };
    });
  }, []);

  // Embedding a lorebook into the card mutates the character server-side
  // (data.character_book + the embeddedLorebook pointer). When the editor is
  // clean, the detail-query refetch re-syncs formData for us; when it is dirty
  // the parse effect skips that re-sync, so patch formData directly — otherwise
  // a later Save would send the stale pre-embed data and silently revert it.
  const handleLorebookEmbedded = useCallback((lorebookId: string, characterBook: unknown) => {
    if (!dirtyRef.current) return;
    setFormData((prev) => {
      if (!prev) return prev;
      const extensions = { ...(prev.extensions ?? {}) } as Record<string, unknown>;
      const importMetadata = { ...((extensions.importMetadata as Record<string, unknown>) ?? {}) };
      const embeddedLorebook = { ...((importMetadata.embeddedLorebook as Record<string, unknown>) ?? {}) };
      importMetadata.embeddedLorebook = { ...embeddedLorebook, hasEmbeddedLorebook: true, lorebookId };
      extensions.importMetadata = importMetadata;
      return {
        ...prev,
        character_book: characterBook as CharacterData["character_book"],
        extensions: extensions as CharacterData["extensions"],
      };
    });
  }, []);

  // "Remove from card" clears the embedded lorebook server-side
  // (data.character_book + the embeddedLorebook pointer) immediately. Mirror
  // handleLorebookEmbedded's reconciliation: when the editor is clean the
  // detail-query refetch re-syncs formData for us; when it is dirty the parse
  // effect skips that re-sync, so patch formData directly — otherwise a later
  // Save would resend the stale pre-remove data and silently re-embed it. The
  // linked standalone lorebook, if any, is left untouched.
  const handleLorebookUnembedded = useCallback(() => {
    if (lorebookEmbedInFlightRef.current) {
      toast.error(localizeUi("ui.characters.charactereditor.waitForTheEmbeddedLorebookUpdateToFinishBefore"));
      return;
    }
    if (!dirtyRef.current) return;
    setFormData((prev) => {
      if (!prev) return prev;
      const extensions = { ...(prev.extensions ?? {}) } as Record<string, unknown>;
      const importMetadata =
        extensions.importMetadata && typeof extensions.importMetadata === "object"
          ? { ...(extensions.importMetadata as Record<string, unknown>) }
          : null;
      if (importMetadata) {
        delete importMetadata.embeddedLorebook;
        extensions.importMetadata = importMetadata;
      }
      return {
        ...prev,
        character_book: null,
        extensions: extensions as CharacterData["extensions"],
      };
    });
  }, [localizeUi]);

  const updateExtension = useCallback(
    (key: string, value: unknown) => {
      setExtensionValue(key, formatCharacterExtensionValue(key, value, formatQuotes));
      markDirty();
    },
    [formatQuotes, markDirty, setExtensionValue],
  );

  const beginAvatarUpload = useCallback(() => {
    if (avatarUploadInFlightRef.current) return false;
    avatarUploadInFlightRef.current = true;
    setAvatarUploading(true);
    return true;
  }, []);

  const isCurrentAvatarUpload = useCallback((uploadToken: string, uploadCharacterId: string) => {
    const upload = latestAvatarUploadRef.current;
    return (
      upload?.token === uploadToken &&
      upload.characterId === uploadCharacterId &&
      activeCharacterIdRef.current === uploadCharacterId
    );
  }, []);

  const finishAvatarUpload = useCallback((uploadToken: string, uploadCharacterId: string) => {
    const upload = latestAvatarUploadRef.current;
    if (upload?.token !== uploadToken || upload.characterId !== uploadCharacterId) return;
    latestAvatarUploadRef.current = null;
    avatarUploadInFlightRef.current = false;
    setAvatarUploading(false);
  }, []);

  const handleSave = async () => {
    if (!characterId || !formData) return false;
    if (avatarUploadInFlightRef.current) {
      toast.error(localizeUi("ui.characters.charactereditor.waitForTheCurrentAvatarUploadToFinishBefore"));
      return false;
    }
    if (lorebookEmbedInFlightRef.current) {
      toast.error(localizeUi("ui.characters.charactereditor.waitForTheEmbeddedLorebookUpdateToFinishBefore_5148080"));
      return false;
    }
    setSaving(true);
    const editRevisionAtSaveStart = editRevisionRef.current;
    try {
      await updateCharacter.mutateAsync({
        id: characterId,
        data: formData as unknown as Record<string, unknown>,
        comment: characterComment,
      });
      if (editRevisionRef.current === editRevisionAtSaveStart) {
        setDirtyState(false);
      }
      return true;
    } catch (err: any) {
      console.error("[CharacterEditor] Save failed:", err);
      toast.error(
        err?.message ?? localizeUi("ui.characters.charactereditor.failedToSaveCharacterCheckTheConsoleForDetails"),
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !characterId) return;
    if (saving) {
      e.target.value = "";
      toast.error(localizeUi("ui.characters.charactereditor.waitForTheCurrentSaveToFinishBeforeUploading"));
      return;
    }
    if (!beginAvatarUpload()) {
      e.target.value = "";
      toast.error(localizeUi("ui.characters.charactereditor.waitForTheCurrentAvatarUploadToFinish"));
      return;
    }

    const uploadCharacterId = characterId;
    const uploadToken = generateClientId();
    latestAvatarUploadRef.current = { token: uploadToken, characterId: uploadCharacterId };
    const fallbackAvatarPreview = avatarPreview;
    const fallbackAvatarCrop = formData?.extensions.avatarCrop;
    const shouldClearAvatarCrop = fallbackAvatarCrop !== undefined;
    const fallbackDirty = dirtyRef.current;
    const editRevisionAtUploadStart = editRevisionRef.current;

    const reader = new FileReader();
    reader.onload = async () => {
      if (!isCurrentAvatarUpload(uploadToken, uploadCharacterId)) return;
      const dataUrl = reader.result as string;
      setAvatarPreview(dataUrl);
      // Clear any saved avatarCrop — the new image almost certainly has different
      // framing, so the prior normalized crop coords are meaningless and would
      // produce a stale framing on the new file.
      if (shouldClearAvatarCrop) {
        setExtensionValue("avatarCrop", null);
      }
      if (fallbackDirty || shouldClearAvatarCrop) {
        setDirtyState(true);
      }
      try {
        await uploadAvatar.mutateAsync({ id: uploadCharacterId, avatar: dataUrl });
      } catch {
        if (!isCurrentAvatarUpload(uploadToken, uploadCharacterId)) return;
        setAvatarPreview(fallbackAvatarPreview);
        if (shouldClearAvatarCrop) {
          setExtensionValue("avatarCrop", fallbackAvatarCrop);
        }
        if (editRevisionRef.current === editRevisionAtUploadStart) {
          setDirtyState(fallbackDirty);
        }
      } finally {
        finishAvatarUpload(uploadToken, uploadCharacterId);
      }
    };
    reader.onerror = () => {
      if (!isCurrentAvatarUpload(uploadToken, uploadCharacterId)) return;
      toast.error(localizeUi("ui.characters.charactereditor.failedToReadAvatarImage"));
      finishAvatarUpload(uploadToken, uploadCharacterId);
    };
    e.target.value = "";
    try {
      reader.readAsDataURL(file);
    } catch {
      toast.error(localizeUi("ui.characters.charactereditor.failedToReadAvatarImage"));
      finishAvatarUpload(uploadToken, uploadCharacterId);
    }
  };

  const handleGeneratedAvatar = useCallback(
    async (avatarDataUrl: string) => {
      if (!characterId) return;
      if (saving) {
        throw new Error("Wait for the current save to finish before uploading an avatar.");
      }
      if (!beginAvatarUpload()) {
        throw new Error("Wait for the current avatar upload to finish.");
      }
      const uploadCharacterId = characterId;
      const uploadToken = generateClientId();
      latestAvatarUploadRef.current = { token: uploadToken, characterId: uploadCharacterId };
      const fallbackAvatarPreview = avatarPreview;
      const fallbackAvatarCrop = formData?.extensions.avatarCrop;
      const shouldClearAvatarCrop = fallbackAvatarCrop !== undefined;
      const fallbackDirty = dirtyRef.current;
      const editRevisionAtUploadStart = editRevisionRef.current;

      setAvatarPreview(avatarDataUrl);
      if (shouldClearAvatarCrop) {
        setExtensionValue("avatarCrop", null);
      }
      if (fallbackDirty || shouldClearAvatarCrop) {
        setDirtyState(true);
      }
      try {
        await uploadAvatar.mutateAsync({ id: uploadCharacterId, avatar: avatarDataUrl });
        if (isCurrentAvatarUpload(uploadToken, uploadCharacterId)) {
          toast.success(localizeUi("ui.characters.charactereditor.characterAvatarGenerated"));
        }
      } catch (error) {
        if (isCurrentAvatarUpload(uploadToken, uploadCharacterId)) {
          setAvatarPreview(fallbackAvatarPreview);
          if (shouldClearAvatarCrop) {
            setExtensionValue("avatarCrop", fallbackAvatarCrop);
          }
          if (editRevisionRef.current === editRevisionAtUploadStart) {
            setDirtyState(fallbackDirty);
          }
        }
        throw error;
      } finally {
        finishAvatarUpload(uploadToken, uploadCharacterId);
      }
    },
    [
      avatarPreview,
      beginAvatarUpload,
      characterId,
      finishAvatarUpload,
      formData?.extensions.avatarCrop,
      isCurrentAvatarUpload,
      saving,
      setDirtyState,
      setExtensionValue,
      uploadAvatar,
      localizeUi,
    ],
  );

  const handleAvatarRemove = useCallback(async () => {
    if (!characterId || !avatarPreview) return;
    if (saving) {
      toast.error(localizeUi("ui.characters.charactereditor.waitForTheCurrentSaveToFinishBeforeRemoving"));
      return;
    }
    if (avatarUploadInFlightRef.current) {
      toast.error(localizeUi("ui.characters.charactereditor.waitForTheCurrentAvatarUploadToFinishBefore_bee1ef8"));
      return;
    }

    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.characters.charactereditor.removeAvatar"),
      message: localizeUi("ui.characters.charactereditor.removeTheAvatarFromValue1ThisClearsTheCharacter", {
        value1: formData?.name || localizeUi("ui.characters.charactereditor.thisCharacter"),
      }),
      confirmLabel: localizeUi("settings.notifications.customSound.actions.remove"),
      tone: "destructive",
    });
    if (!confirmed) return;

    try {
      await removeAvatar.mutateAsync(characterId);
      setAvatarPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success(localizeUi("ui.characters.charactereditor.avatarRemoved"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.characters.charactereditor.failedToRemoveAvatar"),
      );
    }
  }, [avatarPreview, characterId, formData?.name, removeAvatar, saving, localizeUi]);

  const handleDelete = async () => {
    if (!characterId) return;
    if (
      !(await showConfirmDialog({
        title: localizeUi("ui.characters.charactereditor.deleteCharacter_07d0983"),
        message: localizeUi("dialog.delete.namedPermanent", {
          name:
            getPersistedCharacterName(rawCharacter as ParsedCharacter | undefined) ||
            localizeUi("ui.characters.charactereditor.thisCharacter"),
        }),
        confirmLabel: localizeUi("lorebook.editor.batch.delete"),
        tone: "destructive",
      }))
    ) {
      return;
    }
    await deleteCharacter.mutateAsync(characterId);
    closeDetail();
  };

  const getAvatarDataUrl = useCallback(async (src: string) => {
    if (src.startsWith("data:")) return src;

    const response = await fetch(src);
    if (!response.ok) {
      throw new Error("Failed to read character avatar");
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

  const handleImportAsPersona = useCallback(async () => {
    if (!formData) return;

    const personaName = formData.name.trim();
    if (!personaName) {
      toast.error(localizeUi("ui.characters.charactereditor.characterNeedsANameBeforeItCanBeImported"));
      return;
    }

    const rpgStats = formData.extensions.rpgStats as RPGStatsConfig | undefined;
    const personaStats = rpgStats
      ? JSON.stringify({
          enabled: !!rpgStats.enabled,
          bars: [
            { name: "Satiety", value: 100, max: 100, color: "#f59e0b" },
            { name: "Energy", value: 100, max: 100, color: "#22c55e" },
            { name: "Hygiene", value: 100, max: 100, color: "#3b82f6" },
            { name: "Mood", value: 100, max: 100, color: "#eab308" },
          ],
          rpgStats,
        })
      : "";

    try {
      const created = (await createPersona.mutateAsync({
        name: personaName,
        comment: formData.creator_notes ?? "",
        creator: formData.creator ?? "",
        personaVersion: formData.character_version ?? "1.0",
        creatorNotes: formData.creator_notes ?? "",
        description: formData.description ?? "",
        personality: formData.personality ?? "",
        scenario: formData.scenario ?? "",
        backstory: (formData.extensions.backstory as string) ?? "",
        appearance: (formData.extensions.appearance as string) ?? "",
        nameColor: (formData.extensions.nameColor as string) ?? "",
        dialogueColor: (formData.extensions.dialogueColor as string) ?? "",
        boxColor: (formData.extensions.boxColor as string) ?? "",
        trackerCardColors: serializeTrackerCardColorConfig(
          parseTrackerCardColorConfig(formData.extensions.trackerCardColors),
        ),
        personaStats,
        tags: JSON.stringify(formData.tags ?? []),
      })) as { id?: string };

      const personaId = created?.id;
      if (!personaId) {
        throw new Error("Persona was created without an id");
      }

      if (avatarPreview) {
        try {
          const avatarDataUrl = await getAvatarDataUrl(avatarPreview);
          const extMatch = avatarDataUrl.match(/^data:image\/([\w+]+)/);
          const ext = extMatch?.[1]?.replace("+xml", "") || "png";
          await uploadPersonaAvatar.mutateAsync({
            id: personaId,
            avatar: avatarDataUrl,
            filename: `persona-${personaId}-${Date.now()}.${ext}`,
          });
        } catch (error) {
          console.warn("[CharacterEditor] Failed to copy avatar to imported persona:", error);
          toast.error(localizeUi("ui.characters.charactereditor.personaImportedButTheAvatarCouldNotBeCopied"));
          return;
        }
      }

      toast.success(localizeUi("ui.characters.charactereditor.importedValue1AsAPersona", { value1: personaName }));
    } catch (error) {
      console.error("[CharacterEditor] Failed to import character as persona:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : localizeUi("ui.characters.charactereditor.failedToImportCharacterAsPersona"),
      );
    }
  }, [avatarPreview, createPersona, formData, getAvatarDataUrl, uploadPersonaAvatar, localizeUi]);

  const handleClose = useCallback(() => {
    if (avatarUploading) {
      toast.error(localizeUi("ui.characters.charactereditor.waitForTheCurrentAvatarUploadToFinish"));
      return;
    }
    if (lorebookEmbedding) {
      toast.error(localizeUi("ui.characters.lorebooktab.waitForTheEmbeddedLorebookUpdateToFinish"));
      return;
    }
    if (dirty) {
      setShowUnsavedWarning(true);
      return;
    }
    closeDetail();
  }, [avatarUploading, dirty, closeDetail, lorebookEmbedding, localizeUi]);

  const forceClose = useCallback(() => {
    if (avatarUploading) {
      toast.error(localizeUi("ui.characters.charactereditor.waitForTheCurrentAvatarUploadToFinish"));
      return;
    }
    if (lorebookEmbedding) {
      toast.error(localizeUi("ui.characters.lorebooktab.waitForTheEmbeddedLorebookUpdateToFinish"));
      return;
    }
    setShowUnsavedWarning(false);
    setDirtyState(false);
    closeDetail();
  }, [avatarUploading, closeDetail, lorebookEmbedding, setDirtyState, localizeUi]);

  const addTag = () => {
    if (!formData) return;
    const nextTags = appendNewTags(formData.tags, newTag);
    if (nextTags === formData.tags) return;
    updateField("tags", nextTags);
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    if (!formData) return;
    updateField(
      "tags",
      formData.tags.filter((t) => t !== tag),
    );
  };

  const removeAllTags = () => {
    if (!formData || formData.tags.length === 0) return;
    updateField("tags", []);
  };

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
  const saveDisabled = !dirty || saving || avatarUploading || lorebookEmbedding;
  const saveLabel = avatarUploading ? "Uploading…" : lorebookEmbedding ? "Embedding…" : saving ? "Saving…" : "Save";
  const saveButtonClass = cn(
    "mari-editor-action mari-editor-action--primary mari-editor-action--save inline-flex",
    saveDisabled && "cursor-not-allowed opacity-50",
  );

  const headerActions = (
    <>
      <button
        type="button"
        onClick={() => updateExtension("fav", !formData.extensions.fav)}
        data-character-favorite-toggle
        data-favorite={formData.extensions.fav ? "true" : "false"}
        className="mari-editor-action mari-editor-action--favorite inline-flex"
        title={
          formData.extensions.fav
            ? localizeUi("ui.characters.charactereditor.removeFromFavorites")
            : localizeUi("ui.characters.charactereditor.addToFavorites")
        }
      >
        {formData.extensions.fav ? <Star size="1rem" fill="currentColor" /> : <StarOff size="1rem" />}
      </button>

      <button
        type="button"
        onClick={() => setExportDialogOpen(true)}
        className={headerActionButtonClass}
        title={localizeUi("ui.characters.charactereditor.exportCharacter")}
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
        onClick={handleImportAsPersona}
        disabled={createPersona.isPending || uploadPersonaAvatar.isPending}
        className="mari-editor-action inline-flex disabled:cursor-not-allowed disabled:opacity-50"
        title={localizeUi("ui.characters.charactereditor.importCharacterAsPersona")}
      >
        {createPersona.isPending || uploadPersonaAvatar.isPending ? (
          <Loader2 size="1rem" className="animate-spin" />
        ) : (
          <UserPlus size="1rem" />
        )}
      </button>

      <button
        type="button"
        onClick={() => {
          if (!characterId) return;
          duplicateCharacter.mutate(characterId, {
            onSuccess: () => {
              toast.success(localizeUi("ui.characters.charactereditor.characterDuplicated"));
            },
          });
        }}
        className="mari-editor-action inline-flex"
        title={localizeUi("ui.characters.charactereditor.duplicateCharacter")}
      >
        <Copy size="1rem" />
      </button>

      <button
        type="button"
        onClick={handleDelete}
        className="mari-editor-action inline-flex"
        title={localizeUi("ui.characters.charactereditor.deleteCharacter")}
      >
        <Trash2 size="1rem" />
      </button>
    </>
  );

  return (
    <div className="mari-editor-shell mari-editor-legacy-bridge flex flex-1 flex-col overflow-hidden">
      <ExportFormatDialog
        open={exportDialogOpen}
        title={localizeUi("ui.characters.charactereditor.exportCharacter_cdcda78")}
        description={localizeUi(
          "ui.characters.charactereditor.nativeKeepsMarinaraMetadataSpritesGalleryImagesAndAttached",
        )}
        compatibleDescription="Exports direct Chara Card V2 JSON without the Marinara wrapper."
        showPngOption
        onClose={() => setExportDialogOpen(false)}
        onSelect={(format: ExportFormatChoice) => {
          if (!characterId) return;
          setExportDialogOpen(false);
          if (format === "compatible-png") {
            void api.download(`/characters/${characterId}/export-png`, "character.png");
          } else {
            void api.download(`/characters/${characterId}/export?format=${format}`);
          }
        }}
      />
      <AvatarGenerationModal
        open={avatarGeneratorOpen}
        title={localizeUi("ui.characters.charactereditor.generateCharacterAvatar")}
        entityName={formData.name}
        defaultAppearance={
          ((formData.extensions.appearance as string | undefined) || formData.description || formData.personality) ?? ""
        }
        defaultAvatarUrl={avatarPreview}
        onClose={() => setAvatarGeneratorOpen(false)}
        onUseAvatar={handleGeneratedAvatar}
      />

      {/* ── Header ── */}
      <div className="mari-editor-header">
        <div className="mari-editor-header-main max-md:min-w-full">
          <button
            type="button"
            onClick={handleClose}
            className="mari-editor-action inline-flex"
            title={localizeUi("ui.noodle.noodlerframe.back")}
          >
            <ArrowLeft size="1.125rem" />
          </button>

          {/* Avatar */}
          <div
            className={cn(
              "mari-editor-avatar-tile group relative",
              !avatarPreview && "mari-avatar-placeholder mari-avatar-placeholder--character",
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt={formData.name}
                className="pointer-events-none h-full w-full object-cover"
                style={getAvatarCropStyle(normalizeAvatarCrop(formData.extensions.avatarCrop))}
              />
            ) : (
              <User size="1.375rem" className="text-white" />
            )}
            <EditorAvatarTileActions
              generationAvailable={imageGenerationAvailable}
              onGenerate={() => setAvatarGeneratorOpen(true)}
            />
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="mari-editor-title-line">
              <input
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                onBlur={() => {
                  const trimmedName = formData.name.trim();
                  if (trimmedName !== formData.name) updateField("name", trimmedName);
                }}
                className="mari-editor-title-input"
                placeholder={localizeUi("ui.characters.charactereditor.characterName")}
                size={Math.max(1, Math.min(formData.name.length || 14, 80))}
              />
              <p
                className="mari-editor-meta mari-editor-byline"
                title={localizeUi("ui.characters.charactereditor.value1VValue2", {
                  value1: formData.creator
                    ? localizeUi("ui.characters.charactereditor.byValue1", { value1: formData.creator })
                    : localizeUi("ui.characters.charactereditor.noCreator"),
                  value2: formData.character_version || "1.0",
                })}
              >
                <span className="mari-editor-byline-creator">
                  {formData.creator
                    ? localizeUi("ui.characters.charactereditor.byValue1", { value1: formData.creator })
                    : localizeUi("ui.characters.charactereditor.noCreator")}
                </span>
                <span aria-hidden="true">·</span>
                <span className="mari-editor-byline-version">
                  {localizeUi("ui.characters.charactereditor.v")}
                  {formData.character_version || "1.0"}
                </span>
              </p>
            </div>
            <div className="mari-editor-secondary-line">
              <input
                value={characterComment}
                onChange={(e) => updateCharacterComment(e.target.value)}
                className="mari-editor-subtitle-input"
                placeholder={localizeUi("ui.characters.charactereditor.titleCommentEGModernAuVersion")}
              />
            </div>
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
          <p className="flex-1 text-xs font-medium text-amber-500">
            {localizeUi("ui.characters.charactereditor.youHaveUnsavedChangesCloseWithoutSaving")}
          </p>
          <button
            type="button"
            onClick={() => setShowUnsavedWarning(false)}
            className="rounded-lg px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)]"
          >
            {localizeUi("ui.characters.charactereditor.keepEditing")}
          </button>
          <button
            type="button"
            onClick={forceClose}
            disabled={avatarUploading}
            className="rounded-lg bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-500 transition-all hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {localizeUi("ui.characters.charactereditor.discardClose")}
          </button>
          <button
            type="button"
            onClick={async () => {
              if (await handleSave()) {
                closeDetail();
              }
            }}
            disabled={saving || avatarUploading}
            className="mari-editor-action mari-editor-action--primary mari-editor-action--compact inline-flex rounded-lg px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {localizeUi("ui.characters.charactereditor.saveClose")}
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
              <MetadataTab
                characterId={characterId}
                formData={formData}
                characterComment={characterComment}
                updateCharacterComment={updateCharacterComment}
                updateField={updateField}
                updateExtension={updateExtension}
                newTag={newTag}
                setNewTag={setNewTag}
                addTag={addTag}
                removeTag={removeTag}
                removeAllTags={removeAllTags}
                avatarPreview={avatarPreview}
                onSelectAvatar={() => fileInputRef.current?.click()}
                onGenerateAvatar={() => setAvatarGeneratorOpen(true)}
                imageGenerationAvailable={imageGenerationAvailable}
                avatarUploading={avatarUploading}
                onRemoveAvatar={handleAvatarRemove}
                removingAvatar={removeAvatar.isPending}
                hasUnsavedChanges={dirty}
              />
            )}
            {activeTab === "card" && (
              <CharacterCardTab formData={formData} updateField={updateField} updateExtension={updateExtension} />
            )}
            {activeTab === "convo" && (
              <ConvoTab
                formData={formData}
                updateExtension={updateExtension}
                kind="character"
                characterId={characterId ?? undefined}
              />
            )}
            {activeTab === "advanced" && (
              <AdvancedTab
                formData={formData}
                updateField={updateField}
                updateExtension={updateExtension}
                characterId={characterId}
              />
            )}
            {activeTab === "sprites" && characterId && (
              <SpritesTab
                characterId={characterId}
                characterName={formData.name}
                defaultAppearance={(formData.extensions.appearance as string) ?? formData.description}
                defaultAvatarUrl={avatarPreview}
              />
            )}
            {activeTab === "gallery" && characterId && (
              <CharacterGalleryTab characterId={characterId} characterName={formData.name} />
            )}
            {activeTab === "colors" && (
              <ColorsTab formData={formData} updateExtension={updateExtension} avatarUrl={avatarPreview} />
            )}
            {activeTab === "stats" && <StatsTab formData={formData} updateExtension={updateExtension} />}
            {activeTab === "lorebook" && (
              <LorebookTab
                characterId={characterId}
                formData={formData}
                embedding={lorebookEmbedding}
                isEmbeddingInFlight={isLorebookEmbeddingInFlight}
                onEmbedded={handleLorebookEmbedded}
                onEmbeddingChange={setLorebookEmbedInFlight}
                onUnembed={handleLorebookUnembedded}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Sub-tab components
// ──────────────────────────────────────────────

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
      <h2 className="inline-flex items-center gap-1.5 text-lg font-bold">
        {title}
        {helpText && <HelpTooltip text={helpText} side="bottom" wide={helpWide} size="0.875rem" />}
      </h2>
      {subtitle && <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{subtitle}</p>}
    </div>
  );
}

function CharacterCardTab({
  formData,
  updateField,
  updateExtension,
}: {
  formData: CharacterData;
  updateField: <K extends keyof CharacterData>(key: K, value: CharacterData[K]) => void;
  updateExtension: (key: string, value: unknown) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div>
      <SectionHeader
        title={localizeUi("editor.tabs.card")}
        subtitle={localizeUi("ui.characters.charactercardtab.writeTheCharacterSCoreCardFieldsInOne")}
        helpText={CHARACTER_CARD_HELP}
      />
      <EditorSectionJumps items={CHARACTER_CARD_SECTIONS} />
      <div className="space-y-10">
        <EditorSectionAnchor id="character-card-description">
          <CharacterDescriptionTab formData={formData} updateField={updateField} />
        </EditorSectionAnchor>
        <EditorSectionAnchor id="character-card-personality">
          <TextareaTab
            title={localizeUi("chat.settings.inlineEditor.fields.personality")}
            subtitle={localizeUi("ui.characters.charactercardtab.aConciseSummaryOfTheCharacterSPersonalityTraits")}
            helpText={CHARACTER_PERSONALITY_HELP}
            value={formData.personality}
            onChange={(v) => updateField("personality", v)}
            placeholder={localizeUi(
              "ui.characters.charactercardtab.energeticCuriousAndFiercelyLoyalSpeaksInShortBursts",
            )}
            rows={8}
          />
        </EditorSectionAnchor>
        <EditorSectionAnchor id="character-card-backstory">
          <TextareaTab
            title={localizeUi("chat.settings.inlineEditor.fields.backstory")}
            subtitle={localizeUi("ui.characters.charactercardtab.theCharacterSHistoryOriginStoryAndFormativeLife")}
            helpText={CHARACTER_BACKSTORY_HELP}
            value={(formData.extensions.backstory as string) ?? ""}
            onChange={(v) => updateExtension("backstory", v)}
            placeholder={localizeUi("ui.characters.charactercardtab.bornInASmallVillageOnTheOutskirtsOf")}
            rows={12}
          />
        </EditorSectionAnchor>
        <EditorSectionAnchor id="character-card-appearance">
          <TextareaTab
            title={localizeUi("chat.settings.inlineEditor.fields.appearance")}
            subtitle={localizeUi(
              "ui.characters.charactercardtab.detailedPhysicalDescriptionHeightBuildHairEyesClothingDistinguishing",
            )}
            helpText={CHARACTER_APPEARANCE_HELP}
            value={(formData.extensions.appearance as string) ?? ""}
            onChange={(v) => updateExtension("appearance", v)}
            placeholder={localizeUi("ui.characters.charactercardtab.tallAndWillowyWithSilverStreakedDarkHairWears")}
            rows={8}
          />
        </EditorSectionAnchor>
        <EditorSectionAnchor id="character-card-scenario">
          <TextareaTab
            title={localizeUi("chat.settings.inlineEditor.fields.scenario")}
            subtitle={localizeUi(
              "ui.characters.charactercardtab.theDefaultSettingOrSituationWhereInteractionsTakePlace",
            )}
            helpText={CHARACTER_SCENARIO_HELP}
            value={formData.scenario}
            onChange={(v) => updateField("scenario", v)}
            placeholder={localizeUi("ui.characters.charactercardtab.aBustlingPortCityDuringATradeFestivalThe")}
            rows={8}
          />
        </EditorSectionAnchor>
        <EditorSectionAnchor id="character-card-dialogue">
          <DialogueTab formData={formData} updateField={updateField} />
        </EditorSectionAnchor>
      </div>
    </div>
  );
}

function CharacterDescriptionTab({
  formData,
  updateField,
}: {
  formData: CharacterData;
  updateField: <K extends keyof CharacterData>(key: K, value: CharacterData[K]) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const selfCharacterId = useUIStore((s) => s.characterDetailId);
  return (
    <div className="mari-editor-panel space-y-3 p-3">
      <SectionHeader
        title={localizeUi("chat.settings.inlineEditor.fields.description")}
        subtitle={localizeUi("ui.characters.characterdescriptiontab.theCharacterSGeneralDescriptionThisIsSentIn")}
        helpText={CHARACTER_DESCRIPTION_HELP}
      />
      <MacroTextarea
        value={formData.description}
        onChange={(value) => updateField("description", value)}
        placeholder={localizeUi("ui.characters.characterdescriptiontab.describeWhoThisCharacterIsTheirRoleAndTheir")}
        rows={12}
        title={localizeUi("chat.settings.inlineEditor.fields.description")}
        showMarkdownPreview
        selfCharacterId={selfCharacterId}
        className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
      />
      <p className="mt-1.5 text-right text-[0.625rem] text-[var(--muted-foreground)]">
        {formData.description.length} {localizeUi("ui.noodle.noodlehome.characters")}
      </p>
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
  const { t: localizeUi } = useUiTranslation();
  const selfCharacterId = useUIStore((s) => s.characterDetailId);
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
        selfCharacterId={selfCharacterId}
        className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
      />
      <p className="mt-1.5 text-right text-[0.625rem] text-[var(--muted-foreground)]">
        {value.length} {localizeUi("ui.noodle.noodlehome.characters")}
      </p>
    </div>
  );
}

function ConvoTab({
  formData,
  updateExtension,
  kind,
  characterId,
}: {
  formData: CharacterData;
  updateExtension: (key: string, value: unknown) => void;
  kind: "character" | "persona";
  characterId?: string;
}) {
  const ext = formData.extensions;
  return (
    // Key by the edited character so transient edit state resets on switch. The
    // editor reuses this component instance while moving between characters.
    <ConvoProfileFields
      key={characterId ?? "new-character"}
      kind={kind}
      entityKey={characterId ?? "new-character"}
      baseName={formData.name}
      displayName={(ext.convoDisplayName as string) ?? ""}
      onDisplayNameChange={(v) => updateExtension("convoDisplayName", v)}
      displayNameInCard={ext.convoDisplayNameInCard === true}
      onDisplayNameInCardChange={(v) => updateExtension("convoDisplayNameInCard", v)}
      aboutMe={(ext.aboutMe as string) ?? ""}
      onAboutMeChange={(v) => updateExtension("aboutMe", v)}
      behavior={ext.convoBehavior as ConvoBehaviorConfig | undefined}
      onBehaviorChange={(b) => updateExtension("convoBehavior", b)}
      imageInstructions={(ext.conversationImageInstructions as string) ?? ""}
      onImageInstructionsChange={(value) => updateExtension("conversationImageInstructions", value)}
      applyImageInstructionsToNoodle={ext.applyConversationImageInstructionsToNoodle === true}
      onApplyImageInstructionsToNoodleChange={(value) =>
        updateExtension("applyConversationImageInstructionsToNoodle", value)
      }
    />
  );
}

function MetadataTab({
  characterId,
  formData,
  characterComment,
  updateCharacterComment,
  updateField,
  updateExtension,
  newTag,
  setNewTag,
  addTag,
  removeTag,
  removeAllTags,
  avatarPreview,
  onSelectAvatar,
  onGenerateAvatar,
  imageGenerationAvailable,
  avatarUploading,
  onRemoveAvatar,
  removingAvatar,
  hasUnsavedChanges,
}: {
  characterId: string | null;
  formData: CharacterData;
  characterComment: string;
  updateCharacterComment: (value: string) => void;
  updateField: <K extends keyof CharacterData>(key: K, value: CharacterData[K]) => void;
  updateExtension: (key: string, value: unknown) => void;
  newTag: string;
  setNewTag: (v: string) => void;
  addTag: () => void;
  removeTag: (tag: string) => void;
  removeAllTags: () => void;
  avatarPreview: string | null;
  onSelectAvatar: () => void;
  onGenerateAvatar: () => void;
  imageGenerationAvailable: boolean;
  avatarUploading: boolean;
  onRemoveAvatar: () => void;
  removingAvatar: boolean;
  hasUnsavedChanges: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  // Read existing crop in either current or legacy shape; the widget handles both
  // and writes back the current shape on first interaction.
  const savedCrop = normalizeAvatarCrop(formData.extensions.avatarCrop);

  return (
    <div className="space-y-5">
      <SectionHeader
        title={localizeUi("editor.tabs.metadata")}
        subtitle={localizeUi("ui.characters.metadatatab.basicCharacterInfoAvatarNameTitleCreatorVersionTags")}
        helpText={CHARACTER_METADATA_HELP}
      />

      <div className="space-y-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
          {t("editor.avatar.label")}
          <HelpTooltip text={t("editor.avatar.character.help")} />
        </span>
        <AvatarReplaceActions
          hasAvatar={Boolean(avatarPreview)}
          uploading={avatarUploading}
          generationAvailable={imageGenerationAvailable}
          onUpload={onSelectAvatar}
          onGenerate={onGenerateAvatar}
        />
      </div>

      {characterId && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/70 px-3 py-2">
          <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            {localizeUi("ui.characters.metadatatab.characterId")}
          </span>
          <code className="min-w-0 flex-1 break-all rounded-lg bg-[var(--background)] px-2 py-1 text-[0.6875rem] text-[var(--foreground)]">
            {characterId}
          </code>
          <button
            type="button"
            onClick={async () => {
              const copied = await copyToClipboard(characterId);
              if (copied) toast.success(localizeUi("ui.characters.metadatatab.characterIdCopied"));
              else toast.error(localizeUi("ui.characters.metadatatab.couldNotCopyTheCharacterId"));
            }}
            className="mari-editor-action inline-flex h-8 px-2 text-[0.6875rem]"
            title={localizeUi("ui.characters.metadatatab.copyCharacterId")}
          >
            <Copy size="0.75rem" />
            {localizeUi("lorebook.editor.batch.copy")}
          </button>
        </div>
      )}

      {/* Avatar Crop */}
      {avatarPreview && (
        <AvatarCropWidget
          src={avatarPreview}
          alt={formData.name}
          crop={savedCrop}
          onChange={(next) => updateExtension("avatarCrop", next)}
          onRemove={onRemoveAvatar}
          removing={removingAvatar}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 sm:col-span-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.characters.metadatatab.name")}{" "}
            <HelpTooltip text={localizeUi("ui.characters.metadatatab.theCharacterSDisplayNameThisIsWhatAppears")} />
          </span>
          <input
            value={formData.name}
            onChange={(e) => updateField("name", e.target.value)}
            onBlur={() => {
              const trimmedName = formData.name.trim();
              if (trimmedName !== formData.name) updateField("name", trimmedName);
            }}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          />
        </label>
        <label className="space-y-1.5 sm:col-span-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.characters.metadatatab.titleComment")}{" "}
            <HelpTooltip text={localizeUi("ui.characters.metadatatab.aShortNoteShownUnderTheCharacterNameIn")} />
          </span>
          <input
            value={characterComment}
            onChange={(e) => updateCharacterComment(e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
            placeholder={localizeUi("ui.characters.metadatatab.modernAuVersion")}
          />
        </label>
        <label className="space-y-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.characters.metadatatab.phoneticName")}{" "}
            <HelpTooltip
              text={localizeUi("ui.characters.metadatatab.optionalPronunciationOverrideUsedOnlyWhenThisCharacterS")}
            />
          </span>
          <input
            value={typeof formData.extensions?.phoneticName === "string" ? formData.extensions.phoneticName : ""}
            onChange={(e) => updateExtension("phoneticName", e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
            placeholder={formData.name}
          />
        </label>
        <label className="space-y-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.characters.metadatatab.creator")}{" "}
            <HelpTooltip text={localizeUi("ui.characters.metadatatab.thePersonWhoMadeThisCharacterUsefulForGiving")} />
          </span>
          <input
            value={formData.creator}
            onChange={(e) => updateField("creator", e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
            placeholder={localizeUi("ui.characters.metadatatab.yourName")}
          />
        </label>
        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.characters.metadatatab.version")}{" "}
            <HelpTooltip
              text={localizeUi("ui.characters.metadatatab.versionNumberForTrackingChangesToThisCharacterDefinition")}
            />
          </span>
          <input
            value={formData.character_version}
            onChange={(e) => updateField("character_version", e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
            placeholder="1.0"
          />
          <CharacterVersionHistoryPanel
            characterId={characterId}
            currentData={formData}
            currentComment={characterComment}
            currentAvatarPath={avatarPreview}
            hasUnsavedChanges={hasUnsavedChanges}
          />
        </div>
        <label className="space-y-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.characters.metadatatab.talkativeness")}{" "}
            <HelpTooltip text={localizeUi("ui.characters.metadatatab.howOftenThisCharacterSpeaksInGroupChats0")} />
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={formData.extensions.talkativeness}
            onChange={(e) => updateExtension("talkativeness", parseFloat(e.target.value))}
            className="w-full accent-[var(--primary)]"
          />
          <span className="text-[0.625rem] text-[var(--muted-foreground)]">
            {Math.round(formData.extensions.talkativeness * 100)}%
          </span>
        </label>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.characters.metadatatab.tags")}{" "}
            <HelpTooltip
              text={localizeUi("ui.characters.metadatatab.labelsForOrganizingCharactersUseTagsLikeFantasySci")}
            />
          </span>
          {formData.tags.length > 0 && (
            <button
              type="button"
              onClick={removeAllTags}
              className="mari-chrome-accent-surface mari-accent-animated rounded-lg border px-2.5 py-1 text-[0.6875rem] font-medium transition-colors"
            >
              {localizeUi("ui.characters.metadatatab.removeAll")}
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
                title={localizeUi("ui.characters.metadatatab.removeTagValue1", { value1: tag })}
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
            placeholder={localizeUi("ui.characters.metadatatab.addTag")}
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5 text-xs outline-none focus:border-[var(--primary)]/40"
          />
          <button
            type="button"
            onClick={addTag}
            className="mari-chrome-control mari-chrome-control--compact mari-chrome-control--selected px-3 py-1.5"
          >
            {localizeUi("ui.characters.metadatatab.add")}
          </button>
        </div>
      </div>

      {/* Creator Notes */}
      <div className="block space-y-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
          {localizeUi("ui.characters.metadatatab.creatorNotes")}{" "}
          <HelpTooltip text={localizeUi("ui.characters.metadatatab.privateNotesAboutThisCharacterTipsForUseKnown")} />
        </span>
        <MacroTextarea
          value={formData.creator_notes}
          onChange={(value) => updateField("creator_notes", value)}
          rows={4}
          title={localizeUi("ui.characters.metadatatab.creatorNotes")}
          showMarkdownPreview
          selfCharacterId={characterId}
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-sm outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          placeholder={localizeUi("ui.characters.metadatatab.notesAboutThisCharacterIntendedUseTipsForBest")}
        />
      </div>
    </div>
  );
}

const VERSION_COMPARE_FIELDS: Array<{ key: string; label: string }> = [
  { key: "name", label: "Name" },
  { key: "description", label: "Description" },
  { key: "personality", label: "Personality" },
  { key: "scenario", label: "Scenario" },
  { key: "first_mes", label: "First Message" },
  { key: "mes_example", label: "Example Dialogue" },
  { key: "extensions.backstory", label: "Backstory" },
  { key: "extensions.appearance", label: "Appearance" },
  { key: "creator_notes", label: "Creator Notes" },
  { key: "system_prompt", label: "System Prompt" },
  { key: "post_history_instructions", label: "Post-History Instructions" },
];

function getVersionFieldValue(data: CharacterData, key: string): string {
  if (key === "extensions.backstory" || key === "extensions.appearance") {
    const extensionKey = key.split(".")[1] ?? "";
    const value = data.extensions?.[extensionKey];
    return typeof value === "string" ? value : "";
  }
  const value = data[key as keyof CharacterData];
  if (Array.isArray(value)) return value.join(", ");
  return typeof value === "string" ? value : "";
}

function CharacterVersionHistoryPanel({
  characterId,
  currentData,
  currentComment,
  currentAvatarPath,
  hasUnsavedChanges,
}: {
  characterId: string | null;
  currentData: CharacterData;
  currentComment: string;
  currentAvatarPath: string | null;
  hasUnsavedChanges: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { data: versions = [], isLoading } = useCharacterVersions(characterId);
  const restoreVersion = useRestoreCharacterVersion();
  const deleteVersion = useDeleteCharacterVersion();
  const renameVersion = useRenameCharacterVersion();
  const resetVersions = useResetCharacterVersions();
  const [selectedVersion, setSelectedVersion] = useState<CharacterCardVersion | null>(null);
  const savedVersionCount = versions.filter((version) => !version.isCurrent).length;
  const getVersionTitle = (version: CharacterCardVersion) => getCardVersionTitle(version, localizeUi);
  const versionMutationPending =
    restoreVersion.isPending || deleteVersion.isPending || renameVersion.isPending || resetVersions.isPending;

  if (!characterId) return null;

  const handleRestore = async (version: CharacterCardVersion) => {
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.characters.characterversionhistorypanel.restoreCharacterVersion"),
      message: localizeUi("ui.characters.characterversionhistorypanel.restoreValue1ToValue2TheCurrentCardWillBecome", {
        value1: currentData.name || localizeUi("ui.characters.charactereditor.thisCharacter"),
        value2: getVersionTitle(version),
      }),
      confirmLabel: localizeUi("ui.chat.databaseworkspaceapprovalcard.restore"),
    });
    if (!confirmed) return;
    try {
      await restoreVersion.mutateAsync({ id: characterId, versionId: version.id });
      toast.success(
        localizeUi("ui.characters.characterversionhistorypanel.restoredValue1", { value1: getVersionTitle(version) }),
      );
      setSelectedVersion(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : localizeUi("ui.characters.characterversionhistorypanel.failedToRestoreCharacterVersion"),
      );
    }
  };

  const handleDeleteVersion = async (version: CharacterCardVersion) => {
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.characters.characterversionhistorypanel.deleteSavedVersion"),
      message: localizeUi(
        "ui.characters.characterversionhistorypanel.deleteValue1FromVersionHistoryThisDoesNotChange",
        { value1: getVersionTitle(version) },
      ),
      confirmLabel: localizeUi("lorebook.editor.batch.delete"),
      tone: "destructive",
    });
    if (!confirmed) return;
    try {
      await deleteVersion.mutateAsync({ id: characterId, versionId: version.id });
      toast.success(
        localizeUi("ui.characters.characterversionhistorypanel.deletedValue1", { value1: getVersionTitle(version) }),
      );
      setSelectedVersion((current) => (current?.id === version.id ? null : current));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : localizeUi("ui.characters.characterversionhistorypanel.failedToDeleteCharacterVersion"),
      );
    }
  };

  const handleRenameVersion = async (version: CharacterCardVersion) => {
    const nextVersion = await showPromptDialog({
      title: localizeUi("ui.cardversionhistory.renameVersion"),
      message: localizeUi("ui.cardversionhistory.renameVersionMessage", {
        value1: getVersionTitle(version),
      }),
      defaultValue: version.version,
      placeholder: localizeUi("ui.cardversionhistory.versionPlaceholder"),
      confirmLabel: localizeUi("ui.cardversionhistory.save"),
      tone: "accent",
    });
    const trimmedVersion = nextVersion?.trim();
    if (!trimmedVersion || trimmedVersion === version.version) return;
    try {
      await renameVersion.mutateAsync({ id: characterId, versionId: version.id, version: trimmedVersion });
      toast.success(
        localizeUi("ui.cardversionhistory.renamedVersion", {
          value1: getVersionTitle(version),
          value2: trimmedVersion,
        }),
      );
      setSelectedVersion(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localizeUi("ui.cardversionhistory.failedToRenameVersion"));
    }
  };

  const handleResetVersions = async () => {
    const characterName = currentData.name || localizeUi("ui.characters.charactereditor.thisCharacter");
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.cardversionhistory.resetVersioningForValue1", { value1: characterName }),
      message: localizeUi("ui.cardversionhistory.resetVersioningMessage", { value1: characterName }),
      confirmLabel: localizeUi("ui.cardversionhistory.reset"),
      tone: "destructive",
    });
    if (!confirmed) return;
    try {
      await resetVersions.mutateAsync(characterId);
      toast.success(localizeUi("ui.cardversionhistory.resetVersioningSuccess", { value1: characterName }));
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
          {localizeUi("ui.characters.characterversionhistorypanel.versionHistory")}
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
              ? localizeUi("ui.characters.characterversionhistorypanel.loading")
              : localizeUi("ui.characters.characterversionhistorypanel.value1Saved", { value1: savedVersionCount })}
          </span>
        </div>
      </div>

      {versions.length === 0 ? (
        <p className="mt-2 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
          {localizeUi("ui.characters.characterversionhistorypanel.previousCardStatesWillAppearHereAfterTheNext")}
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
                    : localizeUi("ui.characters.characterversionhistorypanel.compareWithCurrentCard")
                }
              >
                <span className="block truncate text-[0.6875rem] font-medium text-[var(--foreground)]">
                  {getVersionTitle(version)}
                </span>
                <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                  {formatCardVersionTimestamp(version.createdAt)}
                  {!version.isCurrent && version.source
                    ? localizeUi("ui.characters.characterversionhistorypanel.value1", { value1: version.source })
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
                    title={localizeUi("ui.characters.characterversionhistorypanel.restoreThisVersion")}
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
                    title={localizeUi("ui.characters.characterversionhistorypanel.deleteThisSavedVersion")}
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
            ? localizeUi("ui.characters.characterversionhistorypanel.compareValue1", {
                value1: getVersionTitle(selectedVersion),
              })
            : localizeUi("ui.characters.characterversionhistorypanel.compareVersion")
        }
        width="max-w-5xl"
      >
        {selectedVersion && (
          <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto">
            <div className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-xs md:grid-cols-2">
              <div>
                <p className="font-semibold text-[var(--foreground)]">
                  {localizeUi("ui.characters.characterversionhistorypanel.currentCard")}
                </p>
                <p className="mt-1 text-[var(--muted-foreground)]">
                  {localizeUi("ui.characters.charactereditor.v")}
                  {currentData.character_version || "1.0"}
                  {currentComment
                    ? localizeUi("ui.characters.characterversionhistorypanel.value1", { value1: currentComment })
                    : ""}
                  {currentAvatarPath ? localizeUi("ui.characters.characterversionhistorypanel.hasAvatar") : ""}
                </p>
              </div>
              <div>
                <p className="font-semibold text-[var(--foreground)]">{getVersionTitle(selectedVersion)}</p>
                <p className="mt-1 text-[var(--muted-foreground)]">
                  {formatCardVersionTimestamp(selectedVersion.createdAt)}
                  {selectedVersion.reason
                    ? localizeUi("ui.characters.characterversionhistorypanel.value1", {
                        value1: selectedVersion.reason,
                      })
                    : ""}
                  {selectedVersion.avatarPath ? localizeUi("ui.characters.characterversionhistorypanel.hasAvatar") : ""}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {VERSION_COMPARE_FIELDS.map((field) => {
                const currentValue = getVersionFieldValue(currentData, field.key);
                const savedValue = getVersionFieldValue(selectedVersion.data, field.key);
                const changed = currentValue !== savedValue;
                if (!changed && !currentValue && !savedValue) return null;
                return (
                  <div key={field.key} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--foreground)]">{field.label}</span>
                      {changed && (
                        <span className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[0.625rem] font-medium text-[var(--primary)]">
                          {localizeUi("ui.characters.characterversionhistorypanel.changed")}
                        </span>
                      )}
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="min-h-20 min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-lg bg-[var(--secondary)] p-2 text-xs leading-relaxed text-[var(--foreground)]">
                        {currentValue || (
                          <span className="text-[var(--muted-foreground)]">
                            {localizeUi("ui.characters.characterversionhistorypanel.empty")}
                          </span>
                        )}
                      </div>
                      <div className="min-h-20 min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-lg bg-[var(--secondary)] p-2 text-xs leading-relaxed text-[var(--foreground)]">
                        {savedValue || (
                          <span className="text-[var(--muted-foreground)]">
                            {localizeUi("ui.characters.characterversionhistorypanel.empty")}
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
                {localizeUi("ui.characters.characterversionhistorypanel.restoreThisVersion")}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function DialogueTab({
  formData,
  updateField,
}: {
  formData: CharacterData;
  updateField: <K extends keyof CharacterData>(key: K, value: CharacterData[K]) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const selfCharacterId = useUIStore((s) => s.characterDetailId);
  const greetingKeysRef = useRef<string[]>([]);

  while (greetingKeysRef.current.length < formData.alternate_greetings.length) {
    greetingKeysRef.current.push(generateClientId());
  }
  if (greetingKeysRef.current.length > formData.alternate_greetings.length) {
    greetingKeysRef.current.length = formData.alternate_greetings.length;
  }

  const addGreeting = () => {
    greetingKeysRef.current.push(generateClientId());
    updateField("alternate_greetings", [...formData.alternate_greetings, ""]);
  };

  const updateGreeting = (i: number, value: string) => {
    const copy = [...formData.alternate_greetings];
    copy[i] = value;
    updateField("alternate_greetings", copy);
  };

  const removeGreeting = (i: number) => {
    greetingKeysRef.current.splice(i, 1);
    updateField(
      "alternate_greetings",
      formData.alternate_greetings.filter((_, idx) => idx !== i),
    );
  };

  const moveGreeting = (i: number, offset: -1 | 1) => {
    const nextIndex = i + offset;
    if (nextIndex < 0 || nextIndex >= formData.alternate_greetings.length) return;

    const nextGreetings = [...formData.alternate_greetings];
    const [movedGreeting] = nextGreetings.splice(i, 1);
    nextGreetings.splice(nextIndex, 0, movedGreeting ?? "");

    const nextKeys = [...greetingKeysRef.current];
    const [movedKey] = nextKeys.splice(i, 1);
    nextKeys.splice(nextIndex, 0, movedKey ?? generateClientId());
    greetingKeysRef.current = nextKeys;

    updateField("alternate_greetings", nextGreetings);
  };

  const greetingActionButtonClassName =
    "mari-editor-action mari-editor-action--compact inline-flex h-8 w-8 rounded-lg p-0 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="space-y-6">
      <SectionHeader
        title={localizeUi("ui.characters.dialoguetab.dialogueGreetings")}
        subtitle={localizeUi("ui.characters.dialoguetab.firstMessageExampleDialogueAndAlternateGreetings")}
        helpText={CHARACTER_DIALOGUE_HELP}
      />

      {/* First Message */}
      <div className="block space-y-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
          {localizeUi("ui.characters.dialoguetab.firstMessage")}{" "}
          <HelpTooltip text={localizeUi("ui.characters.dialoguetab.theCharacterSOpeningMessageWhenANewChat")} />
        </span>
        <MacroTextarea
          value={formData.first_mes}
          onChange={(value) => updateField("first_mes", value)}
          rows={6}
          title={localizeUi("ui.characters.dialoguetab.firstMessage")}
          showMarkdownPreview
          selfCharacterId={selfCharacterId}
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 text-sm leading-relaxed outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          placeholder={localizeUi("ui.characters.dialoguetab.whatIsTheCharacterSFirstMessageWhenA")}
        />
      </div>

      {/* Alternate Greetings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.characters.dialoguetab.alternateGreetings")}
            {formData.alternate_greetings.length})
            <HelpTooltip
              text={localizeUi("ui.characters.dialoguetab.alternativeFirstMessagesForVarietyWhenStartingANew")}
            />
          </span>
          <button
            type="button"
            onClick={addGreeting}
            className="mari-editor-action mari-editor-action--accent mari-editor-action--compact inline-flex rounded-lg px-3 py-1 text-xs"
          >
            {localizeUi("ui.characters.dialoguetab.add")}
          </button>
        </div>
        {formData.alternate_greetings.map((g, i) => (
          <div
            key={greetingKeysRef.current[i] ?? i}
            className="space-y-2 rounded-xl border border-[var(--border)]/70 bg-[var(--background)]/35 p-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--muted-foreground)]">
                {localizeUi("ui.characters.dialoguetab.greeting")}
                {i + 1}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveGreeting(i, -1)}
                  disabled={i === 0}
                  className={greetingActionButtonClassName}
                  aria-label={localizeUi("ui.characters.dialoguetab.moveAlternateGreetingValue1Up", { value1: i + 1 })}
                  title={localizeUi("ui.characters.dialoguetab.moveUp")}
                >
                  <ArrowUp size="0.75rem" />
                </button>
                <button
                  type="button"
                  onClick={() => moveGreeting(i, 1)}
                  disabled={i === formData.alternate_greetings.length - 1}
                  className={greetingActionButtonClassName}
                  aria-label={localizeUi("ui.characters.dialoguetab.moveAlternateGreetingValue1Down", {
                    value1: i + 1,
                  })}
                  title={localizeUi("ui.characters.dialoguetab.moveDown")}
                >
                  <ArrowDown size="0.75rem" />
                </button>
                <button
                  type="button"
                  onClick={() => removeGreeting(i)}
                  className={cn(greetingActionButtonClassName, "mari-editor-action--danger")}
                  aria-label={localizeUi("ui.characters.dialoguetab.removeAlternateGreetingValue1", { value1: i + 1 })}
                  title={localizeUi("ui.characters.dialoguetab.removeGreeting")}
                >
                  <Trash2 size="0.75rem" />
                </button>
              </div>
            </div>
            <MacroTextarea
              value={g}
              onChange={(value) => updateGreeting(i, value)}
              rows={3}
              title={localizeUi("ui.characters.dialoguetab.alternateGreetingValue1", { value1: i + 1 })}
              showMarkdownPreview
              selfCharacterId={selfCharacterId}
              className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-sm outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40"
              placeholder={localizeUi("ui.characters.dialoguetab.greetingValue1", { value1: i + 1 })}
            />
          </div>
        ))}
      </div>

      {/* Example Messages */}
      <div className="block space-y-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
          {localizeUi("chat.settings.inlineEditor.fields.exampleDialogue")}{" "}
          <HelpTooltip
            text={localizeUi("ui.characters.dialoguetab.sampleConversationsShowingHowTheCharacterTalksHelpsThe")}
          />
        </span>
        <p className="text-[0.625rem] text-[var(--muted-foreground)]/70">
          {localizeUi("ui.characters.dialoguetab.useStartToSeparateExchangesUseUserAndChar")}
        </p>
        <MacroTextarea
          value={formData.mes_example}
          onChange={(value) => updateField("mes_example", value)}
          rows={10}
          title={localizeUi("chat.settings.inlineEditor.fields.exampleDialogue")}
          showMarkdownPreview
          selfCharacterId={selfCharacterId}
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 font-mono text-xs leading-relaxed outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          placeholder={localizeUi("ui.characters.dialoguetab.startUserHelloCharWavesExcitedlyHeyThere")}
        />
      </div>
    </div>
  );
}

function AdvancedTab({
  formData,
  updateField,
  updateExtension,
  characterId,
}: {
  formData: CharacterData;
  updateField: <K extends keyof CharacterData>(key: K, value: CharacterData[K]) => void;
  updateExtension: (key: string, value: unknown) => void;
  characterId: string | null;
}) {
  const { t: localizeUi } = useUiTranslation();
  const depthPrompt = formData.extensions.depth_prompt ?? { prompt: "", depth: 4, role: "system" as const };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={localizeUi("settings.tabs.advanced.label")}
        subtitle={localizeUi("ui.characters.advancedtab.systemPromptPostHistoryInstructionsAndDepthPromptInjection")}
        helpText={CHARACTER_ADVANCED_HELP}
      />

      <div className="block space-y-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
          {localizeUi("ui.characters.advancedtab.systemPrompt")}{" "}
          <HelpTooltip
            text={localizeUi("ui.characters.advancedtab.characterSpecificInstructionsInsertedByThePromptPresetS")}
          />
        </span>
        <MacroTextarea
          value={formData.system_prompt}
          onChange={(value) => updateField("system_prompt", value)}
          rows={6}
          title={localizeUi("ui.characters.advancedtab.systemPrompt")}
          showMarkdownPreview
          selfCharacterId={characterId}
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 text-sm outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          placeholder={localizeUi(
            "ui.characters.advancedtab.characterSpecificInstructionsInsertedThroughCharsysinfoOrTheCharacter",
          )}
        />
      </div>

      <div className="block space-y-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
          {localizeUi("ui.characters.advancedtab.postHistoryInstructions")}{" "}
          <HelpTooltip text={localizeUi("ui.characters.advancedtab.textInsertedAfterTheChatHistoryRightBeforeThe")} />
        </span>
        <MacroTextarea
          value={formData.post_history_instructions}
          onChange={(value) => updateField("post_history_instructions", value)}
          rows={4}
          title={localizeUi("ui.characters.advancedtab.postHistoryInstructions")}
          showMarkdownPreview
          selfCharacterId={characterId}
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 text-sm outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          placeholder={localizeUi("ui.characters.advancedtab.textInsertedAfterTheChatHistoryButBeforeGeneration")}
        />
      </div>

      {/* Depth Prompt */}
      <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <span className="inline-flex items-center gap-1 text-xs font-semibold">
          {localizeUi("ui.characters.advancedtab.depthPrompt")}{" "}
          <HelpTooltip text={localizeUi("ui.characters.advancedtab.injectsTextAtASpecificPositionInTheChat")} />
        </span>
        <MacroTextarea
          value={depthPrompt.prompt}
          onChange={(value) => updateExtension("depth_prompt", { ...depthPrompt, prompt: value })}
          rows={4}
          title={localizeUi("ui.characters.advancedtab.depthPrompt")}
          showMarkdownPreview
          selfCharacterId={characterId}
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-sm outline-none focus:border-[var(--primary)]/40"
          placeholder={localizeUi("ui.characters.advancedtab.promptInjectedAtASpecificDepthInTheChat")}
        />
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-xs">
            <span className="text-[var(--muted-foreground)]">{localizeUi("ui.characters.advancedtab.depth")}</span>
            <input
              type="number"
              min={0}
              max={100}
              value={depthPrompt.depth}
              onChange={(e) =>
                updateExtension("depth_prompt", { ...depthPrompt, depth: parseInt(e.target.value) || 0 })
              }
              className="w-16 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-center text-xs outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <span className="text-[var(--muted-foreground)]">{localizeUi("ui.characters.advancedtab.role")}</span>
            <select
              value={depthPrompt.role}
              onChange={(e) => updateExtension("depth_prompt", { ...depthPrompt, role: e.target.value })}
              className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-xs outline-none"
            >
              <option value="system">{localizeUi("ui.characters.advancedtab.system")}</option>
              <option value="user">{localizeUi("ui.characters.advancedtab.user")}</option>
              <option value="assistant">{localizeUi("ui.characters.advancedtab.assistant")}</option>
            </select>
          </label>
        </div>
      </div>

      <CharacterRegexSection characterId={characterId} characterName={formData.name} />
    </div>
  );
}

// ── Gallery Tab ──

type CharacterGalleryMediaTab = "images" | "clips";

function characterGalleryClipSourceLabel(source: CharacterGalleryClip["source"]) {
  switch (source) {
    case "conversation-call":
      return "Call presence";
    case "conversation-call-custom":
      return "Custom call clip";
    case "game-scene":
      return "Game scene";
    case "scene-video":
      return "Scene video";
    case "uploaded-video":
      return "Uploaded video";
    default:
      return "Video";
  }
}

function formatClipDate(value: string | null) {
  if (!value) return "Not generated";
  return new Date(value).toLocaleDateString();
}

function canDeleteCharacterGalleryClip(clip: CharacterGalleryClip) {
  if (clip.status === "generating") return false;
  if (clip.source === "conversation-call" && clip.status === "missing") return false;
  return true;
}

function characterGalleryClipDeleteMessage(clip: CharacterGalleryClip) {
  if (clip.source === "conversation-call") {
    return "Delete this call clip? The standard slot will stay available for regeneration or upload.";
  }
  return "Delete this clip everywhere it appears in Marinara? This cannot be undone.";
}

function isCharacterCallVideoClip(clip: CharacterGalleryClip) {
  return clip.source === "conversation-call" || clip.source === "conversation-call-custom";
}

function isCharacterGalleryVideoClip(clip: CharacterGalleryClip) {
  return !isCharacterCallVideoClip(clip);
}

function forceSilentCharacterCallClipVideo(video: HTMLVideoElement | null) {
  if (!video) return;
  if (!video.defaultMuted) video.defaultMuted = true;
  if (!video.muted) video.muted = true;
  if (video.volume !== 0) video.volume = 0;
}

function keepCharacterCallClipVideoSilent(event: SyntheticEvent<HTMLVideoElement>) {
  forceSilentCharacterCallClipVideo(event.currentTarget);
}

function readClipTrimStart(clip: Pick<CharacterGalleryClip, "trimStartSeconds">) {
  const value = clip.trimStartSeconds;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function readClipTrimEnd(clip: Pick<CharacterGalleryClip, "trimEndSeconds">) {
  const value = clip.trimEndSeconds;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function roundClipTrimSecond(value: number) {
  return Math.round(Math.max(0, value) * 1000) / 1000;
}

function seekCharacterCallClipToTrimStart(video: HTMLVideoElement, clip: CharacterGalleryClip) {
  const start = readClipTrimStart(clip);
  const end = readClipTrimEnd(clip);
  if (video.duration > 0 && end !== null && start >= end) return;
  if (video.currentTime + 0.03 < start || (end !== null && video.currentTime >= end)) {
    video.currentTime = start;
  }
}

function handleCharacterCallClipTimeUpdate(
  video: HTMLVideoElement,
  clip: CharacterGalleryClip,
  options?: { loop?: boolean },
) {
  const end = readClipTrimEnd(clip);
  if (end === null || video.currentTime < end - 0.03) return;
  const start = readClipTrimStart(clip);
  video.currentTime = start;
  if (options?.loop) {
    void video.play().catch(() => undefined);
  } else {
    video.pause();
  }
}

function formatTrimSecond(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "full";
  return `${roundClipTrimSecond(value).toFixed(2)}s`;
}

function characterClipTrimLabel(clip: CharacterGalleryClip) {
  const start = readClipTrimStart(clip);
  const end = readClipTrimEnd(clip);
  if (start <= 0 && end === null) return null;
  return `${formatTrimSecond(start)} -> ${formatTrimSecond(end)}`;
}

function CharacterGalleryTab({ characterId, characterName }: { characterId: string; characterName?: string }) {
  const { t: localizeUi } = useUiTranslation();
  const [mediaTab, setMediaTab] = useState<CharacterGalleryMediaTab>("images");
  const { data: images, isLoading } = useCharacterGalleryImages(characterId);
  const upload = useUploadCharacterGalleryImage(characterId);
  const remove = useDeleteCharacterGalleryImage(characterId);
  const setAvatar = useSetCharacterGalleryImageAsAvatar(characterId);
  const tag = useTagCharacterGalleryImage(characterId);
  const [lightbox, setLightbox] = useState<CharacterGalleryImage | null>(null);

  const handleUpload = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      upload.mutate(files);
    },
    [upload],
  );

  const handleDelete = useCallback(
    async (image: CharacterGalleryImage) => {
      if (
        !(await showConfirmDialog({
          title: localizeUi("ui.characters.charactergallerytab.deleteCharacterImage"),
          message: localizeUi("ui.characters.charactergallerytab.deleteThisCharacterGalleryImage"),
          confirmLabel: localizeUi("lorebook.editor.batch.delete"),
          tone: "destructive",
        }))
      ) {
        return;
      }
      remove.mutate(image.id);
      if (lightbox?.id === image.id) setLightbox(null);
    },
    [lightbox?.id, remove, localizeUi],
  );

  const handleSetAvatar = useCallback(
    async (image: CharacterGalleryImage) => {
      try {
        await setAvatar.mutateAsync(image.id);
        toast.success(localizeUi("ui.characters.charactergallerytab.characterAvatarUpdated"));
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : localizeUi("ui.characters.charactergallerytab.failedToUpdateCharacterAvatar"),
        );
      }
    },
    [setAvatar, localizeUi],
  );

  // Copies the PORTABLE image reference (card://self/gallery/<file>) — resolves
  // to whichever character speaks the message, so it survives export/import
  // where character ids are regenerated. Filenames round-trip in native exports.
  const handleCopyReference = useCallback(
    async (image: CharacterGalleryImage) => {
      const filename = image.filePath.split("/").pop() ?? "";
      if (!filename) return;
      const label = image.prompt.trim() || filename.replace(/\.[^.]+$/, "");
      const ok = await copyToClipboard(
        buildCardAssetMarkdown(label, `card://self/gallery/${encodeURIComponent(filename)}`),
      );
      if (ok) toast.success(localizeUi("ui.characters.charactergallerytab.referenceCopied"));
      else toast.error(localizeUi("ui.characters.charactergallerytab.failedToCopyReference"));
    },
    [localizeUi],
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title={localizeUi("ui.characters.charactergallerytab.characterGallery")}
        subtitle={localizeUi("ui.characters.charactergallerytab.keepCharacterImagesAndGeneratedVideosAttachedToThis")}
        helpText={CHARACTER_GALLERY_HELP}
      />

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
            label={localizeUi("ui.characters.charactergallerytab.uploadCharacterImages")}
            pending={upload.isPending}
            pendingLabel="Uploading…"
            dragLabel="Drop character images to upload"
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
                      alt={image.prompt || characterName || "Character image"}
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/75 via-black/25 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100">
                    <span className="max-w-[8rem] truncate text-[0.6875rem] font-medium text-white/85">
                      {new Date(image.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => void handleCopyReference(image)}
                        className="rounded-lg bg-white/15 p-1.5 text-white transition-colors hover:bg-white/25"
                        title={localizeUi("ui.characters.charactergallerytab.copyImageReference")}
                      >
                        <Link2 size="0.75rem" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSetAvatar(image)}
                        disabled={setAvatar.isPending}
                        className="rounded-lg bg-white/15 p-1.5 text-white transition-colors hover:bg-white/25 disabled:opacity-50"
                        title={localizeUi("ui.characters.charactergallerytab.setAsAvatar")}
                      >
                        {setAvatar.isPending ? (
                          <Loader2 size="0.75rem" className="animate-spin" />
                        ) : (
                          <User size="0.75rem" />
                        )}
                      </button>
                      <a
                        href={image.url}
                        download
                        className="rounded-lg bg-white/15 p-1.5 text-white transition-colors hover:bg-white/25"
                        title={localizeUi("ui.characters.charactergallerytab.download")}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download size="0.75rem" />
                      </a>
                      <button
                        type="button"
                        onClick={() => void handleDelete(image)}
                        className="rounded-lg bg-white/15 p-1.5 text-white transition-colors hover:bg-white/25"
                        title={localizeUi("lorebook.editor.batch.delete")}
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
                  {localizeUi("ui.characters.charactergallerytab.noCharacterImagesYet")}
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]/60">
                  {localizeUi("ui.characters.charactergallerytab.uploadImagesHereToKeepThemTiedTo")}{" "}
                  {characterName || "this character"}{" "}
                  {localizeUi("ui.characters.charactergallerytab.insteadOfASpecificChat")}
                </p>
              </div>
            </div>
          )}
        </>
      ) : (
        <CharacterVideosGallery characterId={characterId} characterName={characterName} />
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 max-md:pt-[env(safe-area-inset-top)]"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw] w-[min(90vw,90vh)]" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightbox.url}
              alt={lightbox.prompt || characterName || "Character image"}
              className="max-h-[85vh] w-full rounded-lg object-contain shadow-2xl"
            />
            <div className="absolute right-2 top-2 flex gap-2">
              <button
                type="button"
                onClick={() => void handleSetAvatar(lightbox)}
                disabled={setAvatar.isPending}
                className="rounded-lg bg-black/60 p-2 text-white transition-colors hover:bg-black/80 disabled:opacity-50"
                title={localizeUi("ui.characters.charactergallerytab.setAsAvatar")}
              >
                {setAvatar.isPending ? <Loader2 size="0.875rem" className="animate-spin" /> : <User size="0.875rem" />}
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

function CharacterVideosGallery({ characterId, characterName }: { characterId: string; characterName?: string }) {
  const { t: localizeUi } = useUiTranslation();
  const { data, isLoading } = useCharacterGalleryClips(characterId);
  const deleteClip = useDeleteCharacterGalleryClip(characterId);
  const uploadVideo = useUploadCharacterGalleryVideo(characterId);
  const [deletingClipId, setDeletingClipId] = useState<string | null>(null);
  const clips = (data?.clips ?? []).filter(isCharacterGalleryVideoClip);

  const handleUploadVideos = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      try {
        for (const file of files) {
          await uploadVideo.mutateAsync({ file });
        }
        toast.success(
          files.length === 1
            ? localizeUi("ui.characters.charactervideosgallery.videoUploaded")
            : localizeUi("ui.characters.charactervideosgallery.videosUploaded"),
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : localizeUi("ui.characters.charactervideosgallery.couldNotUploadVideo"),
        );
      }
    },
    [uploadVideo, localizeUi],
  );

  const handleDeleteClip = useCallback(
    async (clip: CharacterGalleryClip) => {
      if (!canDeleteCharacterGalleryClip(clip)) return;
      if (
        !(await showConfirmDialog({
          title: localizeUi("ui.characters.charactervideosgallery.deleteClip"),
          message: characterGalleryClipDeleteMessage(clip),
          confirmLabel: localizeUi("lorebook.editor.batch.delete"),
          tone: "destructive",
        }))
      ) {
        return;
      }

      setDeletingClipId(clip.id);
      try {
        await deleteClip.mutateAsync(clip.id);
        toast.success(localizeUi("ui.characters.charactervideosgallery.videoDeleted"));
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : localizeUi("ui.characters.charactervideosgallery.couldNotDeleteVideo"),
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
        label={localizeUi("ui.characters.charactervideosgallery.uploadCharacterVideos")}
        pending={uploadVideo.isPending}
        pendingLabel="Uploading…"
        dragLabel="Drop character videos to upload"
        onFilesSelected={handleUploadVideos}
        icon={<Upload size="1rem" />}
        accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
        fileKind="video"
        className="w-full"
      />

      {clips.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {clips.map((clip) => (
            <CharacterClipCard
              key={clip.id}
              clip={clip}
              characterName={characterName}
              deleting={deletingClipId === clip.id}
              generating={false}
              uploading={false}
              uploadDisabled
              generationDisabled
              onGenerate={() => undefined}
              onUpload={() => undefined}
              onDelete={handleDeleteClip}
              onEditTrim={() => undefined}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] py-12 text-center">
          <Film size="1.75rem" className="text-[var(--muted-foreground)]/40" />
          <div>
            <p className="text-sm font-medium text-[var(--muted-foreground)]">
              {localizeUi("ui.characters.charactervideosgallery.noCharacterVideosYet")}
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]/60">
              {localizeUi("ui.characters.charactervideosgallery.uploadVideosOrGenerateSceneVideosWith")}{" "}
              {characterName || "this character"}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function CharacterCallClipsGallery({ characterId, characterName }: { characterId: string; characterName?: string }) {
  const { t: localizeUi } = useUiTranslation();
  const { data, isLoading } = useCharacterGalleryClips(characterId);
  const generateCallClips = useGenerateCharacterCallVideoClips(characterId);
  const generateCustomCallClip = useGenerateCharacterCustomCallVideoClip(characterId);
  const deleteClip = useDeleteCharacterGalleryClip(characterId);
  const updateClipTrim = useUpdateCharacterGalleryClipTrim(characterId);
  const uploadClip = useUploadCharacterGalleryClip(characterId);
  const [deletingClipId, setDeletingClipId] = useState<string | null>(null);
  const [generatingClipId, setGeneratingClipId] = useState<string | null>(null);
  const [uploadingClipId, setUploadingClipId] = useState<string | null>(null);
  const [trimClip, setTrimClip] = useState<CharacterGalleryClip | null>(null);
  const [generationDialogOpen, setGenerationDialogOpen] = useState(false);
  const [generationInitialKind, setGenerationInitialKind] = useState<ConversationCallCharacterVideoClipKind | null>(
    null,
  );
  const clipUploadInputRef = useRef<HTMLInputElement | null>(null);
  const pendingClipUploadRef = useRef<{ kind: string | null; label: string | null; clipId: string } | null>(null);
  const clips = (data?.clips ?? []).filter(isCharacterCallVideoClip);
  const standardCallClips = clips.filter((clip) => clip.source === "conversation-call");
  const customCallClipCount = clips.filter((clip) => clip.source === "conversation-call-custom").length;
  const readyCallClipCount = standardCallClips.filter((clip) => clip.status === "ready").length;
  const generationLockActive =
    data?.callVideoGenerating === true ||
    clips.some((clip) => isCharacterCallVideoClip(clip) && clip.status === "generating") ||
    generateCallClips.isPending ||
    generateCustomCallClip.isPending;
  const batchGenerationPending =
    (generateCallClips.isPending || generateCustomCallClip.isPending) && generatingClipId === null;

  const openGenerationDialog = useCallback((clip?: CharacterGalleryClip) => {
    const kind =
      clip?.source === "conversation-call" ? (clip.clipKind as ConversationCallCharacterVideoClipKind | null) : null;
    if (clip && !kind) return;
    setGenerationInitialKind(kind ?? null);
    setGenerationDialogOpen(true);
  }, []);

  const handleGenerateCallClips = useCallback(
    async (input: CharacterCallVideoGenerationInput) => {
      const standardKinds = input.clipKinds?.length ? input.clipKinds : input.clipKind ? [input.clipKind] : [];
      const customClip = input.customClip?.label.trim() && input.customClip.prompt.trim() ? input.customClip : null;
      const singleKind = standardKinds.length === 1 && !customClip ? standardKinds[0] : null;
      setGeneratingClipId(
        singleKind ? `call:${singleKind}` : customClip && standardKinds.length === 0 ? "custom-call:pending" : null,
      );
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
            ? localizeUi("ui.characters.charactercallclipsgallery.customCallClipGenerationStarted")
            : singleKind
              ? localizeUi("ui.characters.charactercallclipsgallery.callClipGenerationStarted")
              : customClip
                ? localizeUi("ui.characters.charactercallclipsgallery.callClipAndCustomClipGenerationStarted")
                : localizeUi("ui.characters.charactercallclipsgallery.callClipGenerationBatchStarted"),
        );
        setGenerationDialogOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : localizeUi("ui.characters.charactercallclipsgallery.couldNotStartCallClipGeneration"),
        );
      } finally {
        setGeneratingClipId(null);
      }
    },
    [generateCallClips, generateCustomCallClip, localizeUi],
  );

  const handleUploadClipFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      const pending = pendingClipUploadRef.current;
      event.target.value = "";
      if (!file || !pending) return;

      setUploadingClipId(pending.clipId);
      try {
        await uploadClip.mutateAsync({
          file,
          label: pending.label,
          kind: pending.kind,
        });
        toast.success(
          pending.kind
            ? localizeUi("ui.characters.charactercallclipsgallery.value1Uploaded", {
                value1: pending.label || localizeUi("ui.characters.charactercallclipsgallery.callClip"),
              })
            : localizeUi("ui.characters.charactercallclipsgallery.clipUploaded"),
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : localizeUi("ui.characters.charactercallclipsgallery.couldNotUploadClip"),
        );
      } finally {
        pendingClipUploadRef.current = null;
        setUploadingClipId(null);
      }
    },
    [uploadClip, localizeUi],
  );

  const handleUploadCallClip = useCallback(
    (clip?: CharacterGalleryClip) => {
      if (uploadClip.isPending) return;
      const kind = clip?.source === "conversation-call" ? clip.clipKind : null;
      if (clip && !kind) return;
      pendingClipUploadRef.current = {
        kind,
        label: kind ? (clip?.label ?? null) : null,
        clipId: clip?.id ?? "custom-call:upload",
      };
      clipUploadInputRef.current?.click();
    },
    [uploadClip.isPending],
  );

  const handleDeleteClip = useCallback(
    async (clip: CharacterGalleryClip) => {
      if (!canDeleteCharacterGalleryClip(clip)) return;
      if (
        !(await showConfirmDialog({
          title: localizeUi("ui.characters.charactervideosgallery.deleteClip"),
          message: characterGalleryClipDeleteMessage(clip),
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
            ? localizeUi("ui.characters.charactercallclipsgallery.callClipReset")
            : localizeUi("ui.characters.charactercallclipsgallery.clipDeleted"),
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : localizeUi("ui.characters.charactercallclipsgallery.couldNotDeleteClip"),
        );
      } finally {
        setDeletingClipId(null);
      }
    },
    [deleteClip, localizeUi],
  );

  const handleSaveTrim = useCallback(
    async (clip: CharacterGalleryClip, trim: { trimStartSeconds: number | null; trimEndSeconds: number | null }) => {
      try {
        await updateClipTrim.mutateAsync({
          clipId: clip.id,
          ...trim,
        });
        toast.success(localizeUi("ui.characters.charactercallclipsgallery.clipTrimSaved"));
        setTrimClip(null);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : localizeUi("ui.characters.charactercallclipsgallery.couldNotSaveClipTrim"),
        );
      }
    },
    [updateClipTrim, localizeUi],
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
            {localizeUi("ui.characters.charactercallclipsgallery.videoCallClips")}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            {readyCallClipCount}/{standardCallClips.length || 6}{" "}
            {localizeUi("ui.characters.charactercallclipsgallery.standardReady")} {customCallClipCount}{" "}
            {localizeUi("ui.characters.charactercallclipsgallery.custom")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleUploadCallClip()}
            disabled={uploadClip.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--primary)]/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploadClip.isPending && uploadingClipId === "custom-call:upload" ? (
              <Loader2 size="0.85rem" className="animate-spin" />
            ) : (
              <Upload size="0.85rem" />
            )}
            {localizeUi("ui.characters.charactercallclipsgallery.uploadExtra")}
          </button>
          <button
            type="button"
            onClick={() => openGenerationDialog()}
            disabled={generationLockActive}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-[var(--primary-foreground)] transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          >
            {batchGenerationPending ? <Loader2 size="0.85rem" className="animate-spin" /> : <Wand2 size="0.85rem" />}
            {batchGenerationPending
              ? localizeUi("ui.characters.charactercallclipsgallery.generating")
              : localizeUi("ui.characters.charactercallclipsgallery.generateClips")}
          </button>
        </div>
      </div>

      {clips.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {clips.map((clip) => (
            <CharacterClipCard
              key={clip.id}
              clip={clip}
              characterName={characterName}
              deleting={deletingClipId === clip.id}
              generating={generatingClipId === clip.id}
              uploading={uploadingClipId === clip.id}
              uploadDisabled={uploadClip.isPending}
              generationDisabled={generationLockActive}
              onGenerate={openGenerationDialog}
              onUpload={handleUploadCallClip}
              onDelete={handleDeleteClip}
              onEditTrim={setTrimClip}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] py-12 text-center">
          <Film size="1.75rem" className="text-[var(--muted-foreground)]/40" />
          <div>
            <p className="text-sm font-medium text-[var(--muted-foreground)]">
              {localizeUi("ui.characters.charactercallclipsgallery.noCallClipsYet")}
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]/60">
              {localizeUi("ui.characters.charactercallclipsgallery.generateOrUploadVideoCallLoopsFor")}{" "}
              {characterName || "this character"}.
            </p>
          </div>
        </div>
      )}
      <CharacterClipTrimModal
        clip={trimClip}
        saving={updateClipTrim.isPending}
        onClose={() => setTrimClip(null)}
        onSave={handleSaveTrim}
      />
      <CallClipGenerationModal
        open={generationDialogOpen}
        entityName={characterName || "this character"}
        initialKind={generationInitialKind}
        generating={generateCallClips.isPending || generateCustomCallClip.isPending}
        onClose={() => setGenerationDialogOpen(false)}
        onGenerate={handleGenerateCallClips}
      />
    </div>
  );
}

function CharacterClipPreviewVideo({ clip }: { clip: CharacterGalleryClip }) {
  const isCallVideoClip = isCharacterCallVideoClip(clip);
  return (
    <video
      src={clip.url ?? undefined}
      controls
      muted={isCallVideoClip}
      preload="metadata"
      className="h-full w-full bg-black object-contain"
      onLoadedMetadata={(event) => {
        if (isCallVideoClip) keepCharacterCallClipVideoSilent(event);
        seekCharacterCallClipToTrimStart(event.currentTarget, clip);
      }}
      onPlay={(event) => {
        if (isCallVideoClip) keepCharacterCallClipVideoSilent(event);
        seekCharacterCallClipToTrimStart(event.currentTarget, clip);
      }}
      onTimeUpdate={(event) => handleCharacterCallClipTimeUpdate(event.currentTarget, clip)}
      onVolumeChange={isCallVideoClip ? keepCharacterCallClipVideoSilent : undefined}
    />
  );
}

function CharacterClipTrimModal({
  clip,
  saving,
  onClose,
  onSave,
}: {
  clip: CharacterGalleryClip | null;
  saving: boolean;
  onClose: () => void;
  onSave: (
    clip: CharacterGalleryClip,
    trim: { trimStartSeconds: number | null; trimEndSeconds: number | null },
  ) => void | Promise<void>;
}) {
  const { t: localizeUi } = useUiTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [endIsNatural, setEndIsNatural] = useState(true);

  useEffect(() => {
    if (!clip) return;
    const nextStart = readClipTrimStart(clip);
    const nextEnd = readClipTrimEnd(clip);
    setDuration(null);
    setStart(nextStart);
    setEnd(nextEnd ?? 0);
    setEndIsNatural(nextEnd === null);
  }, [clip]);

  const handleLoadedMetadata = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      const video = event.currentTarget;
      keepCharacterCallClipVideoSilent(event);
      const videoDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
      const nextEnd = readClipTrimEnd(clip ?? { trimEndSeconds: null }) ?? videoDuration;
      setDuration(videoDuration);
      setEnd((current) => (current > 0 ? Math.min(current, videoDuration || current) : nextEnd));
      video.currentTime = readClipTrimStart(clip ?? { trimStartSeconds: null });
    },
    [clip],
  );

  if (!clip || !clip.url || !isCharacterCallVideoClip(clip)) return null;

  const resolvedDuration = duration && duration > 0 ? duration : Math.max(end, readClipTrimEnd(clip) ?? 0, 1);
  const minGap = Math.min(0.1, Math.max(0.02, resolvedDuration / 20));
  const safeStart = Math.min(start, Math.max(0, end - minGap));
  const safeEnd = Math.max(end || resolvedDuration, safeStart + minGap);
  const canSave = safeEnd > safeStart + 0.01;

  const handleStartChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (!Number.isFinite(value)) return;
    setStart(Math.min(roundClipTrimSecond(value), Math.max(0, safeEnd - minGap)));
  };

  const handleEndChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (!Number.isFinite(value)) return;
    setEnd(Math.max(roundClipTrimSecond(value), safeStart + minGap));
    setEndIsNatural(false);
  };

  const handleReset = () => {
    setStart(0);
    setEnd(resolvedDuration);
    setEndIsNatural(true);
    if (videoRef.current) videoRef.current.currentTime = 0;
  };

  const handleSave = () => {
    const trimStartSeconds = safeStart > 0.01 ? roundClipTrimSecond(safeStart) : null;
    const trimEndSeconds =
      endIsNatural || (duration !== null && safeEnd >= duration - 0.05) ? null : roundClipTrimSecond(safeEnd);
    void onSave(clip, { trimStartSeconds, trimEndSeconds });
  };

  const previewClip: CharacterGalleryClip = {
    ...clip,
    trimStartSeconds: safeStart > 0.01 ? safeStart : null,
    trimEndSeconds: endIsNatural ? null : safeEnd,
  };

  return (
    <Modal
      open={Boolean(clip)}
      onClose={onClose}
      title={localizeUi("ui.characters.charactercliptrimmodal.trimValue1", {
        value1: clip.label || localizeUi("ui.panels.ttsconfigcard.clip"),
      })}
      width="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-black">
          <video
            ref={videoRef}
            key={clip.id}
            src={clip.url}
            controls
            muted
            playsInline
            preload="metadata"
            className="aspect-video w-full object-contain"
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={(event) => {
              keepCharacterCallClipVideoSilent(event);
              seekCharacterCallClipToTrimStart(event.currentTarget, previewClip);
            }}
            onTimeUpdate={(event) =>
              handleCharacterCallClipTimeUpdate(event.currentTarget, previewClip, { loop: true })
            }
            onVolumeChange={keepCharacterCallClipVideoSilent}
          />
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted-foreground)]">
            <span>
              {localizeUi("ui.characters.charactercliptrimmodal.start")} {formatTrimSecond(safeStart)}
            </span>
            <span>
              {localizeUi("ui.characters.charactercliptrimmodal.end")}{" "}
              {endIsNatural ? localizeUi("ui.characters.charactercliptrimmodal.naturalEnd") : formatTrimSecond(safeEnd)}
            </span>
          </div>
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1 text-xs font-medium text-[var(--foreground)]">
              {localizeUi("ui.characters.charactercliptrimmodal.start")}
              <input
                type="range"
                min={0}
                max={Math.max(0, safeEnd - minGap)}
                step={0.05}
                value={safeStart}
                onChange={handleStartChange}
                className="w-full accent-[var(--primary)]"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-[var(--foreground)]">
              {localizeUi("ui.characters.charactercliptrimmodal.end")}
              <input
                type="range"
                min={Math.min(resolvedDuration, safeStart + minGap)}
                max={resolvedDuration}
                step={0.05}
                value={Math.min(safeEnd, resolvedDuration)}
                onChange={handleEndChange}
                className="w-full accent-[var(--primary)]"
              />
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--primary)]/50"
          >
            <RotateCcw size="0.85rem" />
            {localizeUi("ui.characters.charactercliptrimmodal.reset")}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--primary)]/50"
            >
              {localizeUi("chat.delete.dialog.cancel")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !canSave}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-[var(--primary-foreground)] transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 size="0.85rem" className="animate-spin" /> : <Scissors size="0.85rem" />}
              {localizeUi("ui.characters.charactercliptrimmodal.saveTrim")}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function CharacterClipCard({
  clip,
  characterName,
  deleting,
  generating,
  uploading,
  uploadDisabled,
  generationDisabled,
  onGenerate,
  onUpload,
  onDelete,
  onEditTrim,
}: {
  clip: CharacterGalleryClip;
  characterName?: string;
  deleting: boolean;
  generating: boolean;
  uploading: boolean;
  uploadDisabled: boolean;
  generationDisabled: boolean;
  onGenerate: (clip: CharacterGalleryClip) => void | Promise<void>;
  onUpload: (clip: CharacterGalleryClip) => void;
  onDelete: (clip: CharacterGalleryClip) => void | Promise<void>;
  onEditTrim: (clip: CharacterGalleryClip) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const sourceLabel = clip.origin === "uploaded" ? "Uploaded" : characterGalleryClipSourceLabel(clip.source);
  const dateLabel = formatClipDate(clip.updatedAt ?? clip.createdAt);
  const isReady = clip.status === "ready" && Boolean(clip.url);
  const canDelete = canDeleteCharacterGalleryClip(clip);
  const isCallVideoClip = isCharacterCallVideoClip(clip);
  const canTrim = isReady && isCallVideoClip;
  const canGenerate =
    clip.source === "conversation-call" &&
    Boolean(clip.clipKind) &&
    (clip.status === "missing" || clip.status === "error");
  const canUploadSlot = clip.source === "conversation-call" && Boolean(clip.clipKind);
  const clipDetails = [clip.durationSeconds ? `${clip.durationSeconds}s` : null, clip.aspectRatio]
    .filter(Boolean)
    .join(" · ");
  const trimLabel = characterClipTrimLabel(clip);

  return (
    <div className="group overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] transition-all hover:border-[var(--primary)]/30 hover:shadow-md">
      <div className="relative aspect-video bg-[var(--secondary)]">
        {isReady && clip.url ? (
          <CharacterClipPreviewVideo clip={clip} />
        ) : (
          <div className="absolute inset-0">
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-[var(--muted-foreground)]">
              {clip.status === "generating" ? (
                <Loader2 size="1.25rem" className="animate-spin text-[var(--primary)]" />
              ) : clip.status === "error" ? (
                <AlertTriangle size="1.25rem" className="text-[var(--destructive)]" />
              ) : (
                <Film size="1.25rem" className="opacity-50" />
              )}
              <span>
                {clip.status === "missing" ? localizeUi("ui.characters.characterclipcard.notGenerated") : clip.status}
              </span>
            </div>
            {canGenerate || canUploadSlot ? (
              <div className="absolute inset-x-2 bottom-2 flex flex-wrap items-center justify-center gap-1.5">
                {canGenerate ? (
                  <button
                    type="button"
                    onClick={() => void onGenerate(clip)}
                    disabled={generationDisabled || generating}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-[0.7rem] font-semibold text-[var(--foreground)] opacity-0 shadow-sm transition-all hover:border-[var(--primary)]/50 hover:text-[var(--primary)] focus-visible:opacity-100 disabled:cursor-not-allowed disabled:text-[var(--muted-foreground)] group-hover:opacity-100 max-md:opacity-100"
                    title={localizeUi("ui.characters.characterclipcard.generateValue1", {
                      value1: clip.label || localizeUi("ui.characters.characterclipcard.callClip"),
                    })}
                  >
                    {generating ? <Loader2 size="0.75rem" className="animate-spin" /> : <Wand2 size="0.75rem" />}
                    <span>{localizeUi("ui.characters.characterclipcard.generate")}</span>
                  </button>
                ) : null}
                {canUploadSlot ? (
                  <button
                    type="button"
                    onClick={() => onUpload(clip)}
                    disabled={uploading || uploadDisabled || generationDisabled}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-[0.7rem] font-semibold text-[var(--foreground)] opacity-0 shadow-sm transition-all hover:border-[var(--primary)]/50 hover:text-[var(--primary)] focus-visible:opacity-100 disabled:cursor-not-allowed disabled:text-[var(--muted-foreground)] group-hover:opacity-100 max-md:opacity-100"
                    title={localizeUi("ui.characters.characterclipcard.uploadValue1", {
                      value1: clip.label || localizeUi("ui.characters.characterclipcard.callClip"),
                    })}
                  >
                    {uploading ? <Loader2 size="0.75rem" className="animate-spin" /> : <Upload size="0.75rem" />}
                    <span>{localizeUi("ui.characters.characterclipcard.upload")}</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
        <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/65 px-2 py-1 text-[0.65rem] font-semibold text-white">
          {sourceLabel}
        </div>
        {trimLabel ? (
          <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/65 px-2 py-1 text-[0.65rem] font-semibold text-white">
            {trimLabel}
          </div>
        ) : null}
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--foreground)]">
              {clip.label || characterName || "Clip"}
            </p>
            <p className="mt-0.5 truncate text-[0.6875rem] text-[var(--muted-foreground)]">
              {clip.chatName
                ? localizeUi("ui.characters.characterclipcard.value1Value2", {
                    value1: clip.chatName,
                    value2: dateLabel,
                  })
                : dateLabel}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {canTrim ? (
              <button
                type="button"
                onClick={() => onEditTrim(clip)}
                className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-1.5 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                title={localizeUi("ui.characters.characterclipcard.trimLoop")}
                aria-label={localizeUi("ui.characters.charactercliptrimmodal.trimValue1", {
                  value1: clip.label || localizeUi("ui.panels.ttsconfigcard.clip"),
                })}
              >
                <Scissors size="0.75rem" />
              </button>
            ) : null}
            {canUploadSlot ? (
              <button
                type="button"
                onClick={() => onUpload(clip)}
                disabled={uploading || uploadDisabled || generationDisabled}
                className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-1.5 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
                title={localizeUi("ui.characters.characterclipcard.uploadReplacement")}
                aria-label={localizeUi("ui.characters.characterclipcard.uploadReplacementForValue1", {
                  value1: clip.label || localizeUi("ui.panels.ttsconfigcard.clip"),
                })}
              >
                {uploading ? <Loader2 size="0.75rem" className="animate-spin" /> : <Upload size="0.75rem" />}
              </button>
            ) : null}
            {isReady && clip.url ? (
              <a
                href={clip.url}
                download
                className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-1.5 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                title={localizeUi("ui.characters.charactergallerytab.download")}
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
                aria-label={localizeUi("ui.characters.characterclipcard.deleteValue1", {
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

// ── Sprites Tab ──

const DEFAULT_EXPRESSIONS = [
  "neutral",
  "happy",
  "sad",
  "angry",
  "surprised",
  "embarrassed",
  "thinking",
  "laughing",
  "worried",
  "scared",
  "disgusted",
  "love",
  "smirk",
  "crying",
  "determined",
  "hurt",
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

function SpritesTab({
  characterId,
  characterName,
  defaultAppearance,
  defaultAvatarUrl,
}: {
  characterId: string;
  characterName?: string;
  defaultAppearance?: string;
  defaultAvatarUrl?: string | null;
}) {
  const { t: localizeUi } = useUiTranslation();
  type SpriteCategory = "expressions" | "full-body" | "clips";

  const { data: sprites, isLoading } = useCharacterSprites(characterId);
  const { data: spriteCapabilities } = useSpriteCapabilities();
  const { data: installedCapabilities = [] } = useInstalledCapabilityPackages(true);
  const conversationCallsInstalled = installedCapabilities.some(
    (item) => item.status === "active" && item.manifest.kind.includes("conversation-calls"),
  );
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
        ...(conversationCallsInstalled ? [{ id: "clips" as const, label: "Clips" }] : []),
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
        await uploadSprite.mutateAsync({
          characterId,
          expression,
          image: reader.result as string,
        });
        setNewExpression("");
        pendingExpressionRef.current = "";
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  /** Open the sprite picker unless another single-file upload is already running. */
  const startUpload = (expression: string) => {
    if (uploading || !expression) return;
    pendingExpressionRef.current = expression;
    fileInputRef.current?.click();
  };

  /** Upload an entire folder of images — each filename becomes the expression name. */
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Filter to image files only
    const imageFiles = Array.from(files).filter((f) => /\.(png|jpg|jpeg|gif|webp|avif)$/i.test(f.name));
    if (imageFiles.length === 0) return;

    setFolderProgress({ done: 0, total: imageFiles.length });

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i]!;
      // Derive expression name from filename (strip extension, lowercase, sanitize)
      const expression = file.name.replace(/\.[^.]+$/, "").trim();
      const normalized = normalizeExpressionForCategory(expression);
      if (!normalized) continue;

      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      try {
        await uploadSprite.mutateAsync({ characterId, expression: normalized, image: dataUrl });
      } catch {
        // Skip failed uploads, continue with the rest
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
      await deleteSprite.mutateAsync({ characterId, expression: deleteSpriteRequest.expression });
      setDeleteSpriteRequest(null);
    } finally {
      setDeletingSprites(null);
    }
  }, [characterId, deleteSprite, deleteSpriteRequest]);

  const handleDeleteVisibleSprites = useCallback(async () => {
    if (visibleSprites.length === 0) return;
    setDeletingSprites("all");
    try {
      for (const sprite of visibleSprites) {
        await deleteSprite.mutateAsync({ characterId, expression: sprite.expression });
      }
      setDeleteSpriteRequest(null);
    } finally {
      setDeletingSprites(null);
    }
  }, [characterId, deleteSprite, visibleSprites]);

  const handleExportSprites = useCallback(
    async (spritesToExport: SpriteInfo[], modeLabel: "visible" | "all") => {
      if (spritesToExport.length === 0) return;

      setExporting(true);

      try {
        const scopeLabel =
          modeLabel === "all" ? "sprites" : category === "full-body" ? "full-body-sprites" : "expressions";
        const folderName = sanitizeSpriteExportFolderName(`${characterName || "character"}-${scopeLabel}`, "sprites");
        await exportSprites.mutateAsync({
          characterId,
          expressions: spritesToExport.map((sprite) => sprite.expression),
          folderName,
        });
        toast.success(
          modeLabel === "all"
            ? localizeUi("ui.characters.spritestab.exportedValue1SpriteValue2AsAFolder", {
                value1: spritesToExport.length,
                value2: spritesToExport.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
              })
            : localizeUi("ui.characters.spritestab.exportedValue1Value2SpriteValue3AsAFolder", {
                value1: spritesToExport.length,
                value2:
                  category === "full-body"
                    ? localizeUi("ui.characters.spritestab.fullBody_0fbbc4a")
                    : localizeUi("ui.characters.spritestab.expression"),
                value3: spritesToExport.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
              }),
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : localizeUi("ui.characters.spritestab.noSpritesWereExportedPleaseTryAgain"),
        );
      } finally {
        setExporting(false);
      }
    },
    [category, characterId, characterName, exportSprites, localizeUi],
  );

  const handleCleanVisibleSprites = useCallback(async () => {
    if (visibleSprites.length === 0) return;

    const modeLabel = category === "full-body" ? "full-body" : "expression";
    if (
      !(await showConfirmDialog({
        title: localizeUi("ui.characters.spritestab.cleanSpriteBackgrounds"),
        message: localizeUi("ui.characters.spritestab.cleanBackgroundsOnValue1SavedValue2SpriteValue3At", {
          value1: visibleSprites.length,
          value2: modeLabel,
          value3: visibleSprites.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
          value4: savedCleanupStrength,
        }),
        confirmLabel: localizeUi("ui.characters.spritestab.clean"),
      }))
    ) {
      return;
    }

    setCleaningSprites(true);
    try {
      const result = await cleanupSavedSprites.mutateAsync({
        characterId,
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
          localizeUi("ui.characters.spritestab.cleanedValue1SavedSpriteValue2Value3", {
            value1: result.processed,
            value2: result.processed === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
            value3: engineDetails,
          }),
        );
      }
      if (result.failed.length > 0) {
        toast.warning(
          localizeUi("ui.characters.spritestab.value1SpriteValue2CouldNotBeCleaned", {
            value1: result.failed.length,
            value2: result.failed.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
          }),
        );
      }
    } catch (err: any) {
      toast.error(err?.message || localizeUi("ui.characters.spritestab.failedToCleanSavedSprites"));
    } finally {
      setCleaningSprites(false);
    }
  }, [category, characterId, cleanupSavedSprites, savedCleanupStrength, visibleSprites, localizeUi]);

  const handleRestoreLastCleanup = useCallback(async () => {
    if (!lastCleanupBackupId) return;
    setRestoringCleanup(true);
    try {
      const result = await restoreSpriteCleanupBackup.mutateAsync({
        characterId,
        backupId: lastCleanupBackupId,
      });
      if (result.restored > 0) {
        toast.success(
          localizeUi("ui.characters.spritestab.restoredValue1SpriteValue2FromTheCleanupBackup", {
            value1: result.restored,
            value2: result.restored === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
          }),
        );
      }
      if (result.failed.length > 0) {
        toast.warning(
          localizeUi("ui.characters.spritestab.value1SpriteValue2CouldNotBeRestored", {
            value1: result.failed.length,
            value2: result.failed.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
          }),
        );
      } else {
        setLastCleanupBackupId(null);
      }
    } catch (err: any) {
      toast.error(err?.message || localizeUi("ui.characters.spritestab.failedToRestoreSpriteCleanupBackup"));
    } finally {
      setRestoringCleanup(false);
    }
  }, [characterId, lastCleanupBackupId, restoreSpriteCleanupBackup, localizeUi]);

  const handleApplySpriteFrame = useCallback(
    async (croppedDataUrl: string) => {
      if (!framingSprite) return;

      setSavingFrame(true);
      try {
        await uploadSprite.mutateAsync({
          characterId,
          expression: framingSprite.expression,
          image: croppedDataUrl,
        });
        toast.success(
          localizeUi("ui.characters.spritestab.framedValue1Sprite", {
            value1: displayExpression(framingSprite.expression),
          }),
        );
        setFramingSprite(null);
      } finally {
        setSavingFrame(false);
      }
    },
    [characterId, displayExpression, framingSprite, uploadSprite, localizeUi],
  );

  const handleApplyWandCleanup = useCallback(
    async (cleanedDataUrl: string) => {
      if (!wandCleanupSprite) return;

      setSavingWandCleanup(true);
      try {
        await uploadSprite.mutateAsync({
          characterId,
          expression: wandCleanupSprite.expression,
          image: cleanedDataUrl,
        });
        toast.success(
          localizeUi("ui.characters.spritestab.cleanedValue1Sprite", {
            value1: displayExpression(wandCleanupSprite.expression),
          }),
        );
        setWandCleanupSprite(null);
      } finally {
        setSavingWandCleanup(false);
      }
    },
    [characterId, displayExpression, uploadSprite, wandCleanupSprite, localizeUi],
  );

  if (category === "clips") {
    return (
      <div className="space-y-6">
        <SectionHeader
          title={localizeUi("ui.characters.spritestab.characterSprites")}
          subtitle={localizeUi("ui.characters.spritestab.uploadVnStyleSpritesAndVideoCallClipsFor")}
          helpText={CHARACTER_SPRITES_HELP}
        />

        {categoryTabs}

        <CharacterCallClipsGallery characterId={characterId} characterName={characterName} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={localizeUi("ui.characters.spritestab.characterSprites")}
        subtitle={localizeUi("ui.characters.spritestab.uploadVnStyleSpritesForDifferentExpressionsTheExpression")}
        helpText={CHARACTER_SPRITES_HELP}
      />

      {categoryTabs}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      <input
        ref={folderInputRef}
        type="file"
        accept="image/*"
        multiple
        // @ts-expect-error — webkitdirectory is a non-standard but widely-supported attribute
        webkitdirectory=""
        className="hidden"
        onChange={handleFolderUpload}
      />

      {/* Upload new expression */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h4 className="text-xs font-semibold flex items-center gap-1.5">
            <Upload size="0.8125rem" className="text-[var(--primary)]" />
            {localizeUi("ui.characters.spritestab.addSprite")}
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
                  : localizeUi("ui.characters.spritestab.generateSpritesUsingAiImageGeneration")
              }
            >
              <Wand2 size="0.8125rem" />
              {localizeUi("ui.characters.spritestab.generateSprite")}
            </button>
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              disabled={!!folderProgress}
              className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-center text-[0.6875rem] font-medium leading-tight text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40 max-md:flex-1 max-md:basis-[calc(50%-0.25rem)] max-md:px-2.5"
              title={localizeUi("ui.characters.spritestab.selectAFolderOfPngsEachFilenameBecomesThe")}
            >
              <FolderOpen size="0.8125rem" />
              {localizeUi("ui.characters.spritestab.uploadFolder")}
            </button>
            <button
              type="button"
              onClick={() => void handleCleanVisibleSprites()}
              disabled={cleaningSprites || backgroundCleanupUnavailable || visibleSprites.length === 0}
              className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-center text-[0.6875rem] font-medium leading-tight text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40 max-md:flex-1 max-md:basis-[calc(50%-0.25rem)] max-md:px-2.5"
              title={
                backgroundCleanupUnavailable
                  ? backgroundCleanupReason
                  : localizeUi("ui.characters.spritestab.cleanBackgroundsOnTheCurrentlyVisibleSavedSprites")
              }
            >
              {cleaningSprites ? <Loader2 size="0.8125rem" className="animate-spin" /> : <Eraser size="0.8125rem" />}
              {cleaningSprites
                ? localizeUi("ui.characters.spritestab.cleaning")
                : localizeUi("ui.characters.spritestab.cleanBackgrounds")}
            </button>
            <div className="relative max-md:flex-1 max-md:basis-[calc(50%-0.25rem)]">
              <button
                type="button"
                onClick={() => setExportMenuOpen((open) => !open)}
                disabled={exporting || allSprites.length === 0}
                className="flex w-full min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-center text-[0.6875rem] font-medium leading-tight text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40 max-md:px-2.5"
                title={localizeUi("ui.characters.spritestab.chooseWhichSavedSpritesToExport")}
              >
                <ImageDown size="0.8125rem" />
                {exporting
                  ? localizeUi("ui.characters.spritestab.exporting")
                  : localizeUi("ui.characters.spritestab.export")}
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
                      ? localizeUi("ui.characters.spritestab.fullBodyOnly")
                      : localizeUi("ui.characters.spritestab.expressionsOnly")}
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
                    {localizeUi("ui.characters.spritestab.allSprites")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--secondary)]/60 px-3 py-2">
          <span className="text-[0.6875rem] font-medium text-[var(--foreground)]">
            {localizeUi("ui.characters.spritestab.cleanupStrength")}
          </span>
          <span className="text-[0.625rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.characters.spritestab.soft")}
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
            {localizeUi("ui.characters.spritestab.aggressive")}
          </span>
          <span className="w-8 text-right text-[0.6875rem] tabular-nums text-[var(--muted-foreground)]">
            {savedCleanupStrength}
          </span>
        </div>

        {/* Folder upload progress */}
        {folderProgress && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
            <Loader2 size="0.75rem" className="animate-spin text-[var(--primary)]" />
            {localizeUi("ui.noodle.noodleprofilesurface.uploading_de27240")} {folderProgress.done}/
            {folderProgress.total} {localizeUi("ui.characters.spritestab.sprites")}
          </div>
        )}
        {cleaningSprites && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
            <Loader2 size="0.75rem" className="animate-spin text-[var(--primary)]" />
            {localizeUi("ui.characters.spritestab.applyingAutomaticMatteCleanupToSavedSprites")}
          </div>
        )}
        {lastCleanupBackupId && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
            <span>{localizeUi("ui.characters.spritestab.lastCleanupHasARestorePoint")}</span>
            <button
              type="button"
              onClick={() => void handleRestoreLastCleanup()}
              disabled={restoringCleanup}
              className="flex items-center gap-1.5 rounded-md bg-[var(--card)] px-2.5 py-1 text-[0.6875rem] font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] disabled:opacity-40"
            >
              {restoringCleanup ? <Loader2 size="0.75rem" className="animate-spin" /> : <RotateCcw size="0.75rem" />}
              {localizeUi("ui.characters.spritestab.undoCleanup")}
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
                ? localizeUi("ui.characters.spritestab.poseNameEGIdleWalkBattleStance")
                : localizeUi("ui.characters.spritestab.expressionNameEGHappySadAngry")
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
            {localizeUi("ui.characters.characterclipcard.upload")}
          </button>
        </div>

        {/* Quick expression buttons */}
        {category === "expressions" && suggestedExpressions.length > 0 && (
          <div>
            <p className="text-[0.625rem] text-[var(--muted-foreground)] mb-1.5">
              {localizeUi("ui.characters.spritestab.quickAdd")}
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
                title={localizeUi("ui.characters.spritestab.openWandCleanup")}
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
                    title={localizeUi("ui.characters.spritestab.frame")}
                  >
                    <Crop size="0.6875rem" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadSpriteFile(sprite)}
                    className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    title={localizeUi("ui.characters.charactergallerytab.download")}
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
              {localizeUi("ui.characters.spritestab.noSpritesYet")}
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]/60">
              {category === "full-body"
                ? localizeUi("ui.characters.spritestab.uploadFullBodySpritesAboveUseTransparentPngsFor")
                : localizeUi("ui.characters.spritestab.uploadExpressionSpritesAboveUseTransparentPngsForBest")}
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
          title={localizeUi("ui.characters.spritestab.deleteSprite")}
          width="max-w-sm"
        >
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-[var(--foreground)]">
              {localizeUi("ui.characters.spritestab.deleteSpriteFor")}
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
                  {localizeUi("ui.characters.spritestab.deleteAll")}{" "}
                  {category === "full-body"
                    ? localizeUi("ui.characters.spritestab.fullBody")
                    : localizeUi("ui.characters.spritestab.expressions")}
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
        entityId={characterId}
        initialSpriteType={category === "full-body" ? "full-body" : "expressions"}
        existingExpressionSprites={portraitExpressionSprites}
        defaultAppearance={defaultAppearance}
        defaultAvatarUrl={defaultAvatarUrl}
        onSpritesGenerated={() => {
          queryClient.invalidateQueries({ queryKey: spriteKeys.list(characterId) });
        }}
      />
    </div>
  );
}

// ── Stats Tab ──

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

function createNewRpgPool(existing: readonly RPGStatPool[]): RPGStatPool {
  const used = new Set(existing.map((pool) => pool.name.trim().toLowerCase()).filter(Boolean));
  let index = existing.length + 1;
  let name = `Pool ${index}`;
  while (used.has(name.toLowerCase())) {
    name = `Pool ${++index}`;
  }
  return { name, value: 100, max: 100, color: "#a78bfa" };
}

function StatsTab({
  formData,
  updateExtension,
}: {
  formData: CharacterData;
  updateExtension: (key: string, value: unknown) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const stats: RPGStatsConfig = (formData.extensions.rpgStats as RPGStatsConfig) ?? DEFAULT_RPG_STATS;
  const pools = normalizeRpgStatPools(stats);
  const trackerCustomFieldDefaults = Array.isArray(formData.extensions.trackerCustomFieldDefaults)
    ? (formData.extensions.trackerCustomFieldDefaults as CharacterTrackerCustomFieldDefault[])
    : [];
  const trackerCardAppearance = parseTrackerCardColorConfig(formData.extensions.trackerCardColors);

  const updateStatIcons = (statIcons: NonNullable<typeof trackerCardAppearance.statIcons>) => {
    updateExtension("trackerCardColors", serializeTrackerCardColorConfig({ ...trackerCardAppearance, statIcons }));
  };

  const update = (patch: Partial<RPGStatsConfig>) => {
    updateExtension("rpgStats", { ...stats, ...patch });
  };

  const updatePools = (nextPools: RPGStatPool[]) => {
    update({
      pools: nextPools,
      hp: syncRpgHpFromPools(nextPools, stats.hp),
    });
  };

  const updatePool = (index: number, patch: Partial<RPGStatPool>) => {
    const nextPools = pools.map((pool, poolIndex) => (poolIndex === index ? { ...pool, ...patch } : pool));
    if (typeof patch.name === "string" && patch.name !== pools[index]?.name) {
      updateStatIcons(
        remapStatIconAssignments(trackerCardAppearance.statIcons ?? [], pools, nextPools, (nextIndex) => nextIndex),
      );
    }
    updatePools(nextPools);
  };

  const removePool = (index: number) => {
    const nextPools = pools.filter((_, poolIndex) => poolIndex !== index);
    updateStatIcons(
      remapStatIconAssignments(trackerCardAppearance.statIcons ?? [], pools, nextPools, (nextIndex) =>
        nextIndex < index ? nextIndex : nextIndex + 1,
      ),
    );
    updatePools(nextPools);
  };

  const updateAttribute = (index: number, field: string, value: string | number) => {
    const next = [...stats.attributes];
    next[index] = { ...next[index], [field]: value };
    update({ attributes: next });
  };

  const addAttribute = () => {
    update({ attributes: [...stats.attributes, { name: "NEW", value: 10 }] });
  };

  const removeAttribute = (index: number) => {
    update({ attributes: stats.attributes.filter((_, i) => i !== index) });
  };

  const updateTrackerCustomFieldDefault = (index: number, patch: Partial<CharacterTrackerCustomFieldDefault>) => {
    updateExtension(
      "trackerCustomFieldDefaults",
      trackerCustomFieldDefaults.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...patch } : field)),
    );
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={localizeUi("ui.characters.statstab.rpgStats")}
        subtitle={localizeUi("ui.characters.statstab.toggleStatTrackingForThisCharacterWhenEnabledThe")}
        helpText={CHARACTER_STATS_HELP}
      />

      <SettingsSwitch
        label={<span className="font-medium">{localizeUi("ui.characters.statstab.enableRpgStats")}</span>}
        description={localizeUi("ui.characters.statstab.statsWillBeInjectedIntoThePromptAndTracked")}
        checked={stats.enabled}
        onChange={(checked) => update({ enabled: checked })}
        labelPosition="start"
        className="justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
        labelClassName="text-sm"
      />

      {stats.enabled && (
        <>
          {/* Pools */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{localizeUi("ui.characters.statstab.pools")}</h3>
              <button
                type="button"
                onClick={() => updatePools([...pools, createNewRpgPool(pools)])}
                className="mari-chrome-accent-surface mari-accent-animated flex items-center gap-1 rounded-lg px-2.5 py-1 text-[0.6875rem] font-medium transition-colors"
              >
                <Plus size="0.75rem" />
                {localizeUi("ui.characters.metadatatab.add")}
              </button>
            </div>
            <div className="space-y-2">
              {pools.map((pool, i) => (
                <div
                  key={i}
                  className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 sm:grid-cols-[2rem_2rem_minmax(0,1fr)_5rem_5rem_auto] sm:items-center"
                >
                  <input
                    type="color"
                    value={pool.color}
                    onChange={(e) => updatePool(i, { color: e.target.value })}
                    className="h-8 w-8 rounded border border-[var(--border)] bg-transparent p-0.5"
                    aria-label={localizeUi("ui.characters.statstab.value1Color", {
                      value1: pool.name || localizeUi("ui.characters.statstab.pool"),
                    })}
                  />
                  <StatIconPicker
                    value={resolveStatIconAssignment(
                      trackerCardAppearance.statIcons ?? [],
                      pool.name,
                      getStatNameOccurrence(pools, i),
                    )}
                    statName={pool.name}
                    onSelect={(icon) =>
                      updateStatIcons(
                        setStatIconAssignment(
                          trackerCardAppearance.statIcons ?? [],
                          pool.name,
                          getStatNameOccurrence(pools, i),
                          icon ?? undefined,
                        ),
                      )
                    }
                  />
                  <input
                    value={pool.name}
                    onChange={(e) => updatePool(i, { name: e.target.value })}
                    className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs font-medium"
                    placeholder={localizeUi("ui.characters.metadatatab.name")}
                  />
                  <input
                    type="number"
                    value={pool.value}
                    onChange={(e) => updatePool(i, { value: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-center text-xs"
                    min={0}
                    aria-label={localizeUi("ui.characters.statstab.value1Value", {
                      value1: pool.name || localizeUi("ui.characters.statstab.pool"),
                    })}
                  />
                  <input
                    type="number"
                    value={pool.max}
                    onChange={(e) => updatePool(i, { max: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-center text-xs"
                    min={1}
                    aria-label={localizeUi("ui.characters.statstab.value1Max", {
                      value1: pool.name || localizeUi("ui.characters.statstab.pool"),
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => removePool(i)}
                    className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--primary)]/15 hover:text-[var(--primary)]"
                    aria-label={localizeUi("ui.characters.statstab.removeValue1", {
                      value1: pool.name || localizeUi("ui.characters.statstab.pool_51a4b13"),
                    })}
                  >
                    <X size="0.75rem" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Attributes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{localizeUi("ui.characters.statstab.attributes")}</h3>
              <button
                type="button"
                onClick={addAttribute}
                className="mari-chrome-accent-surface mari-accent-animated flex items-center gap-1 rounded-lg px-2.5 py-1 text-[0.6875rem] font-medium transition-colors"
              >
                <Plus size="0.75rem" />
                {localizeUi("ui.characters.metadatatab.add")}
              </button>
            </div>

            <div className="space-y-2">
              {stats.attributes.map((attr, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2"
                >
                  <input
                    value={attr.name}
                    onChange={(e) => updateAttribute(i, "name", e.target.value)}
                    className="w-20 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs font-medium"
                    placeholder={localizeUi("ui.characters.metadatatab.name")}
                  />
                  <input
                    type="number"
                    value={attr.value}
                    onChange={(e) => updateAttribute(i, "value", parseInt(e.target.value) || 0)}
                    className="w-16 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-center text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => removeAttribute(i)}
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

      <div className="space-y-3 border-t border-[var(--border)] pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{localizeUi("ui.characters.statstab.trackerCustomFields")}</h3>
            <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
              {localizeUi("ui.characters.statstab.trackerCustomFieldsDescription")}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              updateExtension("trackerCustomFieldDefaults", [...trackerCustomFieldDefaults, { name: "", value: "" }])
            }
            className="mari-chrome-accent-surface mari-accent-animated flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-[0.6875rem] font-medium transition-colors"
          >
            <Plus size="0.75rem" />
            {localizeUi("ui.characters.metadatatab.add")}
          </button>
        </div>

        {trackerCustomFieldDefaults.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.characters.statstab.noTrackerCustomFields")}
          </p>
        ) : (
          <div className="space-y-2">
            {trackerCustomFieldDefaults.map((field, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] sm:items-center"
              >
                <input
                  value={field.name}
                  onChange={(event) => updateTrackerCustomFieldDefault(index, { name: event.target.value })}
                  className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs font-medium"
                  placeholder={localizeUi("ui.characters.statstab.trackerFieldName")}
                  aria-label={localizeUi("ui.characters.statstab.trackerFieldName")}
                />
                <input
                  value={field.value}
                  onChange={(event) => updateTrackerCustomFieldDefault(index, { value: event.target.value })}
                  className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs"
                  placeholder={localizeUi("ui.characters.statstab.initialValue")}
                  aria-label={localizeUi("ui.characters.statstab.initialValue")}
                />
                <button
                  type="button"
                  onClick={() =>
                    updateExtension(
                      "trackerCustomFieldDefaults",
                      trackerCustomFieldDefaults.filter((_, fieldIndex) => fieldIndex !== index),
                    )
                  }
                  className="rounded-lg p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--primary)]/15 hover:text-[var(--primary)]"
                  title={localizeUi("ui.characters.statstab.removeTrackerField")}
                  aria-label={localizeUi("ui.characters.statstab.removeTrackerField")}
                >
                  <X size="0.75rem" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Colors Tab ──

function ColorsTab({
  formData,
  updateExtension,
  avatarUrl,
}: {
  formData: CharacterData;
  updateExtension: (key: string, value: unknown) => void;
  avatarUrl: string | null;
}) {
  const { t: localizeUi } = useUiTranslation();
  const nameColor = (formData.extensions.nameColor as string) ?? "";
  const dialogueColor = (formData.extensions.dialogueColor as string) ?? "";
  const boxColor = (formData.extensions.boxColor as string) ?? "";
  const [extracting, setExtracting] = useState(false);

  const handleExtract = async () => {
    if (!avatarUrl) return;
    setExtracting(true);
    try {
      const [nc, dc, bc] = await extractColorsFromImage(avatarUrl);
      updateExtension("nameColor", nc);
      updateExtension("dialogueColor", dc);
      updateExtension("boxColor", bc);
    } catch {
      // silently ignore — user can just pick colors manually
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={localizeUi("ui.characters.colorstab.characterColors")}
        subtitle={localizeUi("ui.characters.colorstab.customizeHowThisCharacterAppearsInChatsColorsAre")}
        helpText={CHARACTER_COLORS_HELP}
      />

      {/* Extract from avatar button */}
      <button
        type="button"
        disabled={!avatarUrl || extracting}
        onClick={handleExtract}
        className="mari-editor-action mari-editor-action--accent mari-editor-action--primary flex w-full rounded-xl px-4 py-2.5 text-xs"
      >
        {extracting ? <Loader2 size="0.875rem" className="animate-spin" /> : <Palette size="0.875rem" />}
        {extracting
          ? localizeUi("ui.characters.colorstab.extracting")
          : avatarUrl
            ? localizeUi("ui.characters.colorstab.extractColorsFromAvatar")
            : localizeUi("ui.characters.colorstab.uploadAnAvatarFirst")}
      </button>

      {/* Preview card */}
      <div className="space-y-3 overflow-hidden rounded-xl border border-[var(--border)] bg-black/30 p-4">
        <p className="text-[0.625rem] font-medium uppercase tracking-widest text-[var(--muted-foreground)]">
          {localizeUi("settings.notifications.customSound.actions.preview")}
        </p>
        <div className="flex gap-3">
          <div className="mari-chrome-accent-tile mari-accent-animated relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-[var(--marinara-chat-chrome-button-border-active)]">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={localizeUi("ui.characters.colorstab.value1AvatarPreview", {
                  value1: formData.name || localizeUi("ui.characters.cardlibrarydetailcard.character"),
                })}
                className="h-full w-full object-cover"
                style={getAvatarCropStyle(normalizeAvatarCrop(formData.extensions.avatarCrop))}
              />
            ) : (
              <User size="1rem" className="text-white" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <span
              className="text-[0.75rem] font-bold tracking-tight"
              style={
                nameColor
                  ? nameColor.includes("gradient(")
                    ? {
                        backgroundImage: nameColor,
                        backgroundRepeat: "no-repeat",
                        backgroundSize: "100% 100%",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                        color: "transparent",
                        display: "inline-block",
                      }
                    : { color: nameColor }
                  : { color: "rgb(192, 132, 252)" }
              }
            >
              {formData.name || "Character"}
            </span>
            <div
              className="rounded-2xl rounded-tl-sm px-4 py-3 text-[0.8125rem] leading-[1.8] backdrop-blur-md ring-1 ring-white/8"
              style={boxColor ? { backgroundColor: boxColor } : { backgroundColor: "rgba(255,255,255,0.08)" }}
            >
              <span className="text-white/90">
                {localizeUi("ui.characters.colorstab.theyJumpDownLandingBehindYouAndStraightenUp")}{" "}
              </span>
              <strong style={dialogueColor ? { color: dialogueColor } : { color: "rgb(255, 255, 255)" }}>
                {localizeUi("ui.characters.colorstab.ldquoHelloThereRdquo")}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Name Color */}
      <ColorPicker
        value={nameColor}
        onChange={(v) => updateExtension("nameColor", v)}
        gradient
        label={localizeUi("ui.characters.colorstab.nameDisplayColor")}
        helpText="The color (or gradient) used for the character's name in chat messages and sidebar tabs. Supports gradients!"
      />

      {/* Dialogue Color */}
      <ColorPicker
        value={dialogueColor}
        onChange={(v) => updateExtension("dialogueColor", v)}
        label={localizeUi("ui.characters.colorstab.dialogueHighlightColor")}
        helpText={
          'Text inside dialogue quotation marks ("", “”, «», 「」, 『』) will be automatically colored with this, and can also be bolded from Settings.'
        }
      />

      {/* Box Color */}
      <ColorPicker
        value={boxColor}
        onChange={(v) => updateExtension("boxColor", v)}
        label={localizeUi("ui.characters.colorstab.messageBoxColor")}
        helpText="Background color for this character's chat message bubbles. Use a semi-transparent color for best results (e.g. rgba)."
      />
    </div>
  );
}

function LorebookTab({
  characterId,
  formData,
  embedding,
  isEmbeddingInFlight,
  onEmbedded,
  onEmbeddingChange,
  onUnembed,
}: {
  characterId: string | null;
  formData: CharacterData;
  embedding?: boolean;
  isEmbeddingInFlight?: () => boolean;
  onEmbedded?: (lorebookId: string, characterBook: unknown) => void;
  onEmbeddingChange?: (embedding: boolean) => void;
  onUnembed?: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const book = formData.character_book;
  const entries = book?.entries ?? [];
  const qc = useQueryClient();
  const openLorebookDetail = useUIStore((s) => s.openLorebookDetail);
  const [importing, setImporting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const importMetadata =
    formData.extensions.importMetadata && typeof formData.extensions.importMetadata === "object"
      ? (formData.extensions.importMetadata as Record<string, unknown>)
      : {};
  const embeddedLorebookMetadata =
    importMetadata.embeddedLorebook && typeof importMetadata.embeddedLorebook === "object"
      ? (importMetadata.embeddedLorebook as Record<string, unknown>)
      : {};
  const rawLinkedLorebookId =
    typeof embeddedLorebookMetadata.lorebookId === "string" ? embeddedLorebookMetadata.lorebookId : null;
  // Verify the pointed-to lorebook actually exists. Cards exported from
  // another Marinara instance can carry a stale `lorebookId` in their
  // extensions, and an auto-import that errored silently can leave the
  // pointer set without a real DB row. If we trust the raw pointer the
  // "Edit Embedded Lorebook" button opens an editor that can never resolve
  // (its loading state is `isLoading || !lorebook`, and a 404'd query
  // satisfies the second clause forever), so verify before showing it.
  const linkedLorebookQuery = useLorebook(rawLinkedLorebookId);
  const updateLorebook = useUpdateLorebook();
  const linkedLorebookId =
    rawLinkedLorebookId && (linkedLorebookQuery.isLoading || linkedLorebookQuery.data) ? rawLinkedLorebookId : null;
  const hasEmbeddedLorebook = entries.length > 0 || embeddedLorebookMetadata.hasEmbeddedLorebook === true;

  const isRemoveBlockedByEmbedding = () => {
    if (embedding || isEmbeddingInFlight?.()) {
      toast.error(localizeUi("ui.characters.charactereditor.waitForTheEmbeddedLorebookUpdateToFinishBefore"));
      return true;
    }
    return false;
  };

  const handleImportEmbeddedLorebook = async () => {
    if (!characterId) return;
    if (removing) {
      toast.error(localizeUi("ui.characters.lorebooktab.waitForTheEmbeddedLorebookRemovalToFinishBefore"));
      return;
    }
    setImporting(true);
    try {
      const result = await api.post<{
        success: boolean;
        lorebookId: string;
        entriesImported: number;
        reimported?: boolean;
      }>(`/characters/${characterId}/embedded-lorebook/import`);
      qc.invalidateQueries({ queryKey: lorebookKeys.all });
      if (result.lorebookId) {
        qc.invalidateQueries({ queryKey: ["characters", "detail", characterId] });
      }
      toast.success(
        result.reimported
          ? localizeUi("ui.characters.lorebooktab.reimportedEmbeddedLorebookEntries", {
              count: result.entriesImported,
            })
          : localizeUi("ui.characters.lorebooktab.importedEmbeddedLorebookEntries", {
              count: result.entriesImported,
            }),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.characters.lorebooktab.failedToImportEmbeddedLorebook"),
      );
    } finally {
      setImporting(false);
    }
  };

  const handleRemoveFromCard = async () => {
    if (!characterId || removing) return;
    if (importing) {
      toast.error(localizeUi("ui.characters.lorebooktab.waitForTheEmbeddedLorebookImportToFinishBefore"));
      return;
    }
    if (isRemoveBlockedByEmbedding()) return;
    if (
      !(await showConfirmDialog({
        title: localizeUi("ui.characters.lorebooktab.removeEmbeddedLorebook"),
        message: localizeUi("ui.characters.lorebooktab.removeTheEmbeddedLorebookFromThisCharacterSCard"),
        confirmLabel: localizeUi("ui.characters.lorebooktab.removeFromCard"),
        tone: "destructive",
      }))
    )
      return;
    if (isRemoveBlockedByEmbedding()) return;
    setRemoving(true);
    try {
      await api.delete(`/characters/${characterId}/embedded-lorebook`);
      // Reconcile the editor (patches formData when dirty) then refresh caches so
      // the tab, entries list, and Embedded badge update from server state.
      onUnembed?.();
      qc.invalidateQueries({ queryKey: ["characters", "detail", characterId] });
      qc.invalidateQueries({ queryKey: lorebookKeys.all });
      toast.success(localizeUi("ui.characters.lorebooktab.removedTheEmbeddedLorebookFromTheCard"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.characters.lorebooktab.failedToRemoveEmbeddedLorebook"),
      );
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title={localizeUi("ui.characters.lorebooktab.characterLorebook")}
        subtitle={localizeUi("ui.characters.lorebooktab.worldBuildingEntriesEmbeddedInThisCharacterTriggeredBy")}
        helpText={CHARACTER_LOREBOOK_HELP}
      />

      <LorebookAssignmentSection
        ownerType="character"
        ownerId={characterId}
        ownerName={formData.name}
        embeddedLorebookId={linkedLorebookId}
        slotOccupied={hasEmbeddedLorebook}
        onEmbedded={(result) => onEmbedded?.(result.lorebookId, result.characterBook)}
        onEmbeddingChange={onEmbeddingChange}
      />

      {hasEmbeddedLorebook && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2.5">
          <button
            type="button"
            onClick={handleImportEmbeddedLorebook}
            disabled={!characterId || importing || removing}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              importing || removing || !characterId
                ? "cursor-not-allowed bg-[var(--accent)] text-[var(--muted-foreground)]"
                : "bg-[var(--primary)]/15 text-[var(--primary)] hover:bg-[var(--primary)]/25",
            )}
          >
            {importing ? <Loader2 size="0.75rem" className="animate-spin" /> : <Library size="0.75rem" />}
            {linkedLorebookId
              ? localizeUi("ui.characters.lorebooktab.reimportEmbeddedLorebook")
              : localizeUi("ui.characters.lorebooktab.importEmbeddedLorebook")}
          </button>
          {linkedLorebookId && (
            <button
              type="button"
              onClick={() => openLorebookDetail(linkedLorebookId)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)]/15 px-3 py-1.5 text-xs font-medium text-[var(--primary)] transition-all hover:bg-[var(--primary)]/25"
            >
              <Library size="0.75rem" />
              {localizeUi("ui.characters.lorebooktab.editEmbeddedLorebook")}
            </button>
          )}
          {linkedLorebookId && linkedLorebookQuery.data && (
            <SettingsSwitch
              label={localizeUi("ui.characters.lorebooktab.showInLorebookLibrary")}
              description={localizeUi("ui.characters.lorebooktab.hiddenLorebooksRemainEmbeddedAndEditable")}
              checked={!linkedLorebookQuery.data.hiddenFromLibrary}
              disabled={updateLorebook.isPending}
              onChange={(visible) => {
                updateLorebook.mutate(
                  { id: linkedLorebookId, hiddenFromLibrary: !visible },
                  {
                    onError: (error) =>
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : localizeUi("ui.characters.lorebooktab.failedToUpdateLorebookVisibility"),
                      ),
                  },
                );
              }}
              labelPosition="start"
              className="w-full justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 sm:w-auto sm:min-w-72"
              labelClassName="text-xs"
            />
          )}
          <button
            type="button"
            onClick={handleRemoveFromCard}
            disabled={!characterId || removing || importing || embedding}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
            title={
              embedding
                ? localizeUi("ui.characters.lorebooktab.waitForTheEmbeddedLorebookUpdateToFinish")
                : localizeUi("ui.characters.lorebooktab.removeTheEmbeddedLorebookDataCharacterBookFromThe")
            }
          >
            {removing || embedding ? <Loader2 size="0.75rem" className="animate-spin" /> : <Trash2 size="0.75rem" />}
            {localizeUi("ui.characters.lorebooktab.removeFromCard")}
          </button>
          <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {linkedLorebookId
              ? localizeUi("ui.characters.lorebooktab.editOpensTheLorebookEditorChangesSyncBackInto")
              : localizeUi("ui.characters.lorebooktab.importBakesThisEmbeddedLorebookIntoMarinaraAsAn")}
          </span>
        </div>
      )}

      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <div key={entry.id ?? i} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{entry.name || `Entry #${i + 1}`}</p>
                  <p className="mt-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                    {localizeUi("ui.characters.lorebooktab.keys")} {entry.keys.join(", ")}{" "}
                    {entry.secondary_keys.length > 0 && `· Secondary: ${entry.secondary_keys.join(", ")}`}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[0.625rem] font-medium",
                    entry.enabled
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-[var(--muted-foreground)]/15 text-[var(--muted-foreground)]",
                  )}
                >
                  {entry.enabled
                    ? localizeUi("ui.characters.lorebooktab.active")
                    : localizeUi("ui.characters.lorebooktab.disabled")}
                </span>
              </div>
              <p className="mt-2 text-xs text-[var(--muted-foreground)] line-clamp-3">{entry.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
