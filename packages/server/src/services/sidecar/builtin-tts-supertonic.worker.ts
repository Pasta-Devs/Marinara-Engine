// ──────────────────────────────────────────────
// The built-in voice model's worker thread for Supertonic 3
// ──────────────────────────────────────────────
// Supertonic reads characters directly (no phoneme step): a duration predictor, a text encoder, a few flow-matching
// steps and a vocoder, all ONNX on the processor. Loads the already-downloaded files only and answers
// { id, text, voice, speed, language, latinLanguage } with { id, samples } (44.1 kHz mono) or { id, error }.
//
// The text clean-up, chunking and pipeline follow the supertonic Python SDK 1.3.1 (MIT, Supertone Inc.).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parentPort, workerData } from "node:worker_threads";

interface SupertonicWorkerData {
  /** The model's folder: onnx/ and voice_styles/. */
  modelDir: string;
}

const { modelDir } = workerData as SupertonicWorkerData;
const port = parentPort!;

const TOTAL_STEPS = 8;
const BASE_SPEED = 1.05;
const MAX_CHUNK = 300;
/** Korean reads more reliably in shorter pieces. */
const MAX_CHUNK_KO = 120;
const SILENCE_SECONDS = 0.3;

const SYMBOLS: Array<[string, string]> = [
  ["–", "-"],
  ["‑", "-"],
  ["—", "-"],
  ["¯", " "],
  ["_", " "],
  ["“", '"'],
  ["”", '"'],
  ["‘", "'"],
  ["’", "'"],
  ["´", "'"],
  ["`", "'"],
  ["[", " "],
  ["]", " "],
  ["|", " "],
  ["/", " "],
  ["#", " "],
  ["→", " "],
  ["←", " "],
];
const EMOJI =
  /[\u{1f600}-\u{1f64f}\u{1f300}-\u{1f5ff}\u{1f680}-\u{1f6ff}\u{1f700}-\u{1faff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}]+/gu;
const ENDING = /[.!?;:,'"')\]}…。」』】〉》›»]$/;

