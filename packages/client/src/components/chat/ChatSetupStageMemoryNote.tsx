// One quiet line on the setup stage: the setup came from the last chat with this character.
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api-client";
import { useApplyChatPreset } from "../../hooks/use-chat-presets";
import { chatKeys } from "../../hooks/use-chats";
import { useChatStore } from "../../stores/chat.store";

export function ChatSetupStageMemoryNote({ chatId }: { chatId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const applyChatPreset = useApplyChatPreset();
  const memory = useChatStore((s) => s.setupMemory);
  if (!memory || memory.chatId !== chatId) return null;

  const reset = async () => {
    const { defaults, starredProfileId } = memory;
    useChatStore.getState().setSetupMemory(null);
    try {
      const { metadata, ...fields } = defaults;
      await api.patch(`/chats/${chatId}`, fields);
      await api.patch(`/chats/${chatId}/metadata`, metadata);
      if (starredProfileId) await applyChatPreset.mutateAsync({ presetId: starredProfileId, chatId });
    } catch {
      /* non-fatal: the stage editors still show what the chat holds */
    }
    void qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
    void qc.invalidateQueries({ queryKey: chatKeys.list() });
  };

  return (
    <p className="mt-2 text-xs text-[var(--muted-foreground)]">
      {t("chat.setupStage.memory.note", { name: memory.sourceName })}{" "}
      <button
        type="button"
        onClick={() => void reset()}
        className="underline underline-offset-2 hover:text-[var(--foreground)] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        {t("chat.setupStage.memory.reset")}
      </button>
    </p>
  );
}
