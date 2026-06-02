import { useEffect, useRef, useState } from "react";
import { Bell, Play, Upload, Volume2, X } from "lucide-react";
import { useUIStore } from "../../../../../shared/stores/ui.store";
import { playNotificationPing } from "../../../../../shared/lib/notification-sound";
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
  const conversationBrowserNotifications = useUIStore((s) => s.conversationBrowserNotifications);
  const setConversationBrowserNotifications = useUIStore((s) => s.setConversationBrowserNotifications);
  const textBlipMode = useUIStore((s) => s.textBlipMode);
  const setTextBlipMode = useUIStore((s) => s.setTextBlipMode);
  const customTextBlipSound = useUIStore((s) => s.customTextBlipSound);
  const setCustomTextBlipSound = useUIStore((s) => s.setCustomTextBlipSound);
  const [localNotificationPermission, setLocalNotificationPermission] =
    useState<LocalNotificationPermission>("default");
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
  const previewTextBlipDisabled = textBlipMode === "off" || (textBlipMode === "custom" && !customTextBlipSound);
  const textBlipModeButtonClass = (active: boolean) =>
    `rounded-md border px-2.5 py-1 text-[0.6875rem] font-medium transition-colors ${
      active
        ? "border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--primary)]"
        : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/60 hover:text-[var(--foreground)]"
    }`;

  const handleCustomBlipFile = (file: File | null) => {
    if (!file) return;
    const validationError = validateCustomTextBlipSoundFile(file);
    if (validationError) {
      setCustomBlipError(validationError);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setCustomBlipError("Could not read that audio file.");
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
    reader.onerror = () => setCustomBlipError("Could not read that audio file.");
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
          if (v) playNotificationPing();
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
          if (v) playNotificationPing();
        }}
      />
      <div className="flex flex-col gap-2 rounded-lg p-1">
        <div className="flex items-center gap-1.5">
          <Volume2 size="0.75rem" className="text-[var(--muted-foreground)]" />
          <span className="text-xs font-medium">Text blips</span>
          <HelpTooltip text="Play a short blip while generated Conversation, Roleplay, and Game text appears." />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pl-6">
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
          <button
            type="button"
            title="Preview text blip"
            aria-label="Preview text blip"
            disabled={previewTextBlipDisabled}
            onClick={() => playTextBlip({ mode: textBlipMode, customSound: customTextBlipSound })}
            className="rounded-md border border-[var(--border)] p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)]/60 hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play size="0.75rem" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pl-6">
          <input
            ref={customBlipInputRef}
            type="file"
            accept={CUSTOM_TEXT_BLIP_SOUND_ACCEPT}
            className="hidden"
            onChange={(event) => {
              handleCustomBlipFile(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => customBlipInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1 text-[0.6875rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)]/60 hover:text-[var(--foreground)]"
          >
            <Upload size="0.75rem" />
            Choose file
          </button>
          {customTextBlipSound && (
            <>
              <span
                className="max-w-[12rem] truncate text-[0.6875rem] text-[var(--muted-foreground)]"
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
                }}
                className="rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)]/60 hover:text-[var(--foreground)]"
              >
                <X size="0.75rem" />
              </button>
            </>
          )}
        </div>
        {customBlipError && <p className="pl-6 text-[0.625rem] leading-snug text-red-400">{customBlipError}</p>}
        <p className="pl-6 text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
          Custom files are stored locally and must be 512 KB or smaller.
        </p>
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
