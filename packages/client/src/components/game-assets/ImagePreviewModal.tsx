// ──────────────────────────────────────────────
// File Browser — Full-screen image preview with info panel
// ──────────────────────────────────────────────
import { useState } from "react";
import { Info } from "lucide-react";
import { ImageViewer, VIEWER_BUTTON_CLASS } from "../ui/ImageViewer";
import type { TreeNode } from "../../hooks/use-game-assets";
import { useGameAssetFileInfo } from "../../hooks/use-game-assets";
import { formatBytes, formatDate } from "../../lib/format";
import { gameAssetFileUrl } from "../../lib/game-asset-urls";
import { useTranslation as useUiTranslation } from "react-i18next";

/**
 * Full-screen image preview over the shared viewer, with a filename caption and an optional info panel.
 * Press Escape, tap outside or use Close to dismiss.
 * @param node - Image file node to preview
 * @param onClose - Callback when modal should close
 */
export function ImagePreviewModal({ node, onClose }: { node: TreeNode; onClose: () => void }) {
  const { t: localizeUi } = useUiTranslation();
  const [showInfo, setShowInfo] = useState(false);
  const { data: info } = useGameAssetFileInfo(node.path);

  return (
    <ImageViewer
      title={localizeUi("ui.gameAssets.imagepreviewmodal.imagePreviewValue1", { value1: node.name })}
      src={gameAssetFileUrl(node.path) ?? ""}
      alt={node.name}
      onClose={onClose}
      actions={
        <button
          type="button"
          aria-label={localizeUi(
            showInfo ? "ui.gameAssets.imagepreviewmodal.hideFileInfo" : "ui.gameAssets.imagepreviewmodal.showFileInfo",
          )}
          aria-pressed={showInfo}
          onClick={() => setShowInfo(!showInfo)}
          title={localizeUi("ui.gameAssets.imagepreviewmodal.fileInfo")}
          className={VIEWER_BUTTON_CLASS}
        >
          <Info size="0.875rem" />
        </button>
      }
    >
      <p className="mb-2 text-center text-sm text-white/80">{node.name}</p>
      {showInfo && info && (
        <div className="mx-auto w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-xl">
          <h4 className="mb-3 text-sm font-semibold text-[var(--foreground)]">
            {localizeUi("ui.gameAssets.imageinfopopover.fileInfo")}
          </h4>
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
        </div>
      )}
    </ImageViewer>
  );
}
