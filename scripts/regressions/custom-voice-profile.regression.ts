// ─────────────────────────────────────────────────────────────
// Custom voice upload API profile contract regression
// ─────────────────────────────────────────────────────────────
// Maintained regression for the standalone custom-voice profile helpers:
//  1. Valid synthetic WAV PCM (mono and stereo) is accepted with correct duration
//  2. Bad / disguised / truncated / oversized / over-duration audio is rejected
//     (including duplicate fmt/data chunks and RIFF length mismatches)
//  3. The consent recording ID is required and bounded (never fabricated)
//  4. Display name and transcript are trimmed and bounded (C0 and C1 controls rejected)
//  5. The profile capability is independent of any specific provider model name
import assert from "node:assert/strict";
import {
  CUSTOM_VOICE_PROFILE,
  validateCustomVoiceAudio,
  validateCustomVoiceFields,
} from "../../packages/server/src/services/tts/custom-voice-profile.js";

function wav(
  opts: {
    format?: number;
    channels?: number;
    sampleRate?: number;
    byteRate?: number;
    blockAlign?: number;
    bitsPerSample?: number;
    dataBytes?: number;
    truncateAt?: number;
    riffMagic?: string;
    waveMagic?: string;
    omitFmt?: boolean;
    omitData?: boolean;
    trailingExtra?: number;
    riffSizeDelta?: number;
    extraDataBytes?: number;
    duplicateFmt?: boolean;
  } = {},
): Buffer {
  const {
    format = 1,
    channels = 1,
    sampleRate = 44100,
    byteRate,
    blockAlign = (channels * 16) / 8,
    bitsPerSample = 16,
    dataBytes = 88200, // 1s mono 44.1kHz 16-bit
    truncateAt,
    riffMagic = "RIFF",
    waveMagic = "WAVE",
    omitFmt = false,
    omitData = false,
    trailingExtra = 0,
    riffSizeDelta = 0,
    extraDataBytes = 0,
    duplicateFmt = false,
  } = opts;

  const fmtSize = 16;
  const chunks =
    (omitFmt ? 0 : 8 + fmtSize) +
    (omitData ? 0 : 8 + dataBytes) +
    (extraDataBytes ? 8 + extraDataBytes : 0) +
    (duplicateFmt ? 8 + fmtSize : 0);
  const out = Buffer.alloc(12 + chunks + trailingExtra);
  out.write(riffMagic, 0, "ascii");
  out.writeUInt32LE(4 + chunks + riffSizeDelta, 4); // RIFF size = (12 + payload) - 8
  out.write(waveMagic, 8, "ascii");
  let offset = 12;
  if (!omitFmt) {
    out.write("fmt ", offset, "ascii");
    out.writeUInt32LE(fmtSize, offset + 4);
    out.writeUInt16LE(format, offset + 8);
    out.writeUInt16LE(channels, offset + 10);
    out.writeUInt32LE(sampleRate, offset + 12);
    out.writeUInt32LE(byteRate ?? sampleRate * blockAlign, offset + 16);
    out.writeUInt16LE(blockAlign, offset + 20);
    out.writeUInt16LE(bitsPerSample, offset + 22);
    offset += 8 + fmtSize;
  }
  if (!omitData) {
    out.write("data", offset, "ascii");
    out.writeUInt32LE(dataBytes, offset + 4);
    offset += 8 + dataBytes;
  }
  if (extraDataBytes) {
    out.write("data", offset, "ascii");
    out.writeUInt32LE(extraDataBytes, offset + 4);
    offset += 8 + extraDataBytes;
  }
  if (duplicateFmt) {
    // A second fmt chunk, placed after the data, with a different sample rate.
    out.write("fmt ", offset, "ascii");
    out.writeUInt32LE(fmtSize, offset + 4);
    out.writeUInt16LE(1, offset + 8);
    out.writeUInt16LE(channels, offset + 10);
    out.writeUInt32LE(sampleRate === 8000 ? 44100 : 8000, offset + 12);
    offset += 8 + fmtSize;
  }
  return truncateAt !== undefined ? out.subarray(0, truncateAt) : out;
}

// 1. Valid WAV PCM is accepted
{
  const mono = wav();
  const result = validateCustomVoiceAudio(mono);
  assert.equal(result.mimeType, "audio/wav");
  assert.ok(Math.abs(result.durationSeconds - 1) < 1e-9, "1s mono sample");

  const stereo = wav({ channels: 2, sampleRate: 8000, dataBytes: 32000 }); // 1s stereo 8kHz
  const stereoResult = validateCustomVoiceAudio(stereo);
  assert.ok(Math.abs(stereoResult.durationSeconds - 1) < 1e-9, "1s stereo sample");

  const bounds = wav({ sampleRate: 48000, dataBytes: 48000 }); // 0.5s
  assert.ok(Math.abs(validateCustomVoiceAudio(bounds).durationSeconds - 0.5) < 1e-9);
  console.log("✓ valid WAV PCM (mono, stereo, 48kHz) accepted with correct duration");
}

