import { useCallback, useEffect, useState } from "react";
import { Vibrate } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  HAPTIC_INTIFACE_URL_STORAGE_KEY,
  useHapticConnect,
  useHapticDisconnect,
  useHapticStartScan,
  useHapticStatus,
} from "../../hooks/use-haptic";
import { AgentSettingsActionButton } from "./AgentSettingsControls";

interface HapticConnectionPanelProps {
  intifaceUrl?: string;
  onIntifaceUrlChange: (value: string | null) => void;
}

export function HapticConnectionPanel({
  intifaceUrl: savedIntifaceUrl,
  onIntifaceUrlChange,
}: HapticConnectionPanelProps) {
  const { t: localizeUi } = useTranslation();
  const { data: status, isLoading } = useHapticStatus();
  const connect = useHapticConnect();
  const disconnect = useHapticDisconnect();
  const startScan = useHapticStartScan();
  const [intifaceUrl, setIntifaceUrl] = useState(
    () => savedIntifaceUrl ?? localStorage.getItem(HAPTIC_INTIFACE_URL_STORAGE_KEY) ?? "",
  );
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);

  useEffect(() => {
    setIntifaceUrl(savedIntifaceUrl ?? localStorage.getItem(HAPTIC_INTIFACE_URL_STORAGE_KEY) ?? "");
  }, [savedIntifaceUrl]);

  const saveIntifaceUrl = useCallback(() => {
    const trimmed = intifaceUrl.trim();
    if (trimmed) {
      localStorage.setItem(HAPTIC_INTIFACE_URL_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(HAPTIC_INTIFACE_URL_STORAGE_KEY);
    }
    if ((savedIntifaceUrl ?? "") !== trimmed) {
      onIntifaceUrlChange(trimmed || null);
    }
    return trimmed;
  }, [intifaceUrl, onIntifaceUrlChange, savedIntifaceUrl]);

  useEffect(() => {
    if (autoConnectAttempted || isLoading || !status || status.connected || connect.isPending) return;
    setAutoConnectAttempted(true);
    connect.mutate(intifaceUrl.trim() || undefined);
  }, [autoConnectAttempted, connect, intifaceUrl, isLoading, status]);

  if (isLoading) {
    return (
      <div className="rounded-lg bg-[var(--secondary)] px-3 py-2 text-[0.625rem] text-[var(--muted-foreground)]">
        {localizeUi("ui.chat.hapticconnectionpanel.checkingIntifaceCentral")}
      </div>
    );
  }

  const connected = status?.connected ?? false;
  const devices = status?.devices ?? [];
  const scanning = status?.scanning ?? false;
  const defaultServerUrl = status?.defaultServerUrl ?? "ws://127.0.0.1:12345";
  const activeServerUrl = status?.serverUrl ?? defaultServerUrl;

  return (
    <div className="space-y-1.5 px-1">
      <label className="flex flex-col gap-1 rounded-lg bg-[var(--secondary)] px-3 py-2">
        <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.hapticsetupfields.intifaceUrl")}
        </span>
        <input
          value={intifaceUrl}
          onChange={(event) => setIntifaceUrl(event.target.value)}
          onBlur={saveIntifaceUrl}
          placeholder={defaultServerUrl}
          className="mari-chrome-field rounded-md px-2.5 py-1.5 text-[0.6875rem] placeholder:text-[var(--muted-foreground)]/55"
        />
        <span className="text-[0.5625rem] leading-relaxed text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.hapticconnectionpanel.blankUsesTheServerDefaultDockerOrRemoteBrowser")}
        </span>
      </label>

      <div className="flex items-center justify-between rounded-lg bg-[var(--secondary)] px-3 py-2">
        <div className="min-w-0 flex items-center gap-1.5">
          <div
            className={
              connected || connect.isPending || connect.isError
                ? "h-1.5 w-1.5 rounded-full bg-[var(--primary)]"
                : "h-1.5 w-1.5 rounded-full bg-[var(--muted-foreground)]/40"
            }
          />
          <span
            className={
              connected || connect.isPending || connect.isError
                ? "min-w-0 truncate text-[0.625rem] text-[var(--primary)]"
                : "min-w-0 truncate text-[0.625rem] text-[var(--muted-foreground)]"
            }
          >
            {connect.isPending
              ? localizeUi("ui.chat.hapticconnectionpanel.connectingToValue1", {
                  value1: intifaceUrl.trim() || defaultServerUrl,
                })
              : connected
                ? localizeUi("ui.chat.hapticconnectionpanel.connectedValue1", { value1: activeServerUrl })
                : localizeUi("ui.chat.hapticconnectionpanel.notConnected")}
          </span>
        </div>
        <AgentSettingsActionButton
          onClick={() => {
            if (connected) {
              disconnect.mutate();
            } else {
              connect.mutate(saveIntifaceUrl() || undefined);
            }
          }}
          disabled={connect.isPending || disconnect.isPending}
          variant="primary"
        >
          {connected
            ? localizeUi("ui.agents.agenteditor.disconnect")
            : localizeUi("ui.chat.hapticconnectionpanel.connect")}
        </AgentSettingsActionButton>
      </div>

      {connect.isError && !connected && (
        <p className="px-1 text-[0.625rem] text-[var(--primary)]">
          {localizeUi("ui.chat.hapticconnectionpanel.couldNotConnectMakeSure")}{" "}
          <a href="https://intiface.com/central/" target="_blank" rel="noopener noreferrer" className="underline">
            {localizeUi("ui.chat.hapticconnectionpanel.intifaceCentral")}
          </a>{" "}
          {localizeUi("ui.chat.hapticconnectionpanel.isRunningAndTheServerIsStarted")}
        </p>
      )}

      {connected && (
        <div className="space-y-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-[0.625rem] text-[var(--muted-foreground)]">
              {devices.length === 0
                ? localizeUi("ui.chat.hapticconnectionpanel.noDevicesFound")
                : localizeUi("ui.chat.hapticconnectionpanel.value1DeviceValue2", {
                    value1: devices.length,
                    value2: devices.length !== 1 ? localizeUi("ui.noodle.stageprofileview.s") : "",
                  })}
            </span>
            <AgentSettingsActionButton
              onClick={() => startScan.mutate()}
              disabled={scanning || startScan.isPending}
              variant="primary"
            >
              {scanning
                ? localizeUi("ui.chat.hapticconnectionpanel.scanning")
                : localizeUi("ui.chat.hapticconnectionpanel.scanForDevices")}
            </AgentSettingsActionButton>
          </div>
          {devices.map((device) => (
            <div
              key={device.index}
              className="flex items-center gap-1.5 rounded-md bg-[var(--accent)]/50 px-2.5 py-1.5"
            >
              <Vibrate size="0.625rem" className="text-[var(--primary)]" />
              <span className="text-[0.625rem] font-medium">{device.name}</span>
              <span className="text-[0.5rem] text-[var(--muted-foreground)]">{device.capabilities.join(", ")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
