import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  ChevronDown,
  IdCard,
  ImageIcon,
  ImagePlus,
  PencilLine,
  RotateCcw,
  Sticker,
  Wand2,
  X,
  ZoomIn,
} from "lucide-react";
import { toast } from "sonner";
import { useConnections, useImageReferencePictureLimit } from "../../hooks/use-connections";
import { useCharacterGalleryImages, usePersonaGalleryImages } from "../../hooks/use-characters";
import { useGlobalGalleryImages } from "../../hooks/use-global-gallery";
import { useUIStore } from "../../stores/ui.store";
import { api } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";
import { SHEET_BUTTON_PRIMARY, SHEET_BUTTON_QUIET, SHEET_BUTTON_SECONDARY } from "./neutral-surface-styles";
import { NeedsModelChip } from "../connections/NeedsModelChip";
import { ConnectionSelect } from "../connections/ConnectionSelect";
import { FullImageView } from "./AvatarCropWidget";
import { ImagePromptReviewModal, type ImagePromptOverride, type ImagePromptReviewItem } from "./ImagePromptReviewModal";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  gallerySheetGrid,
  MAX_IMAGE_REFERENCE_PICTURES,
  parseGallerySheetNames,
  type GalleryTagKind,
  type ImageReferenceRole,
} from "@marinara-engine/shared";
import {
  ImageReferenceChooser,
  ImageReferenceGrid,
  ImageReferenceRow,
  type ImageReferenceSource,
  type PickedImageReference,
} from "./ImageReferencePicker";
import { sentImageReferences } from "../../lib/image-references";
import { useMatchMedia } from "../../hooks/use-match-media";
import { GallerySheetCells, useGallerySheetCells, type GallerySheetCut } from "./GallerySheetCells";

/** What the gallery's "Create with AI" can make. Sticker and emoji sheets save one picture per cell. */
export type GalleryCreateKind = "character-sheet" | "background" | "sticker-sheet" | "emoji-sheet";

export const GALLERY_CREATE_KINDS: readonly GalleryCreateKind[] = [
  "character-sheet",
  "background",
  "sticker-sheet",
  "emoji-sheet",
];

export type GalleryCreateResult =
  | { kind: "character-sheet" | "background"; dataUrl: string }
  | { kind: "sticker-sheet" | "emoji-sheet"; items: GallerySheetCut[] };

/** Gallery "Create with AI": a type picker, each type with its own starting prompt, and one save for all. */
export type GalleryCreateOptions = {
  seeds: Record<GalleryCreateKind, string>;
  onSave: (result: GalleryCreateResult) => Promise<void>;
};

const DEFAULT_STICKER_NAMES = "happy, laughing, sad, angry, surprised, love, thinking, sleepy, thumbs up";
const DEFAULT_EMOJI_NAMES = "smile, laugh, cry, angry, shocked, heart eyes, thinking, sleepy, wink";

const GALLERY_KIND_LABEL_KEY: Record<GalleryCreateKind, string> = {
  "character-sheet": "ui.ui.avatargenerationmodal.kindCharacterSheet",
  background: "ui.ui.avatargenerationmodal.kindBackground",
  "sticker-sheet": "ui.ui.avatargenerationmodal.kindStickerSheet",
  "emoji-sheet": "ui.ui.avatargenerationmodal.kindEmojiSheet",
};

type AvatarGenerationModalProps = {
  open: boolean;
  title: string;
  mode?: "avatar" | "character-sheet" | "cover";
  /** Offer the gallery's types (character sheet, background, stickers, emoji); `mode` is then ignored. */
  galleryCreate?: GalleryCreateOptions;
  entityName: string;
  defaultAppearance?: string;
  defaultAvatarUrl?: string | null;
  neutralFullBodyReferenceUrl?: string | null;
  /** Whose gallery the References chooser offers first. */
  referenceGallery?: { kind: "character" | "persona"; id: string | null };
  onClose: () => void;
  onUseAvatar: (avatarDataUrl: string) => Promise<void> | void;
};

type AvatarGenerationResponse = {
  image: string;
  prompt: string;
};

type ImageConnectionOption = {
  id: string;
  name: string;
  model?: string;
  provider?: string;
  defaultForAgents?: boolean | string;
};

function isDefaultImageConnection(connection: ImageConnectionOption): boolean {
  return connection.defaultForAgents === true || connection.defaultForAgents === "true";
}

/** Larger uploads are refused: they would make the request heavy for every model. */
const MAX_REFERENCE_UPLOAD_BYTES = 20 * 1024 * 1024;

function galleryPictureRole(kind: GalleryTagKind | null | undefined): ImageReferenceRole {
  if (kind === "background") return "place";
  if (kind === "sticker" || kind === "emoji") return "style";
  return "likeness";
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error()));
    reader.onerror = () => reject(reader.error ?? new Error());
    reader.readAsDataURL(file);
  });
}

