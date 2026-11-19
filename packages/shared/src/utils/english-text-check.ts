// ──────────────────────────────────────────────
// English text check for Marinara's own search model
// ──────────────────────────────────────────────
// Marinara's own search (all-MiniLM-L6-v2, used when no Embeddings default is set) was trained on English.
// This rough check says when the text someone vectorizes is mostly in another language, so the app can
// suggest a multilingual model instead. It only decides whether to show a notice, so it errs toward silence.

/** Common English words that are not also everyday words in other European languages ("in", "was", "so", "a"...). */
const ENGLISH_MARKER_WORDS = new Set([
  "the",
  "and",
  "of",
  "to",
  "you",
  "that",
  "he",
  "she",
  "it",
  "for",
  "with",
  "his",
  "her",
  "they",
  "this",
  "have",
  "from",
  "had",
  "but",
  "what",
  "were",
  "when",
  "your",
  "said",
  "there",
  "which",
  "their",
  "if",
  "about",
  "out",
  "them",
  "then",
  "would",
  "into",
  "has",
  "him",
  "been",
  "my",
  "than",
  "its",
  "now",
  "did",
  "just",
  "over",
  "could",
  "like",
  "are",
  "be",
  "at",
  "by",
  "not",
  "or",
  "we",
  "do",
  "can",
  "all",
  "as",
]);

/** Below this many letters (or words) there is too little text to tell. */
const MIN_LETTERS = 80;
const MIN_WORDS = 20;
/** At most this much text is read; a sample is enough. */
const MAX_SAMPLE_CHARS = 20_000;

/**
 * True when the texts read as mostly not English: mostly letters from a non-Latin script (Japanese, Chinese,
 * Korean, Cyrillic, Arabic...), or Latin-script text where common English words are rare (Spanish, German...).
 * False when there is too little text to tell.
 */
export function looksMostlyNonEnglish(texts: readonly string[]): boolean {
  let sample = "";
  for (const text of texts) {
    if (sample.length >= MAX_SAMPLE_CHARS) break;
    if (typeof text !== "string" || !text.trim()) continue;
    sample += `${text.slice(0, MAX_SAMPLE_CHARS - sample.length)}\n`;
  }
  const letters = sample.match(/\p{L}/gu) ?? [];
  if (letters.length < MIN_LETTERS) return false;
  const latinLetters = letters.filter((letter) => /\p{Script=Latin}/u.test(letter)).length;
  if ((letters.length - latinLetters) / letters.length > 0.3) return true;

  const words = (sample.toLowerCase().match(/\p{Script=Latin}+(?:'\p{Script=Latin}+)?/gu) ?? []).map((word) =>
    word.replace(/'.*$/u, ""),
  );
  if (words.length < MIN_WORDS) return false;
  const englishWords = words.filter((word) => ENGLISH_MARKER_WORDS.has(word)).length;
  // English prose runs around a third marker words; other Latin-script languages stay in the low single digits.
  return englishWords / words.length < 0.08;
}
