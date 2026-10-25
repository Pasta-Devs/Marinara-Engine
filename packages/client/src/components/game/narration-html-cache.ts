import { i18n } from "../../localization/i18n";

/**
 * Remembers finished narration HTML per text and text-effects setting, oldest entry out first. The
 * HTML can carry translated text (the item-used badge), so it starts over whenever the language
 * switches or a translation is added, reloaded or removed. Each cache listens to i18n for the life
 * of the page, so create one per module, never per render.
 */
export function createNarrationHtmlCache(
  build: (content: string, textEffectsEnabled: boolean) => string,
  limit = 2000,
): (content: string, textEffectsEnabled: boolean) => string {
  const entries = new Map<string, string>();
  const clear = () => entries.clear();
  i18n.on("languageChanged", clear);
  i18n.store.on("added", clear);
  i18n.store.on("removed", clear);

  return (content, textEffectsEnabled) => {
    const key = `${textEffectsEnabled ? 1 : 0}\u0000${content}`;
    const cached = entries.get(key);
    if (cached !== undefined) return cached;
    const html = build(content, textEffectsEnabled);
    if (entries.size >= limit) {
      const oldest = entries.keys().next().value;
      if (oldest !== undefined) entries.delete(oldest);
    }
    entries.set(key, html);
    return html;
  };
}
