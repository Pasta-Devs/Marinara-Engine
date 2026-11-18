/**
 * Whether a connection's address points at a server on this computer or the home network
 * (Ollama, LM Studio, KoboldCpp, a llama-server of your own), rather than a cloud service.
 *
 * Such a server usually runs one or a few requests at a time on one graphics card, so
 * Marinara gives its requests a turn order and, unless the account says otherwise, sends
 * it one request at a time. A cloud address, or no address, is never local.
 */
export function isLocalServerAddress(address: string | null | undefined): boolean {
  const trimmed = address?.trim();
  if (!trimmed) return false;
  let host: string;
  try {
    host = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`).hostname.toLowerCase();
  } catch {
    return false;
  }
  host = host.replace(/^\[|\]$/gu, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".lan")) {
    return true;
  }
  if (host === "host.docker.internal" || host === "::1" || host === "0.0.0.0") return true;
  // IPv6 unique local (fc00::/7) and link-local (fe80::/10).
  if (/^f[cd][0-9a-f]{2}:/u.test(host) || /^fe[89ab][0-9a-f]:/u.test(host)) return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u.exec(host.replace(/^::ffff:/u, ""));
  if (!v4) return false;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  return (
    a === 127 ||
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    // Tailscale and other carrier-grade NAT addresses: another of your own machines.
    (a === 100 && b >= 64 && b <= 127)
  );
}

/** Requests a local server takes at once when its account leaves "Parallel requests" empty. */
export const LOCAL_SERVER_DEFAULT_PARALLEL = 1;
