import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Clapperboard, Loader2 } from "lucide-react";
import type { ConversationSceneRequest } from "@marinara-engine/shared";
import { chatKeys } from "../../hooks/use-chats";
import { startSceneWithPromptPreferences } from "../../lib/scene-generation";

export function ConversationSceneInvitation({
  chatId,
  request,
}: {
  chatId: string;
  request: ConversationSceneRequest;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);

  const open = async () => {
    if (pending) return;
    setPending(true);
    try {
      await startSceneWithPromptPreferences({
        ...request,
        chatId,
        onCreated: () => void qc.invalidateQueries({ queryKey: chatKeys.all }),
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-2 flex max-w-full flex-wrap items-center gap-2 px-3 text-xs">
      <span className="text-[var(--muted-foreground)]">
        {t("chat.sceneInvitation.description", {
          name: request.initiatorCharName || t("chat.sceneInvitation.character"),
        })}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => void open()}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-[var(--primary)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-2 focus-visible:outline-[var(--primary)] disabled:opacity-60"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Clapperboard size={16} />}
        {t(pending ? "chat.sceneInvitation.pending" : "chat.sceneInvitation.open")}
      </button>
    </div>
  );
}
