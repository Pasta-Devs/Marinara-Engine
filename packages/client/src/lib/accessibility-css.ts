// ──────────────────────────────────────────────
// Settings > Appearance > Accessibility, applied (theming panel round 2, batch 1)
//
// The user's choices are written into the mari-protected cascade layer as literal values: no
// variable a theme could redefine, on every element a theme could restyle. A theme can still
// choose colours and fonts, but it can't undo line or letter spacing, focus rings, high contrast,
// the colour-blind-safe palette or the minimum text size in messages.
// ──────────────────────────────────────────────

export interface AccessibilityChoices {
  lineHeight: number;
  letterSpacing: number;
  strongFocus: boolean;
  highContrast: boolean;
  colorBlindSafe: boolean;
  /** Reduce motion (the setting, or the OS asking for it): theme animations and transitions stop too. */
  reduceMotion?: boolean;
  /** Appearance > Accessibility > Backdrop strength, 0-100: how strongly a theme's art shows. */
  backdropStrength?: number;
  scheme: "dark" | "light";
}

const STYLE_ID = "mari-a11y-protected";

/** Colour-blind-safe status and danger colours: blue for good, yellow for warning, orange for bad. */
const CVD = {
  dark: { good: "#3b82f6", warn: "#eab308", bad: "#f97316" },
  light: { good: "#1d4ed8", warn: "#a16207", bad: "#c2410c" },
};

/** The smallest message text when any accessibility option is on. */
const MIN_MESSAGE_TEXT_PX = 12;

