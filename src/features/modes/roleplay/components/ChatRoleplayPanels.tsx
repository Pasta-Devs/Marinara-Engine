import { useEffect, useRef, useState } from "react";
import { PenLine, X } from "lucide-react";
import { useUpdateChatMetadata } from "../../../catalog/chats/index";

function readAuthorNotesDepth(value: unknown): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 4;
}

export function AuthorNotesPanel({
  chatId,
  chatMeta,
  isMobile,
  onClose,
}: {
  chatId: string;
  chatMeta: Record<string, unknown>;
  isMobile: boolean;
  onClose: () => void;
}) {
  const authorNotes = typeof chatMeta.authorNotes === "string" ? chatMeta.authorNotes : "";
  const authorNotesDepth = readAuthorNotesDepth(chatMeta.authorNotesDepth);
  const [notes, setNotes] = useState(authorNotes);
  const [depthStr, setDepthStr] = useState(String(authorNotesDepth));
  const updateMeta = useUpdateChatMetadata();

  const latestRef = useRef({ notes, depthStr });
  latestRef.current = { notes, depthStr };
  const baselineRef = useRef({
    notes: authorNotes,
    depth: authorNotesDepth,
  });
  const mutateRef = useRef(updateMeta.mutate);
  mutateRef.current = updateMeta.mutate;

  useEffect(() => {
    setNotes(authorNotes);
    setDepthStr(String(authorNotesDepth));
    baselineRef.current = {
      notes: authorNotes,
      depth: authorNotesDepth,
    };
  }, [authorNotes, authorNotesDepth]);

  // Outside-click closes the popover via mousedown, which unmounts the
  // textarea before its onBlur (the only save trigger) can fire. Flush
  // the pending edit from the unmount cleanup so typed content survives.
  useEffect(() => {
    const capturedChatId = chatId;
    return () => {
      const { notes: n, depthStr: d } = latestRef.current;
      const nextDepth = Math.max(0, parseInt(d, 10) || 0);
      const base = baselineRef.current;
      if (n !== base.notes || nextDepth !== base.depth) {
        mutateRef.current({ id: capturedChatId, authorNotes: n, authorNotesDepth: nextDepth });
      }
    };
  }, [chatId]);

  const depth = parseInt(depthStr, 10) || 0;
  const handleSave = () => {
    updateMeta.mutate({ id: chatId, authorNotes: notes, authorNotesDepth: depth });
  };

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
      <p className="mb-2 text-[0.625rem] text-[var(--muted-foreground)]">
        Text here is injected into the prompt at the chosen depth every generation.
      </p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={handleSave}
        placeholder="e.g. Keep the tone dark and suspenseful. The villain is secretly an ally."
        className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:ring-2 focus:ring-[var(--ring)]"
        rows={4}
      />
      <div className="mt-2 flex items-center gap-2">
        <span className="shrink-0 text-[0.625rem] text-[var(--muted-foreground)]">Injection Depth</span>
        <input
          type="text"
          inputMode="numeric"
          value={depthStr}
          onChange={(e) => setDepthStr(e.target.value.replace(/[^0-9]/g, ""))}
          onBlur={() => {
            const nextDepth = Math.max(0, parseInt(depthStr, 10) || 0);
            setDepthStr(String(nextDepth));
            updateMeta.mutate({ id: chatId, authorNotes: notes, authorNotesDepth: nextDepth });
          }}
          className="w-14 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-0.5 text-center text-[0.625rem] text-[var(--foreground)] outline-none transition-colors [appearance:textfield] focus:ring-2 focus:ring-[var(--ring)] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>
      <p className="mt-1 text-[0.5625rem] text-[var(--muted-foreground)]/60">
        Depth 0 = end of conversation, 4 = four messages from the end.
      </p>
    </>
  );
}
