// ──────────────────────────────────────────────
// Experience files (Capability API 1.373): an Experience as one plain JSON file, `<name>.experience.json`,
// in place of a package zip. Nothing in it is compressed, so what it holds is never more than the file
// itself, and it carries no code: only pictures, music and data, each named, sized and hashed in its
// manifest.
//
//   { "format": "marinara-experience", "version": 1,
//     "manifest": { …the package manifest, kind ["experience"]… },
//     "files": { "<path>": "<base64>", … } }
//
// The keys come in that order, so a reader learns everything it needs to show before an import from the
// start of the file alone: the review reads the manifest and stops, and the import reads the files as a
// stream, one at a time, so a file of any size is never held whole. Read strictly: escapes in a file's
// path, whitespace inside its base64, a key out of place or a repeated file are refused.
// ──────────────────────────────────────────────
import {
  capabilityPackageManifestSchema,
  type CapabilityPackageManifest,
} from "../../schemas/capability-package.schema.js";

export const EXPERIENCE_FILE_FORMAT = "marinara-experience";
export const EXPERIENCE_FILE_VERSION = 1;
export const EXPERIENCE_FILE_EXTENSION = ".experience.json";
/** The request body type an Engine's import route reads the file as. */
export const EXPERIENCE_FILE_CONTENT_TYPE = "application/vnd.marinara.experience+json";
/** The largest manifest an Experience file may carry (the package manifest's own cap). */
export const EXPERIENCE_FILE_MANIFEST_MAX_BYTES = 1024 * 1024;
/** Everything before the manifest is a few fixed keys; this is the most the reader looks through for it. */
export const EXPERIENCE_FILE_HEADER_MAX_BYTES = EXPERIENCE_FILE_MANIFEST_MAX_BYTES + 4096;
/** The longest file path (the manifest's own limit). */
const PATH_MAX_BYTES = 240;

/** What an Experience may carry, by extension: passive media and data, nothing that runs. */
export const EXPERIENCE_FILE_TYPES = Object.freeze({
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  ogg: "audio",
  mp3: "audio",
  wav: "audio",
  json: "data",
} as const);
export type ExperienceFileType = (typeof EXPERIENCE_FILE_TYPES)[keyof typeof EXPERIENCE_FILE_TYPES];

/** A file's type by its extension, or null for anything an Experience may not carry. */
export function experienceFileType(path: string): ExperienceFileType | null {
  const match = /\.([A-Za-z0-9]+)$/u.exec(path);
  const extension = match?.[1]?.toLowerCase();
  return extension && Object.hasOwn(EXPERIENCE_FILE_TYPES, extension)
    ? EXPERIENCE_FILE_TYPES[extension as keyof typeof EXPERIENCE_FILE_TYPES]
    : null;
}

export class ExperienceFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExperienceFileError";
  }
}

export type ExperienceFileEvent =
  | { type: "manifest"; manifest: unknown }
  | { type: "file-start"; path: string }
  | { type: "file-data"; path: string; data: Uint8Array }
  | { type: "file-end"; path: string; bytes: number }
  | { type: "end" };

const encoder = new TextEncoder();
const strictDecoder = new TextDecoder("utf-8", { fatal: true });

/** The header's fixed tokens in order, the manifest's value standing between `"manifest":` and `,`. */
const BEFORE_MANIFEST = ["{", '"format"', ":", JSON.stringify(EXPERIENCE_FILE_FORMAT), ",", '"version"', ":"].map(
  (token) => encoder.encode(token),
);
const MANIFEST_KEY = [",", '"manifest"', ":"].map((token) => encoder.encode(token));
const FILES_KEY = [",", '"files"', ":", "{"].map((token) => encoder.encode(token));

const QUOTE = 0x22;
const BACKSLASH = 0x5c;
const OPEN_BRACE = 0x7b;
const CLOSE_BRACE = 0x7d;
const COMMA = 0x2c;
const COLON = 0x3a;
const EQUALS = 0x3d;

const isWhitespace = (byte: number) => byte === 0x20 || byte === 0x0a || byte === 0x0d || byte === 0x09;

/** Base64 alphabet value by byte, -1 for anything else. */
const BASE64 = (() => {
  const table = new Int16Array(256).fill(-1);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (let index = 0; index < alphabet.length; index += 1) table[alphabet.charCodeAt(index)] = index;
  return table;
})();

type State =
  | { at: "tokens"; tokens: Uint8Array[]; token: number; offset: number; then: "version" | "manifest" | "files" }
  | { at: "version"; digits: string }
  | { at: "manifest"; started: boolean; depth: number; inString: boolean; escaped: boolean }
  | { at: "file-key-or-end"; afterComma: boolean }
  | { at: "file-key" }
  | { at: "file-colon" }
  | { at: "file-open" }
  | { at: "file-data" }
  | { at: "after-file" }
  | { at: "close" }
  | { at: "done" };

