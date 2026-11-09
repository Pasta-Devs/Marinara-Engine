// ──────────────────────────────────────────────
// Starter themes (theming round 6, download on demand since 2026-11-09)
//
// Starter themes no longer ship inside the app. They live in the theme gallery (a `themes/` folder on the
// repo's theme branch, see services/themes/theme-gallery.service.ts) and are downloaded only when someone
// picks one. A downloaded one is kept as a custom_themes row with the id "starter-<gallery id>": read-only
// (the routes refuse to change it, the app offers "Clone + Edit"), removable, and replaced in place when
// the gallery has a newer version.
// ──────────────────────────────────────────────
export const STARTER_THEME_PREFIX = "starter-";

export function isStarterThemeId(id: string) {
  return id.startsWith(STARTER_THEME_PREFIX);
}
