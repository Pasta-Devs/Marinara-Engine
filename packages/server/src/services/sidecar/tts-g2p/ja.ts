// ──────────────────────────────────────────────
// Japanese text to Kokoro phonemes
// ──────────────────────────────────────────────
// A port of misaki 0.7.4's JAG2P (Apache-2.0, hexgrad), the pronunciation step Kokoro-82M v1.0's Japanese voices
// were trained with; misaki follows cutlet (MIT, polm). Words and their readings come from kuromoji (Apache-2.0,
// IPADIC) instead of fugashi with UniDic; ja-words.txt.gz is misaki's list of words to keep together.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

/** One kuromoji token, as far as this file reads it. */
export interface JaToken {
  surface_form: string;
  pos: string;
  word_type: string;
  reading?: string;
  pronunciation?: string;
}

export type JaTokenizer = { tokenize(text: string): JaToken[] };

const HEPBURN: Record<string, string> = {};
// Single hiragana, in order from ぁ (U+3041) to ゖ (U+3096); っ and ん are handled by rule.
const SINGLE =
  "a a i i ɯ ɯ e e o o ka ɡa kʲi ɡʲi kɯ ɡɯ ke ɡe ko ɡo sa ʣa ɕi ʥi sɨ zɨ se ʣe so ʣo ta da ʨi ʥi _ ʦɨ zɨ te de to do na ɲi nɯ ne no ha ba pa çi bʲi pʲi ɸɯ bɯ pɯ he be pe ho bo po ma mʲi mɯ me mo ja ja jɯ jɯ jo jo ɾa ɾʲi ɾɯ ɾe ɾo βa βa i e o _ vɯ ka ke".split(
    " ",
  );
SINGLE.forEach((value, index) => {
  if (value !== "_") HEPBURN[String.fromCharCode(0x3041 + index)] = value;
});
Object.assign(HEPBURN, { ヷ: "va", ヸ: "vʲi", ヹ: "ve", ヺ: "vo" });
const DIGRAPHS: Array<[string, string]> = [
  ["いぇ", "je"],
  ["うぃ", "βi"],
  ["うぇ", "βe"],
  ["うぉ", "βo"],
  ["きぇ", "kʲe"],
  ["きゃ", "kʲa"],
  ["きゅ", "kʲɨ"],
  ["きょ", "kʲo"],
  ["ぎゃ", "ɡʲa"],
  ["ぎゅ", "ɡʲɨ"],
  ["ぎょ", "ɡʲo"],
  ["くぁ", "kᵝa"],
  ["くぃ", "kᵝi"],
  ["くぇ", "kᵝe"],
  ["くぉ", "kᵝo"],
  ["ぐぁ", "ɡᵝa"],
  ["ぐぃ", "ɡᵝi"],
  ["ぐぇ", "ɡᵝe"],
  ["ぐぉ", "ɡᵝo"],
  ["しぇ", "ɕe"],
  ["しゃ", "ɕa"],
  ["しゅ", "ɕɨ"],
  ["しょ", "ɕo"],
  ["じぇ", "ʥe"],
  ["じゃ", "ʥa"],
  ["じゅ", "ʥɨ"],
  ["じょ", "ʥo"],
  ["ちぇ", "ʨe"],
  ["ちゃ", "ʨa"],
  ["ちゅ", "ʨɨ"],
  ["ちょ", "ʨo"],
  ["ぢゃ", "ʥa"],
  ["ぢゅ", "ʥɨ"],
  ["ぢょ", "ʥo"],
  ["つぁ", "ʦa"],
  ["つぃ", "ʦʲi"],
  ["つぇ", "ʦe"],
  ["つぉ", "ʦo"],
  ["てぃ", "tʲi"],
  ["てゅ", "tʲɨ"],
  ["でぃ", "dʲi"],
  ["でゅ", "dʲɨ"],
  ["とぅ", "tɯ"],
  ["どぅ", "dɯ"],
  ["にぇ", "ɲe"],
  ["にゃ", "ɲa"],
  ["にゅ", "ɲɨ"],
  ["にょ", "ɲo"],
  ["ひぇ", "çe"],
  ["ひゃ", "ça"],
  ["ひゅ", "çɨ"],
  ["ひょ", "ço"],
  ["びゃ", "bʲa"],
  ["びゅ", "bʲɨ"],
  ["びょ", "bʲo"],
  ["ぴゃ", "pʲa"],
  ["ぴゅ", "pʲɨ"],
  ["ぴょ", "pʲo"],
  ["ふぁ", "ɸa"],
  ["ふぃ", "ɸʲi"],
  ["ふぇ", "ɸe"],
  ["ふぉ", "ɸo"],
  ["ふゅ", "ɸʲɨ"],
  ["ふょ", "ɸʲo"],
  ["みゃ", "mʲa"],
  ["みゅ", "mʲɨ"],
  ["みょ", "mʲo"],
  ["りゃ", "ɾʲa"],
  ["りゅ", "ɾʲɨ"],
  ["りょ", "ɾʲo"],
  ["ゔぁ", "va"],
  ["ゔぃ", "vʲi"],
  ["ゔぇ", "ve"],
  ["ゔぉ", "vo"],
  ["ゔゅ", "bʲɨ"],
  ["ゔょ", "bʲo"],
];
for (const [kana, value] of DIGRAPHS) HEPBURN[kana] = value;
Object.assign(HEPBURN, {
  "。": ".",
  "、": ",",
  "？": "?",
  "！": "!",
  "「": "“",
  "」": "”",
  "『": "“",
  "』": "”",
  "：": ":",
  "；": ";",
  "（": "(",
  "）": ")",
  "《": "(",
  "》": ")",
  "【": "[",
  "】": "]",
  "・": " ",
  "，": ",",
  "～": "—",
  "〜": "—",
  "—": "—",
  "«": "“",
  "»": "”",
  "゚": "",
  "゙": "",
});

