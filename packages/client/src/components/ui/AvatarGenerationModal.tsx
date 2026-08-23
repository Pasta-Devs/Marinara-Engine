import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, IdCard, ImagePlus, Loader2, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { useConnections } from "../../hooks/use-connections";
import { useUIStore } from "../../stores/ui.store";
import { api } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import { Modal } from "./Modal";
import { ImagePromptReviewModal, type ImagePromptOverride, type ImagePromptReviewItem } from "./ImagePromptReviewModal";
import { useTranslation as useUiTranslation } from "react-i18next";

type AvatarGenerationModalProps = {
  open: boolean;
  title: string;
  mode?: "avatar" | "character-sheet";
  entityName: string;
  defaultAppearance?: string;
  defaultAvatarUrl?: string | null;
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

async function imageUrlToDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const response = await fetch(src);
  if (!response.ok) throw new Error("Failed to read the current avatar reference.");
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Failed to convert the current avatar reference."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to convert the current avatar reference."));
    reader.readAsDataURL(blob);
  });
}

export function AvatarGenerationModal({
  open,
  title,
  mode = "avatar",
  entityName,
  defaultAppearance,
  defaultAvatarUrl,
  onClose,
  onUseAvatar,
}: AvatarGenerationModalProps) {
  const { t: localizeUi } = useUiTranslation();
  const { data: connectionsList } = useConnections();
  const reviewImagePromptsBeforeSend = useUIStore((s) => s.reviewImagePromptsBeforeSend);
  const imagePortraitWidth = useUIStore((s) => s.imagePortraitWidth);
  const imagePortraitHeight = useUIStore((s) => s.imagePortraitHeight);
  const imageBackgroundWidth = useUIStore((s) => s.imageBackgroundWidth);
  const imageBackgroundHeight = useUIStore((s) => s.imageBackgroundHeight);
  const debugMode = useUIStore((s) => s.debugMode);
  const [appearance, setAppearance] = useState(defaultAppearance ?? "");
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [useCurrentAvatarReference, setUseCurrentAvatarReference] = useState(false);
  const [generatedAvatar, setGeneratedAvatar] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewItems, setReviewItems] = useState<ImagePromptReviewItem[]>([]);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
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
  const canvasWidth = isCharacterSheet ? imageBackgroundWidth : imagePortraitWidth;
  const canvasHeight = isCharacterSheet ? imageBackgroundHeight : imagePortraitHeight;

  useEffect(() => {
    if (!open) return;
    setAppearance(defaultAppearance ?? "");
    setUseCurrentAvatarReference(!!defaultAvatarUrl);
    setGeneratedAvatar(null);
    setGeneratedPrompt("");
    setReviewItems([]);
    setReviewSubmitting(false);
  }, [defaultAppearance, defaultAvatarUrl, open]);

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

  const buildPayload = (referenceImages?: string[], promptOverrides?: ImagePromptOverride[]) => ({
    connectionId: effectiveConnectionId,
    purpose: mode,
    name: entityName.trim() || "Character",
    appearance: appearance.trim(),
    referenceImages,
    width: canvasWidth,
    height: canvasHeight,
    debugMode,
    promptOverrides,
  });

  const handleGenerate = async () => {
    if (!effectiveConnectionId || !appearance.trim() || generating) return;
    setGenerating(true);
    try {
      let promptOverrides: ImagePromptOverride[] | undefined;
      const referenceImages =
        useCurrentAvatarReference && defaultAvatarUrl ? [await imageUrlToDataUrl(defaultAvatarUrl)] : undefined;
      const payload = buildPayload(referenceImages);
      if (reviewImagePromptsBeforeSend) {
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
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : localizeUi(
              isCharacterSheet
                ? "ui.ui.avatargenerationmodal.characterSheetGenerationFailed"
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
      await onUseAvatar(generatedAvatar);
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : localizeUi(
              isCharacterSheet
                ? "ui.ui.avatargenerationmodal.failedToSaveGeneratedCharacterSheet"
                : "ui.ui.avatargenerationmodal.failedToSaveGeneratedAvatar",
            ),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal open={open} onClose={generating || saving ? () => {} : onClose} title={title} width="max-w-2xl">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_13rem]">
            <div className="space-y-4">
              <label className="space-y-1.5">
                <span className="block text-xs font-medium text-[var(--foreground)]">
                  {localizeUi("ui.agents.agenteditor.imageGenerationConnection")}
                </span>
                {imageConnections.length === 0 ? (
                  <p className="rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--destructive)]">
                    {localizeUi("ui.ui.avatargenerationmodal.noImageGenerationConnectionsFound")}
                  </p>
                ) : (
                  <select
                    value={effectiveConnectionId ?? ""}
                    onChange={(event) => setConnectionId(event.target.value || null)}
                    className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--foreground)] outline-none ring-1 ring-transparent transition-all focus:ring-[var(--primary)]/40"
                  >
                    {imageConnections.map((connection) => (
                      <option key={connection.id} value={connection.id}>
                        {connection.name}
                        {connection.model
                          ? localizeUi("ui.ui.avatargenerationmodal.value1", { value1: connection.model })
                          : ""}
                        {isDefaultImageConnection(connection) ? localizeUi("ui.ui.avatargenerationmodal.default") : ""}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              <label className="space-y-1.5">
                <span className="block text-xs font-medium text-[var(--foreground)]">
                  {localizeUi(
                    isCharacterSheet
                      ? "ui.ui.avatargenerationmodal.characterSheetPrompt"
                      : "ui.ui.avatargenerationmodal.avatarPrompt",
                  )}
                </span>
                <textarea
                  value={appearance}
                  onChange={(event) => setAppearance(event.target.value)}
                  rows={7}
                  className="w-full resize-y rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs leading-relaxed text-[var(--foreground)] outline-none ring-1 ring-transparent transition-all placeholder:text-[var(--muted-foreground)] focus:ring-[var(--primary)]/40"
                  placeholder={localizeUi(
                    isCharacterSheet
                      ? "ui.ui.avatargenerationmodal.describeCanonicalCharacterSheet"
                      : "ui.ui.avatargenerationmodal.describeTheCharacterSFaceHairBuildOutfitMood",
                  )}
                />
              </label>

              {defaultAvatarUrl && (
                <label className="flex items-center gap-3 rounded-lg bg-[var(--secondary)]/60 p-2.5 text-xs text-[var(--foreground)] ring-1 ring-[var(--border)]/60">
                  <input
                    type="checkbox"
                    checked={useCurrentAvatarReference}
                    onChange={(event) => setUseCurrentAvatarReference(event.target.checked)}
                    className="accent-[var(--primary)]"
                  />
                  <img
                    src={defaultAvatarUrl}
                    alt={localizeUi("ui.ui.avatargenerationmodal.currentAvatarReference")}
                    className="h-10 w-10 rounded-lg object-cover ring-1 ring-[var(--border)]"
                  />
                  <span className="min-w-0 flex-1">
                    {localizeUi(
                      isCharacterSheet
                        ? "ui.ui.avatargenerationmodal.useCurrentAvatarAsLikenessReference"
                        : "ui.ui.avatargenerationmodal.useCurrentAvatarAsAReference",
                    )}
                  </span>
                </label>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div
                className={cn(
                  "relative overflow-hidden rounded-xl bg-[var(--secondary)] ring-1 ring-[var(--border)]",
                  isCharacterSheet ? "aspect-video" : "aspect-square",
                )}
              >
                {generatedAvatar ? (
                  <img
                    src={generatedAvatar}
                    alt={localizeUi(
                      isCharacterSheet
                        ? "ui.ui.avatargenerationmodal.generatedCharacterSheet"
                        : "ui.ui.avatargenerationmodal.generatedAvatar",
                    )}
                    className={cn("h-full w-full", isCharacterSheet ? "object-contain" : "object-cover")}
                  />
                ) : defaultAvatarUrl ? (
                  <img
                    src={defaultAvatarUrl}
                    alt={localizeUi("ui.ui.avatargenerationmodal.currentAvatar")}
                    className="h-full w-full object-cover opacity-80"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--muted-foreground)]">
                    <ImagePlus size="1.75rem" />
                    <span className="text-xs">{localizeUi("ui.ui.avatargenerationmodal.noPreviewYet")}</span>
                  </div>
                )}
              </div>
              {generatedPrompt && (
                <p className="line-clamp-4 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                  {generatedPrompt}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-[var(--border)]/50 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[0.625rem] text-[var(--muted-foreground)]">
              {canvasWidth}
              {localizeUi("ui.panels.imagedimensionrow.x")}
              {canvasHeight}{" "}
              {localizeUi(
                isCharacterSheet
                  ? "ui.ui.avatargenerationmodal.characterSheetCanvas"
                  : "ui.ui.avatargenerationmodal.portraitCanvas",
              )}
            </span>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={generating || saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size="0.875rem" />
                {localizeUi("chat.delete.dialog.cancel")}
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!effectiveConnectionId || !appearance.trim() || generating || saving}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ring-1 transition-colors",
                  !effectiveConnectionId || !appearance.trim() || generating || saving
                    ? "cursor-not-allowed bg-[var(--muted)] text-[var(--muted-foreground)] ring-[var(--border)]"
                    : "bg-[var(--secondary)] text-[var(--foreground)] ring-[var(--border)] hover:bg-[var(--accent)]",
                )}
              >
                {generating ? <Loader2 size="0.875rem" className="animate-spin" /> : <Wand2 size="0.875rem" />}
                {generatedAvatar
                  ? localizeUi("ui.agents.secretplotpanel.regenerate")
                  : localizeUi("ui.characters.characterclipcard.generate")}
              </button>
              <button
                type="button"
                onClick={handleUseAvatar}
                disabled={!generatedAvatar || generating || saving}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ring-1 transition-colors",
                  !generatedAvatar || generating || saving
                    ? "cursor-not-allowed bg-[var(--muted)] text-[var(--muted-foreground)] ring-[var(--border)]"
                    : "bg-[var(--primary)]/15 text-[var(--primary)] ring-[var(--primary)]/30 hover:bg-[var(--primary)]/20",
                )}
              >
                {saving ? (
                  <Loader2 size="0.875rem" className="animate-spin" />
                ) : isCharacterSheet ? (
                  <IdCard size="0.875rem" />
                ) : (
                  <Camera size="0.875rem" />
                )}
                {localizeUi(
                  isCharacterSheet
                    ? "ui.ui.avatargenerationmodal.saveAsCharacterSheet"
                    : "ui.ui.avatargenerationmodal.useAvatar",
                )}
              </button>
            </div>
          </div>
        </div>
      </Modal>

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
