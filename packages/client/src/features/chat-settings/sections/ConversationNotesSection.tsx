import { useTranslation as useUiTranslation } from "react-i18next";
import { useChatNotes, useDeleteChatNote, useClearChatNotes } from "../../../hooks/use-chats";
import { useMemo } from "react";
import type { ConversationNote } from "@marinara-engine/shared";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { ChatSettingsSection as Section } from "../ChatSettingsSection";
import { StickyNote, Trash2 } from "lucide-react";
import { formatMemoryDate } from "../lib/memory-format";

export function ConversationNotesSection({ chatId }: { chatId: string }) {
  const { t: localizeUi } = useUiTranslation();
  const notesQuery = useChatNotes(chatId);
  const deleteNote = useDeleteChatNote(chatId);
  const clearNotes = useClearChatNotes(chatId);
  const notes = useMemo<ConversationNote[]>(() => notesQuery.data ?? [], [notesQuery.data]);
  const totalChars = useMemo(() => notes.reduce((acc, n) => acc + n.content.length, 0), [notes]);

  const handleDelete = async (note: ConversationNote) => {
    const ok = await showConfirmDialog({
      title: localizeUi("ui.chat.conversationnotessection.deleteNote"),
      message: localizeUi("ui.chat.conversationnotessection.removeThisNoteFromTheConnectedRoleplaySPrompt"),
      confirmLabel: localizeUi("lorebook.editor.batch.delete"),
      tone: "destructive",
    });
    if (ok) deleteNote.mutate(note.id);
  };

  const handleClear = async () => {
    if (notes.length === 0) return;
    const ok = await showConfirmDialog({
      title: localizeUi("ui.chat.conversationnotessection.clearAllNotes_d00f211"),
      message: localizeUi("ui.chat.conversationnotessection.removeEveryDurableNoteFromThisRoleplayThisCannot"),
      confirmLabel: localizeUi("ui.chat.roleplayhudactionsmenu.clearAll"),
      tone: "destructive",
    });
    if (ok) clearNotes.mutate();
  };

  return (
    <Section
      id="conversation-notes"
      label={localizeUi("ui.chat.conversationnotessection.conversationNotes")}
      icon={<StickyNote size="0.875rem" />}
      count={notes.length}
      help={localizeUi("ui.chat.conversationnotessection.durableNotesTheConnectedConversationSCharacterHasSaved")}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-[0.625rem] text-[var(--muted-foreground)]">
          <span>
            {notesQuery.isLoading
              ? localizeUi("ui.panels.ttsconfigcard.loading")
              : notesQuery.error
                ? localizeUi("ui.chat.conversationnotessection.failedToLoad")
                : notes.length === 0
                  ? localizeUi("ui.chat.conversationnotessection.noNotesSavedYet")
                  : localizeUi("ui.chat.conversationnotessection.value1Value2Value3Chars", {
                      value1: notes.length,
                      value2:
                        notes.length === 1
                          ? localizeUi("ui.chat.conversationnotessection.note")
                          : localizeUi("ui.chat.conversationnotessection.notes"),
                      value3: totalChars.toLocaleString(),
                    })}
          </span>
          {notes.length > 0 && !notesQuery.isLoading && !notesQuery.error && (
            <button
              type="button"
              onClick={handleClear}
              disabled={clearNotes.isPending}
              className="rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)] disabled:opacity-40"
              title={localizeUi("ui.chat.conversationnotessection.clearAllNotes")}
            >
              <Trash2 size="0.75rem" />
            </button>
          )}
        </div>

        {notesQuery.isLoading ? (
          <p className="rounded-lg bg-[var(--secondary)]/50 px-3 py-3 text-center text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.conversationnotessection.loadingNotes")}
          </p>
        ) : notesQuery.error ? (
          <p className="rounded-lg bg-[var(--destructive)]/10 px-3 py-3 text-[0.625rem] leading-relaxed text-[var(--destructive)] ring-1 ring-[var(--destructive)]/25">
            {localizeUi("ui.chat.conversationnotessection.failedToLoadNotes")}
          </p>
        ) : notes.length === 0 ? (
          <p className="rounded-lg bg-[var(--secondary)]/50 px-3 py-3 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.conversationnotessection.charactersInTheConnectedConversationCanSaveThingsThey")}{" "}
            <code className="rounded bg-[var(--accent)]/60 px-1">{"<note>...</note>"}</code>
            {localizeUi("ui.chat.conversationnotessection.savedNotesWillAppearHere")}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {notes.map((note) => (
              <li
                key={note.id}
                className="flex items-start gap-2 rounded-lg bg-[var(--card)] px-2.5 py-2 ring-1 ring-[var(--border)]"
              >
                <div className="flex-1 min-w-0">
                  <p className="whitespace-pre-wrap break-words text-[0.6875rem] leading-relaxed text-[var(--foreground)]">
                    {note.content}
                  </p>
                  <p className="mt-1 text-[0.5625rem] text-[var(--muted-foreground)]">
                    {formatMemoryDate(note.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(note)}
                  disabled={deleteNote.isPending}
                  className="shrink-0 rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)] disabled:opacity-40"
                  title={localizeUi("ui.chat.conversationnotessection.deleteThisNote")}
                >
                  <Trash2 size="0.6875rem" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
