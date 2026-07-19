// ──────────────────────────────────────────────
// Game: Animated / Expressive Text
//
// Detects emotional or tonal markers in text and
// wraps matching spans with CSS animation classes.
//
// Supported effects:
//   shake     — anger, rage, frustration, impacts
//   shout     — ALL CAPS words, yelling, commands
//   whisper   — (parenthetical asides), murmurs
//   glow      — magic, spells, divine, holy
//   pulse     — heartbeat, fear, tension
//   wave      — singing, chanting, enchantment
//   flicker   — fire, flames, unstable energy
//   drip      — poison, venom, corrosion
//   bounce    — joy, excitement, laughter
//   tremble   — cold, nervous, shivering
//   glitch    — corruption, void, glitch, error
//   expand    — explosions, dramatic reveals
//
// Detection modes:
// 1. Explicit GM tags: {shake:text} or {glow:magical words}
// 2. ALL CAPS → shout, (parenthetical) → whisper
// 3. Context-based: detects emotional keywords and
//    wraps matching words with the appropriate effect.
// ──────────────────────────────────────────────
import { useMemo } from "react";
import DOMPurify from "dompurify";
import { useUIStore } from "../../stores/ui.store";

// ── Effect types & rules ──

type TextEffect =
  | "shake"
  | "shout"
  | "whisper"
  | "glow"
  | "pulse"
  | "wave"
  | "flicker"
  | "drip"
  | "bounce"
  | "tremble"
  | "glitch"
  | "expand";

interface EffectRule {
  effect: TextEffect;
  /** Regex tested against the full text to decide if context applies. */
  contextPattern?: RegExp;
  /** Regex that matches the specific words/phrases to animate. */
  wordPattern?: RegExp;
}

/** Context-based auto-detection rules. Only specific dramatic words get animated. */
const EFFECT_RULES: EffectRule[] = [
  // Critical hit / impact — only the dramatic descriptors
  {
    effect: "shake",
    contextPattern: /\b(CRITICAL|crushing|devastating|shatters|explodes|crash(es|ed)?)\b/i,
    wordPattern: /\b(CRITICAL HIT|crushing blow|devastating|shatters|explodes|crash(es|ed)?)\b/gi,
  },

  // Magic / spells — only clearly magical words
  {
    effect: "glow",
    contextPattern:
      /\b(magic(al)?|spell|enchant(ed|ment)?|arcane|divine|holy|radiant|ethereal|mystic(al)?|rune(s)?|incantation|sorcery)\b/i,
    wordPattern:
      /\b(magic(al)?|spell|enchant(ed|ment)?|arcane|divine|holy|radiant|ethereal|mystic(al)?|rune(s)?|incantation|sorcery)\b/gi,
  },

  // Fire / flames — only fire-specific words
  {
    effect: "flicker",
    contextPattern:
      /\b(fire|flame(s)?|burn(s|ing|ed)?|blaze|inferno|embers?|scorch(ed|ing)?|heat(ed)?|hot|searing|fiery|warmth|smolder(ing)?)\b/i,
    wordPattern:
      /\b(fire|flame(s)?|burn(s|ing|ed)?|blaze|inferno|embers?|scorch(ed|ing)?|heat(ed)?|hot|searing|fiery|warmth|smolder(ing)?)\b/gi,
  },

  // Poison / venom — only toxic words
  {
    effect: "drip",
    contextPattern: /\b(poison(ed|ous)?|venom(ous)?|toxic|acid|corrode|ooze)\b/i,
    wordPattern: /\b(poison(ed|ous)?|venom(ous)?|toxic|acid|corrode|ooze)\b/gi,
  },

  // Corruption / void — only eldritch words
  {
    effect: "glitch",
    contextPattern: /\b(corrupt(ion|ed)?|void|glitch(ed|es|ing)?|distort(ed|ion)?|abyss(al)?|eldritch)\b/i,
    wordPattern: /\b(corrupt(ion|ed)?|void|glitch(ed|es|ing)?|distort(ed|ion)?|abyss(al)?|eldritch)\b/gi,
  },

  // Explosions — only boom words
  {
    effect: "expand",
    contextPattern: /\b(explo(de|sion|des|ding)|erupt(s|ed|ion)?|BOOM|BANG|CRASH|shockwave)\b/i,
    wordPattern: /\b(explo(de|sion|des|ding)|erupt(s|ed|ion)?|BOOM|BANG|CRASH|shockwave)\b/gi,
  },
];

// CSS class for each effect
const EFFECT_CLASS: Record<TextEffect, string> = {
  shake: "anim-text-shake",
  shout: "anim-text-shout",
  whisper: "anim-text-whisper",
  glow: "anim-text-glow",
  pulse: "anim-text-pulse",
  wave: "anim-text-wave",
  flicker: "anim-text-flicker",
  drip: "anim-text-drip",
  bounce: "anim-text-bounce",
  tremble: "anim-text-tremble",
  glitch: "anim-text-glitch",
  expand: "anim-text-expand",
};