// 2a. Bad and disguised audio is rejected
{
  assert.throws(() => validateCustomVoiceAudio(wav({ riffMagic: "ID3 " })), /RIFF\/WAVE/);
  assert.throws(() => validateCustomVoiceAudio(wav({ waveMagic: "AVI " })), /RIFF\/WAVE/);
  assert.throws(() => validateCustomVoiceAudio(wav({ format: 0x55 })), /format 1/); // MPEG disguised as WAV
  assert.throws(() => validateCustomVoiceAudio(wav({ format: 3 })), /format 1/); // IEEE float
  assert.throws(() => validateCustomVoiceAudio(wav({ bitsPerSample: 8 })), /16-bit/);
  assert.throws(() => validateCustomVoiceAudio(wav({ bitsPerSample: 24 })), /16-bit/);
  assert.throws(() => validateCustomVoiceAudio(wav({ channels: 0 })), /mono or stereo/);
  assert.throws(() => validateCustomVoiceAudio(wav({ channels: 3 })), /mono or stereo/);
  assert.throws(() => validateCustomVoiceAudio(wav({ sampleRate: 4000 })), /8000–48000/);
  assert.throws(() => validateCustomVoiceAudio(wav({ sampleRate: 96000 })), /8000–48000/);
  console.log("✓ bad, disguised and unsupported WAV rejected");
}

// 2b. Consistency failures are rejected
{
  assert.throws(() => validateCustomVoiceAudio(wav({ blockAlign: 4 })), /block align/);
  assert.throws(() => validateCustomVoiceAudio(wav({ byteRate: 123 })), /byte rate/);
  assert.throws(() => validateCustomVoiceAudio(wav({ omitFmt: true })), /fmt/);
  assert.throws(() => validateCustomVoiceAudio(wav({ omitData: true })), /data/);
  assert.throws(() => validateCustomVoiceAudio(wav({ dataBytes: 0 })), /no samples/);
  assert.throws(
    () => validateCustomVoiceAudio(wav({ dataBytes: 88201, truncateAt: undefined, sampleRate: 44100 })),
    /PCM frames/,
  ); // odd data length = torn frame
  console.log("✓ inconsistent fmt/data chunks rejected");
}

// 2c. Truncated buffers are rejected
{
  assert.throws(() => validateCustomVoiceAudio(Buffer.alloc(0)), /empty/);
  assert.throws(() => validateCustomVoiceAudio(Buffer.alloc(6)), /truncated/);
  assert.throws(() => validateCustomVoiceAudio(wav({ truncateAt: 40 })), /RIFF length|truncated/);
  assert.throws(() => validateCustomVoiceAudio(wav({ trailingExtra: 3 })), /RIFF length/);
  assert.throws(
    () => validateCustomVoiceAudio(wav({ dataBytes: 88200, truncateAt: 12 + 24 + 8 + 100 })),
    /RIFF length|truncated/,
  );
  console.log("✓ truncated buffers rejected");
}

// 2d. Oversized buffers are rejected
{
  const tooBig = wav({ dataBytes: CUSTOM_VOICE_PROFILE.maxBytes - 44 + 1 });
  assert.equal(tooBig.byteLength, CUSTOM_VOICE_PROFILE.maxBytes + 1);
  assert.throws(() => validateCustomVoiceAudio(tooBig), /exceeds/);
  console.log("✓ >10 MiB buffer rejected");
}

// 2e. Duration limit is enforced
{
  // 8kHz mono 16-bit: exactly 120s = 1,920,000 bytes (≈1.8 MiB, under the size cap)
  const atLimit = wav({ sampleRate: 8000, dataBytes: 120 * 16000 });
  assert.equal(validateCustomVoiceAudio(atLimit).durationSeconds, 120);
  const overLimit = wav({ sampleRate: 8000, dataBytes: 120 * 16000 + 2 }); // +1 sample
  assert.throws(() => validateCustomVoiceAudio(overLimit), /120s/);
  console.log("✓ exactly 120s accepted, one extra sample rejected");
}

