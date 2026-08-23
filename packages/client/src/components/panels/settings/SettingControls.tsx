import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Bell, BellRing, Loader2, Play, Trash2, Upload, Volume2 } from "lucide-react";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { useUIStore } from "../../../stores/ui.store";
import { ANDROID_BRIDGE_READY_EVENT } from "../../../lib/android-bridge";
import {
  getLocalNotificationPermission,
  getNativeNotificationPermission,
  hasNativeNotificationBridge,
  requestLocalNotificationPermission,
  requestNativeNotificationPermission,
  type LocalNotificationPermission,
  type NativeNotificationPermission,
} from "../../../lib/local-notifications";
import { playNotificationPing, setCustomNotificationSoundUrl } from "../../../lib/notification-sound";
import {
  useCustomNotificationSoundStatus,
  useRemoveCustomNotificationSound,
  useUploadCustomNotificationSound,
} from "../../../hooks/use-custom-notification-sound";
import { cn } from "../../../lib/utils";
import { localizeStringNode, useLocalizedUiText } from "../../../localization/use-localized-ui-text";
import { HelpTooltip } from "../../ui/HelpTooltip";

export function SettingsIntro({ children }: { children: ReactNode }) {
  const localize = useLocalizedUiText();
  return (
    <p className="text-xs leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
      {localizeStringNode(children, localize)}
    </p>
  );
}

export function SettingsSection({
  title,
  description,
  help,
  icon,
  headerAction,
  anchorId,
  children,
  className,
  contentClassName,
  tone = "default",
}: {
  title: string;
  description?: ReactNode;
  help?: string;
  icon?: ReactNode;
  headerAction?: ReactNode;
  anchorId?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  tone?: "default" | "danger";
}) {
  const localize = useLocalizedUiText();
  const localizedDescription = localizeStringNode(description, localize);

  return (
    <section
      id={anchorId}
      className={cn(
        "overflow-hidden rounded-lg border bg-[var(--background)]/35 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_8%,transparent)]",
        tone === "danger" ? "border-[var(--destructive)]/30 bg-[var(--destructive)]/5" : "border-[var(--border)]/70",
        className,
      )}
    >
      <div className="flex items-start gap-2 px-3 py-2.5">
        {icon && (
          <span
            className={cn(
              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1",
              tone === "danger"
                ? "bg-[var(--destructive)]/10 text-[var(--destructive)] ring-[var(--destructive)]/25"
                : "bg-[var(--secondary)]/70 text-[var(--marinara-chat-chrome-button-text-active)] ring-[var(--border)]",
            )}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "inline-flex items-center gap-1 text-xs font-semibold",
              tone === "danger" ? "text-[var(--destructive)]" : "text-[var(--marinara-chat-chrome-panel-title)]",
            )}
          >
            {localize(title)}
            {help && <HelpTooltip text={localize(help)} />}
          </div>
          {localizedDescription && (
            <div className="mt-1 text-[0.625rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
              {localizedDescription}
            </div>
          )}
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>
      <div className={cn("border-t border-[var(--border)]/60 px-3 pb-3 pt-2.5", contentClassName)}>{children}</div>
    </section>
  );
}

