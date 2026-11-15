import type { FastifyReply, FastifyRequest } from "fastify";

const SECURITY_HEADERS: Record<string, string> = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Origin-Agent-Cluster": "?1",
  // Keep user-authored remote media available without disclosing the local
  // Marinara URL in browser or CSS subresource requests.
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Permitted-Cross-Domain-Policies": "none",
};

const PERMISSIONS_POLICY = [
  "camera=(self)",
  "microphone=(self)",
  "display-capture=(self)",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "serial=()",
  "xr-spatial-tracking=()",
].join(", ");

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors %FRAME%",
  "object-src 'none'",
  "script-src 'self' https://sdk.scdn.co https://www.youtube.com https://s.ytimg.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' http: https: ws: wss:",
  "frame-src 'self' https://sdk.scdn.co https://accounts.spotify.com https://www.youtube.com https://www.youtube-nocookie.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");
// The new layout's split view shows its second page in a frame of the app itself, so the app's pages may be
// framed by the app (never by other sites). API responses and served files never need a frame: they keep
// DENY, so an uploaded or downloaded file can't be shown inside the app's own frame.
const APP_PAGE_CSP = CONTENT_SECURITY_POLICY.replace("%FRAME%", "'self'");
const API_CSP = CONTENT_SECURITY_POLICY.replace("%FRAME%", "'none'");

function isApiRequest(request: FastifyRequest): boolean {
  const url = request.raw.url ?? request.url ?? "";
  return url === "/api" || url.startsWith("/api/") || url.startsWith("/api?");
}

export function securityHeadersHook(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    reply.header(name, value);
  }
  // Raw SSE responses call reply.raw.writeHead and skip reply.header; Node merges setHeader values into writeHead.
  reply.raw.setHeader("X-Robots-Tag", "noindex, nofollow");
  reply.header("Permissions-Policy", PERMISSIONS_POLICY);
  const api = isApiRequest(request);
  reply.header("X-Frame-Options", api ? "DENY" : "SAMEORIGIN");
  reply.header("Content-Security-Policy", api ? API_CSP : APP_PAGE_CSP);
  done();
}