// ── Parser ──

/**
 * Parse explicit {effect:text} tags, ALL CAPS, and (parenthetical) text.
 * All other effects require the GM to use explicit {effect:text} markup.
 */
function applyTextEffects(html: string, enabled: boolean): string {
  let result = html;

  // 1) Explicit tags: {shake:angry words here}
  result = result.replace(
    /\{(shake|shout|whisper|glow|pulse|wave|flicker|drip|bounce|tremble|glitch|expand):([^}]+)\}/gi,
    (_match, effect: string, text: string) => {
      if (!enabled) return text;
      const cls = EFFECT_CLASS[effect.toLowerCase() as TextEffect];
      return cls ? `<span class="${cls}">${text}</span>` : text;
    },
  );

  if (!enabled) return result;

  // 2) ALL CAPS words → shout (skip inside HTML tags)
  result = wrapOutsideTags(result, /\b[A-Z]{3,}\b/g, EFFECT_CLASS.shout);

  // 3) Parenthetical asides → whisper (skip inside HTML tags)
  result = wrapOutsideTagsWithTransform(result, /\(([^)]+)\)/g, EFFECT_CLASS.whisper, (match) => match);

  // 4) Context-based: detect specific dramatic words and animate them
  const plainText = result.replace(/<[^>]+>/g, "");
  for (const rule of EFFECT_RULES) {
    if (!rule.contextPattern || !rule.wordPattern) continue;
    if (!rule.contextPattern.test(plainText)) continue;
    rule.wordPattern.lastIndex = 0;
    result = wrapOutsideTags(result, rule.wordPattern, EFFECT_CLASS[rule.effect]);
  }

  return result;
}

/** Wrap regex matches (with custom transform) that are NOT inside HTML tags. */
function wrapOutsideTagsWithTransform(
  html: string,
  pattern: RegExp,
  className: string,
  transform: (match: string) => string,
): string {
  const parts = html.split(/(<[^>]+>)/);
  const cloned = new RegExp(pattern.source, pattern.flags);

  return parts
    .map((part) => {
      if (part.startsWith("<")) return part;
      if (part.includes("anim-text-")) return part;
      return part.replace(cloned, (match) => {
        return `<span class="${className}">${transform(match)}</span>`;
      });
    })
    .join("");
}

/** Wrap regex matches that are NOT inside HTML tags. */
function wrapOutsideTags(html: string, pattern: RegExp, className: string): string {
  // Split on HTML tags to process only text nodes
  const parts = html.split(/(<[^>]+>)/);
  const cloned = new RegExp(pattern.source, pattern.flags);

  return parts
    .map((part) => {
      // If it's an HTML tag, skip
      if (part.startsWith("<")) return part;
      // If it's already inside an animated span, skip
      if (part.includes("anim-text-")) return part;

      return part.replace(cloned, (match) => {
        return `<span class="${className}">${match}</span>`;
      });
    })
    .join("");
}

// ── Per-character wave animation (for wave/chanting) ──

function wrapCharactersForWave(html: string): string {
  // Find wave-animated spans and add per-char delay for the wavy motion
  return html.replace(/<span class="anim-text-wave">([^<]+)<\/span>/g, (_match, text: string) => {
    const chars = [...text];
    const wrapped = chars
      .map((ch, i) =>
        ch === " " ? " " : `<span class="anim-text-wave-char" style="animation-delay:${i * 60}ms">${ch}</span>`,
      )
      .join("");
    return `<span class="anim-text-wave">${wrapped}</span>`;
  });
}

// ── Component ──

interface AnimatedTextProps {
  /** Raw HTML content (already sanitized/formatted). */
  html: string;
  /** Additional CSS class names. */
  className?: string;
  /** Inline styles. */
  style?: React.CSSProperties;
}

export function AnimatedText({ html, className, style }: AnimatedTextProps) {
  const textEffectsEnabled = useUIStore((state) => state.gameTextEffectsEnabled);
  const processedHtml = useMemo(() => {
    let result = applyTextEffects(html, textEffectsEnabled);
    result = wrapCharactersForWave(result);
    // Re-sanitize after our additions
    return DOMPurify.sanitize(result, {
      ALLOWED_TAGS: ["strong", "em", "br", "span"],
      ALLOWED_ATTR: ["class", "style"],
    });
  }, [html, textEffectsEnabled]);

  return <span className={className} style={style} dangerouslySetInnerHTML={{ __html: processedHtml }} />;
}

/** Convenience: apply effects to plain text (not pre-formatted HTML). */
export function animateTextHtml(html: string, enabled = true): string {
  let result = applyTextEffects(html, enabled);
  result = wrapCharactersForWave(result);
  return DOMPurify.sanitize(result, {
    ALLOWED_TAGS: ["strong", "em", "br", "span"],
    ALLOWED_ATTR: ["class", "style"],
  });
}
