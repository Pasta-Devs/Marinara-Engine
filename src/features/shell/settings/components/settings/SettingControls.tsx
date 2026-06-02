import { useEffect, useRef, useState } from "react";
import { Bell, Play, Upload, Volume2, X } from "lucide-react";
import { useUIStore } from "../../../../../shared/stores/ui.store";
import {
  CUSTOM_NOTIFICATION_SOUND_ACCEPT,
  NOTIFICATION_SOUND_OPTIONS,
  coerceNotificationSoundDataUrlMime,
  getNotificationAudioMimeType,
  playNotificationPing,
  validateCustomNotificationSoundFile,
  type CustomNotificationSound,
} from "../../../../../shared/lib/notification-sound";
import {
  CUSTOM_TEXT_BLIP_SOUND_ACCEPT,
  playTextBlip,
  validateCustomTextBlipSoundFile,
  type CustomTextBlipSound,
} from "../../../../../shared/lib/text-blip-sound";
import { HelpTooltip } from "../../../../../shared/components/ui/HelpTooltip";
import {
  getLocalNotificationPermission,
  type LocalNotificationPermission,
  requestLocalNotificationPermission,
} from "../../../../../shared/lib/local-notifications";

export function ConversationSoundSetting() {
  const convoNotificationSound = useUIStore((s) => s.convoNotificationSound);
  const setConvoNotificationSound = useUIStore((s) => s.setConvoNotificationSound);
  const rpNotificationSound = useUIStore((s) => s.rpNotificationSound);
  const setRpNotificationSound = useUIStore((s) => s.setRpNotificationSound);
  const notificationSound = useUIStore((s) => s.notificationSound);
  const setNotificationSound = useUIStore((s) => s.setNotificationSound);
  const customNotificationSound = useUIStore((s) => s.customNotificationSound);
  const setCustomNotificationSound = useUIStore((s) => s.setCustomNotificationSound);
  const textBlipMode = useUIStore((s) => s.textBlipMode);
  const setTextBlipMode = useUIStore((s) => s.setTextBlipMode);
  const customTextBlipSound = useUIStore((s) => s.customTextBlipSound);
  const setCustomTextBlipSound = useUIStore((s) => s.setCustomTextBlipSound);
  const conversationBrowserNotifications = useUIStore((s) => s.conversationBrowserNotifications);
  const setConversationBrowserNotifications = useUIStore((s) => s.setConversationBrowserNotifications);
  const [localNotificationPermission, setLocalNotificationPermission] =
    useState<LocalNotificationPermission>("default");
  const [customSoundError, setCustomSoundError] = useState<string | null>(null);
  const customSoundInputRef = useRef<HTMLInputElement>(null);
  const [customBlipError, setCustomBlipError] = useState<string | null>(null);
  const customBlipInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const syncPermission = () => {
      void getLocalNotificationPermission().then((permission) => {
        if (!cancelled) setLocalNotificationPermission(permission);
      });
    };

    syncPermission();
    window.addEventListener("focus", syncPermission);
    document.addEventListener("visibilitychange", syncPermission);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", syncPermission);
      document.removeEventListener("visibilitychange", syncPermission);
    };
  }, []);

  const nativeNotificationsChecked = conversationBrowserNotifications && localNotificationPermission === "granted";
  const nativeNotificationsHelp =
    localNotificationPermission === "unsupported"
      ? "This browser or app shell does not expose native notifications."
      : localNotificationPermission === "denied"
        ? "Notifications are blocked in the browser or operating system. Re-enable them in site or system settings to use this."
        : "Show a generic native notification when a Conversation-mode character replies while Marinara is not focused. Message contents are never shown.";

  const previewNotificationSound = (sound: CustomNotificationSound | null = customNotificationSound) => {
    playNotificationPing(notificationSound, sound);
  };
  const previewTextBlipDisabled = textBlipMode === "off" || (textBlipMode === "custom" && !customTextBlipSound);
  const textBlipModeButtonClass = (active: boolean) =>
    `rounded-md border px-2.5 py-1 text-[0.6875rem] font-medium transition-colors ${
      active
        ? "border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--primary)]"
        : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/60 hover:text-[var(--foreground)]"
    }`;

  const handleCustomSoundFile = (file: File | null) => {
    if (!file) return;
    const error = validateCustomNotificationSoundFile(file);
    if (error) {
      setCustomSoundError(error);
      if (customSoundInputRef.current) customSoundInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setCustomSoundError("Marinara could not read that audio file.");
        return;
      }
      const type = (getNotificationAudioMimeType(file) ?? file.type) || "audio/*";
      const nextSound: CustomNotificationSound = {
        name: file.name,
        type,
        size: file.size,
        dataUrl: coerceNotificationSoundDataUrlMime(reader.result, type),
      };
      setCustomNotificationSound(nextSound);
      setNotificationSound("custom");
      setCustomSoundError(null);
      playNotificationPing("custom", nextSound);
    };
    reader.onerror = () => setCustomSoundError("Marinara could not read that audio file.");
    reader.readAsDataURL(file);
  };

  const handleCustomBlipFile = (file: File | null) => {
    if (!file) return;
    const validationError = validateCustomTextBlipSoundFile(file);
    if (validationError) {
      setCustomBlipError(validationError);
      if (customBlipInputRef.current) customBlipInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setCustomBlipError("Marinara could not read that audio file.");
        return;
      }
      const sound: CustomTextBlipSound = {
        name: file.name,
        type: file.type || "audio/*",
        size: file.size,
        dataUrl: reader.result,
      };
      setCustomTextBlipSound(sound);
      setTextBlipMode("custom");
      setCustomBlipError(null);
      playTextBlip({ mode: "custom", customSound: sound });
    };
    reader.onerror = () => setCustomBlipError("Marinara could not read that audio file.");
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Bell size="0.75rem" className="text-[var(--muted-foreground)]" />
        <span className="text-xs font-medium">Notifications</span>
        <HelpTooltip text="Control local Conversation and Roleplay alerts. Native notifications only use generic copy and never include message contents." />
      </div>
      <ToggleSetting
        label="Conversation mode"
        checked={convoNotificationSound}
        onChange={(v) => {
          setConvoNotificationSound(v);
          if (v) previewNotificationSound();
        }}
      />
      <ToggleSetting
        label="Native notifications"
        checked={nativeNotificationsChecked}
        disabled={localNotificationPermission === "unsupported" || localNotificationPermission === "denied"}
        onChange={async (v) => {
          if (!v) {
            setConversationBrowserNotifications(false);
            return;
          }
          const nextPermission = await requestLocalNotificationPermission();
          setLocalNotificationPermission(nextPermission);
          setConversationBrowserNotifications(nextPermission === "granted");
        }}
        help={nativeNotificationsHelp}
      />
      {localNotificationPermission === "default" && (
        <p className="pl-6 text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
          Enabling this may open your system notification permission prompt.
        </p>
      )}
      {localNotificationPermission === "granted" && nativeNotificationsChecked && (
        <p className="pl-6 text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
          Marinara will only notify while the app is unfocused.
        </p>
      )}
      <ToggleSetting
        label="Roleplay mode"
        checked={rpNotificationSound}
        onChange={(v) => {
          setRpNotificationSound(v);
          if (v) previewNotificationSound();
        }}
      />
      <div className="mt-1 grid gap-2 rounded-lg bg-[var(--background)]/45 p-2 ring-1 ring-[var(--border)]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.6875rem] font-medium text-[var(--foreground)]">Notification sound</span>
          <button
            type="button"
            onClick={() => previewNotificationSound()}
            title="Preview notification sound"
            aria-label="Preview notification sound"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
          >
            <Play size="0.75rem" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
          {NOTIFICATION_SOUND_OPTIONS.map((option) => {
            const disabled = option.id === "custom" && !customNotificationSound;
            return (
              <button
                key={option.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setNotificationSound(option.id);
                  if (option.id !== "custom" || customNotificationSound) {
                    playNotificationPing(option.id, customNotificationSound);
                  }
                }}
                className={`flex min-h-16 flex-col items-start gap-1 rounded-md border p-2 text-left transition-colors ${
                  notificationSound === option.id
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--foreground)]"
                    : "border-[var(--border)] bg-[var(--secondary)]/45 text-[var(--muted-foreground)] hover:border-[var(--primary)]/45 hover:text-[var(--foreground)]"
                } disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--muted-foreground)]`}
              >
                <span className="text-[0.6875rem] font-medium">{option.label}</span>
                <span className="text-[0.5625rem] leading-snug">{option.description}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-1.5 rounded-md bg-[var(--secondary)]/35 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={customSoundInputRef}
              type="file"
              accept={CUSTOM_NOTIFICATION_SOUND_ACCEPT}
              className="hidden"
              onChange={(event) => handleCustomSoundFile(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => customSoundInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-2 py-1 text-[0.6875rem] font-medium text-[var(--primary-foreground)] transition-colors hover:brightness-110"
            >
              <Upload size="0.75rem" />
              Choose file
            </button>
            {customNotificationSound && (
              <>
                <span
                  className="min-w-0 max-w-full truncate text-[0.625rem] text-[var(--muted-foreground)]"
                  title={customNotificationSound.name}
                >
                  {customNotificationSound.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomNotificationSound(null);
                    if (notificationSound === "custom") setNotificationSound("refactor");
                    setCustomSoundError(null);
                    if (customSoundInputRef.current) customSoundInputRef.current.value = "";
                  }}
                  title="Remove custom notification sound"
                  aria-label="Remove custom notification sound"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
                >
                  <X size="0.75rem" />
                </button>
              </>
            )}
          </div>
          <p className="text-[0.5625rem] leading-snug text-[var(--muted-foreground)]">
            Custom files are stored in local settings and must be 512 KB or smaller.
          </p>
          {customSoundError && (
            <p className="text-[0.5625rem] leading-snug text-[var(--destructive)]">{customSoundError}</p>
          )}
        </div>
      </div>
      <div className="mt-1 grid gap-2 rounded-lg bg-[var(--background)]/45 p-2 ring-1 ring-[var(--border)]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Volume2 size="0.75rem" className="text-[var(--muted-foreground)]" />
            <span className="text-[0.6875rem] font-medium text-[var(--foreground)]">Text blips</span>
            <HelpTooltip text="Play a short blip while generated Conversation, Roleplay, and Game text appears." />
          </div>
          <button
            type="button"
            title="Preview text blip"
            aria-label="Preview text blip"
            disabled={previewTextBlipDisabled}
            onClick={() => playTextBlip({ mode: textBlipMode, customSound: customTextBlipSound })}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play size="0.75rem" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={textBlipModeButtonClass(textBlipMode === "off")}
            onClick={() => setTextBlipMode("off")}
          >
            Off
          </button>
          <button
            type="button"
            className={textBlipModeButtonClass(textBlipMode === "default")}
            onClick={() => {
              setTextBlipMode("default");
              playTextBlip({ mode: "default" });
            }}
          >
            Default
          </button>
          <button
            type="button"
            className={textBlipModeButtonClass(textBlipMode === "custom")}
            onClick={() => setTextBlipMode("custom")}
          >
            Custom
          </button>
        </div>
        <div className="flex flex-col gap-1.5 rounded-md bg-[var(--secondary)]/35 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={customBlipInputRef}
              type="file"
              accept={CUSTOM_TEXT_BLIP_SOUND_ACCEPT}
              className="hidden"
              onChange={(event) => handleCustomBlipFile(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => customBlipInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-2 py-1 text-[0.6875rem] font-medium text-[var(--primary-foreground)] transition-colors hover:brightness-110"
            >
              <Upload size="0.75rem" />
              Choose file
            </button>
            {customTextBlipSound && (
              <>
                <span
                  className="min-w-0 max-w-full truncate text-[0.625rem] text-[var(--muted-foreground)]"
                  title={customTextBlipSound.name}
                >
                  {customTextBlipSound.name}
                </span>
                <button
                  type="button"
                  title="Remove custom text blip"
                  aria-label="Remove custom text blip"
                  onClick={() => {
                    setCustomTextBlipSound(null);
                    if (textBlipMode === "custom") setTextBlipMode("off");
                    setCustomBlipError(null);
                    if (customBlipInputRef.current) customBlipInputRef.current.value = "";
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]"
                >
                  <X size="0.75rem" />
                </button>
              </>
            )}
          </div>
          <p className="text-[0.5625rem] leading-snug text-[var(--muted-foreground)]">
            Custom files are stored in local settings and must be 512 KB or smaller.
          </p>
          {customBlipError && (
            <p className="text-[0.5625rem] leading-snug text-[var(--destructive)]">{customBlipError}</p>
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
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  help?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-[var(--secondary)]/50">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => {
          void onChange(e.target.checked);
        }}
        className="h-3.5 w-3.5 rounded border-[var(--border)] accent-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
      />
      <span className="text-xs">{label}</span>
      {help && (
        <span onClick={(e) => e.preventDefault()}>
          <HelpTooltip text={help} />
        </span>
      )}
    </label>
  );
}
