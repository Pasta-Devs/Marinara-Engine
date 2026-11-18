// ──────────────────────────────────────────────
// The built-in voice model's worker thread (Kokoro-82M)
// ──────────────────────────────────────────────
// Speaking a sentence takes the processor for a second or more; on the server's main thread that would stall every
// streaming reply. This worker loads the already-downloaded files only (no network: builtin-tts.service.ts checks
// and pins the download) and answers { id, text, voice, speed } with { id, samples } (24 kHz mono) or { id, error }.
// Terminating the worker frees the model.
//
// The text clean-up and phoneme fixes below are ported from kokoro-js 1.2.1 (Apache-2.0, hexgrad and Xenova),
// which targets an older transformers.js than the one Marinara ships and reads English only. Phonemes come from
// eSpeak NG (GPL-3.0, the Echogarden build with every language's data), as in Kokoro's own pipeline; Japanese and
// Chinese use ports of misaki's readers instead (tts-g2p/), as Kokoro's Japanese and Chinese voices were trained.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parentPort, workerData } from "node:worker_threads";
import { BUILTIN_TTS_ESPEAK_LANGUAGE } from "@marinara-engine/shared";
import { JapaneseG2P, type JaTokenizer } from "./tts-g2p/ja.js";
import { ChineseG2P } from "./tts-g2p/zh.js";
import { prepareKokoroText } from "./tts-g2p/kokoro-text.js";

interface BuiltinTtsWorkerData {
  /** transformers.js localModelPath: the folder that holds `modelId`. */
  modelsDir: string;
  modelId: string;
  /** The folder with voices/<id>.bin. */
  voicesDir: string;
}

const { modelsDir, modelId, voicesDir } = workerData as BuiltinTtsWorkerData;
const port = parentPort!;

/** Each voice is 510 style rows of 256 floats: one row per input length. */
const STYLE_SIZE = 256;
const MAX_TOKENS = 510;
/** A short pause between sentences spoken separately. */
const SENTENCE_GAP_SAMPLES = Math.round(24_000 * 0.08);
/** Sentences are joined up to this length, so short ones share one pass and long texts stay under the token limit. */
const CHUNK_CHARS = 280;
/** A Japanese or Chinese character is several phonemes, so their pieces are shorter. */
const CJK_CHUNK_CHARS = 90;

const PUNCTUATION = ';:,.!?¡¿—…"«»“”(){}[]';
const PUNCTUATION_RUN = new RegExp(`(\\s*[${PUNCTUATION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}]+\\s*)+`, "g");