/**
 * Reads an Experience file as it arrives, chunk by chunk, and says what it found: the manifest, then each
 * file's start, data and end. It never holds more than the manifest and one chunk's decoded bytes, and
 * it throws {@link ExperienceFileError} at the first byte out of place.
 */
export class ExperienceFileReader {
  private state: State = { at: "tokens", tokens: BEFORE_MANIFEST, token: 0, offset: 0, then: "version" };
  private consumed = 0;
  private manifestParts: Uint8Array[] = [];
  private manifestLength = 0;
  private keyBytes: number[] = [];
  private path = "";
  private readonly paths = new Set<string>();
  private quad = new Uint8Array(4);
  private quadLength = 0;
  private padding = 0;
  private fileBytes = 0;
  private output = new Uint8Array(0);
  private outputLength = 0;

  /** The bytes read so far. */
  get bytesRead(): number {
    return this.consumed;
  }

  push(chunk: Uint8Array): ExperienceFileEvent[] {
    const events: ExperienceFileEvent[] = [];
    // Where this chunk's share of the manifest begins: its start when the manifest began in an earlier one.
    let manifestStart = this.state.at === "manifest" && this.state.started ? 0 : -1;
    for (let index = 0; index < chunk.length; index += 1) {
      const byte = chunk[index]!;
      const state = this.state;
      this.consumed += 1;
      switch (state.at) {
        case "tokens": {
          const token = state.tokens[state.token]!;
          if (state.offset === 0 && isWhitespace(byte)) break;
          if (byte !== token[state.offset]) this.fail("This is not an Experience file.");
          state.offset += 1;
          if (state.offset === token.length) {
            state.token += 1;
            state.offset = 0;
            if (state.token === state.tokens.length) {
              if (state.then === "version") this.state = { at: "version", digits: "" };
              else if (state.then === "manifest")
                this.state = { at: "manifest", started: false, depth: 0, inString: false, escaped: false };
              else this.state = { at: "file-key-or-end", afterComma: false };
            }
          }
          break;
        }
        case "version": {
          if (byte >= 0x30 && byte <= 0x39 && state.digits.length < 6) {
            state.digits += String.fromCharCode(byte);
            break;
          }
          if (!state.digits) {
            if (isWhitespace(byte)) break;
            this.fail("This is not an Experience file.");
          }
          if (state.digits !== String(EXPERIENCE_FILE_VERSION)) {
            this.fail(
              `This Experience file is version ${state.digits}; this Engine reads version ${EXPERIENCE_FILE_VERSION}.`,
            );
          }
          this.state = { at: "tokens", tokens: MANIFEST_KEY, token: 0, offset: 0, then: "manifest" };
          index -= 1;
          this.consumed -= 1;
          break;
        }
        case "manifest": {
          if (!state.started) {
            if (isWhitespace(byte)) break;
            if (byte !== OPEN_BRACE) this.fail("The Experience file's manifest is not an object.");
            state.started = true;
            manifestStart = index;
          }
          if (state.inString) {
            if (state.escaped) state.escaped = false;
            else if (byte === BACKSLASH) state.escaped = true;
            else if (byte === QUOTE) state.inString = false;
          } else if (byte === QUOTE) state.inString = true;
          else if (byte === OPEN_BRACE || byte === 0x5b) state.depth += 1;
          else if (byte === CLOSE_BRACE || byte === 0x5d) {
            state.depth -= 1;
            if (state.depth === 0) {
              this.keepManifest(chunk.subarray(manifestStart, index + 1));
              manifestStart = -1;
              events.push({ type: "manifest", manifest: this.parseManifest() });
              this.state = { at: "tokens", tokens: FILES_KEY, token: 0, offset: 0, then: "files" };
              break;
            }
          }
          if (this.manifestLength + (index - manifestStart + 1) > EXPERIENCE_FILE_MANIFEST_MAX_BYTES) {
            this.fail("The Experience file's manifest is too large.");
          }
          break;
        }
        case "file-key-or-end": {
          if (isWhitespace(byte)) break;
          if (byte === CLOSE_BRACE && !state.afterComma) {
            this.state = { at: "close" };
            break;
          }
          if (byte !== QUOTE) this.fail("The Experience file's files do not read.");
          this.keyBytes = [];
          this.state = { at: "file-key" };
          break;
        }
        case "file-key": {
          if (byte === QUOTE) {
            let path: string;
            try {
              path = strictDecoder.decode(Uint8Array.from(this.keyBytes));
            } catch {
              this.fail("A file name in the Experience file does not read.");
            }
            if (!path) this.fail("A file in the Experience file has no name.");
            if (this.paths.has(path)) this.fail(`The Experience file holds ${path} twice.`);
            this.paths.add(path);
            this.path = path;
            this.state = { at: "file-colon" };
            break;
          }
          if (byte === BACKSLASH || byte < 0x20) this.fail("A file name in the Experience file does not read.");
          if (this.keyBytes.length >= PATH_MAX_BYTES) this.fail("A file name in the Experience file is too long.");
          this.keyBytes.push(byte);
          break;
        }
        case "file-colon": {
          if (isWhitespace(byte)) break;
          if (byte !== COLON) this.fail("The Experience file's files do not read.");
          this.state = { at: "file-open" };
          break;
        }
        case "file-open": {
          if (isWhitespace(byte)) break;
          if (byte !== QUOTE) this.fail(`${this.path} in the Experience file is not base64 text.`);
          this.quadLength = 0;
          this.padding = 0;
          this.fileBytes = 0;
          this.outputLength = 0;
          events.push({ type: "file-start", path: this.path });
          this.state = { at: "file-data" };
          break;
        }
        case "file-data": {
          // The hot loop: decode as much of this chunk's base64 as it holds, in locals, before looking at
          // the state again.
          this.ensureOutput(Math.ceil((chunk.length - index) / 4) * 3 + 3);
          const output = this.output;
          const quad = this.quad;
          let quadLength = this.quadLength;
          let padding = this.padding;
          let outputLength = this.outputLength;
          let at = index;
          for (; at < chunk.length; at += 1) {
            const next = chunk[at]!;
            if (next === QUOTE) break;
            if (next === EQUALS) {
              if (quadLength < 2) this.fail(`${this.path} in the Experience file is not base64 text.`);
              padding += 1;
              quad[quadLength++] = 0;
            } else {
              const value = BASE64[next]!;
              if (value < 0 || padding > 0) this.fail(`${this.path} in the Experience file is not base64 text.`);
              quad[quadLength++] = value;
            }
            if (quadLength === 4) {
              const triple = (quad[0]! << 18) | (quad[1]! << 12) | (quad[2]! << 6) | quad[3]!;
              output[outputLength++] = (triple >> 16) & 0xff;
              if (padding < 2) output[outputLength++] = (triple >> 8) & 0xff;
              if (padding < 1) output[outputLength++] = triple & 0xff;
              this.fileBytes += 3 - padding;
              quadLength = 0;
            }
          }
          this.quadLength = quadLength;
          this.padding = padding;
          this.outputLength = outputLength;
          this.consumed += at - index;
          if (at < chunk.length) {
            if (quadLength !== 0) this.fail(`${this.path} in the Experience file is not base64 text.`);
            this.flush(events);
            events.push({ type: "file-end", path: this.path, bytes: this.fileBytes });
            this.state = { at: "after-file" };
            index = at;
          } else {
            this.consumed -= 1;
            index = at - 1;
          }
          break;
        }
        case "after-file": {
          if (isWhitespace(byte)) break;
          if (byte === COMMA) this.state = { at: "file-key-or-end", afterComma: true };
          else if (byte === CLOSE_BRACE) this.state = { at: "close" };
          else this.fail("The Experience file's files do not read.");
          break;
        }
        case "close": {
          if (isWhitespace(byte)) break;
          if (byte !== CLOSE_BRACE) this.fail("The Experience file goes on past its files.");
          this.state = { at: "done" };
          break;
        }
        case "done": {
          if (!isWhitespace(byte)) this.fail("The Experience file goes on past its end.");
          break;
        }
      }
      if (
        this.consumed > EXPERIENCE_FILE_HEADER_MAX_BYTES &&
        (this.state.at === "tokens" || this.state.at === "version" || this.state.at === "manifest")
      ) {
        this.fail("The Experience file's manifest is too large.");
      }
    }
    if (this.state.at === "manifest" && manifestStart >= 0) this.keepManifest(chunk.subarray(manifestStart));
    if (this.state.at === "file-data") this.flush(events);
    return events;
  }

