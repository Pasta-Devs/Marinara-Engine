// ──────────────────────────────────────────────
// Sprite Generation Modal
// ──────────────────────────────────────────────
// Generates a character expression sheet via image generation,
// slices it into individual sprites, and lets the user label/save them.
import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { X, Loader2, Check, ImagePlus, Sparkles, ArrowLeft, Crop, RotateCcw } from "lucide-react";
import { Modal } from "./Modal";
import { cn } from "../../lib/utils";
import { cropSpriteDataUrl, type SpriteFrameAdjustments } from "../../lib/sprite-frame-crop";
import { useUIStore } from "../../stores/ui.store";
import { spriteApi, type SpriteOwnerType } from "../../api/image-generation-api";
import { ImagePromptReviewModal, type ImagePromptOverride, type ImagePromptReviewItem } from "./ImagePromptReviewModal";
import type { ImageGenerationConnectionOption } from "../../types/image-generation";
import type { SpriteCapabilities } from "../../types/sprite-capabilities";

// ── Types ──

interface SpriteGenerationModalProps {
  open: boolean;
  onClose: () => void;
  /** Entity ID — character or persona */
  entityId: string;
  entityKind?: SpriteOwnerType;
  /** Optional initial mode shown when opening */
  initialSpriteType?: "expressions" | "full-body";
  /** Existing portrait expression names that full-body generation can mirror */
  existingExpressionNames?: string[];
  /** Pre-filled appearance description */
  defaultAppearance?: string;
  /** Pre-filled avatar (base64 data URL) for reference */
  defaultAvatarUrl?: string | null;
  imageConnections: ImageGenerationConnectionOption[];
  spriteCapabilities?: SpriteCapabilities | null;
  /** Callback after sprites are saved */
  onSpritesGenerated?: () => void;
}

interface SlicedCell {
  expression: string;
  rawDataUrl: string;
  dataUrl: string;
  selected: boolean;
  sourceSheetDataUrl?: string | null;
  sourceCellIndex?: number;
  sourceGrid?: SpriteGrid;
}

interface SpriteGrid {
  cols: number;
  rows: number;
}

interface GenerateSheetResult {
  sheetBase64: string;
  cells: Array<{ expression: string; base64: string }>;
  failedExpressions?: Array<{ expression: string; error: string }>;
}

interface GenerateSheetPreviewResult {
  items: ImagePromptReviewItem[];
}

interface GeneratedSheetPreview {
  id: string;
  label: string;
  dataUrl: string;
  grid: SpriteGrid;
}

interface FailedMatchedFullBodyBatch {
  batchIndex: number;
  totalBatches: number;
  expressions: string[];
  remainingBatches: string[][];
  error: string;
}

interface SliceAdjustments {
  marginX: number;
  marginY: number;
  gapX: number;
  gapY: number;
  offsetX: number;
  offsetY: number;
  cropLeft: number;
  cropRight: number;
  cropTop: number;
  cropBottom: number;
  colCuts: number[];
  rowCuts: number[];
}

type NumericSliceAdjustmentKey = Exclude<keyof SliceAdjustments, "colCuts" | "rowCuts">;

type SpriteFrameAdjustmentKey = keyof SpriteFrameAdjustments;

class SpritePromptReviewCancelledError extends Error {
  constructor() {
    super("Sprite generation cancelled");
    this.name = "SpritePromptReviewCancelledError";
  }
}

function isSpritePromptReviewCancelled(error: unknown): error is SpritePromptReviewCancelledError {
  return error instanceof SpritePromptReviewCancelledError;
}

// ── Constants ──

const EXPRESSION_PRESETS = {
  "1 (1×1)": {
    cols: 1,
    rows: 1,
    expressions: ["neutral"],
  },
  "6 (2×3)": {
    cols: 2,
    rows: 3,
    expressions: ["neutral", "happy", "sad", "angry", "surprised", "smirk"],
  },
  "9 (3×3)": {
    cols: 3,
    rows: 3,
    expressions: ["neutral", "happy", "sad", "angry", "surprised", "scared", "disgusted", "thinking", "laughing"],
  },
  "12 (3×4)": {
    cols: 3,
    rows: 4,
    expressions: [
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
      "determined",
      "confused",
    ],
  },
  "16 (4×4)": {
    cols: 4,
    rows: 4,
    expressions: [
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
      "embarrassed",
      "determined",
      "confused",
      "sleepy",
    ],
  },
} as const;

type PresetKey = keyof typeof EXPRESSION_PRESETS;

type SpriteType = "expressions" | "full-body";

const DEFAULT_SPRITE_PRESET: PresetKey = "6 (2×3)";
const MATCHED_FULL_BODY_EXPRESSION_LIMIT = 16;
const MATCHED_FULL_BODY_BATCH_SIZE = 4;

const FULL_BODY_POSE_PRESETS: Record<PresetKey, string[]> = {
  "1 (1×1)": ["idle"],
  "6 (2×3)": ["idle", "walk", "battle_stance", "casting", "defend", "victory"],
  "9 (3×3)": ["idle", "walk", "run", "battle_stance", "attack", "defend", "casting", "hurt", "victory"],
  "12 (3×4)": [
    "idle",
    "walk",
    "run",
    "battle_stance",
    "attack",
    "defend",
    "casting",
    "hurt",
    "jump",
    "thinking",
    "cheer",
    "victory",
  ],
  "16 (4×4)": [
    "idle",
    "walk",
    "run",
    "battle_stance",
    "attack",
    "defend",
    "casting",
    "hurt",
    "jump",
    "thinking",
    "cheer",
    "victory",
    "wave",
    "sit",
    "kneel",
    "point",
  ],
};

const ALL_EXPRESSIONS = [
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
  "embarrassed",
  "determined",
  "confused",
  "sleepy",
];

const ALL_FULL_BODY_POSES = [
  "idle",
  "walk",
  "run",
  "battle_stance",
  "attack",
  "defend",
  "casting",
  "hurt",
  "jump",
  "thinking",
  "cheer",
  "victory",
  "wave",
  "sit",
  "kneel",
  "point",
];

const DEFAULT_SLICE_ADJUSTMENTS: SliceAdjustments = {
  marginX: 0,
  marginY: 0,
  gapX: 0,
  gapY: 0,
  offsetX: 0,
  offsetY: 0,
  cropLeft: 0,
  cropRight: 0,
  cropTop: 0,
  cropBottom: 0,
  colCuts: [],
  rowCuts: [],
};

const DEFAULT_SPRITE_FRAME_ADJUSTMENTS: SpriteFrameAdjustments = {
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
};

const SLICE_GRID_CONTROLS: Array<{
  key: NumericSliceAdjustmentKey;
  label: string;
  min: number;
  max: number;
  step: number;
}> = [
  { key: "marginX", label: "Side margin", min: 0, max: 18, step: 0.1 },
  { key: "marginY", label: "Top/bottom margin", min: 0, max: 18, step: 0.1 },
  { key: "gapX", label: "Column gap", min: 0, max: 24, step: 0.1 },
  { key: "gapY", label: "Row gap", min: 0, max: 24, step: 0.1 },
  { key: "offsetX", label: "Nudge X", min: -12, max: 12, step: 0.1 },
  { key: "offsetY", label: "Nudge Y", min: -12, max: 12, step: 0.1 },
];

const SLICE_EDGE_CONTROLS: Array<{
  key: NumericSliceAdjustmentKey;
  label: string;
  min: number;
  max: number;
  step: number;
}> = [
  { key: "cropTop", label: "Crop top", min: 0, max: 40, step: 0.5 },
  { key: "cropBottom", label: "Crop bottom", min: 0, max: 40, step: 0.5 },
  { key: "cropLeft", label: "Crop left", min: 0, max: 40, step: 0.5 },
  { key: "cropRight", label: "Crop right", min: 0, max: 40, step: 0.5 },
];

const SPRITE_FRAME_CONTROLS: Array<{
  key: SpriteFrameAdjustmentKey;
  label: string;
}> = [
  { key: "top", label: "Top" },
  { key: "bottom", label: "Bottom" },
  { key: "left", label: "Left" },
  { key: "right", label: "Right" },
];

const SPRITE_FRAME_MAX_PAIR_CROP = 90;

