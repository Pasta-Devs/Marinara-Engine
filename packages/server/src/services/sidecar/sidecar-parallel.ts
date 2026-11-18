/**
 * How many requests the built-in chat model works on at once.
 *
 * llama-server gives every parallel slot its own share of context memory, so two slots
 * cost a second copy of the context (about 0.5 GB at 8,192 tokens on a typical model).
 * On a machine with room that buys a second request at nearly no speed cost; on a small
 * one it is the difference between loading and not. Auto (the setting's 0) picks two
 * when the model, two contexts and some room for everything else fit in the memory the
 * model lands on, and one otherwise. The pick uses total memory, not what is free right
 * now, so it does not change from one launch to the next with whatever else is open.
 */
import { totalmem } from "node:os";
import { KV_CACHE_BYTES_PER_TOKEN } from "./sidecar-footprint.js";

export type ParallelPlacement = "gpu" | "cpu" | "unknown";

/** Room left for the OS, the browser and other apps beside a model on system memory. */
const SYSTEM_RESERVE_MIN_BYTES = 4_000_000_000;
const SYSTEM_RESERVE_SHARE = 0.25;
/** Room left on a graphics card for the desktop and llama.cpp's own buffers. */
const GPU_RESERVE_BYTES = 1_500_000_000;
/** Metal may wire about this share of unified memory. */
const APPLE_GPU_SHARE = 0.75;

const KV_SCALE: Record<string, number> = { f16: 1, q8_0: 0.53, q4_0: 0.28 };

export function kvCacheBytes(contextSize: number, kvCacheType?: string): number {
  return Math.max(0, contextSize) * KV_CACHE_BYTES_PER_TOKEN * (KV_SCALE[kvCacheType ?? "f16"] ?? 1);
}

export function isPhoneRuntime(env: NodeJS.ProcessEnv = process.env, platform: string = process.platform): boolean {
  return platform === "android" || /com\.termux/u.test(env.PREFIX ?? "") || !!env.TERMUX_VERSION;
}

export interface AutoParallelInput {
  modelBytes: number | null;
  contextSize: number;
  kvCacheType?: string;
  placement: ParallelPlacement;
  /** Total bytes of the graphics card the model lands on, when it can be read. */
  gpuTotalBytes: number | null;
  systemTotalBytes?: number;
  platform?: string;
  arch?: string;
  phone?: boolean;
}

export function pickAutoParallel(input: AutoParallelInput): { jobs: number; reason: string } {
  if (input.phone ?? isPhoneRuntime()) return { jobs: 1, reason: "One at a time on a phone or tablet" };
  if (!input.modelBytes || input.modelBytes <= 0) return { jobs: 2, reason: "Two at a time: no model picked yet" };
  const systemTotal = input.systemTotalBytes ?? totalmem();
  const platform = input.platform ?? process.platform;
  const arch = input.arch ?? process.arch;
  let capacity: number | null;
  let reserve: number;
  if (input.placement === "gpu" && platform === "darwin" && arch === "arm64") {
    capacity = systemTotal * APPLE_GPU_SHARE;
    reserve = SYSTEM_RESERVE_MIN_BYTES;
  } else if (input.placement === "gpu") {
    capacity = input.gpuTotalBytes;
    reserve = GPU_RESERVE_BYTES;
  } else {
    capacity = systemTotal;
    reserve = Math.max(SYSTEM_RESERVE_MIN_BYTES, systemTotal * SYSTEM_RESERVE_SHARE);
  }
  // A card Marinara cannot read (AMD or Intel through Vulkan) keeps the old default.
  if (capacity === null) return { jobs: 2, reason: "Two at a time: this graphics card's memory can't be read" };
  const needForTwo = input.modelBytes + 2 * kvCacheBytes(input.contextSize, input.kvCacheType) + reserve;
  return needForTwo <= capacity
    ? { jobs: 2, reason: "Two at a time: there is room for both" }
    : { jobs: 1, reason: "One at a time: not enough memory for two" };
}
