// ──────────────────────────────────────────────
// Screen readers: "Wren Halloway is writing…" while a long reply streams (QC Nov 22 AX1)
// ──────────────────────────────────────────────
// Visually hidden and polite. It speaks only when a reply is still coming 1.5 s after it started, so a quick
// reply says just "Wren replied" (the reply announcer). Clearing it on stream end is silent. Conversation has
// its own typing line and Professor Mari her work line, so neither mounts this.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const WRITING_DELAY_MS = 1500;

export function ReplyWritingStatus({ streaming, name }: { streaming: boolean; name: string | null }) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  // Read when the line is said: a group turn names its speaker a moment after the stream starts.
  const nameRef = useRef(name);
  nameRef.current = name;
  useEffect(() => {
    if (!streaming) {
      setText("");
      return;
    }
    const timer = window.setTimeout(() => {
      const speaker = nameRef.current;
      setText(speaker ? t("chat.announce.writing", { name: speaker }) : t("chat.announce.writingGeneric"));
    }, WRITING_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [streaming, t]);
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-reply-writing-status="">
      {text}
    </div>
  );
}