function createDefaultSliceAdjustments(grid?: { cols: number; rows: number }): SliceAdjustments {
  return {
    ...DEFAULT_SLICE_ADJUSTMENTS,
    colCuts: Array.from({ length: Math.max(0, (grid?.cols ?? 1) - 1) }, () => 0),
    rowCuts: Array.from({ length: Math.max(0, (grid?.rows ?? 1) - 1) }, () => 0),
  };
}

function chunkItems<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function getMatchedFullBodyBatchGrid(count: number): SpriteGrid {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count <= 2) return { cols: 2, rows: 1 };
  return { cols: 2, rows: 2 };
}

function imageDataUrl(base64: string): string {
  return `data:image/png;base64,${base64}`;
}

function getGenerationErrorMessage(err: unknown): string {
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message?: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  return "Image generation failed";
}

function createGeneratedSpritesFromResult(
  result: GenerateSheetResult,
  grid: SpriteGrid,
  label: string,
): { sheet: GeneratedSheetPreview | null; cells: SlicedCell[] } {
  const sheet = result.sheetBase64
    ? {
        id: `${label}-${result.sheetBase64.slice(0, 16)}`,
        label,
        dataUrl: imageDataUrl(result.sheetBase64),
        grid,
      }
    : null;
  const sourceSheetDataUrl = sheet?.dataUrl ?? null;

  return {
    sheet,
    cells: result.cells.map((cell, index) => ({
      expression: cell.expression,
      rawDataUrl: imageDataUrl(cell.base64),
      dataUrl: imageDataUrl(cell.base64),
      selected: true,
      sourceSheetDataUrl,
      sourceCellIndex: sourceSheetDataUrl ? index : undefined,
      sourceGrid: sourceSheetDataUrl ? grid : undefined,
    })),
  };
}

function percentToPixels(size: number, value: number): number {
  return Math.round((size * value) / 100);
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(80, Number.isFinite(value) ? value : 0));
}

function clampBoundaries(boundaries: number[], minSpan: number): number[] {
  const next = [...boundaries];
  for (let i = 1; i < next.length; i++) {
    next[i] = Math.max(next[i], next[i - 1] + minSpan);
  }
  for (let i = next.length - 2; i >= 0; i--) {
    next[i] = Math.min(next[i], next[i + 1] - minSpan);
  }
  return next;
}

function buildSliceBoundaries(
  size: number,
  count: number,
  marginPercent: number,
  offsetPercent: number,
  cutOffsets: number[],
): number[] {
  const margin = percentToPixels(size, marginPercent);
  const offset = percentToPixels(size, offsetPercent);
  const start = margin + offset;
  const end = size - margin + offset;
  const span = end - start;
  const boundaries = Array.from({ length: count + 1 }, (_, index) => {
    if (index === 0) return start;
    if (index === count) return end;
    return start + (span * index) / count + percentToPixels(size, cutOffsets[index - 1] ?? 0);
  });

  return clampBoundaries(boundaries, Math.max(8, Math.floor(size * 0.03)));
}

function normalizeSpriteLabel(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/^full_/, "");
}

function getMatchedFullBodyGrid(count: number): { cols: number; rows: number } {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count <= 2) return { cols: 2, rows: 1 };
  if (count <= 3) return { cols: 3, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  if (count <= 9) return { cols: 3, rows: 3 };
  if (count <= 12) return { cols: 4, rows: 3 };
  return { cols: 4, rows: 4 };
}

// ── Component ──

