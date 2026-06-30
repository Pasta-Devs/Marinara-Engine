// ──────────────────────────────────────────────
// Character Editor — Full-page detail view
// Replaces the chat area when editing a character.
// Sections: Metadata, Card, Lorebook, Advanced
// ──────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
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
  useUploadCharacterGalleryImage,
  useDeleteCharacterGalleryImage,
  useTagCharacterGalleryImage,
  useUploadSprite,
  useDeleteSprite,
  useExportSprites,
  useCleanupSavedSprites,
  useRestoreSpriteCleanupBackup,
  useSpriteCapabilities,
  useCharacterVersions,
  useRestoreCharacterVersion,
  useDeleteCharacterVersion,
  spriteKeys,
  type CharacterGalleryImage,
  type SpriteInfo,
} from "../../hooks/use-characters";
import { useUIStore } from "../../stores/ui.store";
import { lorebookKeys, useLorebook } from "../../hooks/use-lorebooks";
import { useConnections } from "../../hooks/use-connections";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { SpriteGenerationModal } from "../ui/SpriteGenerationModal";
import { AvatarGenerationModal } from "../ui/AvatarGenerationModal";
import { AvatarCropWidget } from "../ui/AvatarCropWidget";
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
} from "lucide-react";
import { cn, generateClientId, getAvatarCropStyle, type AvatarCrop, type LegacyAvatarCrop } from "../../lib/utils";
import { extractColorsFromImage } from "../../lib/avatar-color-extraction";
import { HelpTooltip } from "../ui/HelpTooltip";
import { api } from "../../lib/api-client";
import { ColorPicker } from "../ui/ColorPicker";
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
  type RPGStatPool,
  type RPGStatsConfig,
} from "@marinara-engine/shared";
import { parseTrackerCardColorConfig, serializeTrackerCardColorConfig } from "../../lib/tracker-card-colors";
import { useQuoteFormatter } from "../../hooks/use-quote-formatter";
import { LorebookAssignmentSection } from "../lorebooks/LorebookAssignmentSection";

