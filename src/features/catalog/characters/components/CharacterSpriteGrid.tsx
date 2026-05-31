import { Crop, Image, ImageDown, Upload, Wand2, Trash2 } from "lucide-react";

import type { SpriteInfo } from "../../sprites/index";
import type { SpriteCategory } from "../lib/character-sprites-model";

export function CharacterSpriteGrid({
  category,
  isLoading,
  visibleSprites,
  displayExpression,
  onOpenWandCleanup,
  onFrame,
  onDownload,
  onReplace,
  onDelete,
}: {
  category: SpriteCategory;
  isLoading: boolean;
  visibleSprites: SpriteInfo[];
  displayExpression: (stored: string) => string;
  onOpenWandCleanup: (sprite: SpriteInfo) => void;
  onFrame: (sprite: SpriteInfo) => void;
  onDownload: (sprite: SpriteInfo) => void;
  onReplace: (expression: string) => void;
  onDelete: (sprite: SpriteInfo) => void;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="shimmer aspect-[3/4] rounded-xl" />
        ))}
      </div>
    );
  }

  if (!visibleSprites.length) {
    return (
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
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {visibleSprites.map((sprite) => (
        <div
          key={sprite.expression}
          className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] transition-all hover:border-[var(--primary)]/30 hover:shadow-md"
        >
          <button
            type="button"
            onClick={() => onOpenWandCleanup(sprite)}
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
                onClick={() => onFrame(sprite)}
                className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                title="Frame"
              >
                <Crop size="0.6875rem" />
              </button>
              <button
                type="button"
                onClick={() => onDownload(sprite)}
                className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                title="Download"
              >
                <ImageDown size="0.6875rem" />
              </button>
              <button
                type="button"
                onClick={() => onReplace(sprite.expression)}
                className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                title="Replace"
              >
                <Upload size="0.6875rem" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(sprite)}
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
  );
}
