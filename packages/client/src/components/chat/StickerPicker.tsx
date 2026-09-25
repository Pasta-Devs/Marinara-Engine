// ──────────────────────────────────────────────
// Sticker selector (Conversation mode). Pick a sticker to send; an Edit toggle
// reveals upload / rename / delete so users don't delete one while reaching to
// use it. Shows the global pool plus the active persona's and chat bots' gallery
// stickers (read-only here). Renders as a popover beside the sticker button, or
// inline (embedded) inside the mobile composer sheet.
// ──────────────────────────────────────────────
import { useState, useRef, useEffect, useCallback, useLayoutEffect, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, Settings, Trash2 } from "lucide-react";
import {
  useCustomStickers,
  useUploadCustomSticker,
  useRenameCustomSticker,
  useDeleteCustomSticker,
  useImportCustomStickers,
} from "../../hooks/use-custom-stickers";
import {
  useConversationCustomStickers,
  type ConversationCustomSticker,
} from "../../hooks/use-conversation-custom-stickers";
import { readImageDimensions, validateDimensionsForKind, slugifyCustomName } from "../../lib/custom-emoji";
import { showPromptDialog, showConfirmDialog } from "../../lib/app-dialogs";
import { downloadJsonFile } from "../../lib/download-json";
import { api } from "../../lib/api-client";
import { CustomEmojiSelectionSettings } from "./CustomEmojiSelectionSettings";
import { cn } from "../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";
import { rememberRecentMedia, useRecentMedia } from "../../hooks/use-recent-media";

interface StickerPickerProps {
  open: boolean;
  onClose: () => void;
  /** Send the sticker (posts `sticker:name:` as its own message). */
  onSelect: (name: string) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  containerRef?: React.RefObject<HTMLElement | null>;
  /** Render inline to fill a parent (no portal/positioning) — e.g. inside the mobile composer sheet. */
  embedded?: boolean;
}

const headerClass = "mb-1 px-1 text-[0.625rem] font-semibold uppercase tracking-wide text-foreground/40";
const cellClass =
  "flex aspect-square w-full items-center justify-center rounded-md p-1 transition-transform hover:scale-105 hover:bg-foreground/10 active:scale-100";

