import { useState } from "react";
import { toast } from "sonner";
import { History, Loader2, RotateCcw, Trash2 } from "lucide-react";

import type { CharacterCardVersion, CharacterData } from "../../../../engine/contracts/types/character";
import { Modal } from "../../../../shared/components/ui/Modal";
import { showConfirmDialog } from "../../../../shared/lib/app-dialogs";
import { useCharacterVersions, useDeleteCharacterVersion, useRestoreCharacterVersion } from "../hooks/use-characters";
import {
  VERSION_COMPARE_FIELDS,
  formatVersionTimestamp,
  getVersionFieldValue,
  getVersionTitle,
} from "../lib/character-editor-model";

export function CharacterVersionHistoryPanel({
  characterId,
  currentData,
  currentComment,
  currentAvatarPath,
}: {
  characterId: string | null;
  currentData: CharacterData;
  currentComment: string;
  currentAvatarPath: string | null;
}) {
  const { data: versions = [], isLoading } = useCharacterVersions(characterId);
  const restoreVersion = useRestoreCharacterVersion();
  const deleteVersion = useDeleteCharacterVersion();
  const [selectedVersion, setSelectedVersion] = useState<CharacterCardVersion | null>(null);

  if (!characterId) return null;

  const handleRestore = async (version: CharacterCardVersion) => {
    const confirmed = await showConfirmDialog({
      title: "Restore Character Version",
      message: `Restore ${currentData.name || "this character"} to ${getVersionTitle(version)}? The current card will become exactly that saved version without creating another history entry.`,
      confirmLabel: "Restore",
    });
    if (!confirmed) return;
    try {
      await restoreVersion.mutateAsync({ id: characterId, versionId: version.id });
      toast.success(`Restored ${getVersionTitle(version)}.`);
      setSelectedVersion(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore character version.");
    }
  };

  const handleDeleteVersion = async (version: CharacterCardVersion) => {
    const confirmed = await showConfirmDialog({
      title: "Delete Saved Version",
      message: `Delete ${getVersionTitle(version)} from version history? This does not change the current character card.`,
      confirmLabel: "Delete",
      tone: "destructive",
    });
    if (!confirmed) return;
    try {
      await deleteVersion.mutateAsync({ id: characterId, versionId: version.id });
      toast.success(`Deleted ${getVersionTitle(version)}.`);
      setSelectedVersion((current) => (current?.id === version.id ? null : current));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete character version.");
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/70 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
          <History size="0.75rem" />
          Version history
        </span>
        <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
          {isLoading ? "Loading" : `${versions.length} saved`}
        </span>
      </div>

      {versions.length === 0 ? (
        <p className="mt-2 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
          Previous card states will appear here after the next edit.
        </p>
      ) : (
        <div className="mt-2 flex max-h-36 flex-col gap-1.5 overflow-y-auto pr-1">
          {versions.map((version) => (
            <div
              key={version.id}
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5"
            >
              <button
                type="button"
                onClick={() => setSelectedVersion(version)}
                className="min-w-0 flex-1 text-left"
                title="Compare with current card"
              >
                <span className="block truncate text-[0.6875rem] font-medium text-[var(--foreground)]">
                  {getVersionTitle(version)}
                </span>
                <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                  {formatVersionTimestamp(version.createdAt)}
                  {version.source ? ` · ${version.source}` : ""}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleRestore(version)}
                disabled={restoreVersion.isPending || deleteVersion.isPending}
                className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
                title="Restore this version"
              >
                {restoreVersion.isPending ? (
                  <Loader2 size="0.75rem" className="animate-spin" />
                ) : (
                  <RotateCcw size="0.75rem" />
                )}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteVersion(version)}
                disabled={restoreVersion.isPending || deleteVersion.isPending}
                className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)] disabled:opacity-50"
                title="Delete this saved version"
              >
                {deleteVersion.isPending && deleteVersion.variables?.versionId === version.id ? (
                  <Loader2 size="0.75rem" className="animate-spin" />
                ) : (
                  <Trash2 size="0.75rem" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!selectedVersion}
        onClose={() => setSelectedVersion(null)}
        title={selectedVersion ? `Compare ${getVersionTitle(selectedVersion)}` : "Compare Version"}
        width="max-w-5xl"
      >
        {selectedVersion && (
          <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto">
            <div className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3 text-xs md:grid-cols-2">
              <div>
                <p className="font-semibold text-[var(--foreground)]">Current card</p>
                <p className="mt-1 text-[var(--muted-foreground)]">
                  v{currentData.character_version || "1.0"}
                  {currentComment ? ` · ${currentComment}` : ""}
                  {currentAvatarPath ? " · has avatar" : ""}
                </p>
              </div>
              <div>
                <p className="font-semibold text-[var(--foreground)]">{getVersionTitle(selectedVersion)}</p>
                <p className="mt-1 text-[var(--muted-foreground)]">
                  {formatVersionTimestamp(selectedVersion.createdAt)}
                  {selectedVersion.reason ? ` · ${selectedVersion.reason}` : ""}
                  {selectedVersion.avatarPath ? " · has avatar" : ""}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {VERSION_COMPARE_FIELDS.map((field) => {
                const currentValue = getVersionFieldValue(currentData, field.key);
                const savedValue = getVersionFieldValue(selectedVersion.data, field.key);
                const changed = currentValue !== savedValue;
                if (!changed && !currentValue && !savedValue) return null;
                return (
                  <div key={field.key} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--foreground)]">{field.label}</span>
                      {changed && (
                        <span className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[0.625rem] font-medium text-[var(--primary)]">
                          changed
                        </span>
                      )}
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="min-h-20 whitespace-pre-wrap rounded-lg bg-[var(--secondary)] p-2 text-xs leading-relaxed text-[var(--foreground)]">
                        {currentValue || <span className="text-[var(--muted-foreground)]">Empty</span>}
                      </div>
                      <div className="min-h-20 whitespace-pre-wrap rounded-lg bg-[var(--secondary)] p-2 text-xs leading-relaxed text-[var(--foreground)]">
                        {savedValue || <span className="text-[var(--muted-foreground)]">Empty</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end border-t border-[var(--border)] pt-3">
              <button
                type="button"
                onClick={() => handleRestore(selectedVersion)}
                disabled={restoreVersion.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {restoreVersion.isPending ? (
                  <Loader2 size="0.75rem" className="animate-spin" />
                ) : (
                  <RotateCcw size="0.75rem" />
                )}
                Restore this version
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