export function SpriteGenerationModal({
  open,
  onClose,
  entityId,
  entityKind = "character",
  initialSpriteType = "expressions",
  existingExpressionNames = [],
  defaultAppearance,
  defaultAvatarUrl,
  imageConnections,
  spriteCapabilities,
  onSpritesGenerated,
}: SpriteGenerationModalProps) {
  // Step: 0 = configure, 1 = generating, 2 = preview & label
  const [step, setStep] = useState<0 | 1 | 2>(0);

  // Sprite type: expressions (portrait) or full-body
  const [spriteType, setSpriteType] = useState<SpriteType>(initialSpriteType);

  // Config state
  const [appearance, setAppearance] = useState(defaultAppearance ?? "");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [useCurrentAvatarReference, setUseCurrentAvatarReference] = useState(false);
  const [preset, setPreset] = useState<PresetKey>(DEFAULT_SPRITE_PRESET);
  const [selectedExpressions, setSelectedExpressions] = useState<string[]>([
    ...EXPRESSION_PRESETS[DEFAULT_SPRITE_PRESET].expressions,
  ]);
  const [matchExistingExpressions, setMatchExistingExpressions] = useState(false);
  const [nativeTransparentPng, setNativeTransparentPng] = useState(false);
  const [noBackground, setNoBackground] = useState(true);
  const [cleanupStrength, setCleanupStrength] = useState(35);
  const [connectionId, setConnectionId] = useState<string | null>(null);

  // Generation state
  const [generatedSheet, setGeneratedSheet] = useState<string | null>(null);
  const [generatedSheets, setGeneratedSheets] = useState<GeneratedSheetPreview[]>([]);
  const [cells, setCells] = useState<SlicedCell[]>([]);
  const [failedMatchedBatch, setFailedMatchedBatch] = useState<FailedMatchedFullBodyBatch | null>(null);
  const [generationProgress, setGenerationProgress] = useState<string | null>(null);
  const [cleanupApplying, setCleanupApplying] = useState(false);
  const [cleanupApplied, setCleanupApplied] = useState(false);
  const [sliceAdjustments, setSliceAdjustments] = useState<SliceAdjustments>(DEFAULT_SLICE_ADJUSTMENTS);
  const [sliceApplying, setSliceApplying] = useState(false);
  const [activeFrameIndex, setActiveFrameIndex] = useState<number | null>(null);
  const [frameAdjustments, setFrameAdjustments] = useState<SpriteFrameAdjustments>(DEFAULT_SPRITE_FRAME_ADJUSTMENTS);
  const [framePreviewUrl, setFramePreviewUrl] = useState<string | null>(null);
  const [frameApplying, setFrameApplying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptReviewItems, setPromptReviewItems] = useState<ImagePromptReviewItem[]>([]);
  const [promptReviewSubmitting, setPromptReviewSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptReviewResolveRef = useRef<((overrides: ImagePromptOverride[] | null) => void) | null>(null);
  const reviewImagePromptsBeforeSend = useUIStore((s) => s.reviewImagePromptsBeforeSend);

  // Connections and capabilities are injected by feature-owned containers.
  const spriteGenerationUnavailable = spriteCapabilities?.spriteGenerationAvailable === false;
  const spriteGenerationReason = spriteCapabilities?.reason ?? "Sprite generation is unavailable on this platform.";
  const cleanupEngineUnavailable = spriteCapabilities?.cleanupEngine?.installed === false;
  const cleanupEngineReason = spriteCapabilities?.cleanupEngine?.reason ?? "Sprite cleanup is not available.";
  const existingPortraitExpressions = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const rawName of existingExpressionNames) {
      const normalized = normalizeSpriteLabel(rawName);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      names.push(normalized);
    }
    return names;
  }, [existingExpressionNames]);
  const matchedFullBodyExpressions = useMemo(
    () => existingPortraitExpressions.slice(0, MATCHED_FULL_BODY_EXPRESSION_LIMIT),
    [existingPortraitExpressions],
  );
  const matchedFullBodyGrid = useMemo(
    () => getMatchedFullBodyGrid(matchedFullBodyExpressions.length),
    [matchedFullBodyExpressions.length],
  );
  const matchedFullBodyBatches = useMemo(
    () => chunkItems(matchedFullBodyExpressions, MATCHED_FULL_BODY_BATCH_SIZE),
    [matchedFullBodyExpressions],
  );
  const matchedFullBodySliceGrid = useMemo(
    () => getMatchedFullBodyBatchGrid(Math.min(matchedFullBodyExpressions.length, MATCHED_FULL_BODY_BATCH_SIZE)),
    [matchedFullBodyExpressions.length],
  );
  const fullBodyExpressionMode =
    spriteType === "full-body" && matchExistingExpressions && matchedFullBodyExpressions.length > 0;
  const generationGrid = fullBodyExpressionMode ? matchedFullBodyGrid : EXPRESSION_PRESETS[preset];
  const sliceAdjustmentGrid = fullBodyExpressionMode ? matchedFullBodySliceGrid : generationGrid;
  const generationCapacity = generationGrid.cols * generationGrid.rows;
  const selectedTargetCount = fullBodyExpressionMode ? matchedFullBodyExpressions.length : generationCapacity;
  const singleImageMode = generationCapacity === 1;
  const cappedSelectedExpressions = useMemo(
    () => (fullBodyExpressionMode ? matchedFullBodyExpressions : selectedExpressions.slice(0, generationCapacity)),
    [fullBodyExpressionMode, generationCapacity, matchedFullBodyExpressions, selectedExpressions],
  );
  const previewColumnCount = generationGrid.cols;
  const canAdjustSlices = cells.some((cell) => !!cell.sourceSheetDataUrl);
  const activeFrameCell = activeFrameIndex === null ? null : (cells[activeFrameIndex] ?? null);
  const hasCurrentAvatarReference = !!defaultAvatarUrl;
  const maxUploadedReferenceImages = useCurrentAvatarReference && hasCurrentAvatarReference ? 3 : 4;
  const effectiveReferenceImages = useMemo(
    () =>
      [useCurrentAvatarReference && defaultAvatarUrl ? defaultAvatarUrl : null, ...referenceImages]
        .filter((img): img is string => !!img)
        .slice(0, 4),
    [defaultAvatarUrl, referenceImages, useCurrentAvatarReference],
  );

  // Auto-select first image connection
  const effectiveConnectionId = connectionId ?? imageConnections[0]?.id ?? null;
  const selectedImageConnection = useMemo(
    () => imageConnections.find((connection) => connection.id === effectiveConnectionId) ?? null,
    [effectiveConnectionId, imageConnections],
  );
  const selectedImageModel = selectedImageConnection?.model?.trim().toLowerCase() ?? "";
  const selectedModelIsGptImage2 = /^gpt-image-2(?:$|-)/.test(selectedImageModel);

  const openPromptReview = useCallback((items: ImagePromptReviewItem[]) => {
    return new Promise<ImagePromptOverride[] | null>((resolve) => {
      promptReviewResolveRef.current = resolve;
      setPromptReviewSubmitting(false);
      setPromptReviewItems(items);
    });
  }, []);

  const closePromptReview = useCallback((overrides: ImagePromptOverride[] | null) => {
    const resolve = promptReviewResolveRef.current;
    promptReviewResolveRef.current = null;
    setPromptReviewSubmitting(false);
    setPromptReviewItems([]);
    resolve?.(overrides);
  }, []);

  useEffect(() => {
    return () => {
      const resolve = promptReviewResolveRef.current;
      promptReviewResolveRef.current = null;
      resolve?.(null);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setSpriteType(initialSpriteType);
    setPreset(DEFAULT_SPRITE_PRESET);
    setSelectedExpressions(
      initialSpriteType === "full-body"
        ? [...FULL_BODY_POSE_PRESETS[DEFAULT_SPRITE_PRESET]]
        : [...EXPRESSION_PRESETS[DEFAULT_SPRITE_PRESET].expressions],
    );
    setMatchExistingExpressions(false);
  }, [open, initialSpriteType]);

  // Reset reference image & appearance when the target sprite owner changes
  useEffect(() => {
    setAppearance(defaultAppearance ?? "");
    setReferenceImages([]);
    setUseCurrentAvatarReference(!!defaultAvatarUrl);
    setStep(0);
    setGeneratedSheet(null);
    setGeneratedSheets([]);
    setCells([]);
    setFailedMatchedBatch(null);
    setGenerationProgress(null);
    setSliceAdjustments(DEFAULT_SLICE_ADJUSTMENTS);
    setActiveFrameIndex(null);
    setFrameAdjustments(DEFAULT_SPRITE_FRAME_ADJUSTMENTS);
    setFramePreviewUrl(null);
    setMatchExistingExpressions(false);
    setError(null);
  }, [entityId, entityKind, defaultAvatarUrl, defaultAppearance]);

  useEffect(() => {
    if (activeFrameIndex !== null && activeFrameIndex >= cells.length) {
      setActiveFrameIndex(null);
      setFrameAdjustments(DEFAULT_SPRITE_FRAME_ADJUSTMENTS);
      setFramePreviewUrl(null);
    }
  }, [activeFrameIndex, cells.length]);

  useEffect(() => {
    if (!activeFrameCell) {
      setFramePreviewUrl(null);
      return;
    }

    let cancelled = false;
    cropSpriteDataUrl(activeFrameCell.dataUrl, frameAdjustments)
      .then((preview) => {
        if (!cancelled) setFramePreviewUrl(preview);
      })
      .catch(() => {
        if (!cancelled) setFramePreviewUrl(activeFrameCell.dataUrl);
      });

    return () => {
      cancelled = true;
    };
  }, [activeFrameCell, frameAdjustments]);

  // ── Handlers ──

  const handleReferenceUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () =>
        setReferenceImages((prev) =>
          prev.length < maxUploadedReferenceImages ? [...prev, reader.result as string] : prev,
        );
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [maxUploadedReferenceImages],
  );

  const removeReferenceImage = useCallback((idx: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handlePresetChange = useCallback(
    (key: PresetKey) => {
      setPreset(key);
      setSelectedExpressions(
        spriteType === "full-body" ? [...FULL_BODY_POSE_PRESETS[key]] : [...EXPRESSION_PRESETS[key].expressions],
      );
    },
    [spriteType],
  );

  const toggleExpression = useCallback(
    (expr: string) => {
      setSelectedExpressions((prev) => {
        if (prev.includes(expr)) {
          return prev.filter((entry) => entry !== expr);
        }
        if (singleImageMode) {
          return [expr];
        }
        if (prev.length >= selectedTargetCount) {
          return [...prev.slice(1), expr];
        }
        return [...prev, expr];
      });
    },
    [selectedTargetCount, singleImageMode],
  );

  const requestGeneratedSheet = useCallback(
    async (expressions: string[], grid: SpriteGrid, matchedFullBodyMode: boolean): Promise<GenerateSheetResult> => {
      if (!effectiveConnectionId) throw new Error("Image generation connection is required");

      const payload = {
        connectionId: effectiveConnectionId,
        appearance,
        referenceImages: effectiveReferenceImages.length > 0 ? effectiveReferenceImages : undefined,
        expressions,
        cols: grid.cols,
        rows: grid.rows,
        spriteType,
        fullBodyExpressionMode: matchedFullBodyMode,
        nativeTransparentPng,
        // Keep server generation raw; client preview cleanup preserves originals.
        noBackground: false,
      };

      if (reviewImagePromptsBeforeSend) {
        const preview = await spriteApi.generateSheetPreview<GenerateSheetPreviewResult>(payload);
        if (preview.items.length > 0) {
          const overrides = await openPromptReview(preview.items);
          if (!overrides) throw new SpritePromptReviewCancelledError();
          setPromptReviewSubmitting(true);
          try {
            return await spriteApi.generateSheet<GenerateSheetResult>({
              ...payload,
              promptOverrides: overrides,
            });
          } finally {
            setPromptReviewSubmitting(false);
          }
        }
      }

      return spriteApi.generateSheet<GenerateSheetResult>(payload);
    },
    [
      appearance,
      effectiveConnectionId,
      effectiveReferenceImages,
      nativeTransparentPng,
      openPromptReview,
      reviewImagePromptsBeforeSend,
      spriteType,
    ],
  );

  const generateMatchedFullBodyBatch = useCallback(
    async (batchExpressions: string[], batchIndex: number, totalBatches: number) => {
      const grid = getMatchedFullBodyBatchGrid(batchExpressions.length);
      let lastError = "Image generation failed";

      for (let attempt = 0; attempt < 2; attempt += 1) {
        setGenerationProgress(
          `Batch ${batchIndex + 1} of ${totalBatches}${attempt === 1 ? " (retrying once)" : ""}: ${batchExpressions
            .map((expr) => expr.replace(/_/g, " "))
            .join(", ")}`,
        );

        try {
          const result = await requestGeneratedSheet(batchExpressions, grid, true);
          if (result.failedExpressions?.length) {
            throw new Error(result.failedExpressions.map((entry) => `${entry.expression}: ${entry.error}`).join("; "));
          }
          if (result.cells.length < batchExpressions.length) {
            throw new Error("The provider returned fewer sprites than requested");
          }
          return createGeneratedSpritesFromResult(result, grid, `Batch ${batchIndex + 1}`);
        } catch (err) {
          lastError = getGenerationErrorMessage(err);
        }
      }

      throw new Error(lastError);
    },
    [requestGeneratedSheet],
  );

  const runMatchedFullBodyBatches = useCallback(
    async ({
      batches,
      startIndex,
      initialCells,
      initialSheets,
    }: {
      batches: string[][];
      startIndex: number;
      initialCells: SlicedCell[];
      initialSheets: GeneratedSheetPreview[];
    }) => {
      let nextCells = [...initialCells];
      let nextSheets = [...initialSheets];

      setFailedMatchedBatch(null);

      for (let batchIndex = startIndex; batchIndex < batches.length; batchIndex += 1) {
        const batchExpressions = batches[batchIndex] ?? [];
        if (batchExpressions.length === 0) continue;

        try {
          const generated = await generateMatchedFullBodyBatch(batchExpressions, batchIndex, batches.length);
          nextCells = [...nextCells, ...generated.cells];
          if (generated.sheet) nextSheets = [...nextSheets, generated.sheet];
        } catch (err) {
          if (isSpritePromptReviewCancelled(err)) {
            setStep(0);
            setError(null);
            setGenerationProgress(null);
            return;
          }
          const message = getGenerationErrorMessage(err);
          setCells(nextCells);
          setGeneratedSheets(nextSheets);
          setGeneratedSheet(nextSheets[0]?.dataUrl ?? null);
          setFailedMatchedBatch({
            batchIndex,
            totalBatches: batches.length,
            expressions: batchExpressions,
            remainingBatches: batches.slice(batchIndex + 1),
            error: message,
          });
          setCleanupApplied(false);
          setGenerationProgress(null);
          setStep(2);
          setError(`Batch ${batchIndex + 1} of ${batches.length} failed after one automatic retry: ${message}`);
          return;
        }
      }

      setCells(nextCells);
      setGeneratedSheets(nextSheets);
      setGeneratedSheet(nextSheets[0]?.dataUrl ?? null);
      setFailedMatchedBatch(null);
      setCleanupApplied(false);
      setGenerationProgress(null);
      setError(null);
      setStep(2);
    },
    [generateMatchedFullBodyBatch],
  );

  const handleGenerate = useCallback(async () => {
    if (spriteGenerationUnavailable || !effectiveConnectionId || cappedSelectedExpressions.length === 0) return;

    setStep(1);
    setError(null);
    setGeneratedSheet(null);
    setGeneratedSheets([]);
    setCells([]);
    setFailedMatchedBatch(null);
    setGenerationProgress(null);
    setCleanupApplied(false);
    setActiveFrameIndex(null);
    setFrameAdjustments(DEFAULT_SPRITE_FRAME_ADJUSTMENTS);
    setFramePreviewUrl(null);
    setSliceAdjustments(createDefaultSliceAdjustments(sliceAdjustmentGrid));

    if (fullBodyExpressionMode) {
      await runMatchedFullBodyBatches({
        batches: matchedFullBodyBatches,
        startIndex: 0,
        initialCells: [],
        initialSheets: [],
      });
      return;
    }

    try {
      const result = await requestGeneratedSheet(cappedSelectedExpressions, generationGrid, false);
      const generated = createGeneratedSpritesFromResult(result, generationGrid, "Generated sheet");

      setGeneratedSheet(generated.sheet?.dataUrl ?? null);
      setGeneratedSheets(generated.sheet ? [generated.sheet] : []);
      setCells(generated.cells);
      setStep(2);

      const warnings: string[] = [];
      if (result.failedExpressions?.length) {
        const names = result.failedExpressions.map((f) => f.expression).join(", ");
        warnings.push(
          spriteType === "full-body"
            ? `Some poses failed to generate: ${names}. You can regenerate them individually.`
            : `Some expressions failed to generate: ${names}. You can regenerate them individually.`,
        );
      }
      setError(warnings.length > 0 ? warnings.join(" ") : null);
    } catch (err) {
      if (isSpritePromptReviewCancelled(err)) {
        setError(null);
        setStep(0);
        return;
      }
      setError(getGenerationErrorMessage(err));
      setStep(0);
    }
  }, [
    spriteGenerationUnavailable,
    effectiveConnectionId,
    cappedSelectedExpressions,
    sliceAdjustmentGrid,
    fullBodyExpressionMode,
    runMatchedFullBodyBatches,
    matchedFullBodyBatches,
    requestGeneratedSheet,
    generationGrid,
    spriteType,
  ]);

  const handleRetryFailedMatchedBatch = useCallback(async () => {
    if (!failedMatchedBatch || spriteGenerationUnavailable || !effectiveConnectionId) return;

    setStep(1);
    setError(null);
    setActiveFrameIndex(null);
    setFrameAdjustments(DEFAULT_SPRITE_FRAME_ADJUSTMENTS);
    setFramePreviewUrl(null);

    const retryBatches = [
      ...matchedFullBodyBatches.slice(0, failedMatchedBatch.batchIndex),
      failedMatchedBatch.expressions,
      ...failedMatchedBatch.remainingBatches,
    ];

    await runMatchedFullBodyBatches({
      batches: retryBatches,
      startIndex: failedMatchedBatch.batchIndex,
      initialCells: cells,
      initialSheets: generatedSheets,
    });
  }, [
    cells,
    effectiveConnectionId,
    failedMatchedBatch,
    generatedSheets,
    matchedFullBodyBatches,
    runMatchedFullBodyBatches,
    spriteGenerationUnavailable,
  ]);

  const handleApplyCleanup = useCallback(async () => {
    if (!noBackground || cells.length === 0) return;

    setCleanupApplying(true);
    setError(null);

    try {
      const result = await spriteApi.cleanup<{ cells: Array<{ expression: string; base64: string }> }>({
        cleanupStrength,
        engine: "auto",
        cells: cells.map((cell) => ({
          expression: cell.expression,
          base64: cell.rawDataUrl,
        })),
      });

      setCells((prev) =>
        prev.map((cell, i) => ({
          ...cell,
          dataUrl: result.cells[i]?.base64 ? `data:image/png;base64,${result.cells[i]!.base64}` : cell.dataUrl,
        })),
      );
      setCleanupApplied(true);
    } catch (err: any) {
      setError(err?.message || "Failed to apply background cleanup");
    } finally {
      setCleanupApplying(false);
    }
  }, [cells, cleanupStrength, noBackground]);

  const handleUseOriginal = useCallback(() => {
    setCells((prev) => prev.map((cell) => ({ ...cell, dataUrl: cell.rawDataUrl })));
    setCleanupApplied(false);
  }, []);

  const handleOpenCellFrame = useCallback((index: number) => {
    setActiveFrameIndex(index);
    setFrameAdjustments(DEFAULT_SPRITE_FRAME_ADJUSTMENTS);
    setError(null);
  }, []);

  const handleCloseCellFrame = useCallback(() => {
    setActiveFrameIndex(null);
    setFrameAdjustments(DEFAULT_SPRITE_FRAME_ADJUSTMENTS);
    setFramePreviewUrl(null);
    setFrameApplying(false);
  }, []);

  const handleFrameAdjustmentChange = useCallback((key: SpriteFrameAdjustmentKey, value: number) => {
    setFrameAdjustments((prev) => {
      const next = { ...prev, [key]: clampPercent(value) };

      if (key === "left" || key === "right") {
        const opposite = key === "left" ? "right" : "left";
        const overflow = next.left + next.right - SPRITE_FRAME_MAX_PAIR_CROP;
        if (overflow > 0) next[opposite] = Math.max(0, next[opposite] - overflow);
      } else {
        const opposite = key === "top" ? "bottom" : "top";
        const overflow = next.top + next.bottom - SPRITE_FRAME_MAX_PAIR_CROP;
        if (overflow > 0) next[opposite] = Math.max(0, next[opposite] - overflow);
      }

      return next;
    });
  }, []);

  const handleApplyCellFrame = useCallback(async () => {
    if (activeFrameIndex === null || !activeFrameCell) return;

    setFrameApplying(true);
    setError(null);

    try {
      const croppedRaw = await cropSpriteDataUrl(activeFrameCell.rawDataUrl, frameAdjustments);
      const croppedDisplay =
        activeFrameCell.dataUrl === activeFrameCell.rawDataUrl
          ? croppedRaw
          : await cropSpriteDataUrl(activeFrameCell.dataUrl, frameAdjustments);

      setCells((prev) =>
        prev.map((cell, index) =>
          index === activeFrameIndex
            ? {
                ...cell,
                rawDataUrl: croppedRaw,
                dataUrl: croppedDisplay,
              }
            : cell,
        ),
      );
      handleCloseCellFrame();
    } catch (err: any) {
      setError(err?.message || "Failed to frame sprite");
    } finally {
      setFrameApplying(false);
    }
  }, [activeFrameCell, activeFrameIndex, frameAdjustments, handleCloseCellFrame]);

  const handleSliceAdjustmentChange = useCallback((key: NumericSliceAdjustmentKey, value: number) => {
    setSliceAdjustments((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSliceCutChange = useCallback((axis: "colCuts" | "rowCuts", index: number, value: number) => {
    setSliceAdjustments((prev) => ({
      ...prev,
      [axis]: prev[axis].map((entry, i) => (i === index ? value : entry)),
    }));
  }, []);

  const handleResetSliceAdjustments = useCallback(() => {
    setSliceAdjustments(createDefaultSliceAdjustments(sliceAdjustmentGrid));
  }, [sliceAdjustmentGrid]);

  const handleApplySliceAdjustments = useCallback(async () => {
    if (!canAdjustSlices || singleImageMode || cells.length === 0) return;

    setSliceApplying(true);
    setError(null);

    try {
      const imageCache = new Map<string, Promise<HTMLImageElement>>();
      const loadSourceImage = (src: string) => {
        const cached = imageCache.get(src);
        if (cached) return cached;
        const promise = new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error("Generated sheet could not be loaded"));
          image.src = src;
        });
        imageCache.set(src, promise);
        return promise;
      };

      const slicedCells = await Promise.all(
        cells.map(async (cell, index) => {
          const sourceSheet = cell.sourceSheetDataUrl ?? generatedSheet;
          if (!sourceSheet) return cell;

          const image = await loadSourceImage(sourceSheet);
          const grid = cell.sourceGrid ?? generationGrid;
          const { cols, rows } = grid;
          const sourceIndex = cell.sourceCellIndex ?? index;
          const row = Math.floor(sourceIndex / cols);
          const col = sourceIndex % cols;
          const gapXPx = percentToPixels(image.naturalWidth, sliceAdjustments.gapX);
          const gapYPx = percentToPixels(image.naturalHeight, sliceAdjustments.gapY);
          const colBoundaries = buildSliceBoundaries(
            image.naturalWidth,
            cols,
            sliceAdjustments.marginX,
            sliceAdjustments.offsetX,
            sliceAdjustments.colCuts,
          );
          const rowBoundaries = buildSliceBoundaries(
            image.naturalHeight,
            rows,
            sliceAdjustments.marginY,
            sliceAdjustments.offsetY,
            sliceAdjustments.rowCuts,
          );
          const gapLeft = col > 0 ? gapXPx / 2 : 0;
          const gapRight = col < cols - 1 ? gapXPx / 2 : 0;
          const gapTop = row > 0 ? gapYPx / 2 : 0;
          const gapBottom = row < rows - 1 ? gapYPx / 2 : 0;
          let sx = Math.ceil((colBoundaries[col] ?? 0) + gapLeft);
          let ex = Math.floor((colBoundaries[col + 1] ?? image.naturalWidth) - gapRight);
          let sy = Math.ceil((rowBoundaries[row] ?? 0) + gapTop);
          let ey = Math.floor((rowBoundaries[row + 1] ?? image.naturalHeight) - gapBottom);

          const cellWidth = ex - sx;
          const cellHeight = ey - sy;
          if (cellWidth <= 0 || cellHeight <= 0) {
            throw new Error("Slice settings leave no usable cell area");
          }

          sx += percentToPixels(cellWidth, sliceAdjustments.cropLeft);
          ex -= percentToPixels(cellWidth, sliceAdjustments.cropRight);
          sy += percentToPixels(cellHeight, sliceAdjustments.cropTop);
          ey -= percentToPixels(cellHeight, sliceAdjustments.cropBottom);
          sx = Math.max(0, Math.min(image.naturalWidth, sx));
          ex = Math.max(0, Math.min(image.naturalWidth, ex));
          sy = Math.max(0, Math.min(image.naturalHeight, sy));
          ey = Math.max(0, Math.min(image.naturalHeight, ey));

          const outputWidth = ex - sx;
          const outputHeight = ey - sy;
          if (outputWidth <= 0 || outputHeight <= 0) {
            throw new Error("Slice settings leave no usable cell area");
          }

          const canvas = document.createElement("canvas");
          canvas.width = outputWidth;
          canvas.height = outputHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas is unavailable");
          ctx.drawImage(image, sx, sy, outputWidth, outputHeight, 0, 0, outputWidth, outputHeight);
          const dataUrl = canvas.toDataURL("image/png");

          return {
            ...cell,
            rawDataUrl: dataUrl,
            dataUrl,
          };
        }),
      );

      setCells(slicedCells);
      setCleanupApplied(false);
      setActiveFrameIndex(null);
      setFrameAdjustments(DEFAULT_SPRITE_FRAME_ADJUSTMENTS);
      setFramePreviewUrl(null);
    } catch (err: any) {
      setError(err?.message || "Failed to adjust sprite slices");
    } finally {
      setSliceApplying(false);
    }
  }, [canAdjustSlices, cells, generatedSheet, generationGrid, singleImageMode, sliceAdjustments]);

  const handleCellToggle = useCallback((idx: number) => {
    setCells((prev) => prev.map((c, i) => (i === idx ? { ...c, selected: !c.selected } : c)));
  }, []);

  const handleCellRename = useCallback((idx: number, name: string) => {
    setCells((prev) =>
      prev.map((c, i) =>
        i === idx
          ? {
              ...c,
              expression: name
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9_-]/g, "_"),
            }
          : c,
      ),
    );
  }, []);

  const handleSave = useCallback(async () => {
    const toSave = cells.filter((c) => c.selected && c.expression);
    if (toSave.length === 0) return;

    setSaving(true);
    setError(null);

    try {
      for (const cell of toSave) {
        const cleaned = cell.expression
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, "_");
        const expression =
          spriteType === "full-body"
            ? cleaned.startsWith("full_")
              ? cleaned
              : `full_${cleaned}`
            : cleaned.replace(/^full_/, "");
        await spriteApi.upload(
          entityId,
          {
            expression,
            image: cell.dataUrl,
          },
          { ownerType: entityKind },
        );
      }
      onSpritesGenerated?.();
      onClose();
      // Reset for next use
      setStep(0);
      setGeneratedSheet(null);
      setGeneratedSheets([]);
      setCells([]);
      setFailedMatchedBatch(null);
      setGenerationProgress(null);
      handleCloseCellFrame();
    } catch (err: any) {
      setError(err?.message || "Failed to save sprites");
    } finally {
      setSaving(false);
    }
  }, [cells, entityId, entityKind, handleCloseCellFrame, onSpritesGenerated, onClose, spriteType]);

  const handleReset = useCallback(() => {
    setStep(0);
    setGeneratedSheet(null);
    setGeneratedSheets([]);
    setCells([]);
    setFailedMatchedBatch(null);
    setGenerationProgress(null);
    handleCloseCellFrame();
    setCleanupApplied(false);
    setCleanupApplying(false);
    setSliceAdjustments(DEFAULT_SLICE_ADJUSTMENTS);
    setSliceApplying(false);
    setError(null);
  }, [handleCloseCellFrame]);

  const selectedCount = cells.filter((c) => c.selected).length;

  // ── Render ──

  return (
    <>
      <Modal open={open} onClose={onClose} title="Generate Sprites" width="max-w-2xl">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleReferenceUpload} />

        {/* Step 0: Configuration */}
        {step === 0 && (
          <div className="space-y-4">
            {/* Sprite Type Tabs */}
            <div className="flex gap-2">
              <button
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ring-1",
                  spriteType === "expressions"
                    ? "bg-[var(--primary)]/15 text-[var(--primary)] ring-[var(--primary)]/40"
                    : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-[var(--border)] hover:ring-[var(--primary)]/20",
                )}
                onClick={() => {
                  setSpriteType("expressions");
                  setMatchExistingExpressions(false);
                  setSelectedExpressions([...EXPRESSION_PRESETS[preset].expressions]);
                }}
              >
                Expressions (Portrait)
              </button>
              <button
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ring-1",
                  spriteType === "full-body"
                    ? "bg-[var(--primary)]/15 text-[var(--primary)] ring-[var(--primary)]/40"
                    : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-[var(--border)] hover:ring-[var(--primary)]/20",
                )}
                onClick={() => {
                  setSpriteType("full-body");
                  setSelectedExpressions([...FULL_BODY_POSE_PRESETS[preset]]);
                }}
              >
                Full-body
              </button>
            </div>
            {error && (
              <div className="rounded-lg bg-[var(--destructive)]/10 px-3 py-2 text-xs text-[var(--destructive)]">
                {error}
              </div>
            )}
            {spriteGenerationUnavailable && (
              <div className="rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
                {spriteGenerationReason}
              </div>
            )}

            {/* Image Generation Connection */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                Image Generation Connection
              </label>
              {imageConnections.length === 0 ? (
                <p className="text-xs text-[var(--destructive)]">
                  No image generation connections found. Add one in Settings → Connections with the &quot;Image
                  Generation&quot; provider type.
                </p>
              ) : (
                <select
                  value={effectiveConnectionId ?? ""}
                  onChange={(e) => setConnectionId(e.target.value || null)}
                  className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--foreground)] outline-none ring-1 ring-transparent transition-all focus:ring-[var(--primary)]/40"
                >
                  {imageConnections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.model ? ` — ${c.model}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Reference Image */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                Reference Images <span className="text-[var(--muted-foreground)]">(optional, up to 4)</span>
              </label>
              {hasCurrentAvatarReference && (
                <label className="mb-2 flex items-center gap-3 rounded-lg bg-[var(--secondary)]/60 p-2.5 text-xs text-[var(--foreground)] ring-1 ring-[var(--border)]/60">
                  <input
                    type="checkbox"
                    checked={useCurrentAvatarReference}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setUseCurrentAvatarReference(enabled);
                      if (enabled) {
                        setReferenceImages((prev) => prev.slice(0, 3));
                      }
                    }}
                    className="accent-[var(--primary)]"
                  />
                  <img
                    src={defaultAvatarUrl ?? ""}
                    alt="Current avatar reference"
                    className="h-12 w-12 rounded-lg object-cover ring-1 ring-[var(--border)]"
                  />
                  <span className="flex-1">Use current avatar as a reference image</span>
                </label>
              )}
              <div className="flex items-start gap-3">
                <div className="flex flex-wrap gap-2">
                  {useCurrentAvatarReference && defaultAvatarUrl && (
                    <div className="relative">
                      <img
                        src={defaultAvatarUrl}
                        alt="Current avatar reference"
                        className="h-20 w-20 rounded-lg object-cover ring-2 ring-[var(--primary)]/40"
                      />
                      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[0.5625rem] text-white">
                        Avatar
                      </span>
                    </div>
                  )}
                  {referenceImages.map((img, idx) => (
                    <div key={idx} className="group relative">
                      <img
                        src={img}
                        alt={`Reference ${idx + 1}`}
                        className="h-20 w-20 rounded-lg object-cover ring-1 ring-[var(--border)]"
                      />
                      <button
                        onClick={() => removeReferenceImage(idx)}
                        className="absolute -right-1.5 -top-1.5 rounded-full bg-[var(--destructive)] p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  {referenceImages.length < maxUploadedReferenceImages && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-[var(--border)] text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                    >
                      <ImagePlus size={18} />
                      <span className="text-[0.5625rem]">Upload</span>
                    </button>
                  )}
                </div>
                <p className="flex-1 text-[0.625rem] text-[var(--muted-foreground)]">
                  Upload reference images of the character to improve consistency. Multiple angles or the existing
                  avatar work well.
                </p>
              </div>
            </div>

            {/* Appearance Description */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                Appearance Description
              </label>
              <textarea
                value={appearance}
                onChange={(e) => setAppearance(e.target.value)}
                placeholder="blue eyes, blonde hair, anime style, wearing a hoodie, female, chubby..."
                rows={3}
                className="w-full resize-none rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--foreground)] outline-none ring-1 ring-transparent transition-all placeholder:text-[var(--muted-foreground)] focus:ring-[var(--primary)]/40"
              />
            </div>

            <label className="flex items-start gap-3 rounded-lg bg-[var(--secondary)]/60 p-2.5 text-xs text-[var(--foreground)] ring-1 ring-[var(--border)]/60">
              <input
                type="checkbox"
                checked={nativeTransparentPng}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setNativeTransparentPng(enabled);
                  if (enabled) setNoBackground(true);
                }}
                className="mt-0.5 accent-[var(--primary)]"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Prefer transparent PNG</span>
                <span className="mt-0.5 block text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                  Uses native transparent output when the selected model supports it, removes white-background wording
                  from the prompt, then applies cleanup when transparent preview is enabled.
                </span>
                {selectedModelIsGptImage2 && nativeTransparentPng && (
                  <span className="mt-1 block text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                    GPT-Image-2 does not support native transparent backgrounds right now, so cleanup is the fallback.
                  </span>
                )}
              </span>
            </label>

            {/* Preset and Expression Selection (Expressions mode) */}
            {spriteType === "expressions" && (
              <>
                {/* Expression Preset */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">Expression Count</label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(EXPRESSION_PRESETS) as PresetKey[]).map((key) => (
                      <button
                        key={key}
                        onClick={() => handlePresetChange(key)}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-xs transition-colors ring-1",
                          preset === key
                            ? "bg-[var(--primary)]/15 text-[var(--primary)] ring-[var(--primary)]/40"
                            : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-[var(--border)] hover:ring-[var(--primary)]/20",
                        )}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Expression Selection */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                    Expressions ({selectedExpressions.length} selected)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_EXPRESSIONS.map((expr) => (
                      <button
                        key={expr}
                        onClick={() => toggleExpression(expr)}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[0.6875rem] capitalize transition-colors",
                          selectedExpressions.includes(expr)
                            ? "bg-[var(--primary)]/20 text-[var(--primary)] ring-1 ring-[var(--primary)]/40"
                            : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                        )}
                      >
                        {expr}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                    {singleImageMode
                      ? "Generate one portrait sprite. Pick the expression you want to render."
                      : `Select exactly ${selectedTargetCount} expressions for a ${EXPRESSION_PRESETS[preset].cols}×${EXPRESSION_PRESETS[preset].rows} grid. Extra or fewer expressions will be adjusted.`}
                  </p>
                </div>
              </>
            )}

            {/* Full-body options */}
            {spriteType === "full-body" && (
              <>
                {existingPortraitExpressions.length > 0 && (
                  <label className="flex items-start gap-3 rounded-lg bg-[var(--secondary)]/60 p-2.5 text-xs text-[var(--foreground)] ring-1 ring-[var(--border)]/60">
                    <input
                      type="checkbox"
                      checked={matchExistingExpressions}
                      onChange={(e) => setMatchExistingExpressions(e.target.checked)}
                      className="mt-0.5 accent-[var(--primary)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">Match existing expression sprites</span>
                      <span className="mt-0.5 block text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                        Generates idle full-body sprites named after the portrait expressions, saved as full_neutral,
                        full_happy, and so on.
                      </span>
                    </span>
                  </label>
                )}

                {fullBodyExpressionMode && (
                  <div className="rounded-lg bg-[var(--secondary)]/60 p-2.5 ring-1 ring-[var(--border)]/60">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[var(--foreground)]">
                        Matched expressions ({matchedFullBodyExpressions.length})
                      </span>
                      <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                        {matchedFullBodyBatches.length} batch{matchedFullBodyBatches.length === 1 ? "" : "es"} of up to{" "}
                        {MATCHED_FULL_BODY_BATCH_SIZE}
                      </span>
                      {existingPortraitExpressions.length > matchedFullBodyExpressions.length && (
                        <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                          First {MATCHED_FULL_BODY_EXPRESSION_LIMIT} used
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {matchedFullBodyExpressions.map((expr) => (
                        <span
                          key={expr}
                          className="rounded-full bg-[var(--primary)]/15 px-2.5 py-1 text-[0.6875rem] text-[var(--primary)] ring-1 ring-[var(--primary)]/30"
                        >
                          {expr.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                      Each batch generates a 2×2 idle full-body sheet for higher per-sprite resolution and cleaner
                      slicing. Only the face and mood should change to match the expression name.
                    </p>
                  </div>
                )}

                {!fullBodyExpressionMode && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">Pose Count</label>
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(EXPRESSION_PRESETS) as PresetKey[]).map((key) => (
                          <button
                            key={key}
                            onClick={() => handlePresetChange(key)}
                            className={cn(
                              "rounded-lg px-3 py-1.5 text-xs transition-colors ring-1",
                              preset === key
                                ? "bg-[var(--primary)]/15 text-[var(--primary)] ring-[var(--primary)]/40"
                                : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-[var(--border)] hover:ring-[var(--primary)]/20",
                            )}
                          >
                            {key}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[var(--foreground)]">
                        Poses ({selectedExpressions.length} selected)
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {ALL_FULL_BODY_POSES.map((pose) => (
                          <button
                            key={pose}
                            onClick={() => toggleExpression(pose)}
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[0.6875rem] capitalize transition-colors",
                              selectedExpressions.includes(pose)
                                ? "bg-[var(--primary)]/20 text-[var(--primary)] ring-1 ring-[var(--primary)]/40"
                                : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                            )}
                          >
                            {pose.replace(/_/g, " ")}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                        {singleImageMode
                          ? "Generate one full-body pose image. Pick the pose you want to render."
                          : `Select exactly ${selectedTargetCount} general poses for a ${EXPRESSION_PRESETS[preset].cols}×${EXPRESSION_PRESETS[preset].rows} full-body sheet.`}
                      </p>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Generate Button */}
            <div className="flex items-center justify-between border-t border-[var(--border)]/30 pt-4">
              <button
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] hover:bg-[var(--secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={
                  spriteGenerationUnavailable ||
                  !effectiveConnectionId ||
                  cappedSelectedExpressions.length === 0 ||
                  !appearance.trim()
                }
                title={spriteGenerationUnavailable ? spriteGenerationReason : undefined}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              >
                <Sparkles size={14} />
                {fullBodyExpressionMode
                  ? "Generate Matched Batches"
                  : spriteType === "full-body"
                    ? singleImageMode
                      ? "Generate Pose"
                      : "Generate Pose Sheet"
                    : singleImageMode
                      ? "Generate Sprite"
                      : "Generate Sheet"}
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Generating */}
        {step === 1 && (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 size={32} className="animate-spin text-[var(--primary)]" />
            <div className="text-center">
              <p className="text-sm font-medium">
                {fullBodyExpressionMode
                  ? "Generating matched full-body batches..."
                  : spriteType === "full-body"
                    ? singleImageMode
                      ? "Generating full-body pose…"
                      : "Generating full-body pose sheet…"
                    : singleImageMode
                      ? "Generating portrait sprite…"
                      : "Generating expression sheet…"}
              </p>
              {generationProgress && <p className="mt-1 text-xs text-[var(--primary)]">{generationProgress}</p>}
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {fullBodyExpressionMode
                  ? "Each 2×2 batch gets one automatic retry before pausing for your decision."
                  : spriteType === "full-body"
                    ? singleImageMode
                      ? "This may take 30–60 seconds depending on the provider."
                      : "This may take 30–60 seconds depending on the provider. The sheet will be sliced into poses after generation."
                    : "This may take 30–60 seconds depending on the provider."}
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Preview & Label */}
        {step === 2 && (
          <div className="space-y-4">
            {error && (
              <div className="rounded-lg bg-[var(--destructive)]/10 px-3 py-2 text-xs text-[var(--destructive)]">
                {error}
              </div>
            )}
            {failedMatchedBatch && (
              <div className="rounded-lg bg-[var(--secondary)]/60 p-3 ring-1 ring-[var(--border)]/70">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[var(--foreground)]">
                      Batch {failedMatchedBatch.batchIndex + 1} of {failedMatchedBatch.totalBatches} paused
                    </p>
                    <p className="mt-1 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                      {failedMatchedBatch.expressions.map((expr) => expr.replace(/_/g, " ")).join(", ")}
                    </p>
                    <p className="mt-1 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                      The batch already retried once automatically. Retry it here when the provider is ready; successful
                      batches above are preserved.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRetryFailedMatchedBatch}
                    disabled={spriteGenerationUnavailable || !effectiveConnectionId}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                  >
                    <RotateCcw size={13} />
                    Retry Batch
                  </button>
                </div>
              </div>
            )}

            {/* Full sheet preview (collapsed) */}
            {generatedSheets.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                  {generatedSheets.length > 1
                    ? `View ${generatedSheets.length} generated batch sheets`
                    : singleImageMode
                      ? "View generated source image"
                      : "View full generated sheet"}
                </summary>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {generatedSheets.map((sheet) => (
                    <figure key={sheet.id} className="space-y-1">
                      <img
                        src={sheet.dataUrl}
                        alt={sheet.label}
                        className="w-full rounded-lg ring-1 ring-[var(--border)]"
                      />
                      <figcaption className="text-[0.625rem] text-[var(--muted-foreground)]">
                        {sheet.label} · {sheet.grid.cols}×{sheet.grid.rows}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </details>
            )}

            {canAdjustSlices && !singleImageMode && (
              <div className="rounded-lg bg-[var(--secondary)]/60 p-2.5 ring-1 ring-[var(--border)]/60">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-medium text-[var(--foreground)]">Adjust Slice</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleResetSliceAdjustments}
                      disabled={sliceApplying}
                      className="rounded-lg px-2.5 py-1 text-[0.6875rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:text-[var(--foreground)] disabled:opacity-50"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={handleApplySliceAdjustments}
                      disabled={sliceApplying}
                      className="rounded-lg bg-[var(--primary)] px-2.5 py-1 text-[0.6875rem] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                    >
                      {sliceApplying ? "Applying..." : "Apply Slice"}
                    </button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SLICE_GRID_CONTROLS.map(({ key, label, min, max, step }) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-[0.6875rem] text-[var(--muted-foreground)]"
                    >
                      <span className="w-28 shrink-0 text-[var(--foreground)]">{label}</span>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={sliceAdjustments[key]}
                        onChange={(e) => handleSliceAdjustmentChange(key, Number(e.target.value))}
                        className="min-w-0 flex-1 accent-[var(--primary)]"
                      />
                      <span className="w-12 text-right tabular-nums">{sliceAdjustments[key].toFixed(1)}%</span>
                    </label>
                  ))}
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {SLICE_EDGE_CONTROLS.map(({ key, label, min, max, step }) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-[0.6875rem] text-[var(--muted-foreground)]"
                    >
                      <span className="w-28 shrink-0 text-[var(--foreground)]">{label}</span>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={sliceAdjustments[key]}
                        onChange={(e) => handleSliceAdjustmentChange(key, Number(e.target.value))}
                        className="min-w-0 flex-1 accent-[var(--primary)]"
                      />
                      <span className="w-12 text-right tabular-nums">{sliceAdjustments[key].toFixed(1)}%</span>
                    </label>
                  ))}
                </div>
                {(sliceAdjustments.rowCuts.length > 0 || sliceAdjustments.colCuts.length > 0) && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {sliceAdjustments.rowCuts.map((value, index) => (
                      <label
                        key={`row-cut-${index}`}
                        className="flex items-center gap-2 text-[0.6875rem] text-[var(--muted-foreground)]"
                      >
                        <span className="w-28 shrink-0 text-[var(--foreground)]">Row cut {index + 1}</span>
                        <input
                          type="range"
                          min={-12}
                          max={12}
                          step={0.1}
                          value={value}
                          onChange={(e) => handleSliceCutChange("rowCuts", index, Number(e.target.value))}
                          className="min-w-0 flex-1 accent-[var(--primary)]"
                        />
                        <span className="w-12 text-right tabular-nums">{value.toFixed(1)}%</span>
                      </label>
                    ))}
                    {sliceAdjustments.colCuts.map((value, index) => (
                      <label
                        key={`col-cut-${index}`}
                        className="flex items-center gap-2 text-[0.6875rem] text-[var(--muted-foreground)]"
                      >
                        <span className="w-28 shrink-0 text-[var(--foreground)]">Column cut {index + 1}</span>
                        <input
                          type="range"
                          min={-12}
                          max={12}
                          step={0.1}
                          value={value}
                          onChange={(e) => handleSliceCutChange("colCuts", index, Number(e.target.value))}
                          className="min-w-0 flex-1 accent-[var(--primary)]"
                        />
                        <span className="w-12 text-right tabular-nums">{value.toFixed(1)}%</span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[0.625rem] text-[var(--muted-foreground)]">
                  Use this when the generated sheet has borders, gutters, or uneven spacing. Applying re-slices the
                  original source sheet{generatedSheets.length === 1 ? "" : "s"} without regenerating.
                </p>
              </div>
            )}

            {/* Cell grid */}
            <div>
              <div className="mb-3 rounded-lg bg-[var(--secondary)]/60 p-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-[var(--foreground)]">
                    <input
                      type="checkbox"
                      checked={noBackground}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setNoBackground(enabled);
                        if (!enabled) {
                          handleUseOriginal();
                        }
                      }}
                      className="accent-[var(--primary)]"
                    />
                    Transparent background
                  </label>
                  {noBackground && (
                    <>
                      <div className="flex min-w-52 flex-1 items-center gap-2">
                        <span className="text-[0.6875rem] text-[var(--muted-foreground)]">Soft</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={cleanupStrength}
                          onChange={(e) => setCleanupStrength(Number(e.target.value))}
                          className="w-full accent-[var(--primary)]"
                        />
                        <span className="text-[0.6875rem] text-[var(--muted-foreground)]">Aggressive</span>
                      </div>
                      <span className="text-[0.6875rem] text-[var(--muted-foreground)]">{cleanupStrength}</span>
                      <button
                        onClick={handleApplyCleanup}
                        disabled={cleanupApplying || cleanupEngineUnavailable || cells.length === 0}
                        className="rounded-lg bg-[var(--primary)] px-2.5 py-1 text-[0.6875rem] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                        title={cleanupEngineUnavailable ? cleanupEngineReason : "Run background cleanup"}
                      >
                        {cleanupApplying ? "Applying..." : cleanupApplied ? "Reapply Cleanup" : "Apply Cleanup"}
                      </button>
                      {cleanupApplied && (
                        <button
                          onClick={handleUseOriginal}
                          disabled={cleanupApplying}
                          className="rounded-lg px-2.5 py-1 text-[0.6875rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:text-[var(--foreground)]"
                        >
                          Use Original
                        </button>
                      )}
                    </>
                  )}
                </div>
                <p className="mt-1 text-[0.625rem] text-[var(--muted-foreground)]">
                  Cleanup only runs when you press Apply Cleanup, using the current slices without regenerating.
                </p>
                {cleanupEngineUnavailable && noBackground && (
                  <p className="mt-1 text-[0.625rem] text-amber-300/80">{cleanupEngineReason}</p>
                )}
              </div>
              {activeFrameCell && (
                <div className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/50 p-3">
                  <div className="flex items-start gap-3 max-sm:flex-col">
                    <div className="aspect-square w-32 shrink-0 overflow-hidden rounded-lg bg-[var(--background)] ring-1 ring-[var(--border)] max-sm:w-full">
                      <img
                        src={framePreviewUrl ?? activeFrameCell.dataUrl}
                        alt={activeFrameCell.expression}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-[var(--foreground)]">
                          <Crop size={14} className="shrink-0 text-[var(--primary)]" />
                          <span className="truncate capitalize">Frame {activeFrameCell.expression}</span>
                        </span>
                        <button
                          type="button"
                          onClick={handleCloseCellFrame}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                          aria-label="Close frame editor"
                          title="Close"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {SPRITE_FRAME_CONTROLS.map(({ key, label }) => (
                          <label key={key} className="flex items-center gap-2 text-[0.6875rem]">
                            <span className="w-12 shrink-0 text-[var(--foreground)]">{label}</span>
                            <input
                              type="range"
                              min={0}
                              max={80}
                              step={0.5}
                              value={frameAdjustments[key]}
                              onChange={(e) => handleFrameAdjustmentChange(key, Number(e.target.value))}
                              className="min-w-0 flex-1 accent-[var(--primary)]"
                            />
                            <span className="w-12 text-right tabular-nums text-[var(--muted-foreground)]">
                              {frameAdjustments[key].toFixed(1)}%
                            </span>
                          </label>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setFrameAdjustments(DEFAULT_SPRITE_FRAME_ADJUSTMENTS)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[0.6875rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:text-[var(--foreground)]"
                        >
                          <RotateCcw size={12} />
                          Reset
                        </button>
                        <button
                          type="button"
                          onClick={handleApplyCellFrame}
                          disabled={frameApplying}
                          className="inline-flex items-center gap-1 rounded-lg bg-[var(--primary)] px-2.5 py-1 text-[0.6875rem] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                        >
                          {frameApplying ? <Loader2 size={12} className="animate-spin" /> : <Crop size={12} />}
                          Apply Frame
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <label className="mb-2 block text-xs font-medium text-[var(--foreground)]">
                Review & Label{" "}
                {fullBodyExpressionMode ? "Full-body Expressions" : spriteType === "full-body" ? "Poses" : "Sprites"} (
                {selectedCount} selected)
              </label>
              <p className="mb-3 text-[0.625rem] text-[var(--muted-foreground)]">
                Click an item to toggle selection. Edit names as needed. Only selected items will be saved.
              </p>
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${previewColumnCount}, 1fr)`,
                }}
              >
                {cells.map((cell, i) => (
                  <div
                    key={i}
                    className={cn(
                      "group relative overflow-hidden rounded-xl border-2 transition-all",
                      cell.selected ? "border-[var(--primary)] shadow-md" : "border-[var(--border)] opacity-50",
                    )}
                  >
                    {/* Image */}
                    <button onClick={() => handleCellToggle(i)} className="block w-full">
                      <div className="aspect-square bg-[var(--secondary)]">
                        <img src={cell.dataUrl} alt={cell.expression} className="h-full w-full object-contain" />
                      </div>
                    </button>

                    {/* Selected indicator */}
                    <div
                      className={cn(
                        "absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full transition-colors",
                        cell.selected ? "bg-[var(--primary)] text-white" : "bg-black/40 text-white/60",
                      )}
                    >
                      {cell.selected ? <Check size={12} /> : <X size={12} />}
                    </div>

                    {/* Expression label */}
                    <div className="p-1.5">
                      <input
                        value={cell.expression}
                        onChange={(e) => handleCellRename(i, e.target.value)}
                        className="w-full rounded bg-[var(--secondary)] px-2 py-1 text-center text-[0.6875rem] capitalize text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--primary)]/40"
                      />
                      <div className="mt-1 flex justify-center">
                        <button
                          type="button"
                          onClick={() => handleOpenCellFrame(i)}
                          className={cn(
                            "inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                            activeFrameIndex === i &&
                              "bg-[var(--primary)] text-white ring-[var(--primary)] hover:bg-[var(--primary)] hover:text-white",
                          )}
                          aria-label={`Frame ${cell.expression}`}
                          title="Frame sprite"
                        >
                          <Crop size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between border-t border-[var(--border)]/30 pt-4">
              <button
                onClick={handleReset}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] hover:bg-[var(--secondary)]"
              >
                <ArrowLeft size={14} />
                Regenerate
              </button>
              <button
                onClick={handleSave}
                disabled={saving || selectedCount === 0}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    Save {selectedCount} Sprites
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
      <ImagePromptReviewModal
        open={promptReviewItems.length > 0}
        items={promptReviewItems}
        isSubmitting={promptReviewSubmitting}
        onCancel={() => closePromptReview(null)}
        onConfirm={(overrides) => closePromptReview(overrides)}
      />
    </>
  );
}
