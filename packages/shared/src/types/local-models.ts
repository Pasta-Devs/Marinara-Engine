/** Settings and status shared by every model Marinara runs on this machine. */

export type LocalModelSlotId = "main" | "utility" | "embedding" | "decision";

/** Minutes a built-in model may sit unused before it is unloaded; 0 keeps it loaded. */
export const LOCAL_MODEL_IDLE_UNLOAD_CHOICES = [5, 15, 30, 60, 0] as const;

export interface LocalModelSettings {
  /** Unload a built-in model after this many minutes without a request. 0 = never. */
  idleUnloadMinutes: number;
}

export const LOCAL_MODEL_DEFAULT_SETTINGS: LocalModelSettings = { idleUnloadMinutes: 15 };

export interface LocalModelMemoryReading {
  /** gpu: a graphics card's own memory; unified: Apple silicon; system: memory the CPU uses. */
  kind: "gpu" | "unified" | "system";
  name?: string;
  totalBytes: number;
  availableBytes: number;
}

export interface LocalModelSlotStatus {
  id: LocalModelSlotId;
  label: string;
  loaded: boolean;
  /** Working on a request right now. */
  busy: boolean;
  lastUsedAt: number | null;
  /** Set while the model is unloaded because it went unused. */
  unloadedForIdleAt: number | null;
  /** Set while the model is unloaded to make room for another built-in model. */
  unloadedForMemoryAt: number | null;
  /** Why the model may not fit, from the check before it last loaded. */
  memoryWarning: string | null;
  footprintBytes: number | null;
  placement: "gpu" | "cpu" | "unknown";
}

export interface LocalModelsStatus {
  settings: LocalModelSettings;
  slots: LocalModelSlotStatus[];
  memory: { system: LocalModelMemoryReading | null; gpu: LocalModelMemoryReading | null };
  /** The built-in chat model's slot count. Filled in by the route. */
  parallel?: SidecarParallelInfo;
}

/** How many replies the built-in chat model works on at once, and why. */
export interface SidecarParallelInfo {
  /** 0 = Auto. */
  setting: number;
  /** What it runs with (or would start with) now. */
  effective: number;
  /** Plain words for an Auto pick, e.g. "Only room for one at a time on this machine". */
  reason: string | null;
}
