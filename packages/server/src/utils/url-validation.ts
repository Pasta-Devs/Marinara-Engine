// ──────────────────────────────────────────────
// Utility: URL Validation (SSRF protection)
// ──────────────────────────────────────────────

/**
 * Check whether a hostname resolves to a private/reserved IP range.
 * Blocks RFC 1918, loopback, link-local, and cloud metadata addresses.
 */
export function isPrivateOrReservedHost(hostname: string): boolean {
  // Block obvious private hostnames
  if (hostname === "localhost" || hostname === "[::1]" || hostname === "metadata.google.internal") {
    return true;
  }

  // Check IP address patterns
  const ip = hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  return isPrivateIP(ip);
}

function isPrivateIP(ip: string): boolean {
  // IPv4 patterns
  const parts = ip.split(".");
  if (parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p))) {
    const octets = parts.map(Number);
    const [a, b] = octets as [number, number, number, number];
    // Loopback: 127.0.0.0/8
    if (a === 127) return true;
    // Private: 10.0.0.0/8
    if (a === 10) return true;
    // Private: 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // Private: 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // Link-local: 169.254.0.0/16 (includes cloud metadata 169.254.169.254)
    if (a === 169 && b === 254) return true;
    // Current network: 0.0.0.0/8
    if (a === 0) return true;
  }

  // IPv6 loopback
  if (ip === "::1" || ip === "::") return true;

  return false;
}

/**
 * Validate a URL string is safe for server-side requests (not targeting internal services).
 * Returns an error message if unsafe, or null if OK.
 */
export function validateExternalUrl(url: string): string | null {
  try {
    const parsed = new URL(url);

    // Only allow http/https
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "Only http and https URLs are allowed";
    }

    if (isPrivateOrReservedHost(parsed.hostname)) {
      return "URLs targeting private, loopback, or link-local addresses are not allowed";
    }

    return null;
  } catch {
    return "Invalid URL format";
  }
}
