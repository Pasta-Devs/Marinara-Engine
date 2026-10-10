// R2: the quiet line under a reply that went wrong ("Cut off · Check"), modeled on N1's
// "Failed · Retry", and the findings it opens. Facts come from diagnoseReply, no model call.
import { useEffect, useId, useRef } from "react";
import { CircleAlert, Eye, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { REPLY_CHECKUP_LINE_CODES, type ReplyCheckupFinding, type ReplyCheckupLink } from "@marinara-engine/shared";
import {
  replyCheckupFact,
  replyCheckupLabel,
  replyCheckupLinkLabel,
  replyCheckupRow,
  replyLineFindings,
} from "../../lib/reply-checkup";
import { MariList, MariRow } from "./mari-primitives";

interface ReplyCheckupProps {
  messageId: string;
  findings: ReplyCheckupFinding[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLink: (link: ReplyCheckupLink) => void;
  onPeek: () => void;
}

export function ReplyCheckup({ messageId, findings, open, onOpenChange, onLink, onPeek }: ReplyCheckupProps) {
  const { t } = useTranslation();
  const panelId = `reply-checkup-${useId().replace(/:/gu, "")}`;
  const lead = replyLineFindings(findings)[0];
  const panelRef = useRef<HTMLDivElement | null>(null);
  // F6: nothing scrolled the opened panel into view, so its rows could land under the composer.
  useEffect(() => {
    if (!open) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panelRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "nearest" });
  }, [open]);
  if (!lead) return null;
  return (
    <div className="mari-reply-checkup" data-reply-checkup={messageId}>
      <p className="mari-send-failed">
        <Info size="0.8rem" aria-hidden="true" />
        <span className="mari-send-failed__text">{replyCheckupLabel(lead, t)}</span>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          className="mari-link"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onOpenChange(!open)}
        >
          {t("chat.replyCheckup.check", "Check")}
        </button>
      </p>
      {/* R10: opened, the findings are rows of one group; a row goes to the setting it names. */}
      {open && (
        <div ref={panelRef} className="mari-reply-checkup__panel">
          <MariList id={panelId} data-cards="checkup">
            {findings.map((finding) => {
              const { title, why } = replyCheckupRow(finding, t);
              const Icon = REPLY_CHECKUP_LINE_CODES.includes(finding.code) ? CircleAlert : Info;
              const link = finding.link;
              return (
                <MariRow
                  key={finding.code}
                  slot={<Icon />}
                  title={title}
                  fact={[why, link ? replyCheckupLinkLabel(link, t) : null].filter(Boolean).join(" · ")}
                  trail={link ? "open" : undefined}
                  onClick={link ? () => onLink(link) : undefined}
                />
              );
            })}
            <MariRow
              slot={<Eye />}
              title={t("chat.replyCheckup.peek", "Peek at the prompt")}
              fact={t("chat.replyCheckup.peekFact", "See exactly what was sent")}
              trail="open"
              onClick={onPeek}
            />
          </MariList>
        </div>
      )}
    </div>
  );
}

/** The facts list, for the Peek header. */
export function ReplyCheckupFacts({
  findings,
  onLink,
}: {
  findings: readonly ReplyCheckupFinding[];
  onLink?: (link: ReplyCheckupLink) => void;
}) {
  const { t } = useTranslation();
  return (
    <ul className="mari-reply-checkup__facts">
      {findings.map((finding) => (
        <li key={finding.code}>
          {replyCheckupFact(finding, t)}
          {finding.link && onLink && (
            <>
              {" "}
              <button type="button" className="mari-link" onClick={() => onLink(finding.link!)}>
                {replyCheckupLinkLabel(finding.link, t)}
              </button>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
