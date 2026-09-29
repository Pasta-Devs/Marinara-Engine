import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";
import { useMultiplayerMutation, useMultiplayerStatus } from "../../hooks/use-multiplayer";
import { useChatStore } from "../../stores/chat.store";
import { MULTIPLAYER_BUTTON_CLASS } from "./MultiplayerFields";

export function MultiplayerPrepareButton({ chatId, prepared = false }: { chatId: string; prepared?: boolean }) {
  const { t } = useTranslation();
  const status = useMultiplayerStatus();
  const prepare = useMultiplayerMutation<{ chatId: string }, { chatId: string }>("/multiplayer/prepare");
  if (prepared || !status.data?.available || !status.data.enabled) return null;
  return (
    <div className="space-y-2">
      <button
        type="button"
        className={MULTIPLAYER_BUTTON_CLASS}
        disabled={prepare.isPending}
        onClick={() =>
          prepare.mutate(
            { chatId },
            {
              onSuccess: (result) => {
                useChatStore.getState().setShouldOpenWizard(false);
                useChatStore.getState().setShouldOpenSettings(false);
                useChatStore.getState().setActiveChatId(result.chatId);
              },
            },
          )
        }
      >
        <Users size={16} />
        {t("multiplayer.playTogether")}
      </button>
      <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{t("multiplayer.freshSession")}</p>
      {prepare.isError && (
        <p role="alert" className="text-xs text-[var(--destructive)]">
          {t("multiplayer.actionFailed")}
        </p>
      )}
    </div>
  );
}
