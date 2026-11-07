// ──────────────────────────────────────────────
// Appearance picker values as root CSS variables, in the `mari-pickers` cascade layer.
//
// The Appearance pickers (accent, background, fonts, chat colours) used to be written as inline
// styles on <html>, which beat every stylesheet, so a custom theme's colours silently lost to them
// (theming panel, batch 2). They now live in one rule in the mari-pickers layer: above the app's own
// defaults, below a custom theme. Precedence: scheme default, then the pickers, then the theme.
// ──────────────────────────────────────────────

const STYLE_ID = "marinara-appearance-pickers";
let rule: CSSStyleRule | null = null;

function pickerRule(): CSSStyleRule | null {
  if (typeof document === "undefined") return null;
  if (rule && (rule.parentStyleSheet?.ownerNode as Element | null)?.isConnected) return rule;
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = "@layer mari-pickers { :root {} }";
    document.head.appendChild(style);
  }
  const layer = style.sheet?.cssRules[0] as CSSLayerBlockRule | undefined;
  rule = (layer?.cssRules[0] as CSSStyleRule | undefined) ?? null;
  return rule;
}

/** Set a root variable from an Appearance picker. Falls back to an inline style where layers are missing. */
export function setRootVar(name: string, value: string) {
  const target = pickerRule();
  if (target) target.style.setProperty(name, value);
  else document.documentElement.style.setProperty(name, value);
}

export function removeRootVar(name: string) {
  const target = pickerRule();
  if (target) target.style.removeProperty(name);
  document.documentElement.style.removeProperty(name);
}

export function readRootVar(name: string): string {
  return pickerRule()?.style.getPropertyValue(name).trim() ?? "";
}