  /** Call once the file has all arrived: throws when it stopped short. */
  finish(): ExperienceFileEvent[] {
    if (this.state.at !== "done") this.fail("The Experience file stops before its end.");
    return [{ type: "end" }];
  }

  private fail(message: string): never {
    throw new ExperienceFileError(message);
  }

  private keepManifest(part: Uint8Array) {
    if (!part.length) return;
    this.manifestLength += part.length;
    if (this.manifestLength > EXPERIENCE_FILE_MANIFEST_MAX_BYTES)
      this.fail("The Experience file's manifest is too large.");
    this.manifestParts.push(part.slice());
  }

  private parseManifest(): unknown {
    const bytes = new Uint8Array(this.manifestLength);
    let at = 0;
    for (const part of this.manifestParts) {
      bytes.set(part, at);
      at += part.length;
    }
    this.manifestParts = [];
    try {
      return JSON.parse(strictDecoder.decode(bytes));
    } catch {
      this.fail("The Experience file's manifest does not read.");
    }
  }

  private ensureOutput(extra: number) {
    if (this.outputLength + extra <= this.output.length) return;
    const grown = new Uint8Array(Math.max(4096, (this.outputLength + extra) * 2));
    grown.set(this.output.subarray(0, this.outputLength));
    this.output = grown;
  }

