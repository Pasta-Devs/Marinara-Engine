import { useCallback, useLayoutEffect, useRef, useState } from "react";

/** Pair each response with the editor that submitted it, including a switch away and back. */
export function useCardEditorSave(entityId: string | null) {
  const owner = useRef<object | null>(null);
  const [saving, setSaving] = useState(false);
  useLayoutEffect(() => {
    setSaving(false);
    return () => {
      owner.current = null;
    };
  }, [entityId]);

  const runSave = useCallback(
    async <Reply>(
      write: () => Promise<Reply>,
      accept: (reply: Reply) => boolean,
      reportFailure: (error: unknown) => void,
    ): Promise<boolean> => {
      if (!entityId || owner.current) return false;
      const ticket = {};
      owner.current = ticket;
      setSaving(true);
      try {
        const reply = await write();
        return owner.current === ticket && accept(reply);
      } catch (error) {
        if (owner.current === ticket) reportFailure(error);
        return false;
      } finally {
        if (owner.current === ticket) {
          owner.current = null;
          setSaving(false);
        }
      }
    },
    [entityId],
  );
  return { saving, runSave };
}
