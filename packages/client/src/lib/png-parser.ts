// ──────────────────────────────────────────────
// Utility: Parse SillyTavern PNG character cards
// Extracts JSON from tEXt/iTXt chunks with key "chara" or "ccv3"
// Supports V2 and V3 character card specs
// ──────────────────────────────────────────────

const CHARA_KEYWORDS = new Set(["ccv3", "chara"]);

/** Find the first null byte in a Uint8Array starting from `from`. */
function findNull(data: Uint8Array, from: number): number {
  for (let i = from; i < data.length; i++) {
    if (data[i] === 0) return i;
  }
  return -1;
}

/** Parse chunk text that may be raw JSON or base64-encoded JSON. */
function parseCharaChunkText(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    // Decode base64 → bytes → UTF-8 (atob alone produces Latin-1, breaking multi-byte chars)
    const raw = atob(text);
    const utf8Bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) utf8Bytes[i] = raw.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(utf8Bytes)) as Record<string, unknown>;
  }
}

/** Inflate a zlib (RFC 1950) stream — the encoding zTXt chunks use. */
async function inflateZlib(data: Uint8Array): Promise<Uint8Array> {
  const reader = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate")).getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalLength += value.byteLength;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const inflated = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    inflated.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return inflated;
}

/**
 * Reads a PNG file's text chunks and extracts character card JSON.
 * Checks for V3 "ccv3" keyword first, then falls back to V2 "chara".
 * Supports both tEXt and iTXt chunk types.
 * Returns the parsed JSON object and the raw PNG as a base64 data URL.
 */
export async function parsePngCharacterCard(
  file: File,
): Promise<{ json: Record<string, unknown>; imageDataUrl: string }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Verify PNG signature
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== signature[i]) {
      throw new Error("Not a valid PNG file");
    }
  }

  // Collect character data from all matching chunks; prefer "ccv3" over "chara"
  const found = new Map<string, Record<string, unknown>>();

  let offset = 8; // skip signature
  while (offset < bytes.length) {
    // Read chunk length (4 bytes, big-endian, UNSIGNED).
    // A signed read lets a high-bit length (e.g. 0x80000000) go negative and pin the chunk-walk.
    const length =
      ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
    offset += 4;

    // Bail on a malformed/crafted length: offset already passed the length field,
    // so type(4) + data(length) + CRC(4) must fit within the buffer.
    if (offset + 4 + length + 4 > bytes.length) break;

    // Read chunk type (4 bytes)
    const type = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    offset += 4;

    const chunkData = bytes.slice(offset, offset + length);

    if (type === "tEXt") {
      // tEXt chunk: keyword\0text
      const nullIdx = findNull(chunkData, 0);
      if (nullIdx > 0) {
        const keyword = new TextDecoder().decode(chunkData.slice(0, nullIdx));
        if (CHARA_KEYWORDS.has(keyword) && !found.has(keyword)) {
          const textData = new TextDecoder().decode(chunkData.slice(nullIdx + 1));
          // Decode base64 → bytes → UTF-8 (atob alone produces Latin-1, breaking multi-byte chars)
          const raw = atob(textData);
          const utf8Bytes = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) utf8Bytes[i] = raw.charCodeAt(i);
          const jsonStr = new TextDecoder().decode(utf8Bytes);
          found.set(keyword, JSON.parse(jsonStr) as Record<string, unknown>);
        }
      }
    } else if (type === "zTXt") {
      // zTXt chunk: keyword\0 compressionMethod(1 byte, 0 = zlib deflate) compressedText.
      // Character Tavern cards store their chara/ccv3 payloads this way.
      const nullIdx = findNull(chunkData, 0);
      if (nullIdx > 0) {
        const keyword = new TextDecoder().decode(chunkData.slice(0, nullIdx));
        if (CHARA_KEYWORDS.has(keyword) && !found.has(keyword) && chunkData[nullIdx + 1] === 0) {
          try {
            const inflated = await inflateZlib(chunkData.slice(nullIdx + 2));
            found.set(keyword, parseCharaChunkText(new TextDecoder().decode(inflated)));
          } catch {
            // Skip malformed compressed chunks; other chunks may still carry the card.
          }
        }
      }
    } else if (type === "iTXt") {
      // iTXt chunk: keyword\0 compressionFlag compressionMethod languageTag\0 translatedKeyword\0 text
      const nullIdx = findNull(chunkData, 0);
      if (nullIdx > 0) {
        const keyword = new TextDecoder().decode(chunkData.slice(0, nullIdx));
        if (CHARA_KEYWORDS.has(keyword) && !found.has(keyword)) {
          const compressionFlag = chunkData[nullIdx + 1];
          // Skip compressionMethod (1 byte), then find two more null-separated fields
          const langEnd = findNull(chunkData, nullIdx + 3);
          if (langEnd >= 0) {
            const transEnd = findNull(chunkData, langEnd + 1);
            if (transEnd >= 0) {
              const textBytes = chunkData.slice(transEnd + 1);
              if (compressionFlag === 0) {
                // Uncompressed UTF-8
                const text = new TextDecoder().decode(textBytes);
                // iTXt may be raw JSON or base64-encoded
                try {
                  found.set(keyword, JSON.parse(text) as Record<string, unknown>);
                } catch {
                  const raw = atob(text);
                  const utf8Bytes = new Uint8Array(raw.length);
                  for (let i = 0; i < raw.length; i++) utf8Bytes[i] = raw.charCodeAt(i);
                  const decoded = new TextDecoder().decode(utf8Bytes);
                  found.set(keyword, JSON.parse(decoded) as Record<string, unknown>);
                }
              }
              // Compressed iTXt is rare; skip for now
            }
          }
        }
      }
    }

    // Skip chunk data + 4-byte CRC; guard against a non-advancing cursor.
    const nextOffset = offset + length + 4;
    if (nextOffset <= offset) break;
    offset = nextOffset;

    // Safety: stop at IEND
    if (type === "IEND") break;
  }

  // Prefer ccv3 (V3 full data) over chara (V2 / backward-compat)
  const json = found.get("ccv3") ?? found.get("chara");
  if (!json) {
    throw new Error("No character data found in PNG — this doesn't appear to be a SillyTavern character card");
  }

  return { json, imageDataUrl: bytesToDataUrl(bytes, file.type || "image/png") };
}

/** Build a data URL from bytes already in memory (no FileReader — also runs under Node regressions). */
function bytesToDataUrl(bytes: Uint8Array, mimeType: string): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}