export function ConversationSoundSetting() {
  const { t: localizeUi } = useUiTranslation();
  const localize = useLocalizedUiText();
  const convoNotificationSound = useUIStore((s) => s.convoNotificationSound);
  const setConvoNotificationSound = useUIStore((s) => s.setConvoNotificationSound);
  const rpNotificationSound = useUIStore((s) => s.rpNotificationSound);
  const setRpNotificationSound = useUIStore((s) => s.setRpNotificationSound);
  const gameNotificationSound = useUIStore((s) => s.gameNotificationSound);
  const setGameNotificationSound = useUIStore((s) => s.setGameNotificationSound);
  const notificationSoundsOnlyWhenUnfocused = useUIStore((s) => s.notificationSoundsOnlyWhenUnfocused);
  const setNotificationSoundsOnlyWhenUnfocused = useUIStore((s) => s.setNotificationSoundsOnlyWhenUnfocused);
  const conversationBrowserNotifications = useUIStore((s) => s.conversationBrowserNotifications);
  const setConversationBrowserNotifications = useUIStore((s) => s.setConversationBrowserNotifications);
  const conversationMobileNotifications = useUIStore((s) => s.conversationMobileNotifications);
  const setConversationMobileNotifications = useUIStore((s) => s.setConversationMobileNotifications);
  const generationBrowserNotifications = useUIStore((s) => s.generationBrowserNotifications);
  const setGenerationBrowserNotifications = useUIStore((s) => s.setGenerationBrowserNotifications);
  const generationMobileNotifications = useUIStore((s) => s.generationMobileNotifications);
  const setGenerationMobileNotifications = useUIStore((s) => s.setGenerationMobileNotifications);
  const [browserPermission, setBrowserPermission] = useState<LocalNotificationPermission>("default");
  const [nativeNotificationsAvailable, setNativeNotificationsAvailable] = useState(hasNativeNotificationBridge);
  const [nativePermission, setNativePermission] = useState<NativeNotificationPermission>(() =>
    getNativeNotificationPermission(),
  );
  const browserNotificationHelp =
    browserPermission === "insecure"
      ? "Browser notifications require HTTPS or localhost."
      : browserPermission === "denied"
        ? "Browser notifications are blocked. Reset this site's notification permission, then try again."
        : browserPermission === "unsupported"
          ? "Browser notifications are not available in this environment."
          : "Uses your browser's notification permission.";

  useEffect(() => {
    let cancelled = false;
    void getLocalNotificationPermission().then((permission) => {
      if (!cancelled) setBrowserPermission(permission);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const refreshBridge = () => {
      setNativeNotificationsAvailable(hasNativeNotificationBridge());
      setNativePermission(getNativeNotificationPermission());
    };
    window.addEventListener(ANDROID_BRIDGE_READY_EVENT, refreshBridge);
    refreshBridge();
    return () => window.removeEventListener(ANDROID_BRIDGE_READY_EVENT, refreshBridge);
  }, []);

  useEffect(() => {
    if (!nativeNotificationsAvailable) return;
    const refreshPermission = () => setNativePermission(getNativeNotificationPermission());
    window.addEventListener("focus", refreshPermission);
    document.addEventListener("visibilitychange", refreshPermission);
    return () => {
      window.removeEventListener("focus", refreshPermission);
      document.removeEventListener("visibilitychange", refreshPermission);
    };
  }, [nativeNotificationsAvailable]);

  const handleBrowserNotificationToggle = (
    enabled: boolean,
    setPreference: (value: boolean) => void,
    successMessage: string,
  ) => {
    if (!enabled) {
      setPreference(false);
      return;
    }

    void requestLocalNotificationPermission().then((permission) => {
      setBrowserPermission(permission);
      if (permission === "granted") {
        setPreference(true);
        toast.success(successMessage);
        return;
      }
      setPreference(false);
      toast.error(
        permission === "insecure"
          ? localizeUi(
              "ui.panels.conversationsoundsetting.browserNotificationsRequireHttpsOrLocalhostOpenMarinaraThrough",
            )
          : permission === "unsupported"
            ? localizeUi("ui.panels.conversationsoundsetting.browserNotificationsAreNotAvailableInThisEnvironment")
            : permission === "denied"
              ? localizeUi(
                  "ui.panels.conversationsoundsetting.browserNotificationsAreBlockedResetThisSiteSNotification",
                )
              : localizeUi("ui.panels.conversationsoundsetting.browserNotificationPermissionWasNotGranted"),
      );
    });
  };

  const handleMobileNotificationToggle = (
    enabled: boolean,
    setPreference: (value: boolean) => void,
    successMessage: string,
  ) => {
    if (!enabled) {
      setPreference(false);
      return;
    }
    void requestNativeNotificationPermission()
      .then((permission) => {
        setNativePermission(permission);
        if (permission === "granted") {
          setPreference(true);
          toast.success(successMessage);
          return;
        }
        setPreference(false);
        toast.error(
          permission === "unsupported"
            ? localizeUi("ui.panels.conversationsoundsetting.mobileNotificationsRequireTheMarinaraAndroidApp")
            : localizeUi("ui.panels.conversationsoundsetting.androidNotificationPermissionWasNotGranted"),
        );
      })
      .catch(() => {
        setPreference(false);
        toast.error(localizeUi("ui.panels.conversationsoundsetting.androidNotificationPermissionCouldNotBeRequested"));
      });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Volume2 size="0.75rem" className="text-[var(--muted-foreground)]" />
        <span className="text-xs font-medium">{localize("Notification Sounds")}</span>
        <HelpTooltip
          text={localize("Play a notification ping when you receive a new message while on a different chat.")}
        />
      </div>
      <ToggleSetting
        anchorId="settings-control-notification-conversation-sound"
        label={localizeUi("settings.notifications.conversationMode")}
        checked={convoNotificationSound}
        onChange={(v) => {
          setConvoNotificationSound(v);
          if (v) playNotificationPing();
        }}
      />
      <ToggleSetting
        anchorId="settings-control-notification-roleplay-sound"
        label={localizeUi("settings.notifications.roleplayMode")}
        checked={rpNotificationSound}
        onChange={(v) => {
          setRpNotificationSound(v);
          if (v) playNotificationPing();
        }}
      />
      <ToggleSetting
        anchorId="settings-control-notification-game-sound"
        label={localizeUi("settings.notifications.gameMode")}
        checked={gameNotificationSound}
        onChange={(v) => {
          setGameNotificationSound(v);
          if (v) playNotificationPing();
        }}
      />
      <ToggleSetting
        anchorId="settings-control-notification-unfocused-only"
        label={localizeUi("settings.notifications.unfocusedOnly")}
        checked={notificationSoundsOnlyWhenUnfocused}
        onChange={setNotificationSoundsOnlyWhenUnfocused}
      />
      <CustomNotificationSoundSetting />
      <div className="mt-1 flex items-center gap-1.5">
        <Bell size="0.75rem" className="text-[var(--muted-foreground)]" />
        <span className="text-xs font-medium">{localize("Background Notifications")}</span>
        <HelpTooltip
          text={localize(
            "Show a private operating-system notification when an autonomous Conversation message arrives while Marinara is not focused. Message content is hidden.",
          )}
        />
      </div>
      <ToggleSetting
        anchorId="settings-control-browser-background-notifications"
        label={localizeUi("settings.notifications.browser")}
        checked={conversationBrowserNotifications && browserPermission === "granted"}
        onChange={(enabled) =>
          handleBrowserNotificationToggle(
            enabled,
            setConversationBrowserNotifications,
            "Browser notifications enabled for autonomous messages.",
          )
        }
        help={browserNotificationHelp}
      />
      <ToggleSetting
        anchorId="settings-control-mobile-background-notifications"
        label={localizeUi("settings.notifications.mobileApp")}
        checked={conversationMobileNotifications && nativePermission === "granted"}
        onChange={(enabled) =>
          handleMobileNotificationToggle(
            enabled,
            setConversationMobileNotifications,
            "Mobile notifications enabled for autonomous messages.",
          )
        }
        disabled={!nativeNotificationsAvailable}
        help={
          nativeNotificationsAvailable
            ? localizeUi("ui.panels.conversationsoundsetting.usesNativeAndroidNotificationsFromTheInstalledMarinaraApp")
            : localizeUi("ui.panels.conversationsoundsetting.availableInTheUpdatedMarinaraAndroidApkBrowserAnd")
        }
      />
      <div className="mt-1 flex items-center gap-1.5">
        <BellRing size="0.75rem" className="text-[var(--muted-foreground)]" />
        <span className="text-xs font-medium">{localize("Generation Completion Notifications")}</span>
        <HelpTooltip
          text={localize(
            "Show a private operating-system notification when a reply you started manually finishes in Conversation, Roleplay, or Game mode while Marinara is not focused. Message content is hidden.",
          )}
        />
      </div>
      <ToggleSetting
        anchorId="settings-control-browser-generation-notifications"
        label={localizeUi("settings.notifications.browser")}
        checked={generationBrowserNotifications && browserPermission === "granted"}
        onChange={(enabled) =>
          handleBrowserNotificationToggle(
            enabled,
            setGenerationBrowserNotifications,
            "Browser notifications enabled for generation completions.",
          )
        }
        help={browserNotificationHelp}
      />
      <ToggleSetting
        anchorId="settings-control-mobile-generation-notifications"
        label={localizeUi("settings.notifications.mobileApp")}
        checked={generationMobileNotifications && nativePermission === "granted"}
        onChange={(enabled) =>
          handleMobileNotificationToggle(
            enabled,
            setGenerationMobileNotifications,
            "Mobile notifications enabled for generation completions.",
          )
        }
        disabled={!nativeNotificationsAvailable}
        help={
          nativeNotificationsAvailable
            ? localizeUi("ui.panels.conversationsoundsetting.usesNativeAndroidNotificationsFromTheInstalledMarinaraApp")
            : localizeUi("ui.panels.conversationsoundsetting.availableInTheUpdatedMarinaraAndroidApkBrowserAnd")
        }
      />
    </div>
  );
}

const MAX_CUSTOM_NOTIFICATION_SOUND_BYTES = 10 * 1024 * 1024;

function CustomNotificationSoundSetting() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: status, isLoading } = useCustomNotificationSoundStatus();
  const uploadSound = useUploadCustomNotificationSound();
  const removeSound = useRemoveCustomNotificationSound();
  const isBusy = uploadSound.isPending || removeSound.isPending;

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_CUSTOM_NOTIFICATION_SOUND_BYTES) {
      toast.error(t("settings.notifications.customSound.toasts.tooLarge"));
      return;
    }
    try {
      const status = await uploadSound.mutateAsync(file);
      // Prime the playback state directly — App's sync effect only runs after
      // the next render, and the preview below must already use the new sound.
      setCustomNotificationSoundUrl(status.url);
      toast.success(t("settings.notifications.customSound.toasts.uploaded"));
      playNotificationPing();
    } catch {
      toast.error(t("settings.notifications.customSound.toasts.uploadFailed"));
    }
  };

  const handleRemove = async () => {
    try {
      await removeSound.mutateAsync();
      setCustomNotificationSoundUrl(null);
      toast.success(t("settings.notifications.customSound.toasts.removed"));
    } catch {
      toast.error(t("settings.notifications.customSound.toasts.removeFailed"));
    }
  };

  return (
    <div className="rounded-lg bg-[var(--secondary)]/35 p-2.5 ring-1 ring-[var(--border)]/70">
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,video/mp4,.mp3,.wav,.ogg,.oga,.m4a,.mp4,.webm"
        onChange={handleUpload}
        className="sr-only"
        aria-label={t("settings.notifications.customSound.actions.choose")}
      />
      <div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[0.6875rem] font-medium">{t("settings.notifications.customSound.label")}</span>
            <span className="rounded-full bg-[var(--background)] px-1.5 py-0.5 text-[0.5625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
              {isLoading
                ? t("settings.notifications.customSound.status.loading")
                : status?.configured
                  ? t("settings.notifications.customSound.status.custom")
                  : t("settings.notifications.customSound.status.default")}
            </span>
          </div>
          <p className="mt-1 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
            {t("settings.notifications.customSound.description")}
          </p>
          <p className="mt-0.5 text-[0.5625rem] text-[var(--muted-foreground)]/80">
            {t("settings.notifications.customSound.formats")}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => playNotificationPing()}
            disabled={isLoading}
            className="mari-chrome-control inline-flex min-h-9 items-center gap-1.5 px-2.5 text-[0.625rem] disabled:opacity-50"
          >
            <Play size="0.6875rem" />
            {t("settings.notifications.customSound.actions.preview")}
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isBusy}
            className="mari-chrome-control inline-flex min-h-9 items-center gap-1.5 px-2.5 text-[0.625rem] disabled:opacity-50"
          >
            {uploadSound.isPending ? (
              <Loader2 size="0.6875rem" className="animate-spin" />
            ) : (
              <Upload size="0.6875rem" />
            )}
            {status?.configured
              ? t("settings.notifications.customSound.actions.replace")
              : t("settings.notifications.customSound.actions.choose")}
          </button>
          {status?.configured && (
            <button
              type="button"
              onClick={() => void handleRemove()}
              disabled={isBusy}
              className="mari-chrome-control inline-flex min-h-9 items-center gap-1.5 px-2.5 text-[0.625rem] text-[var(--destructive)] disabled:opacity-50"
            >
              {removeSound.isPending ? (
                <Loader2 size="0.6875rem" className="animate-spin" />
              ) : (
                <Trash2 size="0.6875rem" />
              )}
              {t("settings.notifications.customSound.actions.remove")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ToggleSetting({
  label,
  checked,
  onChange,
  help,
  endAction,
  disabled = false,
  anchorId,
  switchClassName,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  help?: string;
  endAction?: ReactNode;
  disabled?: boolean;
  anchorId?: string;
  switchClassName?: string;
}) {
  return (
    <SettingsSwitch
      anchorId={anchorId}
      label={label}
      checked={checked}
      onChange={onChange}
      help={help}
      disabled={disabled}
      labelPosition="start"
      className="justify-between gap-3 p-1.5"
      labelClassName="text-xs"
      switchClassName={switchClassName}
      endAction={endAction}
    />
  );
}

export function SettingsCheckbox({
  label,
  checked,
  onChange,
  help,
  description,
  disabled = false,
  tone = "default",
  align = "start",
  anchorId,
  className,
  labelClassName,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  help?: string;
  description?: ReactNode;
  disabled?: boolean;
  tone?: "default" | "danger";
  align?: "start" | "between";
  anchorId?: string;
  className?: string;
  labelClassName?: string;
}) {
  const localize = useLocalizedUiText();
  const localizedLabel = localizeStringNode(label, localize);
  const localizedDescription = localizeStringNode(description, localize);
  const input = (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className={cn(
        "h-3.5 w-3.5 shrink-0 rounded border-[var(--border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        tone === "danger" ? "accent-[var(--destructive)]" : "accent-[var(--primary)]",
        align === "start" && "mt-0.5",
      )}
    />
  );
  const text = (
    <span className={cn("min-w-0 text-xs", labelClassName)}>
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span className="min-w-0">{localizedLabel}</span>
        {align !== "between" && help && (
          <span onClick={(e) => e.preventDefault()}>
            <HelpTooltip text={localize(help)} />
          </span>
        )}
      </span>
      {localizedDescription && (
        <span className="mt-0.5 block text-[0.625rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
          {localizedDescription}
        </span>
      )}
    </span>
  );
  const inputCluster = (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      {align === "between" && help && (
        <span onClick={(e) => e.preventDefault()}>
          <HelpTooltip text={localize(help)} />
        </span>
      )}
      {input}
    </span>
  );

  return (
    <label
      id={anchorId}
      className={cn(
        "flex scroll-mt-3 cursor-pointer rounded-lg transition-colors hover:bg-[var(--secondary)]/50",
        align === "between" ? "items-center justify-between gap-3 p-1.5" : "items-start gap-2.5 p-1.5",
        disabled && "cursor-not-allowed opacity-60 hover:bg-transparent",
        className,
      )}
    >
      {align === "between" ? (
        <>
          {text}
          {inputCluster}
        </>
      ) : (
        <>
          {input}
          {text}
        </>
      )}
    </label>
  );
}

type SettingsSwitchAccessibleLabel = { label: ReactNode; ariaLabel?: never } | { label?: undefined; ariaLabel: string };

export function SettingsSwitchTrack({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-settings-switch-track
      className={cn(
        "inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
        checked ? "bg-[var(--primary)]/70 mari-accent-animated" : "bg-[var(--border)]",
        className,
      )}
    >
      <span
        data-settings-switch-thumb
        className={cn(
          "pointer-events-none block h-4 w-4 shrink-0 rounded-full bg-[var(--background)] shadow-sm ring-1 ring-[var(--border)] transition-transform",
          checked && "translate-x-4",
        )}
      />
    </span>
  );
}

type SettingsSwitchProps = SettingsSwitchAccessibleLabel & {
  checked: boolean;
  onChange: (v: boolean) => void;
  title?: string;
  description?: ReactNode;
  help?: string;
  helpPosition?: "control" | "label";
  endAction?: ReactNode;
  disabled?: boolean;
  labelPosition?: "start" | "end";
  anchorId?: string;
  className?: string;
  labelClassName?: string;
  /** Appended last so callers can intentionally override checked-track visuals. */
  switchClassName?: string;
};

export function SettingsSwitch({
  label,
  checked,
  onChange,
  ariaLabel,
  title,
  description,
  help,
  helpPosition = "control",
  endAction,
  disabled = false,
  labelPosition = "end",
  anchorId,
  className,
  labelClassName,
  switchClassName,
}: SettingsSwitchProps) {
  const inputId = useId();
  const localize = useLocalizedUiText();
  const localizedLabel = localizeStringNode(label, localize);
  const localizedDescription = localizeStringNode(description, localize);
  const localizedTitle = title ? localize(title) : undefined;
  const switchControl = (
    <label
      htmlFor={inputId}
      title={localizedTitle}
      className={cn("relative inline-flex h-5 w-9 shrink-0", disabled ? "cursor-not-allowed" : "cursor-pointer")}
    >
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={!label && ariaLabel ? localize(ariaLabel) : undefined}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <SettingsSwitchTrack
        checked={checked}
        className={cn("peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--ring)]", switchClassName)}
      />
    </label>
  );
  const switchCluster = (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      {help && helpPosition === "control" && <HelpTooltip text={localize(help)} />}
      {switchControl}
      {endAction}
    </span>
  );
  const text = localizedLabel ? (
    <span className={cn("min-w-0 text-sm", labelClassName)}>
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <label htmlFor={inputId} className={cn("min-w-0", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
          {localizedLabel}
        </label>
        {help && helpPosition === "label" && <HelpTooltip text={localize(help)} />}
      </span>
      {localizedDescription && (
        <label
          htmlFor={inputId}
          className={cn(
            "mt-0.5 block text-[0.625rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]",
            disabled ? "cursor-not-allowed" : "cursor-pointer",
          )}
        >
          {localizedDescription}
        </label>
      )}
    </span>
  ) : null;

  return (
    <div
      id={anchorId}
      title={localizedTitle}
      className={cn(
        "flex scroll-mt-3 items-center gap-3 rounded-xl p-2 transition-colors hover:bg-[var(--secondary)]/50",
        disabled && "cursor-not-allowed opacity-60 hover:bg-transparent",
        className,
      )}
    >
      {labelPosition === "start" && text}
      {switchCluster}
      {labelPosition === "end" && text}
    </div>
  );
}