// 2f. Structural integrity: duplicate chunks and RIFF length mismatches are rejected
{
  // Reproduced defect: two data chunks (121 s + 1 s at 8 kHz mono = 122 s total)
  // must not be accepted as the 1 s measured from the last chunk alone.
  const twoData = wav({ sampleRate: 8000, dataBytes: 121 * 16000, extraDataBytes: 16000 });
  assert.equal(twoData.length, 12 + 24 + 8 + 121 * 16000 + 8 + 16000);
  assert.throws(() => validateCustomVoiceAudio(twoData), /multiple data chunks/);

  // A duplicate fmt chunk must not silently redefine the sample rate of the data.
  assert.throws(
    () => validateCustomVoiceAudio(wav({ sampleRate: 8000, dataBytes: 60 * 16000, duplicateFmt: true })),
    /multiple fmt chunks/,
  );

  // The RIFF size field must match the actual file size in both directions:
  // declaring a shorter payload leaves chunks past the declared end; declaring a
  // longer one leaves unaccounted trailing bytes.
  assert.throws(() => validateCustomVoiceAudio(wav({ riffSizeDelta: -88208 })), /RIFF length/);
  assert.throws(() => validateCustomVoiceAudio(wav({ riffSizeDelta: 1000 })), /RIFF length/);
  console.log("✓ duplicate chunks and RIFF length mismatches rejected");
}

// 3. Consent recording ID is required and bounded; nothing is fabricated
{
  const base = { displayName: "Aria", consent: "rec-2026-02-25", transcript: undefined };
  assert.throws(() => validateCustomVoiceFields({ ...base, consent: "" }), /consent/);
  assert.throws(() => validateCustomVoiceFields({ ...base, consent: "   " }), /consent/);
  assert.throws(() => validateCustomVoiceFields({ ...base, consent: "c".repeat(201) }), /200/);
  assert.throws(
    () => validateCustomVoiceFields({ ...base, consent: "c".repeat(199) + "\u0007" }),
    /control characters/,
  );
  assert.throws(() => validateCustomVoiceFields({ ...base, consent: "rec\u009F-1" }), /control characters/); // C1 control rejected, not just C0
  assert.equal(validateCustomVoiceFields({ ...base, consent: "  rec-01  " }).consent, "rec-01", "trimmed");
  assert.equal(
    validateCustomVoiceFields({ ...base, consent: "c".repeat(200) }).consent.length,
    200,
    "boundary allowed",
  );
  console.log("✓ consent recording ID required, trimmed, bounded to 200");
}

// 4. Display name (voice identity) and transcript are trimmed and bounded
{
  const base = { consent: "rec-1" };
  assert.throws(() => validateCustomVoiceFields({ ...base, displayName: "" }), /name/);
  assert.throws(() => validateCustomVoiceFields({ ...base, displayName: "n".repeat(65) }), /64/);
  assert.throws(() => validateCustomVoiceFields({ ...base, displayName: "A\u0085ria" }), /control characters/); // C1 control rejected, not just C0
  assert.equal(validateCustomVoiceFields({ ...base, displayName: "  Aria  " }).displayName, "Aria");
  const withTranscript = validateCustomVoiceFields({
    ...base,
    displayName: "Aria",
    transcript: "  " + "a".repeat(10000) + "  ",
  });
  assert.equal(withTranscript.transcript.length, 10000);
  assert.throws(
    () => validateCustomVoiceFields({ ...base, displayName: "Aria", transcript: "a".repeat(10001) }),
    /10000/,
  );
  assert.throws(
    () => validateCustomVoiceFields({ ...base, displayName: "Aria", transcript: "a\u0085b" }),
    /control characters/,
  ); // C1 control rejected in the transcript too
  const without = validateCustomVoiceFields({ ...base, displayName: "Aria", transcript: "" });
  assert.equal(without.transcript, undefined, "blank transcript omitted");
  console.log("✓ display name and transcript trimmed and bounded");
}

// 5. Capability is profile-scoped, independent of any specific model name
{
  assert.equal(CUSTOM_VOICE_PROFILE.profile, "vllm-omni");
  assert.equal(CUSTOM_VOICE_PROFILE.version, 1);
  assert.equal(CUSTOM_VOICE_PROFILE.maxBytes, 10 * 1024 * 1024);
  assert.equal(CUSTOM_VOICE_PROFILE.maxDurationSeconds, 120);
  assert.equal(CUSTOM_VOICE_PROFILE.identity, "name");
  assert.equal(CUSTOM_VOICE_PROFILE.ownership, "backend");
  assert.equal(CUSTOM_VOICE_PROFILE.consent.required, true);
  assert.equal(CUSTOM_VOICE_PROFILE.transcript.required, false);
  // Same buffer, same result no matter which model the connection runs: the
  // helper takes no model argument and shares one profile for the capability.
  const same = wav();
  const first = validateCustomVoiceAudio(same);
  const second = validateCustomVoiceAudio(Buffer.from(same));
  assert.deepEqual(first, second);
  console.log("✓ profile capability independent of provider model name");
}

// 6. The validator never transforms the input buffer
{
  const input = wav();
  const before = Buffer.from(input);
  validateCustomVoiceAudio(input);
  assert.deepEqual(input, before);
  console.log("✓ input buffer left untouched");
}

console.log("\nAll custom-voice profile contract checks passed.");
