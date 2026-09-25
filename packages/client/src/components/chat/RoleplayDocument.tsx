import { useTranslation } from "react-i18next";
import type { RoleplayCommand } from "@marinara-engine/shared";
import "../../styles/roleplay-documents.css";

const DOCUMENT_LABELS = {
  note: "roleplay.commands.document.kind.note",
  letter: "roleplay.commands.document.kind.letter",
  journal: "roleplay.commands.document.kind.journal",
  report: "roleplay.commands.document.kind.report",
  poster: "roleplay.commands.document.kind.poster",
  terminal: "roleplay.commands.document.kind.terminal",
  document: "roleplay.commands.document.kind.document",
} as const;

export function RoleplayDocument({
  document,
  styleVariant = 0,
}: {
  document: Extract<RoleplayCommand, { type: "document" }>;
  styleVariant?: number;
}) {
  const { t } = useTranslation();
  const requestedKind = typeof document.documentType === "string" ? document.documentType.trim().toLowerCase() : "";
  const kind = Object.hasOwn(DOCUMENT_LABELS, requestedKind)
    ? (requestedKind as keyof typeof DOCUMENT_LABELS)
    : "document";
  const label = t(DOCUMENT_LABELS[kind]);
  const title = document.title.trim() || label;
  const variant = Number.isInteger(styleVariant) && styleVariant >= 0 && styleVariant < 3 ? styleVariant : 0;

  return (
    <article
      aria-label={title}
      data-roleplay-document-kind={kind}
      data-roleplay-document-style={variant}
      className={`mari-roleplay-document mari-roleplay-document--${kind} mari-roleplay-document--style-${variant}`}
    >
      <header className="mari-roleplay-document-heading">
        <p className="mari-roleplay-document-kind">{label}</p>
        <h3 className="mari-roleplay-document-title">{title}</h3>
      </header>
      <div className="mari-roleplay-document-content">{document.content}</div>
    </article>
  );
}
