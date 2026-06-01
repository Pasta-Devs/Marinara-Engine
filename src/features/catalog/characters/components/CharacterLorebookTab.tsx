import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Library, Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { CharacterData } from "../../../../engine/contracts/types/character";
import { characterApi } from "../../../../shared/api/character-api";
import { cn } from "../../../../shared/lib/utils";
import { useUIStore } from "../../../../shared/stores/ui.store";
import { lorebookKeys, useLorebook } from "../../lorebooks/index";
import { characterKeys } from "../hooks/use-characters";
import { CharacterEditorSectionHeader as SectionHeader } from "./CharacterEditorSectionHeader";

export function CharacterLorebookTab({
  characterId,
  formData,
}: {
  characterId: string | null;
  formData: CharacterData;
}) {
  const book = formData.character_book;
  const entries = book?.entries ?? [];
  const queryClient = useQueryClient();
  const openLorebookDetail = useUIStore((state) => state.openLorebookDetail);
  const [importing, setImporting] = useState(false);
  const importMetadata =
    formData.extensions.importMetadata && typeof formData.extensions.importMetadata === "object"
      ? (formData.extensions.importMetadata as Record<string, unknown>)
      : {};
  const embeddedLorebookMetadata =
    importMetadata.embeddedLorebook && typeof importMetadata.embeddedLorebook === "object"
      ? (importMetadata.embeddedLorebook as Record<string, unknown>)
      : {};
  const rawLinkedLorebookId =
    typeof embeddedLorebookMetadata.lorebookId === "string" ? embeddedLorebookMetadata.lorebookId : null;
  // Verify stale embedded-lorebook pointers before showing "Edit Linked Lorebook".
  const linkedLorebookQuery = useLorebook(rawLinkedLorebookId);
  const linkedLorebookId =
    rawLinkedLorebookId && (linkedLorebookQuery.isLoading || linkedLorebookQuery.data) ? rawLinkedLorebookId : null;
  const hasEmbeddedLorebook = entries.length > 0 || embeddedLorebookMetadata.hasEmbeddedLorebook === true;

  const handleImportEmbeddedLorebook = async () => {
    if (!characterId) return;
    setImporting(true);
    try {
      const result = await characterApi.importEmbeddedLorebook(characterId);
      queryClient.invalidateQueries({ queryKey: lorebookKeys.all });
      if (result.lorebookId) {
        queryClient.invalidateQueries({ queryKey: characterKeys.detail(characterId) });
      }
      toast.success(
        result.reimported
          ? `Reimported ${result.entriesImported} embedded lorebook entr${result.entriesImported === 1 ? "y" : "ies"}`
          : `Imported ${result.entriesImported} embedded lorebook entr${result.entriesImported === 1 ? "y" : "ies"}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import embedded lorebook");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Character Lorebook"
        subtitle="World-building entries embedded in this character. Triggered by keywords in conversation."
      />

      {hasEmbeddedLorebook && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2.5">
          <button
            type="button"
            onClick={handleImportEmbeddedLorebook}
            disabled={!characterId || importing}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              importing || !characterId
                ? "cursor-not-allowed bg-[var(--accent)] text-[var(--muted-foreground)]"
                : "bg-[var(--primary)]/15 text-[var(--primary)] hover:bg-[var(--primary)]/25",
            )}
          >
            {importing ? <Loader2 size="0.75rem" className="animate-spin" /> : <Library size="0.75rem" />}
            {linkedLorebookId ? "Reimport Embedded Lorebook" : "Import Embedded Lorebook"}
          </button>
          {linkedLorebookId && (
            <button
              type="button"
              onClick={() => openLorebookDetail(linkedLorebookId)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)]/15 px-3 py-1.5 text-xs font-medium text-[var(--primary)] transition-all hover:bg-[var(--primary)]/25"
            >
              <Library size="0.75rem" />
              Edit Linked Lorebook
            </button>
          )}
          <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {linkedLorebookId
              ? "Opens the lorebook editor where you can add, edit, or delete entries."
              : "Imports this embedded lorebook into Marinara as a linked lorebook."}
          </span>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[var(--border)] py-12 text-center">
          <Library size="1.5rem" className="text-[var(--muted-foreground)]/40" />
          <div>
            <p className="text-sm font-medium text-[var(--muted-foreground)]">No lorebook entries</p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]/60">
              Import a character with an embedded lorebook, or add entries via the Lorebooks panel.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <div key={entry.id ?? index} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{entry.name || `Entry #${index + 1}`}</p>
                  <p className="mt-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                    Keys: {entry.keys.join(", ")}{" "}
                    {entry.secondary_keys.length > 0 && `· Secondary: ${entry.secondary_keys.join(", ")}`}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[0.625rem] font-medium",
                    entry.enabled
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-[var(--muted-foreground)]/15 text-[var(--muted-foreground)]",
                  )}
                >
                  {entry.enabled ? "Active" : "Disabled"}
                </span>
              </div>
              <p className="mt-2 text-xs text-[var(--muted-foreground)] line-clamp-3">{entry.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
