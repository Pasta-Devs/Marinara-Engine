// ──────────────────────────────────────────────
// Message template slot (theming round 2, batch 7)
//
// A theme can carry a small HTML template per message role (meta.templates: message, assistant,
// user, narrator). It's filled with the message's data and shown in a box at the end of every
// message, `[data-mari-part="message-extra"]`, which the theme styles and positions with CSS:
//
//   {{char}}  the speaker's name      {{role}}  assistant, user, narrator or system
//   {{index}} the message number       {{gen}}   generation time ("3.2s", empty if unknown)
//   {{time}}  the time it was sent     {{date}}  the date it was sent
//
// Unknown fields render empty. The HTML is sanitised: plain text-level and layout tags only, no
// scripts, styles, links, images, forms or event attributes, and no inline style (the theme's CSS
// does the styling). Text that asks for keys or passwords drops the whole template.
//
// HTML in a theme is opt-in: Settings > Appearance > CSS Themes > "Allow themes with HTML" (off by
// default). With it off, themes with templates can't be installed and installed ones don't render.
// ──────────────────────────────────────────────
import DOMPurify from "dompurify";
import { create } from "zustand";
import type { ThemeMeta, ThemeTemplates } from "@marinara-engine/shared";
import { looksLikeSecretRequest } from "./theme-guard";

const TEMPLATE_TAGS = [
  "div",
  "span",
  "p",
  "br",
  "hr",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "small",
  "sub",
  "sup",
  "mark",
  "code",
  "pre",
  "kbd",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "details",
  "summary",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "footer",
  "section",
  "aside",
  "figure",
  "figcaption",
  "progress",
  "meter",
];
const TEMPLATE_ATTRS = ["class", "title", "role", "aria-label", "aria-hidden", "value", "max", "min", "open"];

/** True when a theme carries any HTML (a non-empty message template). */
export function themeHasHtml(meta: ThemeMeta | null | undefined): boolean {
  const templates = meta?.templates;
  return !!templates && Object.values(templates).some((value) => typeof value === "string" && value.trim() !== "");
}

/** The active theme's templates, set by CustomThemeInjector (null when none, or HTML isn't allowed). */
export const useThemeTemplates = create<{ templates: ThemeTemplates | null }>(() => ({ templates: null }));

export function pickTemplate(templates: ThemeTemplates | null, role: string): string | null {
  if (!templates) return null;
  const own =
    role === "user"
      ? templates.user
      : role === "narrator" || role === "system"
        ? templates.narrator
        : templates.assistant;
  const value = own?.trim() ? own : templates.message;
  return value?.trim() ? value : null;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

export interface TemplateFields {
  char?: string | null;
  role?: string | null;
  index?: number | null;
  generationMs?: number | null;
  createdAt?: string | null;
}

/** Fills and sanitises a template. Returns "" when nothing safe is left. */
export function renderMessageTemplate(template: string, fields: TemplateFields): string {
  const sent = fields.createdAt ? new Date(fields.createdAt) : null;
  const valid = sent && !Number.isNaN(sent.getTime()) ? sent : null;
  const values: Record<string, string> = {
    char: fields.char?.trim() ?? "",
    role: fields.role ?? "",
    index: fields.index != null ? String(fields.index) : "",
    gen: fields.generationMs != null && fields.generationMs > 0 ? `${(fields.generationMs / 1000).toFixed(1)}s` : "",
    time: valid ? valid.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
    date: valid ? valid.toLocaleDateString() : "",
  };
  const filled = template.replace(/\{\{\s*([a-z]+)\s*\}\}/gi, (_, key: string) =>
    escapeHtml(values[key.toLowerCase()] ?? ""),
  );
  const clean = DOMPurify.sanitize(filled, {
    ALLOWED_TAGS: TEMPLATE_TAGS,
    ALLOWED_ATTR: TEMPLATE_ATTRS,
    ALLOW_DATA_ATTR: true,
    ALLOW_ARIA_ATTR: false,
  }) as string;
  if (!clean.trim()) return "";
  const text = clean.replace(/<[^>]*>/g, " ");
  return looksLikeSecretRequest(text) ? "" : clean;
}
