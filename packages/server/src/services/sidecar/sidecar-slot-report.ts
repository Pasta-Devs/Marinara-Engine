/**
 * What every local model slot is currently costing, for `/api/health` and from there
 * for the Copy Diagnostics report.
 *
 * The existing `GPU:` line in that report is the *browser's* GPU, which says nothing
 * about the machine running the sidecars when the client is a phone or another PC.
 * These lines are about the server, and they are useful on their own for existing
 * "my local model won't load" reports, before any decision model is involved.
 *
 * Nothing here blocks: it reads a cached probe and the slots' own status, so the
 * health endpoint stays fast even when `nvidia-smi` is missing or slow.
 */
import type { SidecarHealthSection, SidecarLoadVerdict, SidecarSlotFootprint } from "@marinara-engine/shared";
import {
  assessSidecarLoad,
  estimateSlotBytes,
  getGpuProbe,
  getMeasuredProcessBytes,
  resolveSharedDevice,
} from "./sidecar-footprint.js";
import { sidecarModelService } from "./sidecar-model.service.js";
import { sidecarProcessService } from "./sidecar-process.service.js";
import { utilitySidecarService } from "../utility-sidecar/utility-sidecar.service.js";
import { decisionProcessService } from "./decision-process.service.js";
import { decisionSidecarSettings, installedDecisionModel } from "../decision/decision-slots.js";

/**
 * The main slot's status, cached briefly.
 *
 * This is the one expensive read in the section: it stats the model file, and on
 * macOS it can reach a synchronous `execFileSync` with a five-second timeout.
 * `/api/health` is polled and is the freeze detector's own signal, so that must not
 * land on every request.
 *
 * Only the model's identity and size are cached. Whether the slot is running, and the
 * memory it actually holds, are read live on every call: a report that says "stopped"
 * for a minute after the user started their model is the kind of wrong detail these
 * lines exist to prevent.
 */
const MAIN_STATUS_CACHE_MS = 10_000;
let cachedMainStatus: { status: ReturnType<typeof sidecarModelService.getStatus>; at: number } | null = null;

function mainStatus() {
  const now = Date.now();
  if (cachedMainStatus && now - cachedMainStatus.at <= MAIN_STATUS_CACHE_MS) return cachedMainStatus.status;
  const status = sidecarModelService.getStatus();
  cachedMainStatus = { status, at: now };
  return status;
}

function mainSlot(): SidecarSlotFootprint {
  const status = mainStatus();
  const running = sidecarProcessService.isReady();
  // gpuLayers 0 means the model runs on the CPU, so it is weighed against system
  // memory rather than counted against the card.
  const onCpu = status.config.gpuLayers === 0;
  const measuredBytes = running && !onCpu ? getMeasuredProcessBytes(sidecarProcessService.getProcessId()) : null;
  return {
    slot: "main",
    configured: status.modelDownloaded,
    running,
    model: status.modelDisplayName,
    fileBytes: status.modelSize,
    contextSize: status.config.contextSize,
    backend: status.runtime.variant ?? status.config.backend,
    estimatedBytes: status.modelDownloaded
      ? estimateSlotBytes({ fileBytes: status.modelSize, contextSize: status.config.contextSize, measuredBytes })
      : null,
    measured: measuredBytes !== null,
    onCpu,
  };
}

function utilitySlot(): SidecarSlotFootprint {
  const status = utilitySidecarService.getStatus();
  const active = status.activeModelId ? status.models[status.activeModelId] : undefined;
  const onCpu = status.settings.gpuLayers === 0;
  const measuredBytes = status.ready && !onCpu ? getMeasuredProcessBytes(utilitySidecarService.getProcessId()) : null;
  return {
    slot: "utility",
    configured: !!active,
    running: status.ready,
    model: status.activeModelId,
    fileBytes: active?.bytes ?? null,
    contextSize: status.settings.contextSize,
    backend: status.runtimeInstalled ? "llama_cpp" : null,
    estimatedBytes: active
      ? estimateSlotBytes({
          fileBytes: active.bytes ?? null,
          contextSize: status.settings.contextSize,
          measuredBytes,
        })
      : null,
    measured: measuredBytes !== null,
    onCpu,
  };
}

/**
 * The managed decision sidecar's slot.
 *
 * Reported even when nothing is installed, so the report's shape does not change with
 * the user's setup and a reader can tell "not installed" from "not reported".
 */
function decisionSlot(): SidecarSlotFootprint {
  const settings = decisionSidecarSettings();
  const model = installedDecisionModel(settings);
  const status = decisionProcessService.getStatus();
  const measuredBytes = status.running ? getMeasuredProcessBytes(status.pid) : null;
  return {
    slot: "decision",
    configured: !!model,
    running: status.running,
    model: model?.label ?? null,
    fileBytes: model?.downloadSizeBytes ?? null,
    contextSize: model?.maxLengthTokens ?? null,
    backend: model?.runtime ?? null,
    // The catalog figure is a measurement from a real run, so it is used directly
    // rather than derived from a file size the way a GGUF slot's is.
    estimatedBytes: measuredBytes ?? model?.vramBytes ?? null,
    measured: measuredBytes !== null,
    onCpu: false,
  };
}

/**
 * A stored verdict is a string from an older release or a hand-edited settings file,
 * so it is matched against the set this build knows rather than cast into it.
 */
function normalizeLoadVerdict(value: string | null): SidecarLoadVerdict {
  const known: SidecarLoadVerdict[] = [
    "unsupported",
    "not_enough_disk",
    "wont_fit",
    "wont_fit_beside_sidecar",
    "tight",
    "recommended",
  ];
  return known.find((verdict) => verdict === value) ?? "recommended";
}

/** The slot readings, shared by the health section and the decision preflight. */
export function readSidecarSlots(): SidecarSlotFootprint[] {
  return [mainSlot(), utilitySlot(), decisionSlot()];
}

export function buildSidecarHealthSection(): SidecarHealthSection {
  const gpu = getGpuProbe();
  const slots = readSidecarSlots();
  // With one NVIDIA GPU every slot shares it. With several, llama.cpp's launch
  // diagnostics do not name the card a slot landed on, so no device is resolved and
  // no verdict is claimed rather than a wrong one asserted.
  const device = resolveSharedDevice(gpu.devices, null);
  const load =
    device && slots.some((slot) => slot.configured && !slot.onCpu) ? assessSidecarLoad({ slots, device }) : null;
  const settings = decisionSidecarSettings();
  return {
    gpu,
    slots,
    load,
    // Only meaningful once someone turned it on. Recording what they were shown at
    // that moment is the difference between an informed choice and a surprise.
    decisionConsent:
      settings.enabled && settings.confirmedAt
        ? {
            confirmedAt: settings.confirmedAt,
            verdict: normalizeLoadVerdict(settings.confirmedVerdict),
          }
        : null,
  };
}
