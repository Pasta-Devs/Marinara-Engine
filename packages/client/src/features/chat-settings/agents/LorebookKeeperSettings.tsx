import { type Chat } from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useUpdateChatMetadata } from "../../../hooks/use-chats";
import { AgentSettingsActionButton } from "../../../components/chat/AgentSettingsControls";
import { Select } from "../../../components/ui/Select";
import { useUIStore } from "../../../stores/ui.store";
import { Settings2, RefreshCw } from "lucide-react";
import { cn } from "../../../lib/utils";
import type { useLorebooks } from "../../../hooks/use-lorebooks";

interface LorebookKeeperSettingsProps {
  chat: Chat;
  lorebookKeeperTargetLorebookId: string;
  lorebookKeeperReadBehindMessages: number;
  lorebooks: ReturnType<typeof useLorebooks>["data"];
  agentProcessing: boolean;
  closeForSurface: () => void;
  handleLorebookKeeperBackfill: () => Promise<void>;
}

export function LorebookKeeperSettings({
  chat,
  lorebookKeeperTargetLorebookId,
  lorebookKeeperReadBehindMessages,
  lorebooks,
  agentProcessing,
  closeForSurface,
  handleLorebookKeeperBackfill,
}: LorebookKeeperSettingsProps) {
  const { t: localizeUi } = useUiTranslation();
  const updateMeta = useUpdateChatMetadata();
  return (
    <>
      <div className="flex flex-col items-stretch gap-2 rounded-lg bg-[var(--background)]/75 px-3 py-2 ring-1 ring-[var(--border)] @lg:flex-row @lg:items-center @lg:justify-between">
        <p className="min-w-0 flex-1 text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.chatsettingsdrawer.chatLorebookKeeperRunsAfterAssistantRepliesGameMode")}
        </p>
        <div className="flex w-full min-w-0 flex-col items-stretch gap-1.5 @lg:w-auto @lg:shrink-0 @lg:flex-row @lg:items-center">
          <AgentSettingsActionButton
            onClick={() => {
              closeForSurface();
              useUIStore.getState().openAgentDetail("lorebook-keeper");
            }}
            className="!h-8 !min-h-8 w-full whitespace-nowrap !py-0 @lg:w-auto"
          >
            <Settings2 size="0.75rem" />
            <span>{localizeUi("ui.chat.chatsettingsdrawer.openSetup")}</span>
          </AgentSettingsActionButton>
          <AgentSettingsActionButton
            onClick={handleLorebookKeeperBackfill}
            disabled={agentProcessing}
            className="!h-8 !min-h-8 w-full whitespace-nowrap !py-0 @lg:w-auto"
            variant="primary"
          >
            <RefreshCw size="0.75rem" className={cn(agentProcessing && "animate-spin")} />
            <span>{localizeUi("ui.chat.chatsettingsdrawer.backfillUnprocessed")}</span>
          </AgentSettingsActionButton>
        </div>
      </div>
      <div className="grid gap-2 @lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1 text-[0.625rem] text-[var(--muted-foreground)]">
          <span className="font-medium text-[var(--foreground)]">
            {localizeUi("ui.chat.agentaddsetupfields.targetLorebook")}
          </span>
          <Select
            label={localizeUi("ui.chat.agentaddsetupfields.targetLorebook")}
            value={lorebookKeeperTargetLorebookId}
            options={[
              { value: "", label: localizeUi("ui.chat.agentaddsetupfields.autoSelectFirstWritableLorebook") },
              ...((lorebooks ?? []) as Array<{ id: string; name: string }>).map((lorebook) => ({
                value: lorebook.id,
                label: lorebook.name,
              })),
            ]}
            onChange={(value) =>
              updateMeta.mutate({
                id: chat.id,
                lorebookKeeperTargetLorebookId: value || null,
              })
            }
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)]"
          />
        </div>

        <label className="flex min-w-0 flex-col gap-1 text-[0.625rem] text-[var(--muted-foreground)]">
          <span className="font-medium text-[var(--foreground)]">
            {localizeUi("ui.chat.agentaddsetupfields.readBehind")}
          </span>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={lorebookKeeperReadBehindMessages}
            onChange={(e) => {
              const nextValue = e.target.value === "" ? 0 : Number.parseInt(e.target.value, 10);
              updateMeta.mutate({
                id: chat.id,
                lorebookKeeperReadBehindMessages: Number.isFinite(nextValue)
                  ? Math.max(0, Math.min(100, nextValue))
                  : 0,
              });
            }}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-xs text-[var(--foreground)]"
          />
        </label>
      </div>

      <p className="text-[0.625rem] text-[var(--muted-foreground)]">
        {localizeUi("ui.chat.chatsettingsdrawer.readBehindUsesAssistantMessages0MeansTheNewest")}
      </p>
    </>
  );
}
