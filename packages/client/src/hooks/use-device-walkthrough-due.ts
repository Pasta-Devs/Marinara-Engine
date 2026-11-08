import { useOverhaulStore } from "../stores/overhaul.store";
import { useUIStore } from "../stores/ui.store";
import { useWalkthroughDevice, useWalkthroughRecord } from "../lib/walkthroughs";

/**
 * True when this kind of device (computer, tablet or phone) should show its walkthrough now: the new
 * layout is on, the user already finished the welcome tour (on any device, as synced settings say),
 * and this browser has not shown the walkthrough for its kind of device yet.
 */
export function useDeviceWalkthroughDue(): boolean {
  const overhaulEnabled = useOverhaulStore((s) => s.enabled);
  const settingsSyncReady = useUIStore((s) => s.settingsSyncReady);
  const hasCompletedOnboarding = useUIStore((s) => s.hasCompletedOnboarding);
  const device = useWalkthroughDevice();
  const record = useWalkthroughRecord();
  return overhaulEnabled && settingsSyncReady && hasCompletedOnboarding && !record.devices.includes(device);
}
