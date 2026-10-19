import type { FastifyRequest } from "fastify";

/**
 * True when a request is for the API. The router matches the percent-decoded
 * path, so a raw-URL prefix test alone misses an encoded "/api" segment that
 * still reaches an API handler; the matched route pattern does not.
 */
export function isApiRequest(request: FastifyRequest): boolean {
  return request.url.startsWith("/api/") || request.routeOptions.url?.startsWith("/api/") === true;
}
