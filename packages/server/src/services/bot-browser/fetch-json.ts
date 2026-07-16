import { APP_VERSION } from "@marinara-engine/shared";
import { safeFetch, type SafeFetchOptions } from "../../utils/security.js";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const JSON_CONTENT_TYPES = ["application/json", "+json"];

export interface BotBrowserJsonFetchOptions extends Omit<
  SafeFetchOptions,
  "allowedContentTypes" | "allowMissingContentType" | "bufferResponse" | "maxResponseBytes" | "policy"
> {
  allowedHosts: readonly string[];
  maxResponseBytes?: number;
  timeoutMs?: number;
}

export async function fetchBotBrowserJson(url: string | URL, options: BotBrowserJsonFetchOptions): Promise<unknown> {
  const {
    allowedHosts,
    maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal: callerSignal,
    ...request
  } = options;
  const target = new URL(url);
  const normalizedHosts = new Set(allowedHosts.map((host) => host.toLowerCase()));
  if (target.protocol !== "https:" || !normalizedHosts.has(target.hostname)) {
    throw new Error(`Card Browser JSON request rejected untrusted host: ${target.hostname || "(missing)"}`);
  }

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) abortFromCaller();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = setTimeout(() => controller.abort(new Error("Card Browser request timed out")), timeoutMs);
  const headers = new Headers(request.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (!headers.has("User-Agent")) headers.set("User-Agent", `MarinaraEngine/${APP_VERSION}`);

  try {
    const response = await safeFetch(target, {
      ...request,
      headers,
      signal: controller.signal,
      policy: { allowedProtocols: ["https:"], maxRedirects: 0 },
      allowedContentTypes: JSON_CONTENT_TYPES,
      // Some trusted catalog APIs and Windows network intermediaries omit this
      // header. The bounded body must still parse as JSON below.
      allowMissingContentType: true,
      decodeCompressedResponse: true,
      maxResponseBytes,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Upstream ${response.status}: ${text.slice(0, 300)}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}
