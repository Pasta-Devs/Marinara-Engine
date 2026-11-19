import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eraser,
  Paintbrush,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import { isNativeNovelAiConnection, type ChatImageGenerationRecord } from "@marinara-engine/shared";
import { useConnections } from "../../hooks/use-connections";
import type { ChatImage, RegenerateChatImageInput } from "../../hooks/use-gallery";
import {
  useRegenerateChatImage,
  useReviseChatImagePrompt,
  type ImagePromptDraft,
} from "../../hooks/use-regenerate-chat-image";
import { isConnectionFlagTrue } from "../../lib/connection-filters";
import { useUIStore } from "../../stores/ui.store";
import { cn } from "../../lib/utils";
import { ConnectionSelect } from "../connections/ConnectionSelect";
import { Checkbox } from "../ui/Checkbox";
import { DraftNumberInput } from "../ui/DraftNumberInput";
import { HelpTooltip } from "../ui/HelpTooltip";
import { MAX_MASK_BRUSH_PX, MIN_MASK_BRUSH_PX, type MaskTool } from "../ui/ImageMaskCanvas";
import { NEUTRAL_SURFACE_VARIABLES } from "../ui/neutral-surface-styles";
import { Spinner } from "../ui/Spinner";

/**
 * Where Regenerate and Revise send the draft. Chat gallery images use the gallery routes; Professor Mari's preview
 * images (#9387) pass their own.
 */
export interface ImageRegenerator {
  regenerate: (input: RegenerateChatImageInput) => Promise<ChatImage>;
  revise: (
    input: ImagePromptDraft & { imageId: string; guidance: string; connectionId?: string; debugMode: boolean },
  ) => Promise<ImagePromptDraft>;
  /** The connection picker's empty choice, when it isn't the chat's image provider. */
  defaultConnectionLabel?: string;
  /** The success toast, when the old picture is kept somewhere other than the chat gallery. */
  regeneratedMessage?: string;
}

export interface ImageMaskControls {
  tool: MaskTool;
  onToolChange: (tool: MaskTool) => void;
  brushSizePx: number;
  onBrushSizeChange: (sizePx: number) => void;
  strokeCount: number;
  hasMask: boolean;
  onUndo: () => void;
  onClear: () => void;
}

interface ImageRegeneratePanelProps {
  image: ChatImage;
  regenerator?: ImageRegenerator;
  record: ChatImageGenerationRecord | null;
  /** Message the image was opened from, so the server swaps that attachment directly. */
  messageId?: string;
  maskDataUrl?: string | null;
  maskControls?: ImageMaskControls;
  onEditSurfaceChange?: (active: boolean) => void;
  onCancel: () => void;
  onBusyChange: (busy: boolean) => void;
  onRegenerated: (image: ChatImage) => void;
  className?: string;
}

// Same field as InlineChatCardEditor: the chat chrome input tokens follow every theme and chat style,
// where raw --background turned into the default dark theme's navy.
const FIELD_CLASS =
  "min-h-11 w-full resize-y rounded-lg border border-[var(--marinara-chat-chrome-input-border)] bg-[var(--marinara-chat-chrome-input-bg)] px-3 py-2 text-sm leading-relaxed text-[var(--marinara-chat-chrome-panel-text)] outline-none transition-colors placeholder:text-[var(--marinara-chat-chrome-panel-muted)]/55 focus:border-[var(--marinara-chat-chrome-input-border-focus)] focus:ring-1 focus:ring-[var(--marinara-chat-chrome-focus-ring)] disabled:opacity-60";
const LABEL_CLASS = "text-xs font-semibold text-[var(--foreground)]";
const BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BUTTON_CLASS = `${BUTTON_CLASS} border border-[var(--border)] hover:bg-[var(--accent)]`;
const MASK_ACTION_BUTTON_CLASS =
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-45";
type CharacterPrompt = ImagePromptDraft["characterPrompts"][number];

