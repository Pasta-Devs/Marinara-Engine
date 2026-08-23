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
import { useTranslation as useUiTranslation } from "react-i18next";

export function CustomEmojiTab({
  onInsert,
  query,
  searchResultsOnly = false,
}: {
  onInsert: (token: string) => void;
  query: string;
  searchResultsOnly?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
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
        .map(([source, emojis]) => [source, filterCustomEmojisByName(emojis, q)] as [string, ConversationCustomEmoji[]])
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
            title: localizeUi("ui.chat.customemojitab.nameThisEmoji"),
            message: localizeUi("ui.chat.customemojitab.useItInMessagesAsNameLowercaseLettersNumbers"),
            defaultValue: suggested,
            placeholder: "e.g. kekw",
            confirmLabel: localizeUi("ui.characters.metadatatab.add"),
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
    [upload, localizeUi],
  );

  const handleRename = useCallback(
    async (id: string, current: string) => {
      const raw = await showPromptDialog({
        title: localizeUi("ui.chat.customemojitab.renameEmoji"),
        message: localizeUi("ui.chat.customemojitab.newNameUsedAsName"),
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
          title: localizeUi("ui.chat.customemojitab.deleteEmoji"),
          message: localizeUi("ui.chat.customemojitab.deleteValue1MessagesThatAlreadyUsedItWillShow", { value1: name }),
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
                {list.length > 0 && (
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
      )}

      {!searchResultsOnly && showSettings && <CustomEmojiSelectionSettings />}

      {!searchResultsOnly && error && <p className="mb-2 px-1 text-[0.6875rem] text-red-400">{error}</p>}

      {filteredGlobal.length === 0 && filteredGroups.length === 0 ? (
        <p className="px-1 py-6 text-center text-[0.6875rem] text-foreground/45">
          {q ? (
            <>
              {localizeUi("ui.chat.customemojitab.noCustomEmojisMatch")}
              {query.trim()}”.
            </>
          ) : (
            <>
              {localizeUi("ui.chat.customemojitab.noCustomEmojisYetUploadOneMax256256")}{" "}
              <span className="font-mono">{localizeUi("ui.chat.customemojitab.name")}</span>.
            </>
          )}
        </p>
      ) : (
        <>
          {filteredGlobal.length > 0 && (
            <>
              {(searchResultsOnly || filteredGroups.length > 0) && (
                <p className="mb-1 px-1 text-[0.625rem] font-semibold uppercase tracking-wide text-foreground/40">
                  {searchResultsOnly
                    ? localizeUi("settings.notifications.customSound.status.custom")
                    : localizeUi("ui.lorebooks.lorebookeditor.global")}
                </p>
              )}
              <div className="grid grid-cols-6 gap-1">
                {filteredGlobal.map((emoji) => (
                  <div key={emoji.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => (editing ? void handleRename(emoji.id, emoji.name) : onInsert(`:${emoji.name}:`))}
                      title={
                        editing
                          ? localizeUi("ui.chat.customemojitab.renameValue1", { value1: emoji.name })
                          : localizeUi("ui.chat.conversationinput.value1", { value1: emoji.name })
                      }
                      className="flex aspect-square w-full items-center justify-center rounded-md p-1 transition-transform hover:scale-110 hover:bg-foreground/10 active:scale-100"
                    >
                      <img
                        src={emoji.url}
                        alt={localizeUi("ui.chat.conversationinput.value1", { value1: emoji.name })}
                        className="max-h-9 max-w-full object-contain"
                      />
                    </button>
                    {editing && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(emoji.id, emoji.name)}
                        title={localizeUi("ui.chat.customemojitab.deleteValue1", { value1: emoji.name })}
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
                      title={localizeUi("ui.chat.customemojitab.value1Value2", { value1: emoji.name, value2: source })}
                      className="flex aspect-square w-full items-center justify-center rounded-md p-1 transition-transform hover:scale-110 hover:bg-foreground/10 active:scale-100"
                    >
                      <img
                        src={emoji.url}
                        alt={localizeUi("ui.chat.conversationinput.value1", { value1: emoji.name })}
                        className="max-h-9 max-w-full object-contain"
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
  );
}
