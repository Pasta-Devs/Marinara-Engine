// ──────────────────────────────────────────────
// Mandarin Chinese text to Kokoro phonemes
// ──────────────────────────────────────────────
// A port of misaki 0.7.4's ZHG2P (Apache-2.0, hexgrad), the pronunciation step Kokoro-82M v1.0's Chinese voices
// were trained with, and of the pinyin-to-IPA tables it uses (pinyin-to-ipa, MIT, Stefan Taubert). Words come from
// the runtime's own word breaker (Intl.Segmenter) instead of jieba, and their pinyin from pinyin-pro (MIT) instead
// of pypinyin; numbers are read the way cn2an's an2cn writes them.
import { pinyin } from "pinyin-pro";

type Variant = string[];

const INITIALS: Record<string, string> = {
  b: "p",
  c: "ʦʰ",
  ch: "ꭧʰ",
  d: "t",
  f: "f",
  g: "k",
  h: "x",
  j: "ʨ",
  k: "kʰ",
  l: "l",
  m: "m",
  n: "n",
  p: "pʰ",
  q: "ʨʰ",
  r: "ɻ",
  s: "s",
  sh: "ʂ",
  t: "tʰ",
  x: "ɕ",
  z: "ʦ",
  zh: "ꭧ",
};

const SYLLABIC_CONSONANTS: Record<string, Variant> = {
  hm: ["h", "m0"],
  hng: ["h", "ŋ0"],
  m: ["m0"],
  n: ["n0"],
  ng: ["ŋ0"],
};

const INTERJECTIONS: Record<string, Variant> = {
  io: ["j", "ɔ0"],
  ê: ["ɛ0"],
  er: ["ɚ0"],
  o: ["ɔ0"],
};

const FINALS: Record<string, Variant> = {
  a: ["a0"],
  ai: ["ai̯0"],
  an: ["a0", "n"],
  ang: ["a0", "ŋ"],
  ao: ["au̯0"],
  e: ["ɤ0"],
  ei: ["ei̯0"],
  en: ["ə0", "n"],
  eng: ["ə0", "ŋ"],
  i: ["i0"],
  ia: ["j", "a0"],
  ian: ["j", "ɛ0", "n"],
  iang: ["j", "a0", "ŋ"],
  iao: ["j", "au̯0"],
  ie: ["j", "e0"],
  in: ["i0", "n"],
  iou: ["j", "ou̯0"],
  ing: ["i0", "ŋ"],
  iong: ["j", "ʊ0", "ŋ"],
  ong: ["ʊ0", "ŋ"],
  ou: ["ou̯0"],
  u: ["u0"],
  uei: ["w", "ei̯0"],
  ua: ["w", "a0"],
  uai: ["w", "ai̯0"],
  uan: ["w", "a0", "n"],
  uen: ["w", "ə0", "n"],
  uang: ["w", "a0", "ŋ"],
  ueng: ["w", "ə0", "ŋ"],
  uo: ["w", "o0"],
  o: ["w", "o0"],
  ü: ["y0"],
  üe: ["ɥ", "e0"],
  üan: ["ɥ", "ɛ0", "n"],
  ün: ["y0", "n"],
};

const TONES: Record<number, string> = { 1: "˥", 2: "˧˥", 3: "˧˩˧", 4: "˥˩", 5: "" };

/** pypinyin's strict initial and final of a toneless syllable ("yue" → ["", "üe"], "gui" → ["g", "uei"]). */
function split(syllable: string): [string, string] {
  let initial = "";
  for (const candidate of ["zh", "ch", "sh"]) if (syllable.startsWith(candidate)) initial = candidate;
  if (!initial && /^[bpmfdtnlgkhjqxrzcs]/.test(syllable)) initial = syllable[0]!;
  let final = syllable.slice(initial.length);
  if (!initial && (syllable.startsWith("y") || syllable.startsWith("w"))) {
    // y and w are spelling, not initials, in the strict scheme.
    const rest = syllable.slice(1);
    if (syllable.startsWith("y")) {
      if (rest.startsWith("u") || rest.startsWith("ü")) final = `ü${rest.slice(1)}`;
      else if (rest.startsWith("i")) final = rest;
      else final = `i${rest}`;
    } else {
      final = rest.startsWith("u") ? rest : `u${rest}`;
    }
  }
  // After j, q and x a written u is ü.
  if ("jqx".includes(initial) && initial && final.startsWith("u")) final = `ü${final.slice(1)}`;
  // Abbreviated spellings.
  if (final === "iu") final = "iou";
  else if (final === "ui") final = "uei";
  else if (final === "un") final = initial && "jqx".includes(initial) ? "ün" : "uen";
  else if (final === "ue") final = "üe";
  else if (final === "v") final = "ü";
  final = final.replace(/v/g, "ü");
  // "yong" splits as i + ong; "you" as i + ou; "yin"/"ying" as in/ing; "ye" as ie.
  if (final === "iong" || final === "iou") return [initial, final];
  return [initial, final];
}

