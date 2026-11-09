// ──────────────────────────────────────────────
// Theme text safety (theme security audit, 2026-11-09)
//
// A theme can put its own words on screen: CSS `content:` strings (and the custom properties and
// counter styles that feed them), the message box placeholder, HTML message templates, text inside
// SVG pictures, and its name, author, description and credits. None of that may pretend to be the
// app: no scare messages ("your PC has been hacked, RCE detected"), no fake sign-in or "re-enter
// your API key" prompts, no "call support" numbers, no fake "verified safe" notices.
//
// Every piece of theme text is folded first (Unicode compatibility forms, accents, zero-width
// characters, Cyrillic/Greek look-alikes, 1337 spelling, spaced or dotted letters), so the word
// lists can't be dodged with "pаssword" (Cyrillic а), "p a s s w o r d" or "h4cked". Text added
// through CSS is also capped in length: decorations are a few words, a paragraph is a message.
//
// Text baked into pixels (a PNG that says "hacked") can't be read here; that is what the import
// preview's pictures and the "Keep this theme?" countdown are for.
// ──────────────────────────────────────────────

/** Cyrillic, Greek and other letters that look like Latin ones. */
export const CONFUSABLES: Record<string, string> = {
  а: "a",
  е: "e",
  о: "o",
  р: "p",
  с: "c",
  у: "y",
  х: "x",
  і: "i",
  ј: "j",
  ѕ: "s",
  ԁ: "d",
  һ: "h",
  ӏ: "l",
  ԛ: "q",
  ԝ: "w",
  ɑ: "a",
  ɡ: "g",
  ı: "i",
  ℓ: "l",
  α: "a",
  β: "b",
  ε: "e",
  ι: "i",
  κ: "k",
  ν: "v",
  ο: "o",
  ρ: "p",
  τ: "t",
  υ: "u",
  χ: "x",
  ϲ: "c",
  ꓲ: "i",
  ꭰ: "d",
  ⅰ: "i",
  ⅼ: "l",
};

/** Digits and symbols people use in place of letters ("h4ck3d", "p@ssw0rd", "$ecret"). */
const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
  "!": "i",
  "|": "l",
  "€": "e",
};

/** Lower-case, accent-free, look-alike-free text (letters and digits kept as they are). */
export function foldText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .normalize("NFKC")
    .replace(/[\p{Cf}͏ᅟᅠㅤﾠ]/gu, "")
    .toLowerCase()
    .replace(/./gu, (ch) => CONFUSABLES[ch] ?? ch);
}

