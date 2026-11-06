import { useCallback, useLayoutEffect, useRef, useState } from "react";

type SaveOutcome = "saved" | "edited" | "failed";

/** Pair each response with the editor that submitted it, including a switch away and back. */
export function useCardEditorSave(entityId: string | null) {
  const pendingSave = useRef<Promise<SaveOutcome> | null>(null);
  const [saving, setSaving] = useState(false);
  useLayoutEffect(() => {
    setSaving(false);
    return () => {
      pendingSave.current = null;
    };
  }, [entityId]);

  const runSave = useCallback(
    async <Reply>(
      write: () => Promise<Reply>,
      accept: (reply: Reply) => boolean,
      reportFailure: (error: unknown) => void,
    ): Promise<boolean> => {
      if (!entityId || pendingSave.current) return false;
      setSaving(true);
      const pending: Promise<SaveOutcome> = Promise.resolve()
        .then(write)
        .then((reply): SaveOutcome => {
          if (pendingSave.current !== pending) return "failed";
          return accept(reply) ? "saved" : "edited";
        })
        .catch((error): SaveOutcome => {
          if (pendingSave.current === pending) reportFailure(error);
          return "failed";
        })
        .finally(() => {
          if (pendingSave.current === pending) {
            pendingSave.current = null;
            setSaving(false);
          }
        });
      pendingSave.current = pending;
      return (await pending) === "saved";
    },
    [entityId],
  );
  return { saving, runSave, pendingSave };
}
