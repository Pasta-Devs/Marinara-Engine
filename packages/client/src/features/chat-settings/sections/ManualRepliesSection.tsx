import { MessageCircle } from "lucide-react";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { ChatSettingsSection } from "../ChatSettingsSection";

interface ManualRepliesSectionProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

export function ManualRepliesSection({ enabled, onEnabledChange }: ManualRepliesSectionProps) {
  return (
    <ChatSettingsSection
      label="Manual Replies"
      icon={<MessageCircle size="0.875rem" />}
      help="When enabled, conversation messages are saved without auto-generating a reply unless you @mention a character or trigger one from the input bar."
    >
      <SettingsSwitch
        label="Only Reply When Mentioned"
        description={
          enabled
            ? "Characters will stay quiet until you type @Name or use the character picker."
            : "Characters reply automatically; @mentions focus the response on the mentioned character."
        }
        checked={enabled}
        onChange={onEnabledChange}
        labelPosition="start"
        className={[
          "justify-between rounded-lg px-3 py-2.5 text-left",
          enabled
            ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
            : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
        ].join(" ")}
        labelClassName="text-[0.6875rem] font-medium"
      />
    </ChatSettingsSection>
  );
}
