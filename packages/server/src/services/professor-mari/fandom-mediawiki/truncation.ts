import type { WikiTruncation } from "./types.js";

export function byteLength(value: string) {
  return Buffer.byteLength(value, "utf8");
}

export function truncateUtf8(
  value: string,
  maxBytes: number,
  remedyHint?: string,
): { text: string; truncation?: WikiTruncation } {
  const totalBytes = byteLength(value);
  if (totalBytes <= maxBytes) return { text: value };

  let returnedBytes = 0;
  let endIndex = 0;
  for (const char of value) {
    const charBytes = byteLength(char);
    if (returnedBytes + charBytes > maxBytes) break;
    returnedBytes += charBytes;
    endIndex += char.length;
  }

  const text = value.slice(0, endIndex).trimEnd();
  return {
    text,
    truncation: {
      reason: "content_truncated",
      returnedBytes,
      totalBytes,
      remedyHint,
    },
  };
}

export function mergeTruncation(
  primary: WikiTruncation | undefined,
  secondary: WikiTruncation | undefined,
): WikiTruncation | undefined {
  if (!primary) return secondary;
  if (!secondary) return primary;
  return {
    ...primary,
    continueFrom: primary.continueFrom ?? secondary.continueFrom,
    remedyHint: primary.remedyHint ?? secondary.remedyHint,
  };
}
