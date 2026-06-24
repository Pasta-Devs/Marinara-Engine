import { useEffect, useRef, useState, type TextareaHTMLAttributes } from "react";

interface DraftTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> {
  value: string;
  onCommit: (value: string) => void;
}

/**
 * Textarea that buffers keystrokes in local state and only propagates the value
 * on blur, so the field stays responsive even when committing is expensive
 * (e.g. it round-trips through a per-chat metadata mutation that re-renders a
 * large settings tree).
 *
 * Follows the same draft/commit/focus-guard pattern as the sibling
 * `ThinkingTagsInput`/`CustomParametersInput`: the draft re-seeds from `value`
 * only while the field is unfocused, so an external write to the persisted value
 * (a background metadata refresh, a chat switch) cannot clobber keystrokes the
 * user is mid-typing. Like `DraftNumberInput` it commits on blur; it
 * additionally flushes a pending edit on unmount so closing the host (e.g. the
 * chat settings drawer) does not drop typed text.
 */
export function DraftTextarea({ value, onCommit, onFocus, onBlur, ...props }: DraftTextareaProps) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const valueRef = useRef(value);
  valueRef.current = value;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  useEffect(() => {
    if (!focused) setDraft(value);
  }, [focused, value]);

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
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        commit();
        setFocused(false);
        onBlur?.(event);
      }}
    />
  );
}
