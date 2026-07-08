import { useEffect, useId, useState, type ReactNode } from "react";
import { Bell, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { useUIStore } from "../../../stores/ui.store";
import {
  getLocalNotificationPermission,
  requestLocalNotificationPermission,
  type LocalNotificationPermission,
} from "../../../lib/local-notifications";
import { playNotificationPing } from "../../../lib/notification-sound";
import { cn } from "../../../lib/utils";
import { HelpTooltip } from "../../ui/HelpTooltip";

export function SettingsIntro({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">{children}</p>;
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
            {title}
            {help && <HelpTooltip text={help} />}
          </div>
          {description && (
            <div className="mt-1 text-[0.625rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
              {description}
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
  const [browserPermission, setBrowserPermission] = useState<LocalNotificationPermission>("default");

  useEffect(() => {
    let cancelled = false;
    void getLocalNotificationPermission().then((permission) => {
      if (!cancelled) setBrowserPermission(permission);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleBrowserNotificationToggle = (enabled: boolean) => {
    if (!enabled) {
      setConversationBrowserNotifications(false);
      return;
    }

    void requestLocalNotificationPermission().then((permission) => {
      setBrowserPermission(permission);
      if (permission === "granted") {
        setConversationBrowserNotifications(true);
        toast.success("Browser notifications enabled for background replies.");
        return;
      }
      setConversationBrowserNotifications(false);
      toast.error(
        permission === "unsupported"
          ? "Browser notifications are not available in this environment."
          : "Browser notification permission was not granted.",
      );
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Volume2 size="0.75rem" className="text-[var(--muted-foreground)]" />
        <span className="text-xs font-medium">Notification Sounds</span>
        <HelpTooltip text="Play a notification ping when you receive a new message while on a different chat." />
      </div>
      <ToggleSetting
        anchorId="settings-control-notification-conversation-sound"
        label="Conversation mode"
        checked={convoNotificationSound}
        onChange={(v) => {
          setConvoNotificationSound(v);
          if (v) playNotificationPing();
        }}
      />
      <ToggleSetting
        anchorId="settings-control-notification-roleplay-sound"
        label="Roleplay mode"
        checked={rpNotificationSound}
        onChange={(v) => {
          setRpNotificationSound(v);
          if (v) playNotificationPing();
        }}
      />
      <ToggleSetting
        anchorId="settings-control-notification-game-sound"
        label="Game mode"
        checked={gameNotificationSound}
        onChange={(v) => {
          setGameNotificationSound(v);
          if (v) playNotificationPing();
        }}
      />
      <ToggleSetting
        anchorId="settings-control-notification-unfocused-only"
        label="Only when Marinara is unfocused"
        checked={notificationSoundsOnlyWhenUnfocused}
        onChange={setNotificationSoundsOnlyWhenUnfocused}
      />
      <div className="mt-1 flex items-center gap-1.5">
        <Bell size="0.75rem" className="text-[var(--muted-foreground)]" />
        <span className="text-xs font-medium">Browser Notifications</span>
        <HelpTooltip text="Show an operating-system browser notification when a background Conversation reply arrives while Marinara is not focused. Message content is hidden." />
      </div>
      <ToggleSetting
        anchorId="settings-control-browser-background-notifications"
        label="Background replies"
        checked={conversationBrowserNotifications && browserPermission === "granted"}
        onChange={handleBrowserNotificationToggle}
      />
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
        <span className="min-w-0">{label}</span>
        {align !== "between" && help && (
          <span onClick={(e) => e.preventDefault()}>
            <HelpTooltip text={help} />
          </span>
        )}
      </span>
      {description && (
        <span className="mt-0.5 block text-[0.625rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]">
          {description}
        </span>
      )}
    </span>
  );
  const inputCluster = (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      {align === "between" && help && (
        <span onClick={(e) => e.preventDefault()}>
          <HelpTooltip text={help} />
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

type SettingsSwitchProps = SettingsSwitchAccessibleLabel & {
  checked: boolean;
  onChange: (v: boolean) => void;
  title?: string;
  description?: ReactNode;
  help?: string;
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
  endAction,
  disabled = false,
  labelPosition = "end",
  anchorId,
  className,
  labelClassName,
  switchClassName,
}: SettingsSwitchProps) {
  const inputId = useId();
  const switchControl = (
    <span className="relative inline-flex h-5 w-9 shrink-0">
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={!label ? ariaLabel : undefined}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <label
        htmlFor={inputId}
        title={title}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--ring)]",
          checked ? "bg-[var(--primary)]/70" : "bg-[var(--border)]",
          checked && "mari-accent-animated",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
          switchClassName,
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-[var(--background)] shadow-sm ring-1 ring-[var(--border)] transition-transform",
            checked && "translate-x-4",
          )}
        />
      </label>
    </span>
  );
  const switchCluster = (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      {help && <HelpTooltip text={help} />}
      {switchControl}
      {endAction}
    </span>
  );
  const text = label ? (
    <span className={cn("min-w-0 text-sm", labelClassName)}>
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <label htmlFor={inputId} className={cn("min-w-0", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
          {label}
        </label>
      </span>
      {description && (
        <label
          htmlFor={inputId}
          className={cn(
            "mt-0.5 block text-[0.625rem] leading-relaxed text-[var(--marinara-chat-chrome-panel-muted)]",
            disabled ? "cursor-not-allowed" : "cursor-pointer",
          )}
        >
          {description}
        </label>
      )}
    </span>
  ) : null;

  return (
    <div
      id={anchorId}
      title={title}
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
