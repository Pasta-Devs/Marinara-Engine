import { useState } from "react";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getRoleplayCommandActivity, type RoleplayCommandActivity } from "@marinara-engine/shared";
import { useUpdateMessageExtra } from "../../hooks/use-chats";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { ExpandedTextarea } from "../ui/ExpandedTextarea";
import { RoleplayDocument } from "./RoleplayDocument";

const actionClass =
  "min-h-11 rounded-lg px-3 text-sm text-[var(--primary)] hover:bg-[var(--primary)]/10 focus-visible:outline focus-visible:outline-[var(--primary)] disabled:opacity-40";

function CommandNotice({
  item,
  characterName,
  soundUrl,
  pending,
  update,
}: {
  item: RoleplayCommandActivity;
  characterName: string;
  soundUrl?: string;
  pending: boolean;
  update: (item: RoleplayCommandActivity) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const { command } = item;
  const content =
    (command.type === "notes" || command.type === "memory" || command.type === "document") &&
    typeof command.content === "string"
      ? command.content
      : null;
  const limit = command.type === "memory" ? 1000 : command.type === "notes" ? 8000 : 16000;
  const save = async (next: RoleplayCommandActivity) => {
    setError("");
    try {
      await update(next);
      setEditing(false);
    } catch {
      setError(t("roleplay.commands.activity.saveFailed"));
    }
  };
  return (
    <div className="min-w-0 space-y-2 whitespace-normal" data-roleplay-command={command.type}>
      {!item.deleted &&
        !item.error &&
        command.type === "document" &&
        typeof command.title === "string" &&
        content !== null && <RoleplayDocument document={command} />}
      <div className="overflow-hidden rounded-lg border border-[var(--primary)]/20">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-h-11 w-full items-center gap-2 px-3 py-3 text-left text-sm text-[var(--primary)] focus-visible:outline focus-visible:outline-[var(--primary)]"
        >
          <ChevronDown size="1rem" aria-hidden className={`shrink-0 ${open ? "rotate-180" : ""}`} />
          <span className="min-w-0 break-words">
            {t("roleplay.commands.activity.used", { character: characterName, command: command.type })}
          </span>
        </button>
        {open && (
          <div className="space-y-3 border-t border-[var(--primary)]/20 px-3 py-3 text-sm">
            {item.deleted ? (
              <p>{t("roleplay.commands.activity.deleted")}</p>
            ) : (
              content !== null && (
                <div>
                  {command.type !== "document" && (
                    <>
                      <p className="mb-1 font-medium">{t("roleplay.commands.activity.context")}</p>
                      <div className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words">{content}</div>
                    </>
                  )}
                  {!item.error && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button
                        type="button"
                        className={actionClass}
                        disabled={pending}
                        onClick={() => {
                          setDraft(content);
                          setEditing(true);
                        }}
                      >
                        <Pencil size="0.875rem" aria-hidden className="mr-1 inline" />
                        {t("roleplay.commands.activity.edit")}
                      </button>
                      <button
                        type="button"
                        className={actionClass}
                        disabled={pending}
                        onClick={async () => {
                          if (
                            await showConfirmDialog({
                              title: t("roleplay.commands.activity.deleteTitle"),
                              message: t("roleplay.commands.activity.deleteDescription"),
                              confirmLabel: t("roleplay.commands.activity.delete"),
                              cancelLabel: t("roleplay.commands.activity.cancel"),
                            })
                          )
                            await save({ ...item, deleted: true });
                        }}
                      >
                        <Trash2 size="0.875rem" aria-hidden className="mr-1 inline" />
                        {t("roleplay.commands.activity.delete")}
                      </button>
                    </div>
                  )}
                </div>
              )
            )}
            <div>
              <p className="mb-1 font-medium">{t("roleplay.commands.activity.original")}</p>
              <pre className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs">
                {item.raw}
              </pre>
            </div>
            {item.result && (
              <div>
                <p className="mb-1 font-medium">{t("roleplay.commands.activity.result")}</p>
                <pre className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs">
                  {item.result}
                </pre>
              </div>
            )}
            {item.error && <p>{t("roleplay.commands.failed", { error: item.error })}</p>}
            {soundUrl && (
              <audio
                controls
                preload="none"
                src={soundUrl}
                className="w-full max-w-full"
                aria-label={t("roleplay.commands.sound.play")}
              />
            )}
            {error && <p role="alert">{error}</p>}
          </div>
        )}
      </div>
      {editing && (
        <ExpandedTextarea
          open
          onClose={() => setEditing(false)}
          title={t("roleplay.commands.activity.editTitle")}
          value={draft}
          onChange={setDraft}
          closeLabel={t("roleplay.commands.activity.cancel")}
          footer={
            <div className="flex flex-wrap items-center justify-end gap-2 pb-[var(--mari-safe-area-inset-bottom,env(safe-area-inset-bottom))]">
              {error && (
                <p role="alert" className="mr-auto text-sm">
                  {error}
                </p>
              )}
              {draft.length > limit && (
                <p role="alert" className="mr-auto text-sm">
                  {t("roleplay.commands.activity.tooLong", { limit })}
                </p>
              )}
              <button type="button" className={actionClass} disabled={pending} onClick={() => setEditing(false)}>
                {t("roleplay.commands.activity.cancel")}
              </button>
              <button
                type="button"
                className={actionClass}
                disabled={pending || !draft.trim() || draft.length > limit}
                onClick={() => {
                  if (content !== null)
                    void save({ ...item, command: { ...command, content: draft } as typeof command });
                }}
              >
                {t("roleplay.commands.activity.save")}
              </button>
            </div>
          }
        />
      )}
    </div>
  );
}

export function RoleplayCommandResults({
  chatId,
  messageId,
  swipeIndex,
  characterName,
  extra,
  isStreaming,
}: {
  chatId: string;
  messageId: string;
  swipeIndex: number;
  characterName: string;
  extra: Record<string, unknown>;
  isStreaming: boolean;
}) {
  const { t } = useTranslation();
  const mutation = useUpdateMessageExtra(chatId);
  const activity = getRoleplayCommandActivity(extra);
  const sounds = Array.isArray(extra.attachments)
    ? extra.attachments.filter(
        (attachment) =>
          attachment?.roleplaySound === true &&
          typeof attachment.name === "string" &&
          typeof attachment.url === "string" &&
          attachment.url.startsWith("/api/game-assets/file/sfx/"),
      )
    : [];
  if (!activity.length && !sounds.length) return null;
  return (
    <div className="mt-3 space-y-2" data-roleplay-command-results onDoubleClick={(event) => event.stopPropagation()}>
      {activity.map((item, index) => (
        <CommandNotice
          key={`${messageId}:${swipeIndex}:${index}`}
          item={item}
          characterName={characterName}
          pending={isStreaming || mutation.isPending}
          soundUrl={
            item.command.type === "sound"
              ? sounds.find((sound) => sound.name === (item.command as { description: string }).description)?.url
              : undefined
          }
          update={(next) =>
            mutation.mutateAsync({
              messageId,
              swipeIndex,
              extra: {
                roleplayCommandActivity: activity.map((record, i) => (i === index ? next : record)),
                roleplayPrivateCommands: null,
                roleplayDocuments: null,
              },
            })
          }
        />
      ))}
      {!activity.some((item) => item.command.type === "sound") &&
        sounds.map((sound, index) => (
          <audio
            key={index}
            controls
            preload="none"
            src={sound.url}
            className="w-full max-w-full"
            aria-label={t("roleplay.commands.sound.play")}
          />
        ))}
    </div>
  );
}
