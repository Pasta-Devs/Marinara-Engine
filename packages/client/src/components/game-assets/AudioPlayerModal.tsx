// ──────────────────────────────────────────────
// File Browser — Audio player with format fallback
// ──────────────────────────────────────────────
import { useState } from "react";
import { AUDIO_MIME_MAP } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { gameAssetFileUrl } from "../../lib/game-asset-urls";
import { useTranslation as useUiTranslation } from "react-i18next";

/**
 * Audio player modal with MIME type hinting and download fallback.
 *
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

  const assetUrl = gameAssetFileUrl(path) ?? "";

  return (
    <Modal
      open
      onClose={onClose}
      pullToClose={false}
      title={localizeUi("ui.gameAssets.audioplayermodal.audioPlayerValue1", { value1: name })}
      titleSlot={<span className="truncate">{name}</span>}
      width="max-w-md"
    >
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
      <div className="mt-4 flex justify-end">
        <a
          href={assetUrl}
          download={name}
          className="rounded-lg border border-(--border) bg-(--background) px-4 py-2 text-xs font-medium text-(--foreground) transition-colors hover:bg-(--accent)"
        >
          {localizeUi("ui.characters.charactergallerytab.download")}
        </a>
      </div>
    </Modal>
  );
}
