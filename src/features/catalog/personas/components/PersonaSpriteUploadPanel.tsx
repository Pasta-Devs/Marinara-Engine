import { Eraser, FolderOpen, ImageDown, Loader2, Plus, RotateCcw, Upload, Wand2 } from "lucide-react";

import type { PersonaSpriteCategory } from "../lib/persona-sprites-model";

interface PersonaSpriteUploadPanelProps {
  category: PersonaSpriteCategory;
  newExpression: string;
  suggestedExpressions: string[];
  allSpritesCount: number;
  visibleSpritesCount: number;
  uploading: boolean;
  exporting: boolean;
  exportMenuOpen: boolean;
  cleaningSprites: boolean;
  savedCleanupStrength: number;
  folderProgress: { done: number; total: number } | null;
  lastCleanupRestorePointId: string | null;
  restoringCleanup: boolean;
  spriteGenerationUnavailable: boolean;
  spriteGenerationReason: string;
  backgroundCleanupUnavailable: boolean;
  backgroundCleanupReason: string;
  cleanupEngineUnavailable: boolean;
  cleanupEngineReason: string;
  onOpenGeneration: () => void;
  onOpenFolderUpload: () => void;
  onCleanVisibleSprites: () => void;
  onToggleExportMenu: () => void;
  onExportVisible: () => void;
  onExportAll: () => void;
  onCleanupStrengthChange: (value: number) => void;
  onRestoreLastCleanup: () => void;
  onNewExpressionChange: (value: string) => void;
  onStartUpload: (expression: string) => void;
}

export function PersonaSpriteUploadPanel({
  category,
  newExpression,
  suggestedExpressions,
  allSpritesCount,
  visibleSpritesCount,
  uploading,
  exporting,
  exportMenuOpen,
  cleaningSprites,
  savedCleanupStrength,
  folderProgress,
  lastCleanupRestorePointId,
  restoringCleanup,
  spriteGenerationUnavailable,
  spriteGenerationReason,
  backgroundCleanupUnavailable,
  backgroundCleanupReason,
  cleanupEngineUnavailable,
  cleanupEngineReason,
  onOpenGeneration,
  onOpenFolderUpload,
  onCleanVisibleSprites,
  onToggleExportMenu,
  onExportVisible,
  onExportAll,
  onCleanupStrengthChange,
  onRestoreLastCleanup,
  onNewExpressionChange,
  onStartUpload,
}: PersonaSpriteUploadPanelProps) {
  const cleanupStrengthId = `persona-sprite-cleanup-strength-${category}`;
  const expressionInputId = `persona-sprite-expression-${category}`;
  const expressionLabel = category === "full-body" ? "Pose name" : "Expression name";

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold">
          <Upload size="0.8125rem" className="text-[var(--primary)]" />
          Add Sprite
        </h4>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <button
            type="button"
            onClick={onOpenGeneration}
            disabled={spriteGenerationUnavailable}
            className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg bg-purple-500/10 px-3 py-1.5 text-center text-[0.6875rem] font-medium leading-tight text-purple-400 ring-1 ring-purple-500/20 transition-all hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-40 max-md:flex-1 max-md:basis-[calc(50%-0.25rem)] max-md:px-2.5"
            title={spriteGenerationUnavailable ? spriteGenerationReason : "Generate sprites using AI image generation"}
          >
            <Wand2 size="0.8125rem" />
            Generate Sprite
          </button>
          <button
            type="button"
            onClick={onOpenFolderUpload}
            disabled={!!folderProgress}
            className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-center text-[0.6875rem] font-medium leading-tight text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40 max-md:flex-1 max-md:basis-[calc(50%-0.25rem)] max-md:px-2.5"
            title="Select a folder of PNGs"
          >
            <FolderOpen size="0.8125rem" />
            Upload Folder
          </button>
          <button
            type="button"
            onClick={onCleanVisibleSprites}
            disabled={
              cleaningSprites || backgroundCleanupUnavailable || cleanupEngineUnavailable || visibleSpritesCount === 0
            }
            className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-1.5 text-center text-[0.6875rem] font-medium leading-tight text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40 max-md:flex-1 max-md:basis-[calc(50%-0.25rem)] max-md:px-2.5"
            title={
              backgroundCleanupUnavailable
                ? backgroundCleanupReason
                : cleanupEngineUnavailable
                  ? cleanupEngineReason
                  : "Run background cleanup on the currently visible saved sprites"
            }
          >
            {cleaningSprites ? <Loader2 size="0.8125rem" className="animate-spin" /> : <Eraser size="0.8125rem" />}
            {cleaningSprites ? "Cleaning..." : "Clean Backgrounds"}
          </button>
          <div className="relative max-md:flex-1 max-md:basis-[calc(50%-0.25rem)]">
            <button
              type="button"
              onClick={onToggleExportMenu}
              disabled={exporting || allSpritesCount === 0}
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
                  onClick={onExportVisible}
                  disabled={visibleSpritesCount === 0}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[var(--foreground)] transition-colors hover:bg-[var(--secondary)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ImageDown size="0.75rem" />
                  {category === "full-body" ? "Full-body only" : "Expressions only"}
                </button>
                <button
                  type="button"
                  onClick={onExportAll}
                  disabled={allSpritesCount === 0}
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
        <label htmlFor={cleanupStrengthId} className="text-[0.6875rem] font-medium text-[var(--foreground)]">
          Cleanup strength
        </label>
        <span className="text-[0.625rem] text-[var(--muted-foreground)]">Soft</span>
        <input
          id={cleanupStrengthId}
          type="range"
          min={0}
          max={100}
          step={1}
          value={savedCleanupStrength}
          onChange={(event) => onCleanupStrengthChange(Number(event.target.value))}
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
          Cleaning saved sprites…
        </div>
      )}
      {lastCleanupRestorePointId && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
          <span>Last cleanup has a restore point.</span>
          <button
            type="button"
            onClick={onRestoreLastCleanup}
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
      {cleanupEngineUnavailable && !backgroundCleanupUnavailable && (
        <div className="rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
          {cleanupEngineReason}
        </div>
      )}
      <div className="flex gap-2">
        <label htmlFor={expressionInputId} className="sr-only">
          {expressionLabel}
        </label>
        <input
          id={expressionInputId}
          value={newExpression}
          onChange={(event) => onNewExpressionChange(event.target.value)}
          placeholder={
            category === "full-body"
              ? "Pose name (e.g. idle, walk, battle_stance)…"
              : "Expression name (e.g. happy, sad, angry)…"
          }
          className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
          onKeyDown={(event) => {
            if (event.key === "Enter" && newExpression.trim()) {
              onStartUpload(newExpression);
            }
          }}
        />
        <button
          type="button"
          onClick={() => newExpression.trim() && onStartUpload(newExpression)}
          disabled={!newExpression.trim() || uploading}
          className="flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] shadow-sm transition-all hover:shadow-md disabled:opacity-40"
        >
          <Plus size="0.8125rem" />
          Upload
        </button>
      </div>

      {category === "expressions" && suggestedExpressions.length > 0 && (
        <div>
          <p className="mb-1.5 text-[0.625rem] text-[var(--muted-foreground)]">Quick add:</p>
          <div className="flex flex-wrap gap-1">
            {suggestedExpressions.slice(0, 12).map((expression) => (
              <button
                type="button"
                key={expression}
                onClick={() => onStartUpload(expression)}
                className="rounded-lg bg-[var(--secondary)] px-2.5 py-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              >
                {expression}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
