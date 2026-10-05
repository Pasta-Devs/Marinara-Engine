export function stripFontFamilyQuotes(family: string): string {
  const trimmed = family.trim();
  if (trimmed.length < 2) return trimmed;

  const quote = trimmed[0];
  if ((quote !== `"` && quote !== `'`) || trimmed[trimmed.length - 1] !== quote) {
    return trimmed;
  }

  return trimmed.slice(1, -1).trim();
}

export function toCssFontFamilyValue(family: string): string {
  const cleanFamily = stripFontFamilyQuotes(family);
  return `"${cleanFamily.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function normalizeChatWidgetFont(value: unknown): string {
  if (typeof value !== "string") return "";
  const font = value.trim();
  if (["", "@app", "@sans", "@serif", "@mono"].includes(font)) return font;
  if (!font.startsWith("custom:")) return "";
  const family = stripFontFamilyQuotes(font.slice(7));
  if (!family || /\p{Cc}/u.test(family)) return "";
  return `custom:${family}`;
}

/** Null leaves the preset's font untouched; custom names always remain one quoted family. */
export function getChatWidgetFontFamily(value: unknown): string | null {
  const font = normalizeChatWidgetFont(value);
  switch (font) {
    case "":
      return null;
    case "@app":
      return "var(--font-user, var(--font-sans))";
    case "@sans":
      return "ui-sans-serif, system-ui, sans-serif";
    case "@serif":
      return 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';
    case "@mono":
      return 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    default:
      return toCssFontFamilyValue(font.slice(7));
  }
}