  private flush(events: ExperienceFileEvent[]) {
    if (!this.outputLength) return;
    events.push({ type: "file-data", path: this.path, data: this.output.slice(0, this.outputLength) });
    this.outputLength = 0;
  }
}

/** What the review shows of an Experience file before anything of it is kept. */
export interface ExperienceFileSummary {
  id: string;
  name: string;
  version: string;
  description: string;
  /** The bytes its files decode to, all of them. */
  contentBytes: number;
  byType: Record<ExperienceFileType, { files: number; bytes: number }>;
  files: number;
  worlds: number;
  creaturePacks: number;
  musicTracks: number;
}

export type ExperienceFileManifestRead =
  { ok: true; manifest: CapabilityPackageManifest; summary: ExperienceFileSummary } | { ok: false; issues: string[] };

/** An Experience file's manifest, checked as the import will check it, with what the review shows. */
export function readExperienceFileManifest(raw: unknown): ExperienceFileManifestRead {
  const parsed = capabilityPackageManifestSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.slice(0, 8).map((issue) => `${issue.path.join(".") || "manifest"}: ${issue.message}`),
    };
  }
  const manifest = parsed.data;
  if (manifest.kind.length !== 1 || manifest.kind[0] !== "experience") {
    return { ok: false, issues: ["An Experience file holds an Experience package only."] };
  }
  const byType: ExperienceFileSummary["byType"] = {
    image: { files: 0, bytes: 0 },
    audio: { files: 0, bytes: 0 },
    data: { files: 0, bytes: 0 },
  };
  let contentBytes = 0;
  for (const file of manifest.files) {
    const type = experienceFileType(file.path);
    if (!type) return { ok: false, issues: [`${file.path} is not a picture, music or data file.`] };
    byType[type].files += 1;
    byType[type].bytes += file.bytes;
    contentBytes += file.bytes;
  }
  const mapPack = manifest.contributions?.gameSurface?.mapPack;
  return {
    ok: true,
    manifest,
    summary: {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      contentBytes,
      byType,
      files: manifest.files.length,
      worlds: mapPack?.worlds?.length ?? 0,
      creaturePacks: mapPack?.creatures?.length ?? 0,
      musicTracks: mapPack?.music?.tracks.length ?? 0,
    },
  };
}

/** Writes an Experience file from a manifest and its files' bytes: the format {@link ExperienceFileReader}
 *  reads, as the parts to join (a Blob, or a stream), so no one string ever holds it whole. */
export function experienceFileParts(manifest: unknown, files: Array<{ path: string; data: Uint8Array }>): string[] {
  const parts = [
    `{"format":${JSON.stringify(EXPERIENCE_FILE_FORMAT)},"version":${EXPERIENCE_FILE_VERSION},\n"manifest":${JSON.stringify(manifest, null, 2)},\n"files":{`,
  ];
  files.forEach((file, index) => {
    parts.push(`${index ? "," : ""}\n${JSON.stringify(file.path)}:"`);
    const chunk = 3 * 64 * 1024;
    for (let at = 0; at < file.data.length; at += chunk) parts.push(base64(file.data.subarray(at, at + chunk)));
    parts.push('"');
  });
  parts.push("\n}}\n");
  return parts;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64(bytes: Uint8Array): string {
  let out = "";
  let at = 0;
  for (; at + 2 < bytes.length; at += 3) {
    const triple = (bytes[at]! << 16) | (bytes[at + 1]! << 8) | bytes[at + 2]!;
    out +=
      ALPHABET[(triple >> 18) & 63]! +
      ALPHABET[(triple >> 12) & 63]! +
      ALPHABET[(triple >> 6) & 63]! +
      ALPHABET[triple & 63]!;
  }
  if (at < bytes.length) {
    const a = bytes[at]!;
    const b = at + 1 < bytes.length ? bytes[at + 1]! : 0;
    const triple = (a << 16) | (b << 8);
    out += ALPHABET[(triple >> 18) & 63]! + ALPHABET[(triple >> 12) & 63]!;
    out += at + 1 < bytes.length ? ALPHABET[(triple >> 6) & 63]! : "=";
    out += "=";
  }
  return out;
}
