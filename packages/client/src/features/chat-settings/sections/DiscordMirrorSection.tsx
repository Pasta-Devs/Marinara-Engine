import { useId } from "react";

interface DiscordMirrorControlsProps {
  webhookUrl: string;
  onWebhookUrlChange: (webhookUrl: string) => void;
}

export function DiscordMirrorControls({ webhookUrl, onWebhookUrlChange }: DiscordMirrorControlsProps) {
  const webhookInputId = useId();
  const webhookErrorId = useId();
  const trimmedWebhookUrl = webhookUrl.trim();
  const hasInvalidWebhook =
    trimmedWebhookUrl.length > 0 && !/^https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(trimmedWebhookUrl);

  return (
    <div className="space-y-2 pt-2.5">
      <input
        id={webhookInputId}
        type="url"
        placeholder="https://discord.com/api/webhooks/..."
        value={webhookUrl}
        onChange={(e) => onWebhookUrlChange(e.target.value.trim())}
        aria-invalid={hasInvalidWebhook}
        aria-describedby={hasInvalidWebhook ? webhookErrorId : undefined}
        className="w-full rounded-lg bg-[var(--secondary)] px-3 py-2.5 text-[0.6875rem] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/50 ring-1 ring-transparent focus:ring-[var(--primary)]/40 focus:outline-none transition-all"
      />
      {hasInvalidWebhook && (
        <p id={webhookErrorId} className="text-[0.625rem] text-red-400">
          Invalid webhook URL format
        </p>
      )}
    </div>
  );
}
