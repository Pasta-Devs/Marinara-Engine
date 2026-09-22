import { AsyncLocalStorage } from "node:async_hooks";

import type { GenerationFallbackNotice, GenerationFallbackNotifier } from "@marinara-engine/shared";
export type {
  GenerationFallbackCategory,
  GenerationFallbackNotice,
  GenerationFallbackNotifier,
} from "@marinara-engine/shared";

export const GENERATION_FALLBACK_HEADER = "X-Marinara-Fallback-Used";

const fallbackNotifierContext = new AsyncLocalStorage<GenerationFallbackNotifier>();

export function runWithGenerationFallbackNotifier<T>(notifier: GenerationFallbackNotifier, callback: () => T): T {
  return fallbackNotifierContext.run(notifier, callback);
}

export async function notifyGenerationFallback(notice: GenerationFallbackNotice): Promise<void> {
  await fallbackNotifierContext.getStore()?.(notice);
}

export function encodeGenerationFallbackNotice(notice: GenerationFallbackNotice): string {
  return encodeURIComponent(JSON.stringify(notice));
}