function maskToolClass(active: boolean) {
  return cn(
    MASK_ACTION_BUTTON_CLASS,
    active
      ? "border-[var(--primary)] bg-[var(--primary)]/15 font-semibold text-[var(--foreground)]"
      : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
  );
}

function MaskToolButtons({
  maskControls,
  disabled,
  compact = false,
}: {
  maskControls: ImageMaskControls;
  disabled: boolean;
  compact?: boolean;
}) {
  const { t } = useUiTranslation();

  return (
    <div className={cn("flex items-center", compact ? "shrink-0 gap-1" : "flex-wrap gap-1.5")}>
      <button
        type="button"
        onClick={() => maskControls.onToolChange("brush")}
        aria-pressed={maskControls.tool === "brush"}
        aria-label={compact ? t("ui.imagemaskcanvas.brush") : undefined}
        title={compact ? t("ui.imagemaskcanvas.brush") : undefined}
        disabled={disabled}
        className={cn(maskToolClass(maskControls.tool === "brush"), compact ? "w-11 px-0" : "px-2.5")}
      >
        <Paintbrush size="0.875rem" aria-hidden />
        {!compact && t("ui.imagemaskcanvas.brush")}
      </button>
      <button
        type="button"
        onClick={() => maskControls.onToolChange("eraser")}
        aria-pressed={maskControls.tool === "eraser"}
        aria-label={compact ? t("ui.imagemaskcanvas.eraser") : undefined}
        title={compact ? t("ui.imagemaskcanvas.eraser") : undefined}
        disabled={disabled}
        className={cn(maskToolClass(maskControls.tool === "eraser"), compact ? "w-11 px-0" : "px-2.5")}
      >
        <Eraser size="0.875rem" aria-hidden />
        {!compact && t("ui.imagemaskcanvas.eraser")}
      </button>
      <button
        type="button"
        onClick={maskControls.onUndo}
        disabled={disabled || maskControls.strokeCount === 0}
        aria-label={t("ui.imagemaskcanvas.undo")}
        title={t("ui.imagemaskcanvas.undo")}
        className={cn(
          MASK_ACTION_BUTTON_CLASS,
          "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]",
          compact ? "w-11 px-0" : "max-sm:w-11 max-sm:px-0 sm:px-2.5",
        )}
      >
        <Undo2 size="0.875rem" aria-hidden />
        {!compact && <span className="max-sm:sr-only">{t("ui.imagemaskcanvas.undo")}</span>}
      </button>
      <button
        type="button"
        onClick={maskControls.onClear}
        disabled={disabled || (!maskControls.hasMask && maskControls.strokeCount === 0)}
        aria-label={t("ui.imagemaskcanvas.clear")}
        title={t("ui.imagemaskcanvas.clear")}
        className={cn(
          MASK_ACTION_BUTTON_CLASS,
          "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]",
          compact ? "w-11 px-0" : "max-sm:w-11 max-sm:px-0 sm:px-2.5",
        )}
      >
        <Trash2 size="0.875rem" aria-hidden />
        {!compact && <span className="max-sm:sr-only">{t("ui.imagemaskcanvas.clear")}</span>}
      </button>
    </div>
  );
}

function PromptField({
  label,
  value,
  original,
  rows = 2,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  original: string;
  rows?: number;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useUiTranslation();
  const id = useId();
  const resetLabel = t("ui.chat.imageregeneratepanel.resetField", { field: label });

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className={LABEL_CLASS}>
          {label}
        </label>
        <button
          type="button"
          aria-label={resetLabel}
          title={resetLabel}
          onClick={() => onChange(original)}
          disabled={disabled || value === original}
          className={cn(BUTTON_CLASS, "w-11 shrink-0 px-0 text-[var(--muted-foreground)] hover:bg-[var(--accent)]")}
        >
          <RotateCcw size="1rem" aria-hidden />
        </button>
      </div>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        rows={rows}
        spellCheck={false}
        className={FIELD_CLASS}
      />
    </div>
  );
}

type PlacementAxis = "x" | "y";

/**
 * A caption's position needs both axes. A half-entered one stays here until the other axis arrives, so
 * one field never invents or erases the other's value.
 */
