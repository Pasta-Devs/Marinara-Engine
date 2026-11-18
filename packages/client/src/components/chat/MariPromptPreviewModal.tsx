// #4931: synthetic "Peek Prompt" preview of a Professor Mari character/preset edit. Shows the
// assembled prompt before vs after with the change highlighted (added green, removed red). It is
// assembled on its own (default preset, no persona, no chat history), so it is a labeled preview,
// not a real chat prompt.
import { useMemo } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { UnifiedLineDiff } from "./MariUnifiedDiff";
import { Modal } from "../ui/Modal";
import { Spinner } from "../ui/Spinner";

export type MariPromptRenderSide = { messages: Array<{ role: string; content: string }> } | null;

function sideToText(side: MariPromptRenderSide): string {
  return side ? side.messages.map((message) => message.content).join("\n\n") : "";
}

export function MariPromptPreviewModal({
  title,
  loading,
  error,
  before,
  after,
  onClose,
}: {
  title: string;
  loading: boolean;
  error: boolean;
  before: MariPromptRenderSide;
  after: MariPromptRenderSide;
  onClose: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  // The word-diff is an O(m*n) LCS pass over the whole assembled prompt; memoize so it is not
  // recomputed on unrelated re-renders (e.g. while loading).
  const beforeText = useMemo(() => sideToText(before), [before]);
  const afterText = useMemo(() => sideToText(after), [after]);
  const empty = !loading && !error && !beforeText.trim() && !afterText.trim();

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      titleSlot={
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="shrink-0 text-sm font-semibold">{title}</h3>
          <span className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--secondary)]/60 px-2 py-0.5 text-[0.5625rem] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.maripromptpreviewmodal.previewBadge")}
          </span>
        </div>
      }
      width="max-w-3xl"
      layer="omnibar"
      backdrop="dark"
    >
      <p className="mb-2 text-[0.6875rem] text-[var(--muted-foreground)]">
        {localizeUi("ui.chat.maripromptpreviewmodal.explainer")}
      </p>
      {loading ? (
        <p className="flex items-center gap-2 text-[0.6875rem] text-[var(--muted-foreground)]">
          <Spinner size="sm" />
          {localizeUi("ui.chat.maripromptpreviewmodal.loading")}
        </p>
      ) : error ? (
        <p className="text-[0.6875rem] italic text-[var(--destructive)]">
          {localizeUi("ui.chat.maripromptpreviewmodal.error")}
        </p>
      ) : empty ? (
        <p className="text-[0.6875rem] italic text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.maripromptpreviewmodal.noPreview")}
        </p>
      ) : (
        <UnifiedLineDiff before={beforeText} after={afterText} className="max-h-none p-1" />
      )}
    </Modal>
  );
}
