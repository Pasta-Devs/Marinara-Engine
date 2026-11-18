/**
 * Reading a GGUF's header over the network, before anything downloads.
 *
 * A pasted repository is judged by what its weights declare, not by its name. A GGUF
 * keeps its metadata at the front of the file, so a ranged read of the first few
 * megabytes says which architecture it is and whether it declares itself a decision
 * model, without fetching gigabytes to find out.
 */

/** Native decision types the pinned llama.cpp build (b12503) serves on `/v1/systemone`. */
export const LLAMA_SYSTEMONE_DECISION_TYPES = new Set([
  "openjev",
  "lev",
  "kev",
  "nimble",
  "laya",
  "clef",
  "pplx-decider",
  "vllm-decision2",
  "vllm-d3",
  "lfm2-d1",
  "lfm2-d1-omni",
  "granite-switch",
  "h2o-lightning",
  "minicpm-ocr-jev",
  "lfm3-d1",
  "lfm3-d1-omni",
]);

export interface GgufHeader {
  architecture: string | null;
  /** `<architecture>.decision.type`, when the file declares one. */
  decisionType: string | null;
  /** `<architecture>.context_length`, when present. */
  contextLength: number | null;
}

class NeedMore extends Error {}

const FIXED_SIZES: Record<number, number> = { 0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 4, 7: 1, 10: 8, 11: 8, 12: 8 };
const STRING = 8;
const ARRAY = 9;
/** Keys and strings longer than this are not metadata a decision model writes. */
const MAX_STRING = 1 << 20;

/**
 * Parse as much of the key/value section as `bytes` holds.
 *
 * Throws `NeedMore` when the wanted keys may still be further on, so the caller can
 * fetch a longer prefix. Returns as soon as the architecture's decision key is seen.
 */
export function parseGgufHeader(bytes: Uint8Array): GgufHeader {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  const need = (count: number) => {
    if (offset + count > bytes.byteLength) throw new NeedMore();
  };
  const u32 = () => {
    need(4);
    const value = view.getUint32(offset, true);
    offset += 4;
    return value;
  };
  const u64 = () => {
    need(8);
    const value = view.getBigUint64(offset, true);
    offset += 8;
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("GGUF value out of range");
    return Number(value);
  };
  const str = () => {
    const length = u64();
    if (length > MAX_STRING) throw new Error("GGUF string too long");
    need(length);
    const value = new TextDecoder().decode(bytes.subarray(offset, offset + length));
    offset += length;
    return value;
  };
  const number = (type: number): number | null => {
    const size = FIXED_SIZES[type];
    if (size === undefined) throw new Error(`Unknown GGUF value type ${type}`);
    need(size);
    let value: number | null = null;
    if (type === 4) value = view.getUint32(offset, true);
    else if (type === 5) value = view.getInt32(offset, true);
    else if (type === 10) value = Number(view.getBigUint64(offset, true));
    else if (type === 11) value = Number(view.getBigInt64(offset, true));
    offset += size;
    return value;
  };
  const skipValue = (type: number) => {
    if (type === STRING) {
      str();
      return;
    }
    if (type === ARRAY) {
      const itemType = u32();
      const count = u64();
      if (itemType === STRING) {
        for (let index = 0; index < count; index++) str();
        return;
      }
      const size = FIXED_SIZES[itemType];
      if (size === undefined) throw new Error(`Unknown GGUF array type ${itemType}`);
      need(size * count);
      offset += size * count;
      return;
    }
    number(type);
  };

  need(4);
  if (new TextDecoder().decode(bytes.subarray(0, 4)) !== "GGUF") throw new Error("Not a GGUF file");
  offset = 4;
  const version = u32();
  if (version < 2 || version > 3) throw new Error(`Unsupported GGUF version ${version}`);
  u64(); // tensor count
  const kvCount = u64();
  const header: GgufHeader = { architecture: null, decisionType: null, contextLength: null };
  for (let index = 0; index < kvCount; index++) {
    const key = str();
    const type = u32();
    if (key === "general.architecture" && type === STRING) header.architecture = str();
    else if (header.architecture && key === `${header.architecture}.decision.type` && type === STRING)
      header.decisionType = str();
    else if (header.architecture && key === `${header.architecture}.context_length`)
      header.contextLength = number(type);
    else skipValue(type);
    if (header.architecture && header.decisionType && header.contextLength !== null) return header;
  }
  return header;
}

