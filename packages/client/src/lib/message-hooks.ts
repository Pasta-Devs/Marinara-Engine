// ──────────────────────────────────────────────
// Message hooks for themes (token contract v1.1)
//
// Every message, in every chat mode, carries the same attributes and CSS variables, so a theme can
// write per-message looks ("profile.exe" cards, numbered entries, a generation timer) with
// `attr()`, `counter()` and `var()` instead of guessing at Tailwind classes:
//
//   data-mari-part="message"  data-message-role  data-latest  data-streaming
//   data-character-id  data-character-name  data-character  (slug: lowercase, spaces as -)
//   data-message-index  data-gen-ms
//   --mari-msg-index (number)  --mari-msg-char (string)  --mari-msg-gen (string, "3.2s")
// ──────────────────────────────────────────────
import type { CSSProperties } from "react";

export interface MessageHookInput {
  role: string;
  characterId?: string | null;
  characterName?: string | null;
  index?: number | null;
  generationMs?: number | null;
  latest?: boolean;
  streaming?: boolean;
}

/** A CSS string literal, safe to use as a custom property value and with `content: var(…)`. */
export function cssString(value: string) {
  return `"${value.replace(/[\\"]/g, "\\$&").replace(/[\n\r\f]/g, " ")}"`;
}

export function slugForCss(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "");
}

export function messageHooks(input: MessageHookInput) {
  const name = input.characterName?.trim() || null;
  const genMs = input.generationMs != null && input.generationMs > 0 ? Math.round(input.generationMs) : null;
  const attrs = {
    "data-mari-part": "message",
    "data-message-role": input.role,
    "data-latest": input.latest ? "true" : undefined,
    "data-streaming": input.streaming ? "true" : undefined,
    "data-character-id": input.characterId ?? undefined,
    "data-character-name": name ?? undefined,
    "data-character": name ? slugForCss(name) : undefined,
    "data-message-index": input.index != null ? String(input.index) : undefined,
    "data-gen-ms": genMs != null ? String(genMs) : undefined,
  } as const;
  const style: Record<string, string | number> = {};
  if (input.index != null) style["--mari-msg-index"] = input.index;
  if (name) style["--mari-msg-char"] = cssString(name);
  if (genMs != null) style["--mari-msg-gen"] = cssString(`${(genMs / 1000).toFixed(1)}s`);
  return { attrs, style: style as CSSProperties };
}
