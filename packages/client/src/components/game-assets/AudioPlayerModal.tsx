// ──────────────────────────────────────────────
// File Browser — Audio player with format fallback
// ──────────────────────────────────────────────
import { useEffect, useState } from "react";
import { AUDIO_MIME_MAP } from "@marinara-engine/shared";
import { gameAssetFileUrl } from "../../lib/game-asset-urls";
import { useTranslation as useUiTranslation } from "react-i18next";

/**
 * Audio player modal with MIME type hinting and download fallback.
 *
 * Press Escape or click the backdrop to close.
 * @param path - Relative path to the audio asset
 * @param name - File name (used for extension detection and display)
 * @param onClose - Callback when modal should close
 */
export function AudioPlayerModal({ path, name, onClose }: { path: string; name: string; onClose: () => void }) {
  const { t: localizeUi } = useUiTranslation();
  const lastDot = name.lastIndexOf(".");
  const ext = lastDot >= 0 ? name.slice(lastDot).toLowerCase() : "";
  const mime = AUDIO_MIME_MAP[ext] || "audio/mpeg";
  const [playError, setPlayError] = useState(false);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [onClose]);

  const assetUrl = gameAssetFileUrl(path) ?? "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={localizeUi("ui.gameAssets.audioplayermodal.audioPlayerValue1", { value1: name })}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 pb-[max(var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom)),0.75rem)] pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-(--border) bg-(--card) p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-sm font-semibold text-(--foreground)">{name}</h3>
        <audio controls className="w-full" autoPlay onError={() => setPlayError(true)}>
          <source src={assetUrl} type={mime} />
          {localizeUi("ui.gameAssets.audioplayermodal.yourBrowserDoesNotSupportTheAudioElement")}
        </audio>
        {playError && (
          <p className="mt-2 text-xs text-[var(--primary)]">
            {localizeUi("ui.gameAssets.audioplayermodal.yourBrowserCanTPlay")} {ext || "this"}{" "}
            {localizeUi("ui.gameAssets.audioplayermodal.fileUseTheDownloadButtonBelow")}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <a
            href={assetUrl}
            download={name}
            className="rounded-lg border border-(--border) bg-(--background) px-4 py-2 text-xs font-medium text-(--foreground) transition-colors hover:bg-(--accent)"
          >
            {localizeUi("ui.characters.charactergallerytab.download")}
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-(--border) bg-(--background) px-4 py-2 text-xs font-medium text-(--foreground) transition-colors hover:bg-(--accent)"
          >
            {localizeUi("capabilities.actions.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
