export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get payload() {
    return this.details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function parseRetryAfterMs(value: string | null): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const seconds = Number(trimmed);
  if (Number.isFinite(seconds)) {
    return Math.max(0, Math.ceil(seconds * 1000));
  }

  const retryAt = Date.parse(trimmed);
  if (!Number.isFinite(retryAt)) return null;
  return Math.max(0, retryAt - Date.now());
}

export function getApiErrorRetryAfterMs(error: unknown): number | null {
  if (!(error instanceof ApiError) || !isRecord(error.details)) return null;
  const retryAfterMs = error.details.retryAfterMs;
  return typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs) ? Math.max(0, retryAfterMs) : null;
}

export interface JsonRepairRequest {
  id?: string;
  title?: string;
  endpoint?: string;
  rawJson?: string;
  applyEndpoint: string;
  applyBody?: Record<string, unknown>;
  payload?: unknown;
  error?: string;
  [key: string]: unknown;
}

export function isJsonRepairApiError(error: unknown): boolean {
  return error instanceof ApiError && !!getJsonRepairRequest(error);
}

export function getJsonRepairRequest(error: unknown): JsonRepairRequest | null {
  if (!(error instanceof ApiError)) return null;
  const details = error.details;
  if (!isRecord(details)) return null;
  const request = (details as { jsonRepair?: unknown }).jsonRepair;
  if (!request || typeof request !== "object") return null;
  if (typeof (request as { applyEndpoint?: unknown }).applyEndpoint !== "string") return null;
  return request as JsonRepairRequest;
}
