// ──────────────────────────────────────────────
// Selection-preferences panel governing how custom emojis AND stickers are
// chosen for the model (the per-chat customEmojiSelection prefs). Shared by the
// emoji "Custom" tab and the sticker selector, so the same setting is reachable
// and clearly labeled from either.
// ──────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from "react";
import { useChat, useUpdateChatMetadata } from "../../hooks/use-chats";
import { useConnections } from "../../hooks/use-connections";
import { useChatStore } from "../../stores/chat.store";
import { parseChatMetadata } from "../../lib/chat-display";
import {
  normalizeCustomEmojiSelection,
  CUSTOM_EMOJI_SELECTION_MIN_COUNT,
  CUSTOM_EMOJI_SELECTION_MAX_COUNT,
  type CustomEmojiSelectionPrefs,
} from "@marinara-engine/shared";
import { cn } from "../../lib/utils";

function clampMaxCount(value: number): number {
  if (!Number.isFinite(value)) return CUSTOM_EMOJI_SELECTION_MIN_COUNT;
  return Math.min(CUSTOM_EMOJI_SELECTION_MAX_COUNT, Math.max(CUSTOM_EMOJI_SELECTION_MIN_COUNT, Math.round(value)));
}

export function CustomEmojiSelectionSettings() {
  const activeChatId = useChatStore((s) => s.activeChatId);
  const { data: activeChat } = useChat(activeChatId);
  const updateMeta = useUpdateChatMetadata();
  const { data: connections } = useConnections();

  const selectionPrefs = useMemo(
    () => normalizeCustomEmojiSelection(parseChatMetadata(activeChat?.metadata).customEmojiSelection),
    [activeChat?.metadata],
  );
  const [draftPrefs, setDraftPrefs] = useState(selectionPrefs);
  const [maxCountDraft, setMaxCountDraft] = useState(draftPrefs.maxCount);
  useEffect(() => {
    setDraftPrefs(selectionPrefs);
    setMaxCountDraft(selectionPrefs.maxCount);
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
        When a character has more custom emojis or stickers than the max, how should the ones offered to the model be
        chosen?
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
          ? "Offers the emojis and stickers most relevant to the recent conversation (falls back to random if the local embedder is unavailable)."
          : draftPrefs.mode === "random"
            ? "Offers a random set for each reply."
            : "A model call picks the fitting ones each reply — choose a capable connection below. Falls back to semantic if it's unset or fails."}
      </p>
      {draftPrefs.mode === "tool-call" && (
        <div className="mb-2">
          <select
            value={draftPrefs.toolConnectionId ?? ""}
            onChange={(e) => savePrefs({ toolConnectionId: e.target.value || null })}
            className="w-full rounded bg-foreground/5 px-2 py-1 text-xs text-foreground ring-1 ring-foreground/10 focus:outline-none focus:ring-[var(--primary)]"
          >
            <option value="">Select a connection…</option>
            {((connections ?? []) as Array<{ id: string; name?: string }>).map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.name || connection.id}
              </option>
            ))}
          </select>
          {!draftPrefs.toolConnectionId && (
            <p className="mt-1 text-[0.625rem] text-amber-400/80">
              No connection set — this falls back to semantic selection.
            </p>
          )}
        </div>
      )}
      <label className="flex items-center justify-between gap-2 text-xs text-foreground/60">
        <span>Max offered (each)</span>
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
    </div>
  );
}
