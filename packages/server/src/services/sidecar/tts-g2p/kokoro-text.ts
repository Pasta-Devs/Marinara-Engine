// ──────────────────────────────────────────────
// Kokoro's text clean-up before eSpeak reads it (a port of kokoro-js's English one)
// ──────────────────────────────────────────────

function splitNum(match: string): string {
  if (match.includes(".")) return match;
  if (match.includes(":")) {
    const [hours, minutes] = match.split(":").map(Number) as [number, number];
    return minutes === 0 ? `${hours} o'clock` : minutes < 10 ? `${hours} oh ${minutes}` : `${hours} ${minutes}`;
  }
  const year = parseInt(match.slice(0, 4), 10);
  if (year < 1100 || year % 1000 < 10) return match;
  const left = match.slice(0, 2);
  const right = parseInt(match.slice(2, 4), 10);
  const suffix = match.endsWith("s") ? "s" : "";
  if (year % 1000 >= 100 && year % 1000 <= 999) {
    if (right === 0) return `${left} hundred${suffix}`;
    if (right < 10) return `${left} oh ${right}${suffix}`;
  }
  return `${left} ${right}${suffix}`;
}

function flipMoney(match: string): string {
  const bill = match[0] === "$" ? "dollar" : "pound";
  if (isNaN(Number(match.slice(1)))) return `${match.slice(1)} ${bill}s`;
  if (!match.includes(".")) return `${match.slice(1)} ${bill}${match.slice(1) === "1" ? "" : "s"}`;
  const [whole, fraction = ""] = match.slice(1).split(".");
  const coins = parseInt(fraction.padEnd(2, "0"), 10);
  const coin = match[0] === "$" ? (coins === 1 ? "cent" : "cents") : coins === 1 ? "penny" : "pence";
  return `${whole} ${bill}${whole === "1" ? "" : "s"} and ${coins} ${coin}`;
}

function pointNum(match: string): string {
  const [whole, fraction = ""] = match.split(".");
  return `${whole} point ${fraction.split("").join(" ")}`;
}

/** Quotes, brackets and spaces, the same in every language eSpeak reads. */
function tidyText(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/«/g, "“")
    .replace(/»/g, "”")
    .replace(/[“”]/g, '"')
    .replace(/\(/g, "«")
    .replace(/\)/g, "»")
    .replace(/[^\S \n]/g, " ")
    .replace(/ {2,}/g, " ");
}

/** The English clean-up: numbers, money and titles spelled the way an English reader says them. */
function normalizeText(text: string): string {
  return tidyText(text)
    .replace(/\bD[Rr]\.(?= [A-Z])/g, "Doctor")
    .replace(/\b(?:Mr\.|MR\.(?= [A-Z]))/g, "Mister")
    .replace(/\b(?:Ms\.|MS\.(?= [A-Z]))/g, "Miss")
    .replace(/\b(?:Mrs\.|MRS\.(?= [A-Z]))/g, "Mrs")
    .replace(/\betc\.(?! [A-Z])/gi, "etc")
    .replace(/\b(y)eah?\b/gi, "$1e'a")
    .replace(/\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)/g, splitNum)
    .replace(/(?<=\d),(?=\d)/g, "")
    .replace(/[$£]\d+(?:\.\d+)?(?: hundred| thousand| (?:[bm]|tr)illion)*\b|[$£]\d+\.\d\d?\b/gi, flipMoney)
    .replace(/\d*\.\d+/g, pointNum)
    .replace(/(?<=\d)-(?=\d)/g, " to ")
    .replace(/(?<=\d)S/g, " S")
    .replace(/(?<=[BCDFGHJ-NP-TV-Z])'?s\b/g, "'S")
    .replace(/(?<=X')S\b/g, "s")
    .replace(/(?:[A-Za-z]\.){2,} [a-z]/g, (match) => match.replace(/\./g, "-"))
    .replace(/(?<=[A-Z])\.(?=[A-Z])/gi, "-")
    .trim();
}

/**
 * The text a Kokoro voice reads. English voices get the English clean-up; every other
 * language eSpeak reads keeps its digits and money for eSpeak's own rules, with only
 * quotes and spaces tidied. Japanese and Chinese go to their own readers, not here.
 */
export function prepareKokoroText(text: string, language: string): string {
  return language.startsWith("en") ? normalizeText(text) : tidyText(text).trim();
}
