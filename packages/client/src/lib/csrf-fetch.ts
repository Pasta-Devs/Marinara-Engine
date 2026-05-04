import { CSRF_HEADER, CSRF_HEADER_VALUE } from "@marinara-engine/shared";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isSameOriginApi(input: RequestInfo | URL): boolean {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && parsed.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

export function installCsrfFetchShim() {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

    if (!UNSAFE_METHODS.has(method) || !isSameOriginApi(input)) {
      return nativeFetch(input, init);
    }

    const request = new Request(input, init);
    request.headers.set(CSRF_HEADER, CSRF_HEADER_VALUE);
    return nativeFetch(request);
  };
}
