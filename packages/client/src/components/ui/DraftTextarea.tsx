import { useEffect, useRef, useState, type TextareaHTMLAttributes } from "react";

interface DraftTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> {
  value: string;
  onCommit: (value: string) => void;
}

/**
 * Textarea that buffers keystrokes in local state and only propagates the value
 * on blur. Mirrors {@link DraftNumberInput}: typing updates local state
 * instantly so the field stays responsive even when committing the value is
 * expensive (e.g. it round-trips through a per-chat metadata mutation that
 * re-renders a large settings tree), and the draft re-seeds whenever the
 * external value changes. An in-progress edit is also flushed on unmount so
 * closing the host (e.g. the chat settings drawer) before blurring does not
 * drop typed text.
 */
export function DraftTextarea({ value, onCommit, onBlur, ...props }: DraftTextareaProps) {
  const [draft, setDraft] = useState(value);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const valueRef = useRef(value);
  valueRef.current = value;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    if (draftRef.current !== valueRef.current) onCommitRef.current(draftRef.current);
  };

  useEffect(
    () => () => {
      if (draftRef.current !== valueRef.current) onCommitRef.current(draftRef.current);
    },
    [],
  );

  return (
    <textarea
      {...props}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => {
        commit();
        onBlur?.(event);
      }}
    />
  );
}