/** The Engine-wide gallery, fetched only once its tab is opened. */
function GlobalGalleryReferenceGrid(props: {
  addedKeys: ReadonlySet<string>;
  selectedKeys: readonly string[];
  onToggle: (source: ImageReferenceSource) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { data, isLoading } = useGlobalGalleryImages();
  const sources = useMemo<ImageReferenceSource[]>(
    () =>
      (data ?? []).map((image) => ({
        key: `global:${image.id}`,
        url: image.url,
        label:
          image.customName ||
          image.description?.trim() ||
          image.prompt?.trim() ||
          localizeUi("ui.ui.imagereferencepicker.galleryPicture"),
        role: galleryPictureRole(image.customKind as GalleryTagKind | null),
      })),
    [data, localizeUi],
  );
  return <ImageReferenceGrid {...props} sources={sources} loading={isLoading} />;
}

async function imageUrlToDataUrl(src: string, errorMessage: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const response = await fetch(src);
  if (!response.ok) throw new Error(errorMessage);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error(errorMessage));
    };
    reader.onerror = () => reject(new Error(errorMessage));
    reader.readAsDataURL(blob);
  });
}

export function AvatarGenerationModal({
  open,
  title,
  mode: fixedMode = "avatar",
  galleryCreate,
  entityName,
  defaultAppearance,
  defaultAvatarUrl,
  neutralFullBodyReferenceUrl,
  referenceGallery,
  onClose,
  onUseAvatar,
}: AvatarGenerationModalProps) {
  const { t: localizeUi } = useUiTranslation();
  const { data: connectionsList } = useConnections();
  const reviewImagePromptsBeforeSend = useUIStore((s) => s.reviewImagePromptsBeforeSend);
  const imagePortraitWidth = useUIStore((s) => s.imagePortraitWidth);
  const imagePortraitHeight = useUIStore((s) => s.imagePortraitHeight);
  const imageCharacterSheetWidth = useUIStore((s) => s.imageCharacterSheetWidth);
  const imageCharacterSheetHeight = useUIStore((s) => s.imageCharacterSheetHeight);
  const imageBackgroundWidth = useUIStore((s) => s.imageBackgroundWidth);
  const imageBackgroundHeight = useUIStore((s) => s.imageBackgroundHeight);
  const [galleryKind, setGalleryKind] = useState<GalleryCreateKind>("character-sheet");
  const mode = galleryCreate ? galleryKind : fixedMode;
  /** Each type keeps its own prompt draft while the dialog is open, so switching back loses nothing. */
  const galleryDraftsRef = useRef<Partial<Record<GalleryCreateKind, string>>>({});
  const [stickerNames, setStickerNames] = useState<Record<"sticker-sheet" | "emoji-sheet", string>>({
    "sticker-sheet": DEFAULT_STICKER_NAMES,
    "emoji-sheet": DEFAULT_EMOJI_NAMES,
  });
  const debugMode = useUIStore((s) => s.debugMode);
  const [appearance, setAppearance] = useState(defaultAppearance ?? "");
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [references, setReferences] = useState<PickedImageReference[]>([]);
  /** Until the References row is changed by hand, switching the type swaps in that type's starting pictures. */
  const referencesTouchedRef = useRef(false);
  const uploadCountRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [chooserTab, setChooserTab] = useState("own");
  const [chooserSelection, setChooserSelection] = useState<ImageReferenceSource[]>([]);
  const [dropActive, setDropActive] = useState(false);
  const dragDepthRef = useRef(0);
  const [generatedAvatar, setGeneratedAvatar] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [showFullView, setShowFullView] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewItems, setReviewItems] = useState<ImagePromptReviewItem[]>([]);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  /** The whole prompt, opened for editing: sent exactly as written instead of the one built from the fields. */
  const [fullPrompt, setFullPrompt] = useState<ImagePromptReviewItem | null>(null);
  const [fullPromptLoading, setFullPromptLoading] = useState(false);
  const reviewResolveRef = useRef<((overrides: ImagePromptOverride[] | null) => void) | null>(null);

  const imageConnections = useMemo(() => {
    if (!connectionsList) return [];
    return (connectionsList as ImageConnectionOption[])
      .filter((connection) => connection.provider === "image_generation")
      .sort((a, b) => Number(isDefaultImageConnection(b)) - Number(isDefaultImageConnection(a)));
  }, [connectionsList]);
  const defaultImageConnectionId = imageConnections.find(isDefaultImageConnection)?.id ?? null;
  const effectiveConnectionId = connectionId ?? defaultImageConnectionId ?? imageConnections[0]?.id ?? null;
  const isCharacterSheet = mode === "character-sheet";
  const isCover = mode === "cover";
  const isBackground = mode === "background";
  const isStickerSheet = mode === "sticker-sheet" || mode === "emoji-sheet";
  const isWide = isCharacterSheet || isBackground;
  const sheetNames = useMemo(
    () => (isStickerSheet ? parseGallerySheetNames(stickerNames[mode]) : []),
    [isStickerSheet, mode, stickerNames],
  );
  const sheetGrid = gallerySheetGrid(sheetNames.length);
  const canvasWidth = isCharacterSheet
    ? imageCharacterSheetWidth
    : isBackground
      ? imageBackgroundWidth
      : imagePortraitWidth;
  // Covers and sticker sheets are square: the portrait width serves both sides (the server does the same).
  const canvasHeight = isCharacterSheet
    ? imageCharacterSheetHeight
    : isBackground
      ? imageBackgroundHeight
      : isCover || isStickerSheet
        ? imagePortraitWidth
        : imagePortraitHeight;
  const sheetCells = useGallerySheetCells(mode === "emoji-sheet" ? "emoji" : "sticker");
  const referenceLimit = useImageReferencePictureLimit(open ? effectiveConnectionId : null);
  const referenceModelName = imageConnections.find((connection) => connection.id === effectiveConnectionId)?.name;
  // On a computer the chooser takes the right column and the form stays beside it; touch screens get a page.
  const chooserInColumn = useMatchMedia("(min-width: 1024px) and (pointer: fine)");
  const busy = generating || saving;

  /** The avatar and the character sheet start as the likeness; a background shows the place, so it starts empty. */
  const startingReferences = useCallback(
    (forMode: string): PickedImageReference[] => {
      if (forMode === "background") return [];
      const starting: PickedImageReference[] = [];
      if (defaultAvatarUrl) {
        starting.push({
          key: "avatar",
          url: defaultAvatarUrl,
          label: localizeUi(
            forMode === "cover" ? "ui.ui.imagereferencepicker.cover" : "ui.ui.imagereferencepicker.avatar",
          ),
          role: forMode === "cover" ? "other" : "likeness",
        });
      }
      if (neutralFullBodyReferenceUrl && forMode !== "cover") {
        starting.push({
          key: "full-body",
          url: neutralFullBodyReferenceUrl,
          label: localizeUi("ui.ui.imagereferencepicker.fullBody"),
          role: "likeness",
        });
      }
      return starting;
    },
    [defaultAvatarUrl, localizeUi, neutralFullBodyReferenceUrl],
  );
  const changeReferences = useCallback((next: PickedImageReference[]) => {
    referencesTouchedRef.current = true;
    setReferences(next);
  }, []);
  const addReferences = useCallback(
    (items: PickedImageReference[]) => {
      if (items.length === 0) return;
      setReferences((current) => {
        const fresh = items.filter((item) => !current.some((reference) => reference.key === item.key));
        const room = Math.max(0, MAX_IMAGE_REFERENCE_PICTURES - current.length);
        if (fresh.length > room) toast.warning(localizeUi("ui.ui.imagereferencepicker.tooMany", { count: room }));
        return [...current, ...fresh.slice(0, room)];
      });
      referencesTouchedRef.current = true;
    },
    [localizeUi],
  );
  const addReferenceFiles = useCallback(
    async (files: File[]) => {
      const picked: PickedImageReference[] = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          toast.error(localizeUi("ui.ui.imagereferencepicker.notAnImage", { name: file.name }));
          continue;
        }
        if (file.size > MAX_REFERENCE_UPLOAD_BYTES) {
          toast.error(localizeUi("ui.ui.imagereferencepicker.tooLarge", { name: file.name }));
          continue;
        }
        try {
          uploadCountRef.current += 1;
          picked.push({
            key: `upload:${uploadCountRef.current}`,
            url: await readFileAsDataUrl(file),
            label: file.name,
            role: "other",
          });
        } catch {
          toast.error(localizeUi("ui.ui.imagereferencepicker.readFailed", { name: file.name }));
        }
      }
      addReferences(picked);
    },
    [addReferences, localizeUi],
  );

  const characterGallery = useCharacterGalleryImages(
    chooserOpen && referenceGallery?.kind === "character" ? referenceGallery.id : null,
  );
  const personaGallery = usePersonaGalleryImages(
    chooserOpen && referenceGallery?.kind === "persona" ? referenceGallery.id : null,
  );
  const ownGallery = referenceGallery?.kind === "persona" ? personaGallery : characterGallery;
  const ownSources = useMemo<ImageReferenceSource[]>(() => {
    const sources: ImageReferenceSource[] = [];
    if (defaultAvatarUrl) {
      sources.push({
        key: "avatar",
        url: defaultAvatarUrl,
        label: localizeUi(isCover ? "ui.ui.imagereferencepicker.cover" : "ui.ui.imagereferencepicker.avatar"),
        role: isCover ? "other" : "likeness",
      });
    }
    if (neutralFullBodyReferenceUrl) {
      sources.push({
        key: "full-body",
        url: neutralFullBodyReferenceUrl,
        label: localizeUi("ui.ui.imagereferencepicker.fullBody"),
        role: "likeness",
      });
    }
    for (const image of ownGallery.data ?? []) {
      sources.push({
        key: `gallery:${image.id}`,
        url: image.url,
        label:
          image.customName ||
          image.description?.trim() ||
          image.prompt?.trim() ||
          localizeUi("ui.ui.imagereferencepicker.galleryPicture"),
        role: galleryPictureRole(image.customKind),
      });
    }
    return sources;
  }, [defaultAvatarUrl, isCover, localizeUi, neutralFullBodyReferenceUrl, ownGallery.data]);
  const addedReferenceKeys = useMemo(() => new Set(references.map((reference) => reference.key)), [references]);
  const chooserRoom = Math.max(0, MAX_IMAGE_REFERENCE_PICTURES - references.length);
  const toggleChooserSource = useCallback(
    (source: ImageReferenceSource) =>
      setChooserSelection((current) =>
        current.some((item) => item.key === source.key)
          ? current.filter((item) => item.key !== source.key)
          : current.length >= chooserRoom
            ? current
            : [...current, source],
      ),
    [chooserRoom],
  );
  const openChooser = () => {
    setChooserSelection([]);
    setChooserTab("own");
    setChooserOpen(true);
  };
  const closeChooser = () => {
    setChooserOpen(false);
    setChooserSelection([]);
  };
  const confirmChooser = () => {
    addReferences(chooserSelection);
    closeChooser();
  };
  const hasFiles = (event: React.DragEvent) => Array.from(event.dataTransfer.types).includes("Files");

  useEffect(() => {
    if (!open) return;
    galleryDraftsRef.current = {};
    setStickerNames({ "sticker-sheet": DEFAULT_STICKER_NAMES, "emoji-sheet": DEFAULT_EMOJI_NAMES });
    setGalleryKind("character-sheet");
    sheetCells.reset();
    setAppearance(galleryCreate ? galleryCreate.seeds["character-sheet"] : (defaultAppearance ?? ""));
    setReferences(startingReferences(galleryCreate ? "character-sheet" : fixedMode));
    referencesTouchedRef.current = false;
    setChooserOpen(false);
    setChooserSelection([]);
    setDropActive(false);
    dragDepthRef.current = 0;
    setGeneratedAvatar(null);
    setGeneratedPrompt("");
    setShowFullView(false);
    setReviewItems([]);
    setReviewSubmitting(false);
    setFullPrompt(null);
    // Seeds are read when the dialog opens; edits made since stay until it closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultAppearance, defaultAvatarUrl, open]);

  const switchGalleryKind = useCallback(
    (next: GalleryCreateKind) => {
      if (!galleryCreate || next === galleryKind) return;
      galleryDraftsRef.current[galleryKind] = appearance;
      setGalleryKind(next);
      if (!referencesTouchedRef.current) setReferences(startingReferences(next));
      setAppearance(galleryDraftsRef.current[next] ?? galleryCreate.seeds[next] ?? "");
      setGeneratedAvatar(null);
      setGeneratedPrompt("");
      setShowFullView(false);
      setFullPrompt(null);
      sheetCells.reset();
    },
    [appearance, galleryCreate, galleryKind, sheetCells.reset, startingReferences],
  );

  useEffect(() => {
    if (!open) return;
    if (effectiveConnectionId) setConnectionId(effectiveConnectionId);
  }, [effectiveConnectionId, open]);

  useEffect(() => {
    return () => {
      reviewResolveRef.current?.(null);
      reviewResolveRef.current = null;
    };
  }, []);

  const openPromptReview = (items: ImagePromptReviewItem[]) =>
    new Promise<ImagePromptOverride[] | null>((resolve) => {
      reviewResolveRef.current = resolve;
      setReviewSubmitting(false);
      setReviewItems(items);
    });

  const closePromptReview = (overrides: ImagePromptOverride[] | null) => {
    const resolve = reviewResolveRef.current;
    reviewResolveRef.current = null;
    setReviewSubmitting(false);
    setReviewItems([]);
    resolve?.(overrides);
  };

  const payloadName = entityName.trim() || (isCover ? "Lorebook" : "Character");
  const buildPayload = (
    referenceImages?: string[],
    promptOverrides?: ImagePromptOverride[],
    options: { forPreview?: boolean } = {},
  ) => ({
    connectionId: effectiveConnectionId,
    purpose: mode,
    name: payloadName,
    // The server wants a description; a card with none (or a hand-written full prompt) still gets one. The
    // preview is built from the fields alone, so rebuilding never wraps the open full prompt inside itself.
    appearance: appearance.trim() || (options.forPreview ? "" : fullPrompt?.prompt.trim()) || payloadName,
    referenceImages,
    // What each sent picture is for; sent with the preview too, so a full prompt opened for editing names them.
    referenceRoles: sentImageReferences(references, referenceLimit).map((reference) => reference.role),
    stickers: isStickerSheet ? sheetNames : undefined,
    width: canvasWidth,
    height: canvasHeight,
    debugMode,
    promptOverrides,
  });

  /** Build the prompt from the fields as it would be sent, and open it for editing. */
  const openFullPrompt = async () => {
    if (!effectiveConnectionId || fullPromptLoading) return;
    setFullPromptLoading(true);
    try {
      // Reference pictures don't change the words, so the preview is built without them.
      const preview = await api.post<{ items: ImagePromptReviewItem[] }>(
        "/characters/avatar-generation/preview",
        buildPayload(undefined, undefined, { forPreview: true }),
      );
      const item = preview.items[0];
      if (!item) throw new Error();
      setFullPrompt(item);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : localizeUi("ui.ui.avatargenerationmodal.fullPromptFailed"),
      );
    } finally {
      setFullPromptLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!effectiveConnectionId || generating) return;
    if (fullPrompt ? !fullPrompt.prompt.trim() : !appearance.trim()) return;
    if (isStickerSheet && sheetNames.length === 0) return;
    setGenerating(true);
    sheetCells.reset();
    try {
      let promptOverrides: ImagePromptOverride[] | undefined;
      // Pictures past what the connection takes stay in the row, marked "Not sent", and are not read.
      const sent = sentImageReferences(references, referenceLimit);
      const referenceImages = sent.length
        ? await Promise.all(
            sent.map((reference) =>
              imageUrlToDataUrl(reference.url, localizeUi("ui.ui.avatargenerationmodal.referenceImageReadFailed")),
            ),
          )
        : undefined;
      const payload = buildPayload(referenceImages);
      if (fullPrompt) {
        // The user wrote the prompt themselves, so it goes as written, with no second review.
        promptOverrides = [
          { id: fullPrompt.id, prompt: fullPrompt.prompt.trim(), negativePrompt: fullPrompt.negativePrompt },
        ];
      } else if (reviewImagePromptsBeforeSend) {
        const preview = await api.post<{ items: ImagePromptReviewItem[] }>(
          "/characters/avatar-generation/preview",
          payload,
        );
        if (preview.items.length > 0) {
          const overrides = await openPromptReview(preview.items);
          if (!overrides) return;
          promptOverrides = overrides;
          setReviewSubmitting(true);
        }
      }

      const result = await api.post<AvatarGenerationResponse>(
        "/characters/avatar-generation",
        buildPayload(referenceImages, promptOverrides),
      );
      setGeneratedAvatar(result.image);
      setGeneratedPrompt(result.prompt);
      if (isStickerSheet) void sheetCells.cut(result.image, sheetGrid, sheetNames);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : localizeUi(
              isCover
                ? "ui.ui.avatargenerationmodal.coverGenerationFailed"
                : isCharacterSheet
                  ? "ui.ui.avatargenerationmodal.characterSheetGenerationFailed"
                  : galleryCreate
                    ? "ui.ui.avatargenerationmodal.galleryGenerationFailed"
                    : "ui.ui.avatargenerationmodal.avatarGenerationFailed",
            ),
      );
    } finally {
      setReviewSubmitting(false);
      setGenerating(false);
    }
  };

  const handleUseAvatar = async () => {
    if (!generatedAvatar || saving) return;
    setSaving(true);
    try {
      if (galleryCreate) {
        if (mode === "sticker-sheet" || mode === "emoji-sheet") {
          await galleryCreate.onSave({ kind: mode, items: sheetCells.selectedItems });
        } else {
          await galleryCreate.onSave({
            kind: mode === "background" ? "background" : "character-sheet",
            dataUrl: generatedAvatar,
          });
        }
      } else {
        await onUseAvatar(generatedAvatar);
      }
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : localizeUi(
              isCover
                ? "ui.ui.avatargenerationmodal.failedToSaveGeneratedCover"
                : isCharacterSheet
                  ? "ui.ui.avatargenerationmodal.failedToSaveGeneratedCharacterSheet"
                  : galleryCreate
                    ? "ui.ui.avatargenerationmodal.failedToSaveGalleryImages"
                    : "ui.ui.avatargenerationmodal.failedToSaveGeneratedAvatar",
            ),
      );
    } finally {
      setSaving(false);
    }
  };

  // The preview shows the fresh result, or the current picture until one exists; either can be opened large.
  const previewSrc = generatedAvatar ?? defaultAvatarUrl ?? null;
  const previewAlt = localizeUi(
    generatedAvatar
      ? isCover
        ? "ui.ui.avatargenerationmodal.generatedCover"
        : isCharacterSheet
          ? "ui.ui.avatargenerationmodal.generatedCharacterSheet"
          : isBackground
            ? "ui.ui.avatargenerationmodal.generatedBackground"
            : isStickerSheet
              ? "ui.ui.avatargenerationmodal.generatedStickerSheet"
              : "ui.ui.avatargenerationmodal.generatedAvatar"
      : isCover
        ? "ui.ui.avatargenerationmodal.currentCover"
        : "ui.ui.avatargenerationmodal.currentAvatar",
  );
  const selectedSheetCount = sheetCells.selectedItems.length;
  const saveDisabled =
    !generatedAvatar || generating || saving || (isStickerSheet && (sheetCells.busy || selectedSheetCount === 0));
  const saveLabel = isCover
    ? localizeUi("ui.ui.avatargenerationmodal.useCover")
    : isCharacterSheet
      ? localizeUi("ui.ui.avatargenerationmodal.saveAsCharacterSheet")
      : isBackground
        ? localizeUi("ui.ui.avatargenerationmodal.saveAsBackground")
        : mode === "sticker-sheet"
          ? localizeUi("ui.ui.avatargenerationmodal.saveStickers", { count: selectedSheetCount })
          : mode === "emoji-sheet"
            ? localizeUi("ui.ui.avatargenerationmodal.saveEmoji", { count: selectedSheetCount })
            : localizeUi("ui.ui.avatargenerationmodal.useAvatar");

  const referenceChooser = (
    <ImageReferenceChooser
      column={chooserInColumn}
      selectedCount={chooserSelection.length}
      roomLeft={Math.max(0, chooserRoom - chooserSelection.length)}
      onConfirm={confirmChooser}
      activeTab={chooserTab}
      onTabChange={setChooserTab}
      onBack={closeChooser}
      onChooseFiles={() => fileInputRef.current?.click()}
      tabs={[
        {
          id: "own",
          // First name only, so a long name still fits beside Gallery and Device (the tab truncates the rest).
          label: entityName.trim().split(/\s+/)[0] || localizeUi("ui.ui.imagereferencepicker.galleryPicture"),
          title: entityName.trim() || undefined,
          content: (
            <ImageReferenceGrid
              sources={ownSources}
              addedKeys={addedReferenceKeys}
              selectedKeys={chooserSelection.map((item) => item.key)}
              onToggle={toggleChooserSource}
              loading={ownGallery.isLoading}
            />
          ),
        },
        {
          id: "gallery",
          label: localizeUi("ui.ui.imagereferencepicker.tabGallery"),
          content: (
            <GlobalGalleryReferenceGrid
              addedKeys={addedReferenceKeys}
              selectedKeys={chooserSelection.map((item) => item.key)}
              onToggle={toggleChooserSource}
            />
          ),
        },
      ]}
    />
  );

  return (
    <>
      <Modal
        open={open}
        // Picking references is a page inside the window: closing it goes back one level first.
        onClose={chooserOpen && !chooserInColumn ? closeChooser : onClose}
        closeDisabled={generating || saving}
        closeButtonClassName="max-sm:hidden"
        pullToClose={!generating}
        title={title}
        width="max-w-2xl lg:max-w-[60rem]"
        footer={
          chooserOpen && !chooserInColumn ? (
            <>
              <button
                type="button"
                onClick={confirmChooser}
                disabled={chooserSelection.length === 0}
                className={SHEET_BUTTON_PRIMARY}
                data-reference-confirm=""
              >
                {localizeUi("ui.ui.imagereferencepicker.addSelected", { count: chooserSelection.length })}
              </button>
              <span className="mr-auto text-[0.6875rem] tabular-nums text-[var(--muted-foreground)] max-sm:mr-0 max-sm:text-center max-sm:text-[13px]">
                {localizeUi("ui.ui.imagereferencepicker.roomLeft", {
                  selected: chooserSelection.length,
                  count: Math.max(0, chooserRoom - chooserSelection.length),
                })}
              </span>
            </>
          ) : (
            <>
              {generatedAvatar && (
                <button
                  type="button"
                  onClick={handleUseAvatar}
                  disabled={saveDisabled}
                  className={SHEET_BUTTON_PRIMARY}
                >
                  {saving ? (
                    <Spinner size="sm" />
                  ) : isCharacterSheet ? (
                    <IdCard size="0.875rem" />
                  ) : isBackground ? (
                    <ImageIcon size="0.875rem" />
                  ) : isStickerSheet ? (
                    <Sticker size="0.875rem" />
                  ) : (
                    <Camera size="0.875rem" />
                  )}
                  {saveLabel}
                </button>
              )}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={
                  !effectiveConnectionId ||
                  (fullPrompt ? !fullPrompt.prompt.trim() : !appearance.trim()) ||
                  (isStickerSheet && sheetNames.length === 0) ||
                  generating ||
                  saving
                }
                className={generatedAvatar ? SHEET_BUTTON_SECONDARY : SHEET_BUTTON_PRIMARY}
              >
                {generating ? <Spinner size="sm" /> : <Wand2 size="0.875rem" />}
                {generatedAvatar
                  ? localizeUi("ui.agents.secretplotpanel.regenerate")
                  : localizeUi("ui.characters.characterclipcard.generate")}
              </button>
              <button type="button" onClick={onClose} disabled={generating || saving} className={SHEET_BUTTON_QUIET}>
                {localizeUi("chat.delete.dialog.cancel")}
              </button>
            </>
          )
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length) {
              closeChooser();
              void addReferenceFiles(files);
            }
          }}
        />
        <div
          className="space-y-4"
          onDragEnter={(event) => {
            if (!hasFiles(event) || busy) return;
            event.preventDefault();
            dragDepthRef.current += 1;
            setDropActive(true);
          }}
          onDragOver={(event) => {
            if (!hasFiles(event) || busy) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDragLeave={(event) => {
            if (!hasFiles(event)) return;
            dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
            if (dragDepthRef.current === 0) setDropActive(false);
          }}
          onDrop={(event) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            dragDepthRef.current = 0;
            setDropActive(false);
            if (busy) return;
            closeChooser();
            void addReferenceFiles(Array.from(event.dataTransfer.files));
          }}
        >
          {chooserOpen && !chooserInColumn && referenceChooser}
          {/* Kept mounted while choosing, so the form keeps its scroll and nothing reloads on the way back. */}
          <div hidden={chooserOpen && !chooserInColumn} className="space-y-4">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[minmax(0,1fr)_13rem] lg:grid-cols-[minmax(0,1fr)_21rem]">
              <div className="space-y-4">
                {galleryCreate && (
                  <label className="block space-y-1.5">
                    <span className="block text-xs font-medium text-[var(--foreground)]">
                      {localizeUi("ui.ui.avatargenerationmodal.createType")}
                    </span>
                    <span className="relative block">
                      <select
                        value={galleryKind}
                        onChange={(event) => switchGalleryKind(event.target.value as GalleryCreateKind)}
                        disabled={generating || saving}
                        data-gallery-create-kind=""
                        className="mari-chrome-field h-9 w-full appearance-none rounded-lg py-0 pl-3 pr-8 text-xs max-sm:min-h-11 max-sm:text-[13px] [@media(pointer:coarse)]:min-h-11"
                      >
                        {GALLERY_CREATE_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {localizeUi(GALLERY_KIND_LABEL_KEY[kind])}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size="0.875rem"
                        aria-hidden="true"
                        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                      />
                    </span>
                  </label>
                )}
                <label className="block space-y-1.5">
                  <span className="block text-xs font-medium text-[var(--foreground)]">
                    {localizeUi("ui.agents.agenteditor.imageGenerationConnection")}
                  </span>
                  {imageConnections.length === 0 ? (
                    <NeedsModelChip kind="image" className="flex" />
                  ) : (
                    <ConnectionSelect
                      job={localizeUi("connections.picker.job.avatarImages")}
                      kind="image"
                      value={effectiveConnectionId}
                      onChange={setConnectionId}
                      className="rounded-lg px-3 py-2 text-xs max-sm:min-h-11 max-sm:text-[13px]"
                    />
                  )}
                </label>

                <label className="space-y-1.5">
                  <span className="block text-xs font-medium text-[var(--foreground)]">
                    {localizeUi(
                      isCover
                        ? "ui.ui.avatargenerationmodal.coverPrompt"
                        : isCharacterSheet
                          ? "ui.ui.avatargenerationmodal.characterSheetPrompt"
                          : isBackground
                            ? "ui.ui.avatargenerationmodal.backgroundPrompt"
                            : mode === "sticker-sheet"
                              ? "ui.ui.avatargenerationmodal.stickerSheetPrompt"
                              : mode === "emoji-sheet"
                                ? "ui.ui.avatargenerationmodal.emojiSheetPrompt"
                                : "ui.ui.avatargenerationmodal.avatarPrompt",
                    )}
                  </span>
                  <textarea
                    value={appearance}
                    onChange={(event) => setAppearance(event.target.value)}
                    rows={7}
                    className="w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs max-sm:text-base leading-relaxed text-[var(--foreground)] outline-none ring-1 ring-transparent transition-all placeholder:text-[var(--muted-foreground)] focus:ring-[var(--primary)]/40"
                    placeholder={localizeUi(
                      isCover
                        ? "ui.ui.avatargenerationmodal.describeTheCover"
                        : isCharacterSheet
                          ? "ui.ui.avatargenerationmodal.describeCanonicalCharacterSheet"
                          : isBackground
                            ? "ui.ui.avatargenerationmodal.describeTheBackground"
                            : "ui.ui.avatargenerationmodal.describeTheCharacterSFaceHairBuildOutfitMood",
                    )}
                  />
                </label>

                {isStickerSheet && (
                  <label className="block space-y-1.5">
                    <span className="flex items-baseline justify-between gap-2 text-xs font-medium text-[var(--foreground)]">
                      {localizeUi(
                        mode === "emoji-sheet"
                          ? "ui.ui.avatargenerationmodal.emojiNames"
                          : "ui.ui.avatargenerationmodal.stickerNames",
                      )}
                      <span className="shrink-0 text-[0.625rem] font-normal text-[var(--muted-foreground)] max-sm:text-[13px]">
                        {localizeUi("ui.ui.avatargenerationmodal.sheetGridSummary", {
                          count: sheetNames.length,
                          cols: sheetGrid.cols,
                          rows: sheetGrid.rows,
                        })}
                      </span>
                    </span>
                    <input
                      type="text"
                      value={stickerNames[mode]}
                      onChange={(event) => {
                        const value = event.target.value;
                        setStickerNames((prev) => ({ ...prev, [mode]: value }));
                      }}
                      disabled={generating || saving}
                      className="mari-chrome-field h-9 w-full rounded-lg px-3 py-0 text-xs max-sm:min-h-11 max-sm:text-base [@media(pointer:coarse)]:min-h-11"
                      placeholder={mode === "emoji-sheet" ? DEFAULT_EMOJI_NAMES : DEFAULT_STICKER_NAMES}
                    />
                  </label>
                )}

                {fullPrompt ? (
                  <div className="space-y-1.5" data-avatar-generation-full-prompt="">
                    <div className="flex items-center gap-1">
                      <label
                        htmlFor="avatar-generation-full-prompt"
                        className="mr-auto text-xs font-medium text-[var(--foreground)]"
                      >
                        {localizeUi("ui.ui.avatargenerationmodal.fullPrompt")}
                      </label>
                      <button
                        type="button"
                        onClick={() => void openFullPrompt()}
                        disabled={fullPromptLoading || generating || saving}
                        title={localizeUi("ui.ui.avatargenerationmodal.rebuildFullPromptHint")}
                        className="inline-flex min-h-7 items-center gap-1 rounded-lg px-2 text-[0.6875rem] text-[var(--muted-foreground)] transition-colors disabled:opacity-50 max-sm:min-h-11 max-sm:text-[13px] [@media(hover:hover)]:hover:text-[var(--foreground)]"
                      >
                        {fullPromptLoading ? <Spinner size="sm" /> : <RotateCcw size="0.75rem" />}
                        {localizeUi("ui.ui.avatargenerationmodal.rebuildFullPrompt")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFullPrompt(null)}
                        disabled={generating || saving}
                        aria-label={localizeUi("ui.ui.avatargenerationmodal.stopEditingFullPrompt")}
                        title={localizeUi("ui.ui.avatargenerationmodal.stopEditingFullPrompt")}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors disabled:opacity-50 max-sm:h-11 max-sm:w-11 [@media(hover:hover)]:hover:text-[var(--foreground)]"
                      >
                        <X size="0.875rem" />
                      </button>
                    </div>
                    <textarea
                      id="avatar-generation-full-prompt"
                      value={fullPrompt.prompt}
                      onChange={(event) => {
                        const value = event.target.value;
                        setFullPrompt((current) => (current ? { ...current, prompt: value } : current));
                      }}
                      disabled={generating || saving}
                      rows={9}
                      className="w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs max-sm:text-base leading-relaxed text-[var(--foreground)] outline-none ring-1 ring-[var(--primary)]/30 transition-all focus:ring-[var(--primary)]/50"
                    />
                    <p className="text-[0.625rem] leading-relaxed text-[var(--muted-foreground)] max-sm:text-[13px]">
                      {localizeUi("ui.ui.avatargenerationmodal.fullPromptHint")}
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void openFullPrompt()}
                    disabled={!effectiveConnectionId || fullPromptLoading || generating || saving}
                    className="inline-flex min-h-8 items-center gap-1.5 self-start rounded-lg px-1 text-[0.6875rem] text-[var(--muted-foreground)] transition-colors disabled:opacity-50 max-sm:min-h-11 max-sm:text-[13px] [@media(hover:hover)]:hover:text-[var(--foreground)]"
                  >
                    {fullPromptLoading ? <Spinner size="sm" /> : <PencilLine size="0.75rem" />}
                    {localizeUi("ui.ui.avatargenerationmodal.editFullPrompt")}
                  </button>
                )}

                <ImageReferenceRow
                  references={references}
                  onChange={changeReferences}
                  limit={referenceLimit}
                  disabled={busy}
                  dropActive={dropActive}
                  onAdd={openChooser}
                  modelName={referenceModelName}
                />
              </div>

              {chooserOpen && chooserInColumn ? (
                referenceChooser
              ) : (
                <div className="flex flex-col gap-3">
                  <div
                    className={cn(
                      "relative overflow-hidden rounded-xl bg-[var(--secondary)] ring-1 ring-[var(--border)]",
                      isWide ? "aspect-video" : "aspect-square",
                    )}
                  >
                    {previewSrc ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.currentTarget.focus();
                          setShowFullView(true);
                        }}
                        aria-label={localizeUi("ui.ui.avatarcropwidget.openFullImage")}
                        aria-haspopup="dialog"
                        title={localizeUi("ui.ui.avatarcropwidget.openFullImage")}
                        className="group/preview block h-full w-full cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--primary)]"
                      >
                        <img
                          src={previewSrc}
                          alt={previewAlt}
                          className={cn(
                            "h-full w-full",
                            generatedAvatar && (isCharacterSheet || isStickerSheet) ? "object-contain" : "object-cover",
                            !generatedAvatar && "opacity-80",
                          )}
                        />
                        {/* Always visible (touch has no hover), sits on the image so it reads the same in every theme. */}
                        <span
                          aria-hidden="true"
                          data-avatar-generation-zoom=""
                          className="absolute bottom-1.5 right-1.5 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-black/55 text-white shadow-sm ring-1 ring-white/15 transition-colors group-focus-visible/preview:bg-black/75 max-sm:h-9 max-sm:w-9 [@media(hover:hover)]:group-hover/preview:bg-black/75"
                        >
                          <ZoomIn size="0.875rem" />
                        </span>
                      </button>
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--muted-foreground)]">
                        <ImagePlus size="1.75rem" />
                        <span className="text-xs">{localizeUi("ui.ui.avatargenerationmodal.noPreviewYet")}</span>
                      </div>
                    )}
                  </div>
                  {generatedPrompt && (
                    <p className="line-clamp-4 text-[0.625rem] max-sm:text-[13px] leading-relaxed text-[var(--muted-foreground)]">
                      {generatedPrompt}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[0.625rem] max-sm:text-[13px] text-[var(--muted-foreground)]">
                {canvasWidth}
                {localizeUi("ui.panels.imagedimensionrow.x")}
                {canvasHeight}{" "}
                {localizeUi(
                  isCover
                    ? "ui.ui.avatargenerationmodal.coverCanvas"
                    : isCharacterSheet
                      ? "ui.ui.avatargenerationmodal.characterSheetCanvas"
                      : isBackground
                        ? "ui.ui.avatargenerationmodal.backgroundCanvas"
                        : isStickerSheet
                          ? "ui.ui.avatargenerationmodal.stickerSheetCanvas"
                          : "ui.ui.avatargenerationmodal.portraitCanvas",
                )}
              </span>
            </div>

            {isStickerSheet && generatedAvatar && (
              <GallerySheetCells
                state={sheetCells}
                kind={mode === "emoji-sheet" ? "emoji" : "sticker"}
                disabled={generating || saving}
              />
            )}
          </div>
        </div>
      </Modal>

      {open && showFullView && previewSrc && (
        <FullImageView src={previewSrc} alt={previewAlt} onClose={() => setShowFullView(false)} />
      )}

      <ImagePromptReviewModal
        open={reviewItems.length > 0}
        items={reviewItems}
        isSubmitting={reviewSubmitting}
        onCancel={() => closePromptReview(null)}
        onConfirm={(overrides) => closePromptReview(overrides)}
      />
    </>
  );
}