function retone(phoneme: string): string {
  return phoneme
    .replace(/˧˩˧/g, "↓")
    .replace(/˧˥/g, "↗")
    .replace(/˥˩/g, "↘")
    .replace(/˥/g, "→")
    .replace(/ɻ̩/g, "ɨ")
    .replace(/ɹ̩/g, "ɨ");
}

/** One syllable with its tone number ("hao3", "ma5") as Kokoro phonemes. */
export function syllableToIpa(withTone: string): string {
  const match = /^([a-zêüv]+)([0-5])?$/.exec(withTone.toLowerCase());
  if (!match) return "";
  const normal = match[1]!.replace(/v/g, "ü");
  const tone = match[2] === undefined || match[2] === "0" ? 5 : Number(match[2]);
  const toneIpa = TONES[tone] ?? "";
  let parts: Variant;
  if (INTERJECTIONS[normal]) parts = INTERJECTIONS[normal]!;
  else if (SYLLABIC_CONSONANTS[normal]) parts = SYLLABIC_CONSONANTS[normal]!;
  else {
    const [initial, final] = split(normal);
    let finalParts = FINALS[final];
    if (final === "i" && ["zh", "ch", "sh", "r"].includes(initial)) finalParts = ["ɻ̩0"];
    else if (final === "i" && ["z", "c", "s"].includes(initial)) finalParts = ["ɹ̩0"];
    if (!finalParts) return "";
    parts = [...(initial ? [INITIALS[initial] ?? ""] : []), ...finalParts];
  }
  return parts
    .map((part) => retone(part.replace("0", toneIpa)))
    .join("")
    .replace(/̯/g, "");
}

// ── Numbers (cn2an an2cn) ──

const DIGITS = "零一二三四五六七八九";

/** 1..9999 in characters, with 零 for each gap ("一千零五"). */
function section(value: number): string {
  const units = ["千", "百", "十", ""];
  const digits = String(value).padStart(4, "0").split("").map(Number);
  let out = "";
  let gap = false;
  digits.forEach((digit, index) => {
    if (digit === 0) {
      gap = out !== "";
      return;
    }
    if (gap) out += "零";
    gap = false;
    out += DIGITS[digit]! + units[index]!;
  });
  return out;
}

export function numberToChinese(text: string): string {
  const [whole = "0", fraction] = text.split(".");
  const value = Number(whole);
  let out = "";
  if (!Number.isSafeInteger(value) || whole.length > 16) out = [...whole].map((d) => DIGITS[Number(d)]).join("");
  else if (value === 0) out = "零";
  else {
    const groups: number[] = [];
    for (let rest = value; rest > 0; rest = Math.floor(rest / 10_000)) groups.unshift(rest % 10_000);
    const names = ["", "万", "亿", "万亿"];
    let gap = false;
    groups.forEach((group, index) => {
      if (group === 0) {
        gap = true;
        return;
      }
      if (out && (gap || group < 1000)) out += "零";
      gap = false;
      out += section(group) + names[groups.length - 1 - index]!;
    });
    // 一十 at the start reads 十 (十五, not 一十五).
    if (out.startsWith("一十")) out = out.slice(1);
  }
  if (fraction) out += `点${[...fraction].map((d) => DIGITS[Number(d)]).join("")}`;
  return out;
}

const HAN = /[一-鿿]/;

export class ChineseG2P {
  private readonly segmenter = new Intl.Segmenter("zh", { granularity: "word" });

  constructor(
    /** Phonemes for a run of Latin letters. */
    private readonly english: (text: string) => string,
  ) {}

  phonemize(text: string): string {
    if (!text.trim()) return "";
    const withNumbers = text
      // A year is read digit by digit (二零二四年).
      .replace(/(\d{2,4})(?=年)/g, (digits: string) => [...digits].map((d) => DIGITS[Number(d)]).join(""))
      .replace(/(\d+(?:\.\d+)?)%/g, (_, n: string) => `百分之${numberToChinese(n)}`)
      .replace(/\d+(?:\.\d+)?/g, (n) => numberToChinese(n));
    let out = "";
    for (const segment of withNumbers.match(/[一-鿿]+|[^一-鿿]+/g) ?? []) {
      if (HAN.test(segment[0]!)) {
        const words = [...this.segmenter.segment(segment)].map((part) => part.segment);
        out += words
          .map((word) =>
            pinyin(word, { toneType: "num", type: "array", toneSandhi: false })
              .map((syllable) => syllableToIpa(syllable))
              .join(""),
          )
          .join(" ");
      } else {
        out += this.other(segment);
      }
    }
    return out.replace(/̯/g, "");
  }

  /** Punctuation as Kokoro writes it; Latin words read in English. */
  private other(segment: string): string {
    return segment
      .normalize("NFKC")
      .replace(/[“”「」『』]/g, '"')
      .replace(/、/g, ",")
      .replace(/。/g, ".")
      .replace(/[A-Za-z][A-Za-z']*/g, (word) => ` ${this.english(word)} `)
      .replace(/\s+/g, " ");
  }
}
