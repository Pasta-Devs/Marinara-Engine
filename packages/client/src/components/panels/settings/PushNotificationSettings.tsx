import { useEffect, useState } from "react";
import { Copy, ExternalLink, RefreshCw, Send, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { PushNotificationSettingsUpdate } from "@marinara-engine/shared";
import {
  usePushNotificationSettings,
  useRotatePushNotificationTopic,
  useSendTestPushNotification,
  useUpdatePushNotificationSettings,
} from "../../../hooks/use-push-notifications";
import { getPrivilegedActionErrorMessage } from "../../../lib/api-client";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { copyToClipboard } from "../../../lib/utils";
import { HelpTooltip } from "../../ui/HelpTooltip";
import { Spinner } from "../../ui/Spinner";
import { SETTINGS_BUTTON_CLASS, ToggleSetting } from "./SettingControls";

const LABEL_CLASS = "flex flex-col gap-1 text-[0.625rem] font-semibold text-[var(--muted-foreground)]";
const INPUT_CLASS =
  "w-full min-w-0 rounded-lg bg-[var(--background)] px-3 py-2 text-xs font-normal text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] focus:ring-[var(--primary)]";
const HINT_CLASS = "text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]";

/** Server push through ntfy (#9752): reaches a phone while Marinara is closed. Owner only. */
export function PushNotificationSettings() {
  const { t } = useTranslation();
  const { data: settings, error, isLoading } = usePushNotificationSettings();
  const update = useUpdatePushNotificationSettings();
  const rotate = useRotatePushNotificationTopic();
  const test = useSendTestPushNotification();
  const [serverDraft, setServerDraft] = useState("");
  const [clickDraft, setClickDraft] = useState("");

  useEffect(() => {
    if (!settings) return;
    setServerDraft(settings.serverUrl);
    setClickDraft(settings.clickUrl);
  }, [settings]);

  const save = (changes: PushNotificationSettingsUpdate) =>
    update.mutate(changes, {
      onError: (saveError) => {
        toast.error(getPrivilegedActionErrorMessage(saveError, t("settings.notifications.push.toasts.saveFailed")));
        if (settings) {
          setServerDraft(settings.serverUrl);
          setClickDraft(settings.clickUrl);
        }
      },
    });

  const saveText = (field: "serverUrl" | "clickUrl", value: string) => {
    if (!settings || value.trim() === settings[field]) return;
    save({ [field]: value });
  };

  const header = (
    <div className="flex items-center gap-1.5">
      <Smartphone size="0.75rem" className="text-[var(--muted-foreground)]" />
      <span className="text-xs font-medium">{t("settings.notifications.push.title")}</span>
      <HelpTooltip text={t("settings.notifications.push.help")} />
    </div>
  );

  if (isLoading) {
    return (
      <div className="mt-2 flex flex-col gap-2">
        {header}
        <Spinner size="sm" />
      </div>
    );
  }
  if (!settings) {
    return (
      <div className="mt-2 flex flex-col gap-2">
        {header}
        <p className={HINT_CLASS}>
          {getPrivilegedActionErrorMessage(error, t("settings.notifications.push.toasts.loadFailed"))}
        </p>
      </div>
    );
  }

  const subscribeUrl = settings.topic ? `${settings.serverUrl}/${settings.topic}` : "";
  const busy = update.isPending || rotate.isPending;

  const handleCopy = async () => {
    if (await copyToClipboard(settings.topic)) toast.success(t("settings.notifications.push.toasts.copied"));
    else toast.error(t("settings.notifications.push.toasts.copyFailed"));
  };

  const handleRotate = async () => {
    const confirmed = await showConfirmDialog({
      title: t("settings.notifications.push.newTopicConfirm.title"),
      message: t("settings.notifications.push.newTopicConfirm.message"),
      confirmLabel: t("settings.notifications.push.newTopic"),
      tone: "destructive",
    });
    if (!confirmed) return;
    rotate.mutate(undefined, {
      onError: (rotateError) =>
        toast.error(getPrivilegedActionErrorMessage(rotateError, t("settings.notifications.push.toasts.saveFailed"))),
    });
  };

  const handleTest = () =>
    test.mutate(undefined, {
      onSuccess: () => toast.success(t("settings.notifications.push.toasts.testSent")),
      onError: (testError) =>
        toast.error(getPrivilegedActionErrorMessage(testError, t("settings.notifications.push.toasts.testFailed"))),
    });

  return (
    <div className="mt-2 flex flex-col gap-2">
      {header}
      <ToggleSetting
        anchorId="settings-control-push-notifications"
        label={t("settings.notifications.push.enable")}
        checked={settings.enabled}
        disabled={busy}
        onChange={(enabled) =>
          // The first time, a tap opens the address this device uses for Marinara.
          save(enabled && !settings.clickUrl ? { enabled, clickUrl: window.location.origin } : { enabled })
        }
      />
      {settings.enabled && (
        <div className="flex flex-col gap-2.5 rounded-lg bg-[var(--secondary)]/35 p-2.5 ring-1 ring-[var(--border)]/70">
          <label className={LABEL_CLASS}>
            {t("settings.notifications.push.server.label")}
            <input
              type="url"
              inputMode="url"
              value={serverDraft}
              onChange={(event) => setServerDraft(event.target.value)}
              onBlur={() => saveText("serverUrl", serverDraft)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              spellCheck={false}
              autoComplete="off"
              className={INPUT_CLASS}
            />
            <span className={`${HINT_CLASS} font-normal`}>{t("settings.notifications.push.server.hint")}</span>
          </label>
          <div className={LABEL_CLASS}>
            <span id="push-notification-topic-label">{t("settings.notifications.push.topic.label")}</span>
            <code
              aria-labelledby="push-notification-topic-label"
              className="break-all rounded-lg bg-[var(--background)] px-3 py-2 font-mono text-xs font-normal text-[var(--foreground)] ring-1 ring-[var(--border)] select-all"
            >
              {settings.topic}
            </code>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => void handleCopy()} className={SETTINGS_BUTTON_CLASS}>
                <Copy size="0.75rem" />
                {t("settings.notifications.push.topic.copy")}
              </button>
              <a href={subscribeUrl} target="_blank" rel="noreferrer noopener" className={SETTINGS_BUTTON_CLASS}>
                <ExternalLink size="0.75rem" />
                {t("settings.notifications.push.topic.subscribe")}
              </a>
              <button
                type="button"
                onClick={() => void handleRotate()}
                disabled={busy}
                className={SETTINGS_BUTTON_CLASS}
              >
                {rotate.isPending ? <Spinner size="sm" /> : <RefreshCw size="0.75rem" />}
                {t("settings.notifications.push.newTopic")}
              </button>
            </div>
            <span className={`${HINT_CLASS} font-normal`}>{t("settings.notifications.push.topic.hint")}</span>
          </div>
          <label className={LABEL_CLASS}>
            {t("settings.notifications.push.clickUrl.label")}
            <input
              type="url"
              inputMode="url"
              value={clickDraft}
              onChange={(event) => setClickDraft(event.target.value)}
              onBlur={() => saveText("clickUrl", clickDraft)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              spellCheck={false}
              autoComplete="off"
              className={INPUT_CLASS}
            />
            <span className={`${HINT_CLASS} font-normal`}>{t("settings.notifications.push.clickUrl.hint")}</span>
          </label>
          <div className="flex flex-col">
            <ToggleSetting
              label={t("settings.notifications.push.autonomous")}
              checked={settings.notifyAutonomous}
              disabled={busy}
              onChange={(notifyAutonomous) => save({ notifyAutonomous })}
            />
            <ToggleSetting
              label={t("settings.notifications.push.replies")}
              checked={settings.notifyReplies}
              disabled={busy}
              onChange={(notifyReplies) => save({ notifyReplies })}
            />
            <ToggleSetting
              label={t("settings.notifications.push.previews.label")}
              help={t("settings.notifications.push.previews.help")}
              checked={settings.previews}
              disabled={busy}
              onChange={(previews) => save({ previews })}
            />
          </div>
          <button type="button" onClick={handleTest} disabled={test.isPending} className={SETTINGS_BUTTON_CLASS}>
            {test.isPending ? <Spinner size="sm" /> : <Send size="0.75rem" />}
            {t("settings.notifications.push.test")}
          </button>
          <p className={HINT_CLASS}>{t("settings.notifications.push.privacy")}</p>
        </div>
      )}
    </div>
  );
}
