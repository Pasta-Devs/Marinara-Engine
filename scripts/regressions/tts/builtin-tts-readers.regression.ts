/**
 * The built-in voice model's readers and voices, without downloading a model.
 *
 * Kokoro's Japanese and Chinese voices were trained on misaki's phonemes, so the Engine's ports must write the same
 * symbols: Hepburn-style kana with ː for long vowels, ʔ for small tsu and the assimilated ん; Mandarin pinyin with
 * tone arrows. Numbers are spelled out the way each language reads them. Which model is offered first follows the
 * Engine's language (Supertonic 3 where Kokoro has no voices for it), and a voice of the other model normalizes to
 * nothing, so the caller uses the model in use's default voice.
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "marinara-builtin-tts-"));
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";

const { ChineseG2P, numberToChinese, syllableToIpa } =
  await import("../../../packages/server/src/services/sidecar/tts-g2p/zh.js");
const { JapaneseG2P, numberToKana } = await import("../../../packages/server/src/services/sidecar/tts-g2p/ja.js");
const { normalizeBuiltinTtsVoice } =
  await import("../../../packages/server/src/services/sidecar/builtin-tts.service.js");
const { recommendedBuiltinTtsModel, BUILTIN_TTS_VOICES, BUILTIN_TTS_ESPEAK_LANGUAGE } =
  await import("../../../packages/shared/src/types/builtin-tts.js");

// ── Chinese ──
assert.equal(numberToChinese("15"), "十五");
assert.equal(numberToChinese("105"), "一百零五");
assert.equal(numberToChinese("2024"), "二千零二十四");
assert.equal(numberToChinese("10005"), "一万零五");
assert.equal(numberToChinese("3.14"), "三点一四");
assert.equal(syllableToIpa("hao3"), "xau↓");
assert.equal(syllableToIpa("shi4"), "ʂɨ↘");
assert.equal(syllableToIpa("ma0"), "ma");
assert.equal(syllableToIpa("yue4"), "ɥe↘");
assert.equal(syllableToIpa("qiu1"), "ʨʰjou→");
assert.equal(syllableToIpa("zhong1"), "ꭧʊ→ŋ");
const chinese = new ChineseG2P((word) => `<${word}>`);
assert.equal(chinese.phonemize("你好！"), "ni↓xau↓!");
// A year is read digit by digit, other numbers as numbers; Latin words go to the English reader.
assert.equal(chinese.phonemize("2024年").replace(/ /g, ""), "ɚ↘li↗ŋɚ↘sɨ↘njɛ↗n");
assert.match(chinese.phonemize("我喜欢AI。"), /<AI>/);

// ── Japanese ──
assert.equal(numberToKana("3"), "さん");
assert.equal(numberToKana("300"), "さんびゃく");
assert.equal(numberToKana("1800"), "せん はっぴゃく");
assert.equal(numberToKana("20000"), "に まん");
assert.equal(numberToKana("200000"), "に じゅう まん");
const serverRequire = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const kuromoji = serverRequire("kuromoji") as typeof import("kuromoji");
const tokenizer = await new Promise<import("kuromoji").Tokenizer<import("kuromoji").IpadicFeatures>>(
  (resolve, reject) =>
    kuromoji
      .builder({ dicPath: join(dirname(serverRequire.resolve("kuromoji/package.json")), "dict") })
      .build((error, built) => (error ? reject(error) : resolve(built))),
);
const words = fileURLToPath(new URL("../../../packages/server/src/assets/tts/ja-words.txt.gz", import.meta.url));
const japanese = new JapaneseG2P(tokenizer, words, (word) => `<${word}>`);
assert.equal(japanese.phonemize("こんにちは。"), "koɲɲiʨiβa.");
assert.equal(japanese.phonemize("東京タワー"), "toːkʲoː taβaː");
assert.equal(japanese.phonemize("ちょっと待って"), "ʨoʔto maʔte");
assert.equal(japanese.phonemize("しんぶん、さんぽ"), "ɕimbɯɴ, sampo");
assert.match(japanese.phonemize("Pythonが好き"), /<Python>/);

// ── Voices and models ──
for (const voice of BUILTIN_TTS_VOICES.filter((entry) => entry.model === "kokoro-82m")) {
  assert.ok(BUILTIN_TTS_ESPEAK_LANGUAGE[voice.id[0]!], `${voice.id} has a reading language`);
  assert.match(voice.sha256, /^[0-9a-f]{64}$/);
}
assert.ok(BUILTIN_TTS_VOICES.some((voice) => voice.id === "jf_alpha" && voice.language === "ja"));
assert.ok(BUILTIN_TTS_VOICES.some((voice) => voice.id === "zm_yunxi" && voice.language === "zh"));
for (const language of ["ko", "ja", "de", "pl", "ru"])
  assert.equal(recommendedBuiltinTtsModel(language), "supertonic-3");
for (const language of ["en", "es", "fr", "hi", "pt-BR", "zh-Hans"])
  assert.equal(recommendedBuiltinTtsModel(language), "kokoro-82m");
assert.equal(normalizeBuiltinTtsVoice("st_F1", "kokoro-82m"), null);
assert.equal(normalizeBuiltinTtsVoice("af_bella:60+am_puck:40", "kokoro-82m"), "af_bella:60+am_puck:40");
assert.equal(normalizeBuiltinTtsVoice("af_heart", "supertonic-3"), null);

// Kokoro's English clean-up is for English voices: eSpeak reads digits and money in its other languages itself.
const { prepareKokoroText } = await import("../../../packages/server/src/services/sidecar/tts-g2p/kokoro-text.js");
for (const language of ["es", "fr", "hi", "pt-br"]) {
  const prepared = prepareKokoroText("Cuesta $5, unos 1.5 en 1999.", language);
  assert.equal(prepared, "Cuesta $5, unos 1.5 en 1999.", `${language}: digits and money are left for eSpeak`);
}
const english = prepareKokoroText("It costs $5, about 1.5 in 1999.", "en-us");
assert.match(english, /5 dollars/);
assert.match(english, /1 point 5/);
assert.match(english, /19 99/);

console.log("builtin-tts-readers: ok");
