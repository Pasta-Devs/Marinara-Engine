import { MessageCircle } from "lucide-react";
import { cn } from "../../../lib/utils";
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
      <button
        onClick={() => onEnabledChange(!enabled)}
        className={cn(
          "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all",
          enabled
            ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
            : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
        )}
      >
        <div className="min-w-0 flex-1">
          <span className="text-[0.6875rem] font-medium">Only Reply When Mentioned</span>
          <p className="mt-0.5 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
            {enabled
              ? "Characters will stay quiet until you type @Name or use the character picker."
              : "Characters reply automatically; @mentions focus the response on the mentioned character."}
          </p>
        </div>
        <div
          className={cn(
            "ml-3 h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors",
            enabled ? "bg-[var(--primary)]" : "bg-[var(--muted-foreground)]/50",
          )}
        >
          <div
            className={cn("h-4 w-4 rounded-full bg-white shadow-sm transition-transform", enabled && "translate-x-3.5")}
          />
        </div>
      </button>
    </ChatSettingsSection>
  );
}