function PlacementFields({
  name,
  position,
  disabled,
  onChange,
}: {
  name: string;
  position: CharacterPrompt["position"];
  disabled: boolean;
  onChange: (position: CharacterPrompt["position"]) => void;
}) {
  const { t } = useUiTranslation();
  const [pending, setPending] = useState<Partial<Record<PlacementAxis, number>>>({});
  useEffect(() => {
    if (position) setPending({});
  }, [position]);
  const valueOf = (axis: PlacementAxis) => position?.[axis] ?? pending[axis] ?? null;

  const commit = (axis: PlacementAxis, value: number | null) => {
    const x = axis === "x" ? value : valueOf("x");
    const y = axis === "y" ? value : valueOf("y");
    if (x !== null && y !== null) {
      setPending({});
      onChange({ x, y });
      return;
    }
    setPending({ ...(x !== null ? { x } : {}), ...(y !== null ? { y } : {}) });
    onChange(undefined);
  };

  return (
    <fieldset className="grid grid-cols-2 gap-2">
      <legend className={LABEL_CLASS}>{t("ui.chat.imageregeneratepanel.characterPlacement", { name })}</legend>
      {(["x", "y"] as const).map((axis) => (
        <label key={axis} className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-[var(--muted-foreground)]">
            {t(axis === "x" ? "ui.chat.imageregeneratepanel.positionX" : "ui.chat.imageregeneratepanel.positionY")}
          </span>
          <DraftNumberInput
            allowEmpty
            integer={false}
            min={0}
            max={1}
            disabled={disabled}
            value={valueOf(axis)}
            placeholder={t("ui.chat.imageregeneratepanel.positionAutomatic")}
            className={FIELD_CLASS}
            onCommit={(value) => commit(axis, value)}
          />
        </label>
      ))}
      {!position && (pending.x !== undefined || pending.y !== undefined) && (
        <p role="status" className="col-span-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
          {t("ui.chat.imageregeneratepanel.placementIncomplete", { name })}
        </p>
      )}
    </fieldset>
  );
}

function MaskBrushSlider({
  maskControls,
  disabled,
  sliderId,
  compact = false,
}: {
  maskControls: ImageMaskControls;
  disabled: boolean;
  sliderId?: string;
  compact?: boolean;
}) {
  const { t } = useUiTranslation();

  return (
    <div className={cn("flex items-center gap-2", compact && "min-w-0 flex-1 sm:max-w-56")}>
      {!compact && (
        <label htmlFor={sliderId} className="shrink-0 text-xs text-[var(--muted-foreground)]">
          {t("ui.imagemaskcanvas.brushSize")}
        </label>
      )}
      <input
        id={compact ? undefined : sliderId}
        type="range"
        min={MIN_MASK_BRUSH_PX}
        max={MAX_MASK_BRUSH_PX}
        step={2}
        value={maskControls.brushSizePx}
        disabled={disabled}
        aria-label={compact ? t("ui.imagemaskcanvas.brushSize") : undefined}
        onChange={(event) => maskControls.onBrushSizeChange(Number(event.target.value))}
        className="min-h-11 min-w-0 flex-1 cursor-pointer accent-[var(--primary)] disabled:cursor-not-allowed"
      />
      <span className="w-11 shrink-0 text-right text-xs tabular-nums text-[var(--foreground)]">
        {t("ui.imagemaskcanvas.brushSizeValue", { size: maskControls.brushSizePx })}
      </span>
    </div>
  );
}

