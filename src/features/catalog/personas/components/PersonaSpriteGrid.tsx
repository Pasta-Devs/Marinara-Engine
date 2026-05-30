import { Crop, Image, ImageDown, Trash2, Upload, Wand2 } from "lucide-react";

import type { SpriteInfo } from "../../sprites/index";
import type { PersonaSpriteCategory } from "../lib/persona-sprites-model";

interface PersonaSpriteGridProps {
  category: PersonaSpriteCategory;
  isLoading: boolean;
  visibleSprites: SpriteInfo[];
  displayExpression: (expression: string) => string;
  onOpenWandCleanup: (sprite: SpriteInfo) => void;
  onOpenFrame: (sprite: SpriteInfo) => void;
  onDownload: (sprite: SpriteInfo) => void;
  onReplace: (sprite: SpriteInfo) => void;
  onDelete: (sprite: SpriteInfo) => void;
}

export function PersonaSpriteGrid({
  category,
  isLoading,
  visibleSprites,
  displayExpression,
  onOpenWandCleanup,
  onOpenFrame,
  onDownload,
  onReplace,
  onDelete,
}: PersonaSpriteGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="shimmer aspect-[3/4] rounded-xl" />
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
            className="group/preview relative block aspect-[3/4] w-full bg-[var(--secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/60"
            title="Open wand cleanup"
          >
            <img src={sprite.url} alt={sprite.expression} loading="lazy" className="h-full w-full object-contain" />
            <span className="pointer-events-none absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--card)]/90 text-[var(--primary)] opacity-0 shadow-lg ring-1 ring-[var(--border)] transition-opacity group-hover/preview:opacity-100 group-focus-visible/preview:opacity-100 max-md:opacity-100">
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
            <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100">
              <button
                type="button"
                onClick={() => onOpenFrame(sprite)}
                className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50"
                title="Frame"
              >
                <Crop size="0.6875rem" />
              </button>
              <button
                type="button"
                onClick={() => onDownload(sprite)}
                className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50"
                title="Download"
              >
                <ImageDown size="0.6875rem" />
              </button>
              <button
                type="button"
                onClick={() => onReplace(sprite)}
                className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50"
                title="Replace"
              >
                <Upload size="0.6875rem" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(sprite)}
                className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destructive)]/50"
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