/** Words separated by single spaces ("Pаss-word!" → "pass word"). */
function spacedForm(folded: string) {
  return ` ${folded.replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
}

/** Letters only, with 1337 spelling undone ("p.a.s.s w0rd" → "password"). */
function squashedForm(folded: string) {
  return folded.replace(/./gu, (ch) => LEET[ch] ?? ch).replace(/[^\p{L}]+/gu, "");
}

/**
 * Whole words or phrases (matched on the spaced form, so "tokenizer" isn't "token") and long,
 * unmistakable stems (matched on the squashed form too, so spacing and dots don't hide them).
 */
const SECRET_WORDS =
  /\s(api ?keys?|apikeys?|pass ?words?|passwd|passcodes?|passphrases?|pin ?codes?|tokens?|secret ?keys?|private ?keys?|seed ?phrases?|recovery ?phrases?|mnemonic|credentials?|credit ?cards?|card ?numbers?|cvv|cvc|2fa|otp|one ?time ?(?:code|password)|verification ?code|security ?code|log ?in|login|logon|sign ?in|signin|re ?enter|reenter|re ?authenticate|re ?login|session (?:has )?expired|expired session|verify (?:your|you|it|now|here|account)|confirm (?:your|you|account|identity)|accounts?|wallet|paste|ssn|social security|bank|billing|payment|keys? (?:here|below)|your keys?)\s/;
const SECRET_STEMS =
  /(apikey|password|passwd|passcode|passphrase|secretkey|privatekey|seedphrase|recoveryphrase|credential|creditcard|cardnumber|verificationcode|securitycode|reenteryour|signinagain|loginagain|sessionexpired|verifyyouraccount|confirmyouraccount|yourapikey|youraccount|yourwallet)/;

const SCARE_WORDS =
  /\s(hacked|hackers?|pwn(?:ed|d)?|0wned|owned by|compromised|rce|remote code|code execution|exploit(?:ed)?|malware|viruse?s?|trojans?|ransomware|spyware|keyloggers?|infected|infection|breach(?:ed)?|leaked|exfiltrat\w*|backdoor|rootkit|security (?:alert|warning|notice|breach|check|update|team|issue|threat)|system (?:alert|warning|error|failure|compromised|notice)|critical (?:alert|warning|error|update)|warning|alert|danger|threat|attack(?:ed|er)?|intrusion|suspicious|unauthori[sz]ed|encrypted (?:your|all)|your (?:pc|computer|device|system|files|chats|data|browser|machine|install|connection) (?:is|has|have|are|were|was|will)|uploaded|being (?:uploaded|sent|stolen|deleted)|stolen|call (?:now|us|support|this|the|immediately|\+?\d)|tech ?support|customer support|helpline|hotline|toll free|do not (?:close|turn off|restart|refresh)|don ?t (?:close|turn off|restart|refresh)|close all tabs|restart (?:now|your)|update (?:required|now)|install (?:now|this|the update)|download (?:now|this|the)|click (?:here|ok|this|to|below|the button|allow)|press (?:ok|allow)|official|verified|certified|approved by|endorsed|marinara (?:security|support|team|staff|admin|official|system)|error code|errors? 0x|fatal error|urgent|immediately|act now|blocked|locked out|deactivated|suspended|banned|antivirus|firewall|scan(?:ning)? (?:complete|your)|virus ?total|bitcoin|crypto|gift ?cards?|refund)\s/;
const SCARE_STEMS =
  /(hacked|pwned|compromised|remotecode|codeexecution|malware|ransomware|spyware|keylogger|infected|exfiltrat|securityalert|securitywarning|systemalert|systemwarning|criticalalert|techsupport|donotclose|closealltabs|clickhere|marinarasecurity|marinarasupport|marinarateam|virusdetected|threatdetected|antivirus|youvebeen|yourpc|yourcomputer|yourdevice|yourfiles)/;

/** A phone number ("+1-800-555-0199", "(800) 555 0199"): nine digits or more in one run. */
function hasPhoneNumber(text: string) {
  for (const match of text.matchAll(/\+?\(?\d[\d\s().-]{6,}\d/g)) {
    if (match[0].replace(/\D/g, "").length >= 9) return true;
  }
  return false;
}
/** A web address or e-mail ("go to evil.example/login", "support@…"). */
const ADDRESS =
  /\b(?:https?:\/\/|www\.)|\b[\w-]+\.(?:com|net|org|io|co|app|xyz|ru|cn|info|biz|me|link|site|online|top)\b|@[\w-]+\.\w/i;

export type ThemeTextThreat = "secret" | "scare" | "contact" | "long";

/** The most text one piece of theme-drawn text may hold (letters and digits, spaces not counted). */
export const MAX_THEME_TEXT_CHARS = 80;

/**
 * Why a piece of theme text may not be shown, or null when it's fine. `long` only applies to text
 * a theme paints into the app (CSS, placeholder, template, pictures), not to its description.
 */
export function themeTextThreat(text: string, options: { lengthCap?: number | null } = {}): ThemeTextThreat | null {
  if (!text) return null;
  const folded = foldText(text);
  const spaced = spacedForm(folded);
  const squashed = squashedForm(folded);
  const leetSpaced = spacedForm(folded.replace(/./gu, (ch) => LEET[ch] ?? ch));
  if (SECRET_WORDS.test(spaced) || SECRET_WORDS.test(leetSpaced) || SECRET_STEMS.test(squashed)) return "secret";
  if (SCARE_WORDS.test(spaced) || SCARE_WORDS.test(leetSpaced) || SCARE_STEMS.test(squashed)) return "scare";
  if (hasPhoneNumber(folded) || ADDRESS.test(folded)) return "contact";
  const cap = options.lengthCap === undefined ? MAX_THEME_TEXT_CHARS : options.lengthCap;
  if (cap != null && folded.replace(/[^\p{L}\p{N}]/gu, "").length > cap) return "long";
  return null;
}

/** The first threatening text in a list, with why. */
export function firstThreat(
  texts: Iterable<string>,
  options: { lengthCap?: number | null } = {},
): { text: string; threat: ThemeTextThreat } | null {
  for (const text of texts) {
    const threat = themeTextThreat(text, options);
    if (threat) return { text, threat };
  }
  return null;
}

// ── Text in CSS ──

/** Properties whose strings are never drawn as text (font names, grid area names, feature tags). */
const NON_TEXT_PROPERTIES = new Set([
  "font-family",
  "font",
  "font-feature-settings",
  "font-variation-settings",
  "font-language-override",
  "font-palette",
  "grid-template-areas",
  "grid-template",
  "grid",
  "grid-area",
  "will-change",
  "src",
  "unicode-range",
  "animation-name",
  "transition-property",
  "view-transition-name",
  "anchor-name",
  "position-anchor",
  "container-name",
  "syntax",
]);
/** @counter-style descriptors draw their identifiers as text too (`symbols: Y o u r …`). */
const COUNTER_TEXT = new Set(["symbols", "additive-symbols", "prefix", "suffix", "negative", "pad"]);

function decodeCssString(body: string) {
  return body
    .replace(/\\\r\n|\\[\n\r\f]/g, "")
    .replace(/\\([0-9a-fA-F]{1,6})[ \t\n\r\f]?/g, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : "�";
    })
    .replace(/\\([\s\S])/g, "$1");
}

/**
 * Every piece of text a stylesheet could draw: the strings in each declaration (escapes decoded),
 * joined per declaration, except in properties that never show them (font-family, grid areas) and
 * except URLs. Selectors' strings (`[data-x="…"]`) are left out. Custom properties count, since
 * `content: var(--x)` draws them.
 */
export function cssDrawnTexts(css: string): string[] {
  const out: string[] = [];
  let segment = "";
  let strings: string[] = [];
  let i = 0;
  const flush = (terminator: string) => {
    // A segment followed by `{` is a selector or an at-rule prelude, not a declaration.
    if (terminator !== "{") {
      const colon = segment.indexOf(":");
      const property = (colon >= 0 ? segment.slice(0, colon) : "").trim().toLowerCase();
      if (property && !NON_TEXT_PROPERTIES.has(property)) {
        const parts = [...strings];
        if (COUNTER_TEXT.has(property)) {
          const idents = segment
            .slice(colon + 1)
            .replace(/\uE000\d+\uE001/g, " ")
            .match(/[\p{L}\p{N}_-]+/gu);
          if (idents) parts.push(idents.join(" "));
        }
        const joined = parts.join("").trim();
        if (joined) out.push(joined);
        // Each string on its own too, so one string can't hide behind a long harmless one.
        if (parts.length > 1) for (const part of parts) if (part.trim()) out.push(part.trim());
      }
    }
    segment = "";
    strings = [];
  };
  while (i < css.length) {
    const ch = css[i]!;
    if (ch === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      i = end < 0 ? css.length : end + 2;
      continue;
    }
    if (ch === "\\") {
      segment += css.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== ch && css[j] !== "\n") j += css[j] === "\\" ? 2 : 1;
      const body = decodeCssString(css.slice(i + 1, Math.min(j, css.length)));
      // A URL's string (url("…"), image-set("…"), data: or theme: pictures) isn't drawn as text.
      const before = segment.replace(/\s+$/, "");
      const isUrl =
        /(?:url|image-set|-webkit-image-set|src|image)\($/i.test(before) || /^(?:data|theme|blob|https?):/i.test(body);
      if (!isUrl) strings.push(body);
      segment += `\uE000${strings.length}\uE001`;
      i = j + 1;
      continue;
    }
    if (ch === "{" || ch === "}" || ch === ";") {
      flush(ch);
      i += 1;
      continue;
    }
    segment += ch;
    i += 1;
  }
  flush("");
  return out;
}

/** The first text a stylesheet draws that a theme may not show. */
export function cssTextThreat(css: string) {
  const texts = cssDrawnTexts(css);
  const found = firstThreat(texts);
  if (found) return found;
  // Words split over several strings or custom properties (`--a: "HAC"; content: var(--a) "KED"`).
  const joined = squashedForm(foldText(texts.join("")));
  if (SECRET_STEMS.test(joined)) return { text: texts.join(" ").slice(0, 120), threat: "secret" as const };
  if (SCARE_STEMS.test(joined)) return { text: texts.join(" ").slice(0, 120), threat: "scare" as const };
  return null;
}
