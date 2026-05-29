import { useCallback, useEffect, useState } from "react";
import { Vibrate } from "lucide-react";
import { cn } from "../../../../../../shared/lib/utils";
import {
  HAPTIC_INTIFACE_URL_STORAGE_KEY,
  useHapticCommand,
  useHapticConnect,
  useHapticDisconnect,
  useHapticStartScan,
  useHapticStatus,
  useHapticStopAll,
  useHapticStopScan,
} from "../../../../../runtime/haptics/index";

interface HapticConnectionPanelProps {
  intifaceUrl?: string;
  onIntifaceUrlChange: (value: string | null) => void;
}

export function HapticConnectionPanel({
  intifaceUrl: savedIntifaceUrl,
  onIntifaceUrlChange,
}: HapticConnectionPanelProps) {
  const { data: status, isLoading } = useHapticStatus();
  const connect = useHapticConnect();
  const disconnect = useHapticDisconnect();
  const startScan = useHapticStartScan();
  const stopScan = useHapticStopScan();
  const command = useHapticCommand();
  const stopAll = useHapticStopAll();
  const [intifaceUrl, setIntifaceUrl] = useState(
    () => savedIntifaceUrl ?? localStorage.getItem(HAPTIC_INTIFACE_URL_STORAGE_KEY) ?? "",
  );
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);
  const [hapticActionError, setHapticActionError] = useState<unknown>(null);

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

  const clearHapticActionError = useCallback(() => {
    setHapticActionError(null);
  }, []);

  const handleHapticActionError = useCallback((error: unknown) => {
    setHapticActionError(() => error);
  }, []);

  useEffect(() => {
    if (autoConnectAttempted || isLoading || !status || status.connected || connect.isPending) return;
    setAutoConnectAttempted(true);
    const trimmed = saveIntifaceUrl();
    connect.mutate(trimmed || undefined);
  }, [autoConnectAttempted, connect, isLoading, saveIntifaceUrl, status]);

  if (isLoading) {
    return (
      <div className="rounded-lg bg-[var(--secondary)] px-3 py-2 text-[0.625rem] text-[var(--muted-foreground)]">
        Checking Intiface Central...
      </div>
    );
  }

  const connected = status?.connected ?? false;
  const devices = status?.devices ?? [];
  const scanning = status?.scanning ?? false;
  const defaultServerUrl = status?.defaultServerUrl ?? "ws://127.0.0.1:12345";
  const activeServerUrl = status?.serverUrl ?? defaultServerUrl;
  const scanActionPending = startScan.isPending || stopScan.isPending;
  const stopActionPending = command.isPending || stopAll.isPending;
  const hapticActionErrorMessage =
    hapticActionError instanceof Error ? hapticActionError.message : "The haptic action failed.";

  return (
    <div className="space-y-1.5 px-1">
      <label className="flex flex-col gap-1 rounded-lg bg-[var(--secondary)] px-3 py-2">
        <span className="text-[0.625rem] font-medium text-[var(--muted-foreground)]">Intiface URL</span>
        <input
          value={intifaceUrl}
          onChange={(event) => setIntifaceUrl(event.target.value)}
          onBlur={saveIntifaceUrl}
          placeholder={defaultServerUrl}
          className="rounded-md bg-[var(--background)] px-2.5 py-1.5 text-[0.6875rem] text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)]/55 focus:ring-[var(--primary)]/60"
        />
        <span className="text-[0.5625rem] leading-relaxed text-[var(--muted-foreground)]">
          Blank uses the server default. Docker or remote browser setups usually need ws://CLIENT_IP:12345.
        </span>
      </label>

      <div className="flex items-center justify-between rounded-lg bg-[var(--secondary)] px-3 py-2">
        <div className="min-w-0 flex items-center gap-1.5">
          <div className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-green-400" : "bg-red-400")} />
          <span className="min-w-0 truncate text-[0.625rem] text-[var(--muted-foreground)]">
            {connect.isPending
              ? `Connecting to ${intifaceUrl.trim() || defaultServerUrl}...`
              : connected
                ? `Connected: ${activeServerUrl}`
                : "Not connected"}
          </span>
        </div>
        <button
          onClick={() => {
            if (connected) {
              disconnect.mutate();
            } else {
              connect.mutate(saveIntifaceUrl() || undefined);
            }
          }}
          disabled={connect.isPending || disconnect.isPending}
          className="text-[0.625rem] font-medium text-[var(--primary)] hover:underline disabled:opacity-50"
        >
          {connected ? "Disconnect" : "Connect"}
        </button>
      </div>

      {connect.isError && !connected && (
        <p className="text-[0.625rem] text-red-400 px-1">
          Could not connect - make sure{" "}
          <a href="https://intiface.com/central/" target="_blank" rel="noopener noreferrer" className="underline">
            Intiface Central
          </a>{" "}
          is running and the server is started.
        </p>
      )}

      {connected && (
        <div className="space-y-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-[0.625rem] text-[var(--muted-foreground)]">
              {devices.length === 0 ? "No devices found" : `${devices.length} device${devices.length !== 1 ? "s" : ""}`}
            </span>
            <div className="flex items-center gap-2">
              {devices.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    clearHapticActionError();
                    stopAll.mutate(undefined, { onError: handleHapticActionError });
                  }}
                  disabled={stopActionPending}
                  className="text-[0.625rem] font-medium text-[var(--muted-foreground)] hover:text-[var(--primary)] hover:underline disabled:opacity-50"
                >
                  Stop all
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  clearHapticActionError();
                  if (scanning) {
                    stopScan.mutate(undefined, { onError: handleHapticActionError });
                  } else {
                    startScan.mutate(undefined, { onError: handleHapticActionError });
                  }
                }}
                disabled={scanActionPending}
                className="text-[0.625rem] font-medium text-[var(--primary)] hover:underline disabled:opacity-50"
              >
                {scanning ? "Stop scan" : "Scan for devices"}
              </button>
            </div>
          </div>
          {hapticActionError !== null && (
            <p className="px-1 text-[0.625rem] text-red-400">Haptic action failed - {hapticActionErrorMessage}</p>
          )}
          {devices.map((device) => (
            <div
              key={device.index}
              className="flex min-w-0 items-center gap-1.5 rounded-md bg-[var(--accent)]/50 px-2.5 py-1.5"
            >
              <Vibrate size="0.625rem" className="text-[var(--primary)]" />
              <span className="min-w-0 flex-1 truncate text-[0.625rem] font-medium">{device.name}</span>
              <span className="min-w-0 flex-1 truncate text-[0.5rem] text-[var(--muted-foreground)]">
                {device.capabilities.join(", ")}
              </span>
              <button
                type="button"
                onClick={() => {
                  clearHapticActionError();
                  command.mutate(
                    { deviceIndex: device.index, action: "stop" },
                    { onError: handleHapticActionError },
                  );
                }}
                disabled={stopActionPending}
                className="text-[0.5625rem] font-medium text-[var(--muted-foreground)] hover:text-[var(--primary)] hover:underline disabled:opacity-50"
              >
                Stop
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
