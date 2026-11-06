import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { Chat } from "@marinara-engine/shared";
import { useChat, useUpdateChatMetadata } from "../../hooks/use-chats";
import { useLorebooks } from "../../hooks/use-lorebooks";
import { readChatMetadata } from "../../lib/chat-wizard-defaults";
import { AgentSettingsToggle } from "./AgentSettingsControls";

export function AgentLorebookAttachment({ chatId, agentType }: { chatId: string; agentType: string }) {
  const { t } = useTranslation();
  const { data: chat } = useChat(chatId);
  const { data: lorebooks = [], isLoading, isError } = useLorebooks(undefined, { includeHidden: true });
  const updateMetadata = useUpdateChatMetadata({ serialize: true });
  const metadata = chat ? (readChatMetadata(chat) as Chat["metadata"]) : undefined;
  const attachment = metadata?.agentLorebookAttachments?.[agentType];
  const enabled = attachment?.enabled === true;
  const selectedId = attachment?.lorebookId ?? "";
  const selectedBook = lorebooks.find((book) => book.id === selectedId);
  const missing = selectedId !== "" && !isLoading && !isError && !selectedBook;
  const visibleLorebooks = lorebooks.filter((book) => !book.hiddenFromLibrary);
  const save = (patch: { enabled?: boolean; lorebookId?: string | null }) => {
    void updateMetadata
      .mutateAsync({
        id: chatId,
        agentLorebookAttachments: {
          [agentType]: patch,
        },
      })
      .catch(() => toast.error(t("chat.agentLorebook.saveError")));
  };

  return (
    <div data-agent-lorebook-attachment={agentType} className="space-y-2">
      <AgentSettingsToggle
        label={t("chat.agentLorebook.attach")}
        description={t("chat.agentLorebook.description")}
        enabled={enabled}
        onToggle={() => save({ enabled: !enabled })}
      />
      {enabled && (
        <label className="flex min-w-0 flex-col gap-1.5 text-[0.6875rem]">
          <span className="font-medium">{t("chat.agentLorebook.select")}</span>
          <select
            value={selectedId}
            disabled={isLoading || isError || updateMetadata.isPending}
            onChange={(event) => save({ lorebookId: event.target.value || null })}
            className="mari-chrome-field min-h-10 w-full min-w-0 rounded-md px-2.5 py-2 text-base md:text-xs"
          >
            <option value="">{t("chat.agentLorebook.choose")}</option>
            {missing && <option value={selectedId}>{t("chat.agentLorebook.unavailable")}</option>}
            {selectedBook?.hiddenFromLibrary && (
              <option value={selectedId} disabled>
                {selectedBook.name}
              </option>
            )}
            {visibleLorebooks.map((book) => (
              <option key={book.id} value={book.id} disabled={book.enabled === false}>
                {book.name}
              </option>
            ))}
          </select>
          {isError ? (
            <span role="status">{t("chat.agentLorebook.loadError")}</span>
          ) : missing ? (
            <span>{t("chat.agentLorebook.unavailableHint")}</span>
          ) : !isLoading && visibleLorebooks.length === 0 && !selectedBook ? (
            <span>{t("chat.agentLorebook.empty")}</span>
          ) : null}
        </label>
      )}
    </div>
  );
}
