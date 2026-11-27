import type { MariDbPendingApproval, MariWorkspacePendingApproval } from "@marinara-engine/shared";
import { Check, ShieldAlert, Undo2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { changeRecordName, computeFieldChanges, describeTable, reviewRowFact } from "../../../lib/mari-edit-diff";
import { isMariReviewWaiting } from "../../../lib/professor-mari-presentation";
import { formatRelativeContact } from "../../../lib/relative-time";
import { MariSidePanelHeader } from "../MariPanelControls";

/**
 * Her Changes page: every change of this chat that is still open, so none of them is only a count in the
 * header. "Needs you" lists what waits on an answer (a held change, a delete, an install); its card in the
 * chat answers it. "Saved, Undo open" lists what she already applied: each can be undone, or kept, which
 * closes its Undo; Keep all closes them all.
 */
export function MariChangesPanel({
  reviews,
  busy,
  onClose,
  onShow,
  onAnswer,
}: {
  reviews: readonly MariWorkspacePendingApproval[];
  busy: boolean;
  onClose: () => void;
  /** Brings the review's card in her chat into view. */
  onShow: (reviewId: string) => void;
  onAnswer: (approvals: MariWorkspacePendingApproval[], keep: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "en";
  const [confirmKeepAll, setConfirmKeepAll] = useState(false);
  const newestFirst = [...reviews].sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));
  const waiting = newestFirst.filter(isMariReviewWaiting);
  const applied = newestFirst.filter((review) => !isMariReviewWaiting(review));

  const describe = (review: MariWorkspacePendingApproval) => {
    if (review.kind === "dependency_install") return { name: review.packageName, fact: review.reason ?? "" };
    if (review.kind === "sensitive_file") return { name: review.path, fact: review.reason ?? "" };
    const db = review as MariDbPendingApproval;
    const change = db.diffPreview[0];
    if (!change) return { name: db.command, fact: db.reason ?? "" };
    const name = changeRecordName(change) || describeTable(change.table);
    const fact = reviewRowFact(change, computeFieldChanges(change), t, lang);
    const more =
      db.diffPreview.length > 1 ? t("ui.chat.marichangespanel.moreRows", { count: db.diffPreview.length - 1 }) : "";
    return { name, fact: [fact, more].filter(Boolean).join(" · ") };
  };

  const row = (review: MariWorkspacePendingApproval, open: boolean) => {
    const { name, fact } = describe(review);
    const when = formatRelativeContact(review.requestedAt);
    return (
      <div key={review.id} className="mari-list__item" data-component="MariChangesPanel.Row">
        <div className="mari-row">
          <button
            type="button"
            className="mari-row__toggle"
            onClick={() => onShow(review.id)}
            title={t("ui.chat.marichangespanel.showInChat")}
          >
            <span className="mari-row__slot" aria-hidden="true">
              {open ? <Undo2 /> : <ShieldAlert />}
            </span>
            <span className="mari-row__text">
              <span className="mari-row__title">
                <span>{name}</span>
              </span>
              <span className="mari-row__fact">{[fact, when].filter(Boolean).join(" · ")}</span>
            </span>
          </button>
          {open ? (
            <span className="mari-changes__actions">
              <button
                type="button"
                className="mari-btn"
                disabled={busy}
                onClick={() => onAnswer([review], false)}
                aria-label={t("ui.chat.marichangespanel.undoNamed", { name })}
              >
                <Undo2 aria-hidden="true" />
                {t("ui.chat.mariappliededit.undo")}
              </button>
              <button
                type="button"
                className="mari-link"
                disabled={busy}
                onClick={() => onAnswer([review], true)}
                aria-label={t("ui.chat.marichangespanel.keepNamed", { name })}
              >
                <Check aria-hidden="true" />
                {t("ui.chat.marichangespanel.keep")}
              </button>
            </span>
          ) : (
            <button type="button" className="mari-link mari-changes__show" onClick={() => onShow(review.id)}>
              {t("ui.chat.marichangespanel.answer")}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <MariSidePanelHeader
        title={t("ui.chat.marichangespanel.title")}
        hint={t("ui.chat.marichangespanel.hint")}
        onClose={onClose}
        closeLabel={t("ui.chat.marichangespanel.close")}
        actions={
          applied.length > 1 ? (
            confirmKeepAll ? (
              <span className="mari-changes__confirm" role="group" aria-label={t("ui.chat.marichangespanel.keepAll")}>
                <span>{t("ui.chat.marichangespanel.keepAllConfirm", { count: applied.length })}</span>
                <button
                  type="button"
                  className="mari-btn mari-btn--solid"
                  disabled={busy}
                  onClick={() => {
                    setConfirmKeepAll(false);
                    onAnswer(applied, true);
                  }}
                >
                  {t("ui.chat.marichangespanel.keepAll")}
                </button>
                <button type="button" className="mari-link" onClick={() => setConfirmKeepAll(false)}>
                  {t("chat.delete.dialog.cancel")}
                </button>
              </span>
            ) : (
              <button type="button" className="mari-link" disabled={busy} onClick={() => setConfirmKeepAll(true)}>
                <Check size="0.8rem" aria-hidden="true" />
                {t("ui.chat.marichangespanel.keepAll")}
              </button>
            )
          ) : null
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4" data-component="MariChangesPanel">
        {reviews.length === 0 ? (
          <p className="px-3 py-3 text-xs text-[var(--muted-foreground)]">{t("ui.chat.marichangespanel.empty")}</p>
        ) : (
          <>
            {waiting.length > 0 ? (
              <section className="mari-changes__group" aria-labelledby="mari-changes-waiting">
                <h3 id="mari-changes-waiting" className="mari-changes__heading">
                  {t("ui.chat.marichangespanel.waiting", { count: waiting.length })}
                </h3>
                <div className="mari-list mari-edit--menus">{waiting.map((review) => row(review, false))}</div>
              </section>
            ) : null}
            {applied.length > 0 ? (
              <section className="mari-changes__group" aria-labelledby="mari-changes-applied">
                <h3 id="mari-changes-applied" className="mari-changes__heading">
                  {t("ui.chat.marichangespanel.applied", { count: applied.length })}
                </h3>
                <div className="mari-list mari-edit--menus">{applied.map((review) => row(review, true))}</div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
