// ──────────────────────────────────────────────
// Selection-preferences panel governing how custom emojis AND stickers are
// chosen for the model (the per-chat customEmojiSelection prefs). Shared by the
// emoji "Custom" tab and the sticker selector, so the same setting is reachable
// and clearly labeled from either.
// ──────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from "react";
import { useChat, useUpdateChatMetadata } from "../../hooks/use-chats";
import { ConnectionSelect } from "../connections/ConnectionSelect";
import { useChatStore } from "../../stores/chat.store";
import { parseChatMetadata } from "../../lib/chat-display";
import {
  normalizeCustomEmojiSelection,
  CUSTOM_EMOJI_SELECTION_MIN_COUNT,
  CUSTOM_EMOJI_SELECTION_MAX_COUNT,
  CUSTOM_EMOJI_VISION_MODES,
  CUSTOM_EMOJI_VISION_OFFERED_MAX,
  CUSTOM_EMOJI_VISION_RECENT_MAX,
  CUSTOM_EMOJI_VISION_RECENT_MIN,
  type CustomEmojiSelectionPrefs,
} from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";

function clampMaxCount(value: number): number {
  if (!Number.isFinite(value)) return CUSTOM_EMOJI_SELECTION_MIN_COUNT;
  return Math.min(CUSTOM_EMOJI_SELECTION_MAX_COUNT, Math.max(CUSTOM_EMOJI_SELECTION_MIN_COUNT, Math.round(value)));
}

