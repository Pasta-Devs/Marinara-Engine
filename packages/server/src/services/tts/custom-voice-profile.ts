// ─────────────────────────────────────────────────────────────
// Custom voice upload API profile — standalone helper
// ─────────────────────────────────────────────────────────────
// Contract for the explicitly selected `vllm-omni` custom-voice upload profile:
//  - WAV PCM only (v1): 16-bit PCM, 1–2 channels, 8000–48000 Hz, ≤ 10 MiB, ≤ 120 s
//  - consent is a user-provided recording ID (required, never fabricated)
//  - transcript is optional and bounded
//  - the uploaded name is the voice identity; registration/list/delete are
//    backend-owned (the provider owns the registry)
// No model-name gates: the helpers validate audio and fields for the profile
// itself and are independent of which provider model a connection runs.
import type { CustomVoiceProfile } from "@marinara-engine/shared";

export const CUSTOM_VOICE_PROFILE: {
  profile: CustomVoiceProfile;
  version: 1;
  format: { mimeType: "audio/wav"; encoding: "pcm" };
  maxBytes: number;
  maxDurationSeconds: number;
  consent: { required: true; userProvided: true; neverFabricated: true };
  transcript: { required: false; maxCharacters: number };
  identity: "name";
  ownership: "backend";
} = {
  profile: "vllm-omni",
  version: 1,
  format: { mimeType: "audio/wav", encoding: "pcm" },
  maxBytes: 10 * 1024 * 1024,
  maxDurationSeconds: 120,
  consent: { required: true, userProvided: true, neverFabricated: true },
  transcript: { required: false, maxCharacters: 10000 },
  identity: "name",
  ownership: "backend",
};

const DISPLAY_NAME_MAX = 64;
const CONSENT_MAX = 200;

export interface CustomVoiceAudioResult {
  mimeType: "audio/wav";
  durationSeconds: number;
}

/**
 * Validates an uploaded voice sample as WAV PCM for the custom-voice profile.
 * Returns the decoded duration; rejects (throws) empty, truncated, oversized,
 * disguised or non-PCM input without transforming the buffer.
 */
export function validateCustomVoiceAudio(buffer: Buffer): CustomVoiceAudioResult {
  const { maxBytes, maxDurationSeconds } = CUSTOM_VOICE_PROFILE;
  if (!Buffer.isBuffer(buffer) || buffer.byteLength === 0) {
    throw new Error("Custom voice audio is empty");
  }
  if (buffer.byteLength > maxBytes) {
    throw new Error(`Custom voice audio exceeds ${maxBytes} bytes`);
  }
  if (buffer.byteLength < 12) {
    throw new Error("Custom voice audio is truncated: missing RIFF header");
  }
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Custom voice audio must be a RIFF/WAVE file");
  }
  if (buffer.readUInt32LE(4) !== buffer.byteLength - 8) {
    throw new Error("Custom voice audio RIFF length does not match file size");
  }

  let sampleRate = 0;
  let blockAlign = 0;
  let dataBytes = 0;
  let hasFmt = false;
  let hasData = false;

  for (let offset = 12; offset < buffer.byteLength;) {
    if (buffer.byteLength - offset < 8) {
      throw new Error("Custom voice audio is truncated: incomplete chunk header");
    }
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (buffer.byteLength - offset - 8 < chunkSize) {
      throw new Error(`Custom voice audio is truncated: chunk ${chunkId} extends past end of file`);
    }
    if (chunkId === "fmt ") {
      if (hasFmt) throw new Error("Custom voice audio contains multiple fmt chunks");
      hasFmt = true;
      if (chunkSize < 16) {
        throw new Error("Custom voice audio fmt chunk is truncated");
      }
      const format = buffer.readUInt16LE(offset + 8);
      const channels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      const byteRate = buffer.readUInt32LE(offset + 16);
      blockAlign = buffer.readUInt16LE(offset + 20);
      const bitsPerSample = buffer.readUInt16LE(offset + 22);
      if (format !== 1) {
        throw new Error(`Custom voice audio must be 16-bit PCM (format 1), got format ${format}`);
      }
      if (channels !== 1 && channels !== 2) {
        throw new Error(`Custom voice audio must be mono or stereo, got ${channels} channels`);
      }
      if (sampleRate < 8000 || sampleRate > 48000) {
        throw new Error(`Custom voice audio sample rate ${sampleRate} Hz is outside 8000–48000 Hz`);
      }
      if (bitsPerSample !== 16) {
        throw new Error(`Custom voice audio must be 16-bit PCM, got ${bitsPerSample} bits per sample`);
      }
      if (blockAlign !== (channels * bitsPerSample) / 8) {
        throw new Error("Custom voice audio block align does not match channels and bit depth");
      }
      if (byteRate !== sampleRate * blockAlign) {
        throw new Error("Custom voice audio byte rate does not match sample rate and block align");
      }
    } else if (chunkId === "data") {
      if (hasData) throw new Error("Custom voice audio contains multiple data chunks");
      hasData = true;
      dataBytes = chunkSize;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  if (!hasFmt) throw new Error("Custom voice audio is missing its fmt chunk");
  if (!hasData) throw new Error("Custom voice audio is missing its data chunk");
  if (dataBytes === 0) throw new Error("Custom voice audio contains no samples");
  if (dataBytes % blockAlign !== 0) {
    throw new Error("Custom voice audio data chunk is not a whole number of PCM frames");
  }
  const durationSeconds = dataBytes / (sampleRate * blockAlign);
  if (durationSeconds > maxDurationSeconds) {
    throw new Error(`Custom voice audio is ${durationSeconds.toFixed(3)}s, max ${maxDurationSeconds}s`);
  }
  return { mimeType: "audio/wav", durationSeconds };
}

export interface CustomVoiceFieldInput {
  displayName: string;
  consent: string;
  transcript?: string | null;
}

export interface CustomVoiceFields {
  displayName: string;
  consent: string;
  transcript?: string;
}

function boundText(value: string, max: number, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new Error(`Custom voice ${label} must be at most ${max} characters`);
  }
  for (const ch of trimmed) {
    const code = ch.codePointAt(0)!;
    // Reject C0 (0x00–0x1F, 0x7F) and C1 (0x80–0x9F) control characters consistently.
    if (code < 0x20 || code === 0x7f || (code >= 0x80 && code <= 0x9f)) {
      throw new Error(`Custom voice ${label} must not contain control characters`);
    }
  }
  return trimmed;
}

/**
 * Validates the custom-voice metadata fields. The consent recording ID is
 * required and must come from the user; the display name becomes the voice
 * identity; the transcript is optional. Throws on invalid input; no logging.
 */
export function validateCustomVoiceFields(fields: CustomVoiceFieldInput): CustomVoiceFields {
  const displayName = boundText(fields.displayName, DISPLAY_NAME_MAX, "name");
  if (!displayName) throw new Error("Custom voice name is required");
  const consent = boundText(fields.consent, CONSENT_MAX, "consent recording ID");
  if (!consent) throw new Error("Custom voice consent recording ID is required");
  const result: CustomVoiceFields = { displayName, consent };
  if (fields.transcript != null && fields.transcript.trim() !== "") {
    result.transcript = boundText(fields.transcript, CUSTOM_VOICE_PROFILE.transcript.maxCharacters, "transcript");
  }
  return result;
}
