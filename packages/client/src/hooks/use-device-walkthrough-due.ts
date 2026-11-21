import { useEffect } from "react";
import { useOverhaulStore } from "../stores/overhaul.store";
import { useUIStore } from "../stores/ui.store";
import { useWalkthroughDevice, useWalkthroughRecord } from "../lib/walkthroughs";

/**
 * True when this kind of device (computer, tablet or phone) should show its walkthrough now: the new
 * layout is on, the user already finished the welcome tour (on any device, as synced settings say),
 * and neither this browser nor the synced settings say this kind of device already saw it. A second
 * computer (or a fresh browser) does not repeat the computer tour; a first phone still gets the phone one.
 */
export function useDeviceWalkthroughDue(): boolean {
  const overhaulEnabled = useOverhaulStore((s) => s.enabled);
  const settingsSyncReady = useUIStore((s) => s.settingsSyncReady);
  const hasCompletedOnboarding = useUIStore((s) => s.hasCompletedOnboarding);
  const syncedSeen = useUIStore((s) => s.walkthroughDevicesSeen);
  const device = useWalkthroughDevice();
  const record = useWalkthroughRecord();
  // Walkthroughs this browser saw before the list was synced count for every browser from now on.
  useEffect(() => {
    if (!settingsSyncReady) return;
    const seen = syncedSeen ?? [];
    const missing = record.devices.filter((d) => !seen.includes(d));
    if (missing.length > 0) useUIStore.setState({ walkthroughDevicesSeen: [...seen, ...missing] });
  }, [record, settingsSyncReady, syncedSeen]);
  return (
    overhaulEnabled &&
    settingsSyncReady &&
    hasCompletedOnboarding &&
    !record.devices.includes(device) &&
    !(syncedSeen ?? []).includes(device)
  );
}
