import type { CSSProperties } from "react";
import { getCssGradientColorStops, isCssGradient } from "./css-colors";

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
  "--mari-widget-custom-text",
  "--mari-widget-custom-text-solid",
  "--mari-widget-custom-text-image",
  "--mari-widget-custom-text-fill",
  "--mari-widget-custom-border-content",
  "--mari-widget-custom-isolation",
] as const;

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
