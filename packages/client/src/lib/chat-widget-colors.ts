import type { CSSProperties } from "react";
import { getCssGradientColorStops, isCssGradient, withCssPaintAlpha } from "./css-colors";

export interface ChatWidgetColors {
  border?: string;
  background?: string;
  text?: string;
}

export const CHAT_WIDGET_COLOR_PROPERTIES = [
  "--mari-widget-custom-border",
  "--mari-widget-custom-border-solid",
  "--mari-widget-custom-background",
  "--mari-widget-custom-background-solid",
  "--mari-widget-custom-background-image",
  "--mari-widget-custom-roleplay-background",
  "--mari-widget-custom-text",
  "--mari-widget-custom-text-solid",
  "--mari-widget-custom-text-image",
  "--mari-widget-custom-text-fill",
  "--mari-widget-custom-border-content",
  "--mari-widget-custom-isolation",
] as const;

/** Marks a character's or persona's own name or dialogue color so Apply preset colors keeps it
 *  (chat-widget-surfaces.css). Fallback colors leave it off and follow the preset text. */
export const CHARACTER_COLOR_CLASS = "mari-character-color";
/** Marks dialogue the Engine colors with the fallback inside rich HTML messages, so it still
 *  follows the preset text there while the message's own colors are kept (#7296). */
export const FALLBACK_DIALOGUE_CLASS = "mari-fallback-dialogue";
/** A Game section the player sees (the logs, the Inventory, a combat panel…): a chat-style
 *  surface whose white, black, amber and pale color tints follow the chat style (chat-widget-surfaces.css).
 *  Each also carries data-game-section="<name>" for custom themes. Never nest one directly
 *  inside another. Game content inside a window takes GAME_WINDOW_CONTENT_CLASS instead. */
export const GAME_SECTION_CLASS = "mari-chat-style-surface mari-game-section";
/** Game content inside a shared window (the Journal): its tints follow the window's style. */
export const GAME_WINDOW_CONTENT_CLASS = "mari-game-section";
/** A Game dialog's Modal panel: Roleplay's chat dialog classes plus the Game tint remap. */
export const GAME_DIALOG_CLASS = "mari-chat-style-surface mari-chat-action-panel mari-game-section";

type WidgetColorStyle = CSSProperties & Partial<Record<(typeof CHAT_WIDGET_COLOR_PROPERTIES)[number], string>>;

/** Picker values may paint colors or gradients, never fetch images or inject declarations. */
export function getChatWidgetPaint(value: string | undefined): string {
  const paint = typeof value === "string" ? value.trim() : "";
  if (!paint || /[;{}\\]|url\s*\(/iu.test(paint) || typeof CSS === "undefined") return "";
  if (CSS.supports("color", paint)) return paint;
  return /^(?:repeating-)?(?:linear|radial|conic)-gradient\(/iu.test(paint) && CSS.supports("background-image", paint)
    ? paint
    : "";
}

function solidFallback(paint: string, fallback: string): string {
  return getCssGradientColorStops(paint, fallback).find((color) => CSS.supports("color", color)) ?? fallback;
}

/** Internal fallbacks leave the public custom-theme hooks available to theme authors. */
export function getChatWidgetColorStyle(colors: ChatWidgetColors = {}): WidgetColorStyle {
  const style: WidgetColorStyle = {};
  const border = getChatWidgetPaint(colors.border);
  const background = getChatWidgetPaint(colors.background);
  const text = getChatWidgetPaint(colors.text);
  if (border) {
    style["--mari-widget-custom-border"] = border;
    style["--mari-widget-custom-border-solid"] = solidFallback(border, "currentColor");
    style["--mari-widget-custom-border-content"] = '""';
    style["--mari-widget-custom-isolation"] = "isolate";
  }
  if (background) {
    style["--mari-widget-custom-background"] = background;
    style["--mari-widget-custom-roleplay-background"] = withCssPaintAlpha(background, "var(--mari-rp-bubble-opacity)");
    style["--mari-widget-custom-background-solid"] = solidFallback(background, "transparent");
    style["--mari-widget-custom-background-image"] = isCssGradient(background)
      ? background
      : `linear-gradient(${background}, ${background})`;
  }
  if (text) {
    style["--mari-widget-custom-text"] = text;
    style["--mari-widget-custom-text-solid"] = solidFallback(text, "currentColor");
    style["--mari-widget-custom-text-image"] = isCssGradient(text) ? text : "none";
    style["--mari-widget-custom-text-fill"] = isCssGradient(text) ? "transparent" : text;
  }
  return style;
}

export function getChatWidgetColorRoles(style: WidgetColorStyle): string {
  return (["border", "background", "text"] as const).filter((role) => style[`--mari-widget-custom-${role}`]).join(" ");
}
