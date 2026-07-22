// ──────────────────────────────────────────────
// Custom Emoji tab — the EmojiPicker's "Custom" panel (Conversation mode).
// Lists global custom emojis (click → insert :name:), uploads new ones, and
// (in edit mode) renames/deletes them. Rendered into EmojiPicker via its
// optional `customTab` slot so the picker itself stays generic.
// ──────────────────────────────────────────────
import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, Settings, Trash2 } from "lucide-react";
import {
  useCustomEmojis,
  useUploadCustomEmoji,
  useRenameCustomEmoji,
  useDeleteCustomEmoji,
  useImportCustomEmojis,
} from "../../hooks/use-custom-emojis";
import { useConversationCustomEmojis, type ConversationCustomEmoji } from "../../hooks/use-conversation-custom-emojis";
import { CustomEmojiSelectionSettings } from "./CustomEmojiSelectionSettings";
import {
  filterCustomEmojisByName,
  readImageDimensions,
  validateDimensionsForKind,
  slugifyCustomName,
} from "../../lib/custom-emoji";
import { showPromptDialog, showConfirmDialog } from "../../lib/app-dialogs";
import { downloadJsonFile } from "../../lib/download-json";
import { api } from "../../lib/api-client";
import { cn } from "../../lib/utils";

export function CustomEmojiTab({
  onInsert,
  query,
  searchResultsOnly = false,
}: {
  onInsert: (token: string) => void;
  query: string;
  searchResultsOnly?: boolean;
}) {
  const { data: emojis } = useCustomEmojis();
  const upload = useUploadCustomEmoji();
  const rename = useRenameCustomEmoji();
  const remove = useDeleteCustomEmoji();
  const importEmojis = useImportCustomEmojis();
  const { list: conversationEmojis } = useConversationCustomEmojis();
  const fileRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = emojis ?? [];

  // Persona/character gallery emojis, grouped by source — read-only here (managed in their galleries).
  const bySource = new Map<string, ConversationCustomEmoji[]>();
  for (const emoji of conversationEmojis) {
    if (emoji.source === "Global") continue;
    const existing = bySource.get(emoji.source);
    if (existing) existing.push(emoji);
    else bySource.set(emoji.source, [emoji]);
  }
  const sourceGroups = [...bySource.entries()];

  // Search filter (by emoji name) over the global pool and each source group.
  const q = query.trim().toLowerCase();
  const insertableGlobalNames = new Set(
    conversationEmojis.filter((emoji) => emoji.source === "Global").map((emoji) => emoji.name),
  );
  const visibleGlobal = editing ? list : list.filter((emoji) => insertableGlobalNames.has(emoji.name));
  const filteredGlobal = filterCustomEmojisByName(visibleGlobal, q);
  const filteredGroups: [string, ConversationCustomEmoji[]][] = q
    ? sourceGroups
        .map(
          ([source, emojis]) =>
            [source, filterCustomEmojisByName(emojis, q)] as [
              string,
              ConversationCustomEmoji[],
            ],
        )
        .filter(([, emojis]) => emojis.length > 0)
    : sourceGroups;

  const handleFiles = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (files.length === 0) return;
      setError(null);

      // Name and upload each file one at a time, previewing the image in the name dialog.
      for (const file of files) {
        const objectUrl = URL.createObjectURL(file);
        try {
          const { width, height } = await readImageDimensions(objectUrl);
          const valid = validateDimensionsForKind(width, height, "emoji");
          if (!valid.ok) {
            setError(valid.reason);
            continue;
          }
          const suggested = slugifyCustomName(file.name.replace(/\.[^.]+$/, ""));
          const raw = await showPromptDialog({
            title: "Name this emoji",
            message: "Use it in messages as :name: — lowercase letters, numbers, and underscores.",
            defaultValue: suggested,
            placeholder: "e.g. kekw",
            confirmLabel: "Add",
            previewImageUrl: objectUrl,
          });
          if (raw == null) continue; // skipped this one — keep going through the rest
          const name = slugifyCustomName(raw);
          if (!name) {
            setError("Enter a valid name (letters, numbers, or underscores).");
            continue;
          }
          await upload.mutateAsync({ file, name, width, height });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to add emoji.");
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
        title: "Rename emoji",
        message: "New name (used as :name:).",
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
          title: "Delete emoji",
          message: `Delete :${name}:? Messages that already used it will show the text instead.`,
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
      const bundle = await api.post<unknown>("/custom-emojis/export", {});
      downloadJsonFile(bundle, "marinara-custom-emojis.json");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export emojis.");
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
        await importEmojis.mutateAsync(bundle);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't import that file — is it a valid emoji set?");
      }
    },
    [importEmojis],
  );

  if (searchResultsOnly && filteredGlobal.length === 0 && filteredGroups.length === 0) return null;

  return (
    <div className="px-1">
      {!searchResultsOnly && (
        <div className="mb-2 flex items-center justify-between gap-2">
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
                {list.length > 0 && (
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
      )}

      {!searchResultsOnly && showSettings && <CustomEmojiSelectionSettings />}

      {!searchResultsOnly && error && <p className="mb-2 px-1 text-[0.6875rem] text-red-400">{error}</p>}

      {filteredGlobal.length === 0 && filteredGroups.length === 0 ? (
        <p className="px-1 py-6 text-center text-[0.6875rem] text-foreground/45">
          {q ? (
            <>No custom emojis match “{query.trim()}”.</>
          ) : (
            <>
              No custom emojis yet. Upload one (max 256×256) to use it as <span className="font-mono">:name:</span>.
            </>
          )}
        </p>
      ) : (
        <>
          {filteredGlobal.length > 0 && (
            <>
              {(searchResultsOnly || filteredGroups.length > 0) && (
                <p className="mb-1 px-1 text-[0.625rem] font-semibold uppercase tracking-wide text-foreground/40">
                  {searchResultsOnly ? "Custom" : "Global"}
                </p>
              )}
              <div className="grid grid-cols-6 gap-1">
                {filteredGlobal.map((emoji) => (
                  <div key={emoji.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => (editing ? void handleRename(emoji.id, emoji.name) : onInsert(`:${emoji.name}:`))}
                      title={editing ? `Rename :${emoji.name}:` : `:${emoji.name}:`}
                      className="flex aspect-square w-full items-center justify-center rounded-md p-1 transition-transform hover:scale-110 hover:bg-foreground/10 active:scale-100"
                    >
                      <img src={emoji.url} alt={`:${emoji.name}:`} className="max-h-9 max-w-full object-contain" />
                    </button>
                    {editing && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(emoji.id, emoji.name)}
                        title={`Delete :${emoji.name}:`}
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

          {filteredGroups.map(([source, sourceEmojis]) => (
            <div key={source} className="mt-2">
              <p className="mb-1 px-1 text-[0.625rem] font-semibold uppercase tracking-wide text-foreground/40">
                {source}
              </p>
              <div className="grid grid-cols-6 gap-1">
                {sourceEmojis.map((emoji) => (
                  <div key={emoji.name} className="group relative">
                    <button
                      type="button"
                      onClick={() => onInsert(`:${emoji.name}:`)}
                      title={`:${emoji.name}: — ${source}`}
                      className="flex aspect-square w-full items-center justify-center rounded-md p-1 transition-transform hover:scale-110 hover:bg-foreground/10 active:scale-100"
                    >
                      <img src={emoji.url} alt={`:${emoji.name}:`} className="max-h-9 max-w-full object-contain" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