function preprocess(text: string, language: string): string {
  let out = text.normalize("NFKD").replace(EMOJI, "");
  for (const [from, to] of SYMBOLS) out = out.split(from).join(to);
  out = out
    .replace(/[♥☆♡©\\]/g, "")
    .replace(/@/g, " at ")
    .replace(/ ([,.!?;:'])/g, "$1")
    .replace(/(["'`])\1+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (!ENDING.test(out)) out += ".";
  return `<${language}>${out}</${language}>`;
}

const ABBREVIATION = /(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|etc|vs|Inc|Ltd|Co|Corp|St|Ave|Blvd|\b[A-Z])\.$/;

function chunkText(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  for (const paragraph of text.split(/\n\s*\n+/).map((part) => part.trim())) {
    if (!paragraph) continue;
    // Sentences end at . ! ? (not after a common abbreviation) and at the full-width marks.
    const sentences: string[] = [];
    let current = "";
    for (const piece of paragraph.split(/(?<=[.!?。！？])\s*/)) {
      current = current ? `${current} ${piece}` : piece;
      if (!ABBREVIATION.test(current)) {
        sentences.push(current.trim());
        current = "";
      }
    }
    if (current.trim()) sentences.push(current.trim());
    let chunk = "";
    for (const sentence of sentences.filter(Boolean)) {
      if (chunk.length + sentence.length + 1 <= maxLength) chunk = chunk ? `${chunk} ${sentence}` : sentence;
      else {
        if (chunk) chunks.push(chunk);
        chunk = sentence;
      }
    }
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

/** The reading language from the text's script; Latin text is read in `latin`. */
function detectLanguage(text: string, latin: string): string {
  if (/[가-힯ᄀ-ᇿ㄰-㆏]/.test(text)) return "ko";
  if (/[぀-ヿㇰ-ㇿ一-鿿]/.test(text)) return "ja";
  if (/[Ѐ-ӿ]/.test(text)) return "ru";
  if (/[ऀ-ॿ]/.test(text)) return "hi";
  return latin;
}

function randomNormal(): number {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

type Style = { ttl: Float32Array; ttlDims: number[]; dp: Float32Array; dpDims: number[] };

try {
  const ort = await import("onnxruntime-node");
  const config = JSON.parse(readFileSync(join(modelDir, "onnx", "tts.json"), "utf-8")) as {
    ae: { sample_rate: number; base_chunk_size: number };
    ttl: { chunk_compress_factor: number; latent_dim: number };
  };
  const indexer = JSON.parse(readFileSync(join(modelDir, "onnx", "unicode_indexer.json"), "utf-8")) as number[];
  const options = { executionProviders: ["cpu"], graphOptimizationLevel: "all" } as const;
  const open = (name: string) => ort.InferenceSession.create(join(modelDir, "onnx", `${name}.onnx`), options);
  const [durationPredictor, textEncoder, vectorEstimator, vocoder] = await Promise.all([
    open("duration_predictor"),
    open("text_encoder"),
    open("vector_estimator"),
    open("vocoder"),
  ]);
  const sampleRate = config.ae.sample_rate;
  const chunkSize = config.ae.base_chunk_size * config.ttl.chunk_compress_factor;
  const latentDim = config.ttl.latent_dim * config.ttl.chunk_compress_factor;

  const styleCache = new Map<string, Style>();
  const loadStyle = (id: string): Style => {
    const name = /^st_([FM][1-5])$/.exec(id)?.[1];
    if (!name) throw new Error(`Unknown voice "${id}"`);
    const cached = styleCache.get(name);
    if (cached) return cached;
    const raw = JSON.parse(readFileSync(join(modelDir, "voice_styles", `${name}.json`), "utf-8")) as {
      style_ttl: { dims: number[]; data: unknown };
      style_dp: { dims: number[]; data: unknown };
    };
    const style = {
      ttl: Float32Array.from((raw.style_ttl.data as number[][][]).flat(2)),
      ttlDims: raw.style_ttl.dims,
      dp: Float32Array.from((raw.style_dp.data as number[][][]).flat(2)),
      dpDims: raw.style_dp.dims,
    };
    styleCache.set(name, style);
    return style;
  };

  /** One voice, or a weighted blend ("st_F1:60+st_M2:40"): the weighted average of their style vectors. */
  const resolveStyle = (spec: string): Style => {
    const parts = spec
      .split("+")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [id = "", weight] = part.split(":");
        return { style: loadStyle(id), weight: weight === undefined ? 1 : Number(weight) };
      });
    const total = parts.reduce((sum, part) => sum + part.weight, 0);
    if (parts.length === 0 || !(total > 0)) throw new Error(`Invalid voice "${spec}"`);
    if (parts.length === 1) return parts[0]!.style;
    const first = parts[0]!.style;
    const ttl = new Float32Array(first.ttl.length);
    const dp = new Float32Array(first.dp.length);
    for (const { style, weight } of parts) {
      const share = weight / total;
      for (let i = 0; i < ttl.length; i += 1) ttl[i]! += style.ttl[i]! * share;
      for (let i = 0; i < dp.length; i += 1) dp[i]! += style.dp[i]! * share;
    }
    return { ttl, ttlDims: first.ttlDims, dp, dpDims: first.dpDims };
  };

  const synthesizeChunk = async (
    text: string,
    style: Style,
    speed: number,
    language: string,
  ): Promise<Float32Array> => {
    const prepared = preprocess(text, language);
    const ids = new BigInt64Array(prepared.length);
    for (let i = 0; i < prepared.length; i += 1) {
      const code = prepared.charCodeAt(i);
      ids[i] = BigInt(Math.max(0, indexer[code] ?? 0));
    }
    const length = prepared.length;
    const textIds = new ort.Tensor("int64", ids, [1, length]);
    const textMask = new ort.Tensor("float32", new Float32Array(length).fill(1), [1, 1, length]);
    const styleTtl = new ort.Tensor("float32", style.ttl, style.ttlDims);
    const styleDp = new ort.Tensor("float32", style.dp, style.dpDims);

    const durationOut = await durationPredictor.run({ text_ids: textIds, style_dp: styleDp, text_mask: textMask });
    const duration = (Object.values(durationOut)[0]!.data as Float32Array)[0]! / speed;
    const encoded = await textEncoder.run({ text_ids: textIds, style_ttl: styleTtl, text_mask: textMask });
    const textEmb = Object.values(encoded)[0]!;

    const wavLength = Math.floor(duration * sampleRate);
    const latentLength = Math.max(1, Math.ceil(wavLength / chunkSize));
    const latent = new Float32Array(latentDim * latentLength);
    for (let i = 0; i < latent.length; i += 1) latent[i] = randomNormal();
    let xt = new ort.Tensor("float32", latent, [1, latentDim, latentLength]);
    const latentMask = new ort.Tensor("float32", new Float32Array(latentLength).fill(1), [1, 1, latentLength]);
    const totalStep = new ort.Tensor("float32", new Float32Array([TOTAL_STEPS]), [1]);
    for (let step = 0; step < TOTAL_STEPS; step += 1) {
      const out = await vectorEstimator.run({
        noisy_latent: xt,
        text_emb: textEmb,
        style_ttl: styleTtl,
        text_mask: textMask,
        latent_mask: latentMask,
        current_step: new ort.Tensor("float32", new Float32Array([step]), [1]),
        total_step: totalStep,
      });
      xt = Object.values(out)[0] as typeof xt;
    }
    const wav = await vocoder.run({ latent: xt });
    const samples = Object.values(wav)[0]!.data as Float32Array;
    // The vocoder pads to whole latent chunks; the predicted duration is where the speech ends.
    return samples.slice(0, Math.min(samples.length, wavLength));
  };

  const speak = async (
    text: string,
    voice: string,
    speed: number,
    language: string,
    latinLanguage: string,
  ): Promise<Float32Array> => {
    const style = resolveStyle(voice);
    const reading = language === "auto" ? detectLanguage(text, latinLanguage) : language;
    const pace = Math.max(0.7, Math.min(2, BASE_SPEED * speed));
    const pieces: Float32Array[] = [];
    for (const chunk of chunkText(text, reading === "ko" ? MAX_CHUNK_KO : MAX_CHUNK)) {
      pieces.push(await synthesizeChunk(chunk, style, pace, reading));
    }
    const gap = Math.round(SILENCE_SECONDS * sampleRate);
    const total = pieces.reduce((sum, piece) => sum + piece.length, 0) + gap * Math.max(0, pieces.length - 1);
    const samples = new Float32Array(total);
    let offset = 0;
    for (const piece of pieces) {
      samples.set(piece, offset);
      offset += piece.length + gap;
    }
    return samples;
  };

  let queue: Promise<void> = Promise.resolve();
  port.on(
    "message",
    (message: { id: number; text: string; voice: string; speed: number; language: string; latinLanguage: string }) => {
      queue = queue.then(async () => {
        try {
          const samples = await speak(
            message.text,
            message.voice,
            message.speed,
            message.language,
            message.latinLanguage,
          );
          port.postMessage({ id: message.id, samples }, [samples.buffer as ArrayBuffer]);
        } catch (error) {
          port.postMessage({ id: message.id, error: error instanceof Error ? error.message : String(error) });
        }
      });
    },
  );
  port.postMessage({ type: "ready" });
} catch (error) {
  port.postMessage({ type: "failed", error: error instanceof Error ? error.message : String(error) });
}
