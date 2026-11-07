// ──────────────────────────────────────────────
// Placeholder art for cards without a picture.
//
// The hue comes from the id, so every card keeps its own colour. Saturation and lightness are
// theme tokens (--mari-art-*, see styles/README-theming.md), so a theme can calm the gradients
// down or match them to its palette without touching the hue.
// ──────────────────────────────────────────────
type Stops = [saturation1: number, lightness1: number, saturation2: number, lightness2: number];

/**
 * The tokens have no :root value on purpose: each caller's own numbers are the fallback, so the
 * gallery and the tables keep their slightly different looks until a theme sets the tokens.
 */
export function placeholderArt(id: string, spread: number, angle: number, [s1, l1, s2, l2]: Stops) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  const hue2 = (hue + spread) % 360;
  return (
    `linear-gradient(${angle}deg, hsl(${hue} var(--mari-art-saturation-1, ${s1}%) var(--mari-art-lightness-1, ${l1}%)), ` +
    `hsl(${hue2} var(--mari-art-saturation-2, ${s2}%) var(--mari-art-lightness-2, ${l2}%)))`
  );
}