/** Splits a text into sentence-sized pieces, each well under the model's token limit. */
function chunkText(text: string, limit = CHUNK_CHARS): string[] {
  const sentences = text
    .split(/(?<=[.!?…])\s+|(?<=[。！？])|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    // A very long sentence is cut at commas, then at spaces.
    const pieces =
      sentence.length <= limit
        ? [sentence]
        : // Text without spaces (Japanese, Chinese) is cut at its commas, or at the limit.
          (sentence.match(new RegExp(`.{1,${limit}}(?:[\\s、，]|$)|.{1,${limit}}`, "gu")) ?? []);
    for (const piece of pieces.map((p) => p.trim()).filter(Boolean)) {
      if (current && current.length + piece.length + 1 > limit) {
        chunks.push(current);
        current = piece;
      } else {
        current = current ? `${current} ${piece}` : piece;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** eSpeak NG turns words into phonemes: one line per clause, phonemes joined by "_". */
type Phonemize = (text: string, language: string) => string;

async function loadPhonemizer(): Promise<Phonemize> {
  type EspeakWorker = {
    set_voice(language: string): void;
    synthesize_ipa(text: string, onAudio: () => boolean): { ipa: string };
  };
  const { default: createEspeak } = await import("@echogarden/espeak-ng-emscripten");
  const espeakModule = (await createEspeak()) as { eSpeakNGWorker: new () => EspeakWorker };
  const espeak = new espeakModule.eSpeakNGWorker();
  let current = "";
  return (text, language) => {
    if (language !== current) {
      espeak.set_voice(language);
      current = language;
    }
    return (
      espeak
        .synthesize_ipa(text, () => true)
        .ipa.split("\n")
        // "(en)…(hi)" marks a word eSpeak read in another language; "-" joins clitics. Neither is a sound.
        .map((line) =>
          line
            .replace(/\([a-z-]+\)/g, "")
            .replace(/[_-]/g, "")
            .trim(),
        )
        .filter(Boolean)
        .join(" ")
    );
  };
}

function toPhonemes(phonemize: Phonemize, text: string, language: string): string {
  const american = language === "en-us";
  const parts: Array<{ match: boolean; text: string }> = [];
  let last = 0;
  for (const found of text.matchAll(PUNCTUATION_RUN)) {
    if (last < found.index) parts.push({ match: false, text: text.slice(last, found.index) });
    if (found[0].length > 0) parts.push({ match: true, text: found[0] });
    last = found.index + found[0].length;
  }
  if (last < text.length) parts.push({ match: false, text: text.slice(last) });
  const spoken = parts.map((part) => (part.match ? part.text : phonemize(part.text, language))).join("");
  // The other languages keep eSpeak's phonemes as they are: their trilled r and x are in the model's alphabet.
  if (!language.startsWith("en")) return spoken.replace(/ʲ/g, "j").trim();
  let phonemes = spoken
    .replace(/kəkˈoːɹoʊ/g, "kˈoʊkəɹoʊ")
    .replace(/kəkˈɔːɹəʊ/g, "kˈəʊkəɹəʊ")
    .replace(/ʲ/g, "j")
    .replace(/r/g, "ɹ")
    .replace(/x/g, "k")
    .replace(/ɬ/g, "l")
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, " ")
    .replace(/ z(?=[;:,.!?¡¿—…"«»“” ]|$)/g, "z");
  if (american) phonemes = phonemes.replace(/(?<=nˈaɪn)ti(?!ː)/g, "di");
  return phonemes.trim();
}

const voiceCache = new Map<string, Float32Array>();

function loadVoice(id: string): Float32Array {
  if (!/^[abefhjpz][fm]_[a-z]+$/.test(id)) throw new Error(`Unknown voice "${id}"`);
  const cached = voiceCache.get(id);
  if (cached) return cached;
  const bytes = readFileSync(join(voicesDir, `${id}.bin`));
  const voice = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  voiceCache.set(id, voice);
  return voice;
}

/**
 * A voice is one id ("af_heart") or a blend of several with weights ("af_bella:60+am_puck:40"): the blend is the
 * weighted average of their style vectors. The first voice sets the language and accent.
 */
function resolveVoice(spec: string): { style: Float32Array; language: string } {
  const parts = spec
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [id = "", weight] = part.split(":");
      const value = weight === undefined ? 1 : Number(weight);
      if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid voice weight in "${spec}"`);
      return { id, weight: value };
    });
  const total = parts.reduce((sum, part) => sum + part.weight, 0);
  if (parts.length === 0 || total <= 0) throw new Error(`Invalid voice "${spec}"`);
  const first = loadVoice(parts[0]!.id);
  const style = parts.length === 1 ? first : new Float32Array(first.length);
  if (parts.length > 1) {
    for (const part of parts) {
      const voice = loadVoice(part.id);
      const share = part.weight / total;
      for (let index = 0; index < style.length; index += 1) style[index]! += voice[index]! * share;
    }
  }
  return { style, language: BUILTIN_TTS_ESPEAK_LANGUAGE[parts[0]!.id[0]!] ?? "en-us" };
}

try {
  const { AutoTokenizer, StyleTextToSpeech2Model, Tensor, env } = await import("@huggingface/transformers");
  const phonemize = await loadPhonemizer();
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.useFSCache = false;
  env.useBrowserCache = false;
  env.localModelPath = modelsDir;
  // An absolute folder: transformers.js only puts localModelPath in front of ids shaped like "owner/name", and this
  // one has the revision as a third part.
  const modelDir = join(modelsDir, modelId);
  const [model, tokenizer] = await Promise.all([
    StyleTextToSpeech2Model.from_pretrained(modelDir, { dtype: "q8", local_files_only: true }),
    AutoTokenizer.from_pretrained(modelDir, { local_files_only: true }),
  ]);
  type Tokenized = { input_ids: { dims: number[] } };
  type Speak = (inputs: Record<string, unknown>) => Promise<{ waveform: { data: Float32Array } }>;

  // Latin words inside Japanese or Chinese text are read in American English.
  const english = (word: string) => toPhonemes(phonemize, word, "en-us");
  let japanese: Promise<JapaneseG2P> | null = null;
  const loadJapanese = () =>
    (japanese ??= (async () => {
      const require = createRequire(import.meta.url);
      const kuromoji = (await import("kuromoji")).default;
      const dicPath = join(dirname(require.resolve("kuromoji/package.json")), "dict");
      const tokenizer = await new Promise<JaTokenizer>((resolve, reject) =>
        kuromoji.builder({ dicPath }).build((error, built) => (error ? reject(error) : resolve(built))),
      );
      const words = fileURLToPath(new URL("../../assets/tts/ja-words.txt.gz", import.meta.url));
      return new JapaneseG2P(tokenizer, words, english);
    })());
  let chinese: ChineseG2P | null = null;

  const phonemesFor = async (chunk: string, language: string): Promise<string> => {
    if (language === "ja") return (await loadJapanese()).phonemize(chunk);
    if (language === "zh") return (chinese ??= new ChineseG2P(english)).phonemize(chunk);
    return toPhonemes(phonemize, chunk, language);
  };

  const speak = async (text: string, voiceSpec: string, speed: number): Promise<Float32Array> => {
    const { style, language } = resolveVoice(voiceSpec);
    const cjk = language === "ja" || language === "zh";
    const pieces: Float32Array[] = [];
    // The English clean-up (numbers, titles, money) is for English voices only: eSpeak reads digits and money in
    // Spanish, French, Hindi and Portuguese itself, and the Japanese and Chinese readers read numbers themselves.
    const prepared = cjk ? text.trim() : prepareKokoroText(text, language);
    for (const chunk of chunkText(prepared, cjk ? CJK_CHUNK_CHARS : CHUNK_CHARS)) {
      const phonemes = await phonemesFor(chunk, language);
      if (!phonemes) continue;
      const { input_ids } = (tokenizer as unknown as (text: string, options: object) => Tokenized)(phonemes, {
        truncation: true,
      });
      const length = Math.min(Math.max((input_ids.dims.at(-1) ?? 2) - 2, 0), MAX_TOKENS - 1);
      const row = style.slice(length * STYLE_SIZE, (length + 1) * STYLE_SIZE);
      const { waveform } = await (model as unknown as Speak)({
        input_ids,
        style: new Tensor("float32", row, [1, STYLE_SIZE]),
        speed: new Tensor("float32", [speed], [1]),
      });
      pieces.push(waveform.data);
    }
    const total =
      pieces.reduce((sum, piece) => sum + piece.length, 0) + SENTENCE_GAP_SAMPLES * Math.max(0, pieces.length - 1);
    const samples = new Float32Array(total);
    let offset = 0;
    for (const piece of pieces) {
      samples.set(piece, offset);
      offset += piece.length + SENTENCE_GAP_SAMPLES;
    }
    return samples;
  };

  // One line at a time: a second request waits for the first instead of sharing the processor with it.
  let queue: Promise<void> = Promise.resolve();
  port.on("message", (message: { id: number; text: string; voice: string; speed: number }) => {
    queue = queue.then(async () => {
      try {
        const samples = await speak(message.text, message.voice, message.speed);
        port.postMessage({ id: message.id, samples }, [samples.buffer as ArrayBuffer]);
      } catch (error) {
        port.postMessage({ id: message.id, error: error instanceof Error ? error.message : String(error) });
      }
    });
  });
  port.postMessage({ type: "ready" });
} catch (error) {
  port.postMessage({ type: "failed", error: error instanceof Error ? error.message : String(error) });
}
