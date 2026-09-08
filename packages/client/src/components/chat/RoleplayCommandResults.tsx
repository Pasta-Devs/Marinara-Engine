import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";

export function RoleplayCommandResults({ documents, attachments }: { documents: unknown; attachments: unknown }) {
  const { t } = useTranslation();
  // Message extras can also come from imported chats and older swipes.
  const pages = Array.isArray(documents)
    ? documents.filter((page) => page && typeof page.title === "string" && typeof page.content === "string")
    : [];
  const sounds = Array.isArray(attachments)
    ? attachments.filter(
        (attachment) =>
          attachment?.roleplaySound === true &&
          typeof attachment.name === "string" &&
          typeof attachment.url === "string" &&
          attachment.url.startsWith("/api/game-assets/file/sfx/"),
      )
    : [];
  if (!pages.length && !sounds.length) return null;
  return (
    <div className="mt-3 space-y-3" data-roleplay-command-results>
      {pages.map((page, index) => (
        <details
          key={index}
          className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]/80"
        >
          <summary
            className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-[var(--primary)]"
            aria-label={t("roleplay.commands.document.open", { title: page.title })}
          >
            <FileText size="0.875rem" className="mr-2 inline-block text-[var(--primary)]" aria-hidden />
            {page.title}
          </summary>
          <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words border-t border-[var(--border)] px-4 py-4 text-sm leading-relaxed">
            {page.content}
          </div>
        </details>
      ))}
      {sounds.map((sound, index) => (
        <figure key={index} className="space-y-1">
          <figcaption className="text-xs text-[var(--muted-foreground)]">{sound.name}</figcaption>
          <audio
            controls
            preload="none"
            src={sound.url}
            className="w-full max-w-full"
            aria-label={t("roleplay.commands.sound.play")}
          />
        </figure>
      ))}
    </div>
  );
}