export function accessibilityCss(choices: AccessibilityChoices) {
  const rules: string[] = [];
  const any =
    choices.lineHeight > 1 ||
    choices.letterSpacing > 0 ||
    choices.strongFocus ||
    choices.highContrast ||
    choices.colorBlindSafe ||
    !!choices.reduceMotion ||
    (choices.backdropStrength ?? 100) < 100;
  if (!any) return "";

  // A theme's art (the backdrop and the ambient overlay) at the user's strength. High contrast
  // fades it to a quarter at most, so text sits on the solid surfaces below, not on the picture.
  const strength = Math.min(
    Math.max(0, Math.min(100, choices.backdropStrength ?? 100)) / 100,
    choices.highContrast ? 0.25 : 1,
  );
  if (strength < 1) {
    rules.push(
      `[data-mari-part="app-backdrop"] { opacity: ${strength} !important; }` +
        ` [data-mari-part="ambient"] { opacity: calc(min(var(--mari-ambient-opacity, 1), 1) * ${strength}) !important; }`,
    );
  }

  if (choices.reduceMotion) {
    // The ambient overlay stands still (its pictures are swapped for still frames by the theme injector).
    rules.push(
      `[data-mari-part="ambient"], [data-mari-part="ambient"]::before, [data-mari-part="ambient"]::after { animation: none !important; }`,
    );
    // Loading spinners keep turning: a still spinner reads as a frozen app.
    rules.push(
      `*:not(.animate-spin, .animate-spin *), ::before, ::after { animation-duration: 0.01ms !important;` +
        ` animation-iteration-count: 1 !important; animation-delay: 0s !important;` +
        ` transition-duration: 0.01ms !important; transition-delay: 0s !important; scroll-behavior: auto !important; }`,
    );
  }

  if (choices.lineHeight > 1) {
    const value = String(choices.lineHeight);
    rules.push(
      `:is(p, li, blockquote, textarea, .mari-messages-scroll, [data-mari-part="message"]),` +
        `[data-mari-part="message"] :is(p, li, span, div, em, strong, q, a) { line-height: ${value} !important; }`,
    );
  }
  if (choices.letterSpacing > 0) {
    // On every element, so a theme's `* { letter-spacing: … }` can't squeeze text back together.
    rules.push(`body, body *:not(svg, svg *) { letter-spacing: ${choices.letterSpacing}em !important; }`);
  }

  // Message text never shrinks below a readable size, whatever a theme sets.
  rules.push(
    `[data-mari-part="message"] :is(p, li, span, em, strong, q, blockquote, a, code, small) { font-size: max(${MIN_MESSAGE_TEXT_PX}px, 1em) !important; }`,
  );

  const ring = choices.scheme === "light" ? { line: "#000000", halo: "#ffffff" } : { line: "#ffffff", halo: "#000000" };
  if (choices.strongFocus || choices.highContrast) {
    const width = choices.strongFocus ? 3 : 2;
    rules.push(
      `:focus-visible:not(#mari-main) { outline: ${width}px solid ${ring.line} !important; outline-offset: 2px !important;` +
        ` box-shadow: 0 0 0 ${width + 2}px ${ring.halo} !important; filter: none !important; opacity: 1 !important; visibility: visible !important; }`,
    );
  }

  if (choices.highContrast) {
    const fg = choices.scheme === "light" ? "#000000" : "#ffffff";
    const mix = (percent: number) => `color-mix(in srgb, ${fg} ${percent}%, transparent)`;
    // Solid surfaces: white text on a pastel card (or black on a night picture) is unreadable
    // whatever the text colour, so panels, cards, menus, sidebars, bubbles and the page veil become
    // the scheme's own solid colours while High contrast is on.
    const surface =
      choices.scheme === "light"
        ? { page: "#ffffff", panel: "#f3f3f5", raised: "#e9e9ee" }
        : { page: "#0b0b10", panel: "#15151c", raised: "#1e1e27" };
    rules.push(
      `:root, :root * { --background: ${surface.page} !important; --card: ${surface.panel} !important;` +
        ` --popover: ${surface.raised} !important; --sidebar: ${surface.panel} !important;` +
        ` --secondary: ${surface.raised} !important; --muted: ${surface.raised} !important;` +
        ` --mari-rp-bubble-bg: ${surface.panel} !important; --ov-panel: ${surface.panel} !important;` +
        ` --ov-panel-raised: ${surface.raised} !important; --mari-page-veil: ${surface.page} !important;` +
        ` --mari-home-wash: ${surface.page} !important; --mari-home-widget-bg: ${surface.panel} !important;` +
        ` --mari-top-bar-plate: ${surface.page} !important; }`,
      // A theme that paints its panels with its own colours (not the tokens above) would leave
      // the new text colour on a pale or busy surface, so the big panels and message boxes are
      // painted solid too, without picture frames (only while a theme is on).
      `:root[data-custom-theme] :is([data-component="TopBar"], [data-component="ChatSidebarPanel"], [data-component="CenterContent"],` +
        ` [data-component="RightPanelDesktop"], [data-component="RightPanelMobile"], [data-mari-part="composer"])` +
        ` { background: ${surface.page} !important; border-image: none !important; }` +
        ` :root[data-custom-theme] :is([data-mari-part="message"], [data-mari-part="home-widget"], [data-component="CenterContent"] :is(section, fieldset))` +
        ` { background: ${surface.panel} !important; border-image: none !important; }`,
    );
    rules.push(
      `:root, :root * { --foreground: ${fg} !important; --muted-foreground: ${mix(88)} !important;` +
        ` --border: ${mix(45)} !important; --input: ${mix(50)} !important; --ov-line: ${mix(40)} !important;` +
        ` --ovm-line: ${mix(40)} !important; --ov-text: ${fg} !important; --ov-muted: ${mix(88)} !important;` +
        ` --ov-dim: ${mix(78)} !important; --mari-focus-ring-color: ${fg} !important; }`,
    );
    // Accents and selected states too: a pale accent or a faint selected tab is as hard to see as
    // pale text. CSS can't measure the user's accent, so it becomes a strong blue that reads on
    // the scheme, and selected tabs and pressed buttons get an outline.
    const accent = choices.scheme === "light" ? "#00429d" : "#8fd3ff";
    const onAccent = choices.scheme === "light" ? "#ffffff" : "#000000";
    rules.push(
      `:root, :root * { --primary: ${accent} !important; --primary-foreground: ${onAccent} !important;` +
        ` --ov-accent: ${accent} !important; --ring: ${fg} !important;` +
        ` --marinara-app-accent-solid: ${accent} !important; --marinara-chat-chrome-accent: ${accent} !important; }`,
      // Mode colours (the pink Roleplay tab and friends) and half-faded text read as plain text.
      `:root, :root * { --mari-mode-conversation: ${fg} !important; --mari-mode-roleplay: ${fg} !important;` +
        ` --mari-mode-game: ${fg} !important; --mari-home-pink: ${fg} !important; --mari-home-violet: ${fg} !important; }`,
      `:is(span, p, small, time, h1, h2, h3, h4, label):is(.opacity-40, .opacity-50, .opacity-60, .opacity-70, .opacity-75, .opacity-80),` +
        ` :is([class*="text-[var(--foreground)]/"], [class*="text-[var(--muted-foreground)]/"]):not(svg, svg *)` +
        ` { opacity: 1 !important; color: ${mix(88)} !important; }`,
      `:is([role="tab"][aria-selected="true"], [aria-pressed="true"], [aria-current="page"], [aria-current="true"], .is-active)` +
        `:not(svg, svg *) { outline: 2px solid ${fg} !important; outline-offset: -2px !important; }`,
    );
  }

  if (choices.colorBlindSafe) {
    const palette = CVD[choices.scheme];
    rules.push(
      `:root, :root * { --mari-cvd-good: ${palette.good} !important; --mari-cvd-warn: ${palette.warn} !important;` +
        ` --mari-cvd-bad: ${palette.bad} !important; --mari-status-online: ${palette.good} !important;` +
        ` --mari-status-idle: ${palette.warn} !important; --mari-status-dnd: ${palette.bad} !important;` +
        ` --mari-gauge-ok: ${palette.good} !important; --mari-gauge-warn: ${palette.warn} !important;` +
        ` --mari-gauge-danger: ${palette.bad} !important; --destructive: ${palette.bad} !important; }`,
    );
  }

  return `@layer mari-protected {\n${rules.join("\n")}\n}`;
}

/** Puts the rules in <head> (or removes them when nothing is on). */
export function applyAccessibilityCss(choices: AccessibilityChoices) {
  const css = accessibilityCss(choices);
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!css) {
    style?.remove();
    return;
  }
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  if (style.textContent !== css) style.textContent = css;
}
