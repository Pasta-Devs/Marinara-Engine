// "Leave stored messages out of Chat History" for Lorebook Keeper and Long-term memory: messages the memory has
// already stored leave the prompt (it still holds them), except the newest few, which stay word for word.
import { useTranslation as useUiTranslation } from "react-i18next";
import { useUpdateChatMetadata } from "../../../hooks/use-chats";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { DraftNumberInput } from "../../../components/ui/DraftNumberInput";
import { cn } from "../../../lib/utils";

/** Server default for `retireStoredTailMessages` (RETIRE_STORED_TAIL.DEFAULT). */
const DEFAULT_TAIL = 10;

export function RetireStoredSetting({
  chatId,
  metadata,
  settingKey,
}: {
  chatId: string;
  metadata: Record<string, unknown>;
  settingKey: "lorebookKeeperRetireStored" | "longTermMemoryRetireStored";
}) {
  const { t: localizeUi } = useUiTranslation();
  const updateMeta = useUpdateChatMetadata();
  const on = metadata[settingKey] === true;
  const tail =
    typeof metadata.retireStoredTailMessages === "number" && Number.isFinite(metadata.retireStoredTailMessages)
      ? metadata.retireStoredTailMessages
      : DEFAULT_TAIL;
  return (
    <div className="space-y-1.5" data-retire-stored={settingKey}>
      <SettingsSwitch
        label={localizeUi("ui.chat.chatsettingsdrawer.retireStored")}
        description={localizeUi(
          settingKey === "lorebookKeeperRetireStored"
            ? "ui.chat.chatsettingsdrawer.retireStoredKeeperDescription"
            : "ui.chat.chatsettingsdrawer.retireStoredLtmDescription",
        )}
        checked={on}
        onChange={(checked) => updateMeta.mutate({ id: chatId, [settingKey]: checked })}
        labelPosition="start"
        className={cn(
          "justify-between rounded-lg px-3 py-2.5 text-left",
          on
            ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
            : "bg-[var(--background)]/75 ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
        )}
        labelClassName="text-xs font-medium"
      />
      {on && (
        <label className="flex items-center justify-between gap-2 px-1 text-[0.6875rem] text-[var(--muted-foreground)]">
          <span>{localizeUi("ui.chat.chatsettingsdrawer.retireStoredTail")}</span>
          <DraftNumberInput
            ariaLabel={localizeUi("ui.chat.chatsettingsdrawer.retireStoredTail")}
            min={0}
            max={500}
            value={tail}
            selectOnFocus
            onCommit={(value) =>
              updateMeta.mutate({ id: chatId, retireStoredTailMessages: Math.max(0, Math.min(500, value)) })
            }
            className="w-16 rounded-md bg-[var(--secondary)] px-2 py-1 text-right text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)]/40"
          />
        </label>
      )}
    </div>
  );
}