// ── Tabs ──
const TABS = [
  { id: "metadata", label: "Metadata", icon: User },
  { id: "card", label: "Card", icon: IdCard },
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
  "Use metadata for identity, sharing, and library organization. Name is used as {{char}}, creator/version help track authorship and revisions, tags make the card searchable, talkativeness affects group chat response frequency, and creator notes stay private.";

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
  "Name color is applied to the character's display name in chat. Gradients use CSS linear-gradient. Dialogue color applies to text inside dialogue quotation marks and can optionally be bolded from Settings. Box color sets the background color of the character's message bubble in roleplay mode. Leave any field empty to use the default theme colors.";

const CHARACTER_LOREBOOK_HELP =
  "Attach lorebook/world-info entries to this character. Entries trigger from keywords during conversation; embedded card lorebooks can be imported into Marinara as linked lorebooks for deeper editing.";

interface ParsedCharacter {
  id: string;
  data: string;
  comment: string;
  avatarPath: string | null;
  spriteFolderPath: string | null;
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
  const setDirtyState = useCallback((nextDirty: boolean) => {
    dirtyRef.current = nextDirty;
    setDirty(nextDirty);
  }, []);
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

  const setExtensionValue = useCallback((key: string, value: unknown) => {
    setFormData((prev) => {
      if (!prev) return prev;
      return { ...prev, extensions: { ...(prev.extensions ?? {}), [key]: value } };
    });
  }, []);

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
      toast.error("Wait for the current avatar upload to finish before saving.");
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
      toast.error(err?.message ?? "Failed to save character. Check the console for details.");
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
      toast.error("Wait for the current save to finish before uploading an avatar.");
      return;
    }
    if (!beginAvatarUpload()) {
      e.target.value = "";
      toast.error("Wait for the current avatar upload to finish.");
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
      toast.error("Failed to read avatar image.");
      finishAvatarUpload(uploadToken, uploadCharacterId);
    };
    e.target.value = "";
    try {
      reader.readAsDataURL(file);
    } catch {
      toast.error("Failed to read avatar image.");
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
          toast.success("Character avatar generated.");
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
    ],
  );

  const handleAvatarRemove = useCallback(async () => {
    if (!characterId || !avatarPreview) return;
    if (saving) {
      toast.error("Wait for the current save to finish before removing the avatar.");
      return;
    }
    if (avatarUploadInFlightRef.current) {
      toast.error("Wait for the current avatar upload to finish before removing the avatar.");
      return;
    }

    const confirmed = await showConfirmDialog({
      title: "Remove Avatar",
      message: `Remove the avatar from ${formData?.name || "this character"}? This clears the character card's avatar without deleting the character.`,
      confirmLabel: "Remove",
      tone: "destructive",
    });
    if (!confirmed) return;

    try {
      await removeAvatar.mutateAsync(characterId);
      setAvatarPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Avatar removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove avatar.");
    }
  }, [avatarPreview, characterId, formData?.name, removeAvatar, saving]);

  const handleDelete = async () => {
    if (!characterId) return;
    if (
      !(await showConfirmDialog({
        title: "Delete Character",
        message: "Are you sure you want to delete this character?",
        confirmLabel: "Delete",
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
      toast.error("Character needs a name before it can be imported as a persona.");
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
          toast.error("Persona imported, but the avatar could not be copied.");
          return;
        }
      }

      toast.success(`Imported "${personaName}" as a persona.`);
    } catch (error) {
      console.error("[CharacterEditor] Failed to import character as persona:", error);
      toast.error(error instanceof Error ? error.message : "Failed to import character as persona.");
    }
  }, [avatarPreview, createPersona, formData, getAvatarDataUrl, uploadPersonaAvatar]);

  const handleClose = useCallback(() => {
    if (avatarUploading) {
      toast.error("Wait for the current avatar upload to finish.");
      return;
    }
    if (dirty) {
      setShowUnsavedWarning(true);
      return;
    }
    closeDetail();
  }, [avatarUploading, dirty, closeDetail]);

  const forceClose = useCallback(() => {
    if (avatarUploading) {
      toast.error("Wait for the current avatar upload to finish.");
      return;
    }
    setShowUnsavedWarning(false);
    setDirtyState(false);
    closeDetail();
  }, [avatarUploading, closeDetail, setDirtyState]);

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
  const saveDisabled = !dirty || saving || avatarUploading;
  const saveLabel = avatarUploading ? "Uploading…" : saving ? "Saving…" : "Save";
  const saveButtonClass = cn(
    "mari-editor-action mari-editor-action--primary mari-editor-action--save inline-flex",
    saveDisabled && "cursor-not-allowed opacity-50",
  );

  const headerActions = (
    <>
      <button
        type="button"
        onClick={() => updateExtension("fav", !formData.extensions.fav)}
        className={cn(
          "mari-editor-action inline-flex",
          formData.extensions.fav ? "text-yellow-400" : "text-[var(--muted-foreground)] hover:text-yellow-400",
        )}
        title={formData.extensions.fav ? "Remove from favorites" : "Add to favorites"}
      >
        {formData.extensions.fav ? <Star size="1rem" fill="currentColor" /> : <StarOff size="1rem" />}
      </button>

      <button
        type="button"
        onClick={() => setExportDialogOpen(true)}
        className={headerActionButtonClass}
        title="Export character"
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
        title="Import character as persona"
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
              toast.success("Character duplicated");
            },
          });
        }}
        className="mari-editor-action inline-flex"
        title="Duplicate character"
      >
        <Copy size="1rem" />
      </button>

      <button
        type="button"
        onClick={handleDelete}
        className="mari-editor-action mari-editor-action--danger inline-flex"
        title="Delete character"
      >
        <Trash2 size="1rem" />
      </button>
    </>
  );

  return (
    <div className="mari-editor-shell mari-editor-legacy-bridge flex flex-1 flex-col overflow-hidden">
      <ExportFormatDialog
        open={exportDialogOpen}
        title="Export Character"
        description="Native keeps Marinara metadata. Compatible exports direct Chara Card V2 JSON for other platforms."
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
        title="Generate Character Avatar"
        entityName={formData.name}
        defaultAppearance={
          ((formData.extensions.appearance as string | undefined) || formData.description || formData.personality) ?? ""
        }
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
              !avatarPreview && "mari-avatar-placeholder mari-avatar-placeholder--character",
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt={formData.name}
                className="h-full w-full object-cover"
                style={getAvatarCropStyle(formData.extensions.avatarCrop as AvatarCrop | LegacyAvatarCrop | undefined)}
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
              placeholder="Character name"
            />
            <input
              value={characterComment}
              onChange={(e) => {
                setCharacterComment(e.target.value);
                markDirty();
              }}
              className="mari-editor-subtitle-input"
              placeholder="Title / comment (e.g. 'Modern AU version')"
            />
            <p className="mari-editor-meta text-[0.625rem]">
              {formData.creator ? `by ${formData.creator}` : "No creator"} · v{formData.character_version || "1.0"}
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
            disabled={avatarUploading}
            className="rounded-lg bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-500 transition-all hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Discard & close
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
              <MetadataTab
                characterId={characterId}
                formData={formData}
                characterComment={characterComment}
                updateField={updateField}
                updateExtension={updateExtension}
                newTag={newTag}
                setNewTag={setNewTag}
                addTag={addTag}
                removeTag={removeTag}
                removeAllTags={removeAllTags}
                avatarPreview={avatarPreview}
                onRemoveAvatar={handleAvatarRemove}
                removingAvatar={removeAvatar.isPending}
              />
            )}
            {activeTab === "card" && (
              <CharacterCardTab formData={formData} updateField={updateField} updateExtension={updateExtension} />
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
            {activeTab === "lorebook" && <LorebookTab characterId={characterId} formData={formData} />}
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
  return (
    <div>
      <SectionHeader
        title="Card"
        subtitle="Write the character's core card fields in one focused workspace."
        helpText={CHARACTER_CARD_HELP}
      />
      <EditorSectionJumps items={CHARACTER_CARD_SECTIONS} />
      <div className="space-y-10">
        <EditorSectionAnchor id="character-card-description">
          <CharacterDescriptionTab formData={formData} updateField={updateField} />
        </EditorSectionAnchor>
        <EditorSectionAnchor id="character-card-personality">
          <TextareaTab
            title="Personality"
            subtitle="A concise summary of the character's personality traits, temperament, and behavioral patterns."
            helpText={CHARACTER_PERSONALITY_HELP}
            value={formData.personality}
            onChange={(v) => updateField("personality", v)}
            placeholder="Energetic, curious, and fiercely loyal. Speaks in short bursts. Has a habit of…"
            rows={8}
          />
        </EditorSectionAnchor>
        <EditorSectionAnchor id="character-card-backstory">
          <TextareaTab
            title="Backstory"
            subtitle="The character's history, origin story, and formative life events."
            helpText={CHARACTER_BACKSTORY_HELP}
            value={(formData.extensions.backstory as string) ?? ""}
            onChange={(v) => updateExtension("backstory", v)}
            placeholder="Born in a small village on the outskirts of the empire…"
            rows={12}
          />
        </EditorSectionAnchor>
        <EditorSectionAnchor id="character-card-appearance">
          <TextareaTab
            title="Appearance"
            subtitle="Detailed physical description, height, build, hair, eyes, clothing, distinguishing features."
            helpText={CHARACTER_APPEARANCE_HELP}
            value={(formData.extensions.appearance as string) ?? ""}
            onChange={(v) => updateExtension("appearance", v)}
            placeholder="Tall and willowy with silver-streaked dark hair. Wears a battered leather coat over…"
            rows={8}
          />
        </EditorSectionAnchor>
        <EditorSectionAnchor id="character-card-scenario">
          <TextareaTab
            title="Scenario"
            subtitle="The default setting or situation where interactions take place."
            helpText={CHARACTER_SCENARIO_HELP}
            value={formData.scenario}
            onChange={(v) => updateField("scenario", v)}
            placeholder="A bustling port city during a trade festival. The streets are alive with merchants and performers…"
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
  return (
    <div className="mari-editor-panel space-y-3 p-3">
      <SectionHeader
        title="Description"
        subtitle="The character's general description. This is sent in every prompt as part of the character's identity."
        helpText={CHARACTER_DESCRIPTION_HELP}
      />
      <MacroTextarea
        value={formData.description}
        onChange={(value) => updateField("description", value)}
        placeholder="Describe who this character is, their role, and their key traits…"
        rows={12}
        title="Description"
        className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
      />
      <p className="mt-1.5 text-right text-[0.625rem] text-[var(--muted-foreground)]">
        {formData.description.length} characters
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
  return (
    <div className="mari-editor-panel space-y-3 p-3">
      <SectionHeader title={title} subtitle={subtitle} helpText={helpText} />
      <MacroTextarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        title={title}
        className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
      />
      <p className="mt-1.5 text-right text-[0.625rem] text-[var(--muted-foreground)]">{value.length} characters</p>
    </div>
  );
}

function MetadataTab({
  characterId,
  formData,
  characterComment,
  updateField,
  updateExtension,
  newTag,
  setNewTag,
  addTag,
  removeTag,
  removeAllTags,
  avatarPreview,
  onRemoveAvatar,
  removingAvatar,
}: {
  characterId: string | null;
  formData: CharacterData;
  characterComment: string;
  updateField: <K extends keyof CharacterData>(key: K, value: CharacterData[K]) => void;
  updateExtension: (key: string, value: unknown) => void;
  newTag: string;
  setNewTag: (v: string) => void;
  addTag: () => void;
  removeTag: (tag: string) => void;
  removeAllTags: () => void;
  avatarPreview: string | null;
  onRemoveAvatar: () => void;
  removingAvatar: boolean;
}) {
  // Read existing crop in either current or legacy shape; the widget handles both
  // and writes back the current shape on first interaction.
  const savedCrop = (formData.extensions.avatarCrop as AvatarCrop | LegacyAvatarCrop | undefined) ?? null;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Metadata"
        subtitle="Basic character info — name, creator, version, tags."
        helpText={CHARACTER_METADATA_HELP}
      />

      {characterId && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/70 px-3 py-2">
          <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Character ID
          </span>
          <code className="min-w-0 flex-1 break-all rounded-lg bg-[var(--background)] px-2 py-1 text-[0.6875rem] text-[var(--foreground)]">
            {characterId}
          </code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(characterId);
              toast.success("Character ID copied");
            }}
            className="mari-editor-action inline-flex h-8 px-2 text-[0.6875rem]"
            title="Copy character ID"
          >
            <Copy size="0.75rem" />
            Copy
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
        <label className="space-y-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            Name{" "}
            <HelpTooltip text="The character's display name. This is what appears in chat and is used as {{char}} in prompts." />
          </span>
          <input
            value={formData.name}
            onChange={(e) => updateField("name", e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          />
        </label>
        <label className="space-y-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            Creator{" "}
            <HelpTooltip text="The person who made this character. Useful for giving credit when sharing characters." />
          </span>
          <input
            value={formData.creator}
            onChange={(e) => updateField("creator", e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
            placeholder="Your name"
          />
        </label>
        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            Version <HelpTooltip text="Version number for tracking changes to this character definition over time." />
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
          />
        </div>
        <label className="space-y-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            Talkativeness{" "}
            <HelpTooltip text="How often this character speaks in group chats. 0% = rarely speaks unless addressed, 100% = responds to almost everything." />
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
            Tags{" "}
            <HelpTooltip text="Labels for organizing characters. Use tags like 'fantasy', 'sci-fi', 'OC' etc. to categorize and search." />
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
            placeholder="Add tag…"
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

      {/* Creator Notes */}
      <div className="block space-y-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
          Creator Notes{" "}
          <HelpTooltip text="Private notes about this character — tips for use, known quirks, recommended settings. Not sent to the AI." />
        </span>
        <MacroTextarea
          value={formData.creator_notes}
          onChange={(value) => updateField("creator_notes", value)}
          rows={4}
          title="Creator Notes"
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-sm outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          placeholder="Notes about this character, intended use, tips for best results…"
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

function getVersionTitle(version: CharacterCardVersion): string {
  return version.version?.trim() ? `v${version.version}` : "Untitled version";
}

function CharacterVersionHistoryPanel({
  characterId,
  currentData,
  currentComment,
  currentAvatarPath,
}: {
  characterId: string | null;
  currentData: CharacterData;
  currentComment: string;
  currentAvatarPath: string | null;
}) {
  const { data: versions = [], isLoading } = useCharacterVersions(characterId);
  const restoreVersion = useRestoreCharacterVersion();
  const deleteVersion = useDeleteCharacterVersion();
  const [selectedVersion, setSelectedVersion] = useState<CharacterCardVersion | null>(null);

  if (!characterId) return null;

  const handleRestore = async (version: CharacterCardVersion) => {
    const confirmed = await showConfirmDialog({
      title: "Restore Character Version",
      message: `Restore ${currentData.name || "this character"} to ${getVersionTitle(version)}? The current card will become exactly that saved version without creating another history entry.`,
      confirmLabel: "Restore",
    });
    if (!confirmed) return;
    try {
      await restoreVersion.mutateAsync({ id: characterId, versionId: version.id });
      toast.success(`Restored ${getVersionTitle(version)}.`);
      setSelectedVersion(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore character version.");
    }
  };

  const handleDeleteVersion = async (version: CharacterCardVersion) => {
    const confirmed = await showConfirmDialog({
      title: "Delete Saved Version",
      message: `Delete ${getVersionTitle(version)} from version history? This does not change the current character card.`,
      confirmLabel: "Delete",
      tone: "destructive",
    });
    if (!confirmed) return;
    try {
      await deleteVersion.mutateAsync({ id: characterId, versionId: version.id });
      toast.success(`Deleted ${getVersionTitle(version)}.`);
      setSelectedVersion((current) => (current?.id === version.id ? null : current));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete character version.");
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
          Previous card states will appear here after the next edit.
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
                title="Compare with current card"
              >
                <span className="block truncate text-[0.6875rem] font-medium text-[var(--foreground)]">
                  {getVersionTitle(version)}
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
                className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)] disabled:opacity-50"
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
        title={selectedVersion ? `Compare ${getVersionTitle(selectedVersion)}` : "Compare Version"}
        width="max-w-5xl"
      >
        {selectedVersion && (
          <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto">
            <div className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-xs md:grid-cols-2">
              <div>
                <p className="font-semibold text-[var(--foreground)]">Current card</p>
                <p className="mt-1 text-[var(--muted-foreground)]">
                  v{currentData.character_version || "1.0"}
                  {currentComment ? ` · ${currentComment}` : ""}
                  {currentAvatarPath ? " · has avatar" : ""}
                </p>
              </div>
              <div>
                <p className="font-semibold text-[var(--foreground)]">{getVersionTitle(selectedVersion)}</p>
                <p className="mt-1 text-[var(--muted-foreground)]">
                  {formatVersionTimestamp(selectedVersion.createdAt)}
                  {selectedVersion.reason ? ` · ${selectedVersion.reason}` : ""}
                  {selectedVersion.avatarPath ? " · has avatar" : ""}
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

function DialogueTab({
  formData,
  updateField,
}: {
  formData: CharacterData;
  updateField: <K extends keyof CharacterData>(key: K, value: CharacterData[K]) => void;
}) {
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
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--secondary)] text-[var(--muted-foreground)] transition-all hover:border-[var(--primary)]/40 hover:text-[var(--foreground)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Dialogue & Greetings"
        subtitle="First message, example dialogue, and alternate greetings."
        helpText={CHARACTER_DIALOGUE_HELP}
      />

      {/* First Message */}
      <div className="block space-y-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
          First Message{" "}
          <HelpTooltip text="The character's opening message when a new chat starts. Good first messages set the scene and establish the character's voice." />
        </span>
        <MacroTextarea
          value={formData.first_mes}
          onChange={(value) => updateField("first_mes", value)}
          rows={6}
          title="First Message"
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 text-sm leading-relaxed outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          placeholder="What does the character say when they first meet someone? Use *asterisks* for actions…"
        />
      </div>

      {/* Alternate Greetings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            Alternate Greetings ({formData.alternate_greetings.length})
            <HelpTooltip text="Alternative first messages for variety. When starting a new chat, you can pick which greeting to use." />
          </span>
          <button
            type="button"
            onClick={addGreeting}
            className="rounded-xl bg-[var(--primary)]/15 px-3 py-1 text-xs font-medium text-[var(--primary)] transition-all hover:bg-[var(--primary)]/25"
          >
            + Add
          </button>
        </div>
        {formData.alternate_greetings.map((g, i) => (
          <div
            key={greetingKeysRef.current[i] ?? i}
            className="space-y-2 rounded-xl border border-[var(--border)]/70 bg-[var(--background)]/35 p-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--muted-foreground)]">Greeting #{i + 1}</span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveGreeting(i, -1)}
                  disabled={i === 0}
                  className={greetingActionButtonClassName}
                  aria-label={`Move alternate greeting ${i + 1} up`}
                  title="Move up"
                >
                  <ArrowUp size="0.75rem" />
                </button>
                <button
                  type="button"
                  onClick={() => moveGreeting(i, 1)}
                  disabled={i === formData.alternate_greetings.length - 1}
                  className={greetingActionButtonClassName}
                  aria-label={`Move alternate greeting ${i + 1} down`}
                  title="Move down"
                >
                  <ArrowDown size="0.75rem" />
                </button>
                <button
                  type="button"
                  onClick={() => removeGreeting(i)}
                  className={cn(
                    greetingActionButtonClassName,
                    "hover:border-[var(--destructive)]/40 hover:text-[var(--destructive)]",
                  )}
                  aria-label={`Remove alternate greeting ${i + 1}`}
                  title="Remove greeting"
                >
                  <Trash2 size="0.75rem" />
                </button>
              </div>
            </div>
            <MacroTextarea
              value={g}
              onChange={(value) => updateGreeting(i, value)}
              rows={3}
              title={`Alternate Greeting #${i + 1}`}
              className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-sm outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40"
              placeholder={`Greeting #${i + 1}...`}
            />
          </div>
        ))}
      </div>

      {/* Example Messages */}
      <div className="block space-y-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
          Example Dialogue{" "}
          <HelpTooltip text="Sample conversations showing how the character talks. Helps the AI learn the character's speaking style, vocabulary, and mannerisms." />
        </span>
        <p className="text-[0.625rem] text-[var(--muted-foreground)]/70">
          {"Use <START> to separate exchanges. Use {{user}} and {{char}} as placeholders."}
        </p>
        <MacroTextarea
          value={formData.mes_example}
          onChange={(value) => updateField("mes_example", value)}
          rows={10}
          title="Example Dialogue"
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 font-mono text-xs leading-relaxed outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          placeholder={"<START>\n{{user}}: Hello!\n{{char}}: *waves excitedly* Hey there!"}
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
  const depthPrompt = formData.extensions.depth_prompt ?? { prompt: "", depth: 4, role: "system" as const };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Advanced"
        subtitle="System prompt, post-history instructions, and depth prompt injection."
        helpText={CHARACTER_ADVANCED_HELP}
      />

      <div className="block space-y-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
          System Prompt{" "}
          <HelpTooltip text="Character-specific instructions inserted by the prompt preset's character block or wherever the preset uses {{charSysInfo}}. This does not replace the chat's main system prompt." />
        </span>
        <MacroTextarea
          value={formData.system_prompt}
          onChange={(value) => updateField("system_prompt", value)}
          rows={6}
          title="System Prompt"
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 text-sm outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          placeholder="Character-specific instructions inserted through {{charSysInfo}} or the character prompt block…"
        />
      </div>

      <div className="block space-y-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)]">
          Post-History Instructions{" "}
          <HelpTooltip text="Text inserted after the chat history, right before the AI generates. Great for reminders like 'stay in character' or 'respond in 2 paragraphs'." />
        </span>
        <MacroTextarea
          value={formData.post_history_instructions}
          onChange={(value) => updateField("post_history_instructions", value)}
          rows={4}
          title="Post-History Instructions"
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-4 text-sm outline-none placeholder:text-[var(--muted-foreground)]/40 focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          placeholder="Text inserted after the chat history but before generation…"
        />
      </div>

      {/* Depth Prompt */}
      <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <span className="inline-flex items-center gap-1 text-xs font-semibold">
          Depth Prompt{" "}
          <HelpTooltip text="Injects text at a specific position in the chat history. Depth 0 = after the latest message, depth 4 = 4 messages back. Useful for persistent reminders." />
        </span>
        <MacroTextarea
          value={depthPrompt.prompt}
          onChange={(value) => updateExtension("depth_prompt", { ...depthPrompt, prompt: value })}
          rows={4}
          title="Depth Prompt"
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-sm outline-none focus:border-[var(--primary)]/40"
          placeholder="Prompt injected at a specific depth in the chat history…"
        />
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-xs">
            <span className="text-[var(--muted-foreground)]">Depth</span>
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
            <span className="text-[var(--muted-foreground)]">Role</span>
            <select
              value={depthPrompt.role}
              onChange={(e) => updateExtension("depth_prompt", { ...depthPrompt, role: e.target.value })}
              className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-xs outline-none"
            >
              <option value="system">System</option>
              <option value="user">User</option>
              <option value="assistant">Assistant</option>
            </select>
          </label>
        </div>
      </div>

      <CharacterRegexSection characterId={characterId} characterName={formData.name} />
    </div>
  );
}

// ── Sprites Tab ──

function CharacterGalleryTab({ characterId, characterName }: { characterId: string; characterName?: string }) {
  const { data: images, isLoading } = useCharacterGalleryImages(characterId);
  const upload = useUploadCharacterGalleryImage(characterId);
  const remove = useDeleteCharacterGalleryImage(characterId);
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
          title: "Delete Character Image",
          message: "Delete this character gallery image?",
          confirmLabel: "Delete",
          tone: "destructive",
        }))
      ) {
        return;
      }
      remove.mutate(image.id);
      if (lightbox?.id === image.id) setLightbox(null);
    },
    [lightbox?.id, remove],
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Character Gallery"
        subtitle="Keep reference art, alternate outfits, and other character images attached to this character even if chats get deleted."
        helpText={CHARACTER_GALLERY_HELP}
      />

      <ImageUploadDropzone
        label="Upload Character Images"
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
                    className="rounded-lg bg-red-500/35 p-1.5 text-white transition-colors hover:bg-red-500/55"
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
            <p className="text-sm font-medium text-[var(--muted-foreground)]">No character images yet</p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]/60">
              Upload images here to keep them tied to {characterName || "this character"} instead of a specific chat.
            </p>
          </div>
        </div>
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
  type SpriteCategory = "expressions" | "full-body";

  const { data: sprites, isLoading } = useCharacterSprites(characterId);
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
    category === "full-body" ? s.expression.startsWith("full_") : !s.expression.startsWith("full_"),
  );
  const existingExpressions = new Set(
    visibleSprites.map((s) => (category === "full-body" ? s.expression.replace(/^full_/, "") : s.expression)),
  );
  const suggestedExpressions = DEFAULT_EXPRESSIONS.filter((e) => !existingExpressions.has(e));
  const spriteGenerationUnavailable = spriteCapabilities?.spriteGenerationAvailable === false;
  const spriteGenerationReason = spriteCapabilities?.reason ?? "Sprite generation is unavailable on this platform.";
  const backgroundCleanupUnavailable = spriteCapabilities?.backgroundRemovalAvailable === false;
  const backgroundCleanupReason = spriteCapabilities?.reason ?? "Background cleanup is unavailable on this platform.";
  const backgroundRemoverUnavailable = spriteCapabilities?.backgroundRemover?.installed === false;
  const backgroundRemoverReason =
    spriteCapabilities?.backgroundRemover?.reason ?? "Local backgroundremover is not installed.";

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

  const startUpload = (expression: string) => {
    if (!expression) return;
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
        const folderName = sanitizeSpriteExportFolderName(`${characterName || "character"}-${scopeLabel}`, "sprites");
        await exportSprites.mutateAsync({
          characterId,
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
    [category, characterId, characterName, exportSprites],
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
        characterId,
        expressions: visibleSprites.map((sprite) => sprite.expression),
        cleanupStrength: savedCleanupStrength,
        engine: "auto",
      });

      if (result.processed > 0) {
        setLastCleanupBackupId(result.backupId ?? null);
        const engineDetails =
          result.backgroundRemoverProcessed && result.builtinProcessed
            ? ` with backgroundremover and built-in fallback`
            : result.backgroundRemoverProcessed
              ? ` with backgroundremover`
              : ` with built-in cleanup`;
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
  }, [category, characterId, cleanupSavedSprites, savedCleanupStrength, visibleSprites]);

  const handleRestoreLastCleanup = useCallback(async () => {
    if (!lastCleanupBackupId) return;
    setRestoringCleanup(true);
    try {
      const result = await restoreSpriteCleanupBackup.mutateAsync({
        characterId,
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
  }, [characterId, lastCleanupBackupId, restoreSpriteCleanupBackup]);

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
        toast.success(`Framed ${displayExpression(framingSprite.expression)} sprite.`);
        setFramingSprite(null);
      } finally {
        setSavingFrame(false);
      }
    },
    [characterId, displayExpression, framingSprite, uploadSprite],
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
        toast.success(`Cleaned ${displayExpression(wandCleanupSprite.expression)} sprite.`);
        setWandCleanupSprite(null);
      } finally {
        setSavingWandCleanup(false);
      }
    },
    [characterId, displayExpression, uploadSprite, wandCleanupSprite],
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Character Sprites"
        subtitle="Upload VN-style sprites for different expressions. The Expression Engine agent will select the appropriate sprite during roleplay."
        helpText={CHARACTER_SPRITES_HELP}
      />

      <div className="inline-flex rounded-xl bg-[var(--secondary)] p-1 ring-1 ring-[var(--border)]">
        <button
          type="button"
          onClick={() => setCategory("expressions")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            category === "expressions"
              ? "bg-[var(--primary)]/15 text-[var(--primary)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
          )}
        >
          Facial Expressions
        </button>
        <button
          type="button"
          onClick={() => setCategory("full-body")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            category === "full-body"
              ? "bg-[var(--primary)]/15 text-[var(--primary)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
          )}
        >
          Full-body
        </button>
      </div>

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
              title="Select a folder of PNGs — each filename becomes the expression name"
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

        {/* Folder upload progress */}
        {folderProgress && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
            <Loader2 size="0.75rem" className="animate-spin text-[var(--primary)]" />
            Uploading {folderProgress.done}/{folderProgress.total} sprites…
          </div>
        )}
        {cleaningSprites && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
            <Loader2 size="0.75rem" className="animate-spin text-[var(--primary)]" />
            Running local backgroundremover on saved sprites…
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
        {backgroundRemoverUnavailable && !backgroundCleanupUnavailable && (
          <div className="rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
            {backgroundRemoverReason}
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

        {/* Quick expression buttons */}
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
                    className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
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
                  className="mr-auto inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--destructive)] ring-1 ring-[var(--destructive)]/30 transition-colors hover:bg-[var(--destructive)]/10 disabled:opacity-50 sm:px-3 sm:text-sm"
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
        entityId={characterId}
        initialSpriteType={category === "full-body" ? "full-body" : "expressions"}
        existingExpressionNames={portraitExpressionNames}
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
  const stats: RPGStatsConfig = (formData.extensions.rpgStats as RPGStatsConfig) ?? DEFAULT_RPG_STATS;
  const pools = normalizeRpgStatPools(stats);

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

  return (
    <div className="space-y-6">
      <SectionHeader
        title="RPG Stats"
        subtitle="Toggle stat tracking for this character. When enabled, the character's stats are included in the prompt and tracked by agents."
        helpText={CHARACTER_STATS_HELP}
      />

      <SettingsSwitch
        label={<span className="font-medium">Enable RPG Stats</span>}
        description="Stats will be injected into the prompt and tracked by the Character Tracker agent."
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
              <h3 className="text-sm font-semibold">Pools</h3>
              <button
                type="button"
                onClick={() => updatePools([...pools, createNewRpgPool(pools)])}
                className="mari-chrome-accent-surface mari-accent-animated flex items-center gap-1 rounded-lg px-2.5 py-1 text-[0.6875rem] font-medium transition-colors"
              >
                <Plus size="0.75rem" />
                Add
              </button>
            </div>
            <div className="space-y-2">
              {pools.map((pool, i) => (
                <div
                  key={i}
                  className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 sm:grid-cols-[2rem_minmax(0,1fr)_5rem_5rem_auto] sm:items-center"
                >
                  <input
                    type="color"
                    value={pool.color}
                    onChange={(e) => updatePool(i, { color: e.target.value })}
                    className="h-8 w-8 rounded border border-[var(--border)] bg-transparent p-0.5"
                    aria-label={`${pool.name || "Pool"} color`}
                  />
                  <input
                    value={pool.name}
                    onChange={(e) => updatePool(i, { name: e.target.value })}
                    className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs font-medium"
                    placeholder="Name"
                  />
                  <input
                    type="number"
                    value={pool.value}
                    onChange={(e) => updatePool(i, { value: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-center text-xs"
                    min={0}
                    aria-label={`${pool.name || "Pool"} value`}
                  />
                  <input
                    type="number"
                    value={pool.max}
                    onChange={(e) => updatePool(i, { max: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-center text-xs"
                    min={1}
                    aria-label={`${pool.name || "Pool"} max`}
                  />
                  <button
                    type="button"
                    onClick={() => updatePools(pools.filter((_, poolIndex) => poolIndex !== i))}
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Attributes</h3>
              <button
                type="button"
                onClick={addAttribute}
                className="mari-chrome-accent-surface mari-accent-animated flex items-center gap-1 rounded-lg px-2.5 py-1 text-[0.6875rem] font-medium transition-colors"
              >
                <Plus size="0.75rem" />
                Add
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
                    placeholder="Name"
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
        title="Character Colors"
        subtitle="Customize how this character appears in chats. Colors are applied to the name, dialogue, and message bubble."
        helpText={CHARACTER_COLORS_HELP}
      />

      {/* Extract from avatar button */}
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

      {/* Preview card */}
      <div className="rounded-xl border border-[var(--border)] bg-black/30 p-4 space-y-3">
        <p className="text-[0.625rem] font-medium uppercase tracking-widest text-[var(--muted-foreground)]">Preview</p>
        <div className="flex gap-3">
          <div className="mari-chrome-accent-tile mari-accent-animated flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-2 ring-[var(--marinara-chat-chrome-button-border-active)]">
            <User size="1rem" className="text-white" />
          </div>
          <div className="flex-1 space-y-1">
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
              <span className="text-white/90">*She looks at you with a warm smile.* </span>
              <strong style={dialogueColor ? { color: dialogueColor } : { color: "rgb(255, 255, 255)" }}>
                &ldquo;Hello there! How are you?&rdquo;
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
        label="Name Display Color"
        helpText="The color (or gradient) used for the character's name in chat messages and sidebar tabs. Supports gradients!"
      />

      {/* Dialogue Color */}
      <ColorPicker
        value={dialogueColor}
        onChange={(v) => updateExtension("dialogueColor", v)}
        label="Dialogue Highlight Color"
        helpText={
          'Text inside dialogue quotation marks ("", “”, «», 「」, 『』) will be automatically colored with this, and can also be bolded from Settings.'
        }
      />

      {/* Box Color */}
      <ColorPicker
        value={boxColor}
        onChange={(v) => updateExtension("boxColor", v)}
        label="Message Box Color"
        helpText="Background color for this character's chat message bubbles. Use a semi-transparent color for best results (e.g. rgba)."
      />
    </div>
  );
}

function LorebookTab({ characterId, formData }: { characterId: string | null; formData: CharacterData }) {
  const book = formData.character_book;
  const entries = book?.entries ?? [];
  const qc = useQueryClient();
  const openLorebookDetail = useUIStore((s) => s.openLorebookDetail);
  const [importing, setImporting] = useState(false);
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
  // "Edit Linked Lorebook" button opens an editor that can never resolve
  // (its loading state is `isLoading || !lorebook`, and a 404'd query
  // satisfies the second clause forever), so verify before showing it.
  const linkedLorebookQuery = useLorebook(rawLinkedLorebookId);
  const linkedLorebookId =
    rawLinkedLorebookId && (linkedLorebookQuery.isLoading || linkedLorebookQuery.data) ? rawLinkedLorebookId : null;
  const hasEmbeddedLorebook = entries.length > 0 || embeddedLorebookMetadata.hasEmbeddedLorebook === true;

  const handleImportEmbeddedLorebook = async () => {
    if (!characterId) return;
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
          ? `Reimported ${result.entriesImported} embedded lorebook entr${result.entriesImported === 1 ? "y" : "ies"}`
          : `Imported ${result.entriesImported} embedded lorebook entr${result.entriesImported === 1 ? "y" : "ies"}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import embedded lorebook");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Character Lorebook"
        subtitle="World-building entries embedded in this character. Triggered by keywords in conversation."
        helpText={CHARACTER_LOREBOOK_HELP}
      />

      <LorebookAssignmentSection ownerType="character" ownerId={characterId} ownerName={formData.name} />

      {hasEmbeddedLorebook && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2.5">
          <button
            type="button"
            onClick={handleImportEmbeddedLorebook}
            disabled={!characterId || importing}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              importing || !characterId
                ? "cursor-not-allowed bg-[var(--accent)] text-[var(--muted-foreground)]"
                : "bg-[var(--primary)]/15 text-[var(--primary)] hover:bg-[var(--primary)]/25",
            )}
          >
            {importing ? <Loader2 size="0.75rem" className="animate-spin" /> : <Library size="0.75rem" />}
            {linkedLorebookId ? "Reimport Embedded Lorebook" : "Import Embedded Lorebook"}
          </button>
          {linkedLorebookId && (
            <button
              type="button"
              onClick={() => openLorebookDetail(linkedLorebookId)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)]/15 px-3 py-1.5 text-xs font-medium text-[var(--primary)] transition-all hover:bg-[var(--primary)]/25"
            >
              <Library size="0.75rem" />
              Edit Linked Lorebook
            </button>
          )}
          <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {linkedLorebookId
              ? "Opens the lorebook editor where you can add, edit, or delete entries."
              : "Imports this embedded lorebook into Marinara as a linked lorebook."}
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
                    Keys: {entry.keys.join(", ")}{" "}
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
                  {entry.enabled ? "Active" : "Disabled"}
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