export function ImageRegeneratePanel({
  image,
  regenerator,
  record,
  messageId,
  maskDataUrl,
  maskControls,
  onEditSurfaceChange,
  onCancel,
  onBusyChange,
  onRegenerated,
  className,
}: ImageRegeneratePanelProps) {
  const { t } = useUiTranslation();
  const debugMode = useUIStore((s) => s.debugMode);
  const { data: connectionRows } = useConnections();
  const chatRegenerate = useRegenerateChatImage(image.chatId);
  const chatRevise = useReviseChatImagePrompt(image.chatId);
  const regenerate =
    regenerator?.regenerate ??
    ((input: RegenerateChatImageInput) => chatRegenerate.mutateAsync(input).then((r) => r.image));
  const revise = regenerator?.revise ?? chatRevise.mutateAsync;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const runningRef = useRef(false);
  const titleId = useId();
  const connectionFieldId = useId();
  const brushSizeFieldId = useId();
  const collapsedBrushSizeFieldId = useId();
  const strengthFieldId = useId();
  const noiseFieldId = useId();
  const original: ImagePromptDraft = {
    prompt: record?.prompt ?? image.prompt,
    negativePrompt: record?.negativePrompt ?? "",
    characterPrompts: record?.characterPrompts ?? [],
  };
  const [draft, setDraft] = useState(original);
  const [guidance, setGuidance] = useState("");
  const [connectionId, setConnectionId] = useState(record?.connectionId ?? "");
  const [mode, setMode] = useState<"regenerate" | "edit">("regenerate");
  const [collapsed, setCollapsed] = useState(false);
  const [reuseSeed, setReuseSeed] = useState(false);
  const [img2imgStrength, setImg2imgStrength] = useState(0.7);
  const [img2imgNoise, setImg2imgNoise] = useState(0);
  const [infillStrength, setInfillStrength] = useState(1);
  const [phase, setPhase] = useState<"revising" | "generating" | null>(null);
  const [error, setError] = useState("");
  const busy = phase !== null;
  const promptMissing = !draft.prompt.trim();
  const hasGuidance = Boolean(guidance.trim());
  const references = record?.references;
  const hasReferences =
    !!references && (references.characterIds.length > 0 || !!references.personaId || !!references.locationImageId);

  const imageSyncKey = `${image.id}:${image.generation ?? ""}:${image.prompt}`;
  const prevImageSyncKeyRef = useRef(imageSyncKey);
  const latestSyncRef = useRef({ original, connectionId: record?.connectionId });
  latestSyncRef.current = { original, connectionId: record?.connectionId };

  useEffect(() => {
    if (prevImageSyncKeyRef.current === imageSyncKey) return;
    prevImageSyncKeyRef.current = imageSyncKey;
    const next = latestSyncRef.current;
    setDraft(next.original);
    setError("");
    if (next.connectionId) setConnectionId(next.connectionId);
  }, [imageSyncKey]);

  const isNativeNovelAi = useMemo(() => {
    const rows = (connectionRows ?? []).filter(
      (row): row is Record<string, unknown> & { id: string; provider: string } =>
        !!row &&
        typeof row === "object" &&
        "id" in row &&
        typeof row.id === "string" &&
        "provider" in row &&
        row.provider === "image_generation",
    );
    const chosenId = connectionId || record?.connectionId || "";
    const chosen = chosenId ? rows.find((row) => row.id === chosenId) : undefined;
    const effective =
      chosen ??
      rows.find((row) => isConnectionFlagTrue(row.defaultForAgents)) ??
      (rows.length === 1 ? rows[0] : undefined);
    return isNativeNovelAiConnection(effective);
  }, [connectionId, connectionRows, record?.connectionId]);

  const effectiveMode = isNativeNovelAi ? mode : "regenerate";
  const effectiveReuseSeed = isNativeNovelAi ? reuseSeed : false;
  const hasMask = effectiveMode === "edit" && Boolean(maskDataUrl);
  const activeStrength = hasMask ? infillStrength : img2imgStrength;
  const showCollapsedMaskBar = collapsed && isNativeNovelAi && effectiveMode === "edit" && Boolean(maskControls);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    onEditSurfaceChange?.(effectiveMode === "edit");
    return () => {
      onEditSurfaceChange?.(false);
    };
  }, [effectiveMode, onEditSurfaceChange]);

  const updateCharacter = (index: number, update: (entry: CharacterPrompt) => CharacterPrompt) =>
    setDraft((current) => ({
      ...current,
      characterPrompts: current.characterPrompts.map((entry, entryIndex) =>
        entryIndex === index ? update(entry) : entry,
      ),
    }));

  const run = async (action: "revise" | "generate" | "both") => {
    if (runningRef.current || promptMissing) return;
    runningRef.current = true;
    onBusyChange(true);
    setError("");
    let step: "revising" | "generating" = action === "generate" ? "generating" : "revising";
    setPhase(step);
    try {
      let input = {
        prompt: draft.prompt.trim(),
        negativePrompt: draft.negativePrompt,
        characterPrompts: draft.characterPrompts.filter((entry) => entry.prompt.trim()),
      };
      const connection = connectionRows?.some(
        (row) =>
          !!row &&
          typeof row === "object" &&
          "id" in row &&
          row.id === connectionId &&
          "provider" in row &&
          row.provider === "image_generation",
      )
        ? { connectionId }
        : {};
      if (action !== "generate") {
        input = await revise({ imageId: image.id, ...input, guidance, ...connection, debugMode });
        // Merge revisions into the sent fields, keep cleared fields for reset, and append newly extracted captions.
        let revisedIndex = 0;
        const characterPrompts = draft.characterPrompts.map((entry) =>
          entry.prompt.trim() ? (input.characterPrompts[revisedIndex++] ?? entry) : entry,
        );
        characterPrompts.push(...input.characterPrompts.slice(revisedIndex));
        setDraft({ ...input, characterPrompts });
        setGuidance("");
        if (action === "revise") {
          toast.success(t("ui.chat.imageregeneratepanel.revised"));
          return;
        }
      }
      step = "generating";
      setPhase(step);
      const editParams =
        effectiveMode === "edit"
          ? {
              editMode: (hasMask ? "infill" : "img2img") as "img2img" | "infill",
              strength: activeStrength,
              ...(hasMask ? { maskImage: maskDataUrl! } : { noise: img2imgNoise }),
            }
          : {};
      const regenerated = await regenerate({
        imageId: image.id,
        ...input,
        ...connection,
        ...editParams,
        ...(effectiveReuseSeed ? { reuseSeed: true } : {}),
        ...(messageId ? { messageId } : {}),
        debugMode,
      });
      toast.success(regenerator?.regeneratedMessage ?? t("ui.chat.imageregeneratepanel.regenerated"));
      onRegenerated(regenerated);
    } catch (cause) {
      const label = t(
        step === "revising" ? "ui.chat.imageregeneratepanel.reviseFailed" : "ui.chat.imageregeneratepanel.failed",
      );
      setCollapsed(false);
      setError(
        cause instanceof Error
          ? t("ui.chat.imageregeneratepanel.errorDetail", { label, message: cause.message })
          : label,
      );
    } finally {
      runningRef.current = false;
      setPhase(null);
      onBusyChange(false);
    }
  };

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--sidebar)] text-left text-[var(--foreground)] shadow-2xl",
        NEUTRAL_SURFACE_VARIABLES,
        className,
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {showCollapsedMaskBar && maskControls && (
        <div className="border-b border-[var(--border)] px-3 py-0.5 sm:hidden">
          <MaskBrushSlider maskControls={maskControls} disabled={busy} sliderId={collapsedBrushSizeFieldId} />
        </div>
      )}
      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-2 px-3 py-1.5 sm:px-4",
          !collapsed && "border-b border-[var(--border)]",
        )}
      >
        <h2
          id={titleId}
          ref={titleRef}
          tabIndex={-1}
          className={cn(
            "min-w-0 shrink-0 truncate text-base font-semibold focus:outline-none",
            showCollapsedMaskBar && "max-md:sr-only",
          )}
        >
          {t("ui.chat.chatimagelightbox.regenerateImage")}
        </h2>
        <div
          className={cn(
            "flex shrink-0 items-center gap-1.5",
            showCollapsedMaskBar && "min-w-0 flex-1 justify-between md:justify-end md:gap-2",
          )}
        >
          {showCollapsedMaskBar && maskControls && (
            <>
              <div className="hidden min-w-0 flex-1 items-center sm:flex sm:max-w-56">
                <MaskBrushSlider maskControls={maskControls} disabled={busy} compact />
              </div>
              <MaskToolButtons maskControls={maskControls} disabled={busy} compact />
              <span
                role="status"
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-md border px-2 py-1 text-[0.7rem] font-medium",
                  hasMask
                    ? "border-[var(--primary)]/50 bg-[var(--primary)]/15 text-[var(--foreground)]"
                    : "border-[var(--border)] text-[var(--muted-foreground)]",
                )}
              >
                {t(hasMask ? "ui.imagemaskcanvas.modeInpaintingShort" : "ui.imagemaskcanvas.modeImg2Img")}
              </span>
            </>
          )}
          <div className="flex shrink-0 items-center gap-1">
            {collapsed && phase && <Spinner size="sm" aria-hidden="true" />}
            <button
              type="button"
              onClick={() => setCollapsed((current) => !current)}
              aria-expanded={!collapsed}
              aria-label={t(
                collapsed ? "ui.chat.imageregeneratepanel.expandPanel" : "ui.chat.imageregeneratepanel.collapsePanel",
              )}
              title={t(
                collapsed ? "ui.chat.imageregeneratepanel.expandPanel" : "ui.chat.imageregeneratepanel.collapsePanel",
              )}
              className={cn(
                BUTTON_CLASS,
                "w-11 shrink-0 px-0 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
              )}
            >
              {collapsed ? <ChevronUp size="1.125rem" aria-hidden /> : <ChevronDown size="1.125rem" aria-hidden />}
            </button>
          </div>
        </div>
      </div>
      {!collapsed && (
        <>
          {isNativeNovelAi && (
            <div
              role="tablist"
              aria-label={t("ui.chat.imageregeneratepanel.modeTablist")}
              className="flex shrink-0 gap-1 border-b border-[var(--border)] px-4 py-1.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={effectiveMode === "regenerate"}
                disabled={busy}
                onClick={() => setMode("regenerate")}
                className={cn(
                  BUTTON_CLASS,
                  "flex-1 rounded-lg",
                  effectiveMode === "regenerate"
                    ? "bg-[var(--accent)] font-semibold text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]/60 hover:text-[var(--foreground)]",
                )}
              >
                {t("ui.chat.imageregeneratepanel.modeRegenerate")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={effectiveMode === "edit"}
                disabled={busy}
                onClick={() => setMode("edit")}
                className={cn(
                  BUTTON_CLASS,
                  "flex-1 rounded-lg",
                  effectiveMode === "edit"
                    ? "bg-[var(--accent)] font-semibold text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]/60 hover:text-[var(--foreground)]",
                )}
              >
                {t("ui.chat.imageregeneratepanel.modeEditImage")}
              </button>
            </div>
          )}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-4 pt-3">
            {isNativeNovelAi && effectiveMode === "edit" && (
              <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--marinara-chat-chrome-input-bg)]/60 p-3">
                {maskControls && (
                  <div className="space-y-2 border-b border-[var(--border)] pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={LABEL_CLASS}>{t("ui.chat.imageregeneratepanel.maskTools")}</span>
                      <span
                        role="status"
                        className={cn(
                          "shrink-0 rounded-md border px-2 py-0.5 text-[0.7rem] font-medium",
                          hasMask
                            ? "border-[var(--primary)]/50 bg-[var(--primary)]/15 text-[var(--foreground)]"
                            : "border-[var(--border)] text-[var(--muted-foreground)]",
                        )}
                      >
                        {t(hasMask ? "ui.imagemaskcanvas.modeInpainting" : "ui.imagemaskcanvas.modeInpaintingShort")}
                      </span>
                    </div>
                    <MaskToolButtons maskControls={maskControls} disabled={busy} />
                    <MaskBrushSlider maskControls={maskControls} disabled={busy} sliderId={brushSizeFieldId} />
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <label htmlFor={strengthFieldId} className={LABEL_CLASS}>
                          {t("ui.chat.imageregeneratepanel.strength")}
                        </label>
                        <HelpTooltip
                          text={t(
                            hasMask
                              ? "ui.chat.imageregeneratepanel.infillStrengthHelp"
                              : "ui.chat.imageregeneratepanel.img2imgStrengthHelp",
                          )}
                          ariaLabel={t("ui.chat.imageregeneratepanel.strengthHelpLabel")}
                          size="0.875rem"
                          wide
                        />
                      </div>
                      <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
                        {activeStrength.toFixed(2)}
                      </span>
                    </div>
                    <input
                      id={strengthFieldId}
                      type="range"
                      min={0.01}
                      max={hasMask ? 1 : 0.99}
                      step={0.01}
                      value={activeStrength}
                      disabled={busy}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (hasMask) setInfillStrength(value);
                        else setImg2imgStrength(value);
                      }}
                      className="min-h-11 w-full cursor-pointer accent-[var(--primary)] disabled:cursor-not-allowed"
                    />
                  </div>
                  {!hasMask && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <label htmlFor={noiseFieldId} className={LABEL_CLASS}>
                            {t("ui.chat.imageregeneratepanel.noise")}
                          </label>
                          <HelpTooltip
                            text={t("ui.chat.imageregeneratepanel.noiseHelp")}
                            ariaLabel={t("ui.chat.imageregeneratepanel.noiseHelpLabel")}
                            size="0.875rem"
                            wide
                          />
                        </div>
                        <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
                          {img2imgNoise.toFixed(2)}
                        </span>
                      </div>
                      <input
                        id={noiseFieldId}
                        type="range"
                        min={0}
                        max={0.99}
                        step={0.01}
                        value={img2imgNoise}
                        disabled={busy}
                        onChange={(event) => setImg2imgNoise(Number(event.target.value))}
                        className="min-h-11 w-full cursor-pointer accent-[var(--primary)] disabled:cursor-not-allowed"
                      />
                    </div>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                  {t(
                    hasMask
                      ? "ui.chat.imageregeneratepanel.inpaintingHint"
                      : "ui.chat.imageregeneratepanel.img2imgHint",
                  )}
                </p>
              </div>
            )}

            <PromptField
              label={t("ui.agents.customagentrepositoriesmodal.prompt")}
              value={draft.prompt}
              original={original.prompt}
              onChange={(prompt) => setDraft((current) => ({ ...current, prompt }))}
              disabled={busy}
              rows={4}
            />
            <PromptField
              label={t("ui.agents.agenteditor.negativePrompt")}
              value={draft.negativePrompt}
              original={original.negativePrompt}
              onChange={(negativePrompt) => setDraft((current) => ({ ...current, negativePrompt }))}
              disabled={busy}
            />

            {draft.characterPrompts.length > 0 && (
              <div className="space-y-3 border-t border-[var(--border)] pt-3">
                <h3 className="text-sm font-semibold">{t("ui.chat.imageregeneratepanel.characterPrompts")}</h3>
                {draft.characterPrompts.map((character, index) => (
                  <div key={`${character.name}-${index}`} className="space-y-2">
                    <PromptField
                      label={t("ui.chat.imagepromptpanel.characterPrompt", { name: character.name })}
                      value={character.prompt}
                      original={original.characterPrompts[index]?.prompt ?? ""}
                      onChange={(prompt) => updateCharacter(index, (entry) => ({ ...entry, prompt }))}
                      disabled={busy}
                    />
                    <PromptField
                      label={t("ui.chat.imagepromptpanel.characterNegativePrompt", { name: character.name })}
                      value={character.negativePrompt ?? ""}
                      original={original.characterPrompts[index]?.negativePrompt ?? ""}
                      onChange={(negativePrompt) => updateCharacter(index, (entry) => ({ ...entry, negativePrompt }))}
                      disabled={busy}
                    />
                    <PlacementFields
                      name={character.name}
                      position={character.position}
                      disabled={busy}
                      onChange={(position) => updateCharacter(index, (entry) => ({ ...entry, position }))}
                    />
                  </div>
                ))}
              </div>
            )}

            <label className="flex flex-col gap-2 border-t border-[var(--border)] pt-3">
              <span className={LABEL_CLASS}>{t("ui.chat.imageregeneratepanel.guidance")}</span>
              <textarea
                value={guidance}
                onChange={(event) => setGuidance(event.target.value)}
                disabled={busy}
                rows={2}
                maxLength={4000}
                placeholder={t("ui.chat.imageregeneratepanel.guidancePlaceholder")}
                className={FIELD_CLASS}
              />
            </label>

            <div className="flex flex-col gap-2">
              <label htmlFor={connectionFieldId} className={LABEL_CLASS}>
                {t("ui.chat.imageregeneratepanel.connection")}
              </label>
              <ConnectionSelect
                id={connectionFieldId}
                job={t("connections.picker.job.imageRegeneration")}
                kind="image"
                value={connectionId || null}
                onChange={(nextId) => setConnectionId(nextId ?? "")}
                defaultLabel={regenerator?.defaultConnectionLabel ?? t("ui.chat.imageregeneratepanel.chatConnection")}
                disabled={busy}
                className="min-h-11"
              />
            </div>

            {isNativeNovelAi && (
              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]">
                <Checkbox
                  checked={effectiveReuseSeed}
                  disabled={busy}
                  onChange={(event) => setReuseSeed(event.target.checked)}
                />
                <span>
                  {record?.seed !== undefined
                    ? t("ui.chat.imageregeneratepanel.reuseOriginalSeedValue", { seed: record.seed })
                    : t("ui.chat.imageregeneratepanel.reuseOriginalSeed")}
                </span>
              </label>
            )}

            {(effectiveMode === "edit" ? hasReferences : !record || hasReferences) && (
              <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                {t(
                  effectiveMode === "edit"
                    ? "ui.chat.imageregeneratepanel.referencesOmittedInEditNotice"
                    : !record
                      ? "ui.chat.imageregeneratepanel.noRecordNotice"
                      : "ui.chat.imageregeneratepanel.referencesNotice",
                )}
              </p>
            )}
          </div>

          <div className="shrink-0 border-t border-[var(--border)] px-4 py-3">
            {error && (
              <p role="alert" className="mb-2 max-h-20 overflow-y-auto break-words text-sm text-[var(--destructive)]">
                {error}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {phase && (
                <p role="status" className="mr-auto flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <Spinner size="md" aria-hidden="true" />
                  {t(
                    phase === "revising"
                      ? "ui.chat.imageregeneratepanel.revising"
                      : "ui.chat.imageregeneratepanel.generating",
                  )}
                </p>
              )}
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className={cn(BUTTON_CLASS, "hover:bg-[var(--accent)]")}
              >
                {t("chat.delete.dialog.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void run("revise")}
                disabled={busy || promptMissing}
                className={SECONDARY_BUTTON_CLASS}
              >
                <Sparkles size="1rem" aria-hidden />
                {t("ui.chat.imageregeneratepanel.revise")}
              </button>
              <button
                type="button"
                onClick={() => void run(hasGuidance ? "both" : "generate")}
                disabled={busy || promptMissing}
                className={cn(
                  BUTTON_CLASS,
                  "bg-[var(--primary)] font-semibold text-[var(--primary-foreground)] hover:opacity-90",
                )}
              >
                {hasGuidance ? <Sparkles size="1rem" aria-hidden /> : <RefreshCw size="1rem" aria-hidden />}
                {t(
                  hasGuidance
                    ? effectiveMode === "edit"
                      ? hasMask
                        ? "ui.chat.imageregeneratepanel.reviseAndInpaint"
                        : "ui.chat.imageregeneratepanel.reviseAndEdit"
                      : "ui.chat.imageregeneratepanel.reviseAndGenerate"
                    : effectiveMode === "edit"
                      ? hasMask
                        ? "ui.chat.imageregeneratepanel.inpaint"
                        : "ui.chat.imageregeneratepanel.applyEdit"
                      : "ui.chat.imageregeneratepanel.generate",
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
