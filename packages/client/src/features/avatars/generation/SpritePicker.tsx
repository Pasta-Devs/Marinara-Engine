// Sprite thumbnails to choose from, one or several (lane: generation).
import { Check } from "lucide-react";
import type { SpriteInfo } from "../../../hooks/use-characters";
import { cn } from "../../../lib/utils";
import { isSpriteVariant } from "../renderers/pngtuber/pngtuber-layers";

/** Sprites an image model can read (the server refuses SVG sprites the same way). */
const RASTER_SPRITE = /\.(?:png|jpe?g|webp|avif|gif)$/iu;

/** The sprites an avatar can be made from: raster faces, never a talk or blink picture of another face. */
export function avatarSourceSprites(sprites: readonly SpriteInfo[] | undefined): SpriteInfo[] {
  return (sprites ?? []).filter(
    (sprite) => RASTER_SPRITE.test(sprite.filename) && !isSpriteVariant(sprite.label ?? sprite.expression),
  );
}

export function SpritePicker({
  sprites,
  selected,
  onToggle,
  disabled,
  label,
}: {
  sprites: SpriteInfo[];
  selected: readonly string[];
  onToggle: (expression: string) => void;
  disabled?: boolean;
  /** Accessible name of the group. */
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
      {sprites.map((sprite) => {
        const isSelected = selected.includes(sprite.expression);
        return (
          <button
            key={sprite.expression}
            type="button"
            aria-pressed={isSelected}
            disabled={disabled}
            onClick={() => onToggle(sprite.expression)}
            className={cn(
              "relative flex min-h-11 flex-col items-center gap-1 rounded-xl bg-[var(--secondary)] p-1.5 text-[0.625rem] ring-1 transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
              isSelected ? "ring-2 ring-[var(--primary)]" : "ring-[var(--border)] hover:ring-[var(--primary)]/50",
            )}
          >
            <img
              src={sprite.url}
              alt=""
              loading="lazy"
              className="aspect-square w-full rounded-lg object-contain"
              draggable={false}
            />
            <span className="w-full truncate text-center text-[var(--foreground)]">
              {(sprite.label ?? sprite.expression).replace(/_/gu, " ")}
            </span>
            {isSelected && (
              <span className="absolute right-1 top-1 rounded-full bg-[var(--primary)] p-0.5 text-[var(--primary-foreground)]">
                <Check size="0.625rem" aria-hidden />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
