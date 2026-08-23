// ──────────────────────────────────────────────
// File Browser — Image info popover (desktop card / mobile bottom sheet)
// ──────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { TreeNode } from "../../hooks/use-game-assets";
import { useGameAssetFileInfo } from "../../hooks/use-game-assets";
import { formatBytes, formatDate } from "../../lib/format";
import { useTranslation as useUiTranslation } from "react-i18next";

/**
 * Popover showing image metadata (dimensions, format, size, modified date).
 *
 * Renders as a desktop card or mobile bottom sheet.
 * Press Escape or click outside to dismiss.
 * @param node - Image file node to inspect
 * @param onClose - Callback when popover should close
 */
export function ImageInfoPopover({ node, onClose }: { node: TreeNode; onClose: () => void }) {
  const { t: localizeUi } = useUiTranslation();
  const { data: info } = useGameAssetFileInfo(node.path);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const raf = requestAnimationFrame(() => {
      document.addEventListener("mousedown", handle);
      document.addEventListener("keydown", handleKey);
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[60] rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-xl max-sm:inset-x-0 max-sm:bottom-0 max-sm:rounded-b-none max-sm:border-b-0 sm:right-4 sm:top-20 sm:w-64"
    >
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[var(--foreground)]">
          {localizeUi("ui.gameAssets.imageinfopopover.fileInfo")}
        </h4>
        <button
          type="button"
          aria-label={localizeUi("capabilities.actions.close")}
          onClick={onClose}
          className="rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
        >
          <X size="0.875rem" />
        </button>
      </div>
      {info ? (
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">{localizeUi("ui.characters.metadatatab.name")}</span>
            <span className="text-right text-[var(--foreground)]">{info.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">{localizeUi("ui.gameAssets.assetgrid.size")}</span>
            <span className="text-[var(--foreground)]">{formatBytes(info.size)}</span>
          </div>
          {info.width != null && info.height != null && (
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">
                {localizeUi("ui.gameAssets.imageinfopopover.dimensions")}
              </span>
              <span className="text-[var(--foreground)]">
                {info.width} × {info.height}
              </span>
            </div>
          )}
          {info.format && (
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">
                {localizeUi("ui.gameAssets.imageinfopopover.format")}
              </span>
              <span className="uppercase text-[var(--foreground)]">{info.format}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">{localizeUi("ui.gameAssets.assetgrid.modified")}</span>
            <span className="text-[var(--foreground)]">{formatDate(info.modified)}</span>
          </div>
        </div>
      ) : (
        <div className="mari-chrome-text-muted text-sm">{localizeUi("ui.characters.characterlibraryview.loading")}</div>
      )}
    </div>
  );
}
