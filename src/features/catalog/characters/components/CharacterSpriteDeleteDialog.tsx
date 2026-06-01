import { Loader2, Trash2 } from "lucide-react";

import type { SpriteInfo } from "../../sprites/index";
import type { SpriteCategory } from "../lib/character-sprites-model";
import { Modal } from "../../../../shared/components/ui/Modal";

export function CharacterSpriteDeleteDialog({
  sprite,
  visibleSpriteCount,
  category,
  deletingSprites,
  displayExpression,
  onClose,
  onDeleteVisible,
  onDeleteSingle,
}: {
  sprite: SpriteInfo | null;
  visibleSpriteCount: number;
  category: SpriteCategory;
  deletingSprites: "single" | "all" | null;
  displayExpression: (stored: string) => string;
  onClose: () => void;
  onDeleteVisible: () => void;
  onDeleteSingle: () => void;
}) {
  if (!sprite) return null;

  return (
    <Modal
      open
      onClose={() => {
        if (!deletingSprites) onClose();
      }}
      title="Delete Sprite"
      width="max-w-sm"
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-[var(--foreground)]">
          Delete sprite for "{displayExpression(sprite.expression)}"?
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {visibleSpriteCount > 1 ? (
            <button
              type="button"
              onClick={onDeleteVisible}
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
              onClick={onClose}
              disabled={!!deletingSprites}
              className="rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50 sm:px-3 sm:text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onDeleteSingle}
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
  );
}
