import { toast } from "sonner";

import { triggerDownload, type DownloadPayload } from "../../../shared/api/download-payload";

export function getExportErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function toastExportError(error: unknown, fallback: string): void {
  toast.error(getExportErrorMessage(error, fallback));
}

export function triggerDownloadWithToast(payload: DownloadPayload, successMessage: string): void {
  triggerDownload(payload);
  toast.success(successMessage);
}