/**
 * The header of a GGUF on the Hub, read with ranged requests of growing length.
 *
 * Null when the file cannot be read or is not a GGUF. Metadata past 64 MB (a huge
 * tokenizer before the keys that matter) is treated as unreadable rather than
 * downloading the model to find out.
 */
export async function readRemoteGgufHeader(url: string): Promise<GgufHeader | null> {
  for (const length of [2_000_000, 16_000_000, 64_000_000]) {
    let bytes: Uint8Array;
    try {
      const response = await fetch(url, {
        headers: { Range: `bytes=0-${length - 1}` },
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok || !response.body) return null;
      bytes = await readAtMost(response.body, length);
    } catch {
      return null;
    }
    try {
      return parseGgufHeader(bytes);
    } catch (error) {
      if (!(error instanceof NeedMore) || bytes.byteLength < length) return null;
    }
  }
  return null;
}

/**
 * At most `limit` bytes of a body, then the rest is cancelled. A server that ignores
 * the Range header answers with the whole file, and this read must never become the
 * download it exists to avoid.
 */
async function readAtMost(body: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const out = new Uint8Array(Math.min(total, limit));
  let offset = 0;
  for (const chunk of chunks) {
    const take = Math.min(chunk.byteLength, out.byteLength - offset);
    out.set(chunk.subarray(0, take), offset);
    offset += take;
    if (offset >= out.byteLength) break;
  }
  return out;
}

/** Quantizations in the order Marinara picks them: small and accurate enough first. */
const QUANT_PREFERENCE = [
  "Q4_K_M",
  "Q5_K_M",
  "Q8_0",
  "Q6_K",
  "Q4_K_S",
  "Q5_K_S",
  "IQ4_XS",
  "Q4_0",
  "F16",
  "BF16",
  "F32",
];

/**
 * The model GGUF to install from a repository's file list.
 *
 * Projector, vision-side and split files are left out: a decision model reads text, and
 * a split model would need every part. `quant` is the `:Q8_0` a user may add after the
 * repository name; without it the first match in `QUANT_PREFERENCE` wins.
 */
export function pickGgufFile(
  files: Array<{ path: string; size: number }>,
  quant?: string,
): { path: string; size: number } | null {
  const candidates = files.filter((file) => {
    const name = file.path.slice(file.path.lastIndexOf("/") + 1);
    return (
      name.toLowerCase().endsWith(".gguf") && !/mmproj|vision|projector|-\d{5}-of-\d{5}/iu.test(name) && file.size > 0
    );
  });
  const hasQuant = (path: string, wanted: string) =>
    new RegExp(`(^|[^A-Za-z0-9])${wanted.replace(/[^A-Za-z0-9_]/gu, "")}([^A-Za-z0-9]|$)`, "iu").test(
      path.slice(path.lastIndexOf("/") + 1).replace(/\.gguf$/iu, ""),
    );
  if (quant) return candidates.find((file) => hasQuant(file.path, quant)) ?? null;
  for (const wanted of QUANT_PREFERENCE) {
    const found = candidates.find((file) => hasQuant(file.path, wanted));
    if (found) return found;
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

/**
 * The vision projector a repository publishes beside its weights, when it has one.
 *
 * Read by name (`mmproj`, `vision`, `projector`), as llama.cpp's own tooling does. With
 * several, the 8-bit one is preferred, then 16-bit, then the first: the projector is
 * small next to the weights and reads pictures as well at 8 bits.
 */
export function pickProjectorFile(files: Array<{ path: string; size: number }>): { path: string; size: number } | null {
  const candidates = files.filter((file) => {
    const name = file.path.slice(file.path.lastIndexOf("/") + 1);
    return (
      name.toLowerCase().endsWith(".gguf") &&
      /mmproj|vision|projector/iu.test(name) &&
      !/-\d{5}-of-\d{5}/iu.test(name) &&
      file.size > 0
    );
  });
  for (const wanted of [/q8_0/iu, /f16/iu]) for (const file of candidates) if (wanted.test(file.path)) return file;
  return candidates[0] ?? null;
}
