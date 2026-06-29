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
  const [pos, setPos] = useState<{ bottom: number; right?: number; left?: number; maxHeight?: number }>({ bottom: 0 });

  const updatePosition = useCallback(() => {
    if (!anchorRef?.current) return;
    const btnRect = anchorRef.current.getBoundingClientRect();
    const barRect = containerRef?.current?.getBoundingClientRect();
    const pad = 8;
    const pickerWidth = 336;
    const pickerHeight = 352;
    const viewport = window.visualViewport;
    const vw = viewport?.width ?? window.innerWidth;
    const vh = viewport?.height ?? window.innerHeight;
    const refTop = barRect ? barRect.top : btnRect.top;
    const bottom = vh - refTop + pad;
    const maxHeight = Math.min(pickerHeight, Math.max(0, refTop - 2 * pad));
    if (vw < 480) {
      const left = Math.max(8, (vw - Math.min(pickerWidth, vw - 16)) / 2);
      setPos({ bottom, left, maxHeight });
    } else {
      const right = Math.max(8, vw - btnRect.right);
      setPos({ bottom, right, maxHeight });
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
            title: "Name this sticker",
            message: "Use it in messages as sticker:name: — lowercase letters, numbers, and underscores.",
            defaultValue: suggested,
            placeholder: "e.g. wave",
            confirmLabel: "Add",
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
    [upload],
  );

  const handleRename = useCallback(
    async (id: string, current: string) => {
      const raw = await showPromptDialog({
        title: "Rename sticker",
        message: "New name (used as sticker:name:).",
        defaultValue: current,
        confirmLabel: "Rename",
      });
      if (raw == null) return;
      const name = slugifyCustomName(raw);
      if (!name || name === current) return;
      rename.mutate({ id, name });
    },
    [rename],
  );

  const handleDelete = useCallback(
    async (id: string, name: string) => {
      if (
        await showConfirmDialog({
          title: "Delete sticker",
          message: `Delete sticker:${name}:? Messages that already used it will show the text instead.`,
          confirmLabel: "Delete",
          tone: "destructive",
        })
      ) {
        remove.mutate(id);
      }
    },
    [remove],
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

  const send = (name: string) => {
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
            placeholder="Search stickers..."
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
            <ImagePlus size="0.875rem" /> Upload
          </button>
          {editing && (
            <>
              <button
                type="button"
                onClick={() => importFileRef.current?.click()}
                className="rounded-md bg-foreground/5 px-2 py-1 text-xs text-foreground/70 ring-1 ring-foreground/10 transition-colors hover:bg-foreground/10 hover:text-foreground/90"
              >
                Import
              </button>
              {globalList.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleExport()}
                  className="rounded-md bg-foreground/5 px-2 py-1 text-xs text-foreground/70 ring-1 ring-foreground/10 transition-colors hover:bg-foreground/10 hover:text-foreground/90"
                >
                  Export
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
            title="Selection preferences"
            aria-label="Selection preferences"
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
            {editing ? "Done" : "Edit"}
          </button>
        </div>
      </div>

      {showSettings && <CustomEmojiSelectionSettings />}

      {error && <p className="px-3 py-1.5 text-[0.6875rem] text-red-400">{error}</p>}

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {filteredGlobal.length === 0 && filteredGroups.length === 0 ? (
          <p className="px-1 py-6 text-center text-[0.6875rem] text-foreground/45">
            {q ? (
              <>No stickers match “{query.trim()}”.</>
            ) : (
              <>
                No stickers yet. Upload one (max 512×512) to send it as{" "}
                <span className="font-mono">sticker:name:</span>.
              </>
            )}
          </p>
        ) : (
          <>
            {filteredGlobal.length > 0 && (
              <>
                {filteredGroups.length > 0 && <p className={headerClass}>Global</p>}
                <div className="grid grid-cols-3 gap-1.5">
                  {filteredGlobal.map((sticker) => (
                    <div key={sticker.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => (editing ? void handleRename(sticker.id, sticker.name) : send(sticker.name))}
                        title={editing ? `Rename sticker:${sticker.name}:` : `Send sticker:${sticker.name}:`}
                        className={cellClass}
                      >
                        <img src={sticker.url} alt={`sticker:${sticker.name}:`} className="max-h-16 max-w-full object-contain" />
                      </button>
                      {editing && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(sticker.id, sticker.name)}
                          title={`Delete sticker:${sticker.name}:`}
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
                        onClick={() => send(sticker.name)}
                        title={`Send sticker:${sticker.name}: — ${source}`}
                        className={cellClass}
                      >
                        <img src={sticker.url} alt={`sticker:${sticker.name}:`} className="max-h-16 max-w-full object-contain" />
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
      className="fixed z-[9999] flex h-[22rem] w-[21rem] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border border-foreground/10 bg-[var(--card)] shadow-xl"
      style={{
        bottom: pos.bottom,
        ...(pos.right != null ? { right: pos.right } : {}),
        ...(pos.left != null ? { left: pos.left } : {}),
        ...(pos.maxHeight != null ? { maxHeight: pos.maxHeight } : {}),
      }}
    >
      {content}
    </div>,
    document.body,
  );
}