function clampWhole(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

const VISION_MODE_LABEL_KEYS = {
  off: "ui.chat.customemojiselectionsettings.visionOff",
  last: "ui.chat.customemojiselectionsettings.visionLast",
  recent: "ui.chat.customemojiselectionsettings.visionRecent",
} as const;

export function CustomEmojiSelectionSettings() {
  const { t: localizeUi } = useUiTranslation();
  const activeChatId = useChatStore((s) => s.activeChatId);
  const { data: activeChat } = useChat(activeChatId);
  const updateMeta = useUpdateChatMetadata();

  const selectionPrefs = useMemo(
    () => normalizeCustomEmojiSelection(parseChatMetadata(activeChat?.metadata).customEmojiSelection),
    [activeChat?.metadata],
  );
  const [draftPrefs, setDraftPrefs] = useState(selectionPrefs);
  const [maxCountDraft, setMaxCountDraft] = useState(draftPrefs.maxCount);
  const [recentCountDraft, setRecentCountDraft] = useState(draftPrefs.visionRecentCount);
  const [offeredCountDraft, setOfferedCountDraft] = useState(draftPrefs.visionOfferedCount);
  useEffect(() => {
    setDraftPrefs(selectionPrefs);
    setMaxCountDraft(selectionPrefs.maxCount);
    setRecentCountDraft(selectionPrefs.visionRecentCount);
    setOfferedCountDraft(selectionPrefs.visionOfferedCount);
  }, [selectionPrefs]);

  const savePrefs = useCallback(
    (patch: Partial<CustomEmojiSelectionPrefs>) => {
      if (!activeChatId) return;
      setDraftPrefs((current) => {
        const next = normalizeCustomEmojiSelection({ ...current, ...patch });
        updateMeta.mutate({ id: activeChatId, customEmojiSelection: next });
        return next;
      });
    },
    [activeChatId, updateMeta],
  );

  return (
    <div className="mb-2 rounded-md bg-foreground/5 p-2 ring-1 ring-foreground/10">
      <p className="mb-1.5 text-[0.6875rem] text-foreground/55">
        {localizeUi("ui.chat.customemojiselectionsettings.whenACharacterHasMoreCustomEmojisOrStickers")}
      </p>
      <div className="mb-1.5 flex items-center gap-1">
        {(["semantic", "random", "tool-call"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => savePrefs({ mode })}
            className={cn(
              "flex-1 rounded px-2 py-1 text-xs capitalize transition-colors",
              draftPrefs.mode === mode
                ? "bg-[var(--primary)] text-white"
                : "bg-foreground/5 text-foreground/60 ring-1 ring-foreground/10 hover:bg-foreground/10",
            )}
          >
            {mode}
          </button>
        ))}
      </div>
      <p className="mb-2 text-[0.625rem] text-foreground/40">
        {draftPrefs.mode === "semantic"
          ? localizeUi("ui.chat.customemojiselectionsettings.offersTheEmojisAndStickersMostRelevantToThe")
          : draftPrefs.mode === "random"
            ? localizeUi("ui.chat.customemojiselectionsettings.offersARandomSetForEachReply")
            : localizeUi("ui.chat.customemojiselectionsettings.aModelCallPicksTheFittingOnesEachReply")}
      </p>
      {draftPrefs.mode === "tool-call" && (
        <div className="mb-2">
          <ConnectionSelect
            job={localizeUi("connections.picker.job.emoji")}
            value={draftPrefs.toolConnectionId ?? null}
            onChange={(toolConnectionId) => savePrefs({ toolConnectionId })}
            defaultLabel={localizeUi("ui.chat.customemojiselectionsettings.selectAConnection")}
          />
          {!draftPrefs.toolConnectionId && (
            <p className="mt-1 text-[0.625rem] text-amber-400/80">
              {localizeUi("ui.chat.customemojiselectionsettings.noConnectionSetThisFallsBackToSemanticSelection")}
            </p>
          )}
        </div>
      )}
      <label className="flex items-center justify-between gap-2 text-xs text-foreground/60">
        <span>{localizeUi("ui.chat.customemojiselectionsettings.maxOfferedEach")}</span>
        <input
          type="number"
          min={CUSTOM_EMOJI_SELECTION_MIN_COUNT}
          max={CUSTOM_EMOJI_SELECTION_MAX_COUNT}
          value={maxCountDraft}
          onChange={(e) => setMaxCountDraft(Number(e.target.value))}
          onBlur={() => {
            const next = clampMaxCount(maxCountDraft);
            setMaxCountDraft(next);
            savePrefs({ maxCount: next });
          }}
          className="w-16 rounded bg-foreground/5 px-2 py-1 text-right text-foreground ring-1 ring-foreground/10 focus:outline-none focus:ring-[var(--primary)]"
        />
      </label>
      <label className="mt-1.5 flex items-start gap-2 text-xs text-foreground/60">
        <input
          type="checkbox"
          checked={draftPrefs.useDescriptions}
          onChange={(e) => savePrefs({ useDescriptions: e.target.checked })}
          className="mt-0.5 accent-[var(--primary)]"
        />
        <span>
          {localizeUi("ui.chat.customemojiselectionsettings.useDescriptions")}
          <span className="block text-[0.625rem] text-foreground/40">
            {localizeUi("ui.chat.customemojiselectionsettings.useDescriptionsHelp")}
          </span>
        </span>
      </label>
      {draftPrefs.useDescriptions && (
        <label className="mt-1.5 flex items-start gap-2 pl-5 text-xs text-foreground/60">
          <input
            type="checkbox"
            checked={draftPrefs.showDescriptions}
            onChange={(e) => savePrefs({ showDescriptions: e.target.checked })}
            className="mt-0.5 accent-[var(--primary)]"
          />
          <span>
            {localizeUi("ui.chat.customemojiselectionsettings.showDescriptions")}
            <span className="block text-[0.625rem] text-foreground/40">
              {localizeUi("ui.chat.customemojiselectionsettings.showDescriptionsHelp")}
            </span>
          </span>
        </label>
      )}
      <div className="mt-2 border-t border-foreground/10 pt-2">
        <p className="mb-1.5 text-xs text-foreground/60">
          {localizeUi("ui.chat.customemojiselectionsettings.visionTitle")}
        </p>
        <div className="mb-1.5 flex items-center gap-1">
          {CUSTOM_EMOJI_VISION_MODES.map((visionMode) => (
            <button
              key={visionMode}
              type="button"
              onClick={() => savePrefs({ visionMode })}
              className={cn(
                "flex-1 rounded px-2 py-1 text-xs transition-colors",
                draftPrefs.visionMode === visionMode
                  ? "bg-[var(--primary)] text-white"
                  : "bg-foreground/5 text-foreground/60 ring-1 ring-foreground/10 hover:bg-foreground/10",
              )}
            >
              {localizeUi(VISION_MODE_LABEL_KEYS[visionMode])}
            </button>
          ))}
        </div>
        <p className="mb-2 text-[0.625rem] text-foreground/40">
          {localizeUi("ui.chat.customemojiselectionsettings.visionHelp")}
        </p>
        {draftPrefs.visionMode === "recent" && (
          <label className="mb-1.5 flex items-center justify-between gap-2 text-xs text-foreground/60">
            <span>{localizeUi("ui.chat.customemojiselectionsettings.visionRecentCount")}</span>
            <input
              type="number"
              min={CUSTOM_EMOJI_VISION_RECENT_MIN}
              max={CUSTOM_EMOJI_VISION_RECENT_MAX}
              value={recentCountDraft}
              onChange={(e) => setRecentCountDraft(Number(e.target.value))}
              onBlur={() => {
                const next = clampWhole(
                  recentCountDraft,
                  CUSTOM_EMOJI_VISION_RECENT_MIN,
                  CUSTOM_EMOJI_VISION_RECENT_MAX,
                );
                setRecentCountDraft(next);
                savePrefs({ visionRecentCount: next });
              }}
              className="w-16 rounded bg-foreground/5 px-2 py-1 text-right text-foreground ring-1 ring-foreground/10 focus:outline-none focus:ring-[var(--primary)]"
            />
          </label>
        )}
        {draftPrefs.visionMode !== "off" && (
          <label className="flex items-center justify-between gap-2 text-xs text-foreground/60">
            <span>{localizeUi("ui.chat.customemojiselectionsettings.visionOfferedCount")}</span>
            <input
              type="number"
              min={0}
              max={CUSTOM_EMOJI_VISION_OFFERED_MAX}
              value={offeredCountDraft}
              onChange={(e) => setOfferedCountDraft(Number(e.target.value))}
              onBlur={() => {
                const next = clampWhole(offeredCountDraft, 0, CUSTOM_EMOJI_VISION_OFFERED_MAX);
                setOfferedCountDraft(next);
                savePrefs({ visionOfferedCount: next });
              }}
              className="w-16 rounded bg-foreground/5 px-2 py-1 text-right text-foreground ring-1 ring-foreground/10 focus:outline-none focus:ring-[var(--primary)]"
            />
          </label>
        )}
      </div>
    </div>
  );
}