export function StickerPicker({ open, onClose, onSelect, anchorRef, containerRef, embedded }: StickerPickerProps) {
  const { t: localizeUi } = useUiTranslation();
  const { data: stickers } = useCustomStickers();
  const { list: conversationStickers } = useConversationCustomStickers();
  const upload = useUploadCustomSticker();
  const rename = useRenameCustomSticker();
  const remove = useDeleteCustomSticker();
  const importStickers = useImportCustomStickers();
  const fileRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number; maxHeight?: number }>({ top: 0 });
  const recentStickers = useRecentMedia("sticker");

  const updatePosition = useCallback(() => {
    if (!anchorRef?.current) return;
    const btnRect = anchorRef.current.getBoundingClientRect();
    const barRect = containerRef?.current?.getBoundingClientRect();
    const pad = 8;
    const pickerWidth = 336;
    const pickerHeight = 352;
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportTop = viewport?.offsetTop ?? 0;
    const vw = viewport?.width ?? window.innerWidth;
    const visibleLeft = viewportLeft;
    const visibleTop = viewportTop;
    const visibleRight = viewportLeft + vw;
    const panelWidth = Math.min(pickerWidth, Math.max(0, vw - 2 * pad));
    const refTop = barRect ? barRect.top : btnRect.top;
    const anchorTop = refTop + viewportTop;
    const maxHeight = Math.min(pickerHeight, Math.max(0, anchorTop - visibleTop - 2 * pad));
    const top = Math.max(visibleTop + pad, anchorTop - maxHeight - pad);
    if (vw < 480) {
      const left = visibleLeft + Math.max(pad, (vw - panelWidth) / 2);
      setPos({ top, left, maxHeight });
    } else {
      const btnRight = btnRect.right + viewportLeft;
      const alignedLeft = btnRight - panelWidth;
      if (alignedLeft < visibleLeft + pad) {
        setPos({ top, left: visibleLeft + pad, maxHeight });
      } else {
        setPos({ top, right: Math.max(pad, visibleRight - btnRight), maxHeight });
      }
    }
  }, [anchorRef, containerRef]);

  // Position the popover above the input bar (skipped when embedded).
  useLayoutEffect(() => {
    if (!open || embedded) return;
    updatePosition();
    let frame = 0;
    const scheduleUpdate = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        updatePosition();
      });
    };
    window.addEventListener("resize", scheduleUpdate);
    window.visualViewport?.addEventListener("resize", scheduleUpdate);
    window.visualViewport?.addEventListener("scroll", scheduleUpdate);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleUpdate);
    };
  }, [embedded, open, updatePosition]);

  // Close on outside click / Escape (popover only; embedded dismissal is owned by the sheet).
  useEffect(() => {
    if (!open || embedded) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        anchorRef?.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose, anchorRef, embedded]);

  useEffect(() => {
    if (!open || embedded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose, embedded]);

  const handleFiles = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (files.length === 0) return;
      setError(null);

      for (const file of files) {
        const objectUrl = URL.createObjectURL(file);
        try {
          const { width, height } = await readImageDimensions(objectUrl);
          const valid = validateDimensionsForKind(width, height, "sticker");
          if (!valid.ok) {
            setError(valid.reason);
            continue;
          }
          const suggested = slugifyCustomName(file.name.replace(/\.[^.]+$/, ""));
          const raw = await showPromptDialog({
            title: localizeUi("ui.chat.stickerpicker.nameThisSticker"),
            message: localizeUi("ui.chat.stickerpicker.useItInMessagesAsStickerNameLowercaseLetters"),
            defaultValue: suggested,
            placeholder: "e.g. wave",
            confirmLabel: localizeUi("ui.characters.metadatatab.add"),
            previewImageUrl: objectUrl,
          });
          if (raw == null) continue;
          const name = slugifyCustomName(raw);
          if (!name) {
            setError("Enter a valid name (letters, numbers, or underscores).");
            continue;
          }
          await upload.mutateAsync({ file, name, width, height });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to add sticker.");
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      }
    },
    [upload, localizeUi],
  );

  const handleRename = useCallback(
    async (id: string, current: string) => {
      const raw = await showPromptDialog({
        title: localizeUi("ui.chat.stickerpicker.renameSticker"),
        message: localizeUi("ui.chat.stickerpicker.newNameUsedAsStickerName"),
        defaultValue: current,
        confirmLabel: localizeUi("ui.chat.chatbranchselector.rename"),
      });
      if (raw == null) return;
      const name = slugifyCustomName(raw);
      if (!name || name === current) return;
      rename.mutate({ id, name });
    },
    [rename, localizeUi],
  );

  const handleDelete = useCallback(
    async (id: string, name: string) => {
      if (
        await showConfirmDialog({
          title: localizeUi("ui.chat.stickerpicker.deleteSticker"),
          message: localizeUi("ui.chat.stickerpicker.deleteStickerValue1MessagesThatAlreadyUsedItWill", {
            value1: name,
          }),
          confirmLabel: localizeUi("lorebook.editor.batch.delete"),
          tone: "destructive",
        })
      ) {
        remove.mutate(id);
      }
    },
    [remove, localizeUi],
  );

  const handleExport = useCallback(async () => {
    setError(null);
    try {
      const bundle = await api.post<unknown>("/custom-stickers/export", {});
      downloadJsonFile(bundle, "marinara-custom-stickers.json");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export stickers.");
    }
  }, []);

  const handleImportFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      setError(null);
      try {
        const bundle = JSON.parse(await file.text());
        await importStickers.mutateAsync(bundle);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't import that file — is it a valid sticker set?");
      }
    },
    [importStickers],
  );

  if (!open) return null;

  const globalList = stickers ?? [];

  // Persona/character gallery stickers, grouped by source — read-only here.
  const bySource = new Map<string, ConversationCustomSticker[]>();
  for (const sticker of conversationStickers) {
    if (sticker.source === "Global") continue;
    const existing = bySource.get(sticker.source);
    if (existing) existing.push(sticker);
    else bySource.set(sticker.source, [sticker]);
  }
  const sourceGroups = [...bySource.entries()];

  const q = query.trim().toLowerCase();
  const insertableGlobalNames = new Set(
    conversationStickers.filter((sticker) => sticker.source === "Global").map((sticker) => sticker.name),
  );
  const visibleGlobal = editing ? globalList : globalList.filter((sticker) => insertableGlobalNames.has(sticker.name));
  const filteredGlobal = q ? visibleGlobal.filter((s) => s.name.toLowerCase().includes(q)) : visibleGlobal;
  const filteredGroups: [string, ConversationCustomSticker[]][] = q
    ? sourceGroups
        .map(
          ([source, arr]) =>
            [source, arr.filter((s) => s.name.toLowerCase().includes(q))] as [string, ConversationCustomSticker[]],
        )
        .filter(([, arr]) => arr.length > 0)
    : sourceGroups;
  const conversationStickerByName = new Map(conversationStickers.map((sticker) => [sticker.name, sticker] as const));
  const visibleRecentStickers = recentStickers
    .map((item) => conversationStickerByName.get(item.value))
    .filter((item): item is ConversationCustomSticker => item !== undefined);

  const send = (name: string, previewUrl: string) => {
    rememberRecentMedia("sticker", { value: name, label: name, previewUrl });
    onSelect(name);
    onClose();
  };

  const content = (
    <>
      {(globalList.length > 0 || sourceGroups.length > 0) && (
        <div className="border-b border-foreground/10 px-3 py-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={localizeUi("ui.chat.stickerpicker.searchStickers")}
            className="w-full rounded-md bg-foreground/5 px-2.5 py-1.5 text-xs outline-none ring-1 ring-foreground/10 transition-shadow placeholder:text-foreground/35 focus:ring-foreground/20"
            autoFocus={!embedded}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-b border-foreground/10 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground/5 px-2 py-1 text-xs text-foreground/70 ring-1 ring-foreground/10 transition-colors hover:bg-foreground/10 hover:text-foreground/90"
          >
            <ImagePlus size="0.875rem" /> {localizeUi("ui.characters.characterclipcard.upload")}
          </button>
          {editing && (
            <>
              <button
                type="button"
                onClick={() => importFileRef.current?.click()}
                className="rounded-md bg-foreground/5 px-2 py-1 text-xs text-foreground/70 ring-1 ring-foreground/10 transition-colors hover:bg-foreground/10 hover:text-foreground/90"
              >
                {localizeUi("ui.chat.chatbranchselector.import")}
              </button>
              {globalList.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleExport()}
                  className="rounded-md bg-foreground/5 px-2 py-1 text-xs text-foreground/70 ring-1 ring-foreground/10 transition-colors hover:bg-foreground/10 hover:text-foreground/90"
                >
                  {localizeUi("ui.characters.spritestab.export")}
                </button>
              )}
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
        <input
          ref={importFileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleImportFile}
        />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            title={localizeUi("ui.chat.customemojitab.selectionPreferences")}
            aria-label={localizeUi("ui.chat.customemojitab.selectionPreferences")}
            className={cn(
              "flex items-center rounded-md px-1.5 py-1 text-xs transition-colors",
              showSettings
                ? "bg-foreground/10 text-foreground/80 ring-1 ring-foreground/15"
                : "text-foreground/45 hover:bg-foreground/10 hover:text-foreground/70",
            )}
          >
            <Settings size="0.875rem" />
          </button>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={cn(
              "rounded-md px-2 py-1 text-xs transition-colors",
              editing
                ? "bg-foreground/10 text-foreground/80 ring-1 ring-foreground/15"
                : "text-foreground/45 hover:bg-foreground/10 hover:text-foreground/70",
            )}
          >
            {editing ? localizeUi("lorebook.editor.batch.done") : localizeUi("ui.noodle.noodlepostcard.edit")}
          </button>
        </div>
      </div>

      {showSettings && <CustomEmojiSelectionSettings />}

      {error && <p className="px-3 py-1.5 text-[0.6875rem] text-red-400">{error}</p>}

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {!q && !editing && visibleRecentStickers.length > 0 && (
          <section data-recent-media="sticker" className="mb-2 border-b border-foreground/10 pb-2">
            <p className={headerClass}>{localizeUi("ui.mediaPicker.recentlyUsed")}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {visibleRecentStickers.map((sticker) => (
                <button
                  key={sticker.name}
                  type="button"
                  onClick={() => send(sticker.name, sticker.url)}
                  title={localizeUi("ui.chat.stickerpicker.sendStickerValue1", { value1: sticker.name })}
                  className={cellClass}
                >
                  <img
                    src={sticker.url}
                    alt={localizeUi("ui.chat.stickerpicker.stickerValue1", { value1: sticker.name })}
                    className="max-h-16 max-w-full object-contain"
                  />
                </button>
              ))}
            </div>
          </section>
        )}
        {filteredGlobal.length === 0 && filteredGroups.length === 0 ? (
          <p className="px-1 py-6 text-center text-[0.6875rem] text-foreground/45">
            {q ? (
              <>
                {localizeUi("ui.chat.stickerpicker.noStickersMatch")}
                {query.trim()}”.
              </>
            ) : (
              <>
                {localizeUi("ui.chat.stickerpicker.noStickersYetUploadOneMax512512To")}{" "}
                <span className="font-mono">{localizeUi("ui.chat.stickerpicker.stickerName")}</span>.
              </>
            )}
          </p>
        ) : (
          <>
            {filteredGlobal.length > 0 && (
              <>
                {filteredGroups.length > 0 && (
                  <p className={headerClass}>{localizeUi("ui.lorebooks.lorebookeditor.global")}</p>
                )}
                <div className="grid grid-cols-3 gap-1.5">
                  {filteredGlobal.map((sticker) => (
                    <div key={sticker.id} className="group relative">
                      <button
                        type="button"
                        onClick={() =>
                          editing ? void handleRename(sticker.id, sticker.name) : send(sticker.name, sticker.url)
                        }
                        title={
                          editing
                            ? localizeUi("ui.chat.stickerpicker.renameStickerValue1", { value1: sticker.name })
                            : localizeUi("ui.chat.stickerpicker.sendStickerValue1", { value1: sticker.name })
                        }
                        className={cellClass}
                      >
                        <img
                          src={sticker.url}
                          alt={localizeUi("ui.chat.stickerpicker.stickerValue1", { value1: sticker.name })}
                          className="max-h-16 max-w-full object-contain"
                        />
                      </button>
                      {editing && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(sticker.id, sticker.name)}
                          title={localizeUi("ui.chat.stickerpicker.deleteStickerValue1", { value1: sticker.name })}
                          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--destructive)] text-white shadow ring-1 ring-black/10 transition-transform hover:scale-110"
                        >
                          <Trash2 size="0.625rem" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {filteredGroups.map(([source, arr]) => (
              <div key={source} className="mt-2">
                <p className={headerClass}>{source}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {arr.map((sticker) => (
                    <div key={sticker.name} className="group relative">
                      <button
                        type="button"
                        onClick={() => send(sticker.name, sticker.url)}
                        title={localizeUi("ui.chat.stickerpicker.sendStickerValue1Value2", {
                          value1: sticker.name,
                          value2: source,
                        })}
                        className={cellClass}
                      >
                        <img
                          src={sticker.url}
                          alt={localizeUi("ui.chat.stickerpicker.stickerValue1", { value1: sticker.name })}
                          className="max-h-16 max-w-full object-contain"
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );

  if (embedded) {
    return <div className="flex h-full min-h-0 flex-col overflow-hidden">{content}</div>;
  }

  return createPortal(
    <div
      ref={panelRef}
      data-chat-floating-panel
      className="fixed z-[9999] flex h-[22rem] w-[21rem] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border border-foreground/10 bg-[var(--card)] shadow-xl"
      style={{
        top: pos.top,
        ...(pos.left != null ? { left: pos.left } : {}),
        ...(pos.right != null ? { right: pos.right } : {}),
        ...(pos.maxHeight != null ? { maxHeight: pos.maxHeight } : {}),
      }}
    >
      {content}
    </div>,
    document.body,
  );
}
