import { PROVIDERS, localAuthProviderBaseUrl } from "@marinara-engine/shared";

/** Resolve the base URL for a connection, falling back to the provider default. */
export function resolveBaseUrl(connection: { baseUrl: string | null; provider: string }): string {
  if (connection.baseUrl) return connection.baseUrl.replace(/\/+$/, "");
  // Subscription/login-backed providers own their endpoint internally, but
  // downstream callers gate on a non-empty baseUrl. Return a sentinel so the
  // gate passes; the provider ignores the value.
  const localAuthBaseUrl = localAuthProviderBaseUrl(connection.provider);
  if (localAuthBaseUrl) return localAuthBaseUrl;
  const providerDef = PROVIDERS[connection.provider as keyof typeof PROVIDERS];
  return providerDef?.defaultBaseUrl ?? "";
}
