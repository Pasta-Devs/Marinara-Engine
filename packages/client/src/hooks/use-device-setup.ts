// "On this device" items (decision 32/33): the built-in Local Model, Text to Speech, Speech to Text, the built-in
// voice model and the avatars' emotion model.
// One place says whether each can be used here and whether it is set up, for the Add window and the panel.
import { useEffect, useMemo } from "react";
import { useInstalledCapabilityPackages } from "./use-capability-packages";
import { useSpeechToTextConfig } from "./use-speech-to-text";
import { useTTSConfig } from "./use-tts";
import { useSidecarStore } from "../stores/sidecar.store";

export type DeviceItem = "local-model" | "tts" | "stt" | "builtin-tts" | "emotions";
export type DeviceItemState = { available: boolean; setUp: boolean };

const isLite = import.meta.env.VITE_MARINARA_LITE === "true";

export function useDeviceSetup(): Record<DeviceItem, DeviceItemState> {
  const modelDownloaded = useSidecarStore((s) => s.modelDownloaded);
  const { data: tts } = useTTSConfig();
  const { data: installedPackages } = useInstalledCapabilityPackages();
  // Only Calls records speech, so Speech to Text exists only with it (as on its settings card).
  const callsInstalled = (installedPackages ?? []).some(
    (item) => item.status !== "error" && item.manifest.kind.includes("conversation-calls"),
  );
  const { data: stt } = useSpeechToTextConfig(callsInstalled);

  useEffect(() => {
    if (!isLite) void useSidecarStore.getState().fetchStatus();
  }, []);

  return useMemo(
    () => ({
      "local-model": { available: !isLite, setUp: !isLite && modelDownloaded },
      tts: { available: true, setUp: !!tts?.enabled },
      stt: { available: callsInstalled, setUp: callsInstalled && !!stt?.enabled && !!stt.baseUrl?.trim() },
      // Their own pages say whether they are downloaded; both run only outside Lite.
      "builtin-tts": { available: !isLite, setUp: false },
      emotions: { available: !isLite, setUp: false },
    }),
    [callsInstalled, modelDownloaded, stt?.baseUrl, stt?.enabled, tts?.enabled],
  );
}