const PHONETIC_EXTENSIONS: Record<string, string> = Object.fromEntries(
  [
    "ㇰク",
    "ㇱシ",
    "ㇲス",
    "ㇳト",
    "ㇴヌ",
    "ㇵハ",
    "ㇶヒ",
    "ㇷフ",
    "ㇸヘ",
    "ㇹホ",
    "ㇺム",
    "ㇻラ",
    "ㇼリ",
    "ㇽル",
    "ㇾレ",
    "ㇿロ",
  ].map((pair) => [pair[0]!, pair[1]!]),
);
const SUTEGANA = new Set("ゃゅょぁぃぅぇぉ");
const ODORI = new Set("〃々ゝゞヽ");

const kataToHira = (text: string) => text.replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));

function addDakuten(kana: string): string | null {
  const index = "かきくけこさしすせそたちつてとはひふへほ".indexOf(kana);
  return index < 0 ? null : "がぎぐげござじずぜぞだぢづでどばびぶべぼ"[index]!;
}

// ── Numbers, read in hiragana (misaki's num2kana) ──

const DIGIT = ["ゼロ", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう"];
const HUNDREDS: Record<number, string> = { 1: "ひゃく", 3: "さんびゃく", 6: "ろっぴゃく", 8: "はっぴゃく" };
const THOUSANDS: Record<number, string> = { 1: "せん", 3: "さんぜん", 8: "はっせん" };

/** 0..9999 as spaced hiragana words. */
function underTenThousand(value: number): string[] {
  const words: string[] = [];
  const thousands = Math.floor(value / 1000);
  const hundreds = Math.floor((value % 1000) / 100);
  const tens = Math.floor((value % 100) / 10);
  const ones = value % 10;
  if (thousands) words.push(THOUSANDS[thousands] ?? `${DIGIT[thousands]} せん`);
  if (hundreds) words.push(HUNDREDS[hundreds] ?? `${DIGIT[hundreds]} ひゃく`);
  if (tens) words.push(tens === 1 ? "じゅう" : `${DIGIT[tens]} じゅう`);
  if (ones) words.push(DIGIT[ones]!);
  return words;
}

export function numberToKana(digits: string): string {
  const value = Number(digits);
  if (!Number.isSafeInteger(value) || digits.length > 12) return [...digits].map((d) => DIGIT[Number(d)]).join(" ");
  if (value === 0) return DIGIT[0]!;
  const oku = Math.floor(value / 1e8);
  const man = Math.floor((value % 1e8) / 1e4);
  const rest = value % 1e4;
  const words: string[] = [];
  if (oku) words.push(...underTenThousand(oku), "おく");
  if (man) words.push(...underTenThousand(man), "まん");
  words.push(...underTenThousand(rest));
  return words.join(" ");
}

function normalize(text: string): string {
  let out = text.replace(/[〜～](?=\d)/g, "から");
  for (const [from, to] of Object.entries(PHONETIC_EXTENSIONS)) out = out.split(from).join(to);
  // NFKC turns full-width letters and digits half-width and half-width katakana full-width.
  out = out.normalize("NFKC");
  return out.replace(/\d+/g, (digits) => ` ${numberToKana(digits)}`);
}

// ── Words ──

interface Word {
  surface: string;
  hira: string;
  /** 6: readable kana (any known word, or katakana); 3: a symbol; anything else is left out. */
  charType: number;
}

const isKatakana = (text: string) => /^[゠-ヿー]+$/.test(text);
const isSymbol = (text: string) => /^[\p{P}\p{S}\s]+$/u.test(text);

function toWord(token: JaToken): Word {
  const pron = token.pronunciation && token.pronunciation !== "*" ? token.pronunciation : undefined;
  const reading = token.reading && token.reading !== "*" ? token.reading : undefined;
  const surface = token.surface_form;
  const known = token.word_type === "KNOWN";
  const charType = isKatakana(surface) || (known && (pron || reading)) ? 6 : isSymbol(surface) ? 3 : 0;
  return { surface, hira: kataToHira(pron ?? reading ?? surface), charType };
}

export class JapaneseG2P {
  private readonly words: Set<string>;

  constructor(
    private readonly tokenizer: JaTokenizer,
    wordsGzPath: string,
    /** Phonemes for a Latin-letter word that has no Japanese reading. */
    private readonly english: (text: string) => string,
  ) {
    this.words = new Set(
      gunzipSync(readFileSync(wordsGzPath))
        .toString("utf-8")
        .split("\n")
        .map((w) => w.trim()),
    );
  }

  phonemize(text: string): string {
    if (!text.trim()) return "";
    const words = this.tokenizer.tokenize(normalize(text)).map(toWord);
    const out = this.tokens(words)
      .map((token) => `${token.surface}${token.space ? " " : ""}`)
      .join("");
    return out
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\(/g, "«")
      .replace(/\)/g, "»")
      .replace(/(?<![!",.:;?»—…”]) (?=ʔ)|(?<=ʔ) (?!["«“])/g, "");
  }

  private tokens(input: Word[]): Array<{ surface: string; space: boolean }> {
    // Longest run of same-type words that misaki keeps as one word.
    const groups: Word[][] = [];
    for (let i = 0; i < input.length;) {
      let end = i + 1;
      while (end < input.length && input[end]!.charType === input[i]!.charType) end += 1;
      let j: number | null = null;
      for (let k = end; k > i; k -= 1) {
        if (
          this.words.has(
            input
              .slice(i, k)
              .map((w) => w.surface)
              .join(""),
          )
        ) {
          j = k;
          break;
        }
      }
      if (j === null) {
        groups.push([input[i]!]);
        i += 1;
      } else {
        groups.push(input.slice(i, j));
        i = j;
      }
    }
    const words = groups.map((group) => ({
      surface: group.map((w) => w.surface).join(""),
      hira: group.map((w) => w.hira).join(""),
      charType: group[0]!.charType,
    }));
    const out: Array<{ surface: string; space: boolean }> = [];
    for (const word of words) {
      const previous = out[out.length - 1];
      const roma = this.romajiWord(word);
      const token = { surface: roma, space: false };
      if ("「『«".includes(word.surface) || "([".includes(roma)) {
        if (previous) previous.space = true;
      } else if ("」』»".includes(word.surface) || "]).,?!:".includes(roma)) {
        if (previous) previous.space = false;
        token.space = true;
      } else if (roma === " ") {
        token.space = false;
      } else {
        token.space = true;
      }
      out.push(token);
    }
    for (const token of out) token.surface = token.surface.replace(/っ/g, "");
    return out;
  }

  private romajiWord(word: Word): string {
    const { surface } = word;
    // eslint-disable-next-line no-control-regex
    if (/^[\x00-\x7f]+$/.test(surface)) {
      // A Latin word with a Japanese reading (ABC: エイビーシー) is read as that; otherwise in English.
      if (word.charType === 6 && /[ぁ-ゖ]/.test(word.hira)) return this.kana(word.hira);
      return /[A-Za-z]/.test(surface) ? this.english(surface) : surface;
    }
    if (word.charType === 3) return [...surface].map((char) => HEPBURN[char] ?? char).join("");
    if (word.charType !== 6) return "";
    return this.kana(word.hira);
  }

  private kana(hira: string): string {
    const chars = [...hira];
    let out = "";
    chars.forEach((char, index) => {
      out += this.single(chars[index - 1], char, chars[index + 1]);
    });
    return out;
  }

  private single(previous: string | undefined, kana: string, next: string | undefined): string {
    if (ODORI.has(kana)) {
      if ("ゝヽ".includes(kana)) return previous ?? "";
      if ("ゞヾ".includes(kana)) {
        const voiced = previous ? addDakuten(previous) : null;
        return voiced ? (HEPBURN[voiced] ?? "") : "";
      }
      return "";
    }
    if (previous && HEPBURN[previous + kana] !== undefined) return HEPBURN[previous + kana]!;
    if (next && HEPBURN[kana + next] !== undefined) return "";
    if (next && SUTEGANA.has(next)) {
      if (kana === "っ") return "";
      return (HEPBURN[kana] ?? "").slice(0, -1) + (HEPBURN[next] ?? "");
    }
    if (SUTEGANA.has(kana)) return "";
    if (kana === "ー") return "ː";
    if (kana === "っ") return "ʔ";
    if (kana === "ん") {
      const following = next ? HEPBURN[next] : undefined;
      if (following) {
        if ("mpb".includes(following[0]!)) return "m";
        if ("kɡ".includes(following[0]!)) return "ŋ";
        if (["ɲ", "ʨ", "ʥ"].some((p) => following.startsWith(p))) return "ɲ";
        if ("ntdɾz".includes(following[0]!)) return "n";
      }
      return "ɴ";
    }
    return HEPBURN[kana] ?? "";
  }
}
