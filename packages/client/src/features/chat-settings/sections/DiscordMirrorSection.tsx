import { useId } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { isStoredSecretMask } from "@marinara-engine/shared";

interface DiscordMirrorControlsProps {
  webhookUrl: string;
  onWebhookUrlChange: (webhookUrl: string) => void;
  className?: string;
}

export function DiscordMirrorControls({
  webhookUrl,
  onWebhookUrlChange,
  className = "space-y-2",
}: DiscordMirrorControlsProps) {
  const { t: localizeUi } = useUiTranslation();
  const webhookInputId = useId();
  const webhookErrorId = useId();
  // A saved webhook comes back as a mask: the server keeps the URL, so the field starts empty and can replace it.
  const webhookSaved = isStoredSecretMask(webhookUrl);
  const trimmedWebhookUrl = webhookSaved ? "" : webhookUrl.trim();
  const hasInvalidWebhook =
    trimmedWebhookUrl.length > 0 &&
    !/^https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(trimmedWebhookUrl);

  return (
    <div className={className}>
      <label htmlFor={webhookInputId} className="block text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
        {localizeUi("ui.chatSettings.discordmirrorcontrols.discordMirror")}
      </label>
      <input
        id={webhookInputId}
        type="url"
        placeholder={localizeUi(
          webhookSaved
            ? "ui.chatSettings.discordmirrorcontrols.savedWebhook"
            : "ui.chatSettings.discordmirrorcontrols.httpsDiscordComApiWebhooks",
        )}
        value={webhookSaved ? "" : webhookUrl}
        onChange={(e) => onWebhookUrlChange(e.target.value.trim())}
        aria-invalid={hasInvalidWebhook}
        aria-describedby={hasInvalidWebhook ? webhookErrorId : undefined}
        className="mari-chrome-field w-full !rounded-md px-3 py-2.5 text-[0.6875rem]"
      />
      {webhookSaved && (
        <button
          type="button"
          onClick={() => onWebhookUrlChange("")}
          className="text-[0.625rem] text-[var(--muted-foreground)] underline-offset-2 hover:text-[var(--foreground)] hover:underline"
        >
          {localizeUi("ui.chatSettings.discordmirrorcontrols.forgetWebhook")}
        </button>
      )}
      {hasInvalidWebhook && (
        <p id={webhookErrorId} className="text-[0.625rem] text-red-400">
          {localizeUi("ui.chatSettings.discordmirrorcontrols.invalidWebhookUrlFormat")}
        </p>
      )}
    </div>
  );
}
