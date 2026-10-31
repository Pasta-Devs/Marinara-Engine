// Messages waiting their turn while Professor Mari works, above her composer. Built from the same MariRow as
// her connection and reference lists. No run going, or a later send that began first, means a message is held: it
// needs your Send (or your ×). A waiting text message can go in at her next step instead (Send now).
import { isSubjectOnlyMariContext, type MariPendingMessageSummary } from "@marinara-engine/shared";
import { Clock, PauseCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MariRow } from "../mari-primitives";

export function MariPendingQueue({
  messages,
  running,
  onRemove,
  onSend,
  onSendNow,
}: {
  messages: MariPendingMessageSummary[];
  running: boolean;
  onRemove: (id: string) => void;
  onSend: (message: MariPendingMessageSummary) => void;
  onSendNow: (id: string) => void;
}) {
  const { t } = useTranslation();
  if (messages.length === 0) return null;
  return (
    <div className="mari-pending-queue mari-list" role="list" aria-label={t("mari.queue.label")}>
      {messages.map((message) => {
        const waiting = running && !message.held;
        const steering = waiting && message.steer;
        const status = t(steering ? "mari.queue.steering" : waiting ? "mari.queue.waiting" : "mari.queue.held");
        // Your words alone. The server has the last word: it also compares the subject and mode with the run.
        const canSendNow =
          waiting &&
          !message.steer &&
          message.attachments.length === 0 &&
          message.references.length === 0 &&
          (!message.context || isSubjectOnlyMariContext(message.context));
        return (
          <MariRow
            key={message.id}
            role="listitem"
            slot={waiting ? <Clock aria-hidden="true" /> : <PauseCircle aria-hidden="true" />}
            title={message.text}
            hint={message.text}
            fact={
              message.attachments.length > 0
                ? `${status} · ${t("mari.queue.attached", { count: message.attachments.length })}`
                : status
            }
            trail={
              <span className="mari-pending-queue__actions">
                {running ? null : (
                  <button type="button" className="mari-pending-queue__send" onClick={() => onSend(message)}>
                    {t("mari.queue.send")}
                  </button>
                )}
                {canSendNow ? (
                  <button type="button" className="mari-pending-queue__send" onClick={() => onSendNow(message.id)}>
                    {t("mari.queue.sendNow")}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="mari-pending-queue__remove"
                  onClick={() => onRemove(message.id)}
                  aria-label={t("mari.queue.remove")}
                  title={t("mari.queue.remove")}
                >
                  <X size="0.875rem" aria-hidden="true" />
                </button>
              </span>
            }
          />
        );
      })}
    </div>
  );
}
