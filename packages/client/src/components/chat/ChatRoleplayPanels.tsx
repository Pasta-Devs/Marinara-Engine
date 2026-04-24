import { useEffect, useState } from "react";
import { Globe, Loader2, PenLine, Save, X } from "lucide-react";
import { useUpdateChatMetadata } from "../../hooks/use-chats";
import { useActiveLorebookEntries } from "../../hooks/use-lorebooks";

function WorldInfoEntryRow({
  entry,
}: {
  entry: { name: string; keys: string[]; content: string; constant: boolean; order: number };
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="cursor-pointer rounded-lg bg-[var(--secondary)] p-2 text-xs transition-colors hover:bg-[var(--accent)]"
      onClick={() => setExpanded((prev) => !prev)}
    >
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
        <span className="truncate font-medium text-[var(--foreground)]/80">{entry.name}</span>
        {entry.constant && (
          <span className="shrink-0 rounded bg-amber-400/15 px-1 py-0.5 text-[0.5rem] font-medium text-amber-400">
            CONST
          </span>
        )}
        <span className="ml-auto shrink-0 text-[0.625rem] text-[var(--muted-foreground)]">#{entry.order}</span>
      </div>
      {entry.keys.length > 0 && (
        <p className="mt-0.5 truncate text-[0.625rem] text-[var(--muted-foreground)]">
          Keys: {entry.keys.slice(0, 5).join(", ")}
          {entry.keys.length > 5 && ` +${entry.keys.length - 5}`}
        </p>
      )}
      {expanded && (
        <p className="mt-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap border-t border-[var(--border)] pt-1.5 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
          {entry.content || "(empty)"}
        </p>
      )}
    </div>
  );
}

export function WorldInfoPanel({
  chatId,
  isMobile,
  onClose,
}: {
  chatId: string;
  isMobile: boolean;
  onClose: () => void;
}) {
  const { data, isLoading } = useActiveLorebookEntries(chatId, true);
  const entries = data?.entries ?? [];

  return (
    <>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
        <Globe size="0.75rem" />
        Active World Info
        {isMobile && (
          <button
            onClick={onClose}
            className="ml-auto rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          >
            <X size="0.75rem" />
          </button>
        )}
      </h3>
      {isLoading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-[var(--muted-foreground)]">
          <Loader2 size="0.75rem" className="animate-spin" />
          Scanning entries...
        </div>
      ) : entries.length === 0 ? (
        <p className="py-3 text-center text-xs text-[var(--muted-foreground)]">No active entries for this chat</p>
      ) : (
        <>
          <p className="mb-2 text-[0.625rem] text-[var(--muted-foreground)]">
            {entries.length} active • ~{(data?.totalTokens ?? 0).toLocaleString()} tokens
          </p>
          <div className="space-y-1.5">
            {entries.map((entry) => (
              <WorldInfoEntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function AuthorNotesPanel({
  chatId,
  chatMeta,
  onClose,
}: {
  chatId: string;
  chatMeta: Record<string, any>;
  onClose: () => void;
}) {
  const propsNotes = (chatMeta.authorNotes as string) ?? "";
  const propsDepth = (chatMeta.authorNotesDepth as number) ?? 4;

  const [notes, setNotes] = useState(propsNotes);
  const [depthStr, setDepthStr] = useState(String(propsDepth));
  const updateMeta = useUpdateChatMetadata();

  const depth = parseInt(depthStr, 10) || 0;

  const isDirty = notes !== propsNotes || depth !== propsDepth;

  // Sync draft from props only when NOT dirty — lets external edits land on
  // first view while respecting pending user edits. Use Cancel to discard
  // local edits and pick up the server value.
  useEffect(() => {
    if (isDirty) return;
    setNotes(propsNotes);
    setDepthStr(String(propsDepth));
    // isDirty intentionally excluded — effect runs on external prop changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propsNotes, propsDepth]);

  const handleSave = () => {
    if (!isDirty) return;
    updateMeta.mutate(
      { id: chatId, authorNotes: notes, authorNotesDepth: depth },
      {
        onSuccess: () => onClose(),
      },
    );
  };

  const handleCancel = () => {
    setNotes(propsNotes);
    setDepthStr(String(propsDepth));
    onClose();
  };

  const saveDisabled = !isDirty || updateMeta.isPending;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="author-notes-text" className="text-xs font-medium text-[var(--foreground)]">
            Notes
            {isDirty && (
              <span className="ml-2 text-[0.625rem] font-normal text-[var(--muted-foreground)]">· unsaved changes</span>
            )}
          </label>
        </div>
        <textarea
          id="author-notes-text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Keep the tone dark and suspenseful. The villain is secretly an ally."
          className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:ring-2 focus:ring-[var(--ring)]"
          rows={6}
        />
        <p className="text-[0.625rem] text-[var(--muted-foreground)]/70">
          Injected into the prompt at the chosen depth every generation.
        </p>
        <div className="flex items-center gap-2 pt-1">
          <span className="shrink-0 text-[0.6875rem] text-[var(--muted-foreground)]">Injection Depth</span>
          <input
            type="text"
            inputMode="numeric"
            value={depthStr}
            onChange={(e) => setDepthStr(e.target.value.replace(/[^0-9]/g, ""))}
            onBlur={() => {
              const nextDepth = Math.max(0, parseInt(depthStr, 10) || 0);
              setDepthStr(String(nextDepth));
            }}
            className="w-16 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-center text-xs text-[var(--foreground)] outline-none transition-colors [appearance:textfield] focus:ring-2 focus:ring-[var(--ring)] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-[0.625rem] text-[var(--muted-foreground)]/70">
            0 = end of conversation, 4 = four messages from the end.
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1.5 border-t border-[var(--border)]/40 pt-3">
        <button
          onClick={handleCancel}
          className="rounded-lg px-2.5 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saveDisabled}
          className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-1 text-[0.625rem] font-medium text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:active:scale-100"
        >
          {updateMeta.isPending ? (
            <Loader2 size="0.625rem" className="animate-spin" />
          ) : (
            <Save size="0.625rem" />
          )}
          Save
        </button>
      </div>
    </div>
  );
}

/** Read-only preview of Author's Notes. Hands off to AuthorNotesPanel for edits. */
export function AuthorNotesPeek({
  chatMeta,
  isMobile,
  onEdit,
  onClose,
}: {
  chatMeta: Record<string, any>;
  isMobile: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const notes = String(chatMeta.authorNotes ?? "").trim();
  const depth = (chatMeta.authorNotesDepth as number) ?? 4;

  return (
    <>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
        <PenLine size="0.75rem" />
        Author's Notes
        {isMobile && (
          <button
            onClick={onClose}
            className="ml-auto rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          >
            <X size="0.75rem" />
          </button>
        )}
      </h3>
      {notes ? (
        <>
          <div className="mb-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-[var(--secondary)] px-2.5 py-2 text-xs leading-relaxed text-[var(--foreground)]/90">
            {notes}
          </div>
          <p className="mb-2 text-[0.625rem] text-[var(--muted-foreground)]">
            Injected at depth {depth} every generation.
          </p>
        </>
      ) : (
        <p className="mb-2 rounded-lg bg-[var(--secondary)]/50 py-4 text-center text-xs italic text-[var(--muted-foreground)]">
          No Author's Notes yet.
        </p>
      )}
      <div className="flex justify-end border-t border-[var(--border)]/40 pt-2">
        <button
          onClick={onEdit}
          className="flex items-center gap-1 rounded-md px-2.5 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
        >
          <PenLine size="0.625rem" />
          Edit
        </button>
      </div>
    </>
  );
}
