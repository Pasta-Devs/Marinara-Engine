import { useEffect, useState } from "react";
import { BookOpen, Camera, Trash2, UserRound } from "lucide-react";
import type { Lorebook } from "../../../../../engine/contracts/types/lorebook";
import { resolveManagedLocalAssetUrl } from "../../../../../shared/api/local-file-api";
import { cn } from "../../../../../shared/lib/utils";
import { LOREBOOK_CATEGORY_COLORS, LOREBOOK_PANEL_CATEGORIES } from "./lorebook-panel-config";

export function LorebookRow({
  lorebook,
  characterName,
  personaName,
  onClick,
  onDelete,
  onImagePick,
  selectionMode,
  isSelected,
  onToggleSelect,
}: {
  lorebook: Lorebook;
  characterName?: string;
  personaName?: string;
  onClick: () => void;
  onDelete: () => void | Promise<void>;
  onImagePick: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const gradient = LOREBOOK_CATEGORY_COLORS[lorebook.category] ?? LOREBOOK_CATEGORY_COLORS.uncategorized;
  const CatIcon = LOREBOOK_PANEL_CATEGORIES.find((category) => category.id === lorebook.category)?.icon ?? BookOpen;
  const [resolvedImagePath, setResolvedImagePath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResolvedImagePath(null);
    if (!lorebook.imagePath) return;
    resolveManagedLocalAssetUrl(lorebook.imagePath)
      .then((url) => {
        if (!cancelled) setResolvedImagePath(url);
      })
      .catch(() => {
        if (!cancelled) setResolvedImagePath(null);
      });
    return () => {
      cancelled = true;
    };
  }, [lorebook.imagePath]);

  const imageContent = resolvedImagePath ? (
    <img src={resolvedImagePath} alt="" className="h-full w-full object-cover" draggable={false} />
  ) : (
    <CatIcon size="1rem" />
  );
  const imageClasses = cn(
    "relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-white shadow-sm",
    lorebook.imagePath ? "bg-[var(--muted)]" : `bg-gradient-to-br ${gradient}`,
  );

  return (
    <div
      className={cn(
        "group relative flex cursor-pointer items-center gap-3 rounded-xl p-2.5 transition-all hover:bg-[var(--sidebar-accent)]",
        selectionMode && isSelected && "ring-1 ring-amber-400/40 bg-amber-400/10",
      )}
      onClick={onClick}
    >
      {selectionMode && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelect?.();
          }}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
            isSelected
              ? "border-amber-400 bg-amber-400 text-white"
              : "border-[var(--muted-foreground)]/40 bg-[var(--secondary)] text-transparent",
          )}
          aria-label={isSelected ? "Deselect lorebook" : "Select lorebook"}
        >
          <span className="text-[0.75rem]">✓</span>
        </button>
      )}
      {selectionMode ? (
        <div className={imageClasses}>{imageContent}</div>
      ) : (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onImagePick();
          }}
          className={cn(
            imageClasses,
            "transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-400/50",
          )}
          title={lorebook.imagePath ? "Replace lorebook picture" : "Upload lorebook picture"}
          aria-label={lorebook.imagePath ? "Replace lorebook picture" : "Upload lorebook picture"}
        >
          {imageContent}
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
            <Camera size="0.875rem" />
          </span>
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{lorebook.name}</span>
          {!lorebook.enabled && (
            <span className="rounded bg-[var(--muted)]/50 px-1 py-0.5 text-[0.5625rem] text-[var(--muted-foreground)]">
              OFF
            </span>
          )}
        </div>
        <div className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">
          {characterName || personaName ? (
            <span className="inline-flex items-center gap-1">
              <UserRound size="0.625rem" className="shrink-0" />
              {characterName ?? personaName}
              {lorebook.description ? ` · ${lorebook.description}` : ""}
            </span>
          ) : (
            lorebook.description || "No description"
          )}
        </div>
      </div>
      {!selectionMode && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex shrink-0 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 max-md:opacity-100">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="rounded-lg p-1.5 transition-all hover:bg-[var(--destructive)]/15 active:scale-90"
            title="Delete"
          >
            <Trash2 size="0.75rem" className="text-[var(--destructive)]" />
          </button>
        </div>
      )}
    </div>
  );
}
