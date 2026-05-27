import { invokeTauri } from "./tauri-client";

export type UpdateCheckResponse = {
  currentVersion: string;
  latestVersion: string;
  releaseTag: string;
  releaseUrl: string;
  releaseNotes: string;
  publishedAt: string;
  updateAvailable: boolean;
  versionUpdate: boolean;
  installType: string;
  serverPlatform: string;
  clientPlatform?: string;
  updateMechanism: "manual-release";
  tauriUpdaterConfigured: boolean;
  applyAvailable: boolean;
  applyUnavailableReason: "tauri-updater-not-configured";
  manualUpdateCommand: string | null;
  manualUpdateHint: string;
};

export type UpdateApplyResponse = Omit<UpdateCheckResponse, "releaseNotes" | "publishedAt" | "updateAvailable" | "versionUpdate"> & {
  status: "manual_update_required";
  message: string;
};

export const updatesApi = {
  check: () => invokeTauri<UpdateCheckResponse>("update_check"),
  apply: (input: Pick<UpdateCheckResponse, "latestVersion" | "releaseTag" | "releaseUrl">) =>
    invokeTauri<UpdateApplyResponse>("update_apply", { input: { ...input, confirm: true } }),
};
